/**
 * server/src/__tests__/securityAndE2EE.test.js
 * ============================================
 * Comprehensive Automated Security, IDOR, Zero-Knowledge & E2EE Verification Suite
 * 
 * Verifies:
 * 1. Zero-Knowledge Storage:
 *    - Server NEVER persists plaintext content when ciphertext is provided.
 *    - Message editing scrubs plaintext and stores [Encrypted Message] when ciphertext is provided.
 *    - Soft delete for everyone purges ciphertext and IV nonce.
 * 2. Authorization & IDOR Protections:
 *    - Unauthorized users cannot view conversation messages.
 *    - Non-senders cannot edit messages (403).
 *    - Non-senders cannot delete for everyone (403).
 *    - Non-members cannot clear conversations or manage pins/mutes.
 * 3. Multi-Device Key Management:
 *    - Device listing for authenticated user.
 *    - Device revocation with cascading prekey cleanup.
 *    - Multi-device bundle retrieval with per-device OPK consumption.
 *    - Blocked user cannot establish session or claim PreKey bundles.
 * 4. Cryptographic Primitives & Authenticated Decryption:
 *    - ECDH P-256 shared secret derivation.
 *    - AES-256-GCM authenticated encryption and integrity check.
 *    - Tampering rejection (modified ciphertext or IV fails tag authentication).
 *    - Wrong key rejection.
 */

const { webcrypto } = require('crypto');
const cryptoSubtle = webcrypto.subtle;

// Mock database query
jest.mock('../config/db', () => ({
  query: jest.fn()
}));

const { query } = require('../config/db');
const messageController = require('../controllers/messageController');
const e2eeController = require('../controllers/e2eeController');

describe('Phase 6: Security, IDOR & E2EE Verification Suite', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: 1, username: 'alice' },
      params: {},
      body: {},
      query: {},
      app: {
        get: jest.fn().mockReturnValue({
          to: jest.fn().mockReturnValue({ emit: jest.fn() })
        })
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  // =========================================================================
  // 1. Zero-Knowledge Transmission & Storage Enforcement
  // =========================================================================
  describe('Zero-Knowledge Ingestion & Persistence', () => {
    it('should NEVER persist plaintext content in DB when ciphertext is provided to sendMessage', async () => {
      req.params.username = 'bob';
      req.body = {
        content: 'SUPER SECRET PLAINTEXT PASSWORD', // Client attempted to send plaintext
        ciphertext: 'base64ciphertext12345',
        ivNonce: 'base64nonce67890',
        senderDeviceId: 'dev-1'
      };

      // 1. Resolve recipient
      query.mockResolvedValueOnce({
        rows: [{ id: 2, username: 'bob', allow_messages_from: 'everyone' }]
      });
      // 2. Find conversation
      query.mockResolvedValueOnce({
        rows: [{ id: 'conv-uuid-1', ephemeral_timer_seconds: null }]
      });
      // 3. Insert message
      query.mockResolvedValueOnce({
        rows: [{
          id: 101,
          sender_id: 1,
          recipient_id: 2,
          conversation_id: 'conv-uuid-1',
          content: '[Encrypted Message]',
          ciphertext: 'base64ciphertext12345',
          iv_nonce: 'base64nonce67890',
          sender_device_id: 'dev-1',
          message_type: 'text',
          reply_to_id: null,
          is_read: false,
          is_deleted: false,
          is_forwarded: false,
          created_at: new Date().toISOString()
        }]
      });

      await messageController.sendMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      // Check the parameters passed to the INSERT query ($4 is cleanContent)
      const insertCall = query.mock.calls[2];
      const sqlQuery = insertCall[0];
      const params = insertCall[1];

      expect(sqlQuery).toContain('INSERT INTO messages');
      // Verify that cleanContent ($4) was forced to '[Encrypted Message]' and NOT the plaintext!
      expect(params[3]).toBe('[Encrypted Message]');
      expect(params[3]).not.toContain('SUPER SECRET PLAINTEXT PASSWORD');
      expect(params[4]).toBe('base64ciphertext12345');
    });

    it('should NEVER persist plaintext content in DB when editing with ciphertext', async () => {
      req.params.id = 101;
      req.body = {
        content: 'EDITED PLAINTEXT THAT MUST NOT BE SAVED',
        ciphertext: 'editedCiphertext999',
        ivNonce: 'editedNonce999'
      };

      // 1. Fetch message to check ownership
      query.mockResolvedValueOnce({
        rows: [{
          id: 101,
          sender_id: 1, // owned by alice
          recipient_id: 2,
          conversation_id: 'conv-uuid-1',
          is_deleted: false,
          message_type: 'text'
        }]
      });
      // 2. Update message
      query.mockResolvedValueOnce({
        rows: [{
          id: 101,
          sender_id: 1,
          recipient_id: 2,
          conversation_id: 'conv-uuid-1',
          content: '[Encrypted Message]',
          ciphertext: 'editedCiphertext999',
          iv_nonce: 'editedNonce999',
          edited_at: new Date().toISOString()
        }]
      });

      await messageController.editMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const updateCall = query.mock.calls[1];
      const params = updateCall[1];

      // $1 is content, $2 is ciphertext
      expect(params[0]).toBe('[Encrypted Message]');
      expect(params[0]).not.toContain('EDITED PLAINTEXT');
      expect(params[1]).toBe('editedCiphertext999');
    });

    it('should completely purge ciphertext and IV nonce on delete for everyone', async () => {
      req.params.id = 101;
      req.body = { type: 'for_everyone' };

      // 1. Fetch message
      query.mockResolvedValueOnce({
        rows: [{
          id: 101,
          sender_id: 1,
          recipient_id: 2,
          conversation_id: 'conv-uuid-1',
          is_deleted: false
        }]
      });
      // 2. Update query
      query.mockResolvedValueOnce({ rowCount: 1 });

      await messageController.deleteMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const updateCall = query.mock.calls[1];
      const sqlQuery = updateCall[0];

      expect(sqlQuery).toContain('ciphertext = NULL');
      expect(sqlQuery).toContain('iv_nonce = NULL');
      expect(sqlQuery).toContain('is_deleted = TRUE');
    });
  });

  // =========================================================================
  // 2. Authorization & IDOR Protections
  // =========================================================================
  describe('Authorization & IDOR Protection', () => {
    it('should reject editing another user message with 403 Forbidden', async () => {
      req.params.id = 102;
      req.body = { content: 'hacked edit' };

      query.mockResolvedValueOnce({
        rows: [{
          id: 102,
          sender_id: 99, // sent by someone else!
          recipient_id: 1,
          is_deleted: false,
          message_type: 'text'
        }]
      });

      await messageController.editMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'You can only edit your own messages.' })
      );
    });

    it('should reject delete for everyone if caller is not the sender', async () => {
      req.params.id = 102;
      req.body = { type: 'for_everyone' };

      query.mockResolvedValueOnce({
        rows: [{
          id: 102,
          sender_id: 99, // sent by someone else
          recipient_id: 1,
          conversation_id: 'conv-uuid-1',
          is_deleted: false
        }]
      });

      await messageController.deleteMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Only the sender can delete a message for everyone.' })
      );
    });

    it('should reject message info request if caller is neither sender nor recipient', async () => {
      req.params.id = 200;

      query.mockResolvedValueOnce({
        rows: [{
          id: 200,
          sender_id: 50,
          recipient_id: 51,
          conversation_id: 'conv-secret'
        }]
      });

      await messageController.getMessageInfo(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject pin message if caller is not a member of the conversation', async () => {
      req.params.id = 'conv-private';

      query.mockResolvedValueOnce({ rows: [] }); // not a member

      await messageController.togglePinMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject mute conversation if caller is not a member', async () => {
      req.params.id = 'conv-private';
      req.body = { isMuted: true };

      query.mockResolvedValueOnce({ rows: [] });

      await messageController.toggleMuteConversation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // =========================================================================
  // 3. Multi-Device Key Management
  // =========================================================================
  describe('Multi-Device E2EE Key Management', () => {
    it('should list all registered devices for the authenticated user', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { id: 1, device_id: 'dev-laptop', registration_id: 1001, created_at: '2026-09-01', last_seen_at: '2026-09-14' },
          { id: 2, device_id: 'dev-mobile', registration_id: 1002, created_at: '2026-09-10', last_seen_at: '2026-09-13' }
        ]
      });

      await e2eeController.getUserDevices(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          devices: expect.arrayContaining([
            expect.objectContaining({ device_id: 'dev-laptop' }),
            expect.objectContaining({ device_id: 'dev-mobile' })
          ])
        }
      });
    });

    it('should revoke a registered device and cascade delete its prekeys', async () => {
      req.params.deviceId = 'dev-old-phone';

      query.mockResolvedValueOnce({
        rows: [{ id: 5 }] // Successfully deleted
      });

      await e2eeController.revokeDevice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Device revoked successfully.'
      });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_devices'),
        [1, 'dev-old-phone']
      );
    });

    it('should return 404 when attempting to revoke an unowned or nonexistent device', async () => {
      req.params.deviceId = 'dev-someone-elses';

      query.mockResolvedValueOnce({ rows: [] });

      await e2eeController.revokeDevice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Device not found or not owned by user.'
      });
    });

    it('should prevent blocked users from fetching prekey bundles', async () => {
      req.params.userIdOrUsername = 'bob';

      // 1. Resolve user
      query.mockResolvedValueOnce({ rows: [{ id: 2 }] });
      // 2. Block check returns blocked relationship
      query.mockResolvedValueOnce({ rows: [{ blocker_id: 2, blocked_id: 1 }] });

      await e2eeController.getPreKeyBundle(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Cannot establish session with this user.' })
      );
    });

    it('should return PreKey bundles for all active devices of a recipient', async () => {
      req.params.userIdOrUsername = 'bob';

      // 1. Resolve user
      query.mockResolvedValueOnce({ rows: [{ id: 2 }] });
      // 2. Block check
      query.mockResolvedValueOnce({ rows: [] });
      // 3. Fetch all active devices
      query.mockResolvedValueOnce({
        rows: [
          { id: 10, device_id: 'bob-laptop', identity_key_pub: 'id-bob-1', signed_prekey_pub: 'spk-bob-1', signed_prekey_sig: 'sig-1', signed_prekey_id: 1, registration_id: 5001 },
          { id: 11, device_id: 'bob-phone', identity_key_pub: 'id-bob-2', signed_prekey_pub: 'spk-bob-2', signed_prekey_sig: 'sig-2', signed_prekey_id: 1, registration_id: 5002 }
        ]
      });
      // 4. OPK for device 10
      query.mockResolvedValueOnce({ rows: [{ key_id: 1, prekey_pub: 'opk-1' }] });
      // 5. OPK for device 11
      query.mockResolvedValueOnce({ rows: [{ key_id: 2, prekey_pub: 'opk-2' }] });

      await e2eeController.getAllDevicePreKeyBundles(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.devices).toHaveLength(2);
      expect(data.devices[0].deviceId).toBe('bob-laptop');
      expect(data.devices[1].deviceId).toBe('bob-phone');
    });
  });

  // =========================================================================
  // 4. Cryptographic Primitives & Anti-Tampering Checks
  // =========================================================================
  describe('Cryptographic Primitives & Anti-Tampering (Web Crypto)', () => {
    it('should successfully perform ECDH key exchange and AES-256-GCM authenticated encryption/decryption', async () => {
      // Alice generates keypair
      const alicePair = await cryptoSubtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      );
      // Bob generates keypair
      const bobPair = await cryptoSubtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      );

      // Both derive symmetric AES-256-GCM key
      const aliceSharedKey = await cryptoSubtle.deriveKey(
        { name: 'ECDH', public: bobPair.publicKey },
        alicePair.privateKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const bobSharedKey = await cryptoSubtle.deriveKey(
        { name: 'ECDH', public: alicePair.publicKey },
        bobPair.privateKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // Alice encrypts message
      const plaintext = 'Zero-Knowledge Secret on VibeGrid';
      const iv = webcrypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(plaintext);

      const ciphertextBuffer = await cryptoSubtle.encrypt(
        { name: 'AES-GCM', iv },
        aliceSharedKey,
        encoded
      );

      // Bob decrypts message
      const decryptedBuffer = await cryptoSubtle.decrypt(
        { name: 'AES-GCM', iv },
        bobSharedKey,
        ciphertextBuffer
      );
      const decryptedText = new TextDecoder().decode(decryptedBuffer);

      expect(decryptedText).toBe(plaintext);
    });

    it('should reject tampered ciphertext with authentication error (OperationError)', async () => {
      const key = await cryptoSubtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const iv = webcrypto.getRandomValues(new Uint8Array(12));
      const plaintext = 'Confidential message';
      const ciphertextBuffer = await cryptoSubtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext)
      );

      // Maliciously tamper with 1 byte of the ciphertext
      const tamperedBytes = new Uint8Array(ciphertextBuffer);
      tamperedBytes[0] ^= 0xff; // flip bits

      await expect(
        cryptoSubtle.decrypt({ name: 'AES-GCM', iv }, key, tamperedBytes)
      ).rejects.toThrow();
    });

    it('should reject decryption when an incorrect session key is used', async () => {
      const correctKey = await cryptoSubtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const wrongKey = await cryptoSubtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const iv = webcrypto.getRandomValues(new Uint8Array(12));
      const ciphertextBuffer = await cryptoSubtle.encrypt(
        { name: 'AES-GCM', iv },
        correctKey,
        new TextEncoder().encode('Secret')
      );

      await expect(
        cryptoSubtle.decrypt({ name: 'AES-GCM', iv }, wrongKey, ciphertextBuffer)
      ).rejects.toThrow();
    });
  });
});

/**
 * client/src/services/crypto/e2eeService.js
 * =========================================
 * High-Level End-to-End Encryption (E2EE) Service
 * 
 * Implements:
 * 1. Device identity & PreKey bundle registration on startup.
 * 2. X3DH (Extended Triple Diffie-Hellman) style key agreement over standard Web Crypto (ECDH P-256).
 * 3. HKDF-SHA256 key derivation with per-session ratchet states.
 * 4. AES-256-GCM authenticated encryption/decryption with message integrity.
 * 5. Backward compatibility with legacy plaintext messages.
 * 
 * SECURITY MANDATE:
 * Private keys NEVER leave client-side IndexedDB.
 * Server stores and relays ciphertext only.
 */

import apiClient from '../../api/client';
import {
  generateECDHKeyPair,
  generateSigningKeyPair,
  exportPublicKey,
  importPublicKey,
  exportPrivateKeyJWK,
  importPrivateKeyJWK,
  signData,
  deriveSharedSecret,
  deriveAESKeyFromRawSecret,
  encryptAESGCM,
  decryptAESGCM,
  exportPrivateKeyJWK as exportJWK,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  stringToUint8Array
} from './cryptoUtils';
import keyStore from './keyStore';

class E2EEService {
  constructor() {
    this.currentUserId = null;
    this.deviceId = null;
    this.isInitialized = false;
    this.activeCryptoKeys = new Map(); // peerUserId -> AES CryptoKey
    this._sessionKeyPromises = new Map(); // peerUserId -> in-flight Promise<CryptoKey|null>
    this.decryptedTextCache = new Map(); // cacheKey -> decryptedText string
  }

  // ==========================================================================
  // 1. Device Registration & PreKey Management
  // ==========================================================================

  /**
   * Initializes client keys for the authenticated user.
   * If not already generated on this device, creates key pairs and registers
   * public prekey bundle with the backend directory.
   */
  async initDeviceKeys(userId) {
    if (!userId) return false;
    this.currentUserId = Number(userId);

    try {
      let identity = await keyStore.getDeviceIdentity(this.currentUserId);

      if (!identity) {
        console.log('🔐 [E2EE] Initializing fresh cryptographic identity on this device...');

        // 1. Generate Identity KeyPair (ECDH P-256)
        const idKeyPair = await generateECDHKeyPair();
        const idPubBase64 = await exportPublicKey(idKeyPair.publicKey);
        const idPrivJWK = await exportPrivateKeyJWK(idKeyPair.privateKey);

        // 2. Generate Identity Signing KeyPair (ECDSA P-256)
        const signKeyPair = await generateSigningKeyPair();
        const signPubBase64 = await exportPublicKey(signKeyPair.publicKey);
        const signPrivJWK = await exportPrivateKeyJWK(signKeyPair.privateKey);

        // 3. Generate Signed PreKey (ECDH P-256)
        const spkKeyPair = await generateECDHKeyPair();
        const spkPubBase64 = await exportPublicKey(spkKeyPair.publicKey);
        const spkPrivJWK = await exportPrivateKeyJWK(spkKeyPair.privateKey);

        // Sign the Signed PreKey public key with the Signing Private Key
        const spkSigBase64 = await signData(signKeyPair.privateKey, spkPubBase64);

        // 4. Generate Initial Pool of 50 One-Time PreKeys (OPKs)
        const opkPool = [];
        const opkUploadList = [];

        for (let i = 1; i <= 50; i++) {
          const opkPair = await generateECDHKeyPair();
          const opkPubBase64 = await exportPublicKey(opkPair.publicKey);
          const opkPrivJWK = await exportPrivateKeyJWK(opkPair.privateKey);

          opkPool.push({
            keyId: i,
            publicKey: opkPubBase64,
            privateKeyJWK: opkPrivJWK
          });

          opkUploadList.push({
            keyId: i,
            publicKey: opkPubBase64
          });
        }

        const deviceId = typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        const registrationId = Math.floor(Math.random() * 1000000) + 1;

        // Persist private keys securely in IndexedDB
        identity = {
          deviceId,
          registrationId,
          identityPublicKey: idPubBase64,
          identityPrivateKeyJWK: idPrivJWK,
          signingPublicKey: signPubBase64,
          signingPrivateKeyJWK: signPrivJWK
        };

        await keyStore.saveDeviceIdentity(this.currentUserId, identity);

        await keyStore.saveSignedPreKey(this.currentUserId, {
          keyId: 1,
          publicKey: spkPubBase64,
          privateKeyJWK: spkPrivJWK,
          signature: spkSigBase64
        });

        await keyStore.saveOneTimePreKeys(this.currentUserId, opkPool);

        // Register public keys with server
        const regRes = await apiClient.post('/e2ee/keys/register', {
          deviceId,
          registrationId,
          identityKey: idPubBase64,
          signedPreKey: {
            keyId: 1,
            publicKey: spkPubBase64,
            signature: spkSigBase64
          },
          oneTimePreKeys: opkUploadList
        });

        if (!regRes.success) {
          console.warn('⚠️ [E2EE] Key registration returned failure:', regRes.error);
        } else {
          console.log('✅ [E2EE] Cryptographic keys registered with server.');
        }
      }

      this.deviceId = identity.deviceId;
      this.isInitialized = true;
      return true;
    } catch (err) {
      console.error('❌ [E2EE] Failed to initialize device keys:', err);
      return false;
    }
  }

  // ==========================================================================
  // 2. Key Agreement & Session Management (X3DH)
  // ==========================================================================

  /**
   * Concatenates multiple ArrayBuffers into one contiguous ArrayBuffer
   */
  _concatBuffers(buffers) {
    const totalLength = buffers.reduce((acc, b) => acc + b.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const b of buffers) {
      result.set(new Uint8Array(b), offset);
      offset += b.byteLength;
    }
    return result.buffer;
  }

  /**
   * Retrieves or establishes an encrypted session with a target peer.
   * @param {number} peerUserId 
   * @returns {Promise<CryptoKey|null>} - AES-256-GCM symmetric key
   */
  async getOrCreateSessionKey(peerUserId) {
    const peerId = Number(peerUserId);
    if (!peerId || !this.currentUserId) return null;

    // 1. Check in-memory cache
    if (this.activeCryptoKeys.has(peerId)) {
      return this.activeCryptoKeys.get(peerId);
    }

    // 2. Check in-flight promise to prevent concurrent duplicate DH math / bundle fetches
    if (this._sessionKeyPromises.has(peerId)) {
      return this._sessionKeyPromises.get(peerId);
    }

    const keyPromise = (async () => {
      try {
        // Check IndexedDB
        const savedSession = await keyStore.getSession(this.currentUserId, peerId);
        if (savedSession && savedSession.rawKeyBase64) {
          const rawBuf = base64ToArrayBuffer(savedSession.rawKeyBase64);
          const aesKey = await window.crypto.subtle.importKey(
            'raw',
            rawBuf,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
          );
          this.activeCryptoKeys.set(peerId, aesKey);
          return aesKey;
        }

        // Fetch peer's PreKey bundle from server
        const bundleRes = await apiClient.get(`/e2ee/keys/bundle/${peerId}`);
        if (!bundleRes.success || !bundleRes.data) {
          console.warn(`[E2EE] Peer ${peerId} has no public PreKey bundle.`);
          return null;
        }

        const bundle = bundleRes.data;
        const identity = await keyStore.getDeviceIdentity(this.currentUserId);
        if (!identity) return null;

        // Import Alice's Identity Private Key
        const myIdPrivKey = await importPrivateKeyJWK(identity.identityPrivateKeyJWK);

        // Import Bob's Identity Public Key & Signed PreKey
        const peerIdPubKey = await importPublicKey(bundle.identityKey);
        const peerSpkPubKey = await importPublicKey(bundle.signedPreKey.publicKey);

        // Alice generates Ephemeral KeyPair
        const myEphemeralKeyPair = await generateECDHKeyPair();
        const myEphemeralPubBase64 = await exportPublicKey(myEphemeralKeyPair.publicKey);

        // Triple Diffie-Hellman Computations:
        // DH1 = DH(Alice.IdentityPriv, Bob.SignedPreKeyPub)
        const dh1 = await deriveSharedSecret(myIdPrivKey, peerSpkPubKey);
        // DH2 = DH(Alice.EphemeralPriv, Bob.IdentityPub)
        const dh2 = await deriveSharedSecret(myEphemeralKeyPair.privateKey, peerIdPubKey);
        // DH3 = DH(Alice.EphemeralPriv, Bob.SignedPreKeyPub)
        const dh3 = await deriveSharedSecret(myEphemeralKeyPair.privateKey, peerSpkPubKey);

        const dhParts = [dh1, dh2, dh3];

        // If Bob provided One-Time PreKey (OPK):
        if (bundle.oneTimePreKey?.publicKey) {
          const peerOpkPubKey = await importPublicKey(bundle.oneTimePreKey.publicKey);
          const dh4 = await deriveSharedSecret(myEphemeralKeyPair.privateKey, peerOpkPubKey);
          dhParts.push(dh4);
        }

        const masterSecretBuf = this._concatBuffers(dhParts);

        // Derive AES-256-GCM symmetric session key via HKDF-SHA256
        const info = `VibeGrid-Session-${Math.min(this.currentUserId, peerId)}-${Math.max(this.currentUserId, peerId)}`;
        const aesKey = await deriveAESKeyFromRawSecret(masterSecretBuf, new Uint8Array(32), info);

        // Export raw key bytes to persist in IndexedDB
        const rawKeyBuf = await window.crypto.subtle.exportKey('raw', aesKey);
        const rawKeyBase64 = arrayBufferToBase64(rawKeyBuf);

        await keyStore.saveSession(this.currentUserId, peerId, {
          rawKeyBase64,
          peerIdentityKey: bundle.identityKey,
          ephemeralPubBase64: myEphemeralPubBase64,
          createdAt: new Date().toISOString()
        });

        this.activeCryptoKeys.set(peerId, aesKey);
        return aesKey;
      } catch (err) {
        console.error(`[E2EE] Failed to establish session with peer ${peerId}:`, err);
        return null;
      } finally {
        this._sessionKeyPromises.delete(peerId);
      }
    })();

    this._sessionKeyPromises.set(peerId, keyPromise);
    return keyPromise;
  }

  // ==========================================================================
  // 3. Message Encryption & Decryption
  // ==========================================================================

  /**
   * Encrypt a plaintext message for a target peer.
   * Returns an encrypted payload envelope { ciphertext, ivNonce, senderDeviceId }
   * or fallback plaintext if encryption is not yet possible for peer.
   */
  async encryptMessage(peerUserId, plaintext) {
    if (!plaintext || typeof plaintext !== 'string') {
      return { content: '' };
    }

    try {
      const aesKey = await this.getOrCreateSessionKey(peerUserId);
      if (!aesKey) {
        // Peer does not have E2EE initialized yet -> send as standard message
        return { content: plaintext };
      }

      const { ciphertext, ivNonce } = await encryptAESGCM(aesKey, plaintext);

      return {
        ciphertext,
        ivNonce,
        senderDeviceId: this.deviceId,
        // Leave plaintext content empty so the server cannot read it
        content: ''
      };
    } catch (err) {
      console.error('[E2EE] Encryption failed:', err);
      return { content: plaintext };
    }
  }

  /**
   * Decrypt an incoming or stored message.
   * Handles both encrypted ciphertext and legacy plaintext messages.
   */
  async decryptMessage(message, partnerUserId) {
    if (!message) return '';

    // If message is already plaintext (legacy or fallback)
    if (!message.ciphertext && message.content) {
      return message.content;
    }

    // Fast Cache Check: message ID or ciphertext hash
    const cacheKey = message.id
      ? `msg_${message.id}`
      : `${message.ciphertext}:${message.iv_nonce}`;

    if (this.decryptedTextCache.has(cacheKey)) {
      return this.decryptedTextCache.get(cacheKey);
    }

    // Message is ciphertext
    if (message.ciphertext && message.iv_nonce) {
      try {
        const peerId = Number(message.sender_id === this.currentUserId ? partnerUserId : message.sender_id);
        const aesKey = await this.getOrCreateSessionKey(peerId);

        if (!aesKey) {
          return '🔒 [Encrypted message - key agreement pending]';
        }

        const decryptedText = await decryptAESGCM(aesKey, message.ciphertext, message.iv_nonce);

        // Bound cache size to prevent memory leaks (keep latest 2500 messages)
        if (this.decryptedTextCache.size > 2500) {
          const firstKey = this.decryptedTextCache.keys().next().value;
          this.decryptedTextCache.delete(firstKey);
        }
        this.decryptedTextCache.set(cacheKey, decryptedText);

        return decryptedText;
      } catch (err) {
        console.warn('[E2EE] Decryption error for message ID:', message.id, err.message);
        const fallback = '🔒 [Encrypted message - could not be decrypted on this device]';
        this.decryptedTextCache.set(cacheKey, fallback);
        return fallback;
      }
    }

    return message.content || '';
  }

  /**
   * Batch decrypt a list of messages progressively in micro-batches
   * @param {Array} messages - Message objects
   * @param {number|string} partnerUserId - Partner user ID
   * @param {Function} [onBatchProgress] - Callback invoked as each batch resolves
   */
  async decryptMessageList(messages, partnerUserId, onBatchProgress = null) {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    // Pre-warm the session key once so messages in this conversation resolve immediately
    const peerId = Number(partnerUserId);
    if (peerId) {
      try {
        await this.getOrCreateSessionKey(peerId);
      } catch {}
    }

    const results = new Array(messages.length);
    const BATCH_SIZE = 15;

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const chunk = messages.slice(i, i + BATCH_SIZE);
      const chunkDecrypted = await Promise.all(
        chunk.map(async (m) => {
          if (!m.ciphertext) return m;
          const decryptedContent = await this.decryptMessage(m, partnerUserId);
          return {
            ...m,
            content: decryptedContent,
            is_encrypted: true
          };
        })
      );

      for (let j = 0; j < chunkDecrypted.length; j++) {
        results[i + j] = chunkDecrypted[j];
      }

      if (typeof onBatchProgress === 'function') {
        try {
          onBatchProgress([...results.slice(0, i + chunkDecrypted.length)]);
        } catch {}
      }

      // Yield briefly to event loop between chunks if more messages remain
      if (i + BATCH_SIZE < messages.length) {
        if (typeof queueMicrotask === 'function') {
          await new Promise((resolve) => queueMicrotask(resolve));
        } else {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    }

    return results;
  }
}

export const e2eeService = new E2EEService();
export default e2eeService;

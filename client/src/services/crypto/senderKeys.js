/**
 * client/src/services/crypto/senderKeys.js
 * ========================================
 * Multi-Party Group E2EE via Signal Sender Keys Protocol
 * 
 * Standards:
 * - Encryption: AES-256-GCM
 * - Key Derivation: HKDF-SHA256 / HMAC-SHA256 ratchet advancement
 * - Distribution: Pairwise 1-to-1 E2EE distribution envelopes
 * 
 * In a group of N members:
 * - Pairwise encryption requires O(N) encryption operations per message.
 * - Sender Keys Protocol encrypts O(1) times per message regardless of group size,
 *   achieving high scalability while preserving end-to-end encryption.
 */

import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  stringToUint8Array,
  uint8ArrayToString
} from './cryptoUtils';
import keyStore from './keyStore';
import e2eeService from './e2eeService';
import { get, set } from 'idb-keyval';

const subtle = window.crypto?.subtle;

class SenderKeysService {
  constructor() {
    this.memoryKeys = new Map(); // `group:${groupId}:${userId}` -> CryptoKey
  }

  // ==========================================================================
  // 1. Sender Key Generation & Chain Management
  // ==========================================================================

  /**
   * Generates a fresh 256-bit symmetric Sender Key for this user in a group.
   * @param {string|number} groupId 
   * @param {number} myUserId 
   * @returns {Promise<{ keyBase64: string, iteration: number }>}
   */
  async generateSenderKey(groupId, myUserId) {
    const rawBytes = window.crypto.getRandomValues(new Uint8Array(32));
    const keyBase64 = arrayBufferToBase64(rawBytes.buffer);

    const record = {
      groupId,
      userId: myUserId,
      keyBase64,
      iteration: 0,
      createdAt: new Date().toISOString()
    };

    await set(`group_sender_key:${groupId}:${myUserId}`, record);
    return record;
  }

  /**
   * Advances a chain key using HMAC-SHA256 ratchet (Derives message key and next chain key)
   */
  async _advanceChain(rawKeyBuffer) {
    const hmacKey = await subtle.importKey(
      'raw',
      rawKeyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Message key derivation constant (0x01)
    const msgKeyBytes = await subtle.sign('HMAC', hmacKey, new Uint8Array([0x01]));

    // Next chain key derivation constant (0x02)
    const nextChainBytes = await subtle.sign('HMAC', hmacKey, new Uint8Array([0x02]));

    const messageAesKey = await subtle.importKey(
      'raw',
      msgKeyBytes.slice(0, 32),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return {
      messageAesKey,
      nextChainBuffer: nextChainBytes.slice(0, 32)
    };
  }

  // ==========================================================================
  // 2. Sender Key Distribution (Pairwise via 1-to-1 E2EE)
  // ==========================================================================

  /**
   * Bundles the sender key into 1-to-1 E2EE encrypted envelopes for each member.
   * @param {string|number} groupId 
   * @param {number} myUserId 
   * @param {number[]} memberIds - Array of other group participant user IDs
   * @returns {Promise<Array<{ recipientId: number, envelope: object }>>}
   */
  async createDistributionEnvelopes(groupId, myUserId, memberIds) {
    let myRecord = await get(`group_sender_key:${groupId}:${myUserId}`);
    if (!myRecord) {
      myRecord = await this.generateSenderKey(groupId, myUserId);
    }

    const payload = JSON.stringify({
      type: 'sender_key_distribution',
      groupId,
      senderUserId: myUserId,
      keyBase64: myRecord.keyBase64,
      iteration: myRecord.iteration
    });

    const envelopes = [];
    for (const memberId of memberIds) {
      if (Number(memberId) === Number(myUserId)) continue;
      const encEnvelope = await e2eeService.encryptMessage(memberId, payload);
      envelopes.push({
        recipientId: memberId,
        envelope: encEnvelope
      });
    }

    return envelopes;
  }

  /**
   * Ingest an incoming Sender Key distributed from another group member.
   */
  async processIncomingSenderKey(payload) {
    if (!payload || payload.type !== 'sender_key_distribution') return;

    const { groupId, senderUserId, keyBase64, iteration } = payload;
    const record = {
      groupId,
      userId: senderUserId,
      keyBase64,
      iteration: iteration || 0,
      updatedAt: new Date().toISOString()
    };

    await set(`group_received_key:${groupId}:${senderUserId}`, record);
    console.log(`🔑 [SenderKeys] Ingested Sender Key for group ${groupId} from user ${senderUserId}`);
  }

  // ==========================================================================
  // 3. Group Message Encryption & Decryption
  // ==========================================================================

  /**
   * Encrypt a message to the group (O(1) operation using our current Sender Key).
   * @param {string|number} groupId 
   * @param {number} myUserId 
   * @param {string} plaintext 
   * @returns {Promise<{ ciphertext: string, ivNonce: string, iteration: number }>}
   */
  async encryptGroupMessage(groupId, myUserId, plaintext) {
    let record = await get(`group_sender_key:${groupId}:${myUserId}`);
    if (!record) {
      record = await this.generateSenderKey(groupId, myUserId);
    }

    const rawKeyBuf = base64ToArrayBuffer(record.keyBase64);
    const { messageAesKey, nextChainBuffer } = await this._advanceChain(rawKeyBuf);

    // Encrypt message with AES-256-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = stringToUint8Array(plaintext);

    const ciphertextBuffer = await subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      messageAesKey,
      encoded
    );

    // Save ratcheted next chain key
    record.keyBase64 = arrayBufferToBase64(nextChainBuffer);
    record.iteration += 1;
    await set(`group_sender_key:${groupId}:${myUserId}`, record);

    return {
      ciphertext: arrayBufferToBase64(ciphertextBuffer),
      ivNonce: arrayBufferToBase64(iv),
      iteration: record.iteration
    };
  }

  /**
   * Decrypt a group message from a specific sender.
   * @param {string|number} groupId 
   * @param {number} senderUserId 
   * @param {string} ciphertextBase64 
   * @param {string} ivNonceBase64 
   * @returns {Promise<string>}
   */
  async decryptGroupMessage(groupId, senderUserId, ciphertextBase64, ivNonceBase64) {
    const record = await get(`group_received_key:${groupId}:${senderUserId}`);
    if (!record) {
      return '🔒 [Encrypted group message - sender key pending]';
    }

    try {
      const rawKeyBuf = base64ToArrayBuffer(record.keyBase64);
      const { messageAesKey, nextChainBuffer } = await this._advanceChain(rawKeyBuf);

      const ciphertext = base64ToArrayBuffer(ciphertextBase64);
      const iv = new Uint8Array(base64ToArrayBuffer(ivNonceBase64));

      const decryptedBuffer = await subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128
        },
        messageAesKey,
        ciphertext
      );

      // Advance sender's ratchet
      record.keyBase64 = arrayBufferToBase64(nextChainBuffer);
      record.iteration += 1;
      await set(`group_received_key:${groupId}:${senderUserId}`, record);

      return uint8ArrayToString(new Uint8Array(decryptedBuffer));
    } catch (err) {
      console.warn('[SenderKeys] Decryption error:', err.message);
      return '🔒 [Encrypted group message - could not decrypt]';
    }
  }
}

export const senderKeysService = new SenderKeysService();
export default senderKeysService;

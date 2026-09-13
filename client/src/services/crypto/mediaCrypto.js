/**
 * client/src/services/crypto/mediaCrypto.js
 * =========================================
 * Client-Side Media Encryption & Cryptographic Safety Numbers
 * 
 * Standards:
 * - Media Encryption: AES-256-GCM with single-use media keys and random 12-byte IVs.
 * - Zero-Knowledge Storage: Only random ciphertext is sent to server/storage.
 * - Safety Numbers: SHA-512 cryptographic fingerprint derived from sorted Identity Public Keys.
 */

import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  stringToUint8Array
} from './cryptoUtils';

const subtle = window.crypto?.subtle;

// ============================================================================
// 1. Client-Side Media Encryption (Zero-Knowledge Attachments)
// ============================================================================

/**
 * Encrypt a media File or Blob client-side using AES-256-GCM before uploading.
 * @param {File|Blob} fileOrBlob 
 * @returns {Promise<{ encryptedBlob: Blob, mediaKeyBase64: string, ivNonce: string, mimeType: string, originalSize: number }>}
 */
export async function encryptMedia(fileOrBlob) {
  // 1. Generate a single-use 256-bit AES-GCM symmetric key
  const mediaKey = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  // 2. Generate unique 12-byte IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 3. Read raw file bytes
  const arrayBuffer = await fileOrBlob.arrayBuffer();

  // 4. Encrypt raw bytes
  const ciphertextBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128
    },
    mediaKey,
    arrayBuffer
  );

  // 5. Export media key to Base64
  const rawKeyBuf = await subtle.exportKey('raw', mediaKey);
  const mediaKeyBase64 = arrayBufferToBase64(rawKeyBuf);
  const ivNonce = arrayBufferToBase64(iv);

  const encryptedBlob = new Blob([ciphertextBuffer], { type: 'application/octet-stream' });

  return {
    encryptedBlob,
    mediaKeyBase64,
    ivNonce,
    mimeType: fileOrBlob.type || 'application/octet-stream',
    originalSize: fileOrBlob.size
  };
}

/**
 * Decrypt an encrypted media ArrayBuffer and return a secure Object URL for rendering.
 * @param {ArrayBuffer} encryptedBuffer 
 * @param {string} mediaKeyBase64 
 * @param {string} ivNonceBase64 
 * @param {string} mimeType 
 * @returns {Promise<string>} Object URL for <img>, <video>, or <audio> tags
 */
export async function decryptMediaToObjectUrl(encryptedBuffer, mediaKeyBase64, ivNonceBase64, mimeType = 'image/jpeg') {
  try {
    const rawKeyBuf = base64ToArrayBuffer(mediaKeyBase64);
    const iv = new Uint8Array(base64ToArrayBuffer(ivNonceBase64));

    const mediaKey = await subtle.importKey(
      'raw',
      rawKeyBuf,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      mediaKey,
      encryptedBuffer
    );

    const decryptedBlob = new Blob([decryptedBuffer], { type: mimeType });
    return URL.createObjectURL(decryptedBlob);
  } catch (err) {
    console.error('[MediaCrypto] Failed to decrypt media:', err);
    throw err;
  }
}

// ============================================================================
// 2. Cryptographic Safety Numbers (Signal-Style MITM Protection)
// ============================================================================

/**
 * Generates a deterministic 60-digit safety number fingerprint
 * by hashing the lexicographically sorted Identity Public Keys of both parties.
 * 
 * @param {string} myIdentityKeyBase64 
 * @param {string} peerIdentityKeyBase64 
 * @returns {Promise<{ rawDigits: string, formatted: string }>}
 */
export async function computeSafetyNumber(myIdentityKeyBase64, peerIdentityKeyBase64) {
  if (!myIdentityKeyBase64 || !peerIdentityKeyBase64) {
    return { rawDigits: '', formatted: '' };
  }

  // Lexicographical sort ensures both Alice and Bob generate the exact same fingerprint
  const sortedKeys = [myIdentityKeyBase64, peerIdentityKeyBase64].sort();
  const combinedStr = `VibeGrid-SafetyNumber-v1:${sortedKeys[0]}:${sortedKeys[1]}`;
  const data = stringToUint8Array(combinedStr);

  // Compute SHA-512 digest (64 bytes = 512 bits)
  const hashBuffer = await subtle.digest('SHA-512', data);
  const hashBytes = new Uint8Array(hashBuffer);

  // Convert bytes into a 60-digit decimal string
  let digits = '';
  for (let i = 0; i < 30; i++) {
    // Combine two bytes into an unsigned 16-bit integer (0..65535)
    const val = (hashBytes[i * 2] << 8) | hashBytes[i * 2 + 1];
    // Map to 2 decimal digits per word
    const digitPair = (val % 100).toString().padStart(2, '0');
    digits += digitPair;
  }

  // Format into 12 blocks of 5 digits (Signal Standard)
  const blocks = [];
  for (let i = 0; i < 60; i += 5) {
    blocks.push(digits.slice(i, i + 5));
  }

  return {
    rawDigits: digits,
    formatted: blocks.join(' ')
  };
}

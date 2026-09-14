/**
 * client/src/services/crypto/cryptoUtils.js
 * =========================================
 * Standard Web Crypto API Cryptographic Primitives
 * 
 * Standards:
 * - Key Agreement: ECDH (NIST P-256 / secp256r1)
 * - Signatures: ECDSA (P-256 with SHA-256)
 * - Key Derivation: HKDF (RFC 5869 with HMAC-SHA-256)
 * - Symmetric Encryption: AES-256-GCM (NIST SP 800-38D, 12-byte IV, 128-bit authentication tag)
 * 
 * SECURITY MANDATE:
 * Uses exclusively standard W3C Web Cryptography API (window.crypto.subtle).
 * No custom or unvetted cryptographic algorithms.
 */

const subtle = window.crypto?.subtle;

// ============================================================================
// Encoding & Binary Utility Helpers
// ============================================================================

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function stringToUint8Array(str) {
  return new TextEncoder().encode(str);
}

export function uint8ArrayToString(bytes) {
  return new TextDecoder().decode(bytes);
}

// ============================================================================
// Key Pair Generation
// ============================================================================

/**
 * Generate ECDH key pair for key agreement (Identity Key, Signed PreKey, One-Time PreKey)
 */
export async function generateECDHKeyPair() {
  return await subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Generate ECDSA key pair for identity verification and prekey signing
 */
export async function generateSigningKeyPair() {
  return await subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    true,
    ['sign', 'verify']
  );
}

// ============================================================================
// Key Serialization / Export / Import
// ============================================================================

/**
 * Export public key to SPKI Base64 format
 */
export async function exportPublicKey(key) {
  const spki = await subtle.exportKey('spki', key);
  return arrayBufferToBase64(spki);
}

/**
 * Import public key from SPKI Base64 format
 */
export async function importPublicKey(spkiBase64, algorithm = { name: 'ECDH', namedCurve: 'P-256' }, usages = []) {
  const buffer = base64ToArrayBuffer(spkiBase64);
  return await subtle.importKey(
    'spki',
    buffer,
    algorithm,
    true,
    usages
  );
}

/**
 * Export private key to JWK format for secure client-side IndexedDB persistence
 */
export async function exportPrivateKeyJWK(key) {
  return await subtle.exportKey('jwk', key);
}

/**
 * Import private key from stored JWK format
 */
export async function importPrivateKeyJWK(jwk, algorithm = { name: 'ECDH', namedCurve: 'P-256' }, usages = ['deriveKey', 'deriveBits']) {
  return await subtle.importKey(
    'jwk',
    jwk,
    algorithm,
    true,
    usages
  );
}

// ============================================================================
// Digital Signatures (ECDSA P-256 + SHA-256)
// ============================================================================

export async function signData(signingPrivateKey, dataBufferOrString) {
  const data = typeof dataBufferOrString === 'string'
    ? stringToUint8Array(dataBufferOrString)
    : dataBufferOrString;

  const signature = await subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' }
    },
    signingPrivateKey,
    data
  );

  return arrayBufferToBase64(signature);
}

export async function verifySignature(signingPublicKey, signatureBase64, dataBufferOrString) {
  const signature = base64ToArrayBuffer(signatureBase64);
  const data = typeof dataBufferOrString === 'string'
    ? stringToUint8Array(dataBufferOrString)
    : dataBufferOrString;

  return await subtle.verify(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' }
    },
    signingPublicKey,
    signature,
    data
  );
}

// ============================================================================
// Diffie-Hellman Key Agreement & HKDF Key Derivation
// ============================================================================

/**
 * Derives 256 raw shared bits from our private key and peer's public key
 */
export async function deriveSharedSecret(privateKey, peerPublicKey) {
  return await subtle.deriveBits(
    {
      name: 'ECDH',
      public: peerPublicKey
    },
    privateKey,
    256 // 256 bits
  );
}

/**
 * Derives an AES-256-GCM symmetric key using HKDF-SHA-256
 */
export async function deriveAESKeyFromRawSecret(rawSecretBits, salt = new Uint8Array(32), info = 'VibeGrid-E2EE-v1') {
  // Import raw secret bits as HKDF key
  const hkdfKey = await subtle.importKey(
    'raw',
    rawSecretBits,
    { name: 'HKDF' },
    false,
    ['deriveKey', 'deriveBits']
  );

  const infoBytes = typeof info === 'string' ? stringToUint8Array(info) : info;
  const saltBytes = typeof salt === 'string' ? stringToUint8Array(salt) : salt;

  return await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: saltBytes,
      info: infoBytes
    },
    hkdfKey,
    {
      name: 'AES-256-GCM',
      length: 256
    },
    true, // extractable for ratchet serialization
    ['encrypt', 'decrypt']
  );
}

// ============================================================================
// Authenticated Encryption & Decryption (AES-256-GCM)
// ============================================================================

/**
 * Encrypt plaintext using AES-256-GCM with a fresh 12-byte IV
 * @param {CryptoKey} key - AES-GCM CryptoKey
 * @param {string} plaintext - Plaintext UTF-8 string
 * @returns {Promise<{ ciphertext: string, ivNonce: string }>}
 */
export async function encryptAESGCM(key, plaintext) {
  // 12-byte (96-bit) IV as recommended by NIST SP 800-38D for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = stringToUint8Array(plaintext);

  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128
    },
    key,
    encoded
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    ivNonce: arrayBufferToBase64(iv)
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param {CryptoKey} key - AES-GCM CryptoKey
 * @param {string} ciphertextBase64 - Base64 ciphertext with tag
 * @param {string} ivNonceBase64 - Base64 12-byte IV
 * @returns {Promise<string>} - Decrypted UTF-8 string
 */
export async function decryptAESGCM(key, ciphertextBase64, ivNonceBase64) {
  const ciphertext = base64ToArrayBuffer(ciphertextBase64);
  const iv = base64ToArrayBuffer(ivNonceBase64);

  const decryptedBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv),
      tagLength: 128
    },
    key,
    ciphertext
  );

  return uint8ArrayToString(new Uint8Array(decryptedBuffer));
}

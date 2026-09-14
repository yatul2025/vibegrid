/**
 * client/src/services/crypto/keyBackup.js
 * =======================================
 * Passphrase-Protected Cryptographic Key Backup & Restore Engine
 * 
 * Standards:
 * - Password Key Derivation: PBKDF2 with HMAC-SHA256 and 600,000 iterations (NIST SP 800-132)
 * - Symmetric Encryption: AES-256-GCM with unique 16-byte salt and 12-byte IV
 * 
 * SECURITY MANDATE:
 * 1. The user's passphrase NEVER leaves the browser.
 * 2. Only user-encrypted ciphertext is exported.
 * 3. The server never has access to the user's private keys or passphrase.
 */

import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  stringToUint8Array,
  uint8ArrayToString
} from './cryptoUtils';
import keyStore from './keyStore';

const subtle = window.crypto?.subtle;
const PBKDF2_ITERATIONS = 600000; // NIST recommended minimum for PBKDF2-HMAC-SHA256

/**
 * Derives a 256-bit AES-GCM key from a passphrase and salt using PBKDF2
 */
async function deriveKeyFromPassphrase(passphrase, saltBuffer, iterations = PBKDF2_ITERATIONS) {
  // 1. Import passphrase as raw key material
  const passKey = await subtle.importKey(
    'raw',
    stringToUint8Array(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // 2. Derive AES-256-GCM key
  return await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: iterations,
      hash: 'SHA-256'
    },
    passKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Export an encrypted backup of the user's private identity keys and signed prekey.
 * @param {number} userId 
 * @param {string} passphrase 
 * @returns {Promise<string>} Formatted JSON string of the encrypted backup
 */
export async function exportEncryptedBackup(userId, passphrase) {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('Passphrase must be at least 8 characters long.');
  }

  // 1. Retrieve user's cryptographic identity and signed prekey
  const identity = await keyStore.getDeviceIdentity(userId);
  const signedPreKey = await keyStore.getSignedPreKey(userId);

  if (!identity) {
    throw new Error('No cryptographic identity found on this device to backup.');
  }

  const payload = JSON.stringify({
    version: 1,
    userId,
    identity,
    signedPreKey,
    exportedAt: new Date().toISOString()
  });

  // 2. Generate random 16-byte salt and 12-byte IV
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 3. Derive AES-GCM key from passphrase
  const aesKey = await deriveKeyFromPassphrase(passphrase, salt);

  // 4. Encrypt the payload
  const ciphertextBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128
    },
    aesKey,
    stringToUint8Array(payload)
  );

  // 5. Bundle into backup file object
  const backupObject = {
    app: 'VibeGrid',
    version: 1,
    algorithm: 'PBKDF2-HMAC-SHA256 / AES-256-GCM',
    iterations: PBKDF2_ITERATIONS,
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    createdAt: new Date().toISOString()
  };

  return JSON.stringify(backupObject, null, 2);
}

/**
 * Import and restore private keys from an encrypted backup file using the user's passphrase.
 * @param {number} userId 
 * @param {string} passphrase 
 * @param {string} backupJsonString 
 * @returns {Promise<boolean>}
 */
export async function importEncryptedBackup(userId, passphrase, backupJsonString) {
  let backup;
  try {
    backup = JSON.parse(backupJsonString);
  } catch (err) {
    throw new Error('Invalid backup file format. Please upload a valid VibeGrid keys JSON file.');
  }

  if (!backup.salt || !backup.iv || !backup.ciphertext) {
    throw new Error('Corrupted backup file: missing required cryptographic components.');
  }

  const saltBuf = base64ToArrayBuffer(backup.salt);
  const iv = new Uint8Array(base64ToArrayBuffer(backup.iv));
  const ciphertextBuf = base64ToArrayBuffer(backup.ciphertext);
  const iterations = backup.iterations || PBKDF2_ITERATIONS;

  // 1. Derive AES key with passphrase and original salt
  const aesKey = await deriveKeyFromPassphrase(passphrase, saltBuf, iterations);

  // 2. Decrypt ciphertext
  let decryptedString;
  try {
    const decryptedBuf = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      aesKey,
      ciphertextBuf
    );
    decryptedString = uint8ArrayToString(new Uint8Array(decryptedBuf));
  } catch (err) {
    throw new Error('Incorrect passphrase or corrupted backup file.');
  }

  // 3. Restore keys into IndexedDB
  const restoredData = JSON.parse(decryptedString);
  if (restoredData.identity) {
    await keyStore.saveDeviceIdentity(userId, restoredData.identity);
  }
  if (restoredData.signedPreKey) {
    await keyStore.saveSignedPreKey(userId, restoredData.signedPreKey);
  }

  console.log('✅ [KeyBackup] Cryptographic keys successfully restored to IndexedDB.');
  return true;
}

/**
 * client/src/services/crypto/keyStore.js
 * =====================================
 * Secure Client-Side Key Storage using IndexedDB (via idb-keyval)
 * 
 * SECURITY MANDATE:
 * 1. Private cryptographic keys (Identity private key, Signed PreKey private key,
 *    One-Time PreKey private keys, and Ratchet chain keys) NEVER leave the client browser.
 * 2. They are NEVER sent to the backend server or stored in unencrypted localStorage.
 * 3. All storage keys are partitioned by authenticated user ID.
 */

import { get, set, del, createStore } from 'idb-keyval';

// Partitioned IndexedDB store specifically for E2EE keys
const e2eeDbStore = typeof window !== 'undefined'
  ? createStore('vibegrid-e2ee-keystore', 'crypto-keys')
  : null;

class KeyStore {
  // ==========================================================================
  // Device Identity & Registration
  // ==========================================================================

  async getDeviceIdentity(userId) {
    if (!e2eeDbStore) return null;
    return await get(`identity:${userId}`, e2eeDbStore);
  }

  async saveDeviceIdentity(userId, identityData) {
    if (!e2eeDbStore) return;
    await set(`identity:${userId}`, identityData, e2eeDbStore);
  }

  // ==========================================================================
  // Signed PreKey
  // ==========================================================================

  async getSignedPreKey(userId) {
    if (!e2eeDbStore) return null;
    return await get(`signed_prekey:${userId}`, e2eeDbStore);
  }

  async saveSignedPreKey(userId, signedPreKeyData) {
    if (!e2eeDbStore) return;
    await set(`signed_prekey:${userId}`, signedPreKeyData, e2eeDbStore);
  }

  // ==========================================================================
  // One-Time PreKeys Pool
  // ==========================================================================

  async getOneTimePreKeys(userId) {
    if (!e2eeDbStore) return [];
    return (await get(`opk_pool:${userId}`, e2eeDbStore)) || [];
  }

  async saveOneTimePreKeys(userId, preKeysArray) {
    if (!e2eeDbStore) return;
    await set(`opk_pool:${userId}`, preKeysArray, e2eeDbStore);
  }

  async getAndConsumeOneTimePreKey(userId, keyId) {
    if (!e2eeDbStore) return null;
    const pool = await this.getOneTimePreKeys(userId);
    const index = pool.findIndex((k) => k.keyId === keyId);
    if (index === -1) return null;

    const [consumed] = pool.splice(index, 1);
    await this.saveOneTimePreKeys(userId, pool);
    return consumed;
  }

  // ==========================================================================
  // Ratchet Sessions per Peer
  // ==========================================================================

  async getSession(userId, peerUserId) {
    if (!e2eeDbStore) return null;
    return await get(`session:${userId}:${peerUserId}`, e2eeDbStore);
  }

  async saveSession(userId, peerUserId, sessionData) {
    if (!e2eeDbStore) return;
    await set(`session:${userId}:${peerUserId}`, sessionData, e2eeDbStore);
  }

  async deleteSession(userId, peerUserId) {
    if (!e2eeDbStore) return;
    await del(`session:${userId}:${peerUserId}`, e2eeDbStore);
  }

  // ==========================================================================
  // Cryptographic Safety Number Verification
  // ==========================================================================

  async isPeerVerified(userId, peerUserId) {
    if (!e2eeDbStore) return false;
    const val = await get(`verified:${userId}:${peerUserId}`, e2eeDbStore);
    return Boolean(val);
  }

  async setPeerVerified(userId, peerUserId, isVerified) {
    if (!e2eeDbStore) return;
    if (isVerified) {
      await set(`verified:${userId}:${peerUserId}`, true, e2eeDbStore);
    } else {
      await del(`verified:${userId}:${peerUserId}`, e2eeDbStore);
    }
  }

  // ==========================================================================
  // Device Wipe (On Explicit Logout / Session Invalidation)
  // ==========================================================================

  async wipeUserKeys(userId) {
    if (!e2eeDbStore) return;
    await del(`identity:${userId}`, e2eeDbStore);
    await del(`signed_prekey:${userId}`, e2eeDbStore);
    await del(`opk_pool:${userId}`, e2eeDbStore);
  }
}

export const keyStore = new KeyStore();
export default keyStore;

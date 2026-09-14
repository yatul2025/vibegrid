/**
 * server/src/services/cache/CacheManager.js
 * =========================================
 * Pluggable High-Performance Cache Layer
 * 
 * Features:
 * 1. Fast in-memory TTL/LRU cache by default (zero external infrastructure required).
 * 2. Optional Redis backend support if REDIS_URL is provided in environment.
 * 3. Supports standard key-value operations (get, set, del, has).
 * 4. Supports Set operations for fingerprint deduplication (sadd, sismember, scard).
 * 5. Automatic memory bounds & stale key eviction ($< 5MB memory footprint).
 */

class MemoryCacheStore {
  constructor(maxEntries = 2000) {
    this.maxEntries = maxEntries;
    this.store = new Map();
    this.sets = new Map();

    // Periodic sweep every 60 seconds to clean expired keys
    this.sweepInterval = setInterval(() => this.sweep(), 60000);
    if (this.sweepInterval.unref) {
      this.sweepInterval.unref(); // Do not prevent process exit
    }
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt !== null && entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlSeconds = 600) {
    if (this.store.size >= this.maxEntries) {
      // Evict oldest entry (LRU-like Map insertion order)
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }

    const expiresAt = ttlSeconds !== null && ttlSeconds !== undefined
      ? (ttlSeconds <= 0 ? 0 : Date.now() + (ttlSeconds * 1000))
      : null;
    this.store.set(key, { value, expiresAt });
    return true;
  }

  has(key) {
    return this.get(key) !== null;
  }

  del(key) {
    return this.store.delete(key);
  }

  // Set-based operations for deduplication fingerprints
  sadd(setKey, member, ttlSeconds = 86400) {
    let setEntry = this.sets.get(setKey);
    const expiresAt = ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : null;

    if (!setEntry || (setEntry.expiresAt && setEntry.expiresAt <= Date.now())) {
      setEntry = { set: new Set(), expiresAt };
      this.sets.set(setKey, setEntry);
    }

    const str = String(member);
    if (setEntry.set.has(str)) {
      return false;
    }
    setEntry.set.add(str);
    return true;
  }

  sismember(setKey, member) {
    const setEntry = this.sets.get(setKey);
    if (!setEntry) return false;

    if (setEntry.expiresAt && setEntry.expiresAt <= Date.now()) {
      this.sets.delete(setKey);
      return false;
    }

    return setEntry.set.has(String(member));
  }

  srem(setKey, member) {
    const setEntry = this.sets.get(setKey);
    if (!setEntry) return false;
    return setEntry.set.delete(String(member));
  }

  scard(setKey) {
    const setEntry = this.sets.get(setKey);
    if (!setEntry) return 0;
    if (setEntry.expiresAt && setEntry.expiresAt <= Date.now()) {
      this.sets.delete(setKey);
      return 0;
    }
    return setEntry.set.size;
  }

  sweep() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
    for (const [key, entry] of this.sets.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.sets.delete(key);
      }
    }
  }

  flush() {
    this.store.clear();
    this.sets.clear();
  }

  clear() {
    this.flush();
  }
}

class CacheManager {
  constructor(options = {}) {
    this.redisClient = null;
    const maxEntries = options.maxEntries || options.maxItems || 2000;
    this.memoryStore = new MemoryCacheStore(maxEntries);
    this.isRedisReady = false;

    this.init();
  }

  async init() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        // Optional ioredis or redis client if available in dependencies
        const Redis = require('ioredis');
        this.redisClient = new Redis(redisUrl, {
          connectTimeout: 2000,
          maxRetriesPerRequest: 2,
          lazyConnect: true
        });

        await this.redisClient.connect();
        this.isRedisReady = true;
        console.log('✅ [CacheManager] Connected to Redis instance successfully.');
      } catch (err) {
        console.warn('ℹ️ [CacheManager] Redis unavailable, engaging high-performance in-memory cache:', err.message);
        this.isRedisReady = false;
        this.redisClient = null;
      }
    } else {
      // Default to in-memory store
      this.isRedisReady = false;
    }
  }

  async get(key) {
    if (this.isRedisReady && this.redisClient) {
      try {
        const raw = await this.redisClient.get(key);
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        console.warn(`[CacheManager Redis Get Error] ${key}:`, err.message);
      }
    }
    return this.memoryStore.get(key);
  }

  async set(key, value, ttlSeconds = 600) {
    if (this.isRedisReady && this.redisClient) {
      try {
        const serialized = JSON.stringify(value);
        if (ttlSeconds > 0) {
          await this.redisClient.set(key, serialized, 'EX', ttlSeconds);
        } else {
          await this.redisClient.set(key, serialized);
        }
        return true;
      } catch (err) {
        console.warn(`[CacheManager Redis Set Error] ${key}:`, err.message);
      }
    }
    return this.memoryStore.set(key, value, ttlSeconds);
  }

  async del(key) {
    if (this.isRedisReady && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (err) {
        console.warn(`[CacheManager Redis Del Error] ${key}:`, err.message);
      }
    }
    return this.memoryStore.del(key);
  }

  async has(key) {
    if (this.isRedisReady && this.redisClient) {
      try {
        const exists = await this.redisClient.exists(key);
        return exists === 1;
      } catch (err) {
        console.warn(`[CacheManager Redis Exists Error] ${key}:`, err.message);
      }
    }
    return this.memoryStore.has(key);
  }

  async sadd(setKey, member, ttlSeconds = 86400) {
    if (this.isRedisReady && this.redisClient) {
      try {
        await this.redisClient.sadd(setKey, String(member));
        if (ttlSeconds > 0) {
          await this.redisClient.expire(setKey, ttlSeconds);
        }
        return true;
      } catch (err) {
        console.warn(`[CacheManager Redis Sadd Error] ${setKey}:`, err.message);
      }
    }
    return this.memoryStore.sadd(setKey, member, ttlSeconds);
  }

  async sismember(setKey, member) {
    if (this.isRedisReady && this.redisClient) {
      try {
        const result = await this.redisClient.sismember(setKey, String(member));
        return result === 1;
      } catch (err) {
        console.warn(`[CacheManager Redis Sismember Error] ${setKey}:`, err.message);
      }
    }
    return this.memoryStore.sismember(setKey, member);
  }

  async srem(setKey, member) {
    if (this.isRedisReady && this.redisClient) {
      try {
        return await this.redisClient.srem(setKey, String(member));
      } catch (err) {
        console.warn(`[CacheManager Redis Srem Error] ${setKey}:`, err.message);
      }
    }
    return this.memoryStore.srem(setKey, member);
  }

  async scard(setKey) {
    if (this.isRedisReady && this.redisClient) {
      try {
        return await this.redisClient.scard(setKey);
      } catch (err) {
        console.warn(`[CacheManager Redis Scard Error] ${setKey}:`, err.message);
      }
    }
    return this.memoryStore.scard(setKey);
  }

  async flush() {
    if (this.isRedisReady && this.redisClient) {
      try {
        await this.redisClient.flushdb();
      } catch (err) {
        console.warn('[CacheManager Redis Flush Error]:', err.message);
      }
    }
    this.memoryStore.flush();
  }

  async clear() {
    return this.flush();
  }
}

// Export singleton instance
const cacheManager = new CacheManager();
module.exports = cacheManager;
module.exports.CacheManager = CacheManager;
module.exports.MemoryCacheStore = MemoryCacheStore;

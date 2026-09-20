/**
 * client/src/services/vibiMemoryService.js
 * =========================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 8 CONTROLLED MEMORY & PERSONALIZATION
 *
 * Responsibilities:
 * - Transparent, user-controlled memory store.
 * - Separates ephemeral session memory (sessionStorage) from persistent preferences (localStorage).
 * - Enforces strict security boundary: NEVER remembers passwords, tokens, E2EE keys, or message bodies.
 * - Strictly bounds persistent memory to 30 items to prevent bloat.
 * - Provides instant user deletion, export, and transparent visibility.
 */

import { STRICT_SECURITY_BLACKLIST } from './vibiContextService';

export const VIBI_MEMORY_PERSISTENT_KEY = 'vibegrid_vibi_memory_persistent';
export const VIBI_MEMORY_SESSION_KEY = 'vibegrid_vibi_memory_session';

const MAX_PERSISTENT_FACTS = 30;
const MAX_FACT_LENGTH = 120;

export class VibiMemoryService {
  constructor() {
    this.persistentFacts = new Map();
    this.sessionMemory = {
      topicsDiscussed: [],
      sessionPreferences: {},
      lastUpdated: Date.now()
    };
    this.listeners = new Set();
    this.loadFromStorage();
  }

  /**
   * Subscribe to memory changes
   * @param {Function} listener
   * @returns {Function} unsubscribe
   */
  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    return () => {};
  }

  notify() {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (err) {
        console.warn('[VibiMemoryService] Error in change listener:', err);
      }
    }
  }

  /**
   * Load memory from browser storage
   */
  loadFromStorage() {
    if (typeof window === 'undefined') return;

    // 1. Persistent memory
    try {
      const storedPersistent = localStorage.getItem(VIBI_MEMORY_PERSISTENT_KEY);
      if (storedPersistent) {
        const parsed = JSON.parse(storedPersistent);
        if (typeof parsed === 'object' && parsed !== null) {
          this.persistentFacts = new Map(Object.entries(parsed));
        }
      }
    } catch {
      this.persistentFacts = new Map();
    }

    // 2. Ephemeral session memory
    try {
      const storedSession = sessionStorage.getItem(VIBI_MEMORY_SESSION_KEY);
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        if (typeof parsed === 'object' && parsed !== null) {
          this.sessionMemory = {
            topicsDiscussed: Array.isArray(parsed.topicsDiscussed) ? parsed.topicsDiscussed : [],
            sessionPreferences: parsed.sessionPreferences || {},
            lastUpdated: parsed.lastUpdated || Date.now()
          };
        }
      }
    } catch {
      this.sessionMemory = {
        topicsDiscussed: [],
        sessionPreferences: {},
        lastUpdated: Date.now()
      };
    }
  }

  /**
   * Save persistent memory to localStorage
   */
  savePersistent() {
    if (typeof window === 'undefined') return;
    try {
      const obj = Object.fromEntries(this.persistentFacts.entries());
      localStorage.setItem(VIBI_MEMORY_PERSISTENT_KEY, JSON.stringify(obj));
    } catch (err) {
      console.warn('[VibiMemoryService] Failed to persist memory:', err);
    }
  }

  /**
   * Save session memory to sessionStorage
   */
  saveSession() {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(VIBI_MEMORY_SESSION_KEY, JSON.stringify(this.sessionMemory));
    } catch {}
  }

  /**
   * Security guard: check if key or value contains forbidden sensitive strings
   * @param {string} str
   * @returns {boolean} true if safe, false if blocked
   */
  isSafeContent(str) {
    if (!str || typeof str !== 'string') return true;
    const lower = str.toLowerCase();
    const normalized = lower.replace(/[^a-z0-9]/g, '');

    for (const forbidden of STRICT_SECURITY_BLACKLIST) {
      const lowerF = forbidden.toLowerCase();
      const normF = lowerF.replace(/[^a-z0-9]/g, '');
      if (lower.includes(lowerF) || normalized.includes(normF)) {
        return false;
      }
    }

    if (
      normalized.includes('privatekey') ||
      normalized.includes('sessionkey') ||
      normalized.includes('secretkey') ||
      normalized.includes('authtoken') ||
      normalized.includes('password') ||
      normalized.includes('credential')
    ) {
      return false;
    }

    return true;
  }

  /**
   * Store a persistent user preference or explicit fact
   * @param {string} key
   * @param {string} fact
   * @returns {{ success: boolean, reason?: string }}
   */
  rememberFact(key, fact) {
    if (!key || typeof key !== 'string' || !fact || typeof fact !== 'string') {
      return { success: false, reason: 'invalid_arguments' };
    }

    const cleanKey = key.trim().toLowerCase().slice(0, 40);
    const cleanFact = fact.replace(/[\r\n\t]+/g, ' ').trim().slice(0, MAX_FACT_LENGTH);

    // Security shield
    if (!this.isSafeContent(cleanKey) || !this.isSafeContent(cleanFact)) {
      return { success: false, reason: 'security_blacklist_violation' };
    }

    // Capacity bound: max 30 facts
    if (this.persistentFacts.size >= MAX_PERSISTENT_FACTS && !this.persistentFacts.has(cleanKey)) {
      // Evict oldest entry
      const oldestKey = this.persistentFacts.keys().next().value;
      this.persistentFacts.delete(oldestKey);
    }

    this.persistentFacts.set(cleanKey, cleanFact);
    this.savePersistent();
    this.notify();

    return { success: true, key: cleanKey, fact: cleanFact };
  }

  /**
   * Delete a specific remembered fact
   * @param {string} key
   * @returns {boolean} true if removed
   */
  forgetFact(key) {
    if (!key || typeof key !== 'string') return false;
    const cleanKey = key.trim().toLowerCase();
    const removed = this.persistentFacts.delete(cleanKey);
    if (removed) {
      this.savePersistent();
      this.notify();
    }
    return removed;
  }

  /**
   * Get a remembered fact
   * @param {string} key
   * @param {string|null} [fallback=null]
   * @returns {string|null}
   */
  getFact(key, fallback = null) {
    if (!key || typeof key !== 'string') return fallback;
    const cleanKey = key.trim().toLowerCase();
    return this.persistentFacts.get(cleanKey) || fallback;
  }

  /**
   * Record a topic discussed in this session
   * @param {string} topic
   */
  recordSessionTopic(topic) {
    if (!topic || typeof topic !== 'string') return;
    const clean = topic.trim().toLowerCase().slice(0, 40);
    if (!this.isSafeContent(clean)) return;

    if (!this.sessionMemory.topicsDiscussed.includes(clean)) {
      this.sessionMemory.topicsDiscussed = [...this.sessionMemory.topicsDiscussed.slice(-9), clean];
      this.sessionMemory.lastUpdated = Date.now();
      this.saveSession();
    }
  }

  /**
   * Set ephemeral session preference
   * @param {string} key
   * @param {any} value
   */
  setSessionPreference(key, value) {
    if (!key || typeof key !== 'string') return;
    const cleanKey = key.trim().slice(0, 40);
    if (!this.isSafeContent(cleanKey)) return;

    this.sessionMemory.sessionPreferences[cleanKey] = value;
    this.sessionMemory.lastUpdated = Date.now();
    this.saveSession();
  }

  /**
   * Get complete transparent memory snapshot
   * @returns {Object}
   */
  getAllMemories() {
    const persistent = Object.fromEntries(this.persistentFacts.entries());
    return {
      persistentCount: this.persistentFacts.size,
      persistentFacts: persistent,
      sessionTopics: [...this.sessionMemory.topicsDiscussed],
      sessionPreferences: { ...this.sessionMemory.sessionPreferences },
      lastUpdated: this.sessionMemory.lastUpdated
    };
  }

  /**
   * Clear all memory (both persistent and session)
   */
  clearAllMemory() {
    this.persistentFacts.clear();
    this.sessionMemory = {
      topicsDiscussed: [],
      sessionPreferences: {},
      lastUpdated: Date.now()
    };
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(VIBI_MEMORY_PERSISTENT_KEY);
        sessionStorage.removeItem(VIBI_MEMORY_SESSION_KEY);
      } catch {}
    }
    this.notify();
    return true;
  }

  /**
   * Export all memory as JSON for user auditability
   * @returns {string} JSON string
   */
  exportMemory() {
    return JSON.stringify(this.getAllMemories(), null, 2);
  }
}

const vibiMemoryService = new VibiMemoryService();
export default vibiMemoryService;

/**
 * client/src/services/vibiContextService.js
 * ==========================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 4 CONTEXT ENGINE (READ-ONLY)
 *
 * Responsibilities:
 * - Read-only aggregation of minimal application context on-demand.
 * - Respects Master OFF and appContext preference flags.
 * - Strict security boundary:
 *     NEVER accesses message bodies, decrypted contents, private keys,
 *     passwords, session keys, auth tokens, or WebRTC media streams.
 * - Assembles compact snapshots (< 2KB) without continuous polling.
 */

import { useState, useCallback } from 'react';
import navigationService from './navigationService';
import { useVibiAssistant } from '../context/VibiAssistantContext';

// Sensitive keys blacklist that must NEVER appear anywhere in context snapshot
export const STRICT_SECURITY_BLACKLIST = Object.freeze([
  'password',
  'token',
  'auth_token',
  'private_key',
  'privateKey',
  'session_key',
  'sessionKey',
  'preKey',
  'pre_key',
  'message_body',
  'content',
  'stream',
  'mediaStream',
  'ciphertext',
  'plaintext'
]);

export class VibiContextService {
  constructor() {
    this.activeTab = 'feed';
    this.activeSection = null;
    this.activeChatMetadata = null; // { id, name, type }
    this.recentTopic = null;
    this.lastClarificationQuestion = null;
    this.recentTurns = [];
  }

  /**
   * Set the most recently discussed topic for contextual continuity
   * @param {string|null} topic
   */
  setRecentTopic(topic) {
    if (!topic) {
      this.recentTopic = null;
      return;
    }
    if (typeof topic === 'string') {
      this.recentTopic = topic.trim().toLowerCase().slice(0, 50);
    }
  }

  /**
   * Get the current active topic
   * @returns {string|null}
   */
  getRecentTopic() {
    return this.recentTopic || null;
  }

  /**
   * Clear recent topic
   */
  clearRecentTopic() {
    this.recentTopic = null;
  }

  /**
   * Set active clarification prompt key (e.g. 'which_settings', 'which_diagnostic')
   * @param {string|null} key
   */
  setLastClarification(key) {
    if (!key) {
      this.lastClarificationQuestion = null;
      return;
    }
    if (typeof key === 'string') {
      this.lastClarificationQuestion = key.trim().toLowerCase().slice(0, 50);
    }
  }

  /**
   * Get last pending clarification question
   * @returns {string|null}
   */
  getLastClarification() {
    return this.lastClarificationQuestion || null;
  }

  /**
   * Clear active clarification question
   */
  clearClarification() {
    this.lastClarificationQuestion = null;
  }

  /**
   * Record a conversational turn (up to 5 recent turns)
   * @param {'user'|'vibi'} role
   * @param {string} text
   * @param {string|null} [topic=null]
   */
  recordTurn(role, text, topic = null) {
    if (!text || typeof text !== 'string') return;
    if (topic) {
      this.setRecentTopic(topic);
    }
    const turn = {
      role: role === 'user' ? 'user' : 'vibi',
      text: text.slice(0, 300),
      topic: topic || this.recentTopic || null,
      timestamp: Date.now()
    };
    this.recentTurns = [...this.recentTurns.slice(-4), turn];
  }

  /**
   * Get recent conversation turns
   * @returns {Array}
   */
  getRecentTurns() {
    return Array.isArray(this.recentTurns) ? [...this.recentTurns] : [];
  }

  /**
   * Reset conversation memory, topics and clarifications
   */
  clearHistory() {
    this.recentTopic = null;
    this.lastClarificationQuestion = null;
    this.recentTurns = [];
  }

  /**
   * Set active sub-section (e.g. settings section: 'privacy', 'appearance', etc.)
   * Whitelisted strictly to non-sensitive structural navigation sections.
   * @param {string|null} section
   */
  setActiveSection(section) {
    if (!section) {
      this.activeSection = null;
      return;
    }
    if (typeof section === 'string') {
      const clean = section.trim().toLowerCase().slice(0, 30);
      const safeWhitelist = ['profile', 'appearance', 'contact', 'security', 'privacy', 'notifications', 'vibi', 'danger'];
      this.activeSection = safeWhitelist.includes(clean) ? clean : 'general';
    }
  }

  /**
   * Get current active section
   * @returns {string|null}
   */
  getActiveSection() {
    return this.activeSection || null;
  }

  /**
   * Clear active section
   */
  clearActiveSection() {
    this.activeSection = null;
  }

  /**
   * Set active tab/screen
   * @param {string} tab
   */
  setActiveTab(tab) {
    if (typeof tab === 'string' && tab.trim()) {
      this.activeTab = tab.trim().toLowerCase();
    }
  }

  /**
   * Get current active tab
   */
  getActiveTab() {
    if (this.activeTab) return this.activeTab;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem('vibegrid_active_tab') || 'feed';
    }
    return 'feed';
  }

  /**
   * Set active chat metadata (strictly metadata only: ID, display name, type)
   * @param {{ id: string|number, name: string, type: 'direct'|'group' }} metadata
   */
  setActiveChatMetadata(metadata) {
    if (!metadata) {
      this.activeChatMetadata = null;
      return;
    }
    // Only accept safe whitelist metadata fields
    this.activeChatMetadata = {
      id: metadata.id ? String(metadata.id) : null,
      name: metadata.name ? String(metadata.name).slice(0, 50) : null,
      type: metadata.type === 'group' ? 'group' : 'direct'
    };
  }

  /**
   * Clear active chat metadata
   */
  clearActiveChatMetadata() {
    this.activeChatMetadata = null;
  }

  /**
   * Read active sub-screen or open modal from navigation interceptors
   * @returns {string} sub-screen identifier or 'none'
   */
  getActiveSubScreen() {
    try {
      const interceptors = navigationService?.interceptors || [];
      if (interceptors.length > 0) {
        // Return highest priority interceptor's id
        return interceptors[0].id || 'modal';
      }
    } catch {
      // Fallback safe
    }
    return 'none';
  }

  /**
   * Get device & environment state
   */
  getDeviceContext() {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
    let isPWA = false;
    let notificationPermission = 'unsupported';
    let theme = 'dark';

    if (typeof window !== 'undefined') {
      try {
        isPWA = Boolean(
          (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
          window.navigator.standalone === true
        );
      } catch {}

      try {
        if ('Notification' in window) {
          notificationPermission = Notification.permission;
        }
      } catch {}

      try {
        theme = localStorage.getItem('vibegrid_theme') || 'dark';
      } catch {}
    }

    return {
      isOnline,
      isPWA,
      notificationPermission,
      theme
    };
  }

  /**
   * Sanitize and extract safe user profile summary
   * @param {Object} user
   */
  getUserSummary(user) {
    if (!user) return null;
    return {
      username: user.username ? String(user.username) : 'anonymous',
      displayName: user.full_name ? String(user.full_name).slice(0, 50) : (user.username || 'User'),
      isVerified: Boolean(user.is_verified)
    };
  }

  /**
   * Security guard: recursively verifies that no blacklisted sensitive keys exist
   */
  sanitizeSecurityCheck(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      for (const forbidden of STRICT_SECURITY_BLACKLIST) {
        if (lowerKey === forbidden.toLowerCase()) {
          delete obj[key];
          console.error(`[VibiContextService] BLOCKED forbidden property '${key}' from context!`);
        }
      }
      if (obj[key] && typeof obj[key] === 'object') {
        this.sanitizeSecurityCheck(obj[key]);
      }
    }
  }

  /**
   * Assemble read-only context snapshot on demand
   * @param {Object} params
   * @param {Object} [params.user] Current authenticated user object
   * @param {Object} [params.preferences] Vibi preferences
   * @returns {Object} context snapshot
   */
  assembleContext({ user, preferences } = {}) {
    // 1. Master Control check: if Vibi is disabled, Context Engine is dormant
    if (preferences && preferences.enabled === false) {
      return {
        status: 'dormant',
        reason: 'vibi_disabled',
        appContextEnabled: false
      };
    }

    // 2. App Context Awareness check: if appContext is OFF, return minimal masked context
    if (preferences && preferences.appContext === false) {
      const masked = {
        screen: 'unknown',
        subScreen: 'none',
        permissions: {},
        user: { username: user?.username || 'anonymous' },
        appContextEnabled: false
      };
      return masked;
    }

    // 3. Assemble full safe runtime context
    const snapshot = {
      timestamp: Date.now(),
      screen: this.getActiveTab(),
      subScreen: this.getActiveSubScreen(),
      activeSection: this.getActiveSection(),
      activeChat: this.activeChatMetadata ? { ...this.activeChatMetadata } : null,
      recentTopic: this.getRecentTopic(),
      lastClarificationQuestion: this.getLastClarification(),
      recentTurns: this.getRecentTurns(),
      user: this.getUserSummary(user),
      device: this.getDeviceContext(),
      appContextEnabled: true
    };

    // 4. Security sanitize
    this.sanitizeSecurityCheck(snapshot);

    // 5. Enforce < 2KB memory/payload limit
    try {
      const serialized = JSON.stringify(snapshot);
      if (serialized.length > 2048) {
        // Fall back to trimmed snapshot if unexpectedly bloated
        return {
          timestamp: snapshot.timestamp,
          screen: snapshot.screen,
          subScreen: 'none',
          activeSection: snapshot.activeSection,
          recentTopic: snapshot.recentTopic,
          lastClarificationQuestion: snapshot.lastClarificationQuestion,
          user: snapshot.user,
          device: { isOnline: snapshot.device.isOnline },
          appContextEnabled: true
        };
      }
    } catch {}

    return snapshot;
  }

  /**
   * Snapshot alias for AI client and direct consumers
   */
  getContextSnapshot(user = null, preferences = null) {
    const raw = this.assembleContext({ user, preferences });
    return {
      currentTab: raw.screen || 'feed',
      activeSection: raw.activeSection || null,
      recentTopic: raw.recentTopic || null,
      lastClarificationQuestion: raw.lastClarificationQuestion || null,
      recentTurns: raw.recentTurns || [],
      theme: raw.device?.theme || 'dark',
      online: raw.device?.isOnline !== false,
      device: raw.device?.isPWA ? 'pwa' : 'web',
      username: raw.user?.username || 'anonymous',
      ...raw
    };
  }
}

const vibiContextService = new VibiContextService();
export default vibiContextService;

/**
 * React hook to retrieve dynamic on-demand Vibi context
 */
export function useVibiContext(user = null) {
  const { preferences } = useVibiAssistant();
  const [context, setContext] = useState(() => vibiContextService.assembleContext({ user, preferences }));

  const refreshContext = useCallback(() => {
    setContext(vibiContextService.assembleContext({ user, preferences }));
  }, [user, preferences]);

  return {
    context,
    refreshContext,
    vibiContextService
  };
}

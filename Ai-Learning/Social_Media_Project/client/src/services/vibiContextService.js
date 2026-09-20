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

import { useState, useCallback, useEffect } from 'react';
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
    this.activeModal = null;
    this.activeChatMetadata = null; // { id, name, type }
    this.recentTopic = null;
    this.lastClarificationQuestion = null;
    this.recentTurns = [];
    this.selectedText = null;
    this.focusedField = null;
    this.recentActions = []; // FIFO max 5 actions: { actionId, paramsSummary, status, timestamp }
    this.e2eeReady = false;
    this.unreadNotificationsCount = 0;
    this.listeners = new Set();
    this.initSystemListeners();
  }

  /**
   * Subscribe to runtime context changes without polling
   * @param {Function} listener
   * @returns {Function} Unsubscribe callback
   */
  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    return () => {};
  }

  /**
   * Notify all subscribed listeners of a context change
   */
  notify() {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (err) {
        console.warn('[VibiContextService] Error in change listener:', err);
      }
    }
  }

  /**
   * Initialize browser system events for reactive context synchronization
   */
  initSystemListeners() {
    if (typeof window === 'undefined') return;
    try {
      window.addEventListener('vibegrid:open-modal', (e) => {
        if (e?.detail?.modal) {
          this.setActiveModal(e.detail.modal);
        }
      });
      window.addEventListener('vibegrid:close-modal', () => {
        this.clearActiveModal();
      });
      window.addEventListener('online', () => this.notify());
      window.addEventListener('offline', () => this.notify());
      window.addEventListener('popstate', () => {
        const tab = this.getActiveTab();
        this.setActiveTab(tab);
      });

      // Authorized interaction signals: text selection & focused element
      if (typeof document !== 'undefined') {
        document.addEventListener('selectionchange', () => {
          try {
            const sel = window.getSelection ? window.getSelection() : null;
            if (!sel || sel.isCollapsed) {
              if (this.selectedText) this.clearSelectedText();
              return;
            }
            const anchor = sel.anchorNode;
            const parentEl = anchor ? (anchor.nodeType === 1 ? anchor : anchor.parentElement) : null;
            if (parentEl) {
              const inputEl = parentEl.closest('input, textarea');
              if (inputEl) {
                const inputType = (inputEl.getAttribute('type') || '').toLowerCase();
                const inputName = (inputEl.getAttribute('name') || '').toLowerCase();
                if (inputType === 'password' || inputName.includes('password') || inputName.includes('token') || inputName.includes('secret')) {
                  if (this.selectedText) this.clearSelectedText();
                  return;
                }
              }
            }
            const rawText = sel.toString();
            this.setSelectedText(rawText);
          } catch {}
        });

        document.addEventListener('focusin', (e) => {
          try {
            const target = e.target;
            if (!target || !target.tagName) return;
            const tag = target.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea') {
              const type = (target.getAttribute('type') || '').toLowerCase();
              const name = (target.getAttribute('name') || '').toLowerCase();
              const placeholder = (target.getAttribute('placeholder') || '').toLowerCase();
              const testId = (target.getAttribute('data-testid') || '').toLowerCase();
              if (type === 'password' || name.includes('password') || name.includes('token') || testId.includes('password')) {
                return;
              }
              if (type === 'search' || name.includes('search') || placeholder.includes('search') || testId.includes('search')) {
                this.setFocusedField('search');
              } else if (name.includes('comment') || placeholder.includes('comment') || testId.includes('comment')) {
                this.setFocusedField('comment');
              } else if (name.includes('caption') || placeholder.includes('caption') || testId.includes('caption')) {
                this.setFocusedField('caption');
              } else {
                this.setFocusedField('input');
              }
            }
          } catch {}
        });

        document.addEventListener('focusout', () => {
          this.clearFocusedField();
        });
      }
    } catch {}
  }

  /**
   * Set active open modal
   * @param {string|null} modal
   */
  setActiveModal(modal) {
    if (!modal) {
      this.activeModal = null;
    } else if (typeof modal === 'string') {
      this.activeModal = modal.trim().toLowerCase().slice(0, 40);
    }
    this.notify();
  }

  /**
   * Get currently active open modal identifier
   * @returns {string|null}
   */
  getActiveModal() {
    if (this.activeModal) return this.activeModal;
    const sub = this.getActiveSubScreen();
    return sub !== 'none' ? sub : null;
  }

  /**
   * Clear active modal state
   */
  clearActiveModal() {
    this.activeModal = null;
    this.notify();
  }

  /**
   * Set selected text snippet from UI
   * @param {string|null} text
   */
  setSelectedText(text) {
    if (!text || typeof text !== 'string') {
      if (this.selectedText !== null) {
        this.selectedText = null;
        this.notify();
      }
      return;
    }
    const clean = text.replace(/[\r\n\t]+/g, ' ').trim();
    if (clean.length < 3) {
      if (this.selectedText !== null) {
        this.selectedText = null;
        this.notify();
      }
      return;
    }
    for (const forbidden of STRICT_SECURITY_BLACKLIST) {
      if (clean.toLowerCase().includes(forbidden.toLowerCase())) {
        this.selectedText = null;
        return;
      }
    }
    const truncated = clean.slice(0, 250);
    if (this.selectedText !== truncated) {
      this.selectedText = truncated;
      this.notify();
    }
  }

  /**
   * Get currently selected text
   * @returns {string|null}
   */
  getSelectedText() {
    return this.selectedText || null;
  }

  /**
   * Clear selected text
   */
  clearSelectedText() {
    if (this.selectedText !== null) {
      this.selectedText = null;
      this.notify();
    }
  }

  /**
   * Set focused input field type (e.g. 'search', 'comment', 'caption')
   * @param {string|null} field
   */
  setFocusedField(field) {
    if (!field) {
      if (this.focusedField !== null) {
        this.focusedField = null;
        this.notify();
      }
      return;
    }
    if (typeof field === 'string') {
      const lower = field.trim().toLowerCase();
      if (lower.includes('password') || lower.includes('token') || lower.includes('secret') || lower.includes('key')) {
        this.focusedField = null;
        return;
      }
      const allowed = ['search', 'comment', 'composer', 'caption', 'bio'];
      const matched = allowed.find(a => lower.includes(a)) || 'input';
      if (this.focusedField !== matched) {
        this.focusedField = matched;
        this.notify();
      }
    }
  }

  /**
   * Get focused field
   * @returns {string|null}
   */
  getFocusedField() {
    return this.focusedField || null;
  }

  /**
   * Clear focused field
   */
  clearFocusedField() {
    if (this.focusedField !== null) {
      this.focusedField = null;
      this.notify();
    }
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
    this.notify();
  }

  /**
   * Set active sub-section (e.g. settings section: 'privacy', 'appearance', etc.)
   * Whitelisted strictly to non-sensitive structural navigation sections.
   * @param {string|null} section
   */
  setActiveSection(section) {
    if (!section) {
      this.activeSection = null;
      this.notify();
      return;
    }
    if (typeof section === 'string') {
      const clean = section.trim().toLowerCase().slice(0, 30);
      const safeWhitelist = ['profile', 'appearance', 'contact', 'security', 'privacy', 'notifications', 'vibi', 'danger'];
      this.activeSection = safeWhitelist.includes(clean) ? clean : 'general';
      this.notify();
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
    this.notify();
  }

  /**
   * Set active tab/screen
   * @param {string} tab
   */
  setActiveTab(tab) {
    if (typeof tab === 'string' && tab.trim()) {
      const cleanTab = tab.trim().toLowerCase();
      if (this.activeTab !== cleanTab) {
        this.activeTab = cleanTab;
        this.notify();
      }
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
      this.notify();
      return;
    }
    // Only accept safe whitelist metadata fields
    this.activeChatMetadata = {
      id: metadata.id ? String(metadata.id) : null,
      name: metadata.name ? String(metadata.name).slice(0, 50) : null,
      type: metadata.type === 'group' ? 'group' : 'direct'
    };
    this.notify();
  }

  /**
   * Clear active chat metadata
   */
  clearActiveChatMetadata() {
    this.activeChatMetadata = null;
    this.notify();
  }

  /**
   * Read active sub-screen or open modal from navigation interceptors
   * Excludes Vibi's own overlay panel so underlying modal/view is accurately identified.
   * @returns {string} sub-screen identifier or 'none'
   */
  getActiveSubScreen() {
    try {
      const interceptors = navigationService?.interceptors || [];
      const screenInterceptors = interceptors.filter((i) => i.id !== 'vibi-assistant-panel');
      if (screenInterceptors.length > 0) {
        return screenInterceptors[0].id || 'modal';
      }
    } catch {
      // Fallback safe
    }
    return this.activeModal || 'none';
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
   * Record an executed action in the session history (FIFO, max 5 actions)
   * @param {string} actionId
   * @param {Object} [params={}]
   * @param {'success'|'failed'|'pending'} [status='success']
   */
  recordRecentAction(actionId, params = {}, status = 'success') {
    if (!actionId || typeof actionId !== 'string') return;
    const cleanActionId = actionId.trim().slice(0, 50);
    const safeParams = {};
    if (params && typeof params === 'object') {
      for (const [k, v] of Object.entries(params)) {
        const lowerK = k.toLowerCase();
        if (STRICT_SECURITY_BLACKLIST.some(b => lowerK.includes(b.toLowerCase()))) continue;
        if (typeof v === 'string') safeParams[k] = v.slice(0, 50);
        else if (typeof v === 'number' || typeof v === 'boolean') safeParams[k] = v;
      }
    }
    const entry = {
      actionId: cleanActionId,
      paramsSummary: Object.keys(safeParams).length > 0 ? safeParams : null,
      status: status === 'failed' ? 'failed' : (status === 'pending' ? 'pending' : 'success'),
      timestamp: Date.now()
    };
    this.recentActions = [...this.recentActions.slice(-4), entry];
    this.notify();
  }

  /**
   * Get recently executed actions
   * @returns {Array}
   */
  getRecentActions() {
    return Array.isArray(this.recentActions) ? [...this.recentActions] : [];
  }

  /**
   * Clear recent actions history
   */
  clearRecentActions() {
    this.recentActions = [];
    this.notify();
  }

  /**
   * Set E2EE readiness flag
   * @param {boolean} ready
   */
  setE2eeReady(ready = true) {
    this.e2eeReady = Boolean(ready);
    this.notify();
  }

  /**
   * Get safe permissions context
   */
  getPermissionsContext() {
    let notifications = 'unsupported';
    let audioMic = 'prompt';
    let isPWA = false;
    let soundEnabled = true;

    if (typeof window !== 'undefined') {
      try {
        if ('Notification' in window) {
          notifications = Notification.permission;
        }
      } catch {}

      try {
        isPWA = Boolean(
          (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
          window.navigator?.standalone === true
        );
      } catch {}

      try {
        const storedSound = localStorage.getItem('vibegrid_sound_enabled');
        if (storedSound !== null) soundEnabled = storedSound === 'true';
      } catch {}
    }

    return {
      notifications,
      audioMic,
      isPWA,
      soundEnabled
    };
  }

  /**
   * Get high-level application state
   */
  getApplicationState() {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
    return {
      isOnline,
      activeChat: this.activeChatMetadata ? { ...this.activeChatMetadata } : null,
      e2eeReady: this.e2eeReady,
      hasUnreadMessages: false
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
      activeModal: this.getActiveModal(),
      activeChat: this.activeChatMetadata ? { ...this.activeChatMetadata } : null,
      recentTopic: this.getRecentTopic(),
      lastClarificationQuestion: this.getLastClarification(),
      recentTurns: this.getRecentTurns(),
      ...(this.selectedText ? { selectedText: this.selectedText } : {}),
      ...(this.focusedField ? { focusedField: this.focusedField } : {}),
      ...(this.recentActions.length > 0 ? { recentActions: this.getRecentActions() } : {}),
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
          activeModal: snapshot.activeModal,
          recentTopic: snapshot.recentTopic,
          lastClarificationQuestion: snapshot.lastClarificationQuestion,
          selectedText: snapshot.selectedText,
          focusedField: snapshot.focusedField,
          user: snapshot.user,
          device: { isOnline: snapshot.device.isOnline },
          appContextEnabled: true
        };
      }
    } catch {}

    return snapshot;
  }

  /**
   * Complete 7-Domain Workflow Context representation
   * @param {Object} [params]
   * @returns {Object} 7 context domains
   */
  getWorkflowContext({ user, preferences } = {}) {
    if (preferences && preferences.enabled === false) {
      return { status: 'dormant', reason: 'vibi_disabled', appContextEnabled: false };
    }
    if (preferences && preferences.appContext === false) {
      return {
        conversation: { recentTurns: [], recentTopic: null, lastClarificationQuestion: null },
        page: { currentTab: 'unknown', activeSection: null, subScreen: 'none' },
        ui: { activeModal: null, focusedField: null },
        selection: { selectedText: null },
        recentActions: [],
        appState: { isOnline: true, activeChat: null, e2eeReady: false },
        permissions: {},
        user: { username: user?.username || 'anonymous' },
        appContextEnabled: false
      };
    }

    const workflow = {
      conversation: {
        recentTurns: this.getRecentTurns(),
        recentTopic: this.getRecentTopic(),
        lastClarificationQuestion: this.getLastClarification()
      },
      page: {
        currentTab: this.getActiveTab(),
        activeSection: this.getActiveSection(),
        subScreen: this.getActiveSubScreen()
      },
      ui: {
        activeModal: this.getActiveModal(),
        focusedField: this.getFocusedField()
      },
      selection: {
        selectedText: this.getSelectedText()
      },
      recentActions: this.getRecentActions(),
      appState: this.getApplicationState(),
      permissions: this.getPermissionsContext(),
      user: this.getUserSummary(user),
      appContextEnabled: true,
      timestamp: Date.now()
    };

    this.sanitizeSecurityCheck(workflow);
    return workflow;
  }

  /**
   * Irrelevance Filter: Prunes unneeded context domains based on query intent
   * Ensures outgoing context to AI is minimal, relevant, and strictly bounded (< 500 bytes).
   * @param {string} query
   * @param {Object} [baseSnapshot]
   * @returns {Object} filtered, relevant context
   */
  buildRelevantContext(query = '', baseSnapshot = null) {
    const snapshot = baseSnapshot || this.assembleContext();
    if (!snapshot || snapshot.status === 'dormant') {
      return { status: 'dormant' };
    }

    const q = (query || '').toLowerCase().trim();
    const relevant = {
      timestamp: snapshot.timestamp,
      appContextEnabled: Boolean(snapshot.appContextEnabled),
      screen: snapshot.screen || snapshot.currentTab || 'feed',
      currentTab: snapshot.screen || snapshot.currentTab || 'feed'
    };

    // 1. Route / Section context
    if (snapshot.activeSection) {
      relevant.activeSection = snapshot.activeSection;
    }
    if (snapshot.activeModal && snapshot.activeModal !== 'none') {
      relevant.activeModal = snapshot.activeModal;
    }

    // 2. Conversation context: preserve topic & clarification
    if (snapshot.recentTopic) {
      relevant.recentTopic = snapshot.recentTopic;
    }
    if (snapshot.lastClarificationQuestion) {
      relevant.lastClarificationQuestion = snapshot.lastClarificationQuestion;
    }

    // 3. Selection Context: only attach if query mentions selection/this or query is empty
    const hasSelection = Boolean(snapshot.selectedText);
    const selectionKeywords = ['this', 'selected', 'explain', 'what does', 'mean', 'translate', 'summarize', 'search'];
    const queryMentionsSelection = selectionKeywords.some(kw => q.includes(kw));
    if (hasSelection && (queryMentionsSelection || q.length === 0)) {
      relevant.selectedText = snapshot.selectedText;
    }

    // 4. UI Focus Context: only attach if query is related to typing or searching
    if (snapshot.focusedField && (q.includes('search') || q.includes('type') || q.includes('comment') || q.includes('write'))) {
      relevant.focusedField = snapshot.focusedField;
    }

    // 5. Recent Actions Context: attach if query inquires about actions or workflow
    const actionKeywords = ['undo', 'action', 'did you', 'what did', 'repeat', 'again', 'why did', 'last'];
    const queryAsksAction = actionKeywords.some(kw => q.includes(kw));
    const recentActions = snapshot.recentActions || this.getRecentActions();
    if (queryAsksAction && recentActions.length > 0) {
      relevant.recentActions = recentActions.slice(-3);
    } else if (recentActions.length > 0 && ['why', 'how come', 'what happened'].some(kw => q.includes(kw))) {
      relevant.recentActions = recentActions.slice(-1);
    }

    // 6. Permissions & Device Context
    const callsKeywords = ['call', 'audio', 'mic', 'microphone', 'video', 'webrtc'];
    const notifKeywords = ['notification', 'alert', 'quiet', 'ping', 'push'];
    const themeKeywords = ['theme', 'dark', 'light', 'cyberpunk', 'appearance', 'oled'];

    if (callsKeywords.some(kw => q.includes(kw))) {
      relevant.permissions = {
        audioMic: snapshot.permissions?.audioMic || 'prompt',
        notifications: snapshot.permissions?.notifications || 'default'
      };
      relevant.appState = {
        isOnline: snapshot.device?.isOnline !== false
      };
    } else if (notifKeywords.some(kw => q.includes(kw))) {
      relevant.permissions = {
        notifications: snapshot.permissions?.notifications || 'default',
        soundEnabled: snapshot.permissions?.soundEnabled !== false
      };
    } else if (themeKeywords.some(kw => q.includes(kw))) {
      relevant.theme = snapshot.device?.theme || 'dark';
    } else {
      relevant.isOnline = snapshot.device?.isOnline !== false;
    }

    // 7. Active Chat Metadata
    if ((snapshot.screen === 'messages' || q.includes('chat') || q.includes('message') || q.includes('talk')) && snapshot.activeChat) {
      relevant.activeChat = snapshot.activeChat;
    }

    // 8. User summary
    if (snapshot.user) {
      relevant.user = snapshot.user;
    }

    this.sanitizeSecurityCheck(relevant);
    return relevant;
  }

  /**
   * Snapshot alias for AI client and direct consumers
   */
  getContextSnapshot(user = null, preferences = null) {
    const raw = this.assembleContext({ user, preferences });
    return {
      currentTab: raw.screen || 'feed',
      activeSection: raw.activeSection || null,
      activeModal: raw.activeModal || null,
      recentTopic: raw.recentTopic || null,
      lastClarificationQuestion: raw.lastClarificationQuestion || null,
      recentTurns: raw.recentTurns || [],
      selectedText: raw.selectedText || null,
      focusedField: raw.focusedField || null,
      recentActions: raw.recentActions || [],
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
 * React hook to retrieve dynamic on-demand Vibi context with reactive change subscription
 */
export function useVibiContext(user = null) {
  const { preferences } = useVibiAssistant();
  const [context, setContext] = useState(() => vibiContextService.assembleContext({ user, preferences }));

  useEffect(() => {
    const unsubscribe = vibiContextService.subscribe(() => {
      setContext(vibiContextService.assembleContext({ user, preferences }));
    });
    return unsubscribe;
  }, [user, preferences]);

  const refreshContext = useCallback(() => {
    setContext(vibiContextService.assembleContext({ user, preferences }));
  }, [user, preferences]);

  return {
    context,
    refreshContext,
    vibiContextService
  };
}

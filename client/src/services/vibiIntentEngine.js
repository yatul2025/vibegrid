/**
 * client/src/services/vibiIntentEngine.js
 * ========================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 5 INTENT & ACTION ENGINE
 *
 * Responsibilities:
 * - Deterministic Quick Action Engine: fast local intent matching without latency.
 * - Routes all actions through AI Output Validator.
 * - Enforces confirmation guards for destructive actions.
 * - Logs all executions and rejections to Vibi Audit Log.
 */

import vibiActionRegistry from './vibiActionRegistry';
import vibiOutputValidator, { SAFETY_TIERS } from './vibiOutputValidator';
import vibiAuditLog from './vibiAuditLog';
import vibiCharacterService from './vibiCharacterService';
import vibiSecurityGuard from './vibiSecurityGuard';
import vibiContextService from './vibiContextService';
import vibiMemoryService from './vibiMemoryService';

export const EXECUTION_STATES = {
  IDLE: 'idle',
  VALIDATING: 'validating',
  AWAITING_CONFIRMATION: 'awaiting_confirmation',
  EXECUTING: 'executing',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMED_OUT: 'timed_out'
};

export class VibiIntentEngine {
  constructor() {
    this.executionState = EXECUTION_STATES.IDLE;
    this.recentActionNonces = new Map();
  }

  getExecutionState() {
    return this.executionState;
  }

  isExecuting() {
    return this.executionState === EXECUTION_STATES.EXECUTING;
  }

  setExecutionState(state) {
    this.executionState = state;
  }

  /**
   * Replay protection guard for state mutating / destructive actions
   * @param {string} actionId
   * @param {Object} sanitizedParams
   * @param {string} username
   * @returns {boolean} true if execution allowed, false if duplicate
   */
  _checkReplayGuard(actionId, sanitizedParams = {}, username = 'anonymous') {
    const signature = `${actionId}:${JSON.stringify(sanitizedParams)}:${username}`;
    const now = Date.now();
    const last = this.recentActionNonces.get(signature);
    if (last && now - last < 1500) {
      return false; // rejected by replay guard
    }
    this.recentActionNonces.set(signature, now);

    // Bounded cleanup: prune old signatures
    if (this.recentActionNonces.size > 50) {
      for (const [k, ts] of this.recentActionNonces.entries()) {
        if (now - ts > 10000) this.recentActionNonces.delete(k);
      }
    }
    return true;
  }

  /**
   * Extract user handle from text (e.g. @alice)
   * @param {string} text
   * @returns {string|null}
   */
  extractUserHandle(text = '') {
    if (!text || typeof text !== 'string') return null;
    const match = text.match(/@([a-zA-Z0-9_]{3,30})/);
    return match ? match[1] : null;
  }

  /**
   * Extract search term / query from text
   * @param {string} text
   * @returns {string|null}
   */
  extractSearchQuery(text = '') {
    if (!text || typeof text !== 'string') return null;
    const match = text.match(/\b(?:search for|search|find|lookup|look up)\s+(?:users?\s+|posts?\s+about\s+|tag\s+)?["']?([^"'\n\r\t.,!?;]+)["']?/i);
    if (!match) return null;
    const candidate = match[1].trim();
    if (['settings', 'privacy', 'messages', 'profile', 'feed', 'explore', 'notifications'].includes(candidate.toLowerCase())) {
      return null;
    }
    return candidate;
  }

  /**
   * Extract theme name from natural language
   * @param {string} text
   * @returns {string|null}
   */
  extractTheme(text = '') {
    if (!text || typeof text !== 'string') return null;
    const themes = ['dark', 'light', 'cyberpunk', 'nordic', 'oled', 'synthwave', 'sunset', 'emerald', 'forest', 'crimson'];
    const lower = text.toLowerCase();
    for (const theme of themes) {
      if (lower.includes(theme)) return theme;
    }
    return null;
  }

  /**
   * Extract target tab
   * @param {string} text
   * @returns {string|null}
   */
  extractTab(text = '') {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase();
    if (lower.includes('explore') || lower.includes('trending') || lower.includes('discover')) return 'explore';
    if (lower.includes('message') || lower.includes('chat') || lower.includes('dm')) return 'messages';
    if (lower.includes('profile') || lower.includes('my account')) return 'profile';
    if (lower.includes('feed') || lower.includes('timeline') || lower.includes('home')) return 'feed';
    if (lower.includes('setting')) return 'settings';
    return null;
  }

  /**
   * Extract settings section
   * @param {string} text
   * @returns {string|null}
   */
  extractSettingsSection(text = '') {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase();
    if (lower.includes('privacy') || lower.includes('permission')) return 'privacy';
    if (lower.includes('appearance') || lower.includes('theme')) return 'appearance';
    if (lower.includes('security') || lower.includes('password') || lower.includes('session')) return 'security';
    if (lower.includes('notification') || lower.includes('alert')) return 'notifications';
    if (lower.includes('vibi') || lower.includes('assistant')) return 'vibi';
    return null;
  }

  /**
   * Extract modal identifier
   * @param {string} text
   * @returns {string|null}
   */
  extractModal(text = '') {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase();
    if (lower.includes('create post') || lower.includes('new post') || lower.includes('post photo')) return 'create_post';
    if (lower.includes('notification') && (lower.includes('show') || lower.includes('open') || lower.includes('check'))) return 'notifications';
    if (lower.includes('call history') || lower.includes('recent call')) return 'call_history';
    if (lower.includes('permission') || lower.includes('onboarding')) return 'permission_onboarding';
    return null;
  }

  /**
   * Deterministically detect user intent from natural text
   * @param {string} text - User message input
   * @param {Object} [context={}] - Runtime app context
   * @param {Object} [options={}] - Internal routing options (e.g. { isSubIntent: true })
   * @returns {{ matched: boolean, actionId?: string, params?: Object, replyText?: string, isQuickAction?: boolean, confidence?: number, actions?: Array, isComposite?: boolean, isSuggestion?: boolean }}
   */
  _matchIntent(text = '', context = {}, options = {}) {
    if (!text || typeof text !== 'string') {
      return { matched: false, confidence: 0.0 };
    }

    // Step -1: Security Guard Prompt Injection Defense
    const safetyCheck = vibiSecurityGuard.checkPromptSafety(text);
    if (!safetyCheck.safe) {
      return {
        matched: false,
        rejected: true,
        confidence: 0.0,
        safetyReason: safetyCheck.reason,
        replyText: safetyCheck.friendlyReply
      };
    }

    const query = text.trim().toLowerCase();

    // =========================================================================
    // STEP 0: COMPOSITE MULTI-INTENT PARSER
    // Detect composite commands connected with conjunctions: 'and then', 'and', 'then', 'also'
    // =========================================================================
    if (!options.isSubIntent && /\s+(?:and then|and|then|also)\s+/i.test(query)) {
      const parts = query.split(/\s+(?:and then|and|then|also)\s+/i);
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        const intent1 = this.detectIntent(parts[0].trim(), context, { isSubIntent: true });
        const intent2 = this.detectIntent(parts[1].trim(), context, { isSubIntent: true });

        if (intent1.matched && intent2.matched && intent1.actionId && intent2.actionId) {
          return {
            matched: true,
            isQuickAction: true,
            isComposite: true,
            actionId: intent1.actionId,
            params: intent1.params,
            primaryIntent: intent1,
            secondaryIntent: intent2,
            actions: [
              { id: intent1.actionId, params: intent1.params, label: intent1.replyText?.slice(0, 30) || 'Step 1' },
              { id: intent2.actionId, params: intent2.params, label: intent2.replyText?.slice(0, 30) || 'Step 2' }
            ],
            confidence: Math.min(intent1.confidence || 0.95, intent2.confidence || 0.95),
            responseType: 'STEP_BY_STEP',
            topic: intent1.topic || intent2.topic || 'multi_action',
            replyText: `${intent1.replyText} And then: ${intent2.replyText}`
          };
        }
      }
    }

    // =========================================================================
    // STEP 0.5: CLARIFICATION ANSWER RESOLUTION
    // If the previous turn asked a clarification question, resolve user's answer
    // =========================================================================
    const lastClarification = context.lastClarificationQuestion || null;
    if (lastClarification === 'which_settings') {
      if (query.includes('privacy') || query.includes('permission') || query.includes('security')) {
        return {
          matched: true,
          isQuickAction: true,
          actionId: 'navigate',
          params: { tab: 'settings', section: 'privacy' },
          replyText: "Opening **Privacy & Permissions** settings for you! 🛡️",
          confidence: 0.95,
          responseType: 'SHORT',
          topic: 'settings'
        };
      }
      if (query.includes('appearance') || query.includes('theme') || query.includes('dark') || query.includes('light')) {
        return {
          matched: true,
          isQuickAction: true,
          actionId: 'navigate',
          params: { tab: 'settings', section: 'appearance' },
          replyText: "Opening **Appearance & Themes** settings! 🎨",
          confidence: 0.95,
          responseType: 'SHORT',
          topic: 'theme'
        };
      }
      if (query.includes('notification') || query.includes('alert')) {
        return {
          matched: true,
          isQuickAction: true,
          actionId: 'navigate',
          params: { tab: 'settings', section: 'notifications' },
          replyText: "Opening **Notification Preferences**! 🔔",
          confidence: 0.95,
          responseType: 'SHORT',
          topic: 'notifications'
        };
      }
      if (query.includes('vibi') || query.includes('assistant')) {
        return {
          matched: true,
          isQuickAction: true,
          actionId: 'navigate',
          params: { tab: 'settings', section: 'vibi' },
          replyText: "Opening **Vibi Assistant** settings! 🦊⚙️",
          confidence: 0.95,
          responseType: 'SHORT',
          topic: 'vibi'
        };
      }
      if (query.includes('all') || query.includes('main') || query.includes('everything') || query === 'settings') {
        return {
          matched: true,
          isQuickAction: true,
          actionId: 'navigate',
          params: { tab: 'settings' },
          replyText: "Navigating to **Settings & Privacy**! ⚙️",
          confidence: 0.95,
          responseType: 'SHORT',
          topic: 'settings'
        };
      }
    }

    if (lastClarification === 'which_diagnostic') {
      if (query.includes('message') || query.includes('chat') || query.includes('dm')) {
        return {
          matched: true,
          isQuickAction: true,
          actionId: 'run_diagnostics',
          params: { category: 'messages' },
          replyText: "Running real-time socket and messaging diagnostics! ⚡",
          responseType: 'STEP_BY_STEP',
          topic: 'messages'
        };
      }
      if (query.includes('notification') || query.includes('push') || query.includes('alert')) {
        return {
          matched: true,
          isQuickAction: true,
          actionId: 'run_diagnostics',
          params: { category: 'notifications' },
          replyText: "Running browser notification permission and delivery diagnostics! 🔔",
          responseType: 'STEP_BY_STEP',
          topic: 'notifications'
        };
      }
      if (query.includes('call') || query.includes('audio') || query.includes('video') || query.includes('mic') || query.includes('camera')) {
        return {
          matched: true,
          isQuickAction: true,
          actionId: 'run_diagnostics',
          params: { category: 'calls' },
          replyText: "Running WebRTC calling, microphone, and camera diagnostics! 📞",
          responseType: 'STEP_BY_STEP',
          topic: 'calls'
        };
      }
      if (query.includes('storage') || query.includes('cache') || query.includes('slow')) {
        return {
          matched: true,
          isQuickAction: true,
          actionId: 'run_diagnostics',
          params: { category: 'storage' },
          replyText: "Checking local storage usage and temporary cache size! 🚀",
          responseType: 'STEP_BY_STEP',
          topic: 'storage'
        };
      }
      if (query.includes('upload') || query.includes('photo') || query.includes('image')) {
        return {
          matched: true,
          isQuickAction: true,
          actionId: 'run_diagnostics',
          params: { category: 'uploads' },
          replyText: "Checking image upload limits and compression diagnostics! 📸",
          responseType: 'STEP_BY_STEP',
          topic: 'uploads'
        };
      }
      if (query.includes('all') || query.includes('full') || query.includes('everything')) {
        return {
          matched: true,
          isQuickAction: true,
          actionId: 'run_diagnostics',
          params: { category: 'all' },
          replyText: "Running a comprehensive full-system health diagnostic! 🦊🔧",
          responseType: 'STEP_BY_STEP',
          topic: 'diagnostics'
        };
      }
    }

    // =========================================================================
    // STEP 0.7: RECENT ACTIONS & WORKFLOW CONTEXT (PHASE 7)
    // Handle "what did you just do", "what was the last action", "what did you do"
    // =========================================================================
    if (query.includes('what did you just do') || query.includes('what was the last action') || query.includes('what did you do')) {
      const recent = vibiContextService.getRecentActions();
      if (recent.length > 0) {
        const last = recent[recent.length - 1];
        return {
          matched: true,
          actionId: 'explain_feature',
          params: { feature: 'vibi' },
          confidence: 0.98,
          safetyTier: SAFETY_TIERS.READ_ONLY,
          topic: 'recent_action',
          responseType: 'SHORT',
          replyText: `I recently executed **${last.actionId}** (status: *${last.status}*). 🦊 Would you like me to repeat it or undo it?`,
          actions: [{ id: 'explain_feature', params: { feature: 'vibi' } }]
        };
      }
      return {
        matched: true,
        actionId: 'explain_feature',
        params: { feature: 'vibi' },
        confidence: 0.95,
        safetyTier: SAFETY_TIERS.READ_ONLY,
        topic: 'recent_action',
        responseType: 'SHORT',
        replyText: 'No actions have been executed yet in this session! 🦊 Anything I can help you with?',
        actions: []
      };
    }

    // =========================================================================
    // STEP 0.8: CONTROLLED MEMORY & PERSONALIZATION (PHASE 8)
    // Handle "what do you remember", "remember that ...", "forget everything", "clear memory"
    // =========================================================================
    if (query.includes('what do you remember') || query.includes('show my memory') || query.includes('list memories') || query === 'memory') {
      const allMem = vibiMemoryService.getAllMemories();
      const facts = Object.entries(allMem.persistentFacts);
      if (facts.length === 0) {
        return {
          matched: true,
          actionId: 'explain_feature',
          params: { feature: 'vibi_memory' },
          confidence: 0.98,
          safetyTier: SAFETY_TIERS.READ_ONLY,
          topic: 'memory',
          responseType: 'SHORT',
          replyText: 'I currently have no saved preferences or memories about you! 🦊 You can tell me things like "Remember that I prefer dark mode" or "Remember that I like short answers".',
          actions: []
        };
      }
      const factList = facts.map(([k, v]) => `• **${k}**: ${v}`).join('\n');
      return {
        matched: true,
        actionId: 'explain_feature',
        params: { feature: 'vibi_memory' },
        confidence: 0.98,
        safetyTier: SAFETY_TIERS.READ_ONLY,
        topic: 'memory',
        responseType: 'DETAILED',
        replyText: `Here is everything I remember about your preferences:\n\n${factList}\n\nYou can say **"forget everything"** to wipe my memory anytime! 🦊🛡️`,
        actions: [{ id: 'explain_feature', params: { feature: 'vibi_memory' } }]
      };
    }

    if (query.includes('forget everything') || query.includes('clear my memory') || query.includes('delete memory') || query.includes('wipe memory')) {
      vibiMemoryService.clearAllMemory();
      return {
        matched: true,
        actionId: 'clear_temporary_cache',
        params: { target: 'memory' },
        confidence: 0.98,
        safetyTier: SAFETY_TIERS.READ_ONLY,
        topic: 'memory',
        responseType: 'SHORT',
        replyText: 'Memory completely wiped! 🦊🧹 I have forgotten all saved preferences and session topics.',
        actions: []
      };
    }

    if (query.startsWith('remember that ') || query.startsWith('remember ')) {
      const rawFact = text.trim().replace(/^remember (that )?/i, '').trim();
      if (rawFact.length >= 3) {
        const key = rawFact.toLowerCase().split(/\s+/).slice(0, 3).join('_').replace(/[^a-z0-9_]/gi, '').slice(0, 30) || 'user_preference';
        const saveRes = vibiMemoryService.rememberFact(key, rawFact);
        if (saveRes.success) {
          return {
            matched: true,
            actionId: 'explain_feature',
            params: { feature: 'vibi_memory' },
            confidence: 0.98,
            safetyTier: SAFETY_TIERS.READ_ONLY,
            topic: 'memory',
            responseType: 'SHORT',
            replyText: `Got it! 🦊 I will remember: "${rawFact}". You can view or clear this anytime!`,
            actions: []
          };
        } else {
          return {
            matched: true,
            actionId: 'explain_feature',
            params: { feature: 'vibi_memory' },
            confidence: 0.95,
            safetyTier: SAFETY_TIERS.READ_ONLY,
            topic: 'memory',
            responseType: 'SHORT',
            replyText: 'I couldn\'t remember that because it contains restricted keywords or exceeds my memory limit. 🦊🛡️',
            actions: []
          };
        }
      }
    }

    // =========================================================================
    // STEP 1: CONTEXTUAL CONTINUITY & PRONOUN RESOLUTION
    // If the query contains reference words ("it", "fix it", "how does it work", "verify it")
    // =========================================================================
    const recentTopic = context.recentTopic || null;
    const isReferenceQuery =
      /\b(how do i fix (it|this)|how to fix (it|this)|fix (it|this)|why is (it|this) not working|test (it|this)|verify (it|this)|how does (it|this) work|tell me more about (it|this)|is (it|this) safe|is (it|this) secure|what about (it|this)|explain (it|this))\b/i.test(query) ||
      query === 'it' ||
      query === 'fix it' ||
      query === 'test it' ||
      query === 'verify it' ||
      query === 'is it safe' ||
      query === 'how does it work';

    if (isReferenceQuery && recentTopic) {
      if (recentTopic === 'e2ee') {
        if (query.includes('fix') || query.includes('not working')) {
          return {
            matched: true,
            isQuickAction: true,
            actionId: 'reconnect_network',
            params: {},
            replyText: "🔒 Resyncing your real-time socket connection to restore encrypted message delivery! ⚡",
            responseType: 'STEP_BY_STEP',
            topic: 'e2ee'
          };
        }
        return {
          matched: true,
          isQuickAction: true,
          actionId: 'explain_feature',
          params: { topic: 'e2ee' },
          replyText: "🔒 **End-to-End Encryption (E2EE) Deep Dive**:\n\nVibeGrid uses the Signal protocol architecture with **AES-256-GCM** authenticated cipher. Your keys never leave your device. When you send a message, it is encrypted locally on your phone/browser before transmission. The server acts purely as an encrypted postbox and cannot read or decrypt the contents.\n\nTo verify: open any DM and click the shield icon 🛡️ to view verified fingerprint key hashes!",
          responseType: 'DETAILED',
          topic: 'e2ee'
        };
      }

      if (recentTopic === 'calls') {
        return {
          matched: true,
          isQuickAction: true,
          actionId: 'run_diagnostics',
          params: { category: 'calls' },
          replyText: "📞 **WebRTC Call Troubleshooting & Setup**:\n\n1. Checking microphone & camera device permissions.\n2. Verifying UDP/STUN server connectivity.\n3. Testing peer signaling socket status.\n\nRunning audio/video call diagnostic now! 🦊📹",
          responseType: 'STEP_BY_STEP',
          topic: 'calls'
        };
      }

      if (recentTopic === 'notifications') {
        return {
          matched: true,
          isQuickAction: true,
          actionId: 'run_diagnostics',
          params: { category: 'notifications' },
          replyText: "🔔 **Notification Diagnostic Checklist**:\n\n1. Verifying browser Notification permission status.\n2. Testing service worker push registration.\n3. Verifying in-app sound and banner alert dispatch.\n\nRunning notification diagnostic now! 🦊",
          responseType: 'STEP_BY_STEP',
          topic: 'notifications'
        };
      }

      if (recentTopic === 'messages') {
        return {
          matched: true,
          isQuickAction: true,
          actionId: 'run_diagnostics',
          params: { category: 'messages' },
          replyText: "Let me check your real-time connectivity and socket status! ⚡",
          responseType: 'STEP_BY_STEP',
          topic: 'messages'
        };
      }

      if (recentTopic === 'storage' || recentTopic === 'cache') {
        return {
          matched: true,
          isQuickAction: true,
          actionId: 'clear_temporary_cache',
          params: {},
          replyText: "Clearing temporary cache while keeping your chats and encryption keys safe! 🧹",
          responseType: 'SHORT',
          topic: 'storage'
        };
      }
    }

    // =========================================================================
    // STEP 2: AMBIGUITY DETECTION & CLARIFICATION PROMPTING
    // =========================================================================
    const isAmbiguousSettings = /^(go to|show|open|view|switch to)?\s*(settings|preferences)$/i.test(query) || query === 'settings' || query === 'options';
    if (isAmbiguousSettings) {
      return {
        matched: true,
        isClarification: true,
        clarificationKey: 'which_settings',
        actionId: 'navigate',
        params: { tab: 'settings' },
        replyText: "Which settings would you like to explore? 🦊⚙️\n- **Privacy & Permissions**\n- **Appearance & Themes**\n- **Notification Preferences**\n- **Vibi Assistant**\n\nOr say *\"all settings\"* to open the main settings screen.",
        responseType: 'NORMAL',
        topic: 'settings'
      };
    }

    const isAmbiguousTrouble =
      /^(it('?s)? not working|something is broken|broken|help me fix( it)?|fix it|not working)$/i.test(query) &&
      !recentTopic;
    if (isAmbiguousTrouble) {
      return {
        matched: true,
        isClarification: true,
        clarificationKey: 'which_diagnostic',
        topic: 'troubleshoot',
        replyText: "I'd love to help troubleshoot! 🦊🔧 Which area is having an issue?\n- **Messages** (socket connection & chat delivery)\n- **Notifications** (push & alert permissions)\n- **Calls & Audio** (WebRTC, mic & camera)\n- **Storage & Cache** (local storage and memory)\n- **Photo Uploads** (file size and formats)",
        responseType: 'NORMAL'
      };
    }

    // 1. Navigation: Specific Settings Sections
    if (query.includes('privacy setting') || query.includes('privacy & permission')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'settings', section: 'privacy' },
        replyText: "Taking you directly to **Privacy & Permissions** settings! 🛡️",
        responseType: 'SHORT',
        topic: 'settings'
      };
    }
    if (query.includes('vibi setting') || query.includes('assistant setting')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'settings', section: 'vibi' },
        replyText: "Opening **Vibi Assistant** settings for you! 🦊⚙️",
        responseType: 'SHORT',
        topic: 'vibi'
      };
    }
    if (query.includes('theme setting') || query.includes('appearance setting')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'settings', section: 'appearance' },
        replyText: "Opening **Appearance & Themes** settings! 🎨",
        responseType: 'SHORT',
        topic: 'theme'
      };
    }
    if (query.includes('notification setting')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'settings', section: 'notifications' },
        replyText: "Taking you to **Notification Preferences**! 🔔",
        responseType: 'SHORT',
        topic: 'notifications'
      };
    }

    // =========================================================================
    // STEP 2.5: PARAMETER EXTRACTION & SEMANTIC SEARCH ROUTING
    // Extract user handles (@handle), search queries, and themes from natural language
    // =========================================================================

    // Parameter Extraction: Search Queries ("search for dogs", "find #vibegrid", "lookup photo")
    const searchQuery = this.extractSearchQuery(text);
    if (searchQuery) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'explore', query: searchQuery },
        replyText: `Searching VibeGrid for "${searchQuery}" on Explore! 🔍`,
        confidence: 0.92,
        responseType: 'SHORT',
        topic: 'search'
      };
    }

    // Parameter Extraction: User Handles (@username)
    const userHandle = this.extractUserHandle(text);
    if (userHandle && (query.includes('find') || query.includes('search') || query.includes('view') || query.includes('open') || query.includes('profile') || query.includes('user'))) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'explore', query: `@${userHandle}` },
        replyText: `Looking up profile for **@${userHandle}**! 👤`,
        confidence: 0.92,
        responseType: 'SHORT',
        topic: 'navigation'
      };
    }

    // Parameter Extraction: Direct Theme Switching ("set theme to cyberpunk", "switch theme to sunset")
    const extractedTheme = this.extractTheme(text);
    if (extractedTheme && (query.includes('theme') || query.includes('mode') || query.includes('appearance') || query.includes('switch') || query.includes('change') || query.includes('set'))) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'toggle_theme',
        params: { theme: extractedTheme },
        replyText: `Switched appearance to **${extractedTheme.toUpperCase()}** theme! 🎨`,
        confidence: 0.95,
        responseType: 'SHORT',
        topic: 'theme'
      };
    }

    // =========================================================================
    // STEP 2.6: MEDIUM CONFIDENCE SUGGESTION ROUTING (0.50 - 0.84)
    // Suggest actions with interactive confirmation chips rather than taking speculative action
    // =========================================================================
    if ((query === 'change theme' || query === 'switch theme' || query === 'change appearance' || query.includes('can you change theme') || query.includes('what themes')) && !extractedTheme) {
      return {
        matched: true,
        isSuggestion: true,
        confidence: 0.70,
        replyText: "I can switch themes for you! Choose a style below or tell me your favorite: 🎨",
        actions: [
          { id: 'toggle_theme', params: { theme: 'dark' }, label: '🌙 Dark Mode' },
          { id: 'toggle_theme', params: { theme: 'light' }, label: '☀️ Light Mode' },
          { id: 'toggle_theme', params: { theme: 'cyberpunk' }, label: '⚡ Cyberpunk' }
        ],
        responseType: 'SHORT',
        topic: 'theme'
      };
    }

    if (query.includes('show some posts') || query.includes('show posts') || query.includes('want to browse') || query === 'show me something') {
      return {
        matched: true,
        isSuggestion: true,
        confidence: 0.75,
        actionId: 'navigate',
        params: { tab: 'feed' },
        replyText: "Would you like to head to your Feed to browse latest updates and stories? 📰",
        actions: [
          { id: 'navigate', params: { tab: 'feed' }, label: '🏠 Go to Feed' }
        ],
        responseType: 'SHORT',
        topic: 'navigation'
      };
    }

    if (query.includes('do i have alerts') || query.includes('any alerts') || query.includes('check alerts')) {
      return {
        matched: true,
        isSuggestion: true,
        confidence: 0.80,
        actionId: 'open_modal',
        params: { modal: 'notifications' },
        replyText: "Would you like me to open your notification center? 🔔",
        actions: [
          { id: 'open_modal', params: { modal: 'notifications' }, label: '🔔 Open Notifications' }
        ],
        responseType: 'SHORT',
        topic: 'notifications'
      };
    }

    // 2. Navigation: Primary Tabs
    if (/^(go to|show|open|view|switch to)?\s*(feed|home|posts)$/i.test(query) || query === 'feed' || query === 'home') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'feed' },
        replyText: "Switched to your **Feed**! 🏠",
        responseType: 'SHORT',
        topic: 'navigation'
      };
    }
    if (/^(go to|show|open|view|switch to)?\s*(explore|discover|trending)$/i.test(query) || query === 'explore' || query.includes('explore') || query.includes('trend')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'explore' },
        replyText: "Hey! I'm Vibi! Heading over to **Explore**! 🧭",
        responseType: 'SHORT',
        topic: 'navigation'
      };
    }
    if (/^(go to|show|open|view|switch to)?\s*(messages|chats|dms|direct messages)$/i.test(query) || query === 'messages' || query === 'dms') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'messages' },
        replyText: "Opening your **Direct & Group Messages**! 💬",
        responseType: 'SHORT',
        topic: 'messages'
      };
    }
    if (/^(go to|show|open|view|switch to)?\s*(my profile|profile)$/i.test(query) || query === 'profile') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'profile' },
        replyText: "Opening your **Profile**! 👤",
        responseType: 'SHORT',
        topic: 'navigation'
      };
    }

    // 3. Modals & Quick Dialogs
    if (query.includes('create post') || query.includes('new post') || query.includes('post photo') || query === 'create') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'open_modal',
        params: { modal: 'create_post' },
        replyText: "Opening **Create Post** modal for you! 📸",
        responseType: 'SHORT',
        topic: 'posts'
      };
    }
    if (query.includes('call history') || query.includes('recent call') || query === 'calls') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'open_modal',
        params: { modal: 'call_history' },
        replyText: "Opening your **Call History**! 📞",
        responseType: 'SHORT',
        topic: 'calls'
      };
    }
    if (query.includes('notification') && (query.includes('show') || query.includes('open') || query.includes('check'))) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'open_modal',
        params: { modal: 'notifications' },
        replyText: "Opening your **Notifications**! 🔔",
        responseType: 'SHORT',
        topic: 'notifications'
      };
    }

    // 4. Themes & Appearance Shortcuts
    if (query.includes('dark mode') || query === 'dark theme') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'toggle_theme',
        params: { theme: 'dark' },
        replyText: "Switched to **Dark Theme**! 🌙",
        responseType: 'SHORT',
        topic: 'theme'
      };
    }
    if (query.includes('light mode') || query === 'light theme') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'toggle_theme',
        params: { theme: 'light' },
        replyText: "Switched to **Light Theme**! ☀️",
        responseType: 'SHORT',
        topic: 'theme'
      };
    }
    if (query.includes('cyberpunk') || query.includes('oled') || query.includes('nordic') || query.includes('synthwave')) {
      const matchedTheme = ['cyberpunk', 'oled', 'nordic', 'synthwave'].find((t) => query.includes(t));
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'toggle_theme',
        params: { theme: matchedTheme },
        replyText: `Switched appearance to **${matchedTheme.toUpperCase()}** theme! 🎨`,
        responseType: 'SHORT',
        topic: 'theme'
      };
    }

    // 5. Sound Effects Shortcuts
    if (query.includes('mute sound') || query.includes('disable audio') || query.includes('turn off sound')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'toggle_sound',
        params: { enabled: false },
        replyText: "Muted in-app Web Audio sound effects! 🔇",
        responseType: 'SHORT',
        topic: 'sound'
      };
    }
    if (query.includes('unmute sound') || query.includes('enable audio') || query.includes('turn on sound')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'toggle_sound',
        params: { enabled: true },
        replyText: "Enabled in-app Web Audio sound effects! 🎵",
        responseType: 'SHORT',
        topic: 'sound'
      };
    }

    // 6. Scroll to Top
    if (query === 'top' || query === 'scroll top' || query === 'scroll to top') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'scroll_top',
        params: {},
        replyText: "Scrolled back to the top! ⬆️",
        responseType: 'SHORT',
        topic: 'navigation'
      };
    }

    // 7. Clear Conversation
    if (query.includes('clear chat') || query.includes('clear conversation') || query.includes('reset chat')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'clear_vibi_chat',
        params: {},
        replyText: "Are you sure you want to clear your conversation with Vibi? 🧹",
        responseType: 'SHORT',
        topic: 'vibi'
      };
    }

    // 8. Informational & Feature Explanations
    if (query.includes('what is e2ee') || query.includes('end-to-end encryption') || query.includes('how encryption works')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'explain_feature',
        params: { topic: 'e2ee' },
        replyText: "🔒 **End-to-End Encryption (E2EE) in VibeGrid**:\n\nAll your direct 1-on-1 messages are encrypted using military-grade **AES-256-GCM** keys generated right on your device. The VibeGrid server cannot read your messages, and neither can I! Only you and your chat partner hold the decryption keys. 🛡️✨\n\nTo verify: open any direct message chat and look for the verified shield icon in the header.",
        responseType: 'DETAILED',
        topic: 'e2ee'
      };
    }
    if (query.includes('how do calls work') || query.includes('video call') || query.includes('webrtc')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'explain_feature',
        params: { topic: 'calls' },
        replyText: "📞 **WebRTC Encrypted Calls**:\n\nVibeGrid provides crystal-clear peer-to-peer audio and video calls. Signaling is securely authenticated, and audio/video streams flow directly between participants with zero media recording or eavesdropping! 🦊📹",
        responseType: 'DETAILED',
        topic: 'calls'
      };
    }
    if (query.includes('app status') || query.includes('status') || query.includes('is online')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'get_app_status',
        params: {},
        replyText: "Checking VibeGrid status...",
        responseType: 'SHORT',
        topic: 'status'
      };
    }

    // 9. Troubleshooting & Self-Healing (Phase 8)
    if (query.includes('clear cache') || query.includes('clean cache')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'clear_temporary_cache',
        params: {},
        replyText: "Clearing temporary cache while keeping your chats and encryption keys safe! 🧹",
        responseType: 'SHORT',
        topic: 'storage'
      };
    }

    if (query.includes('reconnect') || query.includes('reconnect socket')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'reconnect_network',
        params: {},
        replyText: "Re-establishing real-time connection right now! ⚡",
        responseType: 'STEP_BY_STEP',
        topic: 'network'
      };
    }

    if (query.includes('message') && (query.includes('load') || query.includes('stuck') || query.includes('send') || query.includes('work') || query.includes('not loading'))) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'run_diagnostics',
        params: { category: 'messages' },
        replyText: "Let me check your real-time connectivity and socket status! ⚡",
        responseType: 'STEP_BY_STEP',
        topic: 'messages'
      };
    }

    if (query.includes('notification') && (query.includes('work') || query.includes('fix') || query.includes('test') || query.includes('receive') || query.includes('not working') || query.includes('blocked'))) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'run_diagnostics',
        params: { category: 'notifications' },
        replyText: "Checking browser notification permissions and delivery status for you! 🔔",
        responseType: 'STEP_BY_STEP',
        topic: 'notifications'
      };
    }

    if ((query.includes('call') || query.includes('mic') || query.includes('camera') || query.includes('webrtc')) && (query.includes('connect') || query.includes('work') || query.includes('test') || query.includes('fail') || query.includes('not connecting'))) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'run_diagnostics',
        params: { category: 'calls' },
        replyText: "Testing WebRTC calling capabilities, microphone, and camera access! 📞",
        responseType: 'STEP_BY_STEP',
        topic: 'calls'
      };
    }

    if (query.includes('slow') || query.includes('lag') || query.includes('freeze') || query.includes('speed') || query.includes('storage') || query.includes('feels slow')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'run_diagnostics',
        params: { category: 'storage' },
        replyText: "Checking local storage usage and temporary cache size! 🚀",
        responseType: 'STEP_BY_STEP',
        topic: 'storage'
      };
    }

    if ((query.includes('upload') || query.includes('photo') || query.includes('image')) && (query.includes('cant') || query.includes("can't") || query.includes('fail') || query.includes('error') || query.includes('limit') || query.includes('not uploading'))) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'run_diagnostics',
        params: { category: 'uploads' },
        replyText: "Here are the image upload requirements and diagnostic limits! 📸",
        responseType: 'STEP_BY_STEP',
        topic: 'uploads'
      };
    }

    if (query.includes('troubleshoot') || query.includes('diagnos') || query.includes('health check') || query.includes('self heal') || query.includes('fix problem')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'run_diagnostics',
        params: { category: 'all' },
        replyText: "Running a full VibeGrid system health diagnostic check! 🦊🔧",
        responseType: 'STEP_BY_STEP',
        topic: 'diagnostics'
      };
    }

    // 10. Vibi Mascot Help & Intro
    if (query === 'help' || query.includes('what can you do') || query.includes('who are you') || query === 'hi' || query === 'hello') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'explain_feature',
        params: { topic: 'vibi' },
        replyText: "Hi! I'm **Vibi**, your native VibeGrid AI companion! 🦊👋\n\nI can help you navigate screens, switch themes, check notifications, adjust settings, and explain privacy features. Try asking me:\n- *\"Go to Explore\"*\n- *\"Open Privacy Settings\"*\n- *\"Change theme to Dark\"*\n- *\"What is E2EE?\"*",
        responseType: 'NORMAL',
        topic: 'vibi'
      };
    }

    return { matched: false };
  }

  /**
   * Deterministically detect user intent and assign confidence score
   * @param {string} text - User message input
   * @param {Object} [context={}] - Runtime app context
   * @param {Object} [options={}] - Internal routing options
   * @returns {{ matched: boolean, actionId?: string, params?: Object, replyText?: string, isQuickAction?: boolean, confidence: number, actions?: Array, isComposite?: boolean, isSuggestion?: boolean }}
   */
  detectIntent(text = '', context = {}, options = {}) {
    const res = this._matchIntent(text, context, options);
    if (!res) {
      return { matched: false, confidence: 0.20 };
    }
    if (!res.matched) {
      return {
        ...res,
        confidence: res.confidence !== undefined ? res.confidence : 0.20
      };
    }
    return {
      ...res,
      confidence: res.confidence !== undefined ? res.confidence : 0.95
    };
  }

  /**
   * Execute an intent securely through the validator and action registry
   * @param {Object} intent
   * @param {Object} [context={}]
   * @param {Object} [callbacks={}]
   * @param {string} [username='anonymous']
   * @param {Object} [options={}] - Execution options (e.g. { confirmed: true })
   * @returns {Promise<Object>} Execution result
   */
  async executeIntent(intent, context = {}, callbacks = {}, username = 'anonymous', options = {}) {
    if (!intent || !intent.actionId) {
      this.setExecutionState(EXECUTION_STATES.IDLE);
      return {
        success: false,
        state: EXECUTION_STATES.FAILED,
        error: 'no_action: No action specified to execute.'
      };
    }

    const startTime = Date.now();

    // Step 0: Composite Execution handling
    if (intent.isComposite && intent.secondaryIntent && intent.secondaryIntent.actionId) {
      this.setExecutionState(EXECUTION_STATES.EXECUTING);
      const primaryRes = await this.executeIntent(
        intent.primaryIntent || { actionId: intent.actionId, params: intent.params },
        context,
        callbacks,
        username,
        options
      );
      if (primaryRes.requiresConfirmation) {
        this.setExecutionState(EXECUTION_STATES.AWAITING_CONFIRMATION);
        return primaryRes;
      }
      const secondaryRes = await this.executeIntent(
        intent.secondaryIntent,
        context,
        callbacks,
        username,
        options
      );
      const durationMs = Date.now() - startTime;
      const isSuccess = Boolean(primaryRes.success && secondaryRes.success);
      this.setExecutionState(isSuccess ? EXECUTION_STATES.SUCCESS : EXECUTION_STATES.FAILED);

      return {
        success: isSuccess,
        isComposite: true,
        state: this.executionState,
        durationMs,
        primaryResult: primaryRes,
        secondaryResult: secondaryRes,
        safetyTier: primaryRes.safetyTier || secondaryRes.safetyTier || SAFETY_TIERS.READ_ONLY,
        message: `${primaryRes.message || 'Step 1 completed.'} Then: ${secondaryRes.message || 'Step 2 completed.'}`,
        replyText: intent.replyText || `${primaryRes.replyText || primaryRes.message} Then: ${secondaryRes.replyText || secondaryRes.message}`,
        responseType: 'STEP_BY_STEP'
      };
    }

    const { actionId, params = {}, replyText = '' } = intent;

    // Step 1: AI Output / Tool-Call Validator
    this.setExecutionState(EXECUTION_STATES.VALIDATING);
    const validation = vibiOutputValidator.validateAction(actionId, params, options);
    if (!validation.valid) {
      this.setExecutionState(EXECUTION_STATES.FAILED);
      vibiAuditLog.logAction({
        actionId,
        category: 'unknown',
        status: 'rejected',
        failureReason: validation.error,
        durationMs: Date.now() - startTime,
        username
      });
      return {
        success: false,
        rejected: true,
        state: EXECUTION_STATES.FAILED,
        error: validation.error,
        replyText: `⚠️ Action could not be executed: ${validation.error}`
      };
    }

    const { action, sanitizedParams, safetyTier, pendingConfirmation } = validation;

    // Step 2: Confirmation Guard
    if (pendingConfirmation) {
      this.setExecutionState(EXECUTION_STATES.AWAITING_CONFIRMATION);
      vibiAuditLog.logAction({
        actionId,
        category: action.category,
        safetyTier,
        status: 'pending_confirmation',
        durationMs: Date.now() - startTime,
        username
      });
      return {
        success: true,
        requiresConfirmation: true,
        state: EXECUTION_STATES.AWAITING_CONFIRMATION,
        actionId,
        sanitizedParams,
        safetyTier,
        actionName: action.name || actionId,
        description: action.description || '',
        responseType: intent.responseType || 'SHORT',
        topic: intent.topic || null,
        replyText: replyText || `Please confirm: Do you want to execute **${action.name}**?`
      };
    }

    // Step 2.5: Replay Guard for Mutating / Destructive actions
    if ((safetyTier === SAFETY_TIERS.STATE_MUTATING || safetyTier === SAFETY_TIERS.DESTRUCTIVE) && !options.bypassReplayGuard) {
      const allowed = this._checkReplayGuard(actionId, sanitizedParams, username);
      if (!allowed) {
        this.setExecutionState(EXECUTION_STATES.IDLE);
        return {
          success: false,
          isDuplicate: true,
          state: EXECUTION_STATES.IDLE,
          message: 'Duplicate action suppressed by replay guard.',
          replyText: 'Action already recently executed! 🦊⏳'
        };
      }
    }

    // Step 3: State transition to EXECUTING with Timeout Guard
    this.setExecutionState(EXECUTION_STATES.EXECUTING);
    const timeoutMs = options.timeoutMs || 5000;

    try {
      const handlerPromise = action.handler(sanitizedParams, context, callbacks);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`action_timeout: Handler timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      const result = await Promise.race([handlerPromise, timeoutPromise]);
      const durationMs = Date.now() - startTime;
      const isSuccess = result?.success !== false;
      this.setExecutionState(isSuccess ? EXECUTION_STATES.SUCCESS : EXECUTION_STATES.FAILED);

      vibiAuditLog.logAction({
        actionId,
        category: action.category,
        safetyTier,
        status: isSuccess ? 'success' : 'failed',
        failureReason: isSuccess ? null : result?.message,
        durationMs,
        username
      });

      if (isSuccess) {
        vibiCharacterService.success();
      } else {
        vibiCharacterService.error();
      }

      vibiContextService.recordRecentAction(actionId, sanitizedParams, isSuccess ? 'success' : 'failed');

      return {
        success: isSuccess,
        state: this.executionState,
        durationMs,
        actionId,
        message: replyText || result?.message,
        data: result,
        explanation: result?.explanation || null,
        safetyTier,
        responseType: intent.responseType || 'SHORT',
        topic: intent.topic || null,
        replyText: result?.explanation ? `${replyText}\n\n${result.explanation}` : (replyText || result?.summary || result?.message)
      };
    } catch (err) {
      const isTimeout = err.message?.includes('action_timeout');
      this.setExecutionState(isTimeout ? EXECUTION_STATES.TIMED_OUT : EXECUTION_STATES.FAILED);
      vibiCharacterService.error();

      const durationMs = Date.now() - startTime;
      vibiAuditLog.logAction({
        actionId,
        category: action.category,
        safetyTier,
        status: 'failed',
        failureReason: err.message,
        durationMs,
        username
      });

      vibiContextService.recordRecentAction(actionId, sanitizedParams, 'failed');

      return {
        success: false,
        state: this.executionState,
        durationMs,
        error: err.message,
        replyText: `⚠️ An error occurred while executing ${action.name}: ${err.message}`
      };
    } finally {
      this.setExecutionState(EXECUTION_STATES.IDLE);
    }
  }

  /**
   * Convenience alias to execute an action directly by actionId and params
   */
  async executeAction(actionId, params = {}, context = {}, callbacks = {}, username = 'anonymous', options = {}) {
    return this.executeIntent({ actionId, params }, context, callbacks, username, options);
  }
}

const vibiIntentEngine = new VibiIntentEngine();
export default vibiIntentEngine;

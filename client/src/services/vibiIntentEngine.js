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
import vibiOutputValidator from './vibiOutputValidator';
import vibiAuditLog from './vibiAuditLog';
import vibiCharacterService from './vibiCharacterService';

export class VibiIntentEngine {
  /**
   * Deterministically detect user intent from natural text
   * @param {string} text - User message input
   * @param {Object} [context={}] - Runtime app context
   * @returns {{ matched: boolean, actionId?: string, params?: Object, replyText?: string, isQuickAction?: boolean }}
   */
  detectIntent(text = '', context = {}) {
    if (!text || typeof text !== 'string') {
      return { matched: false };
    }

    const query = text.trim().toLowerCase();

    // =========================================================================
    // STEP 0: CLARIFICATION ANSWER RESOLUTION
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
      return {
        success: false,
        error: 'no_action: No action specified to execute.'
      };
    }

    const { actionId, params = {}, replyText = '' } = intent;

    // Step 1: AI Output / Tool-Call Validator
    const validation = vibiOutputValidator.validateAction(actionId, params, options);
    if (!validation.valid) {
      vibiAuditLog.logAction({
        actionId,
        category: 'unknown',
        status: 'rejected',
        failureReason: validation.error,
        username
      });
      return {
        success: false,
        rejected: true,
        error: validation.error,
        replyText: `⚠️ Action could not be executed: ${validation.error}`
      };
    }

    const { action, sanitizedParams, pendingConfirmation } = validation;

    // Step 2: Confirmation Guard
    if (pendingConfirmation) {
      vibiAuditLog.logAction({
        actionId,
        category: action.category,
        status: 'pending_confirmation',
        username
      });
      return {
        success: true,
        requiresConfirmation: true,
        actionId,
        sanitizedParams,
        actionName: action.name || actionId,
        description: action.description || '',
        responseType: intent.responseType || 'SHORT',
        topic: intent.topic || null,
        replyText: replyText || `Please confirm: Do you want to execute **${action.name}**?`
      };
    }

    // Step 3: Execute Action
    try {
      const result = await action.handler(sanitizedParams, context, callbacks);

      vibiAuditLog.logAction({
        actionId,
        category: action.category,
        status: result.success ? 'success' : 'failed',
        failureReason: result.success ? null : result.message,
        username
      });

      if (result.success) {
        vibiCharacterService.success();
      } else {
        vibiCharacterService.error();
      }

      return {
        success: Boolean(result.success),
        message: replyText || result.message,
        data: result,
        explanation: result.explanation || null,
        responseType: intent.responseType || 'SHORT',
        topic: intent.topic || null,
        replyText: result.explanation ? `${replyText}\n\n${result.explanation}` : (replyText || result.summary || result.message)
      };
    } catch (err) {
      vibiCharacterService.error();

      vibiAuditLog.logAction({
        actionId,
        category: action.category,
        status: 'failed',
        failureReason: err.message,
        username
      });

      return {
        success: false,
        error: err.message,
        replyText: `⚠️ An error occurred while executing ${action.name}: ${err.message}`
      };
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

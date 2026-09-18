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

    // 1. Navigation: Specific Settings Sections
    if (query.includes('privacy setting') || query.includes('privacy & permission')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'settings', section: 'privacy' },
        replyText: "Taking you directly to **Privacy & Permissions** settings! 🛡️"
      };
    }
    if (query.includes('vibi setting') || query.includes('assistant setting')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'settings', section: 'vibi' },
        replyText: "Opening **Vibi Assistant** settings for you! 🦊⚙️"
      };
    }
    if (query.includes('theme setting') || query.includes('appearance setting')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'settings', section: 'appearance' },
        replyText: "Opening **Appearance & Themes** settings! 🎨"
      };
    }
    if (query.includes('notification setting')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'settings', section: 'notifications' },
        replyText: "Taking you to **Notification Preferences**! 🔔"
      };
    }

    // 2. Navigation: Primary Tabs
    if (/^(go to|show|open|view|switch to)?\s*(feed|home|posts)$/i.test(query) || query === 'feed' || query === 'home') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'feed' },
        replyText: "Switched to your **Feed**! 🏠"
      };
    }
    if (/^(go to|show|open|view|switch to)?\s*(explore|discover|trending)$/i.test(query) || query === 'explore' || query.includes('explore') || query.includes('trend')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'explore' },
        replyText: "Hey! I'm Vibi! Heading over to **Explore**! 🧭"
      };
    }
    if (/^(go to|show|open|view|switch to)?\s*(messages|chats|dms|direct messages)$/i.test(query) || query === 'messages' || query === 'dms') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'messages' },
        replyText: "Opening your **Direct & Group Messages**! 💬"
      };
    }
    if (/^(go to|show|open|view|switch to)?\s*(my profile|profile)$/i.test(query) || query === 'profile') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'profile' },
        replyText: "Opening your **Profile**! 👤"
      };
    }
    if (/^(go to|show|open|view|switch to)?\s*(settings|preferences)$/i.test(query) || query === 'settings') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'navigate',
        params: { tab: 'settings' },
        replyText: "Navigating to **Settings & Privacy**! ⚙️"
      };
    }

    // 3. Modals & Quick Dialogs
    if (query.includes('create post') || query.includes('new post') || query.includes('post photo') || query === 'create') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'open_modal',
        params: { modal: 'create_post' },
        replyText: "Opening **Create Post** modal for you! 📸"
      };
    }
    if (query.includes('call history') || query.includes('recent call') || query === 'calls') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'open_modal',
        params: { modal: 'call_history' },
        replyText: "Opening your **Call History**! 📞"
      };
    }
    if (query.includes('notification') && (query.includes('show') || query.includes('open') || query.includes('check'))) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'open_modal',
        params: { modal: 'notifications' },
        replyText: "Opening your **Notifications**! 🔔"
      };
    }

    // 4. Themes & Appearance Shortcuts
    if (query.includes('dark mode') || query === 'dark theme') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'toggle_theme',
        params: { theme: 'dark' },
        replyText: "Switched to **Dark Theme**! 🌙"
      };
    }
    if (query.includes('light mode') || query === 'light theme') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'toggle_theme',
        params: { theme: 'light' },
        replyText: "Switched to **Light Theme**! ☀️"
      };
    }
    if (query.includes('cyberpunk') || query.includes('oled') || query.includes('nordic') || query.includes('synthwave')) {
      const matchedTheme = ['cyberpunk', 'oled', 'nordic', 'synthwave'].find((t) => query.includes(t));
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'toggle_theme',
        params: { theme: matchedTheme },
        replyText: `Switched appearance to **${matchedTheme.toUpperCase()}** theme! 🎨`
      };
    }

    // 5. Sound Effects Shortcuts
    if (query.includes('mute sound') || query.includes('disable audio') || query.includes('turn off sound')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'toggle_sound',
        params: { enabled: false },
        replyText: "Muted in-app Web Audio sound effects! 🔇"
      };
    }
    if (query.includes('unmute sound') || query.includes('enable audio') || query.includes('turn on sound')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'toggle_sound',
        params: { enabled: true },
        replyText: "Enabled in-app Web Audio sound effects! 🎵"
      };
    }

    // 6. Scroll to Top
    if (query === 'top' || query === 'scroll top' || query === 'scroll to top') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'scroll_top',
        params: {},
        replyText: "Scrolled back to the top! ⬆️"
      };
    }

    // 7. Clear Conversation
    if (query.includes('clear chat') || query.includes('clear conversation') || query.includes('reset chat')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'clear_vibi_chat',
        params: {},
        replyText: "Are you sure you want to clear your conversation with Vibi? 🧹"
      };
    }

    // 8. Informational & Feature Explanations
    if (query.includes('what is e2ee') || query.includes('end-to-end encryption') || query.includes('how encryption works')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'explain_feature',
        params: { topic: 'e2ee' },
        replyText: "Here's how End-to-End Encryption works on VibeGrid:"
      };
    }
    if (query.includes('how do calls work') || query.includes('video call') || query.includes('webrtc')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'explain_feature',
        params: { topic: 'calls' },
        replyText: "Here is how VibeGrid calls work:"
      };
    }
    if (query.includes('app status') || query.includes('status') || query.includes('is online')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'get_app_status',
        params: {},
        replyText: "Checking VibeGrid status..."
      };
    }

    // 9. Troubleshooting & Self-Healing (Phase 8)
    if (query.includes('clear cache') || query.includes('clean cache')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'clear_temporary_cache',
        params: {},
        replyText: "Clearing temporary cache while keeping your chats and encryption keys safe! 🧹"
      };
    }

    if (query.includes('reconnect') || query.includes('reconnect socket')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'reconnect_network',
        params: {},
        replyText: "Re-establishing real-time connection right now! ⚡"
      };
    }

    if (query.includes('message') && (query.includes('load') || query.includes('stuck') || query.includes('send') || query.includes('work') || query.includes('not loading'))) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'run_diagnostics',
        params: { category: 'messages' },
        replyText: "Let me check your real-time connectivity and socket status! ⚡"
      };
    }

    if (query.includes('notification') && (query.includes('work') || query.includes('fix') || query.includes('test') || query.includes('receive') || query.includes('not working') || query.includes('blocked'))) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'run_diagnostics',
        params: { category: 'notifications' },
        replyText: "Checking browser notification permissions and delivery status for you! 🔔"
      };
    }

    if ((query.includes('call') || query.includes('mic') || query.includes('camera') || query.includes('webrtc')) && (query.includes('connect') || query.includes('work') || query.includes('test') || query.includes('fail') || query.includes('not connecting'))) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'run_diagnostics',
        params: { category: 'calls' },
        replyText: "Testing WebRTC calling capabilities, microphone, and camera access! 📞"
      };
    }

    if (query.includes('slow') || query.includes('lag') || query.includes('freeze') || query.includes('speed') || query.includes('storage') || query.includes('feels slow')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'run_diagnostics',
        params: { category: 'storage' },
        replyText: "Checking local storage usage and temporary cache size! 🚀"
      };
    }

    if ((query.includes('upload') || query.includes('photo') || query.includes('image')) && (query.includes('cant') || query.includes("can't") || query.includes('fail') || query.includes('error') || query.includes('limit') || query.includes('not uploading'))) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'run_diagnostics',
        params: { category: 'uploads' },
        replyText: "Here are the image upload requirements and diagnostic limits! 📸"
      };
    }

    if (query.includes('troubleshoot') || query.includes('diagnos') || query.includes('health check') || query.includes('self heal') || query.includes('fix problem')) {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'run_diagnostics',
        params: { category: 'all' },
        replyText: "Running a full VibeGrid system health diagnostic check! 🦊🔧"
      };
    }

    // 9. Vibi Mascot Help & Intro
    if (query === 'help' || query.includes('what can you do') || query.includes('who are you') || query === 'hi' || query === 'hello') {
      return {
        matched: true,
        isQuickAction: true,
        actionId: 'explain_feature',
        params: { topic: 'vibi' },
        replyText: "Hi! I'm **Vibi**, your native VibeGrid AI companion! 🦊👋\n\nI can help you navigate screens, switch themes, check notifications, adjust settings, and explain privacy features. Try asking me:\n- *\"Go to Explore\"*\n- *\"Open Privacy Settings\"*\n- *\"Change theme to Dark\"*\n- *\"What is E2EE?\"*"
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
   * @returns {Promise<Object>} Execution result
   */
  async executeIntent(intent, context = {}, callbacks = {}, username = 'anonymous') {
    if (!intent || !intent.actionId) {
      return {
        success: false,
        error: 'no_action: No action specified to execute.'
      };
    }

    const { actionId, params = {}, replyText = '' } = intent;

    // Step 1: AI Output / Tool-Call Validator
    const validation = vibiOutputValidator.validateAction(actionId, params);
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

      return {
        success: Boolean(result.success),
        message: replyText || result.message,
        data: result,
        explanation: result.explanation || null,
        replyText: result.explanation ? `${replyText}\n\n${result.explanation}` : (replyText || result.summary || result.message)
      };
    } catch (err) {
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
  async executeAction(actionId, params = {}, context = {}, callbacks = {}, username = 'anonymous') {
    return this.executeIntent({ actionId, params }, context, callbacks, username);
  }
}

const vibiIntentEngine = new VibiIntentEngine();
export default vibiIntentEngine;

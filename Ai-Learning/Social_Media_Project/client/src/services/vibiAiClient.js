/**
 * client/src/services/vibiAiClient.js
 * ====================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 6 AI CLIENT
 *
 * Responsibilities:
 * - Connects frontend Vibi conversation to backend /api/vibi/chat endpoint.
 * - Extracts and serializes minimized context safely.
 * - Enforces client-side timeout (10s).
 * - Routes all action proposals through VibiOutputValidator.
 * - Provides graceful offline / mock fallback if backend is momentarily unreachable.
 */

import { apiClient } from '../api/client.js';
import vibiContextService from './vibiContextService.js';
import vibiOutputValidator from './vibiOutputValidator.js';
import vibiSecurityGuard from './vibiSecurityGuard.js';

export class VibiAiClient {
  /**
   * Send a conversational query to Vibi AI backend
   * @param {string} message - User query text
   * @param {Object} [runtimeContext={}] - Runtime UI / session context
   * @returns {Promise<{ replyText: string, actionProposal: Object|null, provider: string, isFallback: boolean }>}
   */
  async sendChatMessage(message, runtimeContext = {}) {
    if (!message || typeof message !== 'string') {
      throw new Error('Message is required.');
    }

    const username = runtimeContext?.user?.username || 'anonymous';

    // 1. Prompt Injection & Adversarial Defense
    const safetyCheck = vibiSecurityGuard.checkPromptSafety(message, username);
    if (!safetyCheck.safe) {
      return {
        replyText: safetyCheck.friendlyReply,
        actionProposal: null,
        provider: 'client_security_guard',
        isFallback: true
      };
    }

    // 2. Sensitive Data Redaction
    const sanitizedMessage = vibiSecurityGuard.redactSensitiveData(message.trim());

    // 3. Gather and sanitize context
    const rawContextSnapshot = vibiContextService.getContextSnapshot(runtimeContext.user || null);
    const contextSnapshot = vibiSecurityGuard.sanitizeContext(rawContextSnapshot);

    const payload = {
      message: sanitizedMessage,
      context: {
        activeTab: contextSnapshot.currentTab || runtimeContext.currentTab || 'feed',
        activeSection: contextSnapshot.activeSection || runtimeContext.activeSection || null,
        theme: contextSnapshot.theme || 'dark',
        online: contextSnapshot.online !== false,
        soundEnabled: Boolean(runtimeContext.soundEnabled),
        device: contextSnapshot.device || 'web'
      }
    };

    try {
      const response = await apiClient.post('/vibi/chat', payload);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to receive response from Vibi AI.');
      }

      const { replyText, action, provider, isFallback } = response.data;

      // 2. Validate proposed action with VibiOutputValidator
      let actionProposal = null;
      if (action && action.id) {
        const validation = vibiOutputValidator.validateAction(action.id, action.params || {});
        if (validation.valid) {
          actionProposal = {
            id: action.id,
            params: validation.sanitizedParams,
            actionDef: validation.action,
            pendingConfirmation: validation.pendingConfirmation
          };
        } else {
          console.warn('[VibiAiClient] Discarded invalid AI tool action proposal:', validation.error);
        }
      }

      return {
        replyText: replyText || "I'm right here! 🦊",
        actionProposal,
        provider: provider || 'unknown',
        isFallback: Boolean(isFallback)
      };
    } catch (err) {
      console.warn('[VibiAiClient] Backend chat call error, using local fallback:', err.message);

      // Local graceful fallback when network fails or server is offline
      return this.getLocalFallbackResponse(message, payload.context);
    }
  }

  /**
   * Graceful client-side fallback if backend API is offline
   */
  getLocalFallbackResponse(message, context = {}) {
    const query = message.toLowerCase();
    let replyText = "I'm here to help you get the most out of VibeGrid! 🦊✨";
    let actionProposal = null;

    if (query.includes('explore') || query.includes('trend')) {
      replyText = "Hey! I'm Vibi! Heading over to **Explore** where you can discover trending hashtags and posts! 🧭";
      actionProposal = { id: 'navigate', params: { tab: 'explore' } };
    } else if (query.includes('setting')) {
      replyText = "Opening **Settings** for you right now! ⚙️";
      actionProposal = { id: 'navigate', params: { tab: 'settings' } };
    } else if (query.includes('theme') || query.includes('dark')) {
      replyText = "You can change themes under Settings > Appearance! 🎨";
      actionProposal = { id: 'navigate', params: { tab: 'settings', section: 'appearance' } };
    } else if (query.includes('e2ee') || query.includes('encrypt')) {
      replyText = "🔒 **End-to-End Encryption**: All your 1-on-1 chats are encrypted on your device using AES-256-GCM. Nobody else can read them!";
    } else if (query.includes('diagnostic') || query.includes('troubleshoot') || query.includes('fix') || query.includes('stuck') || query.includes('slow')) {
      replyText = "I can help diagnose connectivity, notifications, WebRTC calls, or storage right on your device! 🦊🔧";
      actionProposal = { id: 'run_diagnostics', params: {} };
    } else {
      replyText = `Hey! I'm Vibi, your native VibeGrid assistant. I can help you navigate screens, adjust settings, change themes, or explain privacy and calls! Try asking me:
- *"Go to Explore"* 🧭
- *"Open Privacy Settings"* 🛡️
- *"Change theme to Dark"* 🌙
- *"What is E2EE?"* 🔒`;
    }

    return {
      replyText,
      actionProposal,
      provider: 'client_offline_fallback',
      isFallback: true
    };
  }
}

const vibiAiClient = new VibiAiClient();
export default vibiAiClient;

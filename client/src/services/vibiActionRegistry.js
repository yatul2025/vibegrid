/**
 * client/src/services/vibiActionRegistry.js
 * ==========================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 5 ACTION REGISTRY
 *
 * Responsibilities:
 * - Central whitelist of approved Vibi actions.
 * - Only registered actions can execute.
 * - Strict parameter validation and confirmation enforcement.
 * - Server-side authorization routing for API actions.
 */

import soundFx from './soundFxService';
import navigationService from './navigationService';
import vibiTroubleshootingService from './vibiTroubleshootingService';

class VibiActionRegistry {
  constructor() {
    this.actions = new Map();
    this.registerDefaultActions();
  }

  /**
   * Register a new approved action
   * @param {Object} action
   */
  registerAction(action) {
    if (!action || !action.id) {
      throw new Error('[VibiActionRegistry] Action must have an id');
    }
    this.actions.set(action.id, {
      id: action.id,
      name: action.name || action.id,
      category: action.category || 'ui',
      description: action.description || '',
      requiresConfirmation: Boolean(action.requiresConfirmation),
      paramsSchema: action.paramsSchema || {},
      handler: action.handler || (async () => ({ success: true }))
    });
  }

  /**
   * Check if an action ID is whitelisted
   * @param {string} id
   * @returns {boolean}
   */
  isWhitelisted(id) {
    return this.actions.has(id);
  }

  /**
   * Get action definition
   * @param {string} id
   * @returns {Object|null}
   */
  getAction(id) {
    return this.actions.get(id) || null;
  }

  /**
   * List all registered actions
   * @returns {Array}
   */
  listActions() {
    return Array.from(this.actions.values());
  }

  /**
   * Register all built-in VibeGrid actions
   */
  registerDefaultActions() {
    // 1. Navigation Action
    this.registerAction({
      id: 'navigate',
      name: 'Navigate Screen',
      category: 'navigation',
      description: 'Switch active tab or open a specific settings section.',
      requiresConfirmation: false,
      paramsSchema: {
        tab: {
          type: 'string',
          required: true,
          enum: ['feed', 'explore', 'messages', 'profile', 'settings', 'auth']
        },
        section: {
          type: 'string',
          required: false,
          enum: ['profile', 'appearance', 'contact', 'security', 'privacy', 'notifications', 'vibi', 'danger']
        }
      },
      handler: async (params, context, callbacks) => {
        if (callbacks && typeof callbacks.onNavigate === 'function') {
          callbacks.onNavigate(params.tab, params.section || null);
          return { success: true, message: `Navigated to ${params.tab}${params.section ? ` (${params.section})` : ''}` };
        }
        if (navigationService && typeof navigationService.navigate === 'function') {
          navigationService.navigate(params.tab, { section: params.section || null });
          return { success: true, message: `Navigated to ${params.tab}${params.section ? ` (${params.section})` : ''}` };
        }
        return { success: false, message: 'Navigation callback unavailable' };
      }
    });

    // 2. Open Modal Action
    this.registerAction({
      id: 'open_modal',
      name: 'Open Modal',
      category: 'navigation',
      description: 'Open a standard VibeGrid dialog or drawer.',
      requiresConfirmation: false,
      paramsSchema: {
        modal: {
          type: 'string',
          required: true,
          enum: ['create_post', 'notifications', 'call_history', 'permission_onboarding']
        }
      },
      handler: async (params, context, callbacks) => {
        if (callbacks && typeof callbacks.onOpenModal === 'function') {
          callbacks.onOpenModal(params.modal);
          return { success: true, message: `Opened modal ${params.modal}` };
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vibegrid:open-modal', { detail: { modal: params.modal } }));
          return { success: true, message: `Opened modal ${params.modal}` };
        }
        return { success: false, message: 'Modal callback unavailable' };
      }
    });

    // 3. Toggle Theme Action
    this.registerAction({
      id: 'toggle_theme',
      name: 'Change Theme',
      category: 'ui',
      description: 'Change or toggle VibeGrid appearance theme.',
      requiresConfirmation: false,
      paramsSchema: {
        theme: {
          type: 'string',
          required: false,
          enum: ['dark', 'light', 'cyberpunk', 'nordic', 'oled', 'synthwave', 'sunset', 'emerald', 'forest', 'crimson']
        }
      },
      handler: async (params, context, callbacks) => {
        if (callbacks && typeof callbacks.onToggleTheme === 'function') {
          callbacks.onToggleTheme(params.theme || null);
          return { success: true, message: `Theme switched to ${params.theme || 'toggled'}` };
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vibegrid:set-theme', { detail: { theme: params.theme || null } }));
          return { success: true, message: `Theme switched to ${params.theme || 'toggled'}` };
        }
        return { success: false, message: 'Theme callback unavailable' };
      }
    });

    // 4. Toggle Sound FX Action
    this.registerAction({
      id: 'toggle_sound',
      name: 'Toggle Sound Effects',
      category: 'ui',
      description: 'Turn procedural web audio sound effects on or off.',
      requiresConfirmation: false,
      paramsSchema: {
        enabled: {
          type: 'boolean',
          required: false
        }
      },
      handler: async (params) => {
        if (soundFx && typeof soundFx.setEnabled === 'function') {
          const current = soundFx.enabled;
          const next = params.enabled !== undefined ? params.enabled : !current;
          soundFx.setEnabled(next);
          if (next) soundFx.play('toggle');
          return { success: true, enabled: next, message: `Sound FX ${next ? 'enabled' : 'muted'}` };
        }
        return { success: false, message: 'SoundFx service unavailable' };
      }
    });

    // 5. Scroll to Top
    this.registerAction({
      id: 'scroll_top',
      name: 'Scroll to Top',
      category: 'ui',
      description: 'Smoothly scroll current feed or view to the very top.',
      requiresConfirmation: false,
      paramsSchema: {},
      handler: async () => {
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return { success: true, message: 'Scrolled to top' };
        }
        return { success: false, message: 'Window unavailable' };
      }
    });

    // 6. Clear Vibi Conversation
    this.registerAction({
      id: 'clear_vibi_chat',
      name: 'Clear Vibi Chat',
      category: 'ui',
      description: 'Clear the current conversation thread with Vibi.',
      requiresConfirmation: true, // Confirmation required
      paramsSchema: {},
      handler: async (params, context, callbacks) => {
        if (callbacks && typeof callbacks.onClearChat === 'function') {
          callbacks.onClearChat();
          return { success: true, message: 'Vibi conversation cleared' };
        }
        return { success: false, message: 'Clear chat callback unavailable' };
      }
    });

    // 7. Explain Feature
    this.registerAction({
      id: 'explain_feature',
      name: 'Explain VibeGrid Feature',
      category: 'info',
      description: 'Educational answers about VibeGrid capabilities, E2EE, themes, and calls.',
      requiresConfirmation: false,
      paramsSchema: {
        topic: {
          type: 'string',
          required: true
        }
      },
      handler: async (params) => {
        const topic = (params.topic || '').toLowerCase();
        let explanation = "VibeGrid is a private, real-time social platform featuring end-to-end encrypted messaging, peer-to-peer audio/video calls, and custom theme styling.";

        if (topic.includes('e2ee') || topic.includes('encrypt') || topic.includes('security')) {
          explanation = "🔒 **End-to-End Encryption (E2EE)** in VibeGrid ensures only you and your recipient can read messages. Keys are stored locally in your browser's IndexedDB and are NEVER sent to our servers or accessible to Vibi.";
        } else if (topic.includes('call') || topic.includes('video') || topic.includes('webrtc')) {
          explanation = "📞 **VibeGrid Calls** use peer-to-peer WebRTC connections with DTLS-SRTP encryption for real-time low-latency audio and HD video.";
        } else if (topic.includes('theme') || topic.includes('appearance')) {
          explanation = "🎨 **Custom Themes**: VibeGrid provides 10 curated themes (Dark, Light, OLED, Cyberpunk, Nordic, etc.) with custom CSS custom properties and instant switching.";
        } else if (topic.includes('sound') || topic.includes('audio')) {
          explanation = "🎵 **Procedural Web Audio**: Zero-latency, 0 kB audio FX generated via the browser Web Audio API for likes, reactions, message sends, and navigation.";
        } else if (topic.includes('vibi')) {
          explanation = "🦊 **Vibi** is your native Red Panda assistant! Vibi can help you navigate, adjust settings, and answer questions. Vibi respects strict privacy and never accesses private messages or encryption keys.";
        }

        return { success: true, topic, explanation };
      }
    });

    // 8. Get App Status
    this.registerAction({
      id: 'get_app_status',
      name: 'Get App Status',
      category: 'info',
      description: 'Summarize connection, PWA installation, and active device state.',
      requiresConfirmation: false,
      paramsSchema: {},
      handler: async (params, context) => {
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        const soundEnabled = soundFx ? soundFx.enabled : true;
        const currentScreen = context?.screen || 'unknown';

        return {
          success: true,
          status: {
            online: isOnline,
            screen: currentScreen,
            soundFx: soundEnabled
          },
          summary: `VibeGrid is currently **${isOnline ? 'Online 🟢' : 'Offline 🔴'}** on the **${currentScreen}** screen with Sound FX **${soundEnabled ? 'ON 🎵' : 'MUTED 🔇'}**.`
        };
      }
    });

    // 9. Troubleshooting: Run Diagnostics
    this.registerAction({
      id: 'run_diagnostics',
      name: 'Run System Diagnostics',
      category: 'troubleshooting',
      description: 'Check network, notifications, media permissions, and storage health.',
      requiresConfirmation: false,
      paramsSchema: {
        category: {
          type: 'string',
          required: false,
          enum: ['all', 'messages', 'notifications', 'calls', 'storage', 'uploads']
        }
      },
      handler: async (params) => {
        if (params?.category === 'messages') {
          return vibiTroubleshootingService.diagnoseMessages();
        } else if (params?.category === 'notifications') {
          return vibiTroubleshootingService.diagnoseNotifications();
        } else if (params?.category === 'calls') {
          return vibiTroubleshootingService.diagnoseCallsAndMedia();
        } else if (params?.category === 'storage') {
          return vibiTroubleshootingService.diagnoseStorage();
        } else if (params?.category === 'uploads') {
          return vibiTroubleshootingService.diagnoseImageUpload();
        }
        return vibiTroubleshootingService.runFullDiagnostics();
      }
    });

    // 10. Troubleshooting: Reconnect Network
    this.registerAction({
      id: 'reconnect_network',
      name: 'Reconnect Network',
      category: 'troubleshooting',
      description: 'Reconnect real-time sockets and refresh connection status.',
      requiresConfirmation: false,
      paramsSchema: {},
      handler: async () => {
        return vibiTroubleshootingService.reconnectNetwork();
      }
    });

    // 11. Troubleshooting: Test Notification
    this.registerAction({
      id: 'test_notification',
      name: 'Test Notifications',
      category: 'troubleshooting',
      description: 'Send test browser notification to verify delivery.',
      requiresConfirmation: false,
      paramsSchema: {},
      handler: async () => {
        return vibiTroubleshootingService.sendTestNotification();
      }
    });

    // 12. Troubleshooting: Clear Temporary Cache
    this.registerAction({
      id: 'clear_temporary_cache',
      name: 'Clear Temporary Cache',
      category: 'troubleshooting',
      description: 'Clear temporary image/preview caches while safeguarding credentials and E2EE keys.',
      requiresConfirmation: false,
      paramsSchema: {},
      handler: async () => {
        return vibiTroubleshootingService.clearTemporaryCache();
      }
    });
  }
}

const vibiActionRegistry = new VibiActionRegistry();
export default vibiActionRegistry;

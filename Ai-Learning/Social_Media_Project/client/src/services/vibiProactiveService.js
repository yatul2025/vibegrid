/**
 * client/src/services/vibiProactiveService.js
 * ============================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 7 PROACTIVE ASSISTANCE & SMART SUGGESTIONS
 *
 * Rules:
 * - NEVER show popup modals
 * - NEVER block user action
 * - NEVER make noise without permission
 * - Suggestions must be subtle and dismissable
 * - Max 1 proactive suggestion per session unless user engages
 * - Respect "Smart Suggestions" setting (can be turned OFF)
 */

export const PROACTIVE_SHOWN_STORAGE_KEY = 'vibegrid_vibi_proactive_shown_count';
export const PROACTIVE_DISMISSED_KEY = 'vibegrid_vibi_proactive_dismissed';

export class VibiProactiveService {
  /**
   * Screen-specific contextual quick chips for empty chat state
   * @param {string} [tab='feed']
   * @param {string|null} [section=null]
   * @param {string|null} [modal=null]
   * @returns {Array<{ label: string, prompt: string }>}
   */
  getScreenSuggestions(tab = 'feed', section = null, modal = null) {
    if (modal) {
      const cleanModal = String(modal).toLowerCase();
      if (cleanModal.includes('create_post') || cleanModal.includes('app_create_post')) {
        return [
          { label: 'Upload Limits', prompt: 'What are the image upload requirements and limits?' },
          { label: 'Hashtag Tips', prompt: 'How do hashtags work in posts?' },
          { label: 'Theme Preference', prompt: 'Switch theme to dark mode' },
          { label: 'Back to Feed', prompt: 'Go to feed' }
        ];
      }
      if (cleanModal.includes('call')) {
        return [
          { label: 'Call Diagnostics', prompt: 'Test WebRTC calls and microphone' },
          { label: 'E2EE in Calls', prompt: 'How do calls work on VibeGrid?' },
          { label: 'Direct Messages', prompt: 'Open messages' },
          { label: 'Back to Feed', prompt: 'Go to feed' }
        ];
      }
      if (cleanModal.includes('notification') || cleanModal.includes('app_notifications')) {
        return [
          { label: 'Permission Status', prompt: 'Check notification status' },
          { label: 'Quiet Hours', prompt: 'How do notification preferences work?' },
          { label: 'Privacy Settings', prompt: 'Open Privacy Settings' },
          { label: 'Back to Feed', prompt: 'Go to feed' }
        ];
      }
      if (cleanModal.includes('permission_onboarding')) {
        return [
          { label: 'Why Camera?', prompt: 'Why does VibeGrid need camera and mic access?' },
          { label: 'Push Setup', prompt: 'How do push notifications work?' },
          { label: 'Privacy Guarantees', prompt: 'How does End-to-End Encryption work?' },
          { label: 'Back to Feed', prompt: 'Go to feed' }
        ];
      }
      if (cleanModal.includes('diagnostic')) {
        return [
          { label: 'Run Full Diagnostics', prompt: 'Run a full VibeGrid system health diagnostic check' },
          { label: 'Clear Cache', prompt: 'Clear temporary cache' },
          { label: 'Reconnect Socket', prompt: 'Reconnect socket' },
          { label: 'Settings', prompt: 'Open Settings' }
        ];
      }
    }

    switch (tab) {
      case 'settings': {
        switch (section) {
          case 'appearance':
            return [
              { label: 'Dark Mode', prompt: 'Switch theme to dark mode' },
              { label: 'Light Mode', prompt: 'Switch theme to light mode' },
              { label: 'Cyberpunk Theme', prompt: 'Switch theme to cyberpunk' },
              { label: 'Toggle Sound FX', prompt: 'Toggle sound effects' }
            ];
          case 'privacy':
            return [
              { label: 'Private Account', prompt: 'How does a Private Account work?' },
              { label: 'Online Status', prompt: 'How do I hide my online status?' },
              { label: 'E2EE Details', prompt: 'How does End-to-End Encryption work?' },
              { label: 'Security Center', prompt: 'Open Security Settings' }
            ];
          case 'security':
            return [
              { label: 'Active Sessions', prompt: 'How do active device sessions work?' },
              { label: 'Change Password', prompt: 'How do I change my password?' },
              { label: 'Privacy Controls', prompt: 'Open Privacy Settings' },
              { label: 'Vibi Settings', prompt: 'Open Vibi Assistant Settings' }
            ];
          case 'notifications':
            return [
              { label: 'Test Notification', prompt: 'Check notification status' },
              { label: 'Push Setup', prompt: 'How do push notifications work?' },
              { label: 'Quiet Hours', prompt: 'How do notification preferences work?' },
              { label: 'Back to Feed', prompt: 'Go to feed' }
            ];
          case 'vibi':
            return [
              { label: 'Floating Button', prompt: 'How do I toggle Vibi floating button?' },
              { label: 'Smart Suggestions', prompt: 'Explain Vibi smart suggestions' },
              { label: 'Context Sharing', prompt: 'How does Vibi use application context?' },
              { label: 'Appearance', prompt: 'Open Appearance Settings' }
            ];
          default:
            return [
              { label: 'Privacy & Permissions', prompt: 'Open Privacy Settings' },
              { label: 'Appearance & Themes', prompt: 'Switch theme to dark mode' },
              { label: 'Vibi Preferences', prompt: 'Show Vibi Assistant Settings' },
              { label: 'Security & Passwords', prompt: 'Open Security Settings' }
            ];
        }
      }

      case 'messages':
        return [
          { label: 'End-to-End Encryption', prompt: 'How does End-to-End Encryption work?' },
          { label: 'Voice & Video Calls', prompt: 'How do calls work on VibeGrid?' },
          { label: 'Clean Conversation', prompt: 'Clear Vibi conversation' },
          { label: 'Back to Feed', prompt: 'Go to feed' }
        ];

      case 'explore':
        return [
          { label: 'Explore Trending', prompt: 'Show me what is trending on VibeGrid' },
          { label: 'Search Tips', prompt: 'How do I search for topics and hashtags?' },
          { label: 'Back to Feed', prompt: 'Go to feed' },
          { label: 'My Profile', prompt: 'Go to profile' }
        ];

      case 'profile':
        return [
          { label: 'Edit Profile', prompt: 'Open Settings to edit profile' },
          { label: 'Privacy Controls', prompt: 'Open Privacy Settings' },
          { label: 'Theme Preference', prompt: 'Switch theme to dark mode' },
          { label: 'Explore Trending', prompt: 'Show me what is trending on VibeGrid' }
        ];

      case 'feed':
      default:
        return [
          { label: 'Explore Trending', prompt: 'Show me what is trending on VibeGrid' },
          { label: 'Settings', prompt: 'Open Settings' },
          { label: 'Dark Mode', prompt: 'Switch theme to dark mode' },
          { label: 'Privacy & E2EE', prompt: 'How does End-to-End Encryption work?' }
        ];
    }
  }

  /**
   * Evaluate whether an unobtrusive proactive hint should be displayed
   * @param {Object} contextSnapshot - App and user runtime context
   * @param {Object} preferences - Vibi user preferences
   * @returns {Object|null} Suggestion object or null
   */
  evaluateProactiveHint(contextSnapshot = {}, preferences = {}) {
    // 1. Respect Master switch and Smart Suggestions toggle
    if (preferences.enabled === false || preferences.smartSuggestions === false) {
      return null;
    }

    // 2. Check session limits: Max 1 proactive suggestion per session unless user engages
    const shownCount = this.getShownCount();
    const engaged = this.hasEngaged();
    if (shownCount >= 1 && !engaged) {
      return null;
    }

    const dismissedSet = this.getDismissedSet();

    // 3. Priority Rule 1: Offline Notice
    if (contextSnapshot.online === false && !dismissedSet.has('offline_notice')) {
      return {
        id: 'offline_notice',
        icon: '📡',
        text: "Looks like you're offline — some features are limited",
        actionLabel: 'Learn More',
        prompt: 'What features work while offline?'
      };
    }

    // 4. Priority Rule 2: Demo Mode reminder
    if (Boolean(contextSnapshot.isDemo) && !dismissedSet.has('demo_mode')) {
      return {
        id: 'demo_mode',
        icon: '🎮',
        text: "You're in Demo Mode — changes won't be saved",
        actionLabel: 'What is this?',
        prompt: 'Explain Demo Mode on VibeGrid'
      };
    }

    // 5. Priority Rule 3: Unread Messages (when on Feed)
    const unread = Number(contextSnapshot.unreadCount || 0);
    if (contextSnapshot.activeTab === 'feed' && unread > 0 && !dismissedSet.has('unread_messages')) {
      return {
        id: 'unread_messages',
        icon: '💬',
        text: `You have ${unread} unread message${unread > 1 ? 's' : ''}`,
        actionLabel: 'Go to Chats',
        action: { id: 'navigate', params: { tab: 'messages' } }
      };
    }

    // 6. Priority Rule 4: Explore search tips
    if (contextSnapshot.activeTab === 'explore' && !dismissedSet.has('explore_tip')) {
      return {
        id: 'explore_tip',
        icon: '🧭',
        text: 'Tip: You can search posts by hashtag on Explore',
        actionLabel: 'Trending',
        prompt: 'Show me what is trending on VibeGrid'
      };
    }

    // 7. Priority Rule 5: New user double-tap like tip on Feed
    if (contextSnapshot.activeTab === 'feed' && contextSnapshot.hasLikedBefore === false && !dismissedSet.has('like_tip')) {
      return {
        id: 'like_tip',
        icon: '❤️',
        text: 'Tip: Double-tap a post to like it!',
        actionLabel: 'Got it'
      };
    }

    return null;
  }

  /**
   * Record that a suggestion was displayed
   * @param {string} hintId
   */
  recordShown(hintId) {
    try {
      const current = this.getShownCount();
      sessionStorage.setItem(PROACTIVE_SHOWN_STORAGE_KEY, String(current + 1));
      if (hintId) {
        sessionStorage.setItem(`vibegrid_hint_${hintId}_time`, String(Date.now()));
      }
    } catch {
      // storage unavailable
    }
  }

  /**
   * Record that the user engaged with a suggestion
   */
  recordEngaged() {
    try {
      sessionStorage.setItem('vibegrid_vibi_proactive_engaged', 'true');
    } catch {
      // storage unavailable
    }
  }

  /**
   * Check if user engaged with a suggestion during this session
   * @returns {boolean}
   */
  hasEngaged() {
    try {
      return sessionStorage.getItem('vibegrid_vibi_proactive_engaged') === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Dismiss a suggestion
   * @param {string} hintId
   */
  dismissHint(hintId) {
    if (!hintId) return;
    try {
      const set = this.getDismissedSet();
      set.add(hintId);
      sessionStorage.setItem(PROACTIVE_DISMISSED_KEY, JSON.stringify(Array.from(set)));
    } catch {
      // storage unavailable
    }
  }

  /**
   * Get set of dismissed hint IDs
   * @returns {Set<string>}
   */
  getDismissedSet() {
    try {
      const stored = sessionStorage.getItem(PROACTIVE_DISMISSED_KEY);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
    return new Set();
  }

  /**
   * Get shown count for current session
   * @returns {number}
   */
  getShownCount() {
    try {
      const val = sessionStorage.getItem(PROACTIVE_SHOWN_STORAGE_KEY);
      return val ? parseInt(val, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Dynamically generate 2 to 4 contextual follow-up suggestions based on response topic and current UI context
   * @param {string|null} topic - Extracted response topic
   * @param {string} [replyText=''] - AI or intent response text
   * @param {Object} [contextSnapshot={}] - Current application context
   * @returns {Array<{ id: string, label: string, prompt: string, actionId?: string, params?: Object, icon?: string }>}
   */
  generatePostResponseSuggestions(topic = null, replyText = '', contextSnapshot = {}) {
    const rawSuggestions = [];
    const activeTab = (contextSnapshot.currentTab || contextSnapshot.screen || 'feed').toLowerCase();
    const activeSection = (contextSnapshot.activeSection || '').toLowerCase();
    const cleanTopic = (topic || '').toLowerCase();
    const textLower = (replyText || '').toLowerCase();

    // Check if user has selected text
    if (contextSnapshot.selectedText && typeof contextSnapshot.selectedText === 'string') {
      const snippet = contextSnapshot.selectedText.slice(0, 16);
      rawSuggestions.push({
        id: 'explain_selection',
        label: `Explain "${snippet}..."`,
        prompt: `Explain this: "${contextSnapshot.selectedText}"`,
        icon: 'HelpCircle'
      });
    }

    if (cleanTopic === 'e2ee' || textLower.includes('encryption') || textLower.includes('e2ee') || textLower.includes('signal protocol')) {
      rawSuggestions.push(
        { id: 'verify_keys', label: 'Verify Safety Number', prompt: 'How do I verify E2EE safety numbers?', actionId: 'open_modal', params: { modal: 'key_backup' }, icon: 'ShieldCheck' },
        { id: 'key_backup', label: 'Key Backup & Export', prompt: 'How do I backup and restore my encryption keys?', actionId: 'open_modal', params: { modal: 'key_backup' }, icon: 'Key' },
        { id: 'signal_protocol', label: 'Signal Protocol Details', prompt: 'Explain the Double Ratchet and Signal Protocol in VibeGrid', icon: 'Lock' },
        { id: 'privacy_settings', label: 'Privacy Settings', prompt: 'Open Privacy Settings', actionId: 'navigate', params: { tab: 'settings', section: 'privacy' }, icon: 'Shield' }
      );
    } else if (cleanTopic === 'calls' || textLower.includes('webrtc') || textLower.includes('audio call') || textLower.includes('video call')) {
      rawSuggestions.push(
        { id: 'call_diag', label: 'Run Call Diagnostics', prompt: 'Test WebRTC calls and microphone', actionId: 'run_diagnostics', params: { type: 'calls' }, icon: 'Activity' },
        { id: 'camera_mic', label: 'Camera & Mic Access', prompt: 'Why does VibeGrid need camera and mic access?', actionId: 'open_modal', params: { modal: 'permission_onboarding' }, icon: 'Video' },
        { id: 'open_chats', label: 'Direct Messages', prompt: 'Open messages', actionId: 'navigate', params: { tab: 'messages' }, icon: 'MessageSquare' },
        { id: 'quiet_hours', label: 'Quiet Hours', prompt: 'How do notification preferences work?', actionId: 'navigate', params: { tab: 'settings', section: 'notifications' }, icon: 'Bell' }
      );
    } else if (cleanTopic === 'appearance' || textLower.includes('theme') || textLower.includes('dark mode') || textLower.includes('cyberpunk')) {
      rawSuggestions.push(
        { id: 'cyberpunk_mode', label: 'Cyberpunk Theme', prompt: 'Switch theme to cyberpunk', actionId: 'toggle_theme', params: { theme: 'cyberpunk' }, icon: 'Palette' },
        { id: 'oled_mode', label: 'OLED Dark Mode', prompt: 'Switch theme to oled', actionId: 'toggle_theme', params: { theme: 'oled' }, icon: 'Moon' },
        { id: 'sound_fx', label: 'Toggle Sound Effects', prompt: 'Toggle sound effects', actionId: 'toggle_sound', params: {}, icon: 'Volume2' },
        { id: 'all_themes', label: 'Appearance Settings', prompt: 'Open Appearance Settings', actionId: 'navigate', params: { tab: 'settings', section: 'appearance' }, icon: 'Sliders' }
      );
    } else if (cleanTopic === 'diagnostics' || textLower.includes('diagnostic') || textLower.includes('troubleshoot') || textLower.includes('health check')) {
      rawSuggestions.push(
        { id: 'clear_cache', label: 'Clear Temporary Cache', prompt: 'Clear temporary cache', actionId: 'clear_temporary_cache', params: {}, icon: 'Trash2' },
        { id: 'reconnect_sock', label: 'Reconnect Socket', prompt: 'Reconnect socket', actionId: 'reconnect_network', params: {}, icon: 'Wifi' },
        { id: 'webrtc_test', label: 'Test WebRTC Calls', prompt: 'Test WebRTC calls and microphone', actionId: 'run_diagnostics', params: { type: 'calls' }, icon: 'Activity' },
        { id: 'settings_center', label: 'Open Settings', prompt: 'Open Settings', actionId: 'navigate', params: { tab: 'settings' }, icon: 'Settings' }
      );
    } else if (cleanTopic === 'notifications' || textLower.includes('notification') || textLower.includes('quiet hours')) {
      rawSuggestions.push(
        { id: 'notif_perm', label: 'Permission Status', prompt: 'Check notification status', actionId: 'open_modal', params: { modal: 'permission_onboarding' }, icon: 'Bell' },
        { id: 'quiet_settings', label: 'Notification Settings', prompt: 'Open Notification Settings', actionId: 'navigate', params: { tab: 'settings', section: 'notifications' }, icon: 'Clock' },
        { id: 'test_chime', label: 'Toggle Sound FX', prompt: 'Toggle sound effects', actionId: 'toggle_sound', params: {}, icon: 'Volume2' }
      );
    } else if (cleanTopic === 'posts' || textLower.includes('create post') || textLower.includes('upload')) {
      rawSuggestions.push(
        { id: 'create_post', label: 'Create Post', prompt: 'Open create post modal', actionId: 'open_modal', params: { modal: 'create_post' }, icon: 'PlusCircle' },
        { id: 'trending_tags', label: 'Explore Trending', prompt: 'Show me what is trending on VibeGrid', actionId: 'navigate', params: { tab: 'explore' }, icon: 'Compass' },
        { id: 'upload_reqs', label: 'Upload Limits', prompt: 'What are the image upload requirements and limits?', icon: 'HelpCircle' }
      );
    } else {
      if (activeTab === 'feed') {
        rawSuggestions.push(
          { id: 'go_explore', label: 'Explore Trending', prompt: 'Show me what is trending on VibeGrid', actionId: 'navigate', params: { tab: 'explore' }, icon: 'Compass' },
          { id: 'go_messages', label: 'Direct Messages', prompt: 'Open messages', actionId: 'navigate', params: { tab: 'messages' }, icon: 'MessageSquare' },
          { id: 'dark_mode', label: 'Dark Mode', prompt: 'Switch theme to dark mode', actionId: 'toggle_theme', params: { theme: 'dark' }, icon: 'Moon' },
          { id: 'open_settings', label: 'Settings', prompt: 'Open Settings', actionId: 'navigate', params: { tab: 'settings' }, icon: 'Settings' }
        );
      } else if (activeTab === 'messages') {
        rawSuggestions.push(
          { id: 'learn_e2ee', label: 'End-to-End Encryption', prompt: 'How does End-to-End Encryption work?', icon: 'Lock' },
          { id: 'go_feed', label: 'Home Feed', prompt: 'Go to feed', actionId: 'navigate', params: { tab: 'feed' }, icon: 'Home' },
          { id: 'go_explore', label: 'Explore Trending', prompt: 'Show me what is trending on VibeGrid', actionId: 'navigate', params: { tab: 'explore' }, icon: 'Compass' }
        );
      } else if (activeTab === 'explore') {
        rawSuggestions.push(
          { id: 'search_tips', label: 'Search Tips', prompt: 'How do I search for topics and hashtags?', icon: 'Search' },
          { id: 'go_feed', label: 'Home Feed', prompt: 'Go to feed', actionId: 'navigate', params: { tab: 'feed' }, icon: 'Home' },
          { id: 'go_profile', label: 'My Profile', prompt: 'Go to profile', actionId: 'navigate', params: { tab: 'profile' }, icon: 'User' }
        );
      } else if (activeTab === 'settings') {
        rawSuggestions.push(
          { id: 'privacy_center', label: 'Privacy Settings', prompt: 'Open Privacy Settings', actionId: 'navigate', params: { tab: 'settings', section: 'privacy' }, icon: 'Shield' },
          { id: 'appearance_center', label: 'Appearance Settings', prompt: 'Open Appearance Settings', actionId: 'navigate', params: { tab: 'settings', section: 'appearance' }, icon: 'Palette' },
          { id: 'go_feed', label: 'Back to Feed', prompt: 'Go to feed', actionId: 'navigate', params: { tab: 'feed' }, icon: 'Home' }
        );
      } else {
        rawSuggestions.push(
          { id: 'go_feed', label: 'Home Feed', prompt: 'Go to feed', actionId: 'navigate', params: { tab: 'feed' }, icon: 'Home' },
          { id: 'go_explore', label: 'Explore Trending', prompt: 'Show me what is trending on VibeGrid', actionId: 'navigate', params: { tab: 'explore' }, icon: 'Compass' },
          { id: 'dark_mode', label: 'Dark Mode', prompt: 'Switch theme to dark mode', actionId: 'toggle_theme', params: { theme: 'dark' }, icon: 'Moon' }
        );
      }
    }

    // Filter out redundant actions
    const filtered = rawSuggestions.filter((sug) => {
      if (sug.actionId === 'navigate' && sug.params?.tab) {
        if (sug.params.tab === activeTab) {
          if (!sug.params.section || sug.params.section === activeSection) {
            return false;
          }
        }
      }
      return true;
    });

    return filtered.slice(0, 4);
  }

  /**
   * Reset session storage tracking (useful for testing or session reset)
   */
  resetSession() {
    try {
      sessionStorage.removeItem(PROACTIVE_SHOWN_STORAGE_KEY);
      sessionStorage.removeItem(PROACTIVE_DISMISSED_KEY);
      sessionStorage.removeItem('vibegrid_vibi_proactive_engaged');
    } catch {
      // ignore
    }
  }
}

const vibiProactiveService = new VibiProactiveService();
export default vibiProactiveService;

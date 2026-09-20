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

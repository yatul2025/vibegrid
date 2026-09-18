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
   * @returns {Array<{ label: string, prompt: string }>}
   */
  getScreenSuggestions(tab = 'feed') {
    switch (tab) {
      case 'settings':
        return [
          { label: 'Privacy & Permissions', prompt: 'Open Privacy Settings' },
          { label: 'Appearance & Themes', prompt: 'Switch theme to dark mode' },
          { label: 'Vibi Preferences', prompt: 'Show Vibi Assistant Settings' },
          { label: 'Security & Passwords', prompt: 'Open Security Settings' }
        ];

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

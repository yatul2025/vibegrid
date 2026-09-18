/**
 * client/src/services/accountSuggestionService.js
 * ===============================================
 * Non-sensitive Remembered-Account Suggestion Service
 * 
 * Responsibilities:
 * 1. Safely stores public profile metadata (username, full name, avatar, gender) for login suggestions.
 * 2. STRICTLY separates non-sensitive suggestion data from authentication session/tokens.
 * 3. NEVER stores passwords, JWT tokens, or authentication secrets.
 * 4. Ensures remembered-account data CANNOT automatically log a user in or restore a session.
 * 5. Supports multiple remembered accounts with ability to remove individual suggestions.
 */

const STORAGE_KEY = 'vibegrid_remembered_accounts';
const MAX_ACCOUNTS = 5;

class AccountSuggestionService {
  /**
   * Retrieve all remembered accounts, sorted with most recently used first.
   * @returns {Array<{ id: number|string, username: string, fullName: string, avatarUrl: string|null, gender: string, identifier: string, lastUsedAt: number }>}
   */
  getRememberedAccounts() {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((acc) => acc && typeof acc === 'object' && (acc.username || acc.identifier))
        .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
    } catch (err) {
      console.warn('[AccountSuggestionService] Error loading remembered accounts:', err);
      return [];
    }
  }

  /**
   * Add or update a non-sensitive remembered account record.
   * Excludes demo persona sessions.
   * NEVER stores password or credentials.
   *
   * @param {Object} user
   * @param {string} [fallbackIdentifier]
   */
  saveRememberedAccount(user, fallbackIdentifier = '') {
    if (!user || typeof localStorage === 'undefined') return;

    // Ignore demo personas
    const isDemo = Boolean(user.is_demo_session || user.isDemoSession || user.sessionType === 'demo');
    if (isDemo) return;

    const username = (user.username || '').trim();
    if (!username && !fallbackIdentifier) return;

    try {
      const current = this.getRememberedAccounts();

      const newEntry = {
        id: user.id || null,
        username: username || fallbackIdentifier,
        fullName: user.full_name || user.fullName || user.username || fallbackIdentifier,
        avatarUrl: user.avatar_url || user.avatarUrl || null,
        gender: user.gender || 'unspecified',
        identifier: username || fallbackIdentifier,
        lastUsedAt: Date.now()
      };

      // Filter out duplicate entries for this user
      const filtered = current.filter((acc) => {
        if (newEntry.id && acc.id && acc.id === newEntry.id) return false;
        if (newEntry.username && acc.username && acc.username.toLowerCase() === newEntry.username.toLowerCase()) return false;
        if (newEntry.identifier && acc.identifier && acc.identifier.toLowerCase() === newEntry.identifier.toLowerCase()) return false;
        return true;
      });

      const updated = [newEntry, ...filtered].slice(0, MAX_ACCOUNTS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('[AccountSuggestionService] Error saving account suggestion:', err);
    }
  }

  /**
   * Remove a remembered account from suggestions by ID or username.
   * @param {number|string} idOrUsername
   * @returns {Array} Updated accounts list
   */
  removeRememberedAccount(idOrUsername) {
    if (typeof localStorage === 'undefined' || !idOrUsername) return [];
    try {
      const current = this.getRememberedAccounts();
      const targetStr = String(idOrUsername).toLowerCase();

      const updated = current.filter((acc) => {
        if (acc.id && String(acc.id) === targetStr) return false;
        if (acc.username && acc.username.toLowerCase() === targetStr) return false;
        if (acc.identifier && acc.identifier.toLowerCase() === targetStr) return false;
        return true;
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    } catch (err) {
      console.warn('[AccountSuggestionService] Error removing account suggestion:', err);
      return [];
    }
  }

  /**
   * Clear all remembered accounts.
   */
  clearRememberedAccounts() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('[AccountSuggestionService] Error clearing remembered accounts:', err);
    }
  }
}

const accountSuggestionService = new AccountSuggestionService();
export default accountSuggestionService;

/**
 * client/src/services/vibiAuditLog.js
 * ====================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 5 AUDIT LOGGING SYSTEM
 *
 * Responsibilities:
 * - Records `vibi_action_audit` entries for all attempted and executed Vibi actions.
 * - Stores timestamp, action ID, category, outcome status, and failure reason.
 * - Enforces privacy: NEVER stores sensitive credentials, message bodies, or tokens.
 * - Ring-buffer bounded storage (max 50 entries) in localStorage.
 */

export const VIBI_AUDIT_STORAGE_KEY = 'vibegrid_vibi_audit_log';
export const MAX_AUDIT_ENTRIES = 50;

class VibiAuditLog {
  constructor() {
    this.storageKey = VIBI_AUDIT_STORAGE_KEY;
  }

  /**
   * Read raw entries from localStorage
   * @returns {Array}
   */
  _readLogs() {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Persist entries to localStorage
   * @param {Array} logs
   */
  _writeLogs(logs) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(logs.slice(-MAX_AUDIT_ENTRIES)));
    } catch (e) {
      console.warn('[VibiAuditLog] Failed to persist audit log:', e);
    }
  }

  /**
   * Record an action audit entry
   * @param {Object} entry
   * @param {string} entry.actionId - Whitelisted action ID (e.g., 'navigate', 'toggle_theme')
   * @param {string} [entry.category] - 'navigation' | 'ui' | 'info' | 'api'
   * @param {'success' | 'failed' | 'rejected' | 'pending_confirmation'} entry.status
   * @param {string} [entry.failureReason] - Reason if failed or rejected
   * @param {string} [entry.username] - User who initiated the action
   * @returns {Object} the recorded entry
   */
  logAction({ actionId, category = 'ui', status = 'success', failureReason = null, username = 'anonymous' }) {
    const entry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      actionId: String(actionId || 'unknown'),
      category: String(category),
      status: ['success', 'failed', 'rejected', 'pending_confirmation'].includes(status) ? status : 'unknown',
      failureReason: failureReason ? String(failureReason).slice(0, 200) : null,
      user: username ? String(username).slice(0, 50) : 'anonymous',
      username: username ? String(username).slice(0, 50) : 'anonymous'
    };

    const logs = this._readLogs();
    logs.push(entry);
    this._writeLogs(logs);

    return entry;
  }

  /**
   * Get recent audit entries
   * @param {number} [limit=20]
   * @returns {Array}
   */
  getAuditLogs(limit = 20) {
    const logs = this._readLogs();
    return logs.slice(-limit).reverse();
  }

  /**
   * Alias for getAuditLogs
   */
  getLogs(limit = 20) {
    return this.getAuditLogs(limit);
  }

  /**
   * Clear all audit logs
   */
  clearAuditLogs() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.removeItem(this.storageKey);
    } catch {}
  }

  /**
   * Alias for clearAuditLogs
   */
  clear() {
    this.clearAuditLogs();
  }

  /**
   * Summary stats of recorded actions
   */
  getStats() {
    const logs = this._readLogs();
    return {
      total: logs.length,
      success: logs.filter((l) => l.status === 'success').length,
      failed: logs.filter((l) => l.status === 'failed').length,
      rejected: logs.filter((l) => l.status === 'rejected').length,
      pending: logs.filter((l) => l.status === 'pending_confirmation').length
    };
  }
}

const vibiAuditLog = new VibiAuditLog();
export default vibiAuditLog;

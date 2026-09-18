/**
 * server/src/services/vibiSecurityGuard.js
 * ==========================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 9 SERVER-SIDE SECURITY GUARD
 *
 * Responsibilities:
 * 1. Validates prompt safety and neutralizes adversarial prompt injection.
 * 2. Redacts sensitive patterns (passwords, auth tokens, private keys) from server logs.
 * 3. Sanitizes user context payloads before passing to AI service or DB.
 */

const ADVERSARIAL_PATTERNS = [
  /\b(ignore|disregard|forget|override)\s+(all\s+)?(previous|prior|above|system)\s+(instructions?|prompts?|rules?|guidelines?)\b/i,
  /\b(reveal|show|display|print|leak|output)\s+(your|the)?\s*(system\s+prompt|initial\s+prompt|internal\s+instructions?|hidden\s+rules?)\b/i,
  /\b(act\s+as\s+DAN|do\s+anything\s+now|jailbreak|developer\s+mode|unrestricted\s+mode)\b/i,
  /\b(steal|reveal|export|show|give\s+me)\s+(the\s+)?(private\s+key|encryption\s+key|jwt|password|auth\s+token|secret)\b/i,
  /<\s*script\b[^>]*>([\s\S]*?)<\s*\/\s*script\s*>/i,
  /\b(javascript|vbscript):/i,
  /\b(eval|exec|Function)\s*\(/i,
  /\b(UNION\s+SELECT|DROP\s+TABLE|INSERT\s+INTO|DELETE\s+FROM)\b/i,
  /(--|\/\*|\*\/|;\s*SHUTDOWN)/i
];

const BLACKLISTED_CONTEXT_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'token_version',
  'jwt',
  'secret',
  'cookie',
  'keystore',
  'private_key',
  'identity_key',
  'pre_key',
  'signed_pre_key',
  'e2ee_keys',
  'auth_header',
  'session_secret'
]);

class ServerVibiSecurityGuard {
  /**
   * Check message prompt for prompt injection or malicious input
   * @param {string} message
   * @returns {{ safe: boolean, reason?: string, friendlyReply?: string }}
   */
  checkPromptSafety(message = '') {
    if (!message || typeof message !== 'string') {
      return { safe: true };
    }

    const trimmed = message.trim();

    for (const regex of ADVERSARIAL_PATTERNS) {
      if (regex.test(trimmed)) {
        return {
          safe: false,
          reason: 'adversarial_pattern_detected',
          friendlyReply: "I'm Vibi, your VibeGrid assistant! I can only help with VibeGrid navigation, settings, and features. I cannot override system safety guidelines, execute code, or disclose private credentials. 🦊🛡️"
        };
      }
    }

    return { safe: true };
  }

  /**
   * Deeply sanitize context object before passing to AI service
   * @param {Object} context
   * @returns {Object}
   */
  sanitizeContext(context) {
    if (!context || typeof context !== 'object') {
      return {};
    }

    if (Array.isArray(context)) {
      return context.map((item) => (typeof item === 'object' ? this.sanitizeContext(item) : item));
    }

    const clean = {};
    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();

      let isBlacklisted = false;
      for (const blocked of BLACKLISTED_CONTEXT_KEYS) {
        if (lowerKey === blocked || lowerKey.includes(blocked)) {
          isBlacklisted = true;
          break;
        }
      }

      if (isBlacklisted) {
        continue;
      }

      if (value && typeof value === 'object') {
        clean[key] = this.sanitizeContext(value);
      } else {
        clean[key] = value;
      }
    }

    return clean;
  }
}

const serverVibiSecurityGuard = new ServerVibiSecurityGuard();
module.exports = {
  serverVibiSecurityGuard,
  ServerVibiSecurityGuard,
  ADVERSARIAL_PATTERNS,
  BLACKLISTED_CONTEXT_KEYS
};

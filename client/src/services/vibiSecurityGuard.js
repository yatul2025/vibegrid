/**
 * client/src/services/vibiSecurityGuard.js
 * ==========================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 9 PRIVACY, SAFETY & SECURITY HARDENING
 *
 * Responsibilities:
 * 1. Prompt Injection & Adversarial Jailbreak Defenses.
 * 2. Sensitive Data Redaction (passwords, JWTs, private keys, OTPs).
 * 3. Context Sanitization (strips all credentials, tokens, E2EE keys).
 * 4. Privacy-First Conversation Lifecycle (30-day auto-pruning, local-only storage).
 * 5. Absolute E2EE & Credential Protection.
 */

import vibiAuditLog from './vibiAuditLog';

// High-risk prompt injection and jailbreak regex signatures
export const ADVERSARIAL_PATTERNS = [
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

// Sensitive data patterns for automatic redaction
export const SENSITIVE_DATA_PATTERNS = [
  // JWT tokens: eyJ...
  { pattern: /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g, replacement: '[REDACTED_JWT_TOKEN]' },
  // Bearer authentication headers
  { pattern: /bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi, replacement: 'Bearer [REDACTED_AUTH_TOKEN]' },
  // Password assignments (e.g. password=secret123)
  { pattern: /(password|passwd|pwd)\s*[:=]\s*['"]?[^\s'",;]{4,}['"]?/gi, replacement: '$1=[REDACTED_PASSWORD]' },
  // API Keys / Secrets (e.g. api_key=..., secret_key=...)
  { pattern: /(api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*['"]?[^\s'",;]{8,}['"]?/gi, replacement: '$1=[REDACTED_KEY]' },
  // Private Key Headers
  { pattern: /-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z0-9_-]*PRIVATE KEY-----/gi, replacement: '[REDACTED_PRIVATE_KEY]' },
  // 6-digit 2FA / OTP codes paired with security words
  { pattern: /\b(otp|2fa|code|pin|verification)\s*(is|:|=)?\s*\d{6}\b/gi, replacement: '$1 [REDACTED_OTP]' }
];

// Blacklisted keys that must NEVER appear in context snapshots sent anywhere
export const BLACKLISTED_CONTEXT_KEYS = new Set([
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

export class VibiSecurityGuard {
  /**
   * Check a user prompt for prompt injection or adversarial attacks
   * @param {string} prompt
   * @param {string} [username='anonymous']
   * @returns {{ safe: boolean, reason?: string, friendlyReply?: string }}
   */
  checkPromptSafety(prompt = '', username = 'anonymous') {
    if (!prompt || typeof prompt !== 'string') {
      return { safe: true };
    }

    const trimmed = prompt.trim();

    for (const regex of ADVERSARIAL_PATTERNS) {
      if (regex.test(trimmed)) {
        // Log the blocked attempt to Vibi Audit Log
        vibiAuditLog.logAction({
          actionId: 'security_guard_block',
          category: 'security',
          status: 'rejected',
          failureReason: `adversarial_pattern_detected: ${regex.source}`,
          username
        });

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
   * Automatically redact sensitive credentials, tokens, or keys from natural text
   * @param {string} text
   * @returns {string} Redacted text
   */
  redactSensitiveData(text = '') {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let redacted = text;
    for (const { pattern, replacement } of SENSITIVE_DATA_PATTERNS) {
      redacted = redacted.replace(pattern, replacement);
    }
    return redacted;
  }

  /**
   * Sanitize an arbitrary context object, deeply removing blacklisted credentials
   * @param {Object} context
   * @returns {Object} Sanitized context
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

      // Check blacklisted keys
      let isBlacklisted = false;
      for (const blocked of BLACKLISTED_CONTEXT_KEYS) {
        if (lowerKey === blocked || lowerKey.includes(blocked)) {
          isBlacklisted = true;
          break;
        }
      }

      if (isBlacklisted) {
        continue; // strictly omit
      }

      if (value && typeof value === 'object') {
        clean[key] = this.sanitizeContext(value);
      } else if (typeof value === 'string') {
        clean[key] = this.redactSensitiveData(value);
      } else {
        clean[key] = value;
      }
    }

    return clean;
  }

  /**
   * Prune conversation messages older than the retention period (default 30 days)
   * Vibi conversations are stored locally ONLY.
   * @param {Array} messages - Array of message objects
   * @param {number} [retentionDays=30]
   * @returns {{ prunedMessages: Array, prunedCount: number }}
   */
  pruneOldConversations(messages = [], retentionDays = 30) {
    if (!Array.isArray(messages)) {
      return { prunedMessages: [], prunedCount: 0 };
    }

    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const prunedMessages = messages.filter((msg) => {
      const time = Number(msg.timestamp || 0);
      return time >= cutoffTime;
    });

    const prunedCount = messages.length - prunedMessages.length;
    return {
      prunedMessages,
      prunedCount
    };
  }
}

const vibiSecurityGuard = new VibiSecurityGuard();
export default vibiSecurityGuard;

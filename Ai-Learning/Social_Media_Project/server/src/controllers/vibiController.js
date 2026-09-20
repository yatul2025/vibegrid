/**
 * server/src/controllers/vibiController.js
 * =========================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 6 CONTROLLER
 *
 * Responsibilities:
 * - Authenticates requests via req.user.
 * - Enforces payload boundaries (< 5KB).
 * - Invokes vibiAiService to generate responses and structured actions.
 * - Records action audit logs in PostgreSQL vibi_action_audit if available.
 * - Provides assistant operational status.
 */

const { generateVibiResponse } = require('../services/vibiAiService');
const { serverVibiSecurityGuard } = require('../services/vibiSecurityGuard');
const { query } = require('../config/db');

// Ensure vibi_action_audit table exists
let tableChecked = false;
async function ensureAuditTable() {
  if (tableChecked) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS vibi_action_audit (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username VARCHAR(50),
        action_id VARCHAR(50),
        category VARCHAR(50) DEFAULT 'ai',
        status VARCHAR(30) DEFAULT 'success',
        failure_reason TEXT,
        provider VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_vibi_audit_user ON vibi_action_audit(user_id);
      CREATE INDEX IF NOT EXISTS idx_vibi_audit_created ON vibi_action_audit(created_at DESC);
    `);
    tableChecked = true;
  } catch (err) {
    console.warn('[VibiController] Warning checking vibi_action_audit table:', err.message);
  }
}

/**
 * Handle incoming conversational chat requests for Vibi AI
 * POST /api/vibi/chat
 */
const handleVibiChat = async (req, res) => {
  try {
    const { message, context } = req.body;

    // 1. Validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required and must be a non-empty string.'
      });
    }

    // Reject excessively large payloads (> 4000 characters)
    if (message.length > 4000) {
      return res.status(400).json({
        success: false,
        error: 'Message exceeds maximum allowable length of 4,000 characters.'
      });
    }

    // 2. Prompt Injection & Adversarial Attack Defense
    const safetyCheck = serverVibiSecurityGuard.checkPromptSafety(message);
    if (!safetyCheck.safe) {
      ensureAuditTable().then(() => {
        query(
          `INSERT INTO vibi_action_audit (user_id, username, action_id, category, status, failure_reason, provider)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.user?.id || null,
            req.user?.username || 'anonymous',
            'security_guard_block',
            'security',
            'rejected',
            safetyCheck.reason,
            'server_guard'
          ]
        ).catch(() => {});
      });

      return res.json({
        success: true,
        data: {
          replyText: safetyCheck.friendlyReply,
          action: null,
          provider: 'security_guard',
          isFallback: true
        }
      });
    }

    // 3. Data Minimization: Sanitize context
    const cleanContext = serverVibiSecurityGuard.sanitizeContext(context || {});
    const sanitizedContext = {
      activeTab: typeof cleanContext.activeTab === 'string' ? cleanContext.activeTab.slice(0, 30) : 'feed',
      activeSection: typeof cleanContext.activeSection === 'string' ? cleanContext.activeSection.slice(0, 30) : null,
      recentTopic: typeof cleanContext.recentTopic === 'string' ? cleanContext.recentTopic.slice(0, 50) : null,
      lastClarificationQuestion: typeof cleanContext.lastClarificationQuestion === 'string' ? cleanContext.lastClarificationQuestion.slice(0, 50) : null,
      theme: typeof cleanContext.theme === 'string' ? cleanContext.theme.slice(0, 30) : 'dark',
      online: Boolean(cleanContext.online !== false),
      soundEnabled: Boolean(cleanContext.soundEnabled),
      device: typeof cleanContext.device === 'string' ? cleanContext.device.slice(0, 50) : 'web'
    };

    // 4. Process AI Generation
    const startTime = Date.now();
    const result = await generateVibiResponse(message.trim(), sanitizedContext);
    const durationMs = Date.now() - startTime;

    // 4. Server-Side Audit Logging (non-blocking)
    ensureAuditTable().then(() => {
      query(
        `INSERT INTO vibi_action_audit (user_id, username, action_id, category, status, provider)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user?.id || null,
          req.user?.username || 'anonymous',
          result.action?.id || 'chat_reply',
          'ai_conversation',
          'success',
          result.provider || 'knowledge_base'
        ]
      ).catch(e => console.warn('[VibiController] Audit insert warning:', e.message));
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      data: {
        replyText: result.replyText,
        action: result.action || null,
        responseType: result.responseType || 'NORMAL',
        topic: result.topic || sanitizedContext.recentTopic || null,
        provider: result.provider,
        isFallback: Boolean(result.isFallback),
        durationMs
      }
    });
  } catch (error) {
    console.error('[VibiController Error]', error.message);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred while consulting Vibi AI.',
      details: error.message
    });
  }
};

/**
 * Get Vibi AI Assistant Operational Status
 * GET /api/vibi/status
 */
const getVibiStatus = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      status: 'operational',
      assistantName: 'Vibi',
      mascot: 'Red Panda 🦊',
      capabilities: [
        'deterministic_quick_actions',
        'knowledge_base_answering',
        'navigation_proposals',
        'theme_toggling',
        'sound_toggling'
      ]
    }
  });
};

module.exports = {
  handleVibiChat,
  getVibiStatus
};

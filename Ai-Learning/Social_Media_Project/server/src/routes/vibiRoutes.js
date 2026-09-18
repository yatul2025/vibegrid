/**
 * server/src/routes/vibiRoutes.js
 * ================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 6 ROUTES
 *
 * Responsibilities:
 * - Rate limiting on chat requests (30 requests/minute per user or IP).
 * - Authenticated access via protect middleware.
 * - Routes /api/vibi/chat and /api/vibi/status.
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middlewares/authMiddleware');
const { handleVibiChat, getVibiStatus } = require('../controllers/vibiController');

// Rate limiter: 30 requests per minute per IP to prevent spam or token abuse
const vibiChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "You're chatting with Vibi a bit too fast! Please wait a moment before sending more messages. 🦊💨"
  }
});

// Chat endpoint (protected with JWT session authentication)
router.post('/chat', protect, vibiChatLimiter, handleVibiChat);

// Public status endpoint
router.get('/status', getVibiStatus);

module.exports = router;

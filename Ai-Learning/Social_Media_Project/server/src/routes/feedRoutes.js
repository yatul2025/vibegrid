/**
 * server/src/routes/feedRoutes.js
 * ===============================
 * Live Aggregated Feed & Stories Endpoints
 * 
 * Routes:
 * - GET /api/feed         (Live posts feed: real users + external content)
 * - GET /api/feed/stories (Live stories tray: real user stories + external discovery stories)
 */

const express = require('express');
const router = express.Router();
const { getLiveFeed, getLiveStories } = require('../controllers/feedController');
const { optionalAuth } = require('../middlewares/authMiddleware');

// Live feed endpoint with optional auth (for personalized like / save states)
router.get('/', optionalAuth, getLiveFeed);

// Live stories endpoint
router.get('/stories', optionalAuth, getLiveStories);

module.exports = router;

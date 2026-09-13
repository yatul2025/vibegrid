/**
 * src/routes/hashtagRoutes.js
 * ===========================
 * Hashtags & Trending Topics Endpoints
 */

const express = require('express');
const router = express.Router();
const {
  getTrendingHashtags,
  getHashtagPosts
} = require('../controllers/hashtagController');
const { optionalAuth } = require('../middlewares/authMiddleware');

// GET /api/hashtags/trending — Top ranked hashtags with post counts
router.get('/trending', optionalAuth, getTrendingHashtags);

// GET /api/hashtags/:tag/posts — Posts tagged with a specific hashtag
router.get('/:tag/posts', optionalAuth, getHashtagPosts);

module.exports = router;

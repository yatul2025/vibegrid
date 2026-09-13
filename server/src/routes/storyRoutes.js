/**
 * src/routes/storyRoutes.js
 * =========================
 * API Routes for Ephemeral Stories
 * 
 * Endpoints:
 * - POST   /api/stories        (Authenticated, upload story image)
 * - GET    /api/stories/active (Public / Optional Auth, active stories within 24h)
 * - DELETE /api/stories/:id    (Authenticated, author only)
 */

const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');
const { protect, optionalAuth } = require('../middlewares/authMiddleware');
const { uploadStory } = require('../middlewares/uploadMiddleware');

// 1. Get active stories (expires_at > CURRENT_TIMESTAMP)
router.get('/active', optionalAuth, storyController.getActiveStories);

// 2. Publish a new story (24-hour expiration)
router.post('/', protect, uploadStory.single('media'), storyController.createStory);

// 3. Delete a story (Creator only)
router.delete('/:id', protect, storyController.deleteStory);

module.exports = router;

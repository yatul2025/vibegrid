/**
 * src/routes/postRoutes.js
 * ========================
 * Post & Home Feed Routes
 * 
 * Endpoints for creating posts, fetching feed posts,
 * retrieving user profile posts, and deleting posts.
 */

const express = require('express');
const router = express.Router();
const {
  createPost,
  getFeedPosts,
  getUserPosts,
  deletePost,
  getExplorePosts,
  toggleSavePost,
  getSavedPosts,
  moderatePost
} = require('../controllers/postController');
const {
  toggleLike,
  getComments,
  addComment,
  deleteComment
} = require('../controllers/engagementController');
const { protect, optionalAuth } = require('../middlewares/authMiddleware');
const { uploadPost } = require('../middlewares/uploadMiddleware');

// POST /api/posts — Create new post with photo and caption (Protected)
router.post('/', protect, uploadPost.single('image'), createPost);

// GET /api/posts/feed — Get chronological home feed (Optional Auth for like states)
router.get('/feed', optionalAuth, getFeedPosts);

// GET /api/posts/explore — Get community discovery explore grid (Optional Auth)
router.get('/explore', optionalAuth, getExplorePosts);

// GET /api/posts/saved — Get bookmarked / saved posts (Protected, Phase 12)
router.get('/saved', protect, getSavedPosts);

// GET /api/posts/user/:username — Get all posts by a specific user (Optional Auth)
router.get('/user/:username', optionalAuth, getUserPosts);

// PATCH & POST /api/posts/:id/moderate — Toggle post active/inactive status (Protected, Admins/Moderators)
router.patch('/:id/moderate', protect, moderatePost);
router.post('/:id/moderate', protect, moderatePost);

// DELETE /api/posts/:id — Delete a post by ID (Protected, Author only)
router.delete('/:id', protect, deletePost);

// ============================================================================
// Likes & Comments Endpoints (Phase 6)
// ============================================================================

// POST /api/posts/:id/like — Toggle like on a post (Protected)
router.post('/:id/like', protect, toggleLike);

// POST /api/posts/:id/save — Toggle save/bookmark on a post (Protected, Phase 12)
router.post('/:id/save', protect, toggleSavePost);

// GET /api/posts/:id/comments — Get post comments thread (Optional Auth)
router.get('/:id/comments', optionalAuth, getComments);

// POST /api/posts/:id/comments — Add a comment to a post (Protected)
router.post('/:id/comments', protect, addComment);

// DELETE /api/posts/comments/:commentId — Delete a comment (Protected, Author/Post Owner)
router.delete('/comments/:commentId', protect, deleteComment);

module.exports = router;


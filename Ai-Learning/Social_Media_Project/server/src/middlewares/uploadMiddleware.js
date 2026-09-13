/**
 * src/middlewares/uploadMiddleware.js
 * ===================================
 * Multer File Upload Configuration & Security
 * 
 * Security Measures:
 * 1. File Type Whitelist: Accepts ONLY images (jpeg, png, webp).
 * 2. File Size Limit: Enforces strict max size (2MB for avatars, 5MB for posts).
 * 3. Safe Filenames: Randomizes filenames using timestamp and crypto bytes to prevent directory traversal and file collisions.
 */

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Ensure upload directories exist
const avatarsDir = path.join(__dirname, '../../uploads/avatars');
const postsDir = path.join(__dirname, '../../uploads/posts');
const storiesDir = path.join(__dirname, '../../uploads/stories');

if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });
if (!fs.existsSync(storiesDir)) fs.mkdirSync(storiesDir, { recursive: true });

// Allowed image MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * File filter to reject non-image files
 */
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
    error.status = 400;
    cb(error, false);
  }
};

// 1. Avatar Upload Storage Configuration
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomHex = crypto.randomBytes(4).toString('hex');
    const userId = req.user ? req.user.id : 'unknown';
    cb(null, `avatar-${userId}-${Date.now()}-${randomHex}${ext}`);
  }
});

// 2. Avatar Multer Instance (Max 2MB)
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter
});

// 3. Post Multer Instance (Max 5MB) — Prepared for Phase 5
const postStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, postsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomHex = crypto.randomBytes(6).toString('hex');
    const userId = req.user ? req.user.id : 'unknown';
    cb(null, `post-${userId}-${Date.now()}-${randomHex}${ext}`);
  }
});

const uploadPost = multer({
  storage: postStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter
});

// 4. Story Multer Instance (Max 5MB)
const storyStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storiesDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomHex = crypto.randomBytes(6).toString('hex');
    const userId = req.user ? req.user.id : 'unknown';
    cb(null, `story-${userId}-${Date.now()}-${randomHex}${ext}`);
  }
});

const uploadStory = multer({
  storage: storyStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter
});

module.exports = {
  uploadAvatar,
  uploadPost,
  uploadStory
};

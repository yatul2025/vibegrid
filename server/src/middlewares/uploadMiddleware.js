/**
 * src/middlewares/uploadMiddleware.js
 * ===================================
 * Multer File Upload Configuration & Security (Serverless-Safe Memory Storage)
 * 
 * Security & Reliability Measures:
 * 1. File Type Whitelist: Accepts ONLY image formats (jpeg, png, webp, gif).
 * 2. In-Memory Storage: Eliminates local filesystem write dependencies, preventing
 *    EROFS (Read-only file system) errors on Vercel Serverless Functions.
 * 3. File Size Limits: Enforces max file sizes (5MB for avatars, 10MB for posts & stories).
 */

const multer = require('multer');

// Allowed image MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
];

/**
 * File filter to reject non-image files
 */
const fileFilter = (req, file, cb) => {
  if (file && file.mimetype && ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.');
    error.status = 400;
    cb(error, false);
  }
};

// Memory storage keeps the incoming file in memory buffer (req.file.buffer)
// so it can be streamed or saved to PostgreSQL / cloud storage without disk writes
const storage = multer.memoryStorage();

// 1. Avatar Multer Instance (Max 5MB)
const uploadAvatar = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter
});

// 2. Post Multer Instance (Max 10MB)
const uploadPost = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter
});

// 3. Story Multer Instance (Max 10MB)
const uploadStory = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter
});

// 4. Encrypted Media Multer Instance (Max 25MB, accepts binary ciphertext)
const uploadEncryptedMedia = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => cb(null, true)
});

module.exports = {
  uploadAvatar,
  uploadPost,
  uploadStory,
  uploadEncryptedMedia
};

/**
 * server/src/utils/mediaStorage.js
 * ================================
 * Serverless & Cloud-Safe Media Storage Manager
 * 
 * Persists uploaded binary assets (avatars, stories, posts) into PostgreSQL (media_files table)
 * so uploads work 100% reliably in serverless environments like Vercel where the local filesystem
 * is read-only and ephemeral. Also writes to local disk when available for local development caching.
 */

const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { query } = require('../config/db');

/**
 * Save an uploaded file buffer to PostgreSQL and optionally local disk
 * @param {Object} file - req.file from multer (memoryStorage)
 * @param {string} folder - 'avatars' | 'posts' | 'stories'
 * @param {string|number} userId
 * @returns {Promise<{ filename: string, url: string }>}
 */
async function saveUploadedMedia(file, folder, userId) {
  if (!file || !file.buffer) {
    throw new Error('No file buffer provided for upload.');
  }

  const ext = (path.extname(file.originalname || '') || '.jpg').toLowerCase();
  const randomHex = crypto.randomBytes(6).toString('hex');
  const filename = `${folder.slice(0, -1)}-${userId || 'anon'}-${Date.now()}-${randomHex}${ext}`;
  const publicUrl = `/uploads/${folder}/${filename}`;

  // 1. Persist to PostgreSQL media_files table (works on Vercel Serverless)
  await query(
    `INSERT INTO media_files (id, folder, mime_type, data, size)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, mime_type = EXCLUDED.mime_type, size = EXCLUDED.size`,
    [filename, folder, file.mimetype || 'image/jpeg', file.buffer, file.size || file.buffer.length]
  );

  // 2. Best-effort local file write if directory is writable (e.g. local development)
  try {
    const localDir = path.join(__dirname, '../../uploads', folder);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    fs.writeFileSync(path.join(localDir, filename), file.buffer);
  } catch (err) {
    // Read-only filesystem on Vercel serverless - safely ignore as DB holds persistent copy
  }

  return { filename, url: publicUrl };
}

/**
 * Delete a media file from PostgreSQL and optionally local disk
 * @param {string} filename - e.g. "avatar-15-xxx.jpg"
 * @param {string} [folder] - 'avatars' | 'posts' | 'stories'
 */
async function deleteUploadedMedia(filename, folder) {
  if (!filename) return;
  try {
    await query('DELETE FROM media_files WHERE id = $1', [filename]);
  } catch (e) {
    console.warn('[Media DB Delete Warning]', e.message);
  }

  if (folder) {
    try {
      const localFile = path.join(__dirname, '../../uploads', folder, filename);
      if (fs.existsSync(localFile)) {
        fs.unlinkSync(localFile);
      }
    } catch (e) {
      // Ignored
    }
  }
}

module.exports = {
  saveUploadedMedia,
  deleteUploadedMedia
};

/**
 * src/controllers/postController.js
 * =================================
 * Posts & Home Feed Controller
 * 
 * Handles:
 * 1. createPost: Uploading photo with caption via Multer.
 * 2. getFeedPosts: Fetching home feed posts with author data & counts.
 * 3. getUserPosts: Fetching posts created by a specific user (for profile grid).
 * 4. deletePost: Removing post and associated image file from disk.
 */

const path = require('path');
const fs = require('fs');
const { query } = require('../config/db');
const { saveUploadedMedia, deleteUploadedMedia } = require('../utils/mediaStorage');

/**
 * Create a new photo post
 * Route: POST /api/posts
 */
const createPost = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Ensure file was uploaded by Multer
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please select an image file to share.'
      });
    }

    // 2. Validate and sanitize caption
    const { caption } = req.body;
    let cleanCaption = '';
    if (caption && typeof caption === 'string') {
      if (caption.trim().length > 2200) {
        return res.status(400).json({
          success: false,
          error: 'Caption cannot exceed 2,200 characters.'
        });
      }
      cleanCaption = caption.trim().slice(0, 2200);
    }

    // 3. Persist file in database & local storage (serverless-safe)
    const { url: imageUrl } = await saveUploadedMedia(req.file, 'posts', userId);

    // 4. Insert post into PostgreSQL
    const insertQuery = `
      INSERT INTO posts (user_id, image_url, caption)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, image_url, caption, created_at
    `;
    const insertResult = await query(insertQuery, [userId, imageUrl, cleanCaption]);
    const createdPost = insertResult.rows[0];

    // 4b. Extract and Index Hashtags (Phase 13)
    if (cleanCaption) {
      const hashtagMatches = cleanCaption.match(/#([a-zA-Z0-9_]+)/g);
      if (hashtagMatches && hashtagMatches.length > 0) {
        const uniqueTags = [...new Set(hashtagMatches.map((t) => t.slice(1).toLowerCase()))];
        for (const tag of uniqueTags) {
          if (tag.length <= 50) {
            try {
              const tagRes = await query(`
                INSERT INTO hashtags (name)
                VALUES ($1)
                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
              `, [tag]);
              const tagId = tagRes.rows[0].id;
              await query(`
                INSERT INTO post_hashtags (post_id, hashtag_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
              `, [createdPost.id, tagId]);
            } catch (tagErr) {
              console.warn('[Hashtag Index Warning]', tagErr.message);
            }
          }
        }
      }
    }

    // 5. Fetch complete post details with author profile
    const fullPostQuery = `
      SELECT 
        p.id,
        p.user_id,
        p.image_url,
        p.caption,
        p.created_at,
        u.username,
        u.full_name,
        u.avatar_url,
        0::int AS likes_count,
        0::int AS comments_count,
        false AS is_liked,
        false AS is_saved
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = $1
      LIMIT 1
    `;
    const fullPostResult = await query(fullPostQuery, [createdPost.id]);

    res.status(201).json({
      success: true,
      message: 'Post published successfully!',
      data: {
        post: fullPostResult.rows[0]
      }
    });
  } catch (error) {
    console.error('[Create Post Error]', error);
    next(error);
  }
};

/**
 * Get home feed posts
 * Route: GET /api/posts/feed
 */
const getFeedPosts = async (req, res, next) => {
  try {
    const currentUserId = req.user ? req.user.id : null;

    // Fetch latest posts with author profile and engagement counts
    const feedQuery = `
      SELECT 
        p.id,
        p.user_id,
        p.image_url,
        p.caption,
        p.created_at,
        u.username,
        u.full_name,
        u.avatar_url,
        (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS likes_count,
        (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS comments_count,
        CASE 
          WHEN $1::int IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1::int)
          ELSE false 
        END AS is_liked,
        CASE 
          WHEN $1::int IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $1::int)
          ELSE false 
        END AS is_saved
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.is_active = TRUE
        AND (
          u.is_private = FALSE
          OR ($1::int IS NOT NULL AND (
            p.user_id = $1::int
            OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $1::int AND f.following_id = p.user_id)
          ))
        )
      ORDER BY p.created_at DESC
      LIMIT 50
    `;
    const result = await query(feedQuery, [currentUserId]);

    res.status(200).json({
      success: true,
      data: {
        posts: result.rows,
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('[Get Feed Posts Error]', error);
    next(error);
  }
};

/**
 * Get all posts created by a specific user (for profile grid)
 * Route: GET /api/posts/user/:username
 */
const getUserPosts = async (req, res, next) => {
  try {
    const { username } = req.params;
    const cleanUsername = username.trim().toLowerCase();
    const currentUserId = req.user ? req.user.id : null;

    // 1. Fetch user privacy state
    const userCheck = await query(
      'SELECT id, is_private FROM users WHERE LOWER(username) = $1 LIMIT 1',
      [cleanUsername]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const targetUser = userCheck.rows[0];
    const isOwn = currentUserId === targetUser.id;

    // 2. If account is private and viewer is not owner, check follow relationship
    if (targetUser.is_private && !isOwn) {
      let isFollowing = false;
      if (currentUserId) {
        const followRes = await query(
          'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1',
          [currentUserId, targetUser.id]
        );
        isFollowing = followRes.rows.length > 0;
      }

      if (!isFollowing) {
        return res.status(200).json({
          success: true,
          data: {
            posts: [],
            total: 0,
            is_locked: true,
            message: 'This account is private. Follow to see their photos and videos.'
          }
        });
      }
    }

    const userPostsQuery = `
      SELECT 
        p.id,
        p.user_id,
        p.image_url,
        p.caption,
        p.created_at,
        p.is_active,
        p.moderation_reason,
        u.username,
        u.avatar_url,
        (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS likes_count,
        (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS comments_count,
        CASE 
          WHEN $2::int IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $2::int)
          ELSE false 
        END AS is_liked,
        CASE 
          WHEN $2::int IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $2::int)
          ELSE false 
        END AS is_saved
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE LOWER(u.username) = $1
        AND (p.is_active = TRUE OR ($2::int IS NOT NULL AND p.user_id = $2::int))
      ORDER BY p.created_at DESC
    `;
    const result = await query(userPostsQuery, [cleanUsername, currentUserId]);

    res.status(200).json({
      success: true,
      data: {
        posts: result.rows,
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('[Get User Posts Error]', error);
    next(error);
  }
};

/**
 * Delete a post (Author only)
 * Route: DELETE /api/posts/:id
 */
const deletePost = async (req, res, next) => {
  try {
    const postId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(postId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid post ID.'
      });
    }

    // 1. Verify post exists and user owns it
    const postCheck = await query(
      'SELECT id, user_id, image_url FROM posts WHERE id = $1 LIMIT 1',
      [postId]
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found.'
      });
    }

    const post = postCheck.rows[0];
    if (post.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to delete this post.'
      });
    }

    // 2. Delete database record (cascades to likes and comments)
    await query('DELETE FROM posts WHERE id = $1', [postId]);

    // 3. Remove media file from storage (DB & local cache)
    if (post.image_url && post.image_url.startsWith('/uploads/posts/')) {
      const filename = path.basename(post.image_url);
      deleteUploadedMedia(filename, 'posts').catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully!'
    });
  } catch (error) {
    console.error('[Delete Post Error]', error);
    next(error);
  }
};

/**
 * Get explore / discovery posts
 * Route: GET /api/posts/explore
 */
const getExplorePosts = async (req, res, next) => {
  try {
    const viewerId = req.user ? req.user.id : null;

    const exploreQuery = `
      SELECT 
        p.id,
        p.user_id,
        p.image_url,
        p.caption,
        p.created_at,
        u.username,
        u.full_name,
        u.avatar_url,
        (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS likes_count,
        (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS comments_count,
        CASE 
          WHEN $1::int IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1::int)
          ELSE false 
        END AS is_liked,
        CASE 
          WHEN $1::int IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $1::int)
          ELSE false 
        END AS is_saved
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.is_active = TRUE AND u.is_private = FALSE
      ORDER BY likes_count DESC, p.created_at DESC
      LIMIT 60
    `;
    const result = await query(exploreQuery, [viewerId]);

    res.status(200).json({
      success: true,
      data: {
        posts: result.rows,
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('[Get Explore Posts Error]', error);
    next(error);
  }
};

/**
 * Toggle bookmark / save on a post
 * Route: POST /api/posts/:id/save
 */
const toggleSavePost = async (req, res, next) => {
  try {
    const postId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(postId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid post ID.'
      });
    }

    // 1. Verify post exists and is active
    const postCheck = await query('SELECT id FROM posts WHERE id = $1 AND is_active = TRUE LIMIT 1', [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found or has been removed.'
      });
    }

    // 2. Check if already saved
    const savedCheck = await query(
      'SELECT id FROM saved_posts WHERE user_id = $1 AND post_id = $2 LIMIT 1',
      [userId, postId]
    );

    let isSaved = false;
    if (savedCheck.rows.length > 0) {
      // Unsave
      await query('DELETE FROM saved_posts WHERE user_id = $1 AND post_id = $2', [userId, postId]);
      isSaved = false;
    } else {
      // Save
      await query('INSERT INTO saved_posts (user_id, post_id) VALUES ($1, $2)', [userId, postId]);
      isSaved = true;
    }

    res.status(200).json({
      success: true,
      message: isSaved ? 'Post saved to your collection.' : 'Post removed from saved.',
      data: {
        postId,
        is_saved: isSaved
      }
    });
  } catch (error) {
    console.error('[Toggle Save Post Error]', error);
    next(error);
  }
};

/**
 * Get all posts saved by the authenticated user
 * Route: GET /api/posts/saved
 */
const getSavedPosts = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const savedQuery = `
      SELECT 
        p.id,
        p.user_id,
        p.image_url,
        p.caption,
        p.created_at,
        sp.created_at AS saved_at,
        u.username,
        u.full_name,
        u.avatar_url,
        (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS likes_count,
        (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS comments_count,
        EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1::int) AS is_liked,
        true AS is_saved
      FROM saved_posts sp
      JOIN posts p ON sp.post_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE sp.user_id = $1 AND p.is_active = TRUE
      ORDER BY sp.created_at DESC
    `;
    const result = await query(savedQuery, [userId]);

    res.status(200).json({
      success: true,
      data: {
        posts: result.rows,
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('[Get Saved Posts Error]', error);
    next(error);
  }
};

/**
 * Moderate a post (toggle active/inactive status and set moderation reason)
 * Route: PATCH /api/posts/:id/moderate
 */
const moderatePost = async (req, res, next) => {
  try {
    const postId = parseInt(req.params.id, 10);
    const callerId = req.user.id;
    const { isActive = false, reason = 'Prohibited or adult content' } = req.body;

    if (isNaN(postId)) {
      return res.status(400).json({ success: false, error: 'Invalid post ID.' });
    }

    // Check caller authorization: User IDs 1..4 or test=1 or admin
    const userRes = await query('SELECT id, COALESCE(test, 0) AS test FROM users WHERE id = $1 LIMIT 1', [callerId]);
    const isAuthorized = [1, 2, 3, 4].includes(Number(callerId)) || Number(userRes.rows[0]?.test) === 1;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized. Only administrators and moderators can moderate posts.'
      });
    }

    // Check post exists
    const postCheck = await query('SELECT id, user_id, is_active FROM posts WHERE id = $1 LIMIT 1', [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Post not found.' });
    }

    const activeBool = Boolean(isActive);
    const deactivatedAt = activeBool ? null : new Date();
    const modReason = activeBool ? null : (reason ? String(reason).trim().substring(0, 100) : 'Prohibited or adult content');

    const updateRes = await query(
      `UPDATE posts 
       SET is_active = $1, moderation_reason = $2, deactivated_at = $3 
       WHERE id = $4 
       RETURNING id, user_id, is_active, moderation_reason, deactivated_at, created_at`,
      [activeBool, modReason, deactivatedAt, postId]
    );

    return res.status(200).json({
      success: true,
      message: activeBool ? 'Post has been restored and is now active.' : 'Post has been deactivated and hidden from all feeds.',
      data: {
        post: updateRes.rows[0]
      }
    });
  } catch (error) {
    console.error('[Moderate Post Error]', error);
    next(error);
  }
};

module.exports = {
  createPost,
  getFeedPosts,
  getUserPosts,
  deletePost,
  getExplorePosts,
  toggleSavePost,
  getSavedPosts,
  moderatePost
};


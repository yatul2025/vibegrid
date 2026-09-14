/**
 * src/controllers/engagementController.js
 * =======================================
 * Post Engagement Controller: Likes & Comments
 * 
 * Handles:
 * 1. toggleLike: Atomic like/unlike toggle for a post in PostgreSQL.
 * 2. getComments: Retrieves comments thread for a post with author info.
 * 3. addComment: Inserts a new comment (max 500 chars) with author profile.
 * 4. deleteComment: Deletes comment (authorized for comment author OR post owner).
 */

const { query } = require('../config/db');
const cacheManager = require('../services/cache/CacheManager');

/**
 * Toggle like/unlike on a post
 * Route: POST /api/posts/:id/like
 */
const toggleLike = async (req, res, next) => {
  try {
    const rawPostId = String(req.params.id);
    const userId = req.user.id;
    const isExternal = rawPostId.startsWith('ext_') || isNaN(parseInt(rawPostId, 10));

    // Handle like toggle for external discovery posts (Cache-backed, zero DB footprint)
    if (isExternal) {
      const likesSetKey = `likes:${rawPostId}`;
      const hasLiked = await cacheManager.sismember(likesSetKey, userId);
      let liked = false;
      if (hasLiked) {
        await cacheManager.srem(likesSetKey, userId);
        liked = false;
      } else {
        await cacheManager.sadd(likesSetKey, userId, 604800);
        liked = true;
      }
      const likesCount = await cacheManager.scard(likesSetKey);
      return res.status(200).json({
        success: true,
        data: {
          postId: rawPostId,
          liked,
          likes_count: likesCount
        }
      });
    }

    const postId = parseInt(rawPostId, 10);

    // 1. Verify post exists and is active
    const postCheck = await query(
      `SELECT p.id, p.user_id, COALESCE(u.notif_likes, true) AS notif_likes 
       FROM posts p 
       JOIN users u ON p.user_id = u.id 
       WHERE p.id = $1 AND p.is_active = TRUE LIMIT 1`,
      [postId]
    );
    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post does not exist or has been removed.'
      });
    }

    const postOwnerId = postCheck.rows[0].user_id;

    // 2. Check if user already liked this post
    const existingLike = await query(
      'SELECT id FROM likes WHERE user_id = $1 AND post_id = $2 LIMIT 1',
      [userId, postId]
    );

    let liked = false;
    if (existingLike.rows.length > 0) {
      // User already liked -> UNLIKE (Delete row)
      await query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [userId, postId]);
      liked = false;

      // Remove notification on unlike
      try {
        await query(
          'DELETE FROM notifications WHERE recipient_id = $1 AND sender_id = $2 AND type = $3 AND post_id = $4',
          [postOwnerId, userId, 'like', postId]
        );
      } catch (notifErr) {
        console.warn('[Notification Error]', notifErr.message);
      }
    } else {
      // User hasn't liked -> LIKE (Insert row)
      await query(
        'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, postId]
      );
      liked = true;

      // Insert notification if not liking own post and recipient allows like notifications
      if (postOwnerId !== userId && postCheck.rows[0].notif_likes !== false) {
        try {
          await query(
            `INSERT INTO notifications (recipient_id, sender_id, type, post_id)
             VALUES ($1, $2, 'like', $3)`,
            [postOwnerId, userId, postId]
          );
        } catch (notifErr) {
          console.warn('[Notification Error]', notifErr.message);
        }
      }
    }

    // 3. Get updated like count
    const countResult = await query(
      'SELECT COUNT(*)::int AS count FROM likes WHERE post_id = $1',
      [postId]
    );
    const likesCount = countResult.rows[0].count;

    res.status(200).json({
      success: true,
      data: {
        postId,
        liked,
        likes_count: likesCount
      }
    });
  } catch (error) {
    console.error('[Toggle Like Error]', error);
    next(error);
  }
};

/**
 * Get all comments for a post
 * Route: GET /api/posts/:id/comments
 */
const getComments = async (req, res, next) => {
  try {
    const rawPostId = String(req.params.id);
    const isExternal = rawPostId.startsWith('ext_') || isNaN(parseInt(rawPostId, 10));

    // For external discovery posts, return cached comments (zero DB queries)
    if (isExternal) {
      const cachedComments = (await cacheManager.get(`comments:${rawPostId}`)) || [];
      return res.status(200).json({
        success: true,
        data: {
          comments: cachedComments,
          total: cachedComments.length
        }
      });
    }

    const postId = parseInt(rawPostId, 10);

    const commentsQuery = `
      SELECT 
        c.id,
        c.post_id,
        c.user_id,
        c.comment_text,
        c.created_at,
        u.username,
        u.avatar_url,
        u.full_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC
    `;
    const result = await query(commentsQuery, [postId]);

    res.status(200).json({
      success: true,
      data: {
        comments: result.rows,
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('[Get Comments Error]', error);
    next(error);
  }
};

/**
 * Add a comment to a post
 * Route: POST /api/posts/:id/comments
 */
const addComment = async (req, res, next) => {
  try {
    const rawPostId = String(req.params.id);
    const userId = req.user.id;
    const isExternal = rawPostId.startsWith('ext_') || isNaN(parseInt(rawPostId, 10));
    const rawText = req.body.comment_text || req.body.content;

    // Validate comment text
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Comment cannot be empty.'
      });
    }

    if (rawText.trim().length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Comment cannot exceed 500 characters.'
      });
    }

    const cleanText = rawText.trim().slice(0, 500);

    // Handle comment addition for external discovery posts (zero PostgreSQL writes)
    if (isExternal) {
      let authorName = req.user.full_name || 'VibeGrid User';
      let authorUsername = req.user.username || 'vibegrid_user';
      let authorAvatar = req.user.avatar_url || null;

      try {
        const uRes = await query('SELECT username, full_name, avatar_url FROM users WHERE id = $1 LIMIT 1', [userId]);
        if (uRes.rows.length > 0) {
          authorUsername = uRes.rows[0].username || authorUsername;
          authorName = uRes.rows[0].full_name || authorName;
          authorAvatar = uRes.rows[0].avatar_url || authorAvatar;
        }
      } catch (uErr) {
        // Fallback to req.user
      }

      const commentId = `ext_cmt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newComment = {
        id: commentId,
        post_id: rawPostId,
        user_id: userId,
        comment_text: cleanText,
        created_at: new Date().toISOString(),
        username: authorUsername,
        full_name: authorName,
        avatar_url: authorAvatar
      };

      const cacheKey = `comments:${rawPostId}`;
      const cachedComments = (await cacheManager.get(cacheKey)) || [];
      cachedComments.push(newComment);
      await cacheManager.set(cacheKey, cachedComments, 604800); // 7-day TTL

      // Store reverse metadata for deletion
      await cacheManager.set(`ext_cmt_meta:${commentId}`, { postId: rawPostId, userId }, 604800);

      return res.status(201).json({
        success: true,
        message: 'Comment added successfully!',
        data: {
          comment: newComment,
          comments_count: cachedComments.length
        }
      });
    }

    const postId = parseInt(rawPostId, 10);
    const comment_text = cleanText;

    // 1. Verify post exists, is active, and fetch author's privacy permissions and notification settings
    const postCheck = await query(
      `SELECT p.id, p.user_id, u.allow_comments_from, COALESCE(u.notif_comments, true) AS notif_comments 
       FROM posts p 
       JOIN users u ON p.user_id = u.id 
       WHERE p.id = $1 AND p.is_active = TRUE LIMIT 1`,
      [postId]
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post does not exist or has been removed.'
      });
    }

    const postOwnerId = postCheck.rows[0].user_id;
    const allowComments = postCheck.rows[0].allow_comments_from || 'everyone';

    // Privacy authorization: Enforce author's comment preferences
    if (postOwnerId !== userId) {
      if (allowComments === 'nobody') {
        return res.status(403).json({
          success: false,
          error: 'Comments are disabled on this post.'
        });
      }
      if (allowComments === 'following') {
        const followCheck = await query(
          'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1',
          [postOwnerId, userId]
        );
        if (followCheck.rows.length === 0) {
          return res.status(403).json({
            success: false,
            error: 'Only accounts followed by the author can comment on this post.'
          });
        }
      }
    }

    // 2. Insert comment into PostgreSQL
    const insertQuery = `
      INSERT INTO comments (user_id, post_id, comment_text)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, post_id, comment_text, created_at
    `;
    const insertResult = await query(insertQuery, [userId, postId, cleanText]);
    const createdComment = insertResult.rows[0];

    // Trigger notification if commenting on someone else's post and recipient allows comment notifications
    if (postOwnerId !== userId && postCheck.rows[0].notif_comments !== false) {
      try {
        await query(
          `INSERT INTO notifications (recipient_id, sender_id, type, post_id, comment_text)
           VALUES ($1, $2, 'comment', $3, $4)`,
          [postOwnerId, userId, postId, cleanText.slice(0, 150)]
        );
      } catch (notifErr) {
        console.warn('[Notification Error]', notifErr.message);
      }
    }

    // 3. Fetch full comment record with author profile
    const fullCommentQuery = `
      SELECT 
        c.id,
        c.post_id,
        c.user_id,
        c.comment_text,
        c.created_at,
        u.username,
        u.avatar_url,
        u.full_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
      LIMIT 1
    `;
    const fullResult = await query(fullCommentQuery, [createdComment.id]);

    // 4. Get updated comment count for the post
    const countResult = await query(
      'SELECT COUNT(*)::int AS count FROM comments WHERE post_id = $1',
      [postId]
    );

    res.status(201).json({
      success: true,
      message: 'Comment added successfully!',
      data: {
        comment: fullResult.rows[0],
        comments_count: countResult.rows[0].count
      }
    });
  } catch (error) {
    console.error('[Add Comment Error]', error);
    next(error);
  }
};

/**
 * Delete a comment (Author or Post Owner)
 * Route: DELETE /api/posts/comments/:commentId
 */
const deleteComment = async (req, res, next) => {
  try {
    const rawCommentId = String(req.params.commentId);
    const userId = req.user.id;

    // Handle deletion of external post comments
    if (rawCommentId.startsWith('ext_cmt_') || isNaN(parseInt(rawCommentId, 10))) {
      const metaKey = `ext_cmt_meta:${rawCommentId}`;
      const meta = await cacheManager.get(metaKey);
      if (!meta) {
        return res.status(404).json({
          success: false,
          error: 'Comment not found.'
        });
      }

      if (meta.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to delete this comment.'
        });
      }

      const postCommentsKey = `comments:${meta.postId}`;
      let cachedComments = (await cacheManager.get(postCommentsKey)) || [];
      cachedComments = cachedComments.filter((c) => String(c.id) !== rawCommentId);
      await cacheManager.set(postCommentsKey, cachedComments, 604800);
      await cacheManager.del(metaKey);

      return res.status(200).json({
        success: true,
        message: 'Comment deleted successfully.',
        data: {
          commentId: rawCommentId,
          postId: meta.postId,
          comments_count: cachedComments.length
        }
      });
    }

    const commentId = parseInt(rawCommentId, 10);

    // 1. Fetch comment and associated post owner
    const commentQuery = `
      SELECT c.id, c.user_id, c.post_id, p.user_id AS post_author_id
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      WHERE c.id = $1
      LIMIT 1
    `;
    const commentCheck = await query(commentQuery, [commentId]);

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found.'
      });
    }

    const row = commentCheck.rows[0];

    // 2. Authorization: Comment author OR Post owner can delete
    if (row.user_id !== userId && row.post_author_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this comment.'
      });
    }

    // 3. Delete comment
    await query('DELETE FROM comments WHERE id = $1', [commentId]);

    // 4. Get updated comments count
    const countResult = await query(
      'SELECT COUNT(*)::int AS count FROM comments WHERE post_id = $1',
      [row.post_id]
    );

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully.',
      data: {
        commentId,
        postId: row.post_id,
        comments_count: countResult.rows[0].count
      }
    });
  } catch (error) {
    console.error('[Delete Comment Error]', error);
    next(error);
  }
};

module.exports = {
  toggleLike,
  getComments,
  addComment,
  deleteComment
};

/**
 * src/controllers/followController.js
 * ===================================
 * Follow / Unfollow & Social Graph Controller
 * 
 * Handles:
 * 1. toggleFollow: Follows or unfollows a target user with self-follow checks.
 * 2. getFollowers: Retrieves list of followers for a given username.
 * 3. getFollowing: Retrieves list of accounts a given username follows.
 */

const { query } = require('../config/db');

/**
 * Toggle follow / unfollow on a user
 * Route: POST /api/users/:username/follow-toggle
 */
const toggleFollow = async (req, res, next) => {
  try {
    const { username } = req.params;
    const cleanUsername = username.trim().toLowerCase();
    const requesterId = req.user.id;

    // 1. Fetch target user
    const targetUserRes = await query(
      'SELECT id, username, COALESCE(notif_follows, true) AS notif_follows FROM users WHERE LOWER(username) = $1 LIMIT 1',
      [cleanUsername]
    );

    if (targetUserRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User @${cleanUsername} not found.`
      });
    }

    const targetUser = targetUserRes.rows[0];

    // 2. Prevent self-following
    if (requesterId === targetUser.id) {
      return res.status(400).json({
        success: false,
        error: 'You cannot follow your own account.'
      });
    }

    // 3. Check if relationship already exists
    const checkFollowRes = await query(
      'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1',
      [requesterId, targetUser.id]
    );

    let isFollowing = false;
    if (checkFollowRes.rows.length > 0) {
      // Already following -> UNFOLLOW (Delete)
      await query(
        'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
        [requesterId, targetUser.id]
      );
      isFollowing = false;

      // Delete follow notification
      try {
        await query(
          'DELETE FROM notifications WHERE recipient_id = $1 AND sender_id = $2 AND type = $3',
          [targetUser.id, requesterId, 'follow']
        );
      } catch (notifErr) {
        console.warn('[Notification Error]', notifErr.message);
      }
    } else {
      // Not following yet -> FOLLOW (Insert)
      await query(
        'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [requesterId, targetUser.id]
      );
      isFollowing = true;

      // Insert follow notification if recipient allows follow notifications
      if (targetUser.notif_follows !== false) {
        try {
          await query(
            `INSERT INTO notifications (recipient_id, sender_id, type)
             VALUES ($1, $2, 'follow')`,
            [targetUser.id, requesterId]
          );
        } catch (notifErr) {
          console.warn('[Notification Error]', notifErr.message);
        }
      }
    }

    // 4. Query updated followers count for the target user
    const followersCountRes = await query(
      'SELECT COUNT(*)::int AS count FROM follows WHERE following_id = $1',
      [targetUser.id]
    );

    res.status(200).json({
      success: true,
      message: isFollowing ? `You are now following @${targetUser.username}` : `Unfollowed @${targetUser.username}`,
      data: {
        username: targetUser.username,
        isFollowing,
        followersCount: followersCountRes.rows[0].count
      }
    });
  } catch (error) {
    console.error('[Toggle Follow Error]', error);
    next(error);
  }
};

/**
 * Get all followers of a user
 * Route: GET /api/users/:username/followers
 */
const getFollowers = async (req, res, next) => {
  try {
    const { username } = req.params;
    const cleanUsername = username.trim().toLowerCase();
    const viewerId = req.user ? req.user.id : null;

    // 1. Get target user ID
    const targetUserRes = await query(
      'SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1',
      [cleanUsername]
    );

    if (targetUserRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User @${cleanUsername} not found.`
      });
    }

    const targetUserId = targetUserRes.rows[0].id;

    // 2. Fetch followers list with viewer's is_following state
    const followersQuery = `
      SELECT 
        u.id,
        u.username,
        u.full_name,
        u.avatar_url,
        CASE 
          WHEN $2::int IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM follows f2 WHERE f2.follower_id = $2::int AND f2.following_id = u.id)
          ELSE false 
        END AS is_following
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = $1
      ORDER BY f.created_at DESC
    `;
    const result = await query(followersQuery, [targetUserId, viewerId]);

    res.status(200).json({
      success: true,
      data: {
        users: result.rows,
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('[Get Followers Error]', error);
    next(error);
  }
};

/**
 * Get all users that a user follows
 * Route: GET /api/users/:username/following
 */
const getFollowing = async (req, res, next) => {
  try {
    const { username } = req.params;
    const cleanUsername = username.trim().toLowerCase();
    const viewerId = req.user ? req.user.id : null;

    // 1. Get target user ID
    const targetUserRes = await query(
      'SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1',
      [cleanUsername]
    );

    if (targetUserRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User @${cleanUsername} not found.`
      });
    }

    const targetUserId = targetUserRes.rows[0].id;

    // 2. Fetch following list with viewer's is_following state
    const followingQuery = `
      SELECT 
        u.id,
        u.username,
        u.full_name,
        u.avatar_url,
        CASE 
          WHEN $2::int IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM follows f2 WHERE f2.follower_id = $2::int AND f2.following_id = u.id)
          ELSE false 
        END AS is_following
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = $1
      ORDER BY f.created_at DESC
    `;
    const result = await query(followingQuery, [targetUserId, viewerId]);

    res.status(200).json({
      success: true,
      data: {
        users: result.rows,
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('[Get Following Error]', error);
    next(error);
  }
};

module.exports = {
  toggleFollow,
  getFollowers,
  getFollowing
};

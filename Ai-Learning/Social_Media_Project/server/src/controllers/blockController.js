/**
 * server/src/controllers/blockController.js
 * =========================================
 * User Blocking & Safety Controller
 */

const { query } = require('../config/db');

/**
 * @desc    Block a user
 * @route   POST /api/users/block/:userId
 * @access  Private (Authenticated)
 */
const blockUser = async (req, res, next) => {
  try {
    const blockerId = req.user.id;
    const targetUserId = Number(req.params.userId);

    if (!targetUserId || targetUserId === blockerId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user to block.'
      });
    }

    // Insert into blocked_users
    await query(
      `INSERT INTO blocked_users (blocker_id, blocked_id)
       VALUES ($1, $2)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blockerId, targetUserId]
    );

    // Also remove follow relationships if any exist
    await query(
      `DELETE FROM follows 
       WHERE (follower_id = $1 AND following_id = $2) 
          OR (follower_id = $2 AND following_id = $1)`,
      [blockerId, targetUserId]
    );

    res.status(200).json({
      success: true,
      message: 'User has been blocked successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Unblock a user
 * @route   DELETE /api/users/block/:userId
 * @access  Private (Authenticated)
 */
const unblockUser = async (req, res, next) => {
  try {
    const blockerId = req.user.id;
    const targetUserId = Number(req.params.userId);

    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'Invalid user to unblock.' });
    }

    await query(
      'DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
      [blockerId, targetUserId]
    );

    res.status(200).json({
      success: true,
      message: 'User unblocked successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get list of blocked users
 * @route   GET /api/users/blocked
 * @access  Private (Authenticated)
 */
const getBlockedUsers = async (req, res, next) => {
  try {
    const blockerId = req.user.id;

    const result = await query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, b.created_at AS blocked_at
       FROM blocked_users b
       JOIN users u ON b.blocked_id = u.id
       WHERE b.blocker_id = $1
       ORDER BY b.created_at DESC`,
      [blockerId]
    );

    res.status(200).json({
      success: true,
      data: {
        blockedUsers: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  blockUser,
  unblockUser,
  getBlockedUsers
};

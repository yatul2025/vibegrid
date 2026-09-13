/**
 * src/controllers/notificationController.js
 * =========================================
 * Real-Time / In-App Notifications Controller
 * 
 * Handles:
 * 1. getNotifications: Fetches user activity notifications with sender info and post thumbnails.
 * 2. getUnreadCount: Returns badge counter for unread notifications.
 * 3. markAllAsRead: Marks all notifications as read for current user.
 * 4. deleteNotification: Dismisses an individual notification.
 */

const { query } = require('../config/db');

/**
 * @desc    Get current user's notifications
 * @route   GET /api/notifications
 * @access  Private (Authenticated)
 */
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const notifQuery = `
      SELECT 
        n.id,
        n.recipient_id,
        n.sender_id,
        n.type,
        n.post_id,
        n.comment_text,
        n.is_read,
        n.created_at,
        u.username AS sender_username,
        u.full_name AS sender_full_name,
        u.avatar_url AS sender_avatar_url,
        p.image_url AS post_image_url
      FROM notifications n
      JOIN users u ON n.sender_id = u.id
      LEFT JOIN posts p ON n.post_id = p.id
      WHERE n.recipient_id = $1
      ORDER BY n.created_at DESC
      LIMIT 50
    `;

    const result = await query(notifQuery, [userId]);

    res.status(200).json({
      success: true,
      data: {
        notifications: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get count of unread notifications
 * @route   GET /api/notifications/unread-count
 * @access  Private (Authenticated)
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const countQuery = `
      SELECT COUNT(*)::int AS count
      FROM notifications
      WHERE recipient_id = $1 AND is_read = FALSE
    `;

    const result = await query(countQuery, [userId]);
    const unreadCount = result.rows[0].count;

    res.status(200).json({
      success: true,
      data: {
        unreadCount
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/notifications/mark-read
 * @access  Private (Authenticated)
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await query(
      'UPDATE notifications SET is_read = TRUE WHERE recipient_id = $1 AND is_read = FALSE',
      [userId]
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Dismiss / delete a single notification
 * @route   DELETE /api/notifications/:id
 * @access  Private (Authenticated)
 */
const deleteNotification = async (req, res, next) => {
  try {
    const notifId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(notifId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid notification ID.'
      });
    }

    const deleteQuery = `
      DELETE FROM notifications
      WHERE id = $1 AND recipient_id = $2
      RETURNING id
    `;
    const result = await query(deleteQuery, [notifId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found or unauthorized.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification dismissed.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  deleteNotification
};

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

/**
 * @desc    Get VAPID Public Key for client-side PushSubscription
 * @route   GET /api/notifications/vapid-public-key
 * @access  Private (Authenticated)
 */
const getVapidPublicKey = async (req, res, next) => {
  try {
    const pushService = require('../services/pushService');
    const publicKey = pushService.getVapidPublicKey();
    res.status(200).json({
      success: true,
      data: {
        publicKey
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Save/Register a Web Push Subscription for the authenticated user
 * @route   POST /api/notifications/push-subscribe
 * @access  Private (Authenticated)
 */
const subscribePush = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { endpoint, keys, userAgent } = req.body;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({
        success: false,
        error: 'Invalid push subscription payload. Missing endpoint or keys.'
      });
    }

    const upsertQuery = `
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, endpoint)
      DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, created_at
    `;

    const result = await query(upsertQuery, [
      userId,
      endpoint,
      keys.p256dh,
      keys.auth,
      userAgent || req.headers['user-agent'] || null
    ]);

    res.status(201).json({
      success: true,
      message: 'Push subscription registered successfully.',
      data: {
        subscriptionId: result.rows[0].id
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Unsubscribe / remove a Web Push Subscription
 * @route   POST /api/notifications/push-unsubscribe
 * @access  Private (Authenticated)
 */
const unsubscribePush = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Subscription endpoint is required.'
      });
    }

    await query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [userId, endpoint]
    );

    res.status(200).json({
      success: true,
      message: 'Push subscription removed successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Web Push registration status & device diagnostic info
 * @route   GET /api/notifications/push-status
 * @access  Private (Authenticated)
 */
const getPushStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const pushService = require('../services/pushService');

    const subsRes = await query(
      `SELECT id, endpoint, user_agent, created_at, updated_at 
       FROM push_subscriptions 
       WHERE user_id = $1 
       ORDER BY updated_at DESC`,
      [userId]
    );

    res.status(200).json({
      success: true,
      data: {
        isVapidConfigured: Boolean(pushService.getVapidPublicKey()),
        activeSubscriptionsCount: subsRes.rows.length,
        subscriptions: subsRes.rows.map(s => ({
          id: s.id,
          endpointDomain: new URL(s.endpoint).hostname,
          userAgent: s.user_agent,
          lastUpdated: s.updated_at
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send an immediate real Web Push test notification to current user's registered devices
 * @route   POST /api/notifications/test-push
 * @access  Private (Authenticated)
 */
const sendTestPush = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const pushService = require('../services/pushService');

    const result = await pushService.sendPushNotification(userId, {
      title: '🎉 VibeGrid Push Notification',
      body: 'Real Web Push is working! Notifications will now arrive even when the app is in the background or closed.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'vibegrid-test',
      type: 'test',
      data: {
        url: '/#settings',
        testId: Date.now()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Test notification triggered.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  deleteNotification,
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
  getPushStatus,
  sendTestPush
};


/**
 * server/src/services/pushService.js
 * ===================================
 * Real Server-Side Web Push Delivery Service
 * 
 * Features:
 * 1. Manages VAPID credentials via web-push.
 * 2. Checks recipient user preferences before sending (respects mute/opt-out).
 * 3. Delivers Web Push to all active devices registered to the user.
 * 4. Automatically purges expired/invalidated subscriptions (HTTP 404 / 410).
 * 5. Supports high-priority urgency and short TTL for incoming calls.
 */

let webpush;
try {
  webpush = require('web-push');
} catch (e1) {
  try {
    webpush = require('../../node_modules/web-push');
  } catch (e2) {
    try {
      webpush = require('../../../node_modules/web-push');
    } catch (e3) {
      console.warn('[WebPush] web-push module could not be loaded:', e1.message);
    }
  }
}

const config = require('../config/env');
const { query } = require('../config/db');

// Configure VAPID details globally
if (webpush && config.vapid?.publicKey && config.vapid?.privateKey) {
  try {
    webpush.setVapidDetails(
      config.vapid.subject || 'mailto:support@vibegrid.app',
      config.vapid.publicKey,
      config.vapid.privateKey
    );
    console.log('✅ [WebPush] VAPID configured with subject:', config.vapid.subject);
  } catch (err) {
    console.error('❌ [WebPush] VAPID initialization failed:', err.message);
  }
}

/**
 * Returns public VAPID key for client subscriptions
 */
function getVapidPublicKey() {
  return config.vapid.publicKey;
}

/**
 * Sends a real Web Push notification to all active devices of a user
 * 
 * @param {number} userId - Recipient user ID
 * @param {object} notification - Notification payload descriptor
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body preview
 * @param {string} [notification.icon] - App icon URL
 * @param {string} [notification.badge] - Small badge icon URL
 * @param {string} [notification.tag] - Notification grouping tag (prevents duplicates)
 * @param {string} [notification.type] - Notification category ('dm', 'call', 'follow', 'like', 'comment', 'test')
 * @param {object} [notification.data] - Deep link metadata (url, conversationId, username, callId)
 */
async function sendPushNotification(userId, notification) {
  try {
    if (!userId) return { sent: 0, error: 'No recipient specified' };

    // 1. Check recipient user notification preferences
    const userRes = await query(
      `SELECT 
        notif_messages, 
        notif_calls, 
        notif_follows, 
        notif_likes, 
        notif_comments, 
        notif_mentions
       FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (!userRes || !userRes.rows || userRes.rows.length === 0) {
      return { sent: 0, error: 'Recipient user not found' };
    }

    const prefs = userRes.rows[0];
    const type = notification.type || 'general';

    // Respect user privacy toggles
    if (type === 'dm' && prefs.notif_messages === false) {
      return { sent: 0, skipped: 'notif_messages_disabled' };
    }
    if (type === 'call' && prefs.notif_calls === false) {
      return { sent: 0, skipped: 'notif_calls_disabled' };
    }
    if ((type === 'follow' || type === 'follow_request') && prefs.notif_follows === false) {
      return { sent: 0, skipped: 'notif_follows_disabled' };
    }
    if (type === 'like' && prefs.notif_likes === false) {
      return { sent: 0, skipped: 'notif_likes_disabled' };
    }
    if (type === 'comment' && prefs.notif_comments === false) {
      return { sent: 0, skipped: 'notif_comments_disabled' };
    }

    // 2. Fetch all registered push subscriptions for this user
    const subsRes = await query(
      'SELECT id, endpoint, p256dh, auth, user_agent FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    if (!subsRes || !subsRes.rows || subsRes.rows.length === 0) {
      return { sent: 0, reason: 'no_registered_subscriptions' };
    }

    // 3. Construct standard W3C Push payload
    const payload = JSON.stringify({
      title: notification.title || 'VibeGrid',
      body: notification.body || '',
      icon: notification.icon || '/icons/icon-192.png',
      badge: notification.badge || '/icons/icon-192.png',
      tag: notification.tag || `vg-${type}-${Date.now()}`,
      data: {
        url: notification.data?.url || '/',
        type: type,
        timestamp: Date.now(),
        ...notification.data
      }
    });

    const isCall = type === 'call';
    const options = {
      TTL: isCall ? 60 : 86400, // Calls expire in 60s if not delivered; other notifications persist 24h
      urgency: isCall ? 'high' : 'normal'
    };

    if (!webpush) {
      console.warn('[WebPush] webpush client unavailable, skipping push dispatch.');
      return { sent: 0, skipped: 'webpush_unavailable' };
    }

    // 4. Send to all devices concurrently
    let sentCount = 0;
    let prunedCount = 0;

    const deliveryPromises = subsRes.rows.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, payload, options);
        sentCount++;
      } catch (err) {
        // Status 404 (Not Found) or 410 (Gone) indicates the subscription is no longer valid
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[WebPush] Subscription expired (status ${err.statusCode}). Removing sub ID: ${sub.id}`);
          await query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
          prunedCount++;
        } else {
          console.warn(`[WebPush Error] Endpoint delivery failed (status ${err.statusCode || 'N/A'}):`, err.message);
        }
      }
    });

    await Promise.all(deliveryPromises);

    return {
      success: true,
      sent: sentCount,
      totalDevices: subsRes.rows.length,
      pruned: prunedCount
    };
  } catch (error) {
    console.error('[WebPush Service Error]:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Directly sends a test push notification to an individual subscription
 */
async function sendPushToSubscription(subscription, notification) {
  const payload = JSON.stringify({
    title: notification.title || 'VibeGrid Test',
    body: notification.body || 'This is a test notification from VibeGrid.',
    icon: notification.icon || '/icons/icon-192.png',
    badge: notification.badge || '/icons/icon-192.png',
    tag: notification.tag || `vg-test-${Date.now()}`,
    data: {
      url: notification.data?.url || '/#settings',
      type: 'test',
      timestamp: Date.now(),
      ...notification.data
    }
  });

  return webpush.sendNotification(subscription, payload, {
    TTL: 86400,
    urgency: 'high'
  });
}

module.exports = {
  getVapidPublicKey,
  sendPushNotification,
  sendPushToSubscription
};

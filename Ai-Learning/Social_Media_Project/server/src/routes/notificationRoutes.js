/**
 * src/routes/notificationRoutes.js
 * =================================
 * API Routes for Activity Notifications
 * 
 * Endpoints:
 * - GET    /api/notifications              (Fetch recent notifications)
 * - GET    /api/notifications/unread-count (Unread notification count)
 * - PUT    /api/notifications/mark-read    (Mark all notifications as read)
 * - DELETE /api/notifications/:id          (Dismiss a single notification)
 */

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middlewares/authMiddleware');

// All notification routes require authentication
router.use(protect);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.put('/mark-read', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);

// Web Push API Routes
router.get('/vapid-public-key', notificationController.getVapidPublicKey);
router.post('/push-subscribe', notificationController.subscribePush);
router.post('/push-unsubscribe', notificationController.unsubscribePush);
router.get('/push-status', notificationController.getPushStatus);
router.post('/test-push', notificationController.sendTestPush);

module.exports = router;

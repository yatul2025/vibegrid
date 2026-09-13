/**
 * src/routes/messageRoutes.js
 * ===========================
 * API Routes for Direct Messaging
 * 
 * Routes:
 * - GET  /api/messages/conversations    (Inbox list)
 * - GET  /api/messages/unread-count     (Navbar badge counter)
 * - GET  /api/messages/:username        (Message thread)
 * - POST /api/messages/:username        (Send direct message)
 * - PUT  /api/messages/:username/read   (Mark thread as read)
 */

const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect } = require('../middlewares/authMiddleware');

// All direct messaging routes require authentication
router.use(protect);

// Specific routes MUST be declared before /:username parameter
router.get('/conversations', messageController.getConversations);
router.get('/unread-count', messageController.getUnreadMessagesCount);

// Parameterized routes
router.get('/:username', messageController.getMessages);
router.post('/:username', messageController.sendMessage);
router.put('/:username/read', messageController.markConversationAsRead);

module.exports = router;

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
router.get('/starred', messageController.getStarredMessages);
router.post('/forward', messageController.forwardMessage);
router.post('/typing', messageController.sendTypingStatus);
router.post('/heartbeat', messageController.sendHeartbeat);
router.get('/presence', messageController.getPresenceList);

// Specific message actions (declared before /:username parameter)
router.put('/msg/:id/edit', messageController.editMessage);
router.delete('/msg/:id', messageController.deleteMessage);
router.post('/msg/:id/reaction', messageController.toggleReaction);
router.post('/msg/:id/star', messageController.toggleStarMessage);
router.get('/msg/:id/info', messageController.getMessageInfo);
router.post('/conv/:id/pin', messageController.togglePinMessage);

// Bulk message actions
router.post('/bulk/delete', messageController.bulkDeleteMessages);
router.post('/bulk/star', messageController.bulkStarMessages);
router.post('/bulk/forward', messageController.bulkForwardMessages);

// Phase 5: Conversation Controls & Reports
router.put('/conv/:id/mute', messageController.toggleMuteConversation);
router.put('/conv/:id/pin-conv', messageController.togglePinConversation);
router.put('/conv/:id/archive', messageController.toggleArchiveConversation);
router.delete('/conv/:id/clear', messageController.clearConversationMessages);
router.post('/report', messageController.reportEntity);

// Parameterized routes
router.get('/:username/typing', messageController.getTypingStatus);
router.get('/:username', messageController.getMessages);
router.post('/:username', messageController.sendMessage);
router.put('/:username/read', messageController.markConversationAsRead);

module.exports = router;

/**
 * server/src/routes/conversationRoutes.js
 * =======================================
 * API Routes for Conversations & Encrypted Messages
 */

const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const { protect } = require('../middlewares/authMiddleware');

const { uploadEncryptedMedia } = require('../middlewares/uploadMiddleware');

router.use(protect);

router.get('/', conversationController.getConversations);
router.post('/', conversationController.getOrCreateConversation);
router.post('/group', conversationController.createGroupConversation);
router.delete('/:id', conversationController.deleteGroup);
router.post('/:id/leave', conversationController.leaveGroup);
router.get('/:id/members', conversationController.getGroupMembers);
router.post('/:id/members', conversationController.addMembers);
router.delete('/:id/members/:userId', conversationController.removeMember);
router.put('/:id', conversationController.updateGroup);
router.get('/:id/messages', conversationController.getMessages);
router.post('/:id/messages', conversationController.sendMessage);
router.delete('/:id/messages/:messageId', conversationController.deleteMessage);
router.post('/:id/messages/:messageId/reactions', conversationController.toggleReaction);
router.post('/media/encrypted', uploadEncryptedMedia.single('file'), conversationController.uploadEncryptedAttachment);
router.put('/:id/ephemeral', conversationController.updateEphemeralTimer);

module.exports = router;

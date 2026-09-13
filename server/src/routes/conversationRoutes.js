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
router.get('/:id/messages', conversationController.getMessages);
router.post('/:id/messages', conversationController.sendMessage);
router.delete('/:id/messages/:messageId', conversationController.deleteMessage);
router.post('/:id/messages/:messageId/reactions', conversationController.toggleReaction);
router.post('/media/encrypted', uploadEncryptedMedia.single('file'), conversationController.uploadEncryptedAttachment);
router.put('/:id/ephemeral', conversationController.updateEphemeralTimer);

module.exports = router;

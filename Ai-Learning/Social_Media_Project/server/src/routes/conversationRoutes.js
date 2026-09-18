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
router.post('/media/encrypted', uploadEncryptedMedia.single('file'), conversationController.uploadEncryptedAttachment);
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
router.post('/join/:inviteCode', conversationController.joinGroupByInviteCode);
router.put('/:id/info', conversationController.updateGroupInfo);
router.get('/:id/permissions', conversationController.getGroupPermissions);
router.put('/:id/permissions', conversationController.updateGroupPermissions);
router.get('/:id/invite', conversationController.getGroupInvite);
router.post('/:id/invite/regenerate', conversationController.regenerateGroupInvite);
router.get('/:id/join-requests', conversationController.getJoinRequests);
router.post('/:id/join-requests/:requestId/review', conversationController.reviewJoinRequest);
router.put('/:id/members/:userId/role', conversationController.updateMemberRole);
router.get('/:id/media', conversationController.getGroupMedia);
router.put('/:id/ephemeral', conversationController.updateEphemeralTimer);

module.exports = router;

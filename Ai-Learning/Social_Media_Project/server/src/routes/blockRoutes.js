/**
 * server/src/routes/blockRoutes.js
 * ================================
 * API Routes for User Blocking & Safety
 */

const express = require('express');
const router = express.Router();
const blockController = require('../controllers/blockController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/blocked', blockController.getBlockedUsers);
router.post('/block/:userId', blockController.blockUser);
router.delete('/block/:userId', blockController.unblockUser);

module.exports = router;

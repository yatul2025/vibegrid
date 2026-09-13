/**
 * server/src/routes/callRoutes.js
 * ===============================
 * API Routes for Calls & WebRTC TURN Credentials
 */

const express = require('express');
const router = express.Router();
const callController = require('../controllers/callController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/history', callController.getCallHistory);
router.get('/turn-credentials', callController.getTurnCredentials);

module.exports = router;

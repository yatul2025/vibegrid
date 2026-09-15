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
router.get('/active', callController.getActiveCall);
router.post('/initiate', callController.initiateCall);
router.post('/:id/accept', callController.acceptCall);
router.post('/:id/reject', callController.rejectCall);
router.post('/:id/end', callController.endCall);
router.post('/:id/cancel', callController.cancelCall);
router.post('/:id/signal', callController.sendSignal);
router.get('/:id/signals', callController.getSignals);

module.exports = router;

/**
 * server/src/routes/e2eeRoutes.js
 * ===============================
 * API Routes for E2EE PreKey Distribution
 */

const express = require('express');
const router = express.Router();
const e2eeController = require('../controllers/e2eeController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.post('/keys/register', e2eeController.registerKeys);
router.get('/keys/bundle/:userIdOrUsername', e2eeController.getPreKeyBundle);
router.get('/keys/devices/:userIdOrUsername', e2eeController.getAllDevicePreKeyBundles);
router.post('/keys/replenish', e2eeController.replenishPreKeys);

// Device management
router.get('/devices', e2eeController.getUserDevices);
router.delete('/devices/:deviceId', e2eeController.revokeDevice);

module.exports = router;

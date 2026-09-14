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
router.post('/keys/replenish', e2eeController.replenishPreKeys);

module.exports = router;

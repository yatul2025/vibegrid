/**
 * src/routes/userRoutes.js
 * ========================
 * User Profile & Avatar Routes
 * 
 * Maps endpoints for viewing user profiles, updating bio/name,
 * and uploading profile picture avatars.
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { 
  getProfile, 
  updateProfile, 
  uploadAvatar, 
  removeAvatar, 
  searchUsers, 
  getSuggestedUsers,
  sendEmailOtp,
  verifyEmailOtp,
  sendPhoneOtp,
  verifyPhoneOtp,
  removePhoneNumber,
  changePassword,
  getActiveSessions,
  revokeSession,
  logoutOtherSessions,
  logoutAllSessions,
  getPrivacySettings,
  updatePrivacySettings,
  getNotificationSettings,
  updateNotificationSettings,
  deactivateAccount,
  deleteAccount
} = require('../controllers/userController');
const { toggleFollow, getFollowers, getFollowing } = require('../controllers/followController');
const { protect, optionalAuth } = require('../middlewares/authMiddleware');
const { 
  validateProfileUpdate, 
  validateEmailOtpRequest, 
  validateEmailOtpVerification,
  validatePhoneOtpRequest,
  validatePhoneOtpVerification,
  validateRemovePhone,
  validateChangePassword,
  validatePrivacySettings,
  validateNotificationSettings,
  validateDeactivateAccount,
  validateDeleteAccount
} = require('../middlewares/validateMiddleware');
const { uploadAvatar: avatarUpload } = require('../middlewares/uploadMiddleware');

// Security rate limiter for password change
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Too many password change attempts. Please wait 15 minutes before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Security rate limiter for account deactivation (Phase 9)
const deactivationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Too many deactivation attempts. Please wait 15 minutes before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Security rate limiter for permanent account deletion (Phase 10)
const accountDeletionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: 'Too many account deletion attempts. Please wait 15 minutes before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Security rate limiters for OTP operations
const emailOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: {
    success: false,
    error: 'Too many verification code requests. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Too many verification attempts. Please wait 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// GET /api/users/suggestions — Suggested users for desktop sidebar & discovery (Optional Auth)
router.get('/suggestions', optionalAuth, getSuggestedUsers);

// GET /api/users/search — Search users by username or full name (Optional Auth)
router.get('/search', optionalAuth, searchUsers);

// ============================================================================
// Email Management Routes (Phase 3 — Protected, Rate-Limited, Validated)
// (Must be defined before /:username to prevent route parameter collision)
// ============================================================================

// POST /api/users/email/send-otp — Request 6-digit OTP for email verification or email change
router.post('/email/send-otp', protect, emailOtpLimiter, validateEmailOtpRequest, sendEmailOtp);

// POST /api/users/email/verify-otp — Verify 6-digit OTP and update email
router.post('/email/verify-otp', protect, verifyOtpLimiter, validateEmailOtpVerification, verifyEmailOtp);

// ============================================================================
// Phone Number Management Routes (Phase 4 — Protected, Rate-Limited, Validated)
// ============================================================================

// POST /api/users/phone/send-otp — Request 6-digit OTP for phone verification or change
router.post('/phone/send-otp', protect, emailOtpLimiter, validatePhoneOtpRequest, sendPhoneOtp);

// POST /api/users/phone/verify-otp — Verify 6-digit OTP and link phone number
router.post('/phone/verify-otp', protect, verifyOtpLimiter, validatePhoneOtpVerification, verifyPhoneOtp);

// DELETE /api/users/phone — Remove linked phone number from account
router.delete('/phone', protect, validateRemovePhone, removePhoneNumber);

// ============================================================================
// Password & Active Sessions Routes (Phase 5 — Protected, Rate-Limited, Validated)
// ============================================================================

// POST & PUT /api/users/security/password — Change account password
router.post('/security/password', protect, passwordChangeLimiter, validateChangePassword, changePassword);
router.put('/security/password', protect, passwordChangeLimiter, validateChangePassword, changePassword);

// GET /api/users/security/sessions — Get list of active sessions
router.get('/security/sessions', protect, getActiveSessions);

// DELETE /api/users/security/sessions/:id — Revoke a specific remote session
router.delete('/security/sessions/:id', protect, revokeSession);

// POST /api/users/security/sessions/logout-others — Revoke all other sessions
router.post('/security/sessions/logout-others', protect, logoutOtherSessions);

// POST /api/users/security/sessions/logout-all — Revoke all sessions and logout
router.post('/security/sessions/logout-all', protect, logoutAllSessions);

// ============================================================================
// Privacy Settings Routes (Phase 7 — Protected, Validated)
// ============================================================================

// GET /api/users/privacy — Get user's privacy settings
router.get('/privacy', protect, getPrivacySettings);

// PUT /api/users/privacy — Update user's privacy settings
router.put('/privacy', protect, validatePrivacySettings, updatePrivacySettings);

// ============================================================================
// Notification Preferences Routes (Phase 8 — Protected, Validated)
// ============================================================================

// GET /api/users/notifications/settings — Get user's notification preferences
router.get('/notifications/settings', protect, getNotificationSettings);

// PUT /api/users/notifications/settings — Update user's notification preferences
router.put('/notifications/settings', protect, validateNotificationSettings, updateNotificationSettings);

// ============================================================================
// Account Deactivation Route (Phase 9 — Protected, Rate Limited, Validated)
// ============================================================================

// POST /api/users/deactivate — Temporarily deactivate user account
router.post('/deactivate', protect, deactivationLimiter, validateDeactivateAccount, deactivateAccount);

// ============================================================================
// Permanent Account Deletion Route (Phase 10 — Protected, Rate Limited, Validated)
// ============================================================================

// DELETE /api/users/account — Permanently delete user account and all data
router.delete('/account', protect, accountDeletionLimiter, validateDeleteAccount, deleteAccount);

// GET /api/users/:username — Get public profile and counts (Optional Auth for follow state)
router.get('/:username', optionalAuth, getProfile);

// PUT /api/users/profile — Update current user's profile details (Protected, Validated)
router.put('/profile', protect, validateProfileUpdate, updateProfile);

// PUT /api/users/avatar — Upload & change profile avatar picture (Protected, Multer)
router.put('/avatar', protect, avatarUpload.single('avatar'), uploadAvatar);

// DELETE /api/users/avatar — Remove profile picture and revert to default (Protected)
router.delete('/avatar', protect, removeAvatar);

// ============================================================================
// Follow / Social Graph Routes (Phase 7)
// ============================================================================

// POST /api/users/:username/follow-toggle — Follow or unfollow user (Protected)
router.post('/:username/follow-toggle', protect, toggleFollow);

// GET /api/users/:username/followers — Get user followers list (Optional Auth)
router.get('/:username/followers', optionalAuth, getFollowers);

// GET /api/users/:username/following — Get users followed list (Optional Auth)
router.get('/:username/following', optionalAuth, getFollowing);

module.exports = router;

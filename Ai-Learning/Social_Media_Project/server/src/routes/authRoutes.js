/**
 * src/routes/authRoutes.js
 * ========================
 * Authentication Routes
 * 
 * Maps authentication endpoints to validation middlewares and controllers.
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, login, logout, getMe, forgotPassword, resetPassword, changePassword } = require('../controllers/authController');
const { 
  validateRegistration, 
  validateLogin, 
  validateForgotPassword, 
  validateResetPassword, 
  validateChangePassword 
} = require('../middlewares/validateMiddleware');
const { protect } = require('../middlewares/authMiddleware');

// Security: Rate limiter on login to prevent brute force attacks (10 per 15 minutes per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 attempts per IP
  message: {
    success: false,
    error: 'Too many login attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Security: Rate limiter on registration to prevent automated bot signups (10 per hour per IP)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Max 10 accounts per hour per IP
  message: {
    success: false,
    error: 'Too many accounts created from this IP. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Security: Rate limiter on password recovery requests to prevent email spam / flooding (5 per 15 minutes per IP)
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Too many password reset requests. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Security: Rate limiter on reset confirmation to prevent OTP brute-forcing (10 per 15 minutes per IP)
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Too many reset attempts. Please request a new code and try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// POST /api/auth/register — Register a new account (Rate-limited, Validated)
router.post('/register', registerLimiter, validateRegistration, register);

// POST /api/auth/login — Sign in with username/email & password (Rate-limited, Validated)
router.post('/login', loginLimiter, validateLogin, login);

// POST /api/auth/logout — Log out & clear cookie
router.post('/logout', logout);

// GET /api/auth/me — Get current authenticated user session (Protected)
router.get('/me', protect, getMe);

// POST /api/auth/forgot-password — Request reset token & OTP (Rate-limited, Validated)
router.post('/forgot-password', forgotPasswordLimiter, validateForgotPassword, forgotPassword);

// POST /api/auth/reset-password — Reset password using token or OTP (Rate-limited, Validated)
router.post('/reset-password', resetPasswordLimiter, validateResetPassword, resetPassword);

// PUT /api/auth/change-password — Change password for logged-in user (Protected, Validated)
router.put('/change-password', protect, validateChangePassword, changePassword);

module.exports = router;

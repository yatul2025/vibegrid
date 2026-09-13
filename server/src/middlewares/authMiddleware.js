/**
 * src/middlewares/authMiddleware.js
 * =================================
 * JWT Authentication Guard Middleware
 * 
 * Verifies the HTTP-Only cookie sent by the browser.
 * If valid: attaches the authenticated user record to `req.user` and calls `next()`.
 * If missing or invalid: returns `401 Unauthorized`.
 */

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { query } = require('../config/db');
const { COOKIE_NAME } = require('../utils/jwt');

const protect = async (req, res, next) => {
  try {
    // 1. Extract token from HTTP-Only cookie
    const token = req.cookies ? req.cookies[COOKIE_NAME] : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please log in to access this resource.'
      });
    }

    // 2. Verify token signature and expiration
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Your session has expired. Please log in again.'
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token.'
      });
    }

    // 3. Fetch current user from PostgreSQL database to ensure account still exists
    const userResult = await query(
      `SELECT id, username, email, full_name, bio, avatar_url, website, location, 
              date_of_birth, is_email_verified, is_phone_verified, is_private, is_deactivated, 
              token_version, created_at 
       FROM users 
       WHERE id = $1 
       LIMIT 1`,
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User account no longer exists.'
      });
    }

    const user = userResult.rows[0];

    // Check if account is deactivated (Phase 9)
    if (user.is_deactivated) {
      return res.status(403).json({
        success: false,
        is_deactivated: true,
        error: 'Your account has been deactivated. Please log in to reactivate it.'
      });
    }

    // 4. Server-Side Revocation: Verify token version matches database
    if (decoded.tokenVersion !== undefined && user.token_version !== undefined) {
      if (Number(decoded.tokenVersion) !== Number(user.token_version)) {
        return res.status(401).json({
          success: false,
          error: 'Your session has been invalidated or logged out. Please log in again.'
        });
      }
    }

    // 5. Active Session Verification & Periodic Last-Active Refresh
    if (decoded.sessionId) {
      const sessionResult = await query(
        'SELECT id, last_active FROM user_sessions WHERE user_id = $1 AND session_id = $2 LIMIT 1',
        [user.id, decoded.sessionId]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Your session has been terminated or revoked from another device. Please log in again.'
        });
      }

      // Periodically update last_active (at most once every 5 minutes)
      const lastActive = sessionResult.rows[0].last_active ? new Date(sessionResult.rows[0].last_active).getTime() : 0;
      if (Date.now() - lastActive > 5 * 60 * 1000) {
        query(
          'UPDATE user_sessions SET last_active = CURRENT_TIMESTAMP WHERE id = $1',
          [sessionResult.rows[0].id]
        ).catch(() => {});
      }

      user.sessionId = decoded.sessionId;
    }

    // 6. Exclude token_version from req.user payload and attach demo session flag
    delete user.token_version;
    user.is_demo_session = !!decoded.isDemoAccess;
    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth Middleware Error]', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication verification failed.'
    });
  }
};

/**
 * Optional Auth Middleware: If token is present, attaches user, but does NOT block unauthenticated requests.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
    if (token) {
      const decoded = jwt.verify(token, config.jwtSecret);
      const userResult = await query(
        'SELECT id, username, token_version, is_deactivated FROM users WHERE id = $1 LIMIT 1',
        [decoded.id]
      );
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        // Only attach if not deactivated and token_version is valid
        if (!user.is_deactivated && (decoded.tokenVersion === undefined || Number(decoded.tokenVersion) === Number(user.token_version))) {
          if (decoded.sessionId) {
            const sessionCheck = await query(
              'SELECT 1 FROM user_sessions WHERE user_id = $1 AND session_id = $2 LIMIT 1',
              [user.id, decoded.sessionId]
            );
            if (sessionCheck.rows.length === 0) {
              return next();
            }
            user.sessionId = decoded.sessionId;
          }
          delete user.token_version;
          user.is_demo_session = !!decoded.isDemoAccess;
          req.user = user;
        }
      }
    }
  } catch (err) {
    // Ignore invalid/expired tokens for optional routes
  }
  next();
};

module.exports = {
  protect,
  optionalAuth
};

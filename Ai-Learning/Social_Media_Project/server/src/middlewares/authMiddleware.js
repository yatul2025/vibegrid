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

const DEMO_USERNAMES = ['sophia_wander', 'alex_design', 'elena_culinary', 'liam_visuals'];

const protect = async (req, res, next) => {
  try {
    // 1. Extract token from HTTP-Only cookie or Authorization header
    let token = req.cookies ? req.cookies[COOKIE_NAME] : null;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

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

    // 3. Dedicated Demo Mode Session Enforcement
    const isDemoSession = Boolean(decoded.isDemoSession || decoded.sessionType === 'demo');
    if (isDemoSession) {
      req.isDemoSession = true;

      // Reject all mutating actions from demo sessions
      const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
      if (mutatingMethods.includes(req.method.toUpperCase())) {
        return res.status(403).json({
          success: false,
          code: 'DEMO_RESTRICTED',
          error: 'This action is restricted in Demo Mode. Please create an account or log in to continue.'
        });
      }

      const userResult = await query(
        `SELECT id, username, email, full_name, bio, avatar_url, website, location, 
                date_of_birth, gender, is_email_verified, is_phone_verified, is_private, is_deactivated, 
                COALESCE(test, 0) AS test, COALESCE(has_completed_onboarding, TRUE) AS has_completed_onboarding, created_at 
         FROM users 
         WHERE id = $1 
         LIMIT 1`,
        [decoded.id]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Demo user account not found.'
        });
      }

      const user = userResult.rows[0];
      user.is_demo_session = true;
      user.isDemoSession = true;
      user.sessionType = 'demo';
      user.permissions = decoded.permissions || {
        read_demo_content: true,
        write_actions: false,
        direct_messaging_send: false,
        account_modification: false
      };
      req.user = user;
      return next();
    }

    // 4. Fetch current user from PostgreSQL database to ensure account still exists
    const userResult = await query(
      `SELECT id, username, email, full_name, bio, avatar_url, website, location, 
              date_of_birth, gender, is_email_verified, is_phone_verified, is_private, is_deactivated, 
              COALESCE(test, 0) AS test, COALESCE(has_completed_onboarding, TRUE) AS has_completed_onboarding, token_version, created_at 
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
    user.is_demo_session = !!decoded.isDemoAccess || DEMO_USERNAMES.includes((user.username || '').toLowerCase());
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
    let token = req.cookies ? req.cookies[COOKIE_NAME] : null;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      const decoded = jwt.verify(token, config.jwtSecret);
      if (decoded.isDemoSession || decoded.sessionType === 'demo') {
        const userResult = await query(
          'SELECT id, username, is_deactivated FROM users WHERE id = $1 LIMIT 1',
          [decoded.id]
        );
        if (userResult.rows.length > 0 && !userResult.rows[0].is_deactivated) {
          const user = userResult.rows[0];
          user.is_demo_session = true;
          user.isDemoSession = true;
          user.sessionType = 'demo';
          user.permissions = decoded.permissions;
          req.isDemoSession = true;
          req.user = user;
        }
        return next();
      }

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
          user.is_demo_session = !!decoded.isDemoAccess || DEMO_USERNAMES.includes((user.username || '').toLowerCase());
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

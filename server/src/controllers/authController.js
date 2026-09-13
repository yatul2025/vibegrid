/**
 * src/controllers/authController.js
 * =================================
 * Authentication Controller
 * 
 * Handles user registration, duplicate verification, password hashing,
 * and session cookie generation.
 */

const crypto = require('crypto');
const { query } = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { generateToken, setAuthCookie } = require('../utils/jwt');
const { parseUserAgent, getClientIp, getApproxLocation } = require('../utils/deviceParser');
const { sendLoginOtpEmail } = require('../utils/mailer');

const DEMO_USERNAMES = ['sophia_wander', 'alex_design', 'elena_culinary', 'liam_visuals'];

/**
 * Helper to record an active device session in user_sessions table
 */
const createSessionRecord = async (userId, req) => {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const userAgent = req.headers['user-agent'] || '';
  const { device, browser, os } = parseUserAgent(userAgent);
  const ip = getClientIp(req);
  const location = getApproxLocation(ip);

  await query(
    `INSERT INTO user_sessions (user_id, session_id, device, browser, os, ip_address, location, last_active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [userId, sessionId, device, browser, os, ip, location]
  );

  return sessionId;
};

/**
 * Register a new user
 * Route: POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password, fullName } = req.body;

    // 1. Check if username or email is already registered
    const existingUserCheck = await query(
      'SELECT id, username, email FROM users WHERE username = $1 OR email = $2 LIMIT 1',
      [username, email]
    );

    if (existingUserCheck.rows.length > 0) {
      const existingUser = existingUserCheck.rows[0];
      if (existingUser.username === username) {
        return res.status(409).json({
          success: false,
          error: 'This username is already taken. Please choose another.'
        });
      }
      if (existingUser.email === email) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email address already exists.'
        });
      }
    }

    // 2. Hash the password securely using bcrypt (12 rounds)
    const passwordHash = await hashPassword(password);

    // 3. Insert the new user into the PostgreSQL database
    const insertQuery = `
      INSERT INTO users (username, email, password_hash, full_name)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, email, full_name, bio, avatar_url, COALESCE(test, 0) AS test, token_version, created_at
    `;
    const result = await query(insertQuery, [
      username,
      email,
      passwordHash,
      fullName || null
    ]);

    const newUser = result.rows[0];

    // 4. Create active session record in database
    const sessionId = await createSessionRecord(newUser.id, req);

    // 5. Generate signed JWT token with token version and session ID
    const token = generateToken({
      id: newUser.id,
      username: newUser.username,
      tokenVersion: newUser.token_version || 1,
      sessionId
    });

    // 6. Attach token as a secure HTTP-Only cookie to the response
    setAuthCookie(res, token);

    // 7. Exclude internal security fields from response
    delete newUser.token_version;

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      data: {
        user: newUser
      }
    });
  } catch (error) {
    console.error('[Register Error]', error);
    next(error);
  }
};

/**
 * Log in an existing user
 * Route: POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide your username/email and password.'
      });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    // 1. Fetch user by either username OR email (including token_version and is_deactivated)
    const userQuery = `
      SELECT id, username, email, password_hash, full_name, bio, avatar_url, COALESCE(test, 0) AS test, token_version, is_deactivated, created_at
      FROM users
      WHERE username = $1 OR email = $1
      LIMIT 1
    `;
    const result = await query(userQuery, [cleanIdentifier]);

    if (result.rows.length === 0) {
      // Generic message to avoid username enumeration vulnerabilities
      return res.status(401).json({
        success: false,
        error: 'Invalid username/email or password.'
      });
    }

    const user = result.rows[0];

    // 2. Compare entered password with stored bcrypt hash
    const { comparePassword } = require('../utils/password');
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username/email or password.'
      });
    }

    // 3. Reactivate account if it was previously deactivated (Phase 9)
    let wasReactivated = false;
    if (user.is_deactivated) {
      await query(
        'UPDATE users SET is_deactivated = false, deactivated_at = NULL WHERE id = $1',
        [user.id]
      );
      user.is_deactivated = false;
      wasReactivated = true;
    }

    const isDemoAccess = req.body.isDemoAccess === true || req.body.isDemoAccess === 'true';
    const isDemoAccount = Boolean(isDemoAccess || DEMO_USERNAMES.includes((user.username || '').toLowerCase()));

    // Demo accounts bypass 2FA OTP to allow showcase exploratory access
    if (isDemoAccount) {
      const sessionId = await createSessionRecord(user.id, req);
      const token = generateToken({
        id: user.id,
        username: user.username,
        tokenVersion: user.token_version || 1,
        sessionId,
        isDemoAccess: true
      });

      setAuthCookie(res, token);
      delete user.password_hash;
      delete user.token_version;
      user.is_demo_session = true;

      return res.status(200).json({
        success: true,
        message: wasReactivated ? 'Welcome back! Your account has been reactivated.' : 'Logged in successfully!',
        data: {
          user,
          reactivated: wasReactivated
        }
      });
    }

    // Standard accounts: Generate 6-digit OTP and send via Email
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate existing unused login OTPs for this user
    await query(
      "UPDATE account_verifications SET used = TRUE WHERE user_id = $1 AND type = 'login_otp' AND used = FALSE",
      [user.id]
    );

    // Store in account_verifications
    await query(
      `INSERT INTO account_verifications (user_id, type, target_value, otp_code, expires_at)
       VALUES ($1, 'login_otp', $2, $3, $4)`,
      [user.id, user.email, otpCode, expiresAt]
    );

    // Send email using Nodemailer
    await sendLoginOtpEmail(user.email, otpCode);

    // Generate short-lived (10m) token for the verification step
    const loginToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        purpose: 'login_2fa',
        wasReactivated
      },
      config.jwtSecret,
      { expiresIn: '10m' }
    );

    // Mask email for user privacy display
    const [namePart, domainPart] = (user.email || '').split('@');
    const maskedEmail = `${namePart.length > 2 ? namePart.slice(0, 2) : namePart}***@${domainPart || 'gmail.com'}`;

    return res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to ${maskedEmail}.`,
      data: {
        step: 'otp_required',
        loginToken,
        maskedEmail,
        deliveryMethod: 'email',
        debugOtp: config.nodeEnv === 'development' && (!config.email.user || !config.email.pass) ? otpCode : undefined
      }
    });
  } catch (error) {
    console.error('[Login Error]', error);
    next(error);
  }
};

/**
 * Verify 2FA Login OTP Code
 * Route: POST /api/auth/verify-login-otp
 */
const verifyLoginOtp = async (req, res, next) => {
  try {
    const { loginToken, otpCode } = req.body;

    if (!loginToken || !otpCode || otpCode.trim().length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid 6-digit verification code.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(loginToken, config.jwtSecret);
      if (decoded.purpose !== 'login_2fa') {
        throw new Error('Invalid token purpose');
      }
    } catch {
      return res.status(401).json({
        success: false,
        error: 'Your login verification session has expired. Please sign in again.'
      });
    }

    const userId = decoded.userId;

    // Check for pending active OTP
    const otpRes = await query(
      `SELECT id, otp_code, attempts, expires_at
       FROM account_verifications
       WHERE user_id = $1 AND type = 'login_otp' AND used = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active verification code found. Please sign in again.'
      });
    }

    const record = otpRes.rows[0];

    // Check expiry
    if (new Date() > new Date(record.expires_at)) {
      await query('UPDATE account_verifications SET used = TRUE WHERE id = $1', [record.id]);
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new code.'
      });
    }

    // Rate limiting: Maximum 5 attempts
    if (record.attempts >= 5) {
      await query('UPDATE account_verifications SET used = TRUE WHERE id = $1', [record.id]);
      return res.status(429).json({
        success: false,
        error: 'Too many incorrect attempts. Please sign in again.'
      });
    }

    // Check code
    if (record.otp_code !== otpCode.trim()) {
      await query('UPDATE account_verifications SET attempts = attempts + 1 WHERE id = $1', [record.id]);
      const attemptsLeft = 5 - (record.attempts + 1);
      return res.status(400).json({
        success: false,
        error: `Incorrect code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`
      });
    }

    // Mark OTP as used
    await query('UPDATE account_verifications SET used = TRUE WHERE id = $1', [record.id]);

    // Fetch user details
    const userRes = await query(
      `SELECT id, username, email, full_name, bio, avatar_url, website, location, 
              date_of_birth, is_email_verified, is_phone_verified, is_private, is_deactivated, 
              COALESCE(test, 0) AS test, token_version, created_at 
       FROM users 
       WHERE id = $1 
       LIMIT 1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User account no longer exists.' });
    }

    const user = userRes.rows[0];

    // Reactivate if previously deactivated
    if (user.is_deactivated || decoded.wasReactivated) {
      await query('UPDATE users SET is_deactivated = false, deactivated_at = NULL WHERE id = $1', [user.id]);
      user.is_deactivated = false;
    }

    // Create session and set cookie
    const sessionId = await createSessionRecord(user.id, req);
    const token = generateToken({
      id: user.id,
      username: user.username,
      tokenVersion: user.token_version || 1,
      sessionId,
      isDemoAccess: false
    });

    setAuthCookie(res, token);
    delete user.token_version;
    user.is_demo_session = false;

    res.status(200).json({
      success: true,
      message: decoded.wasReactivated ? 'Welcome back! Your account has been reactivated.' : 'Logged in successfully!',
      data: {
        user,
        reactivated: Boolean(decoded.wasReactivated)
      }
    });
  } catch (error) {
    console.error('[Verify Login OTP Error]', error);
    next(error);
  }
};

/**
 * Resend 2FA Login OTP Code
 * Route: POST /api/auth/resend-login-otp
 */
const resendLoginOtp = async (req, res, next) => {
  try {
    const { loginToken } = req.body;
    if (!loginToken) {
      return res.status(400).json({ success: false, error: 'Missing login session token.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(loginToken, config.jwtSecret);
      if (decoded.purpose !== 'login_2fa') throw new Error('Invalid token purpose');
    } catch {
      return res.status(401).json({ success: false, error: 'Verification session expired. Please sign in again.' });
    }

    const userId = decoded.userId;
    const userRes = await query('SELECT id, username, email FROM users WHERE id = $1 LIMIT 1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    const user = userRes.rows[0];

    // Rate limit: 30s cooldown
    const recentRes = await query(
      `SELECT created_at FROM account_verifications 
       WHERE user_id = $1 AND type = 'login_otp' 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (recentRes.rows.length > 0) {
      const elapsed = Date.now() - new Date(recentRes.rows[0].created_at).getTime();
      if (elapsed < 30 * 1000) {
        const waitSec = Math.ceil((30 * 1000 - elapsed) / 1000);
        return res.status(429).json({
          success: false,
          error: `Please wait ${waitSec}s before requesting a new code.`
        });
      }
    }

    // Invalidate old OTPs
    await query("UPDATE account_verifications SET used = TRUE WHERE user_id = $1 AND type = 'login_otp' AND used = FALSE", [userId]);

    // Generate new OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await query(
      `INSERT INTO account_verifications (user_id, type, target_value, otp_code, expires_at)
       VALUES ($1, 'login_otp', $2, $3, $4)`,
      [userId, user.email, otpCode, expiresAt]
    );

    await sendLoginOtpEmail(user.email, otpCode);

    res.status(200).json({
      success: true,
      message: 'A fresh verification code has been sent.',
      data: {
        debugOtp: config.nodeEnv === 'development' && (!config.email.user || !config.email.pass) ? otpCode : undefined
      }
    });
  } catch (error) {
    console.error('[Resend Login OTP Error]', error);
    next(error);
  }
};

/**
 * Log out user (clears cookie & revokes current session)
 * Route: POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const config = require('../config/env');
    const { COOKIE_NAME, clearAuthCookie } = require('../utils/jwt');

    const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        if (decoded && decoded.id) {
          if (decoded.sessionId) {
            // Delete this specific session record
            await query(
              'DELETE FROM user_sessions WHERE user_id = $1 AND session_id = $2',
              [decoded.id, decoded.sessionId]
            );
          } else {
            // Legacy token fallback: increment token_version
            await query(
              'UPDATE users SET token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
              [decoded.id]
            );
          }
        }
      } catch (err) {
        // Token was already expired or invalid; still clear the cookie
      }
    }

    clearAuthCookie(res);
    res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (error) {
    console.error('[Logout Error]', error);
    res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  }
};

/**
 * Get current authenticated user session
 * Route: GET /api/auth/me
 */
const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user
    }
  });
};

/**
 * Request password reset (Forgot Password)
 * Generates secure token + 6-digit OTP and logs/sends recovery instructions.
 * Generic timing-safe response prevents user account enumeration.
 * Route: POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const userRes = await query(
      'SELECT id, username, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email]
    );

    let debugOtp = null;
    let debugToken = null;

    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];

      // Disallow password reset on official demo accounts
      const DEMO_USERNAMES = ['sophia_wander', 'alex_design', 'elena_culinary', 'liam_visuals'];
      if (DEMO_USERNAMES.includes(user.username.toLowerCase())) {
        return res.status(403).json({
          success: false,
          error: 'Password reset is disabled for official demo accounts.'
        });
      }

      // Cryptographically secure token (32 bytes = 64 hex chars)
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

      // 6-digit OTP
      const otpCode = crypto.randomInt(100000, 999999).toString();

      // Expire in 15 minutes
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      // Invalidate existing active reset tokens for this user
      await query(
        'UPDATE password_resets SET used = TRUE WHERE user_id = $1 AND used = FALSE',
        [user.id]
      );

      // Store hashed token & OTP in database
      await query(
        'INSERT INTO password_resets (user_id, token_hash, otp_code, expires_at) VALUES ($1, $2, $3, $4)',
        [user.id, tokenHash, otpCode, expiresAt]
      );

      console.log(`\n========================================`);
      console.log(`[PASSWORD RESET ASSISTANCE]`);
      console.log(`To: ${user.email} (@${user.username})`);
      console.log(`OTP Code: ${otpCode}`);
      console.log(`Reset Token: ${resetToken}`);
      console.log(`Expires in: 15 minutes`);
      console.log(`========================================\n`);

      // In non-production environments, provide debug OTP/Token so developers & tests can complete flow without external SMTP
      if (process.env.NODE_ENV !== 'production') {
        debugOtp = otpCode;
        debugToken = resetToken;
      }
    }

    // Always return 200 with the exact same response to prevent user enumeration
    res.status(200).json({
      success: true,
      message: 'If an account with this email exists, password reset instructions have been sent.',
      ...(debugOtp ? { _devDebug: { otp: debugOtp, token: debugToken } } : {})
    });
  } catch (error) {
    console.error('[Forgot Password Error]', error);
    next(error);
  }
};

/**
 * Reset password using Token or OTP
 * Route: POST /api/auth/reset-password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, token, otp, newPassword } = req.body;

    let tokenHash = null;
    if (token) {
      tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    }

    const resetQuery = `
      SELECT pr.id, pr.user_id, pr.expires_at, u.username
      FROM password_resets pr
      JOIN users u ON pr.user_id = u.id
      WHERE LOWER(u.email) = LOWER($1)
        AND pr.used = FALSE
        AND pr.expires_at > NOW()
        AND (
          ($2::text IS NOT NULL AND pr.token_hash = $2)
          OR ($3::text IS NOT NULL AND pr.otp_code = $3)
        )
      ORDER BY pr.created_at DESC
      LIMIT 1
    `;

    const resetRes = await query(resetQuery, [
      email,
      tokenHash || null,
      otp || null
    ]);

    if (resetRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid, expired, or already used reset code. Please request a new one.'
      });
    }

    const resetRecord = resetRes.rows[0];

    // Disallow password reset on official demo accounts
    const DEMO_USERNAMES = ['sophia_wander', 'alex_design', 'elena_culinary', 'liam_visuals'];
    if (resetRecord.username && DEMO_USERNAMES.includes(resetRecord.username.toLowerCase())) {
      return res.status(403).json({
        success: false,
        error: 'Password reset is disabled for official demo accounts.'
      });
    }

    // Hash the new password securely
    const newPasswordHash = await hashPassword(newPassword);

    // Update password, increment token_version to immediately revoke all existing sessions
    await query(
      `UPDATE users 
       SET password_hash = $1, 
           token_version = token_version + 1, 
           updated_at = NOW() 
       WHERE id = $2`,
      [newPasswordHash, resetRecord.user_id]
    );

    // Mark reset token as used
    await query('UPDATE password_resets SET used = TRUE WHERE id = $1', [resetRecord.id]);

    res.status(200).json({
      success: true,
      message: 'Your password has been reset successfully! Please log in with your new password.'
    });
  } catch (error) {
    console.error('[Reset Password Error]', error);
    next(error);
  }
};

/**
 * Change password for logged-in user
 * Route: PUT /api/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const DEMO_USERNAMES = ['sophia_wander', 'alex_design', 'elena_culinary', 'liam_visuals'];
    const isDemo = req.user.is_demo_session || DEMO_USERNAMES.includes((req.user.username || '').toLowerCase());
    if (isDemo) {
      return res.status(403).json({
        success: false,
        error: 'Password cannot be modified on demo accounts.'
      });
    }

    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Fetch user password_hash
    const userRes = await query(
      'SELECT id, username, password_hash, token_version FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User account not found.'
      });
    }

    const user = userRes.rows[0];

    // Verify current password
    const isMatch = await comparePassword(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect.'
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);
    const newTokenVersion = (user.token_version || 1) + 1;

    // Update password and increment token_version
    await query(
      `UPDATE users 
       SET password_hash = $1, 
           token_version = $2, 
           updated_at = NOW() 
       WHERE id = $3`,
      [newPasswordHash, newTokenVersion, userId]
    );

    // Issue a fresh cookie with the updated token_version so the current session stays valid
    const token = generateToken({
      id: user.id,
      username: user.username,
      tokenVersion: newTokenVersion
    });
    setAuthCookie(res, token);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. All other active sessions have been logged out.'
    });
  } catch (error) {
    console.error('[Change Password Error]', error);
    next(error);
  }
};

module.exports = {
  register,
  login,
  verifyLoginOtp,
  resendLoginOtp,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword
};

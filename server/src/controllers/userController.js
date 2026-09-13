/**
 * src/controllers/userController.js
 * =================================
 * User Profiles, Bio, and Avatar Controller
 * 
 * Handles fetching public profiles with statistics (followers, following, posts),
 * updating user bio/name, and uploading profile pictures via Multer.
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { query } = require('../config/db');
const { generateToken, setAuthCookie } = require('../utils/jwt');

const DEMO_USERNAMES = ['sophia_wander', 'alex_design', 'elena_culinary', 'liam_visuals'];

const isDemoUser = (user) => {
  if (!user) return false;
  if (user.is_demo_session) return true;
  return DEMO_USERNAMES.includes((user.username || '').toLowerCase());
};

/**
 * Fetch a user's public profile and social statistics
 * Route: GET /api/users/:username
 */
const getProfile = async (req, res, next) => {
  try {
    const { username } = req.params;
    const cleanUsername = username.trim().toLowerCase();

    // 1. Fetch user record from PostgreSQL with extended profile fields
    const userResult = await query(
      `SELECT id, username, email, phone_number, full_name, bio, avatar_url, website, location, date_of_birth, 
              is_email_verified, is_phone_verified, is_private, is_deactivated, COALESCE(test, 0) AS test, created_at 
       FROM users 
       WHERE username = $1 
       LIMIT 1`,
      [cleanUsername]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User @${cleanUsername} does not exist.`
      });
    }

    const profile = userResult.rows[0];
    const isOwnProfile = req.user ? req.user.id === profile.id : false;

    // Deactivated account protection (Phase 9): Hide deactivated accounts from other users
    if (profile.is_deactivated && !isOwnProfile) {
      return res.status(404).json({
        success: false,
        error: `User @${cleanUsername} is deactivated.`
      });
    }

    // 2. Fetch statistics (Post count, Followers count, Following count)
    const [postsCountRes, followersCountRes, followingCountRes] = await Promise.all([
      query('SELECT COUNT(*)::int as count FROM posts WHERE user_id = $1', [profile.id]),
      query('SELECT COUNT(*)::int as count FROM follows WHERE following_id = $1', [profile.id]),
      query('SELECT COUNT(*)::int as count FROM follows WHERE follower_id = $1', [profile.id])
    ]);

    // 3. Check if current requester is following this profile (if authenticated and not own profile)
    let isFollowing = false;
    if (req.user && !isOwnProfile) {
      const followCheck = await query(
        'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1',
        [req.user.id, profile.id]
      );
      isFollowing = followCheck.rows.length > 0;
    }

    // Privacy safeguard: Strip sensitive contact details if requester is not the account owner
    const safeProfile = { ...profile };
    if (!isOwnProfile) {
      delete safeProfile.email;
      delete safeProfile.phone_number;
    }

    const isLocked = Boolean(safeProfile.is_private && !isOwnProfile && !isFollowing);
    safeProfile.is_locked = isLocked;

    res.status(200).json({
      success: true,
      data: {
        profile: safeProfile,
        stats: {
          posts: postsCountRes.rows[0].count,
          followers: followersCountRes.rows[0].count,
          following: followingCountRes.rows[0].count
        },
        isFollowing,
        isOwnProfile
      }
    });
  } catch (error) {
    console.error('[Get Profile Error]', error);
    next(error);
  }
};

/**
 * Update user profile details (Full Name, Bio, Website, Location, DOB, Username)
 * Route: PUT /api/users/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    if (isDemoUser(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Profile updates are disabled for demo accounts. Please create a personal account to customize your profile.'
      });
    }

    const userId = req.user.id;
    const { fullName, bio, website, location, dateOfBirth, username } = req.body;

    // Check if username change requested
    let newUsername = req.user.username;
    if (username !== undefined && username !== null) {
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername !== req.user.username.toLowerCase()) {
        // Check uniqueness in database
        const existingCheck = await query(
          'SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2 LIMIT 1',
          [cleanUsername, userId]
        );
        if (existingCheck.rows.length > 0) {
          return res.status(409).json({
            success: false,
            error: `The username @${cleanUsername} is already taken. Please choose another.`
          });
        }
        newUsername = cleanUsername;
      }
    }

    const cleanFullName = fullName !== undefined && fullName !== null ? (fullName.trim().slice(0, 100) || null) : req.user.full_name;
    const cleanBio = bio !== undefined && bio !== null ? (bio.trim().slice(0, 150) || null) : req.user.bio;
    const cleanLocation = location !== undefined && location !== null ? (location.trim().slice(0, 100) || null) : (req.user.location || null);
    const cleanDob = dateOfBirth !== undefined && dateOfBirth !== null ? (dateOfBirth.trim() || null) : (req.user.date_of_birth || null);

    // Normalize website URL if provided (e.g., 'example.com' -> 'https://example.com')
    let formattedWebsite = null;
    if (website !== undefined && website !== null && website.trim() !== '') {
      const trimmed = website.trim();
      formattedWebsite = (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) 
        ? `https://${trimmed}` 
        : trimmed;
    } else if (website === undefined && req.user.website) {
      formattedWebsite = req.user.website;
    }

    // Parameterized update query
    const updateQuery = `
      UPDATE users 
      SET username = $1, full_name = $2, bio = $3, website = $4, location = $5, date_of_birth = $6, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $7 
      RETURNING id, username, email, full_name, bio, avatar_url, website, location, date_of_birth, COALESCE(test, 0) AS test, token_version, created_at
    `;
    const result = await query(updateQuery, [
      newUsername,
      cleanFullName,
      cleanBio,
      formattedWebsite,
      cleanLocation,
      cleanDob,
      userId
    ]);

    const updatedUser = result.rows[0];

    // If username changed, generate and attach fresh JWT cookie with new username
    if (newUsername !== req.user.username) {
      const { generateToken, setAuthCookie } = require('../utils/jwt');
      const token = generateToken({
        id: updatedUser.id,
        username: updatedUser.username,
        tokenVersion: updatedUser.token_version || 1
      });
      setAuthCookie(res, token);
    }
    delete updatedUser.token_version;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    console.error('[Update Profile Error]', error);
    next(error);
  }
};

/**
 * Upload and update profile avatar picture (Multer)
 * Route: PUT /api/users/avatar
 */
const uploadAvatar = async (req, res, next) => {
  try {
    if (isDemoUser(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Profile photo cannot be changed on demo accounts.'
      });
    }

    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please select an image file to upload.'
      });
    }

    // Public URL path accessible by the frontend
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Update avatar in PostgreSQL
    const updateQuery = `
      UPDATE users 
      SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 
      RETURNING id, username, email, full_name, bio, avatar_url
    `;
    const result = await query(updateQuery, [avatarUrl, userId]);

    res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully!',
      data: {
        user: result.rows[0]
      }
    });
  } catch (error) {
    console.error('[Avatar Upload Error]', error);
    next(error);
  }
};

/**
 * Search users by username or full name (Typeahead)
 * Route: GET /api/users/search?q=...
 */
const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    const viewerId = req.user ? req.user.id : null;

    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.status(200).json({
        success: true,
        data: { users: [] }
      });
    }

    const cleanQuery = q.trim().toLowerCase();
    const wildcard = `%${cleanQuery}%`;

    const searchQuery = `
      SELECT 
        u.id, 
        u.username, 
        u.full_name, 
        u.avatar_url,
        CASE 
          WHEN $2::int IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $2::int AND f.following_id = u.id)
          ELSE false 
        END AS is_following
      FROM users u
      WHERE LOWER(u.username) LIKE $1 OR LOWER(COALESCE(u.full_name, '')) LIKE $1
      ORDER BY 
        CASE WHEN LOWER(u.username) = $3 THEN 0
             WHEN LOWER(u.username) LIKE $4 THEN 1
             ELSE 2 END,
        u.username ASC
      LIMIT 20
    `;

    const result = await query(searchQuery, [wildcard, viewerId, cleanQuery, `${cleanQuery}%`]);

    res.status(200).json({
      success: true,
      data: {
        users: result.rows,
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('[Search Users Error]', error);
    next(error);
  }
};

/**
 * Fetch suggested users to follow (desktop sidebar & recommendations)
 * Route: GET /api/users/suggestions
 */
const getSuggestedUsers = async (req, res, next) => {
  try {
    const viewerId = req.user ? req.user.id : null;

    const suggestionQuery = `
      SELECT 
        u.id, 
        u.username, 
        u.full_name, 
        u.avatar_url,
        (SELECT COUNT(*)::int FROM follows f WHERE f.following_id = u.id) AS followers_count,
        CASE 
          WHEN $1::int IS NOT NULL THEN 
            EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $1::int AND f.following_id = u.id)
          ELSE false 
        END AS is_following
      FROM users u
      WHERE ($1::int IS NULL OR u.id != $1::int)
      ORDER BY 
        is_following ASC,
        followers_count DESC,
        u.id ASC
      LIMIT 5
    `;

    const result = await query(suggestionQuery, [viewerId]);

    res.status(200).json({
      success: true,
      data: {
        suggestions: result.rows
      }
    });
  } catch (error) {
    console.error('[Suggested Users Error]', error);
    next(error);
  }
};

/**
 * Remove user profile avatar picture (revert to default)
 * Route: DELETE /api/users/avatar
 */
const removeAvatar = async (req, res, next) => {
  try {
    if (isDemoUser(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Profile photo cannot be removed on demo accounts.'
      });
    }

    const userId = req.user.id;
    const defaultAvatar = '/uploads/avatars/default-avatar.png';

    // Fetch existing avatar to check if an uploaded file should be removed
    const userRes = await query('SELECT avatar_url FROM users WHERE id = $1', [userId]);
    const currentAvatar = userRes.rows[0]?.avatar_url;

    const result = await query(
      `UPDATE users 
       SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, username, email, full_name, bio, avatar_url, website, location, date_of_birth`,
      [defaultAvatar, userId]
    );

    // Delete local disk file if it exists and is an uploaded avatar
    if (currentAvatar && currentAvatar.startsWith('/uploads/avatars/avatar-')) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../../', currentAvatar);
      fs.unlink(filePath, (err) => {
        if (err && err.code !== 'ENOENT') {
          console.warn('[Avatar Delete File Warning]', err.message);
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile picture removed.',
      data: {
        user: result.rows[0]
      }
    });
  } catch (error) {
    console.error('[Remove Avatar Error]', error);
    next(error);
  }
};

/**
 * Send 6-digit OTP for Email Verification or Email Change
 * Route: POST /api/users/email/send-otp (Protected)
 */
const sendEmailOtp = async (req, res, next) => {
  try {
    if (isDemoUser(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Email address cannot be modified on demo accounts.'
      });
    }

    const userId = req.user.id;
    const { newEmail, currentPassword } = req.body;

    const isEmailChange = newEmail !== undefined && newEmail !== null && String(newEmail).trim() !== '';
    const type = isEmailChange ? 'email_change' : 'email_verify';
    let targetEmail = null;

    if (isEmailChange) {
      const cleanNewEmail = String(newEmail).trim().toLowerCase();
      if (cleanNewEmail === req.user.email.toLowerCase()) {
        return res.status(400).json({
          success: false,
          error: 'New email cannot be identical to your current email address.'
        });
      }

      // 1. Verify that new email is not already registered
      const emailCheck = await query(
        'SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2 LIMIT 1',
        [cleanNewEmail, userId]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'This email address is already in use by another account.'
        });
      }

      // 2. Re-authenticate: Check current password before allowing email change
      const userRes = await query('SELECT password_hash FROM users WHERE id = $1 LIMIT 1', [userId]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User account not found.' });
      }
      const isPasswordValid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Incorrect current password. Password is required to authorize an email change.'
        });
      }

      targetEmail = cleanNewEmail;
    } else {
      // Verifying current unverified email
      if (req.user.is_email_verified) {
        return res.status(400).json({
          success: false,
          error: 'Your email address is already verified.'
        });
      }
      targetEmail = req.user.email.toLowerCase();
    }

    // 3. Cooldown rate limit: Prevent requesting OTP more frequently than every 60 seconds
    const recentCheck = await query(
      `SELECT created_at FROM account_verifications 
       WHERE user_id = $1 AND type = $2 AND created_at > NOW() - INTERVAL '60 seconds' 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, type]
    );
    if (recentCheck.rows.length > 0) {
      return res.status(429).json({
        success: false,
        error: 'Please wait at least 60 seconds before requesting a new verification code.'
      });
    }

    // 4. Invalidate previous pending verification records for this user and type
    await query(
      'UPDATE account_verifications SET used = TRUE WHERE user_id = $1 AND type = $2 AND used = FALSE',
      [userId, type]
    );

    // 5. Generate secure 6-digit numeric OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 6. Insert new record in account_verifications
    await query(
      `INSERT INTO account_verifications (user_id, type, target_value, otp_code, expires_at) 
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, targetEmail, otpCode, expiresAt]
    );

    console.log(`\n========================================`);
    console.log(`[VIBEGRID EMAIL OTP ASSISTANCE]`);
    console.log(`User: @${req.user.username} (ID: ${userId})`);
    console.log(`Action: ${isEmailChange ? 'Change Email' : 'Verify Email'}`);
    console.log(`Target Email: ${targetEmail}`);
    console.log(`OTP Code: ${otpCode}`);
    console.log(`Expires in: 10 minutes (${expiresAt.toISOString()})`);
    console.log(`========================================\n`);

    res.status(200).json({
      success: true,
      message: `Verification code sent to ${targetEmail}. Code is valid for 10 minutes.`,
      data: {
        targetEmail,
        type,
        expiresInSeconds: 600
      },
      ...(process.env.NODE_ENV !== 'production' ? { _devDebug: { otp: otpCode } } : {})
    });
  } catch (error) {
    console.error('[Send Email OTP Error]', error);
    next(error);
  }
};

/**
 * Verify 6-digit OTP and update email verification status / new email address
 * Route: POST /api/users/email/verify-otp (Protected)
 */
const verifyEmailOtp = async (req, res, next) => {
  try {
    if (isDemoUser(req.user) && req.body.newEmail) {
      return res.status(403).json({
        success: false,
        error: 'Email address cannot be modified on demo accounts.'
      });
    }

    const userId = req.user.id;
    const { otp, newEmail } = req.body;
    const cleanOtp = String(otp).trim();

    const isEmailChange = newEmail !== undefined && newEmail !== null && String(newEmail).trim() !== '';
    const type = isEmailChange ? 'email_change' : 'email_verify';
    const targetEmail = isEmailChange ? String(newEmail).trim().toLowerCase() : req.user.email.toLowerCase();

    // 1. Query pending verification record
    const recordRes = await query(
      `SELECT id, otp_code, expires_at, attempts, used 
       FROM account_verifications 
       WHERE user_id = $1 AND type = $2 AND LOWER(target_value) = LOWER($3) AND used = FALSE 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId, type, targetEmail]
    );

    if (recordRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active verification request found. Please request a new code.'
      });
    }

    const record = recordRes.rows[0];

    // 2. Check expiration (10 min expiry)
    if (new Date(record.expires_at) < new Date()) {
      await query('UPDATE account_verifications SET used = TRUE WHERE id = $1', [record.id]);
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new code.'
      });
    }

    // 3. Check attempt rate-limiting (max 5 failed attempts)
    if (record.attempts >= 5) {
      await query('UPDATE account_verifications SET used = TRUE WHERE id = $1', [record.id]);
      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. This verification code has been invalidated. Please request a new code.'
      });
    }

    // 4. Verify OTP code match
    if (cleanOtp !== record.otp_code) {
      const nextAttempts = record.attempts + 1;
      await query('UPDATE account_verifications SET attempts = $1 WHERE id = $2', [nextAttempts, record.id]);
      const remainingAttempts = Math.max(0, 5 - nextAttempts);
      return res.status(400).json({
        success: false,
        error: `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`
      });
    }

    // 5. OTP is correct! Mark record as used
    await query('UPDATE account_verifications SET used = TRUE WHERE id = $1', [record.id]);

    let updatedUser;
    if (isEmailChange) {
      // Concurrency check: Ensure email was not taken while OTP was pending
      const checkDouble = await query(
        'SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2 LIMIT 1',
        [targetEmail, userId]
      );
      if (checkDouble.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'This email address was claimed by another account. Please select a different email.'
        });
      }

      // Update email and mark verified
      const updateRes = await query(
        `UPDATE users 
         SET email = $1, is_email_verified = TRUE, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING id, username, email, full_name, bio, avatar_url, website, location, 
                   date_of_birth, is_email_verified, is_phone_verified, is_private, token_version, created_at`,
        [targetEmail, userId]
      );
      updatedUser = updateRes.rows[0];
    } else {
      // Mark current email as verified
      const updateRes = await query(
        `UPDATE users 
         SET is_email_verified = TRUE, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 
         RETURNING id, username, email, full_name, bio, avatar_url, website, location, 
                   date_of_birth, is_email_verified, is_phone_verified, is_private, token_version, created_at`,
        [userId]
      );
      updatedUser = updateRes.rows[0];
    }

    // 6. Issue updated JWT cookie with token version
    const token = generateToken({
      id: updatedUser.id,
      username: updatedUser.username,
      tokenVersion: updatedUser.token_version || 1
    });
    setAuthCookie(res, token);
    delete updatedUser.token_version;

    res.status(200).json({
      success: true,
      message: isEmailChange ? 'Email address updated and verified successfully!' : 'Email successfully verified!',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    console.error('[Verify Email OTP Error]', error);
    next(error);
  }
};

/**
 * Send 6-digit OTP for Phone Number Verification or Change
 * Route: POST /api/users/phone/send-otp (Protected)
 */
const sendPhoneOtp = async (req, res, next) => {
  try {
    if (isDemoUser(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Phone number cannot be modified on demo accounts.'
      });
    }

    const userId = req.user.id;
    const { phoneNumber, currentPassword } = req.body;
    const cleanPhone = String(phoneNumber).trim().replace(/[\s\-()]/g, '');

    // 1. Check if already linked and verified on this account
    if (req.user.phone_number && req.user.phone_number === cleanPhone && req.user.is_phone_verified) {
      return res.status(400).json({
        success: false,
        error: 'This phone number is already verified on your account.'
      });
    }

    // 2. Uniqueness check against other accounts
    const phoneCheck = await query(
      'SELECT id FROM users WHERE phone_number = $1 AND id != $2 LIMIT 1',
      [cleanPhone, userId]
    );
    if (phoneCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'This phone number is already registered to another account.'
      });
    }

    // 3. Re-authenticate: Check current password before dispatching OTP
    const userRes = await query('SELECT password_hash FROM users WHERE id = $1 LIMIT 1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }
    const isPasswordValid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect current password. Password is required to authorize phone verification.'
      });
    }

    // 4. Anti-spam cooldown: Limit requests to once every 60 seconds
    const recentCheck = await query(
      `SELECT created_at FROM account_verifications 
       WHERE user_id = $1 AND type = 'phone_verify' AND created_at > NOW() - INTERVAL '60 seconds' 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (recentCheck.rows.length > 0) {
      return res.status(429).json({
        success: false,
        error: 'Please wait at least 60 seconds before requesting another code.'
      });
    }

    // 5. Invalidate previous pending phone verification codes
    await query(
      "UPDATE account_verifications SET used = TRUE WHERE user_id = $1 AND type = 'phone_verify' AND used = FALSE",
      [userId]
    );

    // 6. Generate secure 6-digit numeric OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 7. Store verification record
    await query(
      `INSERT INTO account_verifications (user_id, type, target_value, otp_code, expires_at) 
       VALUES ($1, 'phone_verify', $2, $3, $4)`,
      [userId, cleanPhone, otpCode, expiresAt]
    );

    console.log(`\n========================================`);
    console.log(`[VIBEGRID PHONE OTP ASSISTANCE]`);
    console.log(`User: @${req.user.username} (ID: ${userId})`);
    console.log(`Target Phone: ${cleanPhone}`);
    console.log(`OTP Code: ${otpCode}`);
    console.log(`Expires in: 10 minutes (${expiresAt.toISOString()})`);
    console.log(`========================================\n`);

    res.status(200).json({
      success: true,
      message: `Verification code sent to ${cleanPhone}. Code is valid for 10 minutes.`,
      data: {
        phoneNumber: cleanPhone,
        type: 'phone_verify',
        expiresInSeconds: 600
      },
      ...(process.env.NODE_ENV !== 'production' ? { _devDebug: { otp: otpCode } } : {})
    });
  } catch (error) {
    console.error('[Send Phone OTP Error]', error);
    next(error);
  }
};

/**
 * Verify 6-digit OTP and update user's verified phone number
 * Route: POST /api/users/phone/verify-otp (Protected)
 */
const verifyPhoneOtp = async (req, res, next) => {
  try {
    if (isDemoUser(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Phone number cannot be modified on demo accounts.'
      });
    }

    const userId = req.user.id;
    const { phoneNumber, otp } = req.body;
    const cleanPhone = String(phoneNumber).trim().replace(/[\s\-()]/g, '');
    const cleanOtp = String(otp).trim();

    // 1. Query pending verification record
    const recordRes = await query(
      `SELECT id, otp_code, expires_at, attempts, used 
       FROM account_verifications 
       WHERE user_id = $1 AND type = 'phone_verify' AND target_value = $2 AND used = FALSE 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId, cleanPhone]
    );

    if (recordRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active verification request found for this phone number. Please request a new code.'
      });
    }

    const record = recordRes.rows[0];

    // 2. Check expiration (10 min expiry)
    if (new Date(record.expires_at) < new Date()) {
      await query('UPDATE account_verifications SET used = TRUE WHERE id = $1', [record.id]);
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new code.'
      });
    }

    // 3. Check attempt limit (max 5 failed attempts)
    if (record.attempts >= 5) {
      await query('UPDATE account_verifications SET used = TRUE WHERE id = $1', [record.id]);
      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. This verification code has been invalidated. Please request a new code.'
      });
    }

    // 4. Check OTP match
    if (cleanOtp !== record.otp_code) {
      const nextAttempts = record.attempts + 1;
      await query('UPDATE account_verifications SET attempts = $1 WHERE id = $2', [nextAttempts, record.id]);
      const remainingAttempts = Math.max(0, 5 - nextAttempts);
      return res.status(400).json({
        success: false,
        error: `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`
      });
    }

    // 5. Code is valid! Mark record as used
    await query('UPDATE account_verifications SET used = TRUE WHERE id = $1', [record.id]);

    // Concurrency check: Ensure phone wasn't registered by another user in the interim
    const checkDouble = await query(
      'SELECT id FROM users WHERE phone_number = $1 AND id != $2 LIMIT 1',
      [cleanPhone, userId]
    );
    if (checkDouble.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'This phone number was just claimed by another account. Please choose a different phone number.'
      });
    }

    // 6. Update user's phone number and verification state
    const updateRes = await query(
      `UPDATE users 
       SET phone_number = $1, is_phone_verified = TRUE, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, username, email, phone_number, full_name, bio, avatar_url, website, 
                 location, date_of_birth, is_email_verified, is_phone_verified, is_private, created_at`,
      [cleanPhone, userId]
    );

    res.status(200).json({
      success: true,
      message: 'Phone number verified and linked successfully!',
      data: {
        user: updateRes.rows[0]
      }
    });
  } catch (error) {
    console.error('[Verify Phone OTP Error]', error);
    next(error);
  }
};

/**
 * Remove linked phone number from account
 * Route: DELETE /api/users/phone (Protected)
 */
const removePhoneNumber = async (req, res, next) => {
  try {
    if (isDemoUser(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Phone number cannot be modified on demo accounts.'
      });
    }

    const userId = req.user.id;
    const { currentPassword } = req.body;

    // 1. Re-authenticate with current password
    const userRes = await query('SELECT password_hash FROM users WHERE id = $1 LIMIT 1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }
    const isPasswordValid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect password. Password is required to authorize phone number removal.'
      });
    }

    // 2. Clear phone number
    const updateRes = await query(
      `UPDATE users 
       SET phone_number = NULL, is_phone_verified = FALSE, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, username, email, phone_number, full_name, bio, avatar_url, website, 
                 location, date_of_birth, is_email_verified, is_phone_verified, is_private, created_at`,
      [userId]
    );

    // 3. Invalidate any pending phone verifications
    await query(
      "UPDATE account_verifications SET used = TRUE WHERE user_id = $1 AND type = 'phone_verify' AND used = FALSE",
      [userId]
    );

    res.status(200).json({
      success: true,
      message: 'Phone number removed from account.',
      data: {
        user: updateRes.rows[0]
      }
    });
  } catch (error) {
    console.error('[Remove Phone Number Error]', error);
    next(error);
  }
};

/**
 * Change Password for authenticated user
 * Route: POST /api/users/security/password
 */
const changePassword = async (req, res, next) => {
  try {
    if (isDemoUser(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Password cannot be modified on demo accounts.'
      });
    }

    const userId = req.user.id;
    const { currentPassword, newPassword, logoutOtherDevices = true } = req.body;

    // 1. Fetch user credentials
    const userRes = await query(
      'SELECT id, username, password_hash, token_version FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    const user = userRes.rows[0];

    // 2. Validate current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect.'
      });
    }

    // 3. Hash new password
    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(newPassword, salt);

    // 4. Update password and increment token_version
    const newTokenVersion = (user.token_version || 1) + 1;
    await query(
      'UPDATE users SET password_hash = $1, token_version = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [newHash, newTokenVersion, userId]
    );

    // 5. Manage sessions
    if (logoutOtherDevices) {
      if (req.user.sessionId) {
        // Remove all sessions except current one
        await query(
          'DELETE FROM user_sessions WHERE user_id = $1 AND session_id != $2',
          [userId, req.user.sessionId]
        );
      } else {
        // Fallback: remove other sessions
        await query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
      }
    }

    // 6. Issue fresh JWT for current device with new token_version and active sessionId
    const token = generateToken({
      id: user.id,
      username: user.username,
      tokenVersion: newTokenVersion,
      sessionId: req.user.sessionId || null
    });
    setAuthCookie(res, token);

    res.status(200).json({
      success: true,
      message: logoutOtherDevices
        ? 'Password updated successfully. Other devices have been logged out.'
        : 'Password updated successfully.'
    });
  } catch (error) {
    console.error('[Change Password Error]', error);
    next(error);
  }
};

/**
 * Get active sessions for current user
 * Route: GET /api/users/security/sessions
 */
const getActiveSessions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const currentSessionId = req.user.sessionId;

    const sessionsRes = await query(
      `SELECT id, session_id, device, browser, os, ip_address, location, last_active, created_at
       FROM user_sessions
       WHERE user_id = $1
       ORDER BY last_active DESC`,
      [userId]
    );

    const sessions = sessionsRes.rows.map((row) => ({
      id: row.id,
      device: row.device || 'Desktop',
      browser: row.browser || 'Unknown Browser',
      os: row.os || 'Unknown OS',
      ip_address: row.ip_address || '127.0.0.1',
      location: row.location || 'Localhost / Dev',
      last_active: row.last_active,
      created_at: row.created_at,
      is_current: currentSessionId ? row.session_id === currentSessionId : false
    }));

    res.status(200).json({
      success: true,
      data: {
        sessions
      }
    });
  } catch (error) {
    console.error('[Get Active Sessions Error]', error);
    next(error);
  }
};

/**
 * Revoke a specific remote device session
 * Route: DELETE /api/users/security/sessions/:id
 */
const revokeSession = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const sessionIdToRevoke = parseInt(req.params.id, 10);

    if (isNaN(sessionIdToRevoke)) {
      return res.status(400).json({ success: false, error: 'Invalid session ID parameter.' });
    }

    // Check if session exists and belongs to this user
    const checkRes = await query(
      'SELECT id, session_id FROM user_sessions WHERE id = $1 AND user_id = $2 LIMIT 1',
      [sessionIdToRevoke, userId]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found or already terminated.' });
    }

    // Check if user is attempting to revoke their current session
    if (req.user.sessionId && checkRes.rows[0].session_id === req.user.sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot revoke current session. Please use Sign Out instead.'
      });
    }

    await query(
      'DELETE FROM user_sessions WHERE id = $1 AND user_id = $2',
      [sessionIdToRevoke, userId]
    );

    res.status(200).json({
      success: true,
      message: 'Session revoked successfully. The remote device has been logged out.'
    });
  } catch (error) {
    console.error('[Revoke Session Error]', error);
    next(error);
  }
};

/**
 * Log out all devices except current one
 * Route: POST /api/users/security/sessions/logout-others
 */
const logoutOtherSessions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const currentSessionId = req.user.sessionId;

    if (currentSessionId) {
      await query(
        'DELETE FROM user_sessions WHERE user_id = $1 AND session_id != $2',
        [userId, currentSessionId]
      );
    } else {
      await query(
        `DELETE FROM user_sessions 
         WHERE user_id = $1 AND id NOT IN (
           SELECT id FROM user_sessions WHERE user_id = $1 ORDER BY last_active DESC LIMIT 1
         )`,
        [userId]
      );
    }

    res.status(200).json({
      success: true,
      message: 'Logged out of all other devices successfully.'
    });
  } catch (error) {
    console.error('[Logout Other Sessions Error]', error);
    next(error);
  }
};

/**
 * Log out all devices including current one
 * Route: POST /api/users/security/sessions/logout-all
 */
const logoutAllSessions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { clearAuthCookie } = require('../utils/jwt');

    // Delete all sessions for user
    await query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);

    // Invalidate all tokens by incrementing token_version
    await query(
      'UPDATE users SET token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );

    clearAuthCookie(res);

    res.status(200).json({
      success: true,
      message: 'Logged out of all devices successfully.'
    });
  } catch (error) {
    console.error('[Logout All Sessions Error]', error);
    next(error);
  }
};

/**
 * Get privacy settings for authenticated user
 * Route: GET /api/users/privacy
 */
const getPrivacySettings = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT is_private, allow_messages_from, allow_comments_from, allow_mentions_from,
              allow_tags_from, show_online_status, show_read_receipts, story_visibility
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    res.status(200).json({
      success: true,
      data: {
        privacy: result.rows[0]
      }
    });
  } catch (error) {
    console.error('[Get Privacy Settings Error]', error);
    next(error);
  }
};

/**
 * Update privacy settings for authenticated user
 * Route: PUT /api/users/privacy
 */
const updatePrivacySettings = async (req, res, next) => {
  try {
    if (isDemoUser(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Privacy settings cannot be modified on demo accounts.'
      });
    }

    const userId = req.user.id;
    const {
      is_private,
      allow_messages_from,
      allow_comments_from,
      allow_mentions_from,
      allow_tags_from,
      show_online_status,
      show_read_receipts,
      story_visibility
    } = req.body;

    // Fetch existing settings
    const currentRes = await query(
      `SELECT is_private, allow_messages_from, allow_comments_from, allow_mentions_from,
              allow_tags_from, show_online_status, show_read_receipts, story_visibility
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (currentRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const current = currentRes.rows[0];

    const updatedPrivate = is_private !== undefined ? is_private : current.is_private;
    const updatedMessages = allow_messages_from || current.allow_messages_from;
    const updatedComments = allow_comments_from || current.allow_comments_from;
    const updatedMentions = allow_mentions_from || current.allow_mentions_from;
    const updatedTags = allow_tags_from || current.allow_tags_from;
    const updatedOnline = show_online_status !== undefined ? show_online_status : current.show_online_status;
    const updatedReceipts = show_read_receipts !== undefined ? show_read_receipts : current.show_read_receipts;
    const updatedStories = story_visibility || current.story_visibility;

    const updateRes = await query(
      `UPDATE users
       SET is_private = $1,
           allow_messages_from = $2,
           allow_comments_from = $3,
           allow_mentions_from = $4,
           allow_tags_from = $5,
           show_online_status = $6,
           show_read_receipts = $7,
           story_visibility = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING is_private, allow_messages_from, allow_comments_from, allow_mentions_from,
                 allow_tags_from, show_online_status, show_read_receipts, story_visibility`,
      [
        updatedPrivate,
        updatedMessages,
        updatedComments,
        updatedMentions,
        updatedTags,
        updatedOnline,
        updatedReceipts,
        updatedStories,
        userId
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Privacy settings updated successfully.',
      data: {
        privacy: updateRes.rows[0]
      }
    });
  } catch (error) {
    console.error('[Update Privacy Settings Error]', error);
    next(error);
  }
};

/**
 * Get notification settings for authenticated user
 * Route: GET /api/users/notifications/settings
 */
const getNotificationSettings = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT notif_likes, notif_comments, notif_follows, notif_messages,
              notif_mentions, notif_tags, notif_stories, notif_security, notif_email
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    res.status(200).json({
      success: true,
      data: {
        notifications: result.rows[0]
      }
    });
  } catch (error) {
    console.error('[Get Notification Settings Error]', error);
    next(error);
  }
};

/**
 * Update notification settings for authenticated user
 * Route: PUT /api/users/notifications/settings
 */
const updateNotificationSettings = async (req, res, next) => {
  try {
    if (isDemoUser(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Notification preferences cannot be modified on demo accounts.'
      });
    }

    const userId = req.user.id;
    const {
      notif_likes,
      notif_comments,
      notif_follows,
      notif_messages,
      notif_mentions,
      notif_tags,
      notif_stories,
      notif_security,
      notif_email
    } = req.body;

    // Fetch existing settings
    const currentRes = await query(
      `SELECT notif_likes, notif_comments, notif_follows, notif_messages,
              notif_mentions, notif_tags, notif_stories, notif_security, notif_email
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (currentRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const current = currentRes.rows[0];

    const updatedLikes = notif_likes !== undefined ? notif_likes : current.notif_likes;
    const updatedComments = notif_comments !== undefined ? notif_comments : current.notif_comments;
    const updatedFollows = notif_follows !== undefined ? notif_follows : current.notif_follows;
    const updatedMessages = notif_messages !== undefined ? notif_messages : current.notif_messages;
    const updatedMentions = notif_mentions !== undefined ? notif_mentions : current.notif_mentions;
    const updatedTags = notif_tags !== undefined ? notif_tags : current.notif_tags;
    const updatedStories = notif_stories !== undefined ? notif_stories : current.notif_stories;
    const updatedSecurity = notif_security !== undefined ? notif_security : current.notif_security;
    const updatedEmail = notif_email !== undefined ? notif_email : current.notif_email;

    const updateRes = await query(
      `UPDATE users
       SET notif_likes = $1,
           notif_comments = $2,
           notif_follows = $3,
           notif_messages = $4,
           notif_mentions = $5,
           notif_tags = $6,
           notif_stories = $7,
           notif_security = $8,
           notif_email = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING notif_likes, notif_comments, notif_follows, notif_messages,
                 notif_mentions, notif_tags, notif_stories, notif_security, notif_email`,
      [
        updatedLikes,
        updatedComments,
        updatedFollows,
        updatedMessages,
        updatedMentions,
        updatedTags,
        updatedStories,
        updatedSecurity,
        updatedEmail,
        userId
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully.',
      data: {
        notifications: updateRes.rows[0]
      }
    });
  } catch (error) {
    console.error('[Update Notification Settings Error]', error);
    next(error);
  }
};

/**
 * Deactivate user account (Phase 9 — Temporary & Reversible)
 * Route: POST /api/users/deactivate
 */
const deactivateAccount = async (req, res, next) => {
  try {
    if (isDemoUser(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Demo accounts cannot be deactivated.'
      });
    }

    const userId = req.user.id;
    const { password, reason } = req.body;

    // 1. Fetch user password hash
    const userRes = await query(
      'SELECT password_hash FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const { comparePassword } = require('../utils/password');
    const isValid = await comparePassword(password, userRes.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect password. Account was not deactivated.'
      });
    }

    // 2. Mark account as deactivated, increment token_version to invalidate all existing tokens
    await query(
      `UPDATE users
       SET is_deactivated = true,
           deactivated_at = CURRENT_TIMESTAMP,
           token_version = token_version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId]
    );

    // 3. Destroy all active sessions in user_sessions
    await query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);

    // 4. Clear client authentication cookie
    const { clearAuthCookie } = require('../utils/jwt');
    clearAuthCookie(res);

    res.status(200).json({
      success: true,
      message: 'Your account has been deactivated. You can log back in at any time to reactivate it.'
    });
  } catch (error) {
    console.error('[Deactivate Account Error]', error);
    next(error);
  }
};

/**
 * Permanently delete user account and cascade delete all related data (Phase 10)
 * Route: DELETE /api/users/account
 */
const deleteAccount = async (req, res, next) => {
  try {
    if (isDemoUser(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Demo accounts cannot be deleted.'
      });
    }

    const userId = req.user.id;
    const { password, confirmation } = req.body;

    // 1. Fetch user record (password hash, username, avatar_url)
    const userRes = await query(
      'SELECT id, username, password_hash, avatar_url FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const user = userRes.rows[0];

    // 2. Verify confirmation string matches username exactly (case-insensitive)
    if (confirmation.trim().toLowerCase() !== user.username.toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: `Confirmation username does not match "@${user.username}".`
      });
    }

    // 3. Verify password with bcrypt
    const { comparePassword } = require('../utils/password');
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect password. Account was not deleted.'
      });
    }

    // 4. Optionally clean up custom avatar file if present
    if (user.avatar_url && !user.avatar_url.includes('default-avatar.png') && user.avatar_url.startsWith('/uploads/')) {
      const fs = require('fs');
      const path = require('path');
      const fullPath = path.join(__dirname, '../../public', user.avatar_url);
      fs.unlink(fullPath, (err) => {
        if (err) console.warn('[Avatar Cleanup Warning]', err.message);
      });
    }

    // 5. Permanently delete user row (Foreign keys in PostgreSQL have ON DELETE CASCADE)
    await query('DELETE FROM users WHERE id = $1', [userId]);

    // 6. Clear HTTP-Only authentication cookie
    const { clearAuthCookie } = require('../utils/jwt');
    clearAuthCookie(res);

    res.status(200).json({
      success: true,
      message: 'Your account and all associated data have been permanently deleted.'
    });
  } catch (error) {
    console.error('[Delete Account Error]', error);
    next(error);
  }
};

module.exports = {
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
};

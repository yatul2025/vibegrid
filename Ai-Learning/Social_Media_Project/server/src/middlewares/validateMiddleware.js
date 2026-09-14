/**
 * src/middlewares/validateMiddleware.js
 * =====================================
 * Request Input Validation Middleware
 * 
 * Validates user input before it reaches the controller to ensure:
 * 1. Required fields are present and not empty.
 * 2. Usernames follow safe format (3-30 chars, alphanumeric + underscore).
 * 3. Emails match standard email pattern.
 * 4. Passwords meet minimum security requirements (at least 8 characters).
 */

const validateRegistration = (req, res, next) => {
  const { username, email, password, fullName, dateOfBirth, gender } = req.body;
  const errors = [];

  // Username validation
  if (!username || typeof username !== 'string') {
    errors.push('Username is required.');
  } else {
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      errors.push('Username must be between 3 and 30 characters long.');
    }
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
      errors.push('Username can only contain letters, numbers, and underscores (no spaces or special characters).');
    }
  }

  // Email validation
  if (!email || typeof email !== 'string') {
    errors.push('Email is required.');
  } else {
    const trimmedEmail = email.trim();
    if (trimmedEmail.length > 255) {
      errors.push('Email address cannot exceed 255 characters.');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      errors.push('Please enter a valid email address.');
    }
  }

  // Password validation (min 8 chars, max 128 chars to prevent Hash DoS)
  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  } else if (password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  } else if (password.length > 128) {
    errors.push('Password cannot exceed 128 characters.');
  } else {
    // Complexity requirement: at least one letter and one number
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one letter and one number.');
    }
    // Block common easily-guessed passwords
    const COMMON_PASSWORDS = ['password', 'password123', '12345678', '123456789', 'admin123', 'qwertyuiop', 'welcome123'];
    if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
      errors.push('This password is too common and easily guessed. Please choose a stronger password.');
    }
  }

  // Full name length check (optional field)
  if (fullName !== undefined && fullName !== null) {
    if (typeof fullName !== 'string') {
      errors.push('Full name must be a text string.');
    } else if (fullName.trim().length > 100) {
      errors.push('Full name cannot exceed 100 characters.');
    }
  }

  // Date of birth validation (Required: User must be at least 18 years old)
  if (!dateOfBirth || typeof dateOfBirth !== 'string' || !dateOfBirth.trim()) {
    errors.push('Date of birth is required.');
  } else {
    const dobDate = new Date(dateOfBirth.trim());
    if (isNaN(dobDate.getTime())) {
      errors.push('Please enter a valid date of birth (YYYY-MM-DD).');
    } else if (dobDate > new Date()) {
      errors.push('Date of birth cannot be in the future.');
    } else {
      const today = new Date();
      let age = today.getFullYear() - dobDate.getFullYear();
      const monthDiff = today.getMonth() - dobDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
        age--;
      }
      if (age < 18) {
        errors.push('You must be at least 18 years old to create an account.');
      }
    }
  }

  // Gender validation (optional, defaults to 'unspecified')
  const validGenders = ['male', 'female', 'other', 'unspecified'];
  let cleanGender = 'unspecified';
  if (gender && typeof gender === 'string') {
    const lower = gender.trim().toLowerCase();
    if (validGenders.includes(lower)) {
      cleanGender = lower;
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors: errors,
      error: errors[0] // Primary error message for single-toast display
    });
  }

  // Normalize trimmed fields
  req.body.username = username.trim().toLowerCase();
  req.body.email = email.trim().toLowerCase();
  req.body.dateOfBirth = dateOfBirth.trim();
  req.body.gender = cleanGender;
  if (fullName && typeof fullName === 'string') {
    req.body.fullName = fullName.trim();
  }

  next();
};

/**
 * Validates login request input
 * Ensures identifier & password are valid strings, not empty, and within length boundaries.
 */
const validateLogin = (req, res, next) => {
  const { identifier, password } = req.body;
  const errors = [];

  // Identifier (username or email)
  if (!identifier || typeof identifier !== 'string') {
    errors.push('Please provide your username or email address.');
  } else {
    const trimmedIdentifier = identifier.trim();
    if (trimmedIdentifier.length === 0) {
      errors.push('Username or email cannot be empty.');
    } else if (trimmedIdentifier.length > 255) {
      errors.push('Username or email cannot exceed 255 characters.');
    }
  }

  // Password validation (prevent Hash DoS with 128 char upper limit)
  if (!password || typeof password !== 'string') {
    errors.push('Please provide your password.');
  } else if (password.length === 0) {
    errors.push('Password cannot be empty.');
  } else if (password.length > 128) {
    errors.push('Password cannot exceed 128 characters.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors: errors,
      error: errors[0]
    });
  }

  // Normalize trimmed identifier
  req.body.identifier = identifier.trim().toLowerCase();

  next();
};

const RESERVED_USERNAMES = [
  'admin', 'administrator', 'api', 'auth', 'support', 'help', 'root', 
  'vibegrid', 'explore', 'messages', 'settings', 'profile', 'moderator', 
  'system', 'terms', 'privacy', 'status', 'feed', 'notifications', 'account'
];

const validateProfileUpdate = (req, res, next) => {
  const { fullName, bio, website, location, dateOfBirth, username, gender } = req.body;
  const errors = [];

  // Username validation (if user requested a username change)
  if (username !== undefined && username !== null) {
    if (typeof username !== 'string') {
      errors.push('Username must be a text string.');
    } else {
      const trimmedUser = username.trim().toLowerCase();
      if (trimmedUser.length < 3 || trimmedUser.length > 30) {
        errors.push('Username must be between 3 and 30 characters long.');
      }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmedUser)) {
        errors.push('Username can only contain letters, numbers, and underscores (no spaces or special characters).');
      }
      if (RESERVED_USERNAMES.includes(trimmedUser)) {
        errors.push(`The username "${trimmedUser}" is reserved by VibeGrid and cannot be chosen.`);
      }
    }
  }

  // Validate full name (optional, max 100 characters)
  if (fullName !== undefined && fullName !== null) {
    if (typeof fullName !== 'string') {
      errors.push('Full name must be a text string.');
    } else if (fullName.trim().length > 100) {
      errors.push('Full name cannot exceed 100 characters.');
    }
  }

  // Validate bio (optional, strict max 150 characters)
  if (bio !== undefined && bio !== null) {
    if (typeof bio !== 'string') {
      errors.push('Bio must be a text string.');
    } else if (bio.trim().length > 150) {
      errors.push('Bio cannot exceed 150 characters.');
    }
  }

  // Validate website URL (optional, max 255 characters)
  if (website !== undefined && website !== null && website.trim() !== '') {
    if (typeof website !== 'string') {
      errors.push('Website must be a valid URL string.');
    } else {
      const trimmedUrl = website.trim();
      if (trimmedUrl.length > 255) {
        errors.push('Website URL cannot exceed 255 characters.');
      }
      const urlPattern = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/;
      if (!urlPattern.test(trimmedUrl)) {
        errors.push('Please enter a valid website URL (e.g. https://yourwebsite.com or portfolio.design).');
      }
    }
  }

  // Validate location (optional, max 100 characters)
  if (location !== undefined && location !== null && location.trim() !== '') {
    if (typeof location !== 'string') {
      errors.push('Location must be a text string.');
    } else if (location.trim().length > 100) {
      errors.push('Location cannot exceed 100 characters.');
    }
  }

  // Validate date of birth (optional, YYYY-MM-DD format, must be at least 18 years old)
  if (dateOfBirth !== undefined && dateOfBirth !== null && dateOfBirth.trim() !== '') {
    if (typeof dateOfBirth !== 'string') {
      errors.push('Date of birth must be a valid date string (YYYY-MM-DD).');
    } else {
      const dobDate = new Date(dateOfBirth.trim());
      if (isNaN(dobDate.getTime())) {
        errors.push('Date of birth is invalid.');
      } else if (dobDate > new Date()) {
        errors.push('Date of birth cannot be in the future.');
      } else {
        const today = new Date();
        let age = today.getFullYear() - dobDate.getFullYear();
        const monthDiff = today.getMonth() - dobDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
          age--;
        }
        if (age < 18) {
          errors.push('You must be at least 18 years old.');
        }
      }
    }
  }

  // Validate gender if provided
  const validGenders = ['male', 'female', 'other', 'unspecified'];
  if (gender !== undefined && gender !== null) {
    if (typeof gender !== 'string' || !validGenders.includes(gender.trim().toLowerCase())) {
      errors.push('Gender must be one of: male, female, other, unspecified.');
    } else {
      req.body.gender = gender.trim().toLowerCase();
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors: errors,
      error: errors[0]
    });
  }

  next();
};

const COMMON_PASSWORDS = ['password', 'password123', '12345678', '123456789', 'admin123', 'qwertyuiop', 'welcome123'];

/**
 * Validates forgot password request input
 */
const validateForgotPassword = (req, res, next) => {
  const { email } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push('Please provide your registered email address.');
  } else {
    const trimmedEmail = email.trim();
    if (trimmedEmail.length > 255) {
      errors.push('Email address cannot exceed 255 characters.');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      errors.push('Please enter a valid email address.');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
      error: errors[0]
    });
  }

  req.body.email = email.trim().toLowerCase();
  next();
};

/**
 * Validates reset password request input (token or OTP + newPassword)
 */
const validateResetPassword = (req, res, next) => {
  const { email, token, otp, newPassword } = req.body;
  const errors = [];

  // Email
  if (!email || typeof email !== 'string') {
    errors.push('Email is required.');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.push('Please enter a valid email address.');
    }
  }

  // Verification token or OTP
  if (!token && !otp) {
    errors.push('A valid reset token or 6-digit OTP code is required.');
  } else if (otp && (typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim()))) {
    errors.push('OTP code must be a 6-digit number.');
  } else if (token && (typeof token !== 'string' || token.trim().length > 255)) {
    errors.push('Invalid reset token format.');
  }

  // New Password
  if (!newPassword || typeof newPassword !== 'string') {
    errors.push('New password is required.');
  } else if (newPassword.length < 8) {
    errors.push('New password must be at least 8 characters long.');
  } else if (newPassword.length > 128) {
    errors.push('New password cannot exceed 128 characters.');
  } else {
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      errors.push('New password must contain at least one letter and one number.');
    }
    if (COMMON_PASSWORDS.includes(newPassword.toLowerCase())) {
      errors.push('This password is too common. Please choose a stronger password.');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
      error: errors[0]
    });
  }

  req.body.email = email.trim().toLowerCase();
  if (req.body.token) req.body.token = req.body.token.trim();
  if (req.body.otp) req.body.otp = req.body.otp.trim();
  next();
};

/**
 * Validates password change for logged-in user
 */
const validateChangePassword = (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const errors = [];

  if (!currentPassword || typeof currentPassword !== 'string' || currentPassword.length === 0) {
    errors.push('Current password is required.');
  }

  if (!newPassword || typeof newPassword !== 'string') {
    errors.push('New password is required.');
  } else if (newPassword.length < 8) {
    errors.push('New password must be at least 8 characters long.');
  } else if (newPassword.length > 128) {
    errors.push('New password cannot exceed 128 characters.');
  } else {
    if (!/[A-Z]/.test(newPassword)) {
      errors.push('New password must contain at least one uppercase letter.');
    }
    if (!/[a-z]/.test(newPassword)) {
      errors.push('New password must contain at least one lowercase letter.');
    }
    if (!/[0-9]/.test(newPassword)) {
      errors.push('New password must contain at least one number.');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      errors.push('New password must contain at least one special character (!@#$%^&* etc.).');
    }
    if (COMMON_PASSWORDS.includes(newPassword.toLowerCase())) {
      errors.push('This password is too common. Please choose a stronger password.');
    }
  }

  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    errors.push('New password and confirm password do not match.');
  }

  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.push('New password must be different from your current password.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
      error: errors[0]
    });
  }

  next();
};

/**
 * Validates Email OTP Request (Send OTP for verification or email change)
 */
const validateEmailOtpRequest = (req, res, next) => {
  const { newEmail, currentPassword } = req.body;
  const errors = [];

  // If newEmail is provided, this is an email change request
  if (newEmail !== undefined && newEmail !== null && String(newEmail).trim() !== '') {
    const trimmedEmail = String(newEmail).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      errors.push('Please provide a valid new email address.');
    } else if (trimmedEmail.length > 255) {
      errors.push('Email address cannot exceed 255 characters.');
    }

    if (!currentPassword || typeof currentPassword !== 'string' || currentPassword.length === 0) {
      errors.push('Your current password is required to change your email address.');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
      error: errors[0]
    });
  }

  next();
};

/**
 * Validates Email OTP Verification
 */
const validateEmailOtpVerification = (req, res, next) => {
  const { otp, newEmail } = req.body;
  const errors = [];

  if (!otp || (typeof otp !== 'string' && typeof otp !== 'number')) {
    errors.push('Please enter the 6-digit verification code.');
  } else {
    const cleanOtp = String(otp).trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      errors.push('Verification code must be exactly 6 digits.');
    }
  }

  if (newEmail !== undefined && newEmail !== null && String(newEmail).trim() !== '') {
    const trimmedEmail = String(newEmail).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      errors.push('Invalid new email format.');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
      error: errors[0]
    });
  }

  next();
};

/**
 * International E.164 phone format: + followed by 1 to 14 digits (e.g. +14155552671, +919876543210)
 */
const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * Validates Phone OTP Request (Send OTP to add or change phone)
 */
const validatePhoneOtpRequest = (req, res, next) => {
  const { phoneNumber, currentPassword } = req.body;
  const errors = [];

  if (!phoneNumber || typeof phoneNumber !== 'string') {
    errors.push('Phone number is required.');
  } else {
    const cleanPhone = phoneNumber.trim().replace(/[\s\-()]/g, '');
    if (!E164_PHONE_REGEX.test(cleanPhone)) {
      errors.push('Phone number must follow international E.164 format with country code (e.g. +14155552671 or +919876543210).');
    }
    req.body.phoneNumber = cleanPhone;
  }

  if (!currentPassword || typeof currentPassword !== 'string' || currentPassword.length === 0) {
    errors.push('Your current password is required to authorize phone number changes.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
      error: errors[0]
    });
  }

  next();
};

/**
 * Validates Phone OTP Verification
 */
const validatePhoneOtpVerification = (req, res, next) => {
  const { otp, phoneNumber } = req.body;
  const errors = [];

  if (!otp || (typeof otp !== 'string' && typeof otp !== 'number')) {
    errors.push('Please enter the 6-digit verification code.');
  } else {
    const cleanOtp = String(otp).trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      errors.push('Verification code must be exactly 6 digits.');
    }
  }

  if (!phoneNumber || typeof phoneNumber !== 'string') {
    errors.push('Phone number is required.');
  } else {
    const cleanPhone = phoneNumber.trim().replace(/[\s\-()]/g, '');
    if (!E164_PHONE_REGEX.test(cleanPhone)) {
      errors.push('Invalid phone number format.');
    }
    req.body.phoneNumber = cleanPhone;
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
      error: errors[0]
    });
  }

  next();
};

/**
 * Validates Phone Number Removal
 */
const validateRemovePhone = (req, res, next) => {
  const { currentPassword } = req.body;
  const errors = [];

  if (!currentPassword || typeof currentPassword !== 'string' || currentPassword.length === 0) {
    errors.push('Your current password is required to remove your phone number.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
      error: errors[0]
    });
  }

  next();
};

/**
 * Validates Privacy Settings update
 */
const validatePrivacySettings = (req, res, next) => {
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

  const errors = [];
  const validInteractions = ['everyone', 'following', 'nobody'];
  const validStoryVisibility = ['everyone', 'following', 'close_friends'];

  if (is_private !== undefined && typeof is_private !== 'boolean') {
    errors.push('is_private must be a boolean.');
  }

  if (allow_messages_from !== undefined && !validInteractions.includes(allow_messages_from)) {
    errors.push('allow_messages_from must be one of: everyone, following, nobody.');
  }

  if (allow_comments_from !== undefined && !validInteractions.includes(allow_comments_from)) {
    errors.push('allow_comments_from must be one of: everyone, following, nobody.');
  }

  if (allow_mentions_from !== undefined && !validInteractions.includes(allow_mentions_from)) {
    errors.push('allow_mentions_from must be one of: everyone, following, nobody.');
  }

  if (allow_tags_from !== undefined && !validInteractions.includes(allow_tags_from)) {
    errors.push('allow_tags_from must be one of: everyone, following, nobody.');
  }

  if (req.body.allow_calls_from !== undefined && !validInteractions.includes(req.body.allow_calls_from)) {
    errors.push('allow_calls_from must be one of: everyone, following, nobody.');
  }

  if (req.body.allow_group_add_from !== undefined && !validInteractions.includes(req.body.allow_group_add_from)) {
    errors.push('allow_group_add_from must be one of: everyone, following, nobody.');
  }

  if (show_online_status !== undefined && typeof show_online_status !== 'boolean') {
    errors.push('show_online_status must be a boolean.');
  }

  if (show_read_receipts !== undefined && typeof show_read_receipts !== 'boolean') {
    errors.push('show_read_receipts must be a boolean.');
  }

  if (story_visibility !== undefined && !validStoryVisibility.includes(story_visibility)) {
    errors.push('story_visibility must be one of: everyone, following, close_friends.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
      error: errors[0]
    });
  }

  next();
};

/**
 * Validates Notification Settings update
 */
const validateNotificationSettings = (req, res, next) => {
  const allowedKeys = [
    'notif_likes',
    'notif_comments',
    'notif_follows',
    'notif_messages',
    'notif_mentions',
    'notif_tags',
    'notif_stories',
    'notif_security',
    'notif_email'
  ];

  const errors = [];

  for (const key of allowedKeys) {
    if (req.body[key] !== undefined && typeof req.body[key] !== 'boolean') {
      errors.push(`${key} must be a boolean (true or false).`);
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
      error: errors[0]
    });
  }

  next();
};

/**
 * Validate Account Deactivation request (Phase 9)
 * Requires password to confirm user identity.
 */
const validateDeactivateAccount = (req, res, next) => {
  const { password, reason } = req.body;
  const errors = [];

  if (!password || typeof password !== 'string' || password.trim().length === 0) {
    errors.push('Your current password is required to deactivate your account.');
  }

  if (reason && typeof reason !== 'string') {
    errors.push('Reason must be a valid text string.');
  } else if (reason && reason.length > 255) {
    errors.push('Reason cannot exceed 255 characters.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
      error: errors[0]
    });
  }

  next();
};

/**
 * Validate Permanent Account Deletion request (Phase 10)
 * Requires password and explicit confirmation matching the username.
 */
const validateDeleteAccount = (req, res, next) => {
  const { password, confirmation } = req.body;
  const errors = [];

  if (!password || typeof password !== 'string' || password.trim().length === 0) {
    errors.push('Your current password is required to permanently delete your account.');
  }

  if (!confirmation || typeof confirmation !== 'string' || confirmation.trim().length === 0) {
    errors.push('Please type your username to confirm permanent deletion.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
      error: errors[0]
    });
  }

  next();
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateProfileUpdate,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
  validateEmailOtpRequest,
  validateEmailOtpVerification,
  validatePhoneOtpRequest,
  validatePhoneOtpVerification,
  validateRemovePhone,
  validatePrivacySettings,
  validateNotificationSettings,
  validateDeactivateAccount,
  validateDeleteAccount
};

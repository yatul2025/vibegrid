/**
 * src/utils/jwt.js
 * ================
 * JSON Web Token (JWT) and HTTP-Only Cookie Helpers
 * 
 * Why HTTP-Only Cookies?
 * A token stored in browser localStorage can be stolen by malicious JavaScript (XSS attacks).
 * An HTTP-Only cookie cannot be accessed by JavaScript at all — the browser automatically attaches
 * it to requests to your backend, providing maximum security.
 */

const jwt = require('jsonwebtoken');
const config = require('../config/env');

const COOKIE_NAME = 'vibegrid_token';

/**
 * Signs a new JWT token containing user identifier payload
 * @param {object} payload - e.g. { id, username }
 * @returns {string} signed JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
};

/**
 * Sets the signed JWT into a secure HTTP-Only cookie
 * @param {object} res - Express response object
 * @param {string} token - Signed JWT string
 */
const setAuthCookie = (res, token) => {
  const isProduction = config.nodeEnv === 'production';

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // Prevents JavaScript from reading the cookie (protects against XSS)
    secure: isProduction, // Uses HTTPS in production
    sameSite: isProduction ? 'strict' : 'lax', // Protects against CSRF attacks
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/' // Explicit root path for entire application domain
  });
};

/**
 * Clears the authentication cookie on logout with matching attributes
 * @param {object} res - Express response object
 */
const clearAuthCookie = (res) => {
  const isProduction = config.nodeEnv === 'production';

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/'
  });
};

module.exports = {
  COOKIE_NAME,
  generateToken,
  setAuthCookie,
  clearAuthCookie
};

/**
 * src/utils/password.js
 * =====================
 * Password Security Helpers using bcrypt
 * 
 * Why bcrypt?
 * bcrypt is a slow, cryptographic hashing algorithm designed specifically for passwords.
 * It automatically generates a unique "salt" (random data) for every password and hashes it
 * multiple times (rounds), making rainbow table and brute-force attacks computationally infeasible.
 */

const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12; // 12 rounds is the industry gold standard for security vs speed

/**
 * Hashes a plaintext password securely
 * @param {string} plainPassword 
 * @returns {Promise<string>} hashed password string
 */
const hashPassword = async (plainPassword) => {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
};

/**
 * Compares a plaintext password against a stored bcrypt hash
 * @param {string} plainPassword 
 * @param {string} hashedPassword 
 * @returns {Promise<boolean>} true if matching, false otherwise
 */
const comparePassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

module.exports = {
  hashPassword,
  comparePassword
};

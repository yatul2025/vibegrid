/**
 * src/config/env.js
 * =================
 * Centralized Environment Configuration
 * 
 * Why this is useful:
 * 1. Loads all environment variables from .env into process.env using dotenv.
 * 2. Provides default values for development so the app doesn't crash on missing optional keys.
 * 3. Prevents repeating `process.env.VARIABLE_NAME` across multiple files.
 */

const dotenv = require('dotenv');
const path = require('path');

// Explicitly load .env from the server folder
dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'fallback_dev_secret_please_change',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL || null,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    name: process.env.DB_NAME || 'vibegrid_db'
  },
  email: {
    user: (process.env.EMAIL_USER || '').trim(),
    pass: (process.env.EMAIL_PASS || '').replace(/\s+/g, '')
  }
};

module.exports = config;

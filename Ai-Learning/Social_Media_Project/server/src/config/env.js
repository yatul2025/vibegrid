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
  },
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || 'BLVPwmEUJoZMU1ukVq-BkpOtiQKg3y0K0fjnxHj5JdzTdAHc8SzmPJ8Ktj46BdocS-zcz_Oj1Gk-WUEVwLuS0V8',
    privateKey: process.env.VAPID_PRIVATE_KEY || '_V5vcocKyq3Alceg0Nd1ED1JkPk7y2v5YmdOlURuhgA',
    subject: process.env.VAPID_SUBJECT || 'mailto:support@vibegrid.app'
  },
  turn: {
    secret: process.env.TURN_SECRET || null,
    domain: process.env.TURN_DOMAIN || 'turn.vibegrid.app',
    port: parseInt(process.env.TURN_PORT, 10) || 3478,
    tlsPort: parseInt(process.env.TURN_TLS_PORT, 10) || 5349,
    meteredDomain: process.env.METERED_DOMAIN || null,
    meteredApiKey: process.env.METERED_API_KEY || null
  },
  vibi: {
    geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null,
    openaiApiKey: process.env.OPENAI_API_KEY || null,
    defaultProvider: process.env.VIBI_AI_PROVIDER || 'auto', // 'auto' | 'gemini' | 'openai' | 'knowledge_base'
    modelName: process.env.VIBI_MODEL_NAME || 'gemini-1.5-flash'
  }
};

module.exports = config;

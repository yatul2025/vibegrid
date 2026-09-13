/**
 * src/server.js
 * =============
 * Main Express Application Entry Point
 * Last updated: Connected to Neon PostgreSQL
 * 
 * Sets up middleware pipeline, CORS, health endpoints, static upload folder,
 * and starts the HTTP server.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config/env');
const db = require('./config/db');

const app = express();

// Security: Enable reverse proxy trust (1 hop) for accurate client IP in rate limiters
app.set('trust proxy', 1);

// ============================================================================
// 1. Security & Core Middlewares
// ============================================================================

// Helmet sets secure HTTP response headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allows React client to load uploaded images
}));

// CORS enables your React frontend (on http://localhost:5173) to communicate with this server
app.use(cors({
  origin: config.clientUrl,
  credentials: true // Crucial: Allows sending and receiving HTTP-Only cookies
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static file hosting for uploaded images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================================================
// 2. Health & Status Endpoints
// ============================================================================

app.get('/api/health', async (req, res) => {
  const dbStatus = await db.testConnection();

  // Always return 200 so the diagnostic frontend can read the database status
  res.status(200).json({
    success: true,
    status: dbStatus.connected ? 'healthy' : 'database_pending',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    server: {
      uptimeSeconds: Math.floor(process.uptime()),
      environment: config.nodeEnv,
      port: config.port
    }
  });
});

// ============================================================================
// 3. API Routes
// ============================================================================

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/stories', require('./routes/storyRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/hashtags', require('./routes/hashtagRoutes'));

// ============================================================================
// 4. Centralized Error Handling Middleware
// ============================================================================

app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    error: config.nodeEnv === 'production' ? 'Internal server error' : err.message
  });
});

// ============================================================================
// 4. Start Server
// ============================================================================

const startServer = async () => {
  // Test database connection on startup
  console.log('Testing PostgreSQL connection...');
  const dbCheck = await db.testConnection();
  if (dbCheck.connected) {
    console.log(`[DB] Connected successfully to PostgreSQL! Server time: ${dbCheck.currentTime}`);
  } else {
    console.warn(`[DB Warning] Could not connect to PostgreSQL: ${dbCheck.error}`);
    console.warn('[DB Tip] Check your .env DATABASE_URL credentials or ensure PostgreSQL service is running.');
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log('============================================================');
    console.log(`🚀 VibeGrid Express Server running at http://localhost:${config.port}`);
    console.log(`📡 Client URL allowed by CORS: ${config.clientUrl}`);
    console.log(`🩺 Health check endpoint: http://localhost:${config.port}/api/health`);
    console.log('============================================================');
  });
};

if (require.main === module) {
  startServer();
}

module.exports = app;

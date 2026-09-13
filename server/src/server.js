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
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config/env');
const db = require('./config/db');
const { initSocket } = require('./socket');

const app = express();
const httpServer = http.createServer(app);
const io = initSocket(httpServer);
app.set('io', io);

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

// Static file hosting for uploaded images (local disk / default SVGs)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Dynamic media file server from PostgreSQL (handles Vercel Serverless and cloud deployments)
app.get(['/uploads/:folder/:filename', '/api/uploads/:folder/:filename'], async (req, res, next) => {
  try {
    const { folder, filename } = req.params;
    const mediaRes = await db.query(
      'SELECT mime_type, data FROM media_files WHERE id = $1 AND folder = $2 LIMIT 1',
      [filename, folder]
    );

    if (mediaRes.rows.length === 0) {
      if (filename.startsWith('default-')) {
        return res.redirect('/uploads/avatars/default-avatar.svg');
      }
      return res.status(404).json({ success: false, error: 'Media file not found' });
    }

    const { mime_type, data } = mediaRes.rows[0];
    res.setHeader('Content-Type', mime_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(data);
  } catch (err) {
    console.error('[Media Serve Error]', err);
    next(err);
  }
});

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
app.use('/api/users', require('./routes/blockRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/stories', require('./routes/storyRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/conversations', require('./routes/conversationRoutes'));
app.use('/api/e2ee', require('./routes/e2eeRoutes'));
app.use('/api/calls', require('./routes/callRoutes'));
app.use('/api/hashtags', require('./routes/hashtagRoutes'));

// ============================================================================
// 4. Centralized Error Handling Middleware
// ============================================================================

app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err.stack || err.message);

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Please upload an image under 10MB.'
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.status ? err.message : (config.nodeEnv === 'production' && statusCode === 500 ? 'Internal server error' : err.message)
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

  httpServer.listen(config.port, '0.0.0.0', () => {
    console.log('============================================================');
    console.log(`🚀 VibeGrid Express + Socket.IO Server running at http://localhost:${config.port}`);
    console.log(`📡 Client URL allowed by CORS: ${config.clientUrl}`);
    console.log(`🩺 Health check endpoint: http://localhost:${config.port}/api/health`);
    console.log('============================================================');
  });
};

if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.httpServer = httpServer;
module.exports.io = io;

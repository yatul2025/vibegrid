/**
 * api/index.js
 * ============
 * Vercel Serverless Function entry point.
 * Forwards all incoming API requests to the VibeGrid Express application.
 */

const app = require('../server/src/server');

module.exports = app;

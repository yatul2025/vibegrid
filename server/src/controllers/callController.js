/**
 * server/src/controllers/callController.js
 * ========================================
 * WebRTC Call History & Ephemeral TURN Credential Controller
 */

const crypto = require('crypto');
const config = require('../config/env');
const { query } = require('../config/db');

/**
 * @desc    Get user's call history
 * @route   GET /api/calls/history
 * @access  Private (Authenticated)
 */
const getCallHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await query(`
      SELECT 
        c.id,
        c.conversation_id,
        c.initiator_id,
        c.call_type,
        c.status,
        c.started_at,
        c.ended_at,
        c.duration_seconds,
        (c.initiator_id = $1) AS is_outgoing,
        u_init.username AS initiator_username,
        u_init.avatar_url AS initiator_avatar_url,
        cp.status AS my_status,
        -- Peer details in 1-to-1 calls
        u_peer.id AS peer_id,
        u_peer.username AS peer_username,
        u_peer.full_name AS peer_full_name,
        u_peer.avatar_url AS peer_avatar_url
      FROM calls c
      JOIN call_participants cp ON c.id = cp.call_id AND cp.user_id = $1
      JOIN users u_init ON c.initiator_id = u_init.id
      LEFT JOIN call_participants cp_peer ON c.id = cp_peer.call_id AND cp_peer.user_id <> $1
      LEFT JOIN users u_peer ON cp_peer.user_id = u_peer.id
      ORDER BY c.started_at DESC
      LIMIT 50
    `, [userId]);

    res.status(200).json({
      success: true,
      data: {
        calls: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate time-windowed ephemeral TURN credentials (HMAC-SHA1)
 * @route   GET /api/calls/turn-credentials
 * @access  Private (Authenticated)
 */
const getTurnCredentials = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Standard STUN servers (always available)
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ];

    // If a TURN secret is configured in environment, generate ephemeral HMAC-SHA1 credentials
    const turnSecret = process.env.TURN_SECRET;
    const turnDomain = process.env.TURN_DOMAIN || 'turn.vibegrid.com';

    if (turnSecret) {
      const ttl = 3600; // 1 hour validity
      const timestamp = Math.floor(Date.now() / 1000) + ttl;
      const username = `${timestamp}:${userId}`;
      const hmac = crypto.createHmac('sha1', turnSecret);
      hmac.setEncoding('base64');
      hmac.write(username);
      hmac.end();
      const credential = hmac.read();

      iceServers.push(
        {
          urls: `turn:${turnDomain}:3478?transport=udp`,
          username,
          credential
        },
        {
          urls: `turn:${turnDomain}:3478?transport=tcp`,
          username,
          credential
        },
        {
          urls: `turns:${turnDomain}:443?transport=tcp`,
          username,
          credential
        }
      );
    }

    res.status(200).json({
      success: true,
      data: {
        iceServers
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCallHistory,
  getTurnCredentials
};

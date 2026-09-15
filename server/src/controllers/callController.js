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
    const userId = req.user?.id || 'guest';

    // 1. Standard Redundant STUN servers
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ];

    let hasTurn = false;

    // 2. Coturn Self-Hosted Ephemeral HMAC-SHA1 Credentials
    const turnSecret = config.turn?.secret || process.env.TURN_SECRET;
    const turnDomain = config.turn?.domain || process.env.TURN_DOMAIN;
    const turnPort = config.turn?.port || parseInt(process.env.TURN_PORT, 10) || 3478;
    const turnTlsPort = config.turn?.tlsPort || parseInt(process.env.TURN_TLS_PORT, 10) || 5349;

    if (turnSecret && turnDomain) {
      try {
        const ttl = 3600; // 1 hour validity
        const timestamp = Math.floor(Date.now() / 1000) + ttl;
        const username = `${timestamp}:${userId}`;
        const hmac = crypto.createHmac('sha1', turnSecret);
        hmac.setEncoding('base64');
        hmac.write(username);
        hmac.end();
        const credential = hmac.read();

        iceServers.unshift(
          {
            urls: `turn:${turnDomain}:${turnPort}?transport=udp`,
            username,
            credential
          },
          {
            urls: `turn:${turnDomain}:${turnPort}?transport=tcp`,
            username,
            credential
          },
          {
            urls: `turns:${turnDomain}:${turnTlsPort}?transport=tcp`,
            username,
            credential
          }
        );
        hasTurn = true;
      } catch (err) {
        console.error('[CallController] Coturn HMAC credential generation failed:', err.message);
      }
    }

    // 3. Metered Cloud TURN API
    const meteredDomain = config.turn?.meteredDomain || process.env.METERED_DOMAIN;
    const meteredApiKey = config.turn?.meteredApiKey || process.env.METERED_API_KEY;

    if (meteredDomain && meteredApiKey) {
      try {
        const meteredRes = await fetch(`https://${meteredDomain}/api/v1/turn/credentials?apiKey=${meteredApiKey}`);
        if (meteredRes.ok) {
          const meteredIce = await meteredRes.json();
          if (Array.isArray(meteredIce) && meteredIce.length > 0) {
            iceServers.unshift(...meteredIce);
            hasTurn = true;
          }
        }
      } catch (e) {
        console.warn('[CallController] Could not fetch Metered TURN credentials:', e.message);
      }
    }

    // 4. Free OpenRelay TURN Fallback (Ensures relay candidates exist in development/staging)
    if (!hasTurn) {
      iceServers.push(
        { urls: 'stun:openrelay.metered.ca:80' },
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
      );
    }

    res.status(200).json({
      success: true,
      data: {
        iceServers,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      }
    });
  } catch (error) {
    console.error('[CallController] getTurnCredentials error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve ICE credentials.'
    });
  }
};

/**
 * @desc    Initiate a 1-to-1 WebRTC Call via HTTP (Serverless-Safe)
 * @route   POST /api/calls/initiate
 * @access  Private (Authenticated)
 */
const initiateCall = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { targetUserId, callType = 'audio', conversationId } = req.body;
    const calleeId = Number(targetUserId);

    if (!calleeId || calleeId === userId) {
      return res.status(400).json({ success: false, error: 'Invalid callee user ID.' });
    }

    // Check blocked status
    const blockCheck = await query(
      'SELECT 1 FROM blocked_users WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1',
      [userId, calleeId]
    );
    if (blockCheck.rows.length > 0) {
      return res.status(403).json({ success: false, error: 'Unable to connect call with this user.' });
    }

    // Verify recipient privacy settings
    const targetRes = await query(
      'SELECT id, username, full_name, avatar_url, allow_calls_from FROM users WHERE id = $1 LIMIT 1',
      [calleeId]
    );
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const targetUser = targetRes.rows[0];
    const allowCalls = targetUser.allow_calls_from || 'everyone';
    if (allowCalls === 'nobody') {
      return res.status(403).json({ success: false, error: 'This user does not accept incoming calls.' });
    }
    if (allowCalls === 'following') {
      const followCheck = await query(
        'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1',
        [calleeId, userId]
      );
      if (followCheck.rows.length === 0) {
        return res.status(403).json({ success: false, error: 'This user only accepts calls from accounts they follow.' });
      }
    }

    // Insert call record
    const callInsert = await query(
      `INSERT INTO calls (conversation_id, initiator_id, call_type, status)
       VALUES ($1, $2, $3, 'ringing')
       RETURNING id, started_at`,
      [conversationId || null, userId, callType]
    );
    const callId = callInsert.rows[0].id;

    // Insert participants
    await query(
      `INSERT INTO call_participants (call_id, user_id, status)
       VALUES ($1, $2, 'accepted'), ($1, $3, 'ringing')
       ON CONFLICT (call_id, user_id) DO NOTHING`,
      [callId, userId, calleeId]
    );

    // Relay via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${calleeId}`).emit('call:incoming', {
        callId,
        caller: {
          id: userId,
          username: req.user.username,
          full_name: req.user.full_name,
          avatar_url: req.user.avatar_url
        },
        callType,
        conversationId
      });
    }

    res.status(201).json({
      success: true,
      data: {
        callId,
        call: {
          id: callId,
          initiator_id: userId,
          target_user_id: calleeId,
          call_type: callType,
          status: 'ringing'
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get currently active incoming or connected call for user (Serverless Polling)
 * @route   GET /api/calls/active
 * @access  Private (Authenticated)
 */
const getActiveCall = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const activeRes = await query(`
      SELECT 
        c.id AS call_id,
        c.conversation_id,
        c.initiator_id,
        c.call_type,
        c.status AS call_status,
        c.started_at,
        cp.status AS my_participant_status,
        u_init.username AS caller_username,
        u_init.full_name AS caller_full_name,
        u_init.avatar_url AS caller_avatar_url
      FROM calls c
      JOIN call_participants cp ON c.id = cp.call_id AND cp.user_id = $1
      JOIN users u_init ON c.initiator_id = u_init.id
      WHERE c.status IN ('initiated', 'ringing', 'connected')
        AND cp.status IN ('invited', 'ringing', 'accepted')
        AND c.started_at > (CURRENT_TIMESTAMP - INTERVAL '90 seconds')
      ORDER BY c.started_at DESC
      LIMIT 1
    `, [userId]);

    if (activeRes.rows.length === 0) {
      return res.status(200).json({ success: true, data: { activeCall: null } });
    }

    const row = activeRes.rows[0];
    const activeCall = {
      callId: row.call_id,
      conversationId: row.conversation_id,
      callType: row.call_type,
      callStatus: row.call_status,
      myParticipantStatus: row.my_participant_status,
      isInitiator: row.initiator_id === userId,
      caller: {
        id: row.initiator_id,
        username: row.caller_username,
        full_name: row.caller_full_name,
        avatar_url: row.caller_avatar_url
      }
    };

    res.status(200).json({ success: true, data: { activeCall } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Accept an incoming call
 * @route   POST /api/calls/:id/accept
 * @access  Private (Authenticated)
 */
const acceptCall = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const callId = req.params.id;

    await query(
      `UPDATE call_participants SET status = 'accepted', joined_at = CURRENT_TIMESTAMP WHERE call_id = $1 AND user_id = $2`,
      [callId, userId]
    );

    await query(
      `UPDATE calls SET status = 'connected' WHERE id = $1`,
      [callId]
    );

    const callRes = await query('SELECT initiator_id FROM calls WHERE id = $1 LIMIT 1', [callId]);
    const initiatorId = callRes.rows[0]?.initiator_id;

    if (initiatorId) {
      await query(
        `INSERT INTO call_signals (call_id, from_user_id, to_user_id, signal_type, payload)
         VALUES ($1, $2, $3, 'accept', '{}')`,
        [callId, userId, initiatorId]
      );

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${initiatorId}`).emit('call:accepted', { callId, calleeId: userId });
      }
    }

    res.status(200).json({ success: true, data: { status: 'connected' } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject / Decline an incoming call
 * @route   POST /api/calls/:id/reject
 * @access  Private (Authenticated)
 */
const rejectCall = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const callId = req.params.id;
    const { reason = 'declined' } = req.body;

    await query(
      `UPDATE call_participants SET status = 'rejected' WHERE call_id = $1 AND user_id = $2`,
      [callId, userId]
    );

    await query(
      `UPDATE calls SET status = 'rejected', ended_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [callId]
    );

    const callRes = await query('SELECT initiator_id FROM calls WHERE id = $1 LIMIT 1', [callId]);
    const initiatorId = callRes.rows[0]?.initiator_id;

    if (initiatorId) {
      await query(
        `INSERT INTO call_signals (call_id, from_user_id, to_user_id, signal_type, payload)
         VALUES ($1, $2, $3, 'reject', $4)`,
        [callId, userId, initiatorId, JSON.stringify({ reason })]
      );

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${initiatorId}`).emit('call:rejected', { callId, reason });
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    End an ongoing call
 * @route   POST /api/calls/:id/end
 * @access  Private (Authenticated)
 */
const endCall = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const callId = req.params.id;

    await query(`
      UPDATE calls
      SET status = 'ended',
          ended_at = CURRENT_TIMESTAMP,
          duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at))::int)
      WHERE id = $1
    `, [callId]);

    await query(`
      UPDATE call_participants
      SET status = 'left',
          left_at = CURRENT_TIMESTAMP
      WHERE call_id = $1 AND user_id = $2
    `, [callId, userId]);

    const peerRes = await query(`
      SELECT user_id FROM call_participants WHERE call_id = $1 AND user_id <> $2 LIMIT 1
    `, [callId, userId]);
    const peerId = peerRes.rows[0]?.user_id;

    if (peerId) {
      await query(
        `INSERT INTO call_signals (call_id, from_user_id, to_user_id, signal_type, payload)
         VALUES ($1, $2, $3, 'end', '{}')`,
        [callId, userId, peerId]
      );

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${peerId}`).emit('call:ended', { callId });
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send WebRTC SDP Offer / Answer or ICE candidate via HTTP
 * @route   POST /api/calls/:id/signal
 * @access  Private (Authenticated)
 */
const sendSignal = async (req, res, next) => {
  try {
    const fromUserId = req.user.id;
    const callId = req.params.id;
    const { toUserId, signalType, payload } = req.body;

    if (!toUserId || !signalType || !payload) {
      return res.status(400).json({ success: false, error: 'Missing required signal fields.' });
    }

    const ins = await query(
      `INSERT INTO call_signals (call_id, from_user_id, to_user_id, signal_type, payload)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [callId, fromUserId, Number(toUserId), signalType, JSON.stringify(payload)]
    );

    const io = req.app.get('io');
    if (io) {
      if (signalType === 'offer') {
        const offerSdp = payload?.sdp || payload;
        const offerCallType = payload?.callType || 'audio';
        io.to(`user:${toUserId}`).emit('signal:offer', { callerId: fromUserId, sdp: offerSdp, callType: offerCallType, callId });
      } else if (signalType === 'answer') {
        const answerSdp = payload?.sdp || payload;
        io.to(`user:${toUserId}`).emit('signal:answer', { calleeId: fromUserId, sdp: answerSdp, callId });
      } else if (signalType === 'ice-candidate') {
        io.to(`user:${toUserId}`).emit('signal:ice-candidate', { fromUserId, candidate: payload, callId });
      }
    }

    res.status(201).json({ success: true, signalId: ins.rows[0].id });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Poll WebRTC signals for a call
 * @route   GET /api/calls/:id/signals
 * @access  Private (Authenticated)
 */
const getSignals = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const callId = req.params.id;
    const sinceId = Number(req.query.since) || 0;

    const result = await query(
      `SELECT id, from_user_id, to_user_id, signal_type, payload, created_at
       FROM call_signals
       WHERE call_id = $1 AND to_user_id = $2 AND id > $3
       ORDER BY id ASC`,
      [callId, userId, sinceId]
    );

    res.status(200).json({
      success: true,
      data: {
        signals: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCallHistory,
  getTurnCredentials,
  initiateCall,
  getActiveCall,
  acceptCall,
  rejectCall,
  endCall,
  sendSignal,
  getSignals
};

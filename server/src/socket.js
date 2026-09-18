/**
 * server/src/socket.js
 * ====================
 * Real-Time Socket.IO Signaling Server
 * 
 * Features:
 * 1. JWT Authentication on WebSocket handshake (cookie or auth header).
 * 2. Room-based messaging & presence tracking.
 * 3. Ephemeral typing indicators & read receipts.
 * 4. WebRTC 1-to-1 Audio & Video Call Signaling (SDP Offer/Answer & ICE Candidates).
 * 5. Authorization checks against blocked_users and privacy settings before call setup.
 */

let Server = null;
try {
  Server = require('socket.io').Server;
} catch (err) {
  console.warn('[socket.io] Notice: socket.io is not loaded in this environment:', err.message);
}

const jwt = require('jsonwebtoken');
const config = require('./config/env');
const { query } = require('./config/db');
const { COOKIE_NAME } = require('./utils/jwt');

// Map of userId -> count of active socket connections
const onlineUsers = new Map();
// Map of userId -> { callId, peerId } for active call cleanup
const activeUserCalls = new Map();

// Helper to parse cookies from handshake header
function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

function initSocket(httpServer) {
  if (!Server) {
    console.warn('[socket.io] Serverless environment detected: WebSockets disabled.');
    return null;
  }

  const io = new Server(httpServer, {
    cors: {
      origin: [config.clientUrl, 'http://localhost:5173', 'http://localhost:3000'],
      credentials: true
    },
    pingTimeout: 30000,
    pingInterval: 25000
  });

  // ==========================================================================
  // Socket.IO Handshake Authentication Middleware
  // ==========================================================================
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const token = cookies[COOKIE_NAME] || socket.handshake.auth?.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      if (!decoded || !decoded.id) {
        return next(new Error('Invalid token'));
      }

      // Fetch user from DB to verify status and token_version
      const userRes = await query(
        `SELECT id, username, full_name, avatar_url, token_version, is_deactivated, 
                show_online_status, allow_messages_from, allow_calls_from
         FROM users 
         WHERE id = $1 
         LIMIT 1`,
        [decoded.id]
      );

      if (userRes.rows.length === 0) {
        return next(new Error('User account not found'));
      }

      const user = userRes.rows[0];
      if (user.is_deactivated) {
        return next(new Error('Account is deactivated'));
      }

      if (decoded.tokenVersion !== undefined && user.token_version !== undefined) {
        if (Number(decoded.tokenVersion) !== Number(user.token_version)) {
          return next(new Error('Session revoked'));
        }
      }

      socket.user = user;
      socket.userId = Number(user.id);
      next();
    } catch (err) {
      console.warn('[Socket Auth Error]', err.message);
      return next(new Error('Authentication failed: ' + err.message));
    }
  });

  // ==========================================================================
  // Connection Handler
  // ==========================================================================
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const user = socket.user;

    // Join user's individual channel for targeted events (calls, DMs, alerts)
    socket.join(`user:${userId}`);

    // Auto-join all conversation rooms this user belongs to for real-time updates/sync
    query(
      `SELECT conversation_id FROM conversation_members WHERE user_id = $1`,
      [userId]
    ).then((res) => {
      for (const row of res.rows) {
        if (row.conversation_id) {
          const cId = String(row.conversation_id);
          socket.join(`conv:${cId}`);
          socket.join(`conv:group-${cId}`);
        }
      }
    }).catch((err) => {
      console.warn('[Socket] Failed to auto-join conversation rooms for user', userId, err.message);
    });

    // Track online status
    const currentCount = onlineUsers.get(userId) || 0;
    onlineUsers.set(userId, currentCount + 1);

    if (currentCount === 0 && user.show_online_status !== false) {
      // Broadcast online status to others
      socket.broadcast.emit('presence:update', { userId, status: 'online' });
    }

    // Check for active ringing incoming call for this user upon socket connect / reconnect
    query(`
      SELECT c.id AS call_id, c.conversation_id, c.initiator_id, c.call_type,
             u.username, u.full_name, u.avatar_url
      FROM calls c
      JOIN call_participants cp ON c.id = cp.call_id AND cp.user_id = $1
      JOIN users u ON c.initiator_id = u.id
      WHERE c.status IN ('initiated', 'ringing')
        AND cp.status IN ('invited', 'ringing')
        AND c.started_at > (CURRENT_TIMESTAMP - INTERVAL '60 seconds')
      ORDER BY c.started_at DESC LIMIT 1
    `, [userId]).then((pendingCallRes) => {
      if (pendingCallRes.rows.length > 0) {
        const row = pendingCallRes.rows[0];
        socket.emit('call:incoming', {
          callId: row.call_id,
          caller: {
            id: row.initiator_id,
            username: row.username,
            full_name: row.full_name,
            avatar_url: row.avatar_url
          },
          callType: row.call_type || 'audio',
          conversationId: row.conversation_id,
          restored: true
        });
      }
    }).catch((callErr) => {
      console.warn('[Socket] Failed to check pending call for user', userId, callErr.message);
    });

    // Return active online users (sockets + recent heartbeat)
    socket.on('presence:get', async (callback) => {
      if (typeof callback === 'function') {
        const socketActiveIds = Array.from(onlineUsers.keys());
        try {
          const recentRes = await query(
            `SELECT id FROM users 
             WHERE show_online_status != FALSE 
               AND last_seen_at > CURRENT_TIMESTAMP - INTERVAL '60 seconds'`
          );
          const recentIds = recentRes.rows.map((r) => Number(r.id));
          const allActive = Array.from(new Set([...socketActiveIds.map(Number), ...recentIds]));
          callback(allActive);
        } catch {
          callback(socketActiveIds);
        }
      }
    });

    // ========================================================================
    // Conversation Subscriptions & Ephemeral State
    // ========================================================================
    socket.on('conversation:join', (conversationId) => {
      if (conversationId) {
        const rawId = String(conversationId).trim();
        const cleanId = rawId.replace(/^(group-)+/i, '');
        if (cleanId) socket.join(`conv:${cleanId}`);
        if (cleanId !== rawId) socket.join(`conv:${rawId}`);
      }
    });

    socket.on('conversation:leave', (conversationId) => {
      if (conversationId) {
        const rawId = String(conversationId).trim();
        const cleanId = rawId.replace(/^(group-)+/i, '');
        if (cleanId) socket.leave(`conv:${cleanId}`);
        if (cleanId !== rawId) socket.leave(`conv:${rawId}`);
      }
    });

    socket.on('typing:start', ({ conversationId, targetUserId }) => {
      const payload = {
        conversationId,
        userId,
        username: user.username,
        fullName: user.full_name,
        isTyping: true
      };
      if (conversationId) {
        socket.to(`conv:${conversationId}`).emit('typing:status', payload);
      }
      if (targetUserId) {
        socket.to(`user:${targetUserId}`).emit('typing:status', payload);
      }
      // Keep DB-backed chat_typing in sync so HTTP polling clients and serverless peers see it
      if (targetUserId) {
        query(
          `INSERT INTO chat_typing (user_id, target_user_id, conversation_id, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id)
           DO UPDATE SET target_user_id = EXCLUDED.target_user_id,
                         conversation_id = EXCLUDED.conversation_id,
                         updated_at = CURRENT_TIMESTAMP`,
          [userId, Number(targetUserId), conversationId ? Number(conversationId) : null]
        ).catch(() => {});
      }
    });

    socket.on('typing:stop', ({ conversationId, targetUserId }) => {
      const payload = {
        conversationId,
        userId,
        username: user.username,
        fullName: user.full_name,
        isTyping: false
      };
      if (conversationId) {
        socket.to(`conv:${conversationId}`).emit('typing:status', payload);
      }
      if (targetUserId) {
        socket.to(`user:${targetUserId}`).emit('typing:status', payload);
      }
      query(`DELETE FROM chat_typing WHERE user_id = $1`, [userId]).catch(() => {});
    });

    // Read receipt broadcast
    socket.on('message:read', ({ conversationId, messageId, senderId }) => {
      if (conversationId) {
        socket.to(`conv:${conversationId}`).emit('message:read_receipt', {
          conversationId,
          messageId,
          readerId: userId,
          readAt: new Date().toISOString()
        });
      }
      if (senderId) {
        socket.to(`user:${senderId}`).emit('message:read_receipt', {
          conversationId,
          messageId,
          readerId: userId,
          readAt: new Date().toISOString()
        });
      }
    });

    // Reaction relay
    socket.on('message:reaction', ({ conversationId, targetUserId, messageId, reactions, action }) => {
      const payload = { messageId, conversationId, reactions, action, userId };
      if (conversationId) {
        socket.to(`conv:${conversationId}`).emit('message:reaction', payload);
      }
      if (targetUserId) {
        socket.to(`user:${targetUserId}`).emit('message:reaction', payload);
      }
    });

    // Pin message relay
    socket.on('message:pin', ({ conversationId, pinnedMessageId, pinnedMessage }) => {
      if (conversationId) {
        socket.to(`conv:${conversationId}`).emit('message:pin', {
          conversationId,
          pinnedMessageId,
          pinnedMessage
        });
      }
    });

    // Delivery receipt broadcast
    socket.on('message:delivered', async ({ messageId, senderId, conversationId }) => {
      try {
        if (messageId) {
          await query(
            'UPDATE messages SET delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP) WHERE id = $1',
            [messageId]
          );
        }
        const payload = {
          messageId: Number(messageId),
          conversationId,
          recipientId: userId,
          deliveredAt: new Date().toISOString()
        };
        if (senderId) {
          socket.to(`user:${senderId}`).emit('message:delivery_receipt', payload);
        }
        if (conversationId) {
          socket.to(`conv:${conversationId}`).emit('message:delivery_receipt', payload);
        }
      } catch (err) {
        console.error('[Socket] Error updating delivered_at:', err.message);
      }
    });

    // ========================================================================
    // WebRTC 1-to-1 Audio & Video Call Signaling
    // ========================================================================

    // 1. Initiate a Call
    socket.on('call:initiate', async ({ targetUserId, callType = 'audio', conversationId }, callback) => {
      try {
        const calleeId = Number(targetUserId);

        if (!calleeId || calleeId === userId) {
          if (typeof callback === 'function') callback({ success: false, error: 'Invalid callee.' });
          return;
        }

        // Check if either user has blocked the other
        const blockCheck = await query(
          'SELECT 1 FROM blocked_users WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1',
          [userId, calleeId]
        );
        if (blockCheck.rows.length > 0) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Unable to connect call with this user.' });
          }
          return;
        }

        // Verify recipient's calling privacy settings
        const targetRes = await query(
          'SELECT id, username, full_name, avatar_url, allow_calls_from FROM users WHERE id = $1 LIMIT 1',
          [calleeId]
        );
        if (targetRes.rows.length === 0) {
          if (typeof callback === 'function') callback({ success: false, error: 'User not found.' });
          return;
        }

        const targetUser = targetRes.rows[0];
        const allowCalls = targetUser.allow_calls_from || 'everyone';

        if (allowCalls === 'nobody') {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'This user does not accept incoming calls.' });
          }
          return;
        }

        if (allowCalls === 'following') {
          const followCheck = await query(
            'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1',
            [calleeId, userId]
          );
          if (followCheck.rows.length === 0) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'This user only accepts calls from people they follow.' });
            }
            return;
          }
        }

        // Check if recipient is online
        const isCalleeOnline = (onlineUsers.get(calleeId) || 0) > 0;

        if (!isCalleeOnline) {
          if (typeof callback === 'function') {
            callback({
              success: false,
              reason: 'unavailable',
              error: 'User unavailable'
            });
          }
          return;
        }

        // Record call in database
        const callInsert = await query(
          `INSERT INTO calls (conversation_id, initiator_id, call_type, status)
           VALUES ($1, $2, $3, 'initiated')
           RETURNING id, started_at`,
          [conversationId || null, userId, callType]
        );
        const callId = callInsert.rows[0].id;

        // Record caller and callee participants
        await query(
          `INSERT INTO call_participants (call_id, user_id, status)
           VALUES ($1, $2, 'accepted'), ($1, $3, 'ringing')
           ON CONFLICT DO NOTHING`,
          [callId, userId, calleeId]
        );

        // Send incoming call invitation to all active devices of callee
        io.to(`user:${calleeId}`).emit('call:incoming', {
          callId,
          caller: {
            id: userId,
            username: user.username,
            full_name: user.full_name,
            avatar_url: user.avatar_url
          },
          callType,
          conversationId
        });

        // Trigger high-urgency Web Push notification for callee (for background / locked screen / closed PWA)
        try {
          const pushService = require('./services/pushService');
          pushService.sendPushNotification(calleeId, {
            senderId: userId,
            title: `📞 Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`,
            body: `${user.full_name || user.username} is calling you on VibeGrid...`,
            icon: user.avatar_url || '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: `call-${callId}`,
            type: 'call',
            data: {
              type: 'call',
              url: `/?callId=${callId}&callType=${callType}&callerId=${userId}&callerName=${encodeURIComponent(user.full_name || user.username)}&callerAvatar=${encodeURIComponent(user.avatar_url || '')}&partner=${encodeURIComponent(user.username)}`,
              callId,
              callType,
              callerId: userId,
              callerName: user.full_name || user.username,
              callerAvatar: user.avatar_url,
              username: user.username,
              caller: {
                id: userId,
                username: user.username,
                full_name: user.full_name,
                avatar_url: user.avatar_url
              }
            }
          }).catch((err) => console.warn('[Push Notification Call Error]:', err.message));
        } catch (pushErr) {
          console.warn('[Call Push Service Error]:', pushErr.message);
        }

        activeUserCalls.set(userId, { callId, peerId: targetUserId });
        activeUserCalls.set(targetUserId, { callId, peerId: userId });

        if (typeof callback === 'function') {
          callback({
            success: true,
            callId,
            isCalleeOnline
          });
        }
      } catch (err) {
        console.error('[Call Initiate Error]', err);
        if (typeof callback === 'function') callback({ success: false, error: 'Call initiation failed.' });
      }
    });

    // 1.1 Device Acknowledgement: Callee device signals that incoming call is delivered and ringing
    socket.on('call:ringing', ({ callId, callerId }) => {
      if (!callerId) return;
      io.to(`user:${callerId}`).emit('call:ringing', {
        callId,
        calleeId: userId
      });
    });

    // 1.2 Caller Cancels Before Answer
    socket.on('call:cancel', async ({ callId, targetUserId }) => {
      const activeCall = activeUserCalls.get(userId);
      const effectiveCallId = callId || activeCall?.callId;
      const effectivePeerId = targetUserId || activeCall?.peerId;

      activeUserCalls.delete(userId);
      if (effectivePeerId) activeUserCalls.delete(effectivePeerId);

      if (effectivePeerId) {
        io.to(`user:${effectivePeerId}`).emit('call:cancelled', {
          callId: effectiveCallId,
          callerId: userId
        });
      }
      // Synchronize cancellation to caller's other tabs/devices
      io.to(`user:${userId}`).emit('call:cancelled', {
        callId: effectiveCallId,
        callerId: userId
      });

      try {
        if (effectiveCallId) {
          await query(
            `UPDATE calls SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE id = $1 AND status NOT IN ('ended', 'connected')`,
            [effectiveCallId]
          );

          const callInfo = await query('SELECT conversation_id, call_type FROM calls WHERE id = $1', [effectiveCallId]);
          if (callInfo.rows.length > 0 && callInfo.rows[0].conversation_id) {
            const convId = callInfo.rows[0].conversation_id;
            const callType = callInfo.rows[0].call_type || 'audio';
            const callText = `⚠️ Missed ${callType} call`;

            const msgRes = await query(`
              INSERT INTO messages (conversation_id, sender_id, recipient_id, content, message_type)
              VALUES ($1, $2, $3, $4, 'call_log')
              RETURNING id, conversation_id, sender_id, content, message_type, created_at
            `, [convId, userId, effectivePeerId, callText]);

            io.to(`conv:${convId}`).emit('message:receive', msgRes.rows[0]);
          }
        }
      } catch (err) {
        console.error('[Call Cancel Error]', err);
      }
    });

    // 2. Accept Call
    socket.on('call:accept', async ({ callId, callerId }) => {
      try {
        activeUserCalls.set(userId, { callId, peerId: callerId });
        activeUserCalls.set(callerId, { callId, peerId: userId });

        await query(
          `UPDATE calls SET status = 'connected' WHERE id = $1`,
          [callId]
        );
        await query(
          `UPDATE call_participants SET status = 'accepted', joined_at = CURRENT_TIMESTAMP WHERE call_id = $1 AND user_id = $2`,
          [callId, userId]
        );

        // Notify caller that call was accepted
        io.to(`user:${callerId}`).emit('call:accepted', {
          callId,
          calleeId: userId
        });

        // Multi-device dismissal: dismiss incoming modal on recipient's other devices
        socket.to(`user:${userId}`).emit('call:answered_elsewhere', {
          callId,
          action: 'accepted'
        });
      } catch (err) {
        console.error('[Call Accept Error]', err);
      }
    });

    // 3. Reject Call
    socket.on('call:reject', async ({ callId, callerId, reason = 'declined' }) => {
      try {
        await query(
          `UPDATE calls SET status = 'rejected', ended_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [callId]
        );
        await query(
          `UPDATE call_participants SET status = 'rejected', left_at = CURRENT_TIMESTAMP WHERE call_id = $1 AND user_id = $2`,
          [callId, userId]
        );

        activeUserCalls.delete(userId);
        activeUserCalls.delete(callerId);

        io.to(`user:${callerId}`).emit('call:rejected', {
          callId,
          calleeId: userId,
          reason
        });

        // Multi-device dismissal: dismiss ringing on recipient's other devices
        socket.to(`user:${userId}`).emit('call:answered_elsewhere', {
          callId,
          action: 'rejected'
        });

        // Insert missed call record in conversation
        const callInfo = await query('SELECT conversation_id, initiator_id, call_type FROM calls WHERE id = $1', [callId]);
        if (callInfo.rows.length > 0 && callInfo.rows[0].conversation_id) {
          const convId = callInfo.rows[0].conversation_id;
          const callType = callInfo.rows[0].call_type || 'audio';
          const callText = `⚠️ Missed ${callType} call`;

          const msgRes = await query(`
            INSERT INTO messages (conversation_id, sender_id, recipient_id, content, message_type)
            VALUES ($1, $2, $3, $4, 'call_log')
            RETURNING id, conversation_id, sender_id, content, message_type, created_at
          `, [convId, callerId, userId, callText]);

          io.to(`conv:${convId}`).emit('message:receive', msgRes.rows[0]);
        }
      } catch (err) {
        console.error('[Call Reject Error]', err);
      }
    });

    // 4. End Call
    socket.on('call:end', async ({ callId, targetUserId }) => {
      // 1. Immediately determine peer ID and call ID
      const activeCall = activeUserCalls.get(userId);
      const effectiveCallId = callId || activeCall?.callId;
      const effectivePeerId = targetUserId || activeCall?.peerId;

      activeUserCalls.delete(userId);
      if (effectivePeerId) activeUserCalls.delete(effectivePeerId);

      // 2. Immediately notify the peer using io.to so all active tabs/devices receive it
      if (effectivePeerId) {
        io.to(`user:${effectivePeerId}`).emit('call:ended', {
          callId: effectiveCallId,
          reason: 'hangup'
        });
      }

      // Also notify all devices of the user that ended the call so all their tabs/devices close
      io.to(`user:${userId}`).emit('call:ended', {
        callId: effectiveCallId,
        reason: 'hangup'
      });

      // 3. Update database asynchronously
      try {
        if (effectiveCallId) {
          const callRes = await query(
            `SELECT started_at, conversation_id, initiator_id, call_type FROM calls WHERE id = $1 LIMIT 1`,
            [effectiveCallId]
          );

          let durationSeconds = 0;
          if (callRes.rows.length > 0 && callRes.rows[0].started_at) {
            durationSeconds = Math.max(0, Math.floor((Date.now() - new Date(callRes.rows[0].started_at).getTime()) / 1000));
          }

          await query(
            `UPDATE calls SET status = 'ended', ended_at = CURRENT_TIMESTAMP, duration_seconds = $2 WHERE id = $1`,
            [effectiveCallId, durationSeconds]
          );
          await query(
            `UPDATE call_participants SET left_at = CURRENT_TIMESTAMP, duration_seconds = $2 WHERE call_id = $1 AND user_id = $3`,
            [effectiveCallId, durationSeconds, userId]
          );

        // Insert call log message into conversation thread
        if (callRes.rows.length > 0 && callRes.rows[0].conversation_id) {
          const convId = callRes.rows[0].conversation_id;
          const callType = callRes.rows[0].call_type || 'audio';
          const m = Math.floor(durationSeconds / 60);
          const s = durationSeconds % 60;
          const durationStr = m > 0 ? `${m}m ${s}s` : `${s}s`;
          const callText = `${callType === 'video' ? '📹 Video' : '📞 Audio'} call ended (${durationStr})`;

          const msgRes = await query(`
            INSERT INTO messages (conversation_id, sender_id, recipient_id, content, message_type)
            VALUES ($1, $2, $3, $4, 'call_log')
            RETURNING id, conversation_id, sender_id, content, message_type, created_at
          `, [convId, userId, targetUserId, callText]);

          io.to(`conv:${convId}`).emit('message:receive', msgRes.rows[0]);
        }
      }
    } catch (err) {
      console.error('[Call End Error]', err);
    }
  });

    // 5. WebRTC Peer-to-Peer SDP Offer / Answer Relay
    socket.on('signal:offer', ({ targetUserId, sdp, callId, callType, isIceRestart }) => {
      if (!targetUserId || !sdp) return;
      socket.to(`user:${targetUserId}`).emit('signal:offer', {
        callerId: userId,
        sdp,
        callId,
        callType,
        isIceRestart: Boolean(isIceRestart)
      });
    });

    socket.on('signal:answer', ({ targetUserId, sdp, callId, isIceRestart }) => {
      if (!targetUserId || !sdp) return;
      socket.to(`user:${targetUserId}`).emit('signal:answer', {
        calleeId: userId,
        sdp,
        callId,
        isIceRestart: Boolean(isIceRestart)
      });
    });

    // 6. WebRTC ICE Candidate Exchange
    socket.on('signal:ice-candidate', ({ targetUserId, candidate, callId }) => {
      if (!targetUserId || !candidate) return;
      socket.to(`user:${targetUserId}`).emit('signal:ice-candidate', {
        fromUserId: userId,
        candidate,
        callId
      });
    });

    // 7. Mid-Call Track State Synchronization (Mute / Camera Toggle)
    socket.on('call:track-state', ({ targetUserId, callId, audioMuted, videoMuted }) => {
      if (!targetUserId) return;
      socket.to(`user:${targetUserId}`).emit('call:track-state', {
        fromUserId: userId,
        callId,
        audioMuted,
        videoMuted
      });
    });

    // 8. ICE Restart Signaling Relay
    socket.on('call:ice-restart', ({ targetUserId, callId }) => {
      if (!targetUserId) return;
      socket.to(`user:${targetUserId}`).emit('call:ice-restart', {
        fromUserId: userId,
        callId
      });
    });

    // 9. Floating Reactions Relay
    socket.on('call:reaction', ({ targetUserId, emoji, callId }) => {
      if (!targetUserId || !emoji) return;
      socket.to(`user:${targetUserId}`).emit('call:reaction', {
        fromUserId: userId,
        emoji,
        callId
      });
    });

    // ========================================================================
    // Disconnect Handler
    // ========================================================================
    socket.on('disconnect', async () => {
      // 1. Terminate any active in-flight or connected call immediately
      if (activeUserCalls.has(userId)) {
        const activeCall = activeUserCalls.get(userId);
        const { callId, peerId } = activeCall;
        activeUserCalls.delete(userId);
        activeUserCalls.delete(peerId);

        try {
          await query(
            `UPDATE calls SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = $1 AND status != 'ended'`,
            [callId]
          );
          socket.to(`user:${peerId}`).emit('call:ended', {
            callId,
            reason: 'peer_disconnected'
          });
        } catch (callErr) {
          console.error('[Socket] Error terminating call on disconnect:', callErr.message);
        }
      }

      const remainingCount = Math.max(0, (onlineUsers.get(userId) || 1) - 1);
      if (remainingCount === 0) {
        onlineUsers.delete(userId);
        const nowIso = new Date().toISOString();
        try {
          await query('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
        } catch (dbErr) {
          console.error('[Socket] Error updating last_seen_at:', dbErr.message);
        }
        if (user.show_online_status !== false) {
          socket.broadcast.emit('presence:update', { userId, status: 'offline', lastSeen: nowIso });
        }
      } else {
        onlineUsers.set(userId, remainingCount);
      }
    });
  });

  return io;
}

module.exports = { initSocket, onlineUsers };

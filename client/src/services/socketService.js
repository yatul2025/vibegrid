/**
 * client/src/services/socketService.js
 * ====================================
 * Client-Side Real-Time WebSocket & Serverless HTTP Signaling Service
 * 
 * Features:
 * 1. Resilient WebSocket (Socket.IO) connection with auto-reconnection.
 * 2. Automatic HTTP Serverless Fallback: When WebSockets cannot stay connected
 *    (e.g., on Vercel Serverless Functions), automatically falls back to secure
 *    database-backed HTTP signaling for WebRTC calls and real-time events.
 * 3. Unified event dispatcher so UI components (CallModal, MessagesPage) work
 *    identically in both WebSocket and Serverless environments.
 */

import { io } from 'socket.io-client';
import apiClient from '../api/client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.activeCallId = null;
    this.lastSignalId = 0;
    this.lastKnownIncomingCallId = null;
    this.activeCallPollTimer = null;
    this.signalPollTimer = null;
    this.isPollingSignals = false;

    // Start background check for incoming calls on serverless hosts
    this.startActiveCallWatcher();
  }

  connect() {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    try {
      this.socket = io(window.location.origin, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 6000,
        timeout: 10000
      });

      this.socket.on('connect', () => {
        console.log('⚡ [Socket.IO] Connected successfully with ID:', this.socket.id);
      });

      this.socket.on('connect_error', (err) => {
        // Normal on serverless hosts like Vercel; silent fallback is active
        console.debug('ℹ️ [Socket.IO] WebSockets inactive on this host, serverless fallback engaged:', err.message);
      });

      this.socket.on('disconnect', (reason) => {
        console.debug('🔌 [Socket.IO] Disconnected:', reason);
      });
    } catch (e) {
      console.debug('ℹ️ [Socket.IO] Init error, using HTTP fallback:', e.message);
    }

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.stopSignalPolling();
  }

  getSocket() {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  }

  isConnected() {
    return Boolean(this.socket && this.socket.connected);
  }

  // ==========================================================================
  // Event Subscription Helpers (Dual-Mode: Socket.IO + Local Dispatcher)
  // ==========================================================================

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Also register on underlying socket instance
    const s = this.getSocket();
    if (s) {
      s.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  _dispatch(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks && callbacks.size > 0) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[SocketService] Error in listener for ${event}:`, err);
        }
      });
    }
  }

  // ==========================================================================
  // Emitter with Automatic Serverless HTTP Fallback
  // ==========================================================================

  async emit(event, data, callback) {
    // 1. If real WebSocket is connected, emit natively
    if (this.isConnected()) {
      if (typeof callback === 'function') {
        this.socket.emit(event, data, callback);
      } else {
        this.socket.emit(event, data);
      }
      return;
    }

    // 2. Serverless HTTP Fallback Handler
    try {
      if (event === 'call:initiate') {
        const res = await apiClient.post('/calls/initiate', {
          targetUserId: data.targetUserId,
          callType: data.callType || 'audio',
          conversationId: data.conversationId
        });

        if (res.success && res.data?.callId) {
          this.activeCallId = res.data.callId;
          this.lastSignalId = 0;
          this.startSignalPolling(res.data.callId);
          if (typeof callback === 'function') {
            callback({ success: true, callId: res.data.callId });
          }
        } else {
          if (typeof callback === 'function') {
            callback({ success: false, error: res.error || 'Failed to initiate call.' });
          }
        }
      } else if (event === 'call:accept') {
        const callId = data.callId || this.activeCallId;
        if (callId) {
          this.activeCallId = callId;
          this.startSignalPolling(callId);
          await apiClient.post(`/calls/${callId}/accept`);
        }
      } else if (event === 'call:reject') {
        const callId = data.callId || this.activeCallId;
        if (callId) {
          await apiClient.post(`/calls/${callId}/reject`, { reason: data.reason || 'declined' });
          this.stopSignalPolling();
        }
      } else if (event === 'call:end') {
        const callId = data.callId || this.activeCallId;
        if (callId) {
          await apiClient.post(`/calls/${callId}/end`, { targetUserId: data.targetUserId });
          this.stopSignalPolling();
        }
      } else if (event === 'signal:offer') {
        const callId = data.callId || this.activeCallId;
        if (callId) {
          await apiClient.post(`/calls/${callId}/signal`, {
            toUserId: data.targetUserId,
            signalType: 'offer',
            payload: data.sdp
          });
        }
      } else if (event === 'signal:answer') {
        const callId = data.callId || this.activeCallId;
        if (callId) {
          await apiClient.post(`/calls/${callId}/signal`, {
            toUserId: data.targetUserId,
            signalType: 'answer',
            payload: data.sdp
          });
        }
      } else if (event === 'signal:ice-candidate') {
        const callId = data.callId || this.activeCallId;
        if (callId) {
          await apiClient.post(`/calls/${callId}/signal`, {
            toUserId: data.targetUserId,
            signalType: 'ice-candidate',
            payload: data.candidate
          });
        }
      } else if (event === 'presence:get') {
        if (typeof callback === 'function') {
          callback([]);
        }
      } else {
        // Fallback for custom events when socket is idle
        if (this.socket) {
          if (typeof callback === 'function') this.socket.emit(event, data, callback);
          else this.socket.emit(event, data);
        }
      }
    } catch (err) {
      console.warn(`[SocketService] HTTP fallback error for ${event}:`, err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  }

  // ==========================================================================
  // Serverless HTTP Polling Watchers for Calls
  // ==========================================================================

  startActiveCallWatcher() {
    if (this.activeCallPollTimer) return;

    this.activeCallPollTimer = setInterval(async () => {
      // If WebSocket is actively connected, no need to poll HTTP
      if (this.isConnected() || this.activeCallId) return;

      try {
        const res = await apiClient.get('/calls/active');
        if (res.success && res.data?.activeCall) {
          const call = res.data.activeCall;

          // If incoming ringing call for me
          if (!call.isInitiator && call.myParticipantStatus === 'ringing') {
            if (this.lastKnownIncomingCallId !== call.callId) {
              this.lastKnownIncomingCallId = call.callId;
              this.activeCallId = call.callId;
              this.lastSignalId = 0;

              console.log('📞 [Serverless Fallback] Incoming call detected:', call.callId);
              this._dispatch('call:incoming', {
                callId: call.callId,
                caller: call.caller,
                callType: call.callType || 'audio',
                conversationId: call.conversationId
              });

              this.startSignalPolling(call.callId);
            }
          }
        }
      } catch (err) {
        // Ignore unauthenticated or network errors in background poll
      }
    }, 2000);
  }

  startSignalPolling(callId) {
    if (!callId) return;
    this.activeCallId = callId;
    if (this.isPollingSignals) return;
    this.isPollingSignals = true;

    if (this.signalPollTimer) clearInterval(this.signalPollTimer);

    this.signalPollTimer = setInterval(async () => {
      if (!this.activeCallId) {
        this.stopSignalPolling();
        return;
      }

      try {
        const res = await apiClient.get(`/calls/${this.activeCallId}/signals?since=${this.lastSignalId}`);
        if (res.success && Array.isArray(res.data?.signals)) {
          for (const s of res.data.signals) {
            this.lastSignalId = Math.max(this.lastSignalId, s.id);

            if (s.signal_type === 'accept') {
              this._dispatch('call:accepted', { callId: this.activeCallId, calleeId: s.from_user_id });
            } else if (s.signal_type === 'reject') {
              this._dispatch('call:rejected', { callId: this.activeCallId, reason: s.payload?.reason });
              this.stopSignalPolling();
            } else if (s.signal_type === 'end') {
              this._dispatch('call:ended', { callId: this.activeCallId });
              this.stopSignalPolling();
            } else if (s.signal_type === 'offer') {
              this._dispatch('signal:offer', { callerId: s.from_user_id, sdp: s.payload, callId: this.activeCallId });
            } else if (s.signal_type === 'answer') {
              this._dispatch('signal:answer', { sdp: s.payload, callId: this.activeCallId });
            } else if (s.signal_type === 'ice-candidate') {
              this._dispatch('signal:ice-candidate', { candidate: s.payload, callId: this.activeCallId });
            }
          }
        }
      } catch (err) {
        // Signal polling error
      }
    }, 1000);
  }

  stopSignalPolling() {
    this.isPollingSignals = false;
    this.activeCallId = null;
    this.lastSignalId = 0;
    if (this.signalPollTimer) {
      clearInterval(this.signalPollTimer);
      this.signalPollTimer = null;
    }
  }

  // ==========================================================================
  // Signaling Helpers
  // ==========================================================================

  joinConversation(conversationId) {
    this.emit('conversation:join', conversationId);
  }

  leaveConversation(conversationId) {
    this.emit('conversation:leave', conversationId);
  }

  sendTypingStart(conversationId, targetUserId) {
    this.emit('typing:start', { conversationId, targetUserId });
  }

  sendTypingStop(conversationId, targetUserId) {
    this.emit('typing:stop', { conversationId, targetUserId });
  }

  sendReadReceipt(conversationId, messageId, senderId) {
    this.emit('message:read', { conversationId, messageId, senderId });
  }
}

export const socketService = new SocketService();
export default socketService;

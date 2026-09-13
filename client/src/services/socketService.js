/**
 * client/src/services/socketService.js
 * ====================================
 * Client-Side Real-Time WebSocket Service (Socket.IO)
 * 
 * Features:
 * 1. Resilient connection management with automatic exponential backoff.
 * 2. Authenticated with HTTP-Only cookie credentials.
 * 3. Event subscriptions for presence, typing indicators, read receipts, and WebRTC calls.
 */

import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    // Connect to same origin (Vite proxies /socket.io in dev, Vercel/host in prod)
    this.socket = io(window.location.origin, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    this.socket.on('connect', () => {
      console.log('⚡ [Socket.IO] Connected successfully with ID:', this.socket.id);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('⚠️ [Socket.IO] Connection error:', err.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 [Socket.IO] Disconnected:', reason);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  }

  // Event Subscription Helpers
  on(event, callback) {
    const s = this.getSocket();
    s.on(event, callback);
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event, data, callback) {
    const s = this.getSocket();
    if (typeof callback === 'function') {
      s.emit(event, data, callback);
    } else {
      s.emit(event, data);
    }
  }

  // Specific Signaling Helpers
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

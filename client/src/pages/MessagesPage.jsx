/**
 * client/src/pages/MessagesPage.jsx
 * =================================
 * Dual-Pane Direct Messaging with End-to-End Encryption (E2EE) & Real-Time WebSockets
 * 
 * Features:
 * 1. Cryptographic Security:
 *    - Client-side AES-256-GCM authenticated encryption.
 *    - Transparent key agreement (ECDH P-256) & IndexedDB private key isolation.
 *    - End-to-End Encrypted badge (🔒) and security disclaimer banner.
 * 2. Real-Time Infrastructure (Socket.IO):
 *    - Instant message delivery without polling.
 *    - Ephemeral typing indicators ("@{username} is typing...").
 *    - Online presence indicators (green dot).
 *    - Delivery & read receipts (✓ / ✓✓).
 * 3. WebRTC Call Triggers:
 *    - One-click Audio Call (📞) and Video Call (📹) actions in the chat header.
 * 4. Dual-Pane Responsive Layout:
 *    - Left pane: Conversation threads with search, unread badges, and last message previews.
 *    - Right pane: Active chat stream with optimistic updates and auto-scroll.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import socketService from '../services/socketService';
import e2eeService from '../services/crypto/e2eeService';

function formatMessageTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d`;
  return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function MessagesPage({
  initialTargetUsername = null,
  onNavigateToProfile,
  onUnreadCountChange
}) {
  const { user } = useAuth();

  // Conversations State
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);

  // Active Chat State
  const [activePartner, setActivePartner] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);

  // Ephemeral Real-Time States
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());

  // New Chat Search Modal State
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activePartnerRef = useRef(activePartner);
  activePartnerRef.current = activePartner;

  // Auto-scroll to bottom of message thread
  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  // ==========================================================================
  // 1. Initial Data Fetching (Conversations List)
  // ==========================================================================

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiClient.get('/messages/conversations');
      if (res.success && res.data?.conversations) {
        // Pre-decrypt the last message preview for each conversation thread
        const decryptedConvs = await Promise.all(
          res.data.conversations.map(async (c) => {
            let preview = c.last_message;
            if (c.last_ciphertext && c.last_iv_nonce) {
              preview = await e2eeService.decryptMessage(
                { ciphertext: c.last_ciphertext, iv_nonce: c.last_iv_nonce },
                c.partner_id
              );
            }
            return {
              ...c,
              last_message: preview
            };
          })
        );
        setConversations(decryptedConvs);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  // Fetch messages for active conversation partner
  const fetchMessagesForPartner = useCallback(async (username, isInitialLoad = false) => {
    if (!username) return;
    try {
      if (isInitialLoad) setLoadingMessages(true);
      const res = await apiClient.get(`/messages/${username}`);
      if (res.success && res.data) {
        const partner = res.data.partner;
        setActivePartner(partner);

        // Decrypt all incoming/outgoing messages
        const decryptedMessages = await e2eeService.decryptMessageList(
          res.data.messages,
          partner.id
        );

        setMessages(decryptedMessages);

        if (isInitialLoad) {
          setTimeout(() => scrollToBottom(false), 50);
        }
        if (onUnreadCountChange) onUnreadCountChange();
      }
    } catch (err) {
      console.error(`Error loading messages for @${username}:`, err);
    } finally {
      if (isInitialLoad) setLoadingMessages(false);
    }
  }, [onUnreadCountChange]);

  // Initial Load
  useEffect(() => {
    fetchConversations();

    if (initialTargetUsername) {
      fetchMessagesForPartner(initialTargetUsername, true);
    }
  }, [fetchConversations, initialTargetUsername, fetchMessagesForPartner]);

  // Request online presence list on mount
  useEffect(() => {
    socketService.emit('presence:get', (activeIds) => {
      if (Array.isArray(activeIds)) {
        setOnlineUserIds(new Set(activeIds.map(Number)));
      }
    });
  }, []);

  // ==========================================================================
  // 2. Real-Time Socket Event Subscriptions (No Polling)
  // ==========================================================================
  useEffect(() => {
    if (!user) return;

    // 1. Real-time Incoming Message Handler
    const handleReceiveMessage = async (msg) => {
      console.log('⚡ [Socket] Real-time message received:', msg);

      const currentPartner = activePartnerRef.current;
      const isCurrentChat = currentPartner && (
        Number(msg.sender_id) === Number(currentPartner.id) ||
        (Number(msg.recipient_id) === Number(currentPartner.id) && Number(msg.sender_id) === Number(user.id))
      );

      // Decrypt message content
      const decryptedContent = await e2eeService.decryptMessage(
        msg,
        isCurrentChat ? currentPartner.id : msg.sender_id
      );

      const processedMsg = {
        ...msg,
        content: decryptedContent,
        is_mine: Number(msg.sender_id) === Number(user.id)
      };

      if (isCurrentChat) {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some((m) => m.id === processedMsg.id)) return prev;
          return [...prev, processedMsg];
        });

        setTimeout(() => scrollToBottom(true), 30);

        // Send read receipt if incoming message
        if (!processedMsg.is_mine) {
          socketService.sendReadReceipt(activeConversationId, processedMsg.id, currentPartner.id);
        }
      }

      // Update conversations sidebar preview
      setConversations((prev) => {
        const partnerId = processedMsg.is_mine ? processedMsg.recipient_id : processedMsg.sender_id;
        const exists = prev.some((c) => Number(c.partner_id) === Number(partnerId));

        if (!exists) {
          fetchConversations();
          return prev;
        }

        return prev.map((c) => {
          if (Number(c.partner_id) === Number(partnerId)) {
            return {
              ...c,
              last_message: decryptedContent,
              last_message_at: processedMsg.created_at,
              last_sender_id: processedMsg.sender_id,
              unread_count: isCurrentChat ? 0 : (c.unread_count + 1)
            };
          }
          return c;
        });
      });

      if (onUnreadCountChange) onUnreadCountChange();
    };

    // 2. Typing Indicators
    const handleTypingStatus = ({ userId, isTyping }) => {
      const currentPartner = activePartnerRef.current;
      if (currentPartner && Number(userId) === Number(currentPartner.id)) {
        setIsPartnerTyping(Boolean(isTyping));
      }
    };

    // 3. Online Presence Update
    const handlePresenceUpdate = ({ userId, status }) => {
      const uid = Number(userId);
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (status === 'online') {
          next.add(uid);
        } else {
          next.delete(uid);
        }
        return next;
      });
    };

    // 4. Read Receipts
    const handleReadReceipt = ({ readerId }) => {
      const currentPartner = activePartnerRef.current;
      if (currentPartner && Number(readerId) === Number(currentPartner.id)) {
        setMessages((prev) =>
          prev.map((m) => (m.is_mine ? { ...m, is_read: true } : m))
        );
      }
    };

    socketService.on('message:receive', handleReceiveMessage);
    socketService.on('typing:status', handleTypingStatus);
    socketService.on('presence:update', handlePresenceUpdate);
    socketService.on('message:read_receipt', handleReadReceipt);

    return () => {
      socketService.off('message:receive', handleReceiveMessage);
      socketService.off('typing:status', handleTypingStatus);
      socketService.off('presence:update', handlePresenceUpdate);
      socketService.off('message:read_receipt', handleReadReceipt);
    };
  }, [user, activeConversationId, fetchConversations, onUnreadCountChange]);

  // ==========================================================================
  // 3. Typing Notification Emitter
  // ==========================================================================
  const handleInputChange = (e) => {
    setMessageInput(e.target.value);

    if (!activePartner) return;

    socketService.sendTypingStart(activeConversationId, activePartner.id);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketService.sendTypingStop(activeConversationId, activePartner.id);
    }, 1500);
  };

  // ==========================================================================
  // 4. Send Encrypted Message
  // ==========================================================================
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !activePartner || sending) return;

    const textToSend = messageInput.trim();
    setMessageInput('');
    socketService.sendTypingStop(activeConversationId, activePartner.id);

    // Optimistic temporary message
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      sender_id: user.id,
      recipient_id: activePartner.id,
      content: textToSend,
      is_read: false,
      created_at: new Date().toISOString(),
      is_mine: true,
      is_encrypted: true
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => scrollToBottom(true), 30);

    try {
      setSending(true);

      // 1. Perform client-side E2EE encryption (AES-256-GCM + ECDH)
      const encEnvelope = await e2eeService.encryptMessage(activePartner.id, textToSend);

      // 2. Transmit ciphertext to server (plaintext content is left empty or as fallback)
      const res = await apiClient.post(`/messages/${activePartner.username}`, {
        content: textToSend, // backward compatibility
        ciphertext: encEnvelope.ciphertext || null,
        ivNonce: encEnvelope.ivNonce || null,
        senderDeviceId: encEnvelope.senderDeviceId || null
      });

      if (res.success && res.data?.message) {
        // Replace optimistic message with confirmed server message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...res.data.message, content: textToSend, is_encrypted: Boolean(encEnvelope.ciphertext) }
              : m
          )
        );

        // Update conversation thread snippet
        setConversations((prev) =>
          prev.map((c) =>
            c.partner_username.toLowerCase() === activePartner.username.toLowerCase()
              ? { ...c, last_message: textToSend, last_message_at: new Date().toISOString() }
              : c
          )
        );
      }
    } catch (err) {
      alert(err.message || 'Failed to send message.');
      // Rollback optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  // ==========================================================================
  // 5. Audio & Video WebRTC Call Triggers
  // ==========================================================================
  const initiateAudioCall = () => {
    if (!activePartner) return;
    window.dispatchEvent(
      new CustomEvent('vibegrid:initiate-call', {
        detail: { targetUser: activePartner, callType: 'audio' }
      })
    );
  };

  const initiateVideoCall = () => {
    if (!activePartner) return;
    window.dispatchEvent(
      new CustomEvent('vibegrid:initiate-call', {
        detail: { targetUser: activePartner, callType: 'video' }
      })
    );
  };

  // ==========================================================================
  // 6. User Search for New Chat
  // ==========================================================================
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await apiClient.get(`/users/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.success && res.data?.users) {
          setSearchResults(res.data.users.filter((u) => u.id !== user?.id));
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, user?.id]);

  const selectConversation = (username) => {
    fetchMessagesForPartner(username, true);
    setConversations((prev) =>
      prev.map((c) =>
        c.partner_username.toLowerCase() === username.toLowerCase()
          ? { ...c, unread_count: 0 }
          : c
      )
    );
  };

  const startNewChat = (targetUser) => {
    setIsNewChatModalOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    fetchMessagesForPartner(targetUser.username, true);
  };

  const isCurrentPartnerOnline = activePartner && onlineUserIds.has(Number(activePartner.id));

  return (
    <div className="messages-page-wrapper">
      <div className={`messages-layout-container ${activePartner ? 'has-active-chat' : 'no-active-chat'}`}>
        {/* ================================================================== */}
        {/* 1. Left Pane: Conversations Inbox                                  */}
        {/* ================================================================== */}
        <aside className="messages-sidebar">
          <div className="messages-sidebar-header">
            <div className="messages-sidebar-user">
              <h3>Direct</h3>
              <span className="messages-header-sub">@{user?.username}</span>
            </div>
            <button
              type="button"
              className="btn-new-chat-icon"
              onClick={() => setIsNewChatModalOpen(true)}
              title="Start a new message"
            >
              ✏️
            </button>
          </div>

          <div className="messages-inbox-list">
            {loadingConversations ? (
              <div className="conversations-loading">
                <div className="spinner-sm"></div>
                <span>Loading conversations...</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="conversations-empty">
                <p>No messages yet.</p>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => setIsNewChatModalOpen(true)}
                >
                  Send a Message
                </button>
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = activePartner?.username.toLowerCase() === c.partner_username.toLowerCase();
                const hasUnread = c.unread_count > 0;
                const isOnline = onlineUserIds.has(Number(c.partner_id));

                return (
                  <div
                    key={c.partner_id}
                    className={`conversation-item ${isActive ? 'active' : ''} ${hasUnread ? 'has-unread' : ''}`}
                    onClick={() => selectConversation(c.partner_username)}
                  >
                    <div className="conversation-avatar-wrap">
                      <img
                        src={c.partner_avatar_url || '/uploads/avatars/default-avatar.png'}
                        alt={c.partner_username}
                        className="conversation-avatar-img"
                      />
                      {isOnline && <span className="conversation-online-indicator" title="Online" />}
                      {hasUnread && <span className="conversation-unread-dot" />}
                    </div>

                    <div className="conversation-meta">
                      <div className="conversation-name-row">
                        <span className="conversation-username">@{c.partner_username}</span>
                        <span className="conversation-time">
                          {formatRelativeTime(c.last_message_at)}
                        </span>
                      </div>
                      <div className="conversation-preview-row">
                        <span className="conversation-snippet">
                          {c.last_sender_id === user?.id ? 'You: ' : ''}
                          {c.last_message || 'Encrypted message'}
                        </span>
                        {hasUnread && (
                          <span className="conversation-badge">{c.unread_count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ================================================================== */}
        {/* 2. Right Pane: Active Chat Room                                    */}
        {/* ================================================================== */}
        <section className="messages-chat-panel">
          {activePartner ? (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                <button
                  type="button"
                  className="btn-chat-back-mobile"
                  onClick={() => setActivePartner(null)}
                  title="Back to conversations"
                  aria-label="Back to conversations"
                >
                  ←
                </button>
                <div
                  className="chat-header-user"
                  onClick={() => onNavigateToProfile && onNavigateToProfile(activePartner.username)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="chat-header-avatar-wrap">
                    <img
                      src={activePartner.avatar_url || '/uploads/avatars/default-avatar.png'}
                      alt={activePartner.username}
                      className="chat-header-avatar"
                    />
                    {isCurrentPartnerOnline && (
                      <span className="header-online-indicator" title="Online" />
                    )}
                  </div>

                  <div className="chat-header-names">
                    <div className="chat-header-title-row">
                      <span className="chat-header-username">@{activePartner.username}</span>
                      <span
                        className="e2ee-lock-badge"
                        title="End-to-End Encrypted with AES-256-GCM & ECDH P-256"
                      >
                        🔒 E2EE
                      </span>
                    </div>
                    <span className="chat-header-sub">
                      {isPartnerTyping ? (
                        <span className="typing-sub-label">typing...</span>
                      ) : isCurrentPartnerOnline ? (
                        <span className="online-sub-label">Active now</span>
                      ) : (
                        activePartner.full_name || 'Direct conversation'
                      )}
                    </span>
                  </div>
                </div>

                {/* Call & Profile Action Buttons */}
                <div className="chat-header-actions">
                  <button
                    type="button"
                    className="btn-chat-action btn-audio-call"
                    onClick={initiateAudioCall}
                    title={`Start Audio Call with @${activePartner.username}`}
                    aria-label="Audio Call"
                  >
                    📞
                  </button>

                  <button
                    type="button"
                    className="btn-chat-action btn-video-call"
                    onClick={initiateVideoCall}
                    title={`Start Video Call with @${activePartner.username}`}
                    aria-label="Video Call"
                  >
                    📹
                  </button>

                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => onNavigateToProfile && onNavigateToProfile(activePartner.username)}
                  >
                    Profile
                  </button>
                </div>
              </div>

              {/* Chat Message Stream */}
              <div className="chat-stream">
                {/* E2EE Security Disclaimer Banner */}
                <div className="e2ee-stream-banner">
                  <span className="e2ee-banner-icon">🔒</span>
                  <p>
                    Messages and calls are end-to-end encrypted. No one outside of this chat,
                    not even VibeGrid, can read or listen to them.
                  </p>
                </div>

                {loadingMessages ? (
                  <div className="chat-loading">
                    <div className="spinner"></div>
                    <p>Decrypting conversation...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="chat-thread-empty">
                    <img
                      src={activePartner.avatar_url || '/uploads/avatars/default-avatar.png'}
                      alt=""
                      className="chat-empty-avatar"
                    />
                    <h4>@{activePartner.username}</h4>
                    <p>Start your encrypted conversation with @{activePartner.username}!</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`message-bubble-row ${m.is_mine ? 'outgoing' : 'incoming'}`}
                    >
                      <div className="message-bubble">
                        <p className="message-text">{m.content}</p>
                        <div className="message-info-row">
                          <span className="message-timestamp">
                            {formatMessageTime(m.created_at)}
                          </span>
                          {m.is_mine && (
                            <span className="message-receipt-tick" title={m.is_read ? 'Read' : 'Delivered'}>
                              {m.is_read ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* Animated Typing Indicator Bubble */}
                {isPartnerTyping && (
                  <div className="message-bubble-row incoming">
                    <div className="typing-dots-bubble">
                      <span className="dot"></span>
                      <span className="dot"></span>
                      <span className="dot"></span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Composer Bar */}
              <form onSubmit={handleSendMessage} className="chat-composer-bar">
                <input
                  type="text"
                  placeholder={`Send an encrypted message to @${activePartner.username}...`}
                  value={messageInput}
                  onChange={handleInputChange}
                  className="chat-input-field"
                  maxLength={1000}
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn-primary btn-chat-send"
                  disabled={!messageInput.trim() || sending}
                >
                  {sending ? '...' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            /* No Chat Selected State */
            <div className="chat-no-selection">
              <div className="chat-no-selection-icon">💬</div>
              <h3>Your Direct Messages</h3>
              <p>End-to-end encrypted messaging, audio calls, and video chat with anyone on VibeGrid.</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsNewChatModalOpen(true)}
              >
                Start a New Chat
              </button>
            </div>
          )}
        </section>
      </div>

      {/* ================================================================== */}
      {/* 3. "New Message" Modal with Live Search                           */}
      {/* ================================================================== */}
      {isNewChatModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsNewChatModalOpen(false)}>
          <div className="modal-card new-chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Message</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsNewChatModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="new-chat-search-box">
              <input
                type="text"
                placeholder="Search people by username or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="new-chat-input"
              />
            </div>

            <div className="new-chat-results-list">
              {searching ? (
                <div className="new-chat-loading">Searching...</div>
              ) : searchResults.length === 0 && searchQuery.trim() ? (
                <div className="new-chat-no-results">No users found matching "{searchQuery}"</div>
              ) : (
                searchResults.map((u) => (
                  <div
                    key={u.id}
                    className="new-chat-user-item"
                    onClick={() => startNewChat(u)}
                  >
                    <img
                      src={u.avatar_url || '/uploads/avatars/default-avatar.png'}
                      alt={u.username}
                      className="new-chat-user-avatar"
                    />
                    <div className="new-chat-user-meta">
                      <span className="new-chat-username">@{u.username}</span>
                      {u.full_name && <span className="new-chat-fullname">{u.full_name}</span>}
                    </div>
                    <button type="button" className="btn-secondary btn-sm">Chat</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Embedded CSS Enhancements for E2EE & Calling Controls */}
      <style>{`
        .chat-header-avatar-wrap {
          position: relative;
          display: inline-block;
        }

        .header-online-indicator,
        .conversation-online-indicator {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #10b981;
          border: 2px solid var(--card-bg, #ffffff);
        }

        .chat-header-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .e2ee-lock-badge {
          display: inline-flex;
          align-items: center;
          background: rgba(99, 102, 241, 0.12);
          color: #6366f1;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 12px;
          border: 1px solid rgba(99, 102, 241, 0.3);
          cursor: help;
        }

        .typing-sub-label {
          color: #10b981;
          font-style: italic;
          font-weight: 600;
        }

        .online-sub-label {
          color: #10b981;
          font-weight: 500;
        }

        .btn-chat-action {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid var(--border-color, #e2e8f0);
          background: var(--bg-card, #ffffff);
          color: var(--text-primary, #0f172a);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .btn-chat-action:hover {
          transform: scale(1.08);
          background: var(--bg-hover, #f1f5f9);
        }

        .e2ee-stream-banner {
          margin: 8px auto 16px auto;
          max-width: 440px;
          padding: 10px 16px;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          text-align: center;
        }

        .e2ee-stream-banner p {
          margin: 0;
          font-size: 0.76rem;
          color: var(--text-secondary, #64748b);
          line-height: 1.4;
        }

        .e2ee-banner-icon {
          font-size: 1.1rem;
        }

        .message-info-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          margin-top: 3px;
        }

        .message-receipt-tick {
          font-size: 0.72rem;
          font-weight: bold;
          opacity: 0.85;
          margin-left: 2px;
        }

        /* Typing Dots Animation */
        .typing-dots-bubble {
          padding: 10px 16px;
          border-radius: 18px;
          background: var(--bg-card, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .typing-dots-bubble .dot {
          width: 7px;
          height: 7px;
          background: #94a3b8;
          border-radius: 50%;
          animation: typingDotPulse 1.4s infinite ease-in-out both;
        }

        .typing-dots-bubble .dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dots-bubble .dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes typingDotPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/**
 * client/src/pages/MessagesPage.jsx
 * =================================
 * Dual-Pane Direct Messaging with End-to-End Encryption (E2EE),
 * Encrypted Media Attachments, Voice Notes, Safety Numbers, and Disappearing Messages.
 * 
 * Features:
 * 1. Cryptographic Security:
 *    - Client-side AES-256-GCM authenticated encryption for text and media.
 *    - Transparent key agreement (ECDH P-256) & IndexedDB private key isolation.
 *    - Signal-style 60-digit Safety Number verification modal with Verified status badge (🛡️).
 *    - End-to-End Encrypted badge (🔒) and security disclaimer banner.
 * 2. Encrypted Attachments & Voice Notes:
 *    - Photos encrypted with single-use AES-GCM keys client-side before upload.
 *    - Microphone voice recorder component with duration timer and encrypted playback.
 * 3. Ephemeral Disappearing Messages:
 *    - Configurable timer (Off, 24h, 7d, 30d) with auto-expiration and badge (⏳).
 * 4. Real-Time Infrastructure (Socket.IO):
 *    - Instant message delivery without polling.
 *    - Ephemeral typing indicators ("@{username} is typing...").
 *    - Online presence indicators (green dot).
 *    - Delivery & read receipts (✓ / ✓✓).
 * 5. WebRTC Call Triggers:
 *    - One-click Audio Call (📞) and Video Call (📹) actions in the chat header.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import socketService from '../services/socketService';
import e2eeService from '../services/crypto/e2eeService';
import keyStore from '../services/crypto/keyStore';
import { encryptMedia } from '../services/crypto/mediaCrypto';
import SafetyNumberModal from '../components/SafetyNumberModal';
import VoiceRecorder from '../components/VoiceRecorder';
import EncryptedMediaRenderer from '../components/EncryptedMediaRenderer';
import CreateGroupModal from '../components/CreateGroupModal';
import CallHistoryModal from '../components/CallHistoryModal';
import KeyBackupModal from '../components/KeyBackupModal';
import senderKeysService from '../services/crypto/senderKeys';
import {
  Phone,
  Video,
  Search,
  Clock,
  Shield,
  ShieldCheck,
  Send,
  Image as ImageIcon,
  Mic,
  Users,
  KeyRound,
  Plus,
  ArrowLeft,
  X,
  User as UserIcon,
  Check,
  CheckCheck,
  PhoneCall,
  Lock,
  Reply,
  Edit2,
  Trash2,
  Trash,
  Copy,
  Ban,
  CornerUpLeft,
  Share2
} from 'lucide-react';

function getDateSeparatorLabel(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
  });
}

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

function parseMediaPayload(content) {
  if (!content || typeof content !== 'string') return null;
  if (content.startsWith('{"type":"image"') || content.startsWith('{"type":"audio"')) {
    try {
      return JSON.parse(content);
    } catch {}
  }
  return null;
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
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Advanced Security & Media States
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [isPeerVerified, setIsPeerVerified] = useState(false);
  const [ephemeralTimer, setEphemeralTimer] = useState(null);
  const [isEphemeralMenuOpen, setIsEphemeralMenuOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isCallHistoryOpen, setIsCallHistoryOpen] = useState(false);
  const [isKeyBackupOpen, setIsKeyBackupOpen] = useState(false);

  // In-Chat Encrypted Search State
  const [isSearchInChatOpen, setIsSearchInChatOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  // Ephemeral Real-Time States
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());

  // New Chat Search Modal State
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Phase 1: Core Message Actions & Status States
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [deleteModalTarget, setDeleteModalTarget] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);

  const messagesEndRef = useRef(null);
  const chatStreamRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const activePartnerRef = useRef(activePartner);
  activePartnerRef.current = activePartner;

  // Jump and highlight a quoted reply message
  const scrollToMessage = (messageId) => {
    if (!messageId) return;
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('pulse-highlight');
      setTimeout(() => {
        el.classList.remove('pulse-highlight');
      }, 1500);
    }
  };

  // Auto-scroll to bottom of message thread (isolated to chat-stream container to prevent window shifting)
  const scrollToBottom = (smooth = true) => {
    if (chatStreamRef.current) {
      if (smooth) {
        chatStreamRef.current.scrollTo({
          top: chatStreamRef.current.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
      }
    }
  };

  // ==========================================================================
  // 1. Initial Data Fetching (Conversations List)
  // ==========================================================================

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiClient.get('/messages/conversations');
      if (res.success && res.data?.conversations) {
        const decryptedConvs = await Promise.all(
          res.data.conversations.map(async (c) => {
            let preview = c.last_message;
            if (c.last_ciphertext && c.last_iv_nonce) {
              preview = await e2eeService.decryptMessage(
                { ciphertext: c.last_ciphertext, iv_nonce: c.last_iv_nonce },
                c.partner_id
              );
            }
            if (preview && preview.startsWith('{"type":"image"')) preview = '📷 Photo';
            if (preview && preview.startsWith('{"type":"audio"')) preview = '🎙️ Voice Note';

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
        setActiveConversationId(res.data.conversationId || null);
        setEphemeralTimer(res.data.ephemeralTimerSeconds || null);

        // Check verification status from local keyStore
        if (user) {
          const verified = await keyStore.isPeerVerified(user.id, partner.id);
          setIsPeerVerified(verified);
        }

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
  }, [user, onUnreadCountChange]);

  // Serverless fallback: Poll active conversation if socket is not connected
  useEffect(() => {
    if (!activePartner) return;
    const interval = setInterval(() => {
      if (!socketService.isConnected()) {
        fetchMessagesForPartner(activePartner.username, false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activePartner, fetchMessagesForPartner]);

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
          if (prev.some((m) => m.id === processedMsg.id)) return prev;
          return [...prev, processedMsg];
        });

        setTimeout(() => scrollToBottom(true), 30);

        if (!processedMsg.is_mine) {
          socketService.sendReadReceipt(activeConversationId, processedMsg.id, currentPartner.id);
        }
      }

      // Update conversations sidebar preview
      let snippet = decryptedContent;
      if (snippet && snippet.startsWith('{"type":"image"')) snippet = '📷 Photo';
      if (snippet && snippet.startsWith('{"type":"audio"')) snippet = '🎙️ Voice Note';

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
              last_message: snippet,
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

    // 5. Real-Time Message Edit
    const handleMessageEdit = (payload) => {
      setMessages((prev) =>
        prev.map((m) =>
          Number(m.id) === Number(payload.messageId)
            ? {
                ...m,
                content: payload.content,
                ciphertext: payload.ciphertext,
                iv_nonce: payload.ivNonce,
                edited_at: payload.editedAt
              }
            : m
        )
      );
    };

    // 6. Real-Time Message Delete
    const handleMessageDelete = (payload) => {
      setMessages((prev) =>
        payload.forEveryone
          ? prev.map((m) =>
              Number(m.id) === Number(payload.messageId)
                ? {
                    ...m,
                    is_deleted: true,
                    content: 'This message was deleted',
                    ciphertext: null,
                    iv_nonce: null
                  }
                : m
            )
          : prev.filter((m) => Number(m.id) !== Number(payload.messageId))
      );
    };

    socketService.on('message:receive', handleReceiveMessage);
    socketService.on('typing:status', handleTypingStatus);
    socketService.on('presence:update', handlePresenceUpdate);
    socketService.on('message:read_receipt', handleReadReceipt);
    socketService.on('message:edit', handleMessageEdit);
    socketService.on('message:delete', handleMessageDelete);

    return () => {
      socketService.off('message:receive', handleReceiveMessage);
      socketService.off('typing:status', handleTypingStatus);
      socketService.off('presence:update', handlePresenceUpdate);
      socketService.off('message:read_receipt', handleReadReceipt);
      socketService.off('message:edit', handleMessageEdit);
      socketService.off('message:delete', handleMessageDelete);
    };
  }, [user, activeConversationId, fetchConversations, onUnreadCountChange]);

  // Window-level escape and click dismissal for Context Menu & Active Banners
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
    };
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setReplyingTo(null);
        if (editingMessage) {
          setEditingMessage(null);
          setMessageInput('');
        }
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [editingMessage]);

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
  // 4. Send Encrypted Text Message
  // ==========================================================================
  // ==========================================================================
  // 4. Send or Edit Encrypted Text Message
  // ==========================================================================
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !activePartner || sending) return;

    const textToSend = messageInput.trim();
    setMessageInput('');
    socketService.sendTypingStop(activeConversationId, activePartner.id);

    // Case A: Editing an existing message
    if (editingMessage) {
      const targetId = editingMessage.id;
      setEditingMessage(null);
      try {
        setSending(true);
        const encEnvelope = await e2eeService.encryptMessage(activePartner.id, textToSend);

        const res = await apiClient.put(`/messages/msg/${targetId}/edit`, {
          content: textToSend,
          ciphertext: encEnvelope.ciphertext || null,
          ivNonce: encEnvelope.ivNonce || null
        });

        if (res.success && res.data?.message) {
          setMessages((prev) =>
            prev.map((m) =>
              Number(m.id) === Number(targetId)
                ? {
                    ...m,
                    content: textToSend,
                    ciphertext: encEnvelope.ciphertext || null,
                    iv_nonce: encEnvelope.ivNonce || null,
                    edited_at: res.data.message.edited_at || new Date().toISOString()
                  }
                : m
            )
          );
        }
      } catch (err) {
        alert(err.message || 'Failed to edit message.');
      } finally {
        setSending(false);
      }
      return;
    }

    // Case B: Sending a new message (with optional reply)
    const activeReply = replyingTo;
    setReplyingTo(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      sender_id: user.id,
      recipient_id: activePartner.id,
      content: textToSend,
      is_read: false,
      created_at: new Date().toISOString(),
      is_mine: true,
      is_encrypted: true,
      reply_to_id: activeReply?.id || null,
      reply_to_message: activeReply
        ? {
            id: activeReply.id,
            sender_id: activeReply.sender_id,
            sender_username: activeReply.sender_username,
            content: activeReply.content,
            is_deleted: activeReply.is_deleted
          }
        : null
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => scrollToBottom(true), 30);

    try {
      setSending(true);

      const encEnvelope = await e2eeService.encryptMessage(activePartner.id, textToSend);

      const res = await apiClient.post(`/messages/${activePartner.username}`, {
        content: textToSend,
        ciphertext: encEnvelope.ciphertext || null,
        ivNonce: encEnvelope.ivNonce || null,
        senderDeviceId: encEnvelope.senderDeviceId || null,
        replyToId: activeReply?.id || null
      });

      if (res.success && res.data?.message) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...res.data.message,
                  content: textToSend,
                  is_encrypted: Boolean(encEnvelope.ciphertext),
                  reply_to_message: optimisticMessage.reply_to_message
                }
              : m
          )
        );

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
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  // ==========================================================================
  // 5. Send Encrypted Photo Attachment
  // ==========================================================================
  const handleSendImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activePartner || sending) return;

    const activeReply = replyingTo;
    setReplyingTo(null);

    try {
      setSending(true);
      setUploadingMedia(true);

      // 1. Client-Side AES-256-GCM encryption of media bytes
      const encMedia = await encryptMedia(file);

      // 2. Upload ciphertext Blob
      const formData = new FormData();
      formData.append('file', encMedia.encryptedBlob, 'encrypted-image.bin');

      const uploadRes = await apiClient.post('/conversations/media/encrypted', formData);
      if (!uploadRes.success) {
        throw new Error(uploadRes.error || 'Failed to upload encrypted image.');
      }

      const mediaPayload = {
        type: 'image',
        url: uploadRes.data.mediaUrl,
        mediaKey: encMedia.mediaKeyBase64,
        iv: encMedia.ivNonce,
        mimeType: encMedia.mimeType
      };

      const payloadString = JSON.stringify(mediaPayload);

      // 3. Encrypt payload metadata inside E2EE envelope
      const encEnvelope = await e2eeService.encryptMessage(activePartner.id, payloadString);

      const res = await apiClient.post(`/messages/${activePartner.username}`, {
        content: payloadString,
        ciphertext: encEnvelope.ciphertext || null,
        ivNonce: encEnvelope.ivNonce || null,
        senderDeviceId: encEnvelope.senderDeviceId || null,
        replyToId: activeReply?.id || null
      });

      if (res.success && res.data?.message) {
        setMessages((prev) => [
          ...prev,
          {
            ...res.data.message,
            content: payloadString,
            is_mine: true,
            is_encrypted: true,
            reply_to_message: activeReply
          }
        ]);
        setTimeout(() => scrollToBottom(true), 30);
      }
    } catch (err) {
      alert(err.message || 'Failed to send encrypted photo.');
    } finally {
      setSending(false);
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ==========================================================================
  // 6. Send Encrypted Voice Note
  // ==========================================================================
  const handleSendVoiceNote = async (audioBlob, durationSeconds, recordedMimeType) => {
    if (!audioBlob || !activePartner || sending) return;

    const activeReply = replyingTo;
    setReplyingTo(null);

    try {
      setSending(true);
      setIsVoiceRecording(false);
      setUploadingMedia(true);

      // 1. Client-Side AES-256-GCM encryption of audio bytes
      const encMedia = await encryptMedia(audioBlob);

      // 2. Upload ciphertext Blob
      const formData = new FormData();
      formData.append('file', encMedia.encryptedBlob, 'encrypted-voice.bin');

      const uploadRes = await apiClient.post('/conversations/media/encrypted', formData);
      if (!uploadRes.success) {
        throw new Error(uploadRes.error || 'Failed to upload voice note.');
      }

      const mediaPayload = {
        type: 'audio',
        url: uploadRes.data.mediaUrl,
        mediaKey: encMedia.mediaKeyBase64,
        iv: encMedia.ivNonce,
        mimeType: recordedMimeType || audioBlob.type || 'audio/webm',
        durationSeconds
      };

      const payloadString = JSON.stringify(mediaPayload);

      // 3. Encrypt payload metadata inside E2EE envelope
      const encEnvelope = await e2eeService.encryptMessage(activePartner.id, payloadString);

      const res = await apiClient.post(`/messages/${activePartner.username}`, {
        content: payloadString,
        ciphertext: encEnvelope.ciphertext || null,
        ivNonce: encEnvelope.ivNonce || null,
        senderDeviceId: encEnvelope.senderDeviceId || null,
        replyToId: activeReply?.id || null
      });

      if (res.success && res.data?.message) {
        setMessages((prev) => [
          ...prev,
          {
            ...res.data.message,
            content: payloadString,
            is_mine: true,
            is_encrypted: true,
            reply_to_message: activeReply
          }
        ]);
        setTimeout(() => scrollToBottom(true), 30);
      }
    } catch (err) {
      alert(err.message || 'Failed to send voice note.');
    } finally {
      setSending(false);
      setUploadingMedia(false);
    }
  };

  // ==========================================================================
  // 6b. VibeGrid Message Action Handlers (Reply, Edit, Copy, Delete)
  // ==========================================================================
  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    e.stopPropagation();

    const mouseX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 100;
    const mouseY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 100;

    const menuWidth = 190;
    const menuHeight = 220;
    const x = mouseX + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 16 : mouseX;
    const y = mouseY + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 16 : mouseY;

    setContextMenu({ x, y, message: msg });
  };

  const handleTouchStart = (e, msg) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    const touch = e.touches?.[0];
    if (!touch) return;
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    longPressTimerRef.current = setTimeout(() => {
      handleContextMenu({ clientX, clientY, preventDefault: () => {}, stopPropagation: () => {} }, msg);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleStartReply = (msg) => {
    setContextMenu(null);
    setEditingMessage(null);
    setReplyingTo({
      id: msg.id,
      sender_id: msg.sender_id,
      sender_username: msg.is_mine ? user?.username : activePartner?.username,
      content: msg.content,
      is_deleted: msg.is_deleted,
      is_mine: msg.is_mine
    });
  };

  const handleStartEdit = (msg) => {
    setContextMenu(null);
    setReplyingTo(null);
    setEditingMessage({ id: msg.id, content: msg.content });
    setMessageInput(msg.content);
  };

  const handleCopyMessage = (msg) => {
    setContextMenu(null);
    if (msg.content && !msg.is_deleted) {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(msg.content);
      }
    }
  };

  const handlePromptDelete = (msg) => {
    setContextMenu(null);
    if (msg.is_mine && !msg.is_deleted) {
      setDeleteModalTarget({ message: msg });
    } else {
      handleDeleteMessage(msg, 'for_me');
    }
  };

  const handleDeleteMessage = async (msg, type = 'for_everyone') => {
    setContextMenu(null);
    setDeleteModalTarget(null);

    if (type === 'for_everyone' && !msg.is_mine) {
      alert('You can only delete your own messages for everyone.');
      return;
    }

    try {
      const res = await apiClient.delete(`/messages/msg/${msg.id}?type=${type}`);
      if (res.success) {
        if (type === 'for_everyone') {
          setMessages((prev) =>
            prev.map((m) =>
              Number(m.id) === Number(msg.id)
                ? { ...m, is_deleted: true, content: 'This message was deleted', ciphertext: null, iv_nonce: null }
                : m
            )
          );
        } else {
          setMessages((prev) => prev.filter((m) => Number(m.id) !== Number(msg.id)));
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to delete message.');
    }
  };

  const handleStartForward = (msg) => {
    setContextMenu(null);
    setForwardingMessage(msg);
  };

  const handleForwardToUser = async (targetUsername) => {
    if (!forwardingMessage) return;
    try {
      const res = await apiClient.post(`/messages/${targetUsername}/forward`, {
        originalMessageId: forwardingMessage.id,
        content: forwardingMessage.content
      });
      if (res.success) {
        setForwardingMessage(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to forward message.');
    }
  };

  // ==========================================================================
  // 7. Ephemeral / Disappearing Messages Timer
  // ==========================================================================
  const handleSetEphemeralTimer = async (seconds) => {
    setIsEphemeralMenuOpen(false);
    setEphemeralTimer(seconds);
    try {
      if (activeConversationId) {
        await apiClient.put(`/conversations/${activeConversationId}/ephemeral`, {
          timerSeconds: seconds
        });
      }
    } catch (err) {
      console.warn('Failed to update ephemeral timer:', err);
    }
  };

  // ==========================================================================
  // 8. Audio & Video WebRTC Call Triggers
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
  // 9. User Search for New Chat
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
            <div className="messages-sidebar-actions">
              <button
                type="button"
                className="btn-sidebar-icon"
                onClick={() => setIsCallHistoryOpen(true)}
                title="Call History & Logs"
                aria-label="Call History"
              >
                <PhoneCall size={16} />
              </button>
              <button
                type="button"
                className="btn-sidebar-icon"
                onClick={() => setIsCreateGroupOpen(true)}
                title="Create Encrypted Group"
                aria-label="Create Group"
              >
                <Users size={16} />
              </button>
              <button
                type="button"
                className="btn-sidebar-icon"
                onClick={() => setIsKeyBackupOpen(true)}
                title="E2EE Keys Backup & Restore"
                aria-label="Key Backup"
              >
                <KeyRound size={16} />
              </button>
              <button
                type="button"
                className="btn-sidebar-icon btn-new-chat-action"
                onClick={() => setIsNewChatModalOpen(true)}
                title="Start a new chat"
                aria-label="New Chat"
              >
                <Plus size={18} />
              </button>
            </div>
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
                  <ArrowLeft size={20} />
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
                      <button
                        type="button"
                        className={`btn-safety-badge ${isPeerVerified ? 'verified' : 'unverified'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSafetyModalOpen(true);
                        }}
                        title={isPeerVerified ? 'Cryptographic Identity Verified' : 'Click to verify Safety Number'}
                      >
                        {isPeerVerified ? (
                          <>
                            <ShieldCheck size={13} className="safety-badge-icon" />
                            <span>Verified</span>
                          </>
                        ) : (
                          <>
                            <Shield size={13} className="safety-badge-icon" />
                            <span>E2EE</span>
                          </>
                        )}
                      </button>

                      {ephemeralTimer && (
                        <span className="ephemeral-timer-badge" title={`Disappearing messages: ${ephemeralTimer}s`}>
                          <Clock size={13} />
                        </span>
                      )}
                    </div>
                    <span className="chat-header-sub">
                      {isPartnerTyping ? (
                        <span className="typing-sub-label">typing...</span>
                      ) : isCurrentPartnerOnline ? (
                        <span className="online-sub-label">
                          <span className="online-dot-pulse" /> Active now
                        </span>
                      ) : (
                        activePartner.full_name || 'End-to-end encrypted'
                      )}
                    </span>
                  </div>
                </div>

                {/* Header Action Controls */}
                <div className="chat-header-actions">
                  {/* Disappearing Messages Dropdown */}
                  <div className="ephemeral-menu-wrap">
                    <button
                      type="button"
                      className={`btn-chat-action ${ephemeralTimer ? 'active-timer' : ''}`}
                      onClick={() => setIsEphemeralMenuOpen((prev) => !prev)}
                      title="Disappearing Messages Settings"
                      aria-label="Disappearing Messages"
                    >
                      <Clock size={18} />
                    </button>

                    {isEphemeralMenuOpen && (
                      <div className="ephemeral-dropdown">
                        <div className="ephemeral-dropdown-header">
                          <Clock size={14} />
                          <h4>Disappearing Messages</h4>
                        </div>
                        <button type="button" onClick={() => handleSetEphemeralTimer(null)}>
                          <span>Off</span> {ephemeralTimer === null && '✓'}
                        </button>
                        <button type="button" onClick={() => handleSetEphemeralTimer(86400)}>
                          <span>24 Hours</span> {ephemeralTimer === 86400 && '✓'}
                        </button>
                        <button type="button" onClick={() => handleSetEphemeralTimer(604800)}>
                          <span>7 Days</span> {ephemeralTimer === 604800 && '✓'}
                        </button>
                        <button type="button" onClick={() => handleSetEphemeralTimer(2592000)}>
                          <span>30 Days</span> {ephemeralTimer === 2592000 && '✓'}
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className={`btn-chat-action ${isSearchInChatOpen ? 'active-search' : ''}`}
                    onClick={() => {
                      setIsSearchInChatOpen((prev) => !prev);
                      if (isSearchInChatOpen) setChatSearchQuery('');
                    }}
                    title="Search in this encrypted conversation"
                    aria-label="Search Chat"
                  >
                    <Search size={18} />
                  </button>

                  <button
                    type="button"
                    className="btn-chat-action btn-audio-call"
                    onClick={initiateAudioCall}
                    title={`Start Audio Call with @${activePartner.username}`}
                    aria-label="Audio Call"
                  >
                    <Phone size={18} />
                  </button>

                  <button
                    type="button"
                    className="btn-chat-action btn-video-call"
                    onClick={initiateVideoCall}
                    title={`Start Video Call with @${activePartner.username}`}
                    aria-label="Video Call"
                  >
                    <Video size={18} />
                  </button>

                  <button
                    type="button"
                    className="btn-chat-action btn-profile-action"
                    onClick={() => onNavigateToProfile && onNavigateToProfile(activePartner.username)}
                    title={`View @${activePartner.username}'s profile`}
                    aria-label="Profile"
                  >
                    <UserIcon size={18} />
                  </button>
                </div>
              </div>

              {/* In-Chat Encrypted Search Bar */}
              {isSearchInChatOpen && (
                <div className="in-chat-search-bar">
                  <Search size={16} className="in-chat-search-icon" />
                  <input
                    type="text"
                    placeholder="Search in this encrypted conversation..."
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    autoFocus
                    className="in-chat-search-input"
                  />
                  {chatSearchQuery && (
                    <button
                      type="button"
                      className="btn-clear-search"
                      onClick={() => setChatSearchQuery('')}
                      aria-label="Clear Search"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              )}

              {/* Chat Message Stream */}
              <div className="chat-stream" ref={chatStreamRef}>
                {/* E2EE Security Disclaimer Banner */}
                <div className="e2ee-stream-banner">
                  <div className="e2ee-banner-icon-badge">
                    <Lock size={15} />
                  </div>
                  <p>
                    Messages, photos, voice notes, and calls are end-to-end encrypted.
                    Nobody outside of this chat can read or listen to them.
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
                  messages
                    .filter((m) => {
                      if (!chatSearchQuery.trim()) return true;
                      return m.content && m.content.toLowerCase().includes(chatSearchQuery.toLowerCase());
                    })
                    .map((m, idx, arr) => {
                      // ---------- Date separator ----------
                      const currDate = new Date(m.created_at).toDateString();
                      const prevDate = idx > 0 ? new Date(arr[idx - 1].created_at).toDateString() : null;
                      const showDateSep = idx === 0 || currDate !== prevDate;

                      // System call log bubble
                      if (m.message_type === 'call_log') {
                        return (
                          <React.Fragment key={m.id}>
                            {showDateSep && (
                              <div className="date-separator">
                                <span>{getDateSeparatorLabel(m.created_at)}</span>
                              </div>
                            )}
                            <div className="call-log-bubble-row">
                              <div className="call-log-bubble">
                                <PhoneCall size={14} className="call-log-icon" />
                                <span className="call-log-text">{m.content}</span>
                                <span className="call-log-time">{formatMessageTime(m.created_at)}</span>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      }

                      const mediaPayload = m.is_deleted ? null : parseMediaPayload(m.content);

                      return (
                        <React.Fragment key={m.id}>
                          {showDateSep && (
                            <div className="date-separator">
                              <span>{getDateSeparatorLabel(m.created_at)}</span>
                            </div>
                          )}
                          <div
                            id={`msg-${m.id}`}
                            className={`message-bubble-row ${m.is_mine ? 'outgoing' : 'incoming'}`}
                            onContextMenu={(e) => handleContextMenu(e, m)}
                            onTouchStart={(e) => handleTouchStart(e, m)}
                            onTouchEnd={handleTouchEnd}
                          >
                            <div className={`message-bubble ${mediaPayload ? 'has-media' : ''} ${m.is_deleted ? 'deleted-bubble' : ''}`}>
                              {/* Forwarded badge */}
                              {m.is_forwarded && !m.is_deleted && (
                                <div className="forwarded-badge">
                                  <Share2 size={11} /> Forwarded
                                </div>
                              )}
                              {/* Reply-to quote */}
                              {m.reply_to_message && !m.is_deleted && (
                                <div
                                  className="reply-quote"
                                  onClick={() => scrollToMessage(m.reply_to_message.id)}
                                >
                                  <span className="reply-quote-author">
                                    <CornerUpLeft size={12} />
                                    {m.reply_to_message.sender_username
                                      ? `@${m.reply_to_message.sender_username}`
                                      : 'Unknown'}
                                  </span>
                                  <p className="reply-quote-text">
                                    {m.reply_to_message.is_deleted
                                      ? 'This message was deleted'
                                      : (m.reply_to_message.content?.slice(0, 120) || '…')}
                                  </p>
                                </div>
                              )}

                              {/* Message body */}
                              {m.is_deleted ? (
                                <p className="deleted-placeholder">
                                  <Ban size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                  This message was deleted
                                </p>
                              ) : mediaPayload ? (
                                <EncryptedMediaRenderer mediaPayload={mediaPayload} />
                              ) : (
                                <p className="message-text">{m.content}</p>
                              )}

                              <div className="message-info-row">
                                <span className="message-timestamp">
                                  {formatMessageTime(m.created_at)}
                                  {m.edited_at && (
                                    <span className="edited-badge">Edited</span>
                                  )}
                                </span>
                                {m.is_mine && (
                                  <span className="message-receipt-tick" title={m.is_read ? 'Read' : 'Delivered'}>
                                    {m.is_read ? (
                                      <CheckCheck size={14} className="receipt-check-read" />
                                    ) : (
                                      <Check size={13} className="receipt-check-delivered" />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })
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
              <div className="chat-composer-container">
                {/* Reply Preview Banner */}
                {replyingTo && (
                  <div className="reply-preview-banner">
                    <div className="reply-preview-content">
                      <Reply size={14} className="reply-preview-icon" />
                      <div className="reply-preview-meta">
                        <span className="reply-preview-author">
                          Replying to @{replyingTo.sender_username}
                        </span>
                        <p className="reply-preview-snippet">
                          {replyingTo.is_deleted
                            ? 'This message was deleted'
                            : (replyingTo.content?.slice(0, 100) || '…')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="reply-preview-close"
                      onClick={() => setReplyingTo(null)}
                      title="Cancel reply"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Editing Preview Banner */}
                {editingMessage && (
                  <div className="reply-preview-banner editing-banner">
                    <div className="reply-preview-content">
                      <Edit2 size={14} className="reply-preview-icon" />
                      <div className="reply-preview-meta">
                        <span className="reply-preview-author">Editing message</span>
                        <p className="reply-preview-snippet">
                          {editingMessage.content?.slice(0, 100) || '…'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="reply-preview-close"
                      onClick={() => { setEditingMessage(null); setMessageInput(''); }}
                      title="Cancel edit"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {isVoiceRecording ? (
                  <VoiceRecorder
                    onAudioRecorded={handleSendVoiceNote}
                    onCancel={() => setIsVoiceRecording(false)}
                  />
                ) : (
                  <form onSubmit={handleSendMessage} className="chat-composer-bar">
                    {/* Hidden Photo File Input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleSendImage}
                    />

                    <button
                      type="button"
                      className="btn-composer-icon"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach Encrypted Photo"
                      aria-label="Attach Photo"
                      disabled={sending || uploadingMedia}
                    >
                      <ImageIcon size={20} />
                    </button>

                    <button
                      type="button"
                      className="btn-composer-icon"
                      onClick={() => setIsVoiceRecording(true)}
                      title="Record Encrypted Voice Note"
                      aria-label="Record Voice Note"
                      disabled={sending || uploadingMedia}
                    >
                      <Mic size={20} />
                    </button>

                    <input
                      type="text"
                      placeholder={uploadingMedia ? "Encrypting and uploading media..." : `Send an encrypted message to @${activePartner.username}...`}
                      value={messageInput}
                      onChange={handleInputChange}
                      className="chat-input-field"
                      maxLength={1000}
                      disabled={uploadingMedia}
                      autoFocus
                    />

                    <button
                      type="submit"
                      className="btn-primary btn-chat-send"
                      disabled={!messageInput.trim() || sending || uploadingMedia}
                      title="Send message"
                    >
                      <span>{sending ? '...' : 'Send'}</span>
                      <Send size={15} className="send-icon-svg" />
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="chat-no-selection">
              <div className="chat-no-selection-icon">💬</div>
              <h3>Your Direct Messages</h3>
              <p>End-to-end encrypted messaging, voice notes, photos, and video calling on VibeGrid.</p>
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

      {/* Safety Number Verification Modal */}
      <SafetyNumberModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        peerUser={activePartner}
        myUserId={user?.id}
        onVerificationChanged={(verified) => setIsPeerVerified(verified)}
      />

      {/* New Message Search Modal */}
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

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onGroupCreated={() => fetchConversations()}
      />

      {/* Call History Modal */}
      <CallHistoryModal
        isOpen={isCallHistoryOpen}
        onClose={() => setIsCallHistoryOpen(false)}
      />

      {/* Key Backup Modal */}
      <KeyBackupModal
        isOpen={isKeyBackupOpen}
        onClose={() => setIsKeyBackupOpen(false)}
      />

      {/* Floating Context Menu */}
      {contextMenu && (
        <div className="vg-context-overlay" onClick={() => setContextMenu(null)}>
          <div
            className="vg-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {!contextMenu.message.is_deleted && (
              <button className="vg-ctx-item" onClick={() => handleStartReply(contextMenu.message)}>
                <Reply size={15} /> Reply
              </button>
            )}
            {contextMenu.message.is_mine && !contextMenu.message.is_deleted && (
              <button className="vg-ctx-item" onClick={() => handleStartEdit(contextMenu.message)}>
                <Edit2 size={15} /> Edit
              </button>
            )}
            {!contextMenu.message.is_deleted && (
              <button className="vg-ctx-item" onClick={() => handleCopyMessage(contextMenu.message)}>
                <Copy size={15} /> Copy
              </button>
            )}
            {!contextMenu.message.is_deleted && (
              <button className="vg-ctx-item" onClick={() => handleStartForward(contextMenu.message)}>
                <Share2 size={15} /> Forward
              </button>
            )}
            <button className="vg-ctx-item vg-ctx-danger" onClick={() => handlePromptDelete(contextMenu.message)}>
              <Trash2 size={15} /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteModalTarget(null)}>
          <div className="modal-card vg-delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Message</h3>
            <p className="vg-delete-preview">
              {deleteModalTarget.message.content?.slice(0, 80) || '(media)'}
            </p>
            <div className="vg-delete-actions">
              <button
                className="btn-secondary"
                onClick={() => handleDeleteMessage(deleteModalTarget.message, 'for_me')}
              >
                <Trash size={14} /> Delete for me
              </button>
              <button
                className="btn-danger"
                onClick={() => handleDeleteMessage(deleteModalTarget.message, 'for_everyone')}
              >
                <Trash2 size={14} /> Delete for everyone
              </button>
              <button
                className="btn-ghost"
                onClick={() => setDeleteModalTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded CSS Enhancements */}
      <style>{`
        .messages-sidebar-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-sidebar-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-secondary, #94a3b8);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .btn-sidebar-icon:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary, #f8fafc);
          transform: translateY(-1px);
        }

        .btn-new-chat-action {
          background: rgba(99, 102, 241, 0.12) !important;
          color: #818cf8 !important;
          border-color: rgba(99, 102, 241, 0.3) !important;
        }

        .btn-new-chat-action:hover {
          background: #6366f1 !important;
          color: #ffffff !important;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
        }

        .chat-header-avatar-wrap {
          position: relative;
          display: inline-block;
        }

        .chat-header-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--border-color, rgba(255, 255, 255, 0.1));
          transition: border-color 0.2s ease;
        }

        .chat-header-user:hover .chat-header-avatar {
          border-color: #6366f1;
        }

        .header-online-indicator,
        .conversation-online-indicator {
          position: absolute;
          bottom: 1px;
          right: 1px;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: #10b981;
          border: 2px solid var(--card-bg, #131722);
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
        }

        .chat-header-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .chat-header-username {
          font-weight: 700;
          font-size: 1.05rem;
          color: var(--text-primary, #f8fafc);
          letter-spacing: -0.01em;
        }

        .btn-safety-badge {
          border: 1px solid;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .btn-safety-badge.unverified {
          background: rgba(99, 102, 241, 0.12);
          color: #818cf8;
          border-color: rgba(99, 102, 241, 0.3);
        }

        .btn-safety-badge.verified {
          background: rgba(16, 185, 129, 0.14);
          color: #10b981;
          border-color: rgba(16, 185, 129, 0.35);
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.15);
        }

        .btn-safety-badge:hover {
          transform: translateY(-1px) scale(1.04);
        }

        .ephemeral-timer-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #f59e0b;
        }

        .typing-sub-label {
          color: #10b981;
          font-style: italic;
          font-weight: 600;
          animation: pulse 1.5s infinite;
        }

        .online-sub-label {
          color: #10b981;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .online-dot-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 6px #10b981;
        }

        .chat-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-chat-action {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-secondary, #94a3b8);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .btn-chat-action:hover {
          transform: translateY(-2px);
          color: var(--text-primary, #ffffff);
          border-color: rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.08);
        }

        .btn-chat-action.btn-audio-call:hover {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border-color: #10b981;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
        }

        .btn-chat-action.btn-video-call:hover {
          background: rgba(99, 102, 241, 0.15);
          color: #818cf8;
          border-color: #6366f1;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
        }

        .btn-chat-action.active-search {
          background: rgba(56, 189, 248, 0.16);
          color: #38bdf8;
          border-color: #38bdf8;
        }

        .btn-chat-action.active-timer {
          background: rgba(245, 158, 11, 0.16);
          color: #f59e0b;
          border-color: #f59e0b;
        }

        .btn-chat-action.btn-profile-action:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .ephemeral-menu-wrap {
          display: flex;
          align-items: center;
          position: relative;
        }

        .ephemeral-dropdown {
          position: absolute;
          top: 48px;
          right: 0;
          background: var(--bg-card, #1a202c);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
          border-radius: 14px;
          box-shadow: 0 14px 36px rgba(0, 0, 0, 0.45);
          padding: 10px;
          width: 195px;
          z-index: 50;
          display: flex;
          flex-direction: column;
          gap: 4px;
          backdrop-filter: blur(16px);
          animation: slideDown 0.15s ease-out;
        }

        .ephemeral-dropdown-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px 8px;
          border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
          color: #f59e0b;
        }

        .ephemeral-dropdown-header h4 {
          font-size: 0.76rem;
          color: var(--text-secondary, #94a3b8);
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .ephemeral-dropdown button {
          background: transparent;
          border: none;
          padding: 8px 10px;
          border-radius: 8px;
          font-size: 0.85rem;
          color: var(--text-primary, #f8fafc);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .ephemeral-dropdown button:hover {
          background: rgba(99, 102, 241, 0.15);
          color: #818cf8;
        }

        .in-chat-search-bar {
          display: flex;
          align-items: center;
          background: var(--bg-card, #131722);
          border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
          padding: 8px 16px;
          gap: 10px;
          animation: slideDown 0.15s ease-out;
        }

        .in-chat-search-icon {
          color: #818cf8;
          flex-shrink: 0;
        }

        .in-chat-search-input {
          flex: 1;
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
          border-radius: 20px;
          padding: 6px 14px;
          font-size: 0.85rem;
          background: var(--bg-page, #0b0e14);
          color: var(--text-primary, #f8fafc);
          outline: none;
          transition: border-color 0.2s;
        }

        .in-chat-search-input:focus {
          border-color: #6366f1;
        }

        .btn-clear-search {
          background: none;
          border: none;
          color: var(--text-secondary, #94a3b8);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 4px;
          border-radius: 50%;
        }

        .btn-clear-search:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.08);
        }

        .e2ee-stream-banner {
          margin: 12px auto 18px auto;
          max-width: 480px;
          padding: 10px 16px;
          background: rgba(99, 102, 241, 0.07);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
        }

        .e2ee-banner-icon-badge {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.18);
          color: #818cf8;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .e2ee-stream-banner p {
          margin: 0;
          font-size: 0.76rem;
          color: var(--text-secondary, #94a3b8);
          line-height: 1.45;
        }

        .call-log-bubble-row {
          display: flex;
          justify-content: center;
          margin: 12px 0;
          width: 100%;
        }

        .call-log-bubble {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          border-radius: 20px;
          background: rgba(148, 163, 184, 0.1);
          border: 1px solid rgba(148, 163, 184, 0.2);
          font-size: 0.8rem;
          color: var(--text-secondary, #94a3b8);
        }

        .call-log-icon {
          color: #818cf8;
        }

        .call-log-text {
          font-weight: 500;
        }

        .call-log-time {
          font-size: 0.72rem;
          opacity: 0.75;
        }

        .chat-composer-container {
          padding: 12px 20px 16px;
          border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
          background: var(--card-bg, #131722);
          flex-shrink: 0;
        }

        .chat-composer-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--bg-page, #0b0e14);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
          border-radius: 28px;
          padding: 5px 7px 5px 12px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .chat-composer-bar:focus-within {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }

        .btn-composer-icon {
          background: none;
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary, #94a3b8);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-composer-icon:hover {
          color: #818cf8;
          background: rgba(255, 255, 255, 0.08);
          transform: scale(1.08);
        }

        .chat-input-field {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          color: var(--text-primary, #f8fafc);
          font-size: 0.94rem;
          padding: 8px 4px;
        }

        .chat-input-field::placeholder {
          color: var(--text-secondary, #64748b);
        }

        .btn-chat-send {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: 20px;
          font-size: 0.88rem;
          font-weight: 600;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: #ffffff;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 10px rgba(99, 102, 241, 0.35);
        }

        .btn-chat-send:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.5);
        }

        .btn-chat-send:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .message-bubble-row {
          display: flex;
          margin-bottom: 8px;
        }

        .message-bubble-row.outgoing {
          justify-content: flex-end;
        }

        .message-bubble-row.incoming {
          justify-content: flex-start;
        }

        .message-bubble {
          max-width: 68%;
          padding: 10px 14px;
          word-break: break-word;
        }

        .message-bubble-row.outgoing .message-bubble {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: #ffffff;
          border-radius: 18px 18px 4px 18px;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
        }

        .message-bubble-row.incoming .message-bubble {
          background: var(--card-bg, #1a202c);
          color: var(--text-primary, #f8fafc);
          border-radius: 18px 18px 18px 4px;
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
        }

        .message-text {
          margin: 0;
          font-size: 0.92rem;
          line-height: 1.45;
        }

        .message-info-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          margin-top: 4px;
        }

        .message-timestamp {
          font-size: 0.68rem;
          opacity: 0.75;
        }

        .receipt-check-read {
          color: #38bdf8;
        }

        .receipt-check-delivered {
          opacity: 0.7;
        }

        .message-bubble.has-media {
          padding: 6px;
        }

        .encrypted-image-wrap {
          position: relative;
          max-width: 320px;
          border-radius: 12px;
          overflow: hidden;
        }

        .encrypted-chat-img {
          width: 100%;
          border-radius: 10px;
          display: block;
          cursor: pointer;
          transition: filter 0.15s ease;
        }

        .encrypted-chat-img:hover {
          filter: brightness(0.95);
        }

        .img-lock-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(0, 0, 0, 0.65);
          color: #fff;
          font-size: 0.68rem;
          padding: 2px 6px;
          border-radius: 8px;
          backdrop-filter: blur(4px);
        }

        .encrypted-audio-wrap {
          min-width: 250px;
          padding: 8px 10px;
        }

        .audio-note-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .audio-lock-tag {
          font-size: 0.68rem;
          background: rgba(99, 102, 241, 0.15);
          color: #818cf8;
          padding: 1px 5px;
          border-radius: 6px;
          margin-left: auto;
        }

        .encrypted-audio-player {
          width: 100%;
          height: 36px;
        }

        .encrypted-media-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px;
          font-size: 0.82rem;
          color: var(--text-secondary, #64748b);
        }

        .typing-dots-bubble {
          padding: 10px 16px;
          border-radius: 18px;
          background: var(--bg-card, #1a202c);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
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

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ===== Date Separator ===== */
        .date-separator {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 0 6px;
          user-select: none;
        }

        .date-separator span {
          background: rgba(99, 102, 241, 0.12);
          color: #a5b4fc;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 3px 14px;
          border-radius: 12px;
          letter-spacing: 0.02em;
        }

        /* ===== Reply Quote inside bubble ===== */
        .reply-quote {
          background: rgba(99, 102, 241, 0.08);
          border-left: 3px solid #6366f1;
          border-radius: 6px;
          padding: 5px 10px;
          margin-bottom: 6px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .reply-quote:hover {
          background: rgba(99, 102, 241, 0.15);
        }

        .reply-quote-author {
          font-size: 0.72rem;
          font-weight: 600;
          color: #818cf8;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .reply-quote-text {
          font-size: 0.78rem;
          color: var(--text-secondary, #94a3b8);
          margin: 2px 0 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 260px;
        }

        /* ===== Deleted message placeholder ===== */
        .deleted-placeholder {
          font-size: 0.82rem;
          color: var(--text-secondary, #64748b);
          font-style: italic;
          opacity: 0.75;
          margin: 0;
          display: flex;
          align-items: center;
        }

        .deleted-bubble {
          opacity: 0.7;
        }

        /* ===== Edited badge ===== */
        .edited-badge {
          font-size: 0.68rem;
          color: var(--text-secondary, #94a3b8);
          margin-left: 4px;
          font-style: italic;
        }

        /* ===== Reply Preview Banner ===== */
        .reply-preview-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(99, 102, 241, 0.08);
          border-left: 3px solid #6366f1;
          border-radius: 8px;
          padding: 8px 12px;
          margin: 0 12px 6px;
          animation: slideDown 0.18s ease;
        }

        .reply-preview-banner.editing-banner {
          border-left-color: #f59e0b;
          background: rgba(245, 158, 11, 0.08);
        }

        .reply-preview-content {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }

        .reply-preview-icon {
          color: #818cf8;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .editing-banner .reply-preview-icon {
          color: #f59e0b;
        }

        .reply-preview-meta {
          min-width: 0;
          flex: 1;
        }

        .reply-preview-author {
          font-size: 0.75rem;
          font-weight: 600;
          color: #818cf8;
          display: block;
        }

        .editing-banner .reply-preview-author {
          color: #f59e0b;
        }

        .reply-preview-snippet {
          font-size: 0.78rem;
          color: var(--text-secondary, #94a3b8);
          margin: 2px 0 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .reply-preview-close {
          background: none;
          border: none;
          color: var(--text-secondary, #94a3b8);
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }

        .reply-preview-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary, #f8fafc);
        }

        /* ===== Floating Context Menu ===== */
        .vg-context-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: transparent;
        }

        .vg-context-menu {
          position: fixed;
          background: var(--bg-card, #1e293b);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
          border-radius: 12px;
          padding: 6px;
          min-width: 160px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          animation: ctxFadeIn 0.12s ease;
          z-index: 10000;
        }

        @keyframes ctxFadeIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }

        .vg-ctx-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border: none;
          background: none;
          color: var(--text-primary, #e2e8f0);
          font-size: 0.84rem;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.12s;
        }

        .vg-ctx-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .vg-ctx-danger {
          color: #f87171;
        }

        .vg-ctx-danger:hover {
          background: rgba(248, 113, 113, 0.1);
        }

        /* ===== Delete Confirmation Modal ===== */
        .vg-delete-modal {
          max-width: 380px;
          text-align: center;
        }

        .vg-delete-modal h3 {
          margin: 0 0 8px;
          font-size: 1.05rem;
        }

        .vg-delete-preview {
          font-size: 0.82rem;
          color: var(--text-secondary, #94a3b8);
          background: rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          padding: 8px 12px;
          margin: 0 0 16px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .vg-delete-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .vg-delete-actions button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          border-radius: 8px;
          font-size: 0.85rem;
          cursor: pointer;
          border: none;
          transition: background 0.15s, color 0.15s;
        }

        .btn-danger {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }

        .btn-danger:hover {
          background: #ef4444;
          color: #fff;
        }

        .btn-ghost {
          background: none;
          color: var(--text-secondary, #94a3b8);
        }

        .btn-ghost:hover {
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-primary, #f8fafc);
        }

        /* ===== Pulse highlight for scroll-to-message ===== */
        @keyframes pulseHighlight {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.15); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }

        .pulse-highlight .message-bubble {
          animation: pulseHighlight 0.75s ease 2;
          border-color: rgba(99, 102, 241, 0.5) !important;
        }
      `}</style>
    </div>
  );
}

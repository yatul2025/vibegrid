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

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Share2,
  Star,
  Pin,
  Info,
  Smile,
  CheckSquare,
  FileText,
  Paperclip,
  RotateCw,
  MoreVertical,
  VolumeX,
  Volume2,
  Archive,
  ArchiveRestore,
  Flag,
  PinOff
} from 'lucide-react';

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const audioCtx = new AudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08); // A5
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch {}
}

function triggerDesktopNotification(senderUsername, textPreview, avatarUrl, partnerUsername, onSelect) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const notif = new Notification(`@${senderUsername}`, {
      body: textPreview || 'New encrypted message',
      icon: avatarUrl || '/uploads/avatars/default-avatar.png',
      tag: `vg-chat-${partnerUsername}`
    });
    notif.onclick = () => {
      window.focus();
      if (onSelect) onSelect(partnerUsername);
    };
  } catch (e) {
    console.warn('Desktop notification error:', e);
  }
}

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

function formatLastSeen(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isSameDay(date, now)) return `today at ${timeStr}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return `yesterday at ${timeStr}`;

  const isThisWeek = diffMs < 7 * 24 * 60 * 60 * 1000;
  if (isThisWeek) {
    const dayName = date.toLocaleDateString(undefined, { weekday: 'short' });
    return `on ${dayName} at ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${dateStr} at ${timeStr}`;
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

function getReplySnippet(replyMsg) {
  if (!replyMsg) return '';
  if (replyMsg.is_deleted) return 'Original message was deleted';
  const media = parseMediaPayload(replyMsg.content);
  if (media) {
    if (media.type === 'image') return '📷 Photo';
    if (media.type === 'audio') {
      const dur = media.duration ? ` (${Math.round(media.duration)}s)` : '';
      return `🎙 Voice note${dur}`;
    }
    if (media.type === 'video') return '🎥 Video';
    if (media.type === 'document') return '📄 Document';
  }
  return replyMsg.content?.slice(0, 120) || '…';
}

export default function MessagesPage({
  initialTargetUsername = null,
  onNavigateToProfile,
  onUnreadCountChange
}) {
  const { user, guardDemoAction } = useAuth();

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
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [forwardModalTarget, setForwardModalTarget] = useState(null);
  const [forwardSelectedUsers, setForwardSelectedUsers] = useState([]);
  const [forwardSearchQuery, setForwardSearchQuery] = useState('');
  const [forwardSending, setForwardSending] = useState(false);
  const [messageInfoTarget, setMessageInfoTarget] = useState(null);
  const [isStarredModalOpen, setIsStarredModalOpen] = useState(false);
  const [starredMessages, setStarredMessages] = useState([]);
  const [loadingStarred, setLoadingStarred] = useState(false);

  // Phase 2: Multi-select & Bulk Action States
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState(new Set());

  // Phase 3: Presence, Status & Search States
  const [searchMediaType, setSearchMediaType] = useState('all'); // 'all' | 'image' | 'audio' | 'document' | 'starred'
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState(null);
  const [unreadDividerCount, setUnreadDividerCount] = useState(0);

  // Phase 4: Drafts & File Attachments
  const [drafts, setDrafts] = useState(() => {
    const map = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('vg_draft_')) {
          const uname = key.replace('vg_draft_', '');
          map[uname] = localStorage.getItem(key);
        }
      }
    } catch {}
    return map;
  });

  const saveDraft = (username, text) => {
    if (!username) return;
    try {
      if (text && text.trim()) {
        localStorage.setItem(`vg_draft_${username}`, text);
        setDrafts((prev) => ({ ...prev, [username]: text }));
      } else {
        localStorage.removeItem(`vg_draft_${username}`);
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[username];
          return next;
        });
      }
    } catch (e) {
      console.error('Failed to update draft in localStorage:', e);
    }
  };

  // Phase 5: Conversation Controls, Modals & Privacy States
  const [isConvMenuOpen, setIsConvMenuOpen] = useState(false);
  const [isArchivedView, setIsArchivedView] = useState(false);
  const [isMuteModalOpen, setIsMuteModalOpen] = useState(false);
  const [muteTargetConv, setMuteTargetConv] = useState(null);
  const [muteDurationHours, setMuteDurationHours] = useState(8);
  const [isClearChatModalOpen, setIsClearChatModalOpen] = useState(false);
  const [clearChatTargetConv, setClearChatTargetConv] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedBy, setIsBlockedBy] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [convContextMenu, setConvContextMenu] = useState(null);

  const messagesEndRef = useRef(null);
  const chatStreamRef = useRef(null);
  const fileInputRef = useRef(null);
  const docFileInputRef = useRef(null);
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

  const fetchConversations = useCallback(async (archived = isArchivedView) => {
    try {
      const res = await apiClient.get(`/messages/conversations${archived ? '?archived=true' : ''}`);
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
            if (preview && preview.startsWith('{"type":"video"')) preview = '🎥 Video';
            if (preview && preview.startsWith('{"type":"document"')) preview = '📄 Document';

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
  }, [isArchivedView]);

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
        setPinnedMessage(res.data.pinnedMessage || null);

        // Phase 5: Conversation controls & privacy status
        setIsMuted(Boolean(res.data.isMuted));
        setIsPinned(Boolean(res.data.isPinned));
        setIsArchived(Boolean(res.data.isArchived));
        setIsBlocked(Boolean(res.data.isBlocked));
        setIsBlockedBy(Boolean(res.data.isBlockedBy));

        // Phase 4: Restore draft if one exists for this partner
        try {
          const storedDraft = localStorage.getItem(`vg_draft_${partner.username}`) || '';
          setMessageInput(storedDraft);
        } catch {}

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

        // Check for first unread incoming message
        let firstUnreadId = null;
        let unreadCount = 0;
        for (const msg of decryptedMessages) {
          if (!msg.is_mine && !msg.is_read) {
            if (!firstUnreadId) firstUnreadId = msg.id;
            unreadCount++;
          }
        }
        setFirstUnreadMessageId(firstUnreadId);
        setUnreadDividerCount(unreadCount);

        setMessages(decryptedMessages);

        if (isInitialLoad) {
          if (firstUnreadId) {
            setTimeout(() => {
              const unreadEl = document.getElementById('new-messages-divider');
              if (unreadEl) {
                unreadEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              } else {
                scrollToBottom(false);
              }
            }, 80);
          } else {
            setTimeout(() => scrollToBottom(false), 50);
          }
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
          socketService.emit('message:delivered', {
            messageId: processedMsg.id,
            senderId: processedMsg.sender_id,
            conversationId: processedMsg.conversation_id
          });
        }
      }

      // Update conversations sidebar preview
      let snippet = decryptedContent;
      if (snippet && snippet.startsWith('{"type":"image"')) snippet = '📷 Photo';
      if (snippet && snippet.startsWith('{"type":"audio"')) snippet = '🎙️ Voice Note';
      if (snippet && snippet.startsWith('{"type":"video"')) snippet = '🎥 Video';
      if (snippet && snippet.startsWith('{"type":"document"')) snippet = '📄 Document';

      setConversations((prev) => {
        const partnerId = processedMsg.is_mine ? processedMsg.recipient_id : processedMsg.sender_id;
        const exists = prev.some((c) => Number(c.partner_id) === Number(partnerId));
        const matchedConv = prev.find((c) => Number(c.partner_id) === Number(partnerId));
        const isConvMuted = Boolean(matchedConv?.is_muted);

        // Trigger chime & desktop notification if not muted and in background
        if (!processedMsg.is_mine && !isConvMuted) {
          if (document.hidden || !isCurrentChat) {
            playNotificationChime();
            triggerDesktopNotification(
              processedMsg.sender_username || matchedConv?.partner_username || 'Contact',
              snippet,
              matchedConv?.partner_avatar_url,
              processedMsg.sender_username || matchedConv?.partner_username,
              selectConversation
            );
          }
        }

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
    const handlePresenceUpdate = ({ userId, status, lastSeen }) => {
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
      if (status === 'offline' && lastSeen) {
        setActivePartner((prev) =>
          prev && Number(prev.id) === uid ? { ...prev, last_seen_at: lastSeen } : prev
        );
      }
    };

    // 4. Delivery Receipts
    const handleDeliveryReceipt = (payload) => {
      const currentPartner = activePartnerRef.current;
      if (currentPartner && Number(payload.recipientId) === Number(currentPartner.id)) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.is_mine && (!payload.messageId || Number(m.id) === Number(payload.messageId))) {
              return { ...m, delivered_at: payload.deliveredAt || m.delivered_at || new Date().toISOString() };
            }
            return m;
          })
        );
      }
    };

    // 5. Read Receipts
    const handleReadReceipt = ({ readerId }) => {
      const currentPartner = activePartnerRef.current;
      if (currentPartner && Number(readerId) === Number(currentPartner.id)) {
        setMessages((prev) =>
          prev.map((m) => (m.is_mine ? { ...m, is_read: true, read_at: new Date().toISOString() } : m))
        );
      }
    };

    // 6. Real-Time Message Edit
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

    // 7. Real-Time Message Delete
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

    // 8. Real-Time Message Reaction
    const handleMessageReaction = (payload) => {
      setMessages((prev) =>
        prev.map((m) =>
          Number(m.id) === Number(payload.messageId)
            ? { ...m, reactions: payload.reactions }
            : m
        )
      );
    };

    // 9. Real-Time Message Pin
    const handleMessagePin = (payload) => {
      if (payload.conversationId === activeConversationId) {
        setPinnedMessage(payload.pinnedMessage || null);
      }
    };

    socketService.on('message:receive', handleReceiveMessage);
    socketService.on('typing:status', handleTypingStatus);
    socketService.on('presence:update', handlePresenceUpdate);
    socketService.on('message:delivery_receipt', handleDeliveryReceipt);
    socketService.on('message:read_receipt', handleReadReceipt);
    socketService.on('message:edit', handleMessageEdit);
    socketService.on('message:delete', handleMessageDelete);
    socketService.on('message:reaction', handleMessageReaction);
    socketService.on('message:pin', handleMessagePin);

    return () => {
      socketService.off('message:receive', handleReceiveMessage);
      socketService.off('typing:status', handleTypingStatus);
      socketService.off('presence:update', handlePresenceUpdate);
      socketService.off('message:delivery_receipt', handleDeliveryReceipt);
      socketService.off('message:read_receipt', handleReadReceipt);
      socketService.off('message:edit', handleMessageEdit);
      socketService.off('message:delete', handleMessageDelete);
      socketService.off('message:reaction', handleMessageReaction);
      socketService.off('message:pin', handleMessagePin);
    };
  }, [user, activeConversationId, fetchConversations, onUnreadCountChange]);

  // Window-level escape and click dismissal for Context Menu & Active Banners
  useEffect(() => {
    // Request desktop notification permission if supported and default
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const handleGlobalClick = () => {
      setContextMenu(null);
      setIsConvMenuOpen(false);
      setConvContextMenu(null);
    };
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setIsConvMenuOpen(false);
        setConvContextMenu(null);
        setIsMuteModalOpen(false);
        setIsClearChatModalOpen(false);
        setIsReportModalOpen(false);
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
    const val = e.target.value;
    setMessageInput(val);

    if (!activePartner) return;

    // Phase 4: Save draft per-conversation (when not editing an existing message)
    if (!editingMessage) {
      saveDraft(activePartner.username, val);
    }

    socketService.sendTypingStart(activeConversationId, activePartner.id);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketService.sendTypingStop(activeConversationId, activePartner.id);
    }, 1500);
  };

  // ==========================================================================
  // 4. Send or Edit Encrypted Text Message
  // ==========================================================================
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (guardDemoAction('message')) return;
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
          content: encEnvelope.ciphertext ? '' : textToSend,
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
    // Clear draft for this partner
    saveDraft(activePartner.username, '');

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
      pending: true,
      failed: false,
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
        content: encEnvelope.ciphertext ? '' : textToSend,
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
                  reply_to_message: optimisticMessage.reply_to_message,
                  failed: false,
                  pending: false
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
      } else {
        throw new Error(res?.error || 'Send failed');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // Phase 4: Retain optimistic message in state marked as failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, failed: true, pending: false } : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  // Phase 4: Retry sending a previously failed message
  const handleRetryMessage = async (failedMsg) => {
    if (!failedMsg || !activePartner || sending) return;
    const textToSend = failedMsg.content;
    const retryId = failedMsg.id;

    setMessages((prev) =>
      prev.map((m) => (m.id === retryId ? { ...m, failed: false, pending: true } : m))
    );

    try {
      setSending(true);
      const encEnvelope = await e2eeService.encryptMessage(activePartner.id, textToSend);

      const res = await apiClient.post(`/messages/${activePartner.username}`, {
        content: textToSend,
        ciphertext: encEnvelope.ciphertext || null,
        ivNonce: encEnvelope.ivNonce || null,
        senderDeviceId: encEnvelope.senderDeviceId || null,
        replyToId: failedMsg.reply_to_id || null
      });

      if (res.success && res.data?.message) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === retryId
              ? {
                  ...res.data.message,
                  content: textToSend,
                  is_encrypted: Boolean(encEnvelope.ciphertext),
                  reply_to_message: failedMsg.reply_to_message,
                  failed: false,
                  pending: false
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
      } else {
        throw new Error(res?.error || 'Send failed');
      }
    } catch (err) {
      console.error('Retry send failed:', err);
      setMessages((prev) =>
        prev.map((m) => (m.id === retryId ? { ...m, failed: true, pending: false } : m))
      );
    } finally {
      setSending(false);
    }
  };

  const handleDiscardFailedMessage = (msgId) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  };

  // Phase 4: Auto-retry failed messages when browser comes back online
  useEffect(() => {
    const handleOnline = () => {
      setMessages((currentMsgs) => {
        const failedMsgs = currentMsgs.filter((m) => m.is_mine && m.failed);
        failedMsgs.forEach((msg) => {
          handleRetryMessage(msg);
        });
        return currentMsgs;
      });
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [activePartner]);

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
  // 5b. Send Encrypted Document / Video Attachment (Phase 4)
  // ==========================================================================
  const handleSendFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activePartner || sending) return;

    const activeReply = replyingTo;
    setReplyingTo(null);

    const isVideo = file.type.startsWith('video/');
    const mediaType = isVideo ? 'video' : 'document';

    try {
      setSending(true);
      setUploadingMedia(true);

      // 1. Client-Side AES-256-GCM encryption of media/file bytes
      const encMedia = await encryptMedia(file);

      // 2. Upload ciphertext Blob
      const formData = new FormData();
      formData.append('file', encMedia.encryptedBlob, `encrypted-${mediaType}.bin`);

      const uploadRes = await apiClient.post('/conversations/media/encrypted', formData);
      if (!uploadRes.success) {
        throw new Error(uploadRes.error || `Failed to upload encrypted ${mediaType}.`);
      }

      const mediaPayload = {
        type: mediaType,
        url: uploadRes.data.mediaUrl,
        mediaKey: encMedia.mediaKeyBase64,
        iv: encMedia.ivNonce,
        mimeType: file.type || (isVideo ? 'video/mp4' : 'application/octet-stream'),
        fileName: file.name,
        fileSize: file.size
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
      alert(err.message || `Failed to send encrypted ${mediaType}.`);
    } finally {
      setSending(false);
      setUploadingMedia(false);
      if (docFileInputRef.current) docFileInputRef.current.value = '';
    }
  };

  // ==========================================================================
  // 6. Send Encrypted Voice Note
  // ==========================================================================
  const handleSendVoiceNote = async (audioBlob, durationSeconds, recordedMimeType) => {
    if (guardDemoAction('voice')) return;
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

  const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🙏', '🔥', '👏', '🎉'];

  // Toggle emoji reaction
  const handleToggleReaction = async (messageId, reaction) => {
    if (!messageId || !reaction) return;

    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => {
        if (Number(m.id) !== Number(messageId)) return m;
        const current = Array.isArray(m.reactions) ? [...m.reactions] : [];
        const existingIdx = current.findIndex(
          (r) => Number(r.user_id) === Number(user?.id) && r.reaction === reaction
        );
        let updated;
        if (existingIdx >= 0) {
          // Toggle off
          updated = current.filter((_, i) => i !== existingIdx);
        } else {
          // Replace any other reaction from this user or add
          const filtered = current.filter((r) => Number(r.user_id) !== Number(user?.id));
          updated = [...filtered, { user_id: user.id, username: user.username, reaction }];
        }
        return { ...m, reactions: updated };
      })
    );

    try {
      const res = await apiClient.post(`/messages/msg/${messageId}/reaction`, { reaction });
      if (res.success && Array.isArray(res.reactions)) {
        setMessages((prev) =>
          prev.map((m) =>
            Number(m.id) === Number(messageId) ? { ...m, reactions: res.reactions } : m
          )
        );
      }
    } catch (err) {
      console.warn('Reaction update error:', err);
    }
  };

  // Open Forward Modal
  const handleStartForward = (msg) => {
    setContextMenu(null);
    setForwardModalTarget(msg);
    setForwardSelectedUsers([]);
    setForwardSearchQuery('');
  };

  // Execute Forwarding
  const handleExecuteForward = async () => {
    if (!forwardModalTarget || forwardSelectedUsers.length === 0) return;
    try {
      setForwardSending(true);
      let res;
      if (forwardModalTarget.isBulk) {
        res = await apiClient.post('/messages/bulk/forward', {
          messageIds: forwardModalTarget.id,
          targetUsernames: forwardSelectedUsers
        });
      } else {
        res = await apiClient.post('/messages/forward', {
          messageId: forwardModalTarget.id,
          targetUsernames: forwardSelectedUsers
        });
      }
      if (res.success) {
        setForwardModalTarget(null);
        setForwardSelectedUsers([]);
        if (isSelectionMode) handleCancelSelection();
        // If current conversation was one of the targets, reload
        if (activePartner && forwardSelectedUsers.includes(activePartner.username.toLowerCase())) {
          fetchMessagesForPartner(activePartner.username, false);
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to forward message.');
    } finally {
      setForwardSending(false);
    }
  };

  // Open Message Info
  const handleOpenMessageInfo = async (msg) => {
    setContextMenu(null);
    setMessageInfoTarget({ message: msg, data: null, loading: true });
    try {
      const res = await apiClient.get(`/messages/msg/${msg.id}/info`);
      if (res.success) {
        setMessageInfoTarget({ message: msg, data: res.data, loading: false });
      } else {
        setMessageInfoTarget((prev) => (prev ? { ...prev, loading: false } : null));
      }
    } catch (err) {
      setMessageInfoTarget((prev) => (prev ? { ...prev, loading: false, error: err.message } : null));
    }
  };

  // Toggle Star / Save message
  const handleToggleStar = async (msg) => {
    setContextMenu(null);
    if (guardDemoAction('star')) return;
    const targetStarred = !msg.is_starred;
    // Optimistic update
    setMessages((prev) =>
      prev.map((m) =>
        Number(m.id) === Number(msg.id) ? { ...m, is_starred: targetStarred } : m
      )
    );

    try {
      const res = await apiClient.post(`/messages/msg/${msg.id}/star`);
      if (res.success && res.data) {
        setMessages((prev) =>
          prev.map((m) =>
            Number(m.id) === Number(msg.id) ? { ...m, is_starred: res.data.isStarred } : m
          )
        );
      }
    } catch (err) {
      console.warn('Failed to star message:', err);
    }
  };

  // Open Starred Messages Modal
  const handleOpenStarredMessages = async () => {
    setIsStarredModalOpen(true);
    setLoadingStarred(true);
    try {
      const res = await apiClient.get('/messages/starred');
      if (res.success && res.data?.starredMessages) {
        setStarredMessages(res.data.starredMessages);
      }
    } catch (err) {
      console.warn('Failed to fetch starred messages:', err);
    } finally {
      setLoadingStarred(false);
    }
  };

  // Toggle Pin Message
  const handleTogglePin = async (msg) => {
    setContextMenu(null);
    if (guardDemoAction('pin')) return;
    if (!activeConversationId) return;
    const isCurrentlyPinned = Number(pinnedMessage?.id) === Number(msg.id);
    const targetPinId = isCurrentlyPinned ? null : msg.id;

    try {
      const res = await apiClient.post(`/messages/conv/${activeConversationId}/pin`, {
        messageId: targetPinId
      });
      if (res.success) {
        setPinnedMessage(res.data.pinnedMessage || null);
      }
    } catch (err) {
      alert(err.message || 'Failed to update pinned message.');
    }
  };

  // Phase 2: Selection Mode & Bulk Action Handlers
  const handleToggleSelectMode = (msg) => {
    setContextMenu(null);
    setIsSelectionMode(true);
    if (msg) {
      setSelectedMessageIds(new Set([Number(msg.id)]));
    }
  };

  const handleToggleMessageSelection = (messageId) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      const numId = Number(messageId);
      if (next.has(numId)) {
        next.delete(numId);
        if (next.size === 0) setIsSelectionMode(false);
      } else {
        next.add(numId);
      }
      return next;
    });
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
  };

  const handleBulkDelete = async (type = 'for_me') => {
    if (selectedMessageIds.size === 0) return;
    const ids = Array.from(selectedMessageIds);
    try {
      const res = await apiClient.post('/messages/bulk/delete', { messageIds: ids, type });
      if (res.success) {
        if (type === 'for_everyone') {
          setMessages((prev) =>
            prev.map((m) =>
              selectedMessageIds.has(Number(m.id))
                ? { ...m, is_deleted: true, content: 'This message was deleted', ciphertext: null, iv_nonce: null }
                : m
            )
          );
        } else {
          setMessages((prev) => prev.filter((m) => !selectedMessageIds.has(Number(m.id))));
        }
        handleCancelSelection();
      }
    } catch (err) {
      alert(err.message || 'Bulk delete failed.');
    }
  };

  const handleBulkStar = async () => {
    if (selectedMessageIds.size === 0) return;
    const ids = Array.from(selectedMessageIds);
    const selectedMsgs = messages.filter((m) => selectedMessageIds.has(Number(m.id)));
    const allStarred = selectedMsgs.length > 0 && selectedMsgs.every((m) => m.is_starred);
    const targetStar = !allStarred;

    setMessages((prev) =>
      prev.map((m) =>
        selectedMessageIds.has(Number(m.id)) ? { ...m, is_starred: targetStar } : m
      )
    );

    try {
      await apiClient.post('/messages/bulk/star', { messageIds: ids, isStarred: targetStar });
    } catch (err) {
      console.warn('Bulk star failed:', err);
    }
    handleCancelSelection();
  };

  const handleBulkForward = () => {
    if (selectedMessageIds.size === 0) return;
    setForwardModalTarget({
      id: Array.from(selectedMessageIds),
      isBulk: true,
      content: `${selectedMessageIds.size} selected messages`
    });
    setForwardSelectedUsers([]);
    setForwardSearchQuery('');
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
  // 7b. Phase 5: Conversation Controls & Privacy Handlers
  // ==========================================================================
  const handleToggleMute = async (targetConv = null, durationHours = null) => {
    const target = targetConv || muteTargetConv;
    const convId = target?.conversation_id || activeConversationId;
    if (!convId) return;
    const currentMuted = target ? target.is_muted : isMuted;
    const nextMuted = !currentMuted;
    try {
      const res = await apiClient.put(`/messages/conv/${convId}/mute`, {
        isMuted: nextMuted,
        durationHours: nextMuted ? durationHours : null
      });
      if (res.success) {
        if (!target || target.conversation_id === activeConversationId) {
          setIsMuted(nextMuted);
        }
        setIsMuteModalOpen(false);
        setMuteTargetConv(null);
        setIsConvMenuOpen(false);
        setConvContextMenu(null);
        setConversations((prev) =>
          prev.map((c) =>
            c.conversation_id === convId
              ? { ...c, is_muted: nextMuted }
              : c
          )
        );
      }
    } catch (err) {
      alert(err.message || 'Failed to update mute settings.');
    }
  };

  const handleTogglePinConv = async (targetConv = null) => {
    const convId = targetConv?.conversation_id || activeConversationId;
    if (!convId) return;
    const targetIsPinned = targetConv ? targetConv.is_pinned : isPinned;
    const nextPinned = !targetIsPinned;
    try {
      const res = await apiClient.put(`/messages/conv/${convId}/pin-conv`, {
        isPinned: nextPinned
      });
      if (res.success) {
        if (!targetConv || targetConv.conversation_id === activeConversationId) {
          setIsPinned(nextPinned);
        }
        setIsConvMenuOpen(false);
        setConvContextMenu(null);
        setConversations((prev) =>
          prev.map((c) =>
            c.conversation_id === convId ? { ...c, is_pinned: nextPinned } : c
          ).sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0))
        );
      }
    } catch (err) {
      alert(err.message || 'Failed to pin conversation.');
    }
  };

  const handleToggleArchiveConv = async (targetConv = null) => {
    const convId = targetConv?.conversation_id || activeConversationId;
    if (!convId) return;
    const targetIsArchived = targetConv ? targetConv.is_archived : isArchived;
    const nextArchived = !targetIsArchived;
    try {
      const res = await apiClient.put(`/messages/conv/${convId}/archive`, {
        isArchived: nextArchived
      });
      if (res.success) {
        if (!targetConv || targetConv.conversation_id === activeConversationId) {
          setIsArchived(nextArchived);
          setActivePartner(null);
        }
        setIsConvMenuOpen(false);
        setConvContextMenu(null);
        fetchConversations();
      }
    } catch (err) {
      alert(err.message || 'Failed to archive conversation.');
    }
  };

  const handleClearChat = async (targetConv = null) => {
    const target = targetConv || clearChatTargetConv;
    const convId = target?.conversation_id || activeConversationId;
    if (!convId) return;
    try {
      const res = await apiClient.delete(`/messages/conv/${convId}/clear`);
      if (res.success) {
        if (!target || target.conversation_id === activeConversationId) {
          setMessages([]);
        }
        setIsClearChatModalOpen(false);
        setClearChatTargetConv(null);
        setIsConvMenuOpen(false);
        setConvContextMenu(null);
        fetchConversations();
      }
    } catch (err) {
      alert(err.message || 'Failed to clear chat history.');
    }
  };

  const handleToggleBlock = async () => {
    if (!activePartner) return;
    try {
      if (isBlocked) {
        const res = await apiClient.delete(`/users/block/${activePartner.id}`);
        if (res.success) {
          setIsBlocked(false);
          setIsConvMenuOpen(false);
        }
      } else {
        const res = await apiClient.post(`/users/block/${activePartner.id}`);
        if (res.success) {
          setIsBlocked(true);
          setIsConvMenuOpen(false);
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to update block status.');
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!reportReason || !activePartner) return;
    try {
      setSubmittingReport(true);
      const res = await apiClient.post('/messages/report', {
        reportedUserId: activePartner.id,
        conversationId: activeConversationId,
        reason: reportReason,
        details: reportDetails
      });
      if (res.success) {
        alert('Thank you. Your report has been submitted for review.');
        setIsReportModalOpen(false);
        setIsConvMenuOpen(false);
        setReportDetails('');
      }
    } catch (err) {
      alert(err.message || 'Failed to submit report.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleConversationContextMenu = (e, conv) => {
    e.preventDefault();
    e.stopPropagation();
    const mouseX = e.clientX ?? 100;
    const mouseY = e.clientY ?? 100;
    setConvContextMenu({ x: mouseX, y: mouseY, conversation: conv });
  };

  // ==========================================================================
  // 8. Audio & Video WebRTC Call Triggers
  // ==========================================================================
  const initiateAudioCall = () => {
    if (guardDemoAction('call')) return;
    if (!activePartner) return;
    window.dispatchEvent(
      new CustomEvent('vibegrid:initiate-call', {
        detail: { targetUser: activePartner, callType: 'audio' }
      })
    );
  };

  const initiateVideoCall = () => {
    if (guardDemoAction('call')) return;
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

  // Phase 3: Filter messages by query and active media tab
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      // 1. Media type filter
      if (searchMediaType === 'image') {
        const media = parseMediaPayload(m.content);
        if (!media || media.type !== 'image') return false;
      } else if (searchMediaType === 'audio') {
        const media = parseMediaPayload(m.content);
        if (!media || media.type !== 'audio') return false;
      } else if (searchMediaType === 'document') {
        const media = parseMediaPayload(m.content);
        if (!media || media.type !== 'document') return false;
      } else if (searchMediaType === 'starred') {
        if (!m.is_starred) return false;
      }

      // 2. Query filter
      if (!chatSearchQuery.trim()) return true;
      return m.content && m.content.toLowerCase().includes(chatSearchQuery.toLowerCase());
    });
  }, [messages, searchMediaType, chatSearchQuery]);

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
                onClick={handleOpenStarredMessages}
                title="Starred Messages"
                aria-label="Starred Messages"
              >
                <Star size={16} />
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
                className={`btn-sidebar-icon ${isArchivedView ? 'active-archived' : ''}`}
                onClick={() => {
                  const next = !isArchivedView;
                  setIsArchivedView(next);
                  fetchConversations(next);
                }}
                title={isArchivedView ? "View Active Inbox" : "View Archived Chats"}
                aria-label="Archived Chats"
              >
                {isArchivedView ? <ArchiveRestore size={16} /> : <Archive size={16} />}
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
            {isArchivedView && (
              <div className="archived-view-banner">
                <span>📁 Archived Conversations</span>
                <button
                  type="button"
                  className="btn-back-inbox"
                  onClick={() => {
                    setIsArchivedView(false);
                    fetchConversations(false);
                  }}
                >
                  Back to Inbox
                </button>
              </div>
            )}
            {loadingConversations ? (
              <div className="conversations-loading">
                <div className="spinner-sm"></div>
                <span>Loading conversations...</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="conversations-empty">
                <p>{isArchivedView ? 'No archived conversations.' : 'No messages yet.'}</p>
                {!isArchivedView && (
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    onClick={() => setIsNewChatModalOpen(true)}
                  >
                    Send a Message
                  </button>
                )}
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
                    onContextMenu={(e) => handleConversationContextMenu(e, c)}
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
                        <span className="conversation-username">
                          @{c.partner_username}
                          {c.is_pinned && (
                            <Pin size={11} className="conversation-pin-icon" fill="#818cf8" color="#818cf8" title="Pinned to top" />
                          )}
                        </span>
                        <span className="conversation-time">
                          {c.is_muted && (
                            <VolumeX size={12} className="conversation-mute-icon" title="Muted" />
                          )}
                          {formatRelativeTime(c.last_message_at)}
                        </span>
                      </div>
                      <div className="conversation-preview-row">
                        {drafts[c.partner_username] ? (
                          <span className="conversation-snippet draft-snippet">
                            <span className="draft-tag">Draft: </span>
                            {drafts[c.partner_username]}
                          </span>
                        ) : (
                          <span className="conversation-snippet">
                            {c.last_sender_id === user?.id ? 'You: ' : ''}
                            {c.last_message || 'Encrypted message'}
                          </span>
                        )}
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
                      ) : activePartner?.last_seen_at && activePartner?.show_online_status !== false ? (
                        <span className="last-seen-label">
                          Last seen {formatLastSeen(activePartner.last_seen_at)}
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
                      setIsSearchInChatOpen((prev) => {
                        const next = !prev;
                        if (!next) {
                          setChatSearchQuery('');
                          setSearchMediaType('all');
                        }
                        return next;
                      });
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

                  {/* Phase 5: Conversation Menu (MoreVertical) */}
                  <div className="conv-menu-wrap">
                    <button
                      type="button"
                      className="btn-chat-action btn-conv-menu-trigger"
                      onClick={() => setIsConvMenuOpen((prev) => !prev)}
                      title="Conversation Options"
                      aria-label="Conversation Options"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {isConvMenuOpen && (
                      <div className="conv-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="conv-dropdown-item"
                          onClick={() => {
                            setIsConvMenuOpen(false);
                            if (isMuted) {
                              handleToggleMute(null, null);
                            } else {
                              setMuteTargetConv(null);
                              setIsMuteModalOpen(true);
                            }
                          }}
                        >
                          {isMuted ? <Volume2 size={16} /> : <VolumeX size={16} />}
                          <span>{isMuted ? 'Unmute Notifications' : 'Mute Notifications'}</span>
                        </button>

                        <button
                          type="button"
                          className="conv-dropdown-item"
                          onClick={() => {
                            setIsConvMenuOpen(false);
                            handleTogglePinConv();
                          }}
                        >
                          {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                          <span>{isPinned ? 'Unpin Conversation' : 'Pin to Top'}</span>
                        </button>

                        <button
                          type="button"
                          className="conv-dropdown-item"
                          onClick={() => {
                            setIsConvMenuOpen(false);
                            handleToggleArchiveConv();
                          }}
                        >
                          {isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                          <span>{isArchived ? 'Unarchive Conversation' : 'Archive Conversation'}</span>
                        </button>

                        <div className="conv-dropdown-divider" />

                        <button
                          type="button"
                          className="conv-dropdown-item"
                          onClick={() => {
                            setIsConvMenuOpen(false);
                            setIsEphemeralMenuOpen(true);
                          }}
                        >
                          <Clock size={16} />
                          <span>Disappearing Messages</span>
                        </button>

                        <button
                          type="button"
                          className="conv-dropdown-item"
                          onClick={() => {
                            setIsConvMenuOpen(false);
                            setIsSafetyModalOpen(true);
                          }}
                        >
                          <ShieldCheck size={16} />
                          <span>Verify Safety Number</span>
                        </button>

                        <div className="conv-dropdown-divider" />

                        <button
                          type="button"
                          className="conv-dropdown-item text-danger"
                          onClick={() => {
                            setIsConvMenuOpen(false);
                            setClearChatTargetConv(null);
                            setIsClearChatModalOpen(true);
                          }}
                        >
                          <Trash2 size={16} />
                          <span>Clear Chat History</span>
                        </button>

                        <button
                          type="button"
                          className="conv-dropdown-item text-danger"
                          onClick={() => {
                            setIsConvMenuOpen(false);
                            handleToggleBlock();
                          }}
                        >
                          <Ban size={16} />
                          <span>{isBlocked ? 'Unblock User' : 'Block User'}</span>
                        </button>

                        <button
                          type="button"
                          className="conv-dropdown-item text-danger"
                          onClick={() => {
                            setIsConvMenuOpen(false);
                            setIsReportModalOpen(true);
                          }}
                        >
                          <Flag size={16} />
                          <span>Report User / Chat</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Blocked User Banner */}
              {(isBlocked || isBlockedBy) && (
                <div className="chat-blocked-banner">
                  <Ban size={16} className="blocked-banner-icon" />
                  <span>
                    {isBlocked
                      ? `You have blocked @${activePartner.username}.`
                      : `@${activePartner.username} has blocked you.`}
                  </span>
                  {isBlocked && (
                    <button
                      type="button"
                      className="btn-unblock-banner"
                      onClick={handleToggleBlock}
                    >
                      Unblock
                    </button>
                  )}
                </div>
              )}

              {/* In-Chat Encrypted Search & Media Filter Drawer */}
              {isSearchInChatOpen && (
                <div className="in-chat-search-container">
                  <div className="in-chat-search-bar">
                    <Search size={16} className="in-chat-search-icon" />
                    <input
                      type="text"
                      placeholder="Search messages..."
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
                  <div className="search-filter-chips">
                    <button
                      type="button"
                      className={`search-filter-chip ${searchMediaType === 'all' ? 'active' : ''}`}
                      onClick={() => setSearchMediaType('all')}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={`search-filter-chip ${searchMediaType === 'image' ? 'active' : ''}`}
                      onClick={() => setSearchMediaType('image')}
                    >
                      <ImageIcon size={13} /> Photos
                    </button>
                    <button
                      type="button"
                      className={`search-filter-chip ${searchMediaType === 'audio' ? 'active' : ''}`}
                      onClick={() => setSearchMediaType('audio')}
                    >
                      <Mic size={13} /> Audio
                    </button>
                    <button
                      type="button"
                      className={`search-filter-chip ${searchMediaType === 'document' ? 'active' : ''}`}
                      onClick={() => setSearchMediaType('document')}
                    >
                      <FileText size={13} /> Docs
                    </button>
                    <button
                      type="button"
                      className={`search-filter-chip ${searchMediaType === 'starred' ? 'active' : ''}`}
                      onClick={() => setSearchMediaType('starred')}
                    >
                      <Star size={13} /> Starred
                    </button>
                    {(chatSearchQuery || searchMediaType !== 'all') && (
                      <span className="search-results-info">
                        {filteredMessages.length} {filteredMessages.length === 1 ? 'match' : 'matches'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Pinned Message Header Banner */}
              {pinnedMessage && (
                <div
                  className="pinned-message-banner"
                  onClick={() => scrollToMessage(pinnedMessage.id)}
                  title="Click to jump to pinned message"
                >
                  <div className="pinned-banner-content">
                    <Pin size={14} className="pinned-banner-icon" />
                    <div className="pinned-banner-text">
                      <span className="pinned-banner-label">
                        Pinned Message {pinnedMessage.sender_username && `· @${pinnedMessage.sender_username}`}
                      </span>
                      <p className="pinned-banner-snippet">
                        {pinnedMessage.content?.slice(0, 90) || '…'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pinned-banner-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePin(pinnedMessage);
                    }}
                    title="Unpin message"
                  >
                    <X size={14} />
                  </button>
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
                ) : filteredMessages.length === 0 ? (
                  <div className="chat-thread-empty">
                    <h4>No messages found</h4>
                    <p>Try clearing your search query or media filter.</p>
                  </div>
                ) : (
                  filteredMessages.map((m, idx, arr) => {
                    // ---------- Date separator ----------
                    const currDate = new Date(m.created_at).toDateString();
                    const prevDate = idx > 0 ? new Date(arr[idx - 1].created_at).toDateString() : null;
                    const showDateSep = idx === 0 || currDate !== prevDate;
                    const isFirstUnread = firstUnreadMessageId && Number(m.id) === Number(firstUnreadMessageId);

                    // System call log bubble
                    if (m.message_type === 'call_log') {
                      return (
                        <React.Fragment key={m.id}>
                          {showDateSep && (
                            <div className="date-separator">
                              <span>{getDateSeparatorLabel(m.created_at)}</span>
                            </div>
                          )}
                          {isFirstUnread && (
                            <div className="new-messages-separator" id="new-messages-divider">
                              <span className="new-messages-pill">
                                New Messages ({unreadDividerCount})
                              </span>
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
                        {isFirstUnread && (
                          <div className="new-messages-separator" id="new-messages-divider">
                            <span className="new-messages-pill">
                              New Messages ({unreadDividerCount})
                            </span>
                          </div>
                        )}
                        <div
                          id={`msg-${m.id}`}
                          className={`message-bubble-row ${m.is_mine ? 'outgoing' : 'incoming'} ${isSelectionMode ? 'selection-mode' : ''} ${selectedMessageIds.has(Number(m.id)) ? 'is-selected' : ''}`}
                          onClick={isSelectionMode ? () => handleToggleMessageSelection(m.id) : undefined}
                          onContextMenu={(e) => {
                            if (isSelectionMode) {
                              e.preventDefault();
                              handleToggleMessageSelection(m.id);
                            } else {
                              handleContextMenu(e, m);
                            }
                          }}
                          onTouchStart={(e) => {
                            if (!isSelectionMode) handleTouchStart(e, m);
                          }}
                          onTouchEnd={handleTouchEnd}
                        >
                          {/* Selection Checkbox in Multi-Select Mode */}
                          {isSelectionMode && (
                            <div className={`message-select-checkbox ${selectedMessageIds.has(Number(m.id)) ? 'checked' : ''}`}>
                              {selectedMessageIds.has(Number(m.id)) && '✓'}
                            </div>
                          )}

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
                                  {getReplySnippet(m.reply_to_message)}
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
                                  <span className="edited-badge">
                                    Edited · {formatMessageTime(m.edited_at)}
                                  </span>
                                )}
                              </span>
                              {m.is_starred && (
                                <Star size={11} className="message-starred-icon" fill="#f59e0b" color="#f59e0b" title="Starred message" />
                              )}
                              {pinnedMessage?.id === m.id && (
                                <Pin size={11} className="message-pinned-icon" color="#818cf8" title="Pinned message" />
                              )}
                              {m.is_mine && m.failed && (
                                <div className="message-failed-tag" title="Failed to send. Click to retry.">
                                  <span className="failed-text">⚠️ Failed to send</span>
                                  <button
                                    type="button"
                                    className="btn-retry-msg"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRetryMessage(m);
                                    }}
                                    title="Retry sending"
                                  >
                                    <RotateCw size={11} /> Retry
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-discard-msg"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDiscardFailedMessage(m.id);
                                    }}
                                    title="Discard message"
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                              {m.is_mine && !m.failed && (
                                <span
                                  className="message-receipt-tick"
                                  title={m.is_read ? 'Read' : m.delivered_at ? 'Delivered' : 'Sent'}
                                >
                                  {m.is_read ? (
                                    <CheckCheck size={14} className="receipt-check-read" />
                                  ) : m.delivered_at ? (
                                    <CheckCheck size={14} className="receipt-check-delivered" />
                                  ) : (
                                    <Check size={13} className="receipt-check-sent" />
                                  )}
                                </span>
                              )}
                            </div>

                              {/* Aggregated reactions pill row */}
                              {m.reactions && m.reactions.length > 0 && (
                                <div className="message-reactions-row">
                                  {Object.entries(
                                    m.reactions.reduce((acc, r) => {
                                      acc[r.reaction] = (acc[r.reaction] || []).concat(r);
                                      return acc;
                                    }, {})
                                  ).map(([emoji, reacts]) => {
                                    const hasMyReaction = reacts.some(
                                      (r) => Number(r.user_id) === Number(user?.id)
                                    );
                                    const reactorNames = reacts
                                      .map((r) => (r.username === user?.username ? 'You' : `@${r.username}`))
                                      .join(', ');
                                    return (
                                      <button
                                        key={emoji}
                                        type="button"
                                        className={`reaction-pill ${hasMyReaction ? 'my-reaction' : ''}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleReaction(m.id, emoji);
                                        }}
                                        title={reactorNames}
                                      >
                                        <span className="reaction-emoji">{emoji}</span>
                                        {reacts.length > 1 && (
                                          <span className="reaction-count">{reacts.length}</span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
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
                {isSelectionMode ? (
                  /* Multi-Select Floating Action Toolbar */
                  <div className="selection-action-bar" data-testid="selection-bar">
                    <div className="selection-count-badge">
                      <CheckSquare size={16} />
                      <span>{selectedMessageIds.size} selected</span>
                    </div>
                    <div className="selection-actions-wrap">
                      <button
                        type="button"
                        className="btn-selection-action"
                        onClick={handleBulkForward}
                        disabled={selectedMessageIds.size === 0}
                        title="Forward selected messages"
                      >
                        <Share2 size={16} /> <span>Forward</span>
                      </button>
                      <button
                        type="button"
                        className="btn-selection-action"
                        onClick={handleBulkStar}
                        disabled={selectedMessageIds.size === 0}
                        title="Star / Unstar selected messages"
                      >
                        <Star size={16} /> <span>Star</span>
                      </button>
                      <button
                        type="button"
                        className="btn-selection-action btn-selection-danger"
                        onClick={() => handleBulkDelete('for_me')}
                        disabled={selectedMessageIds.size === 0}
                        title="Delete selected messages"
                      >
                        <Trash2 size={16} /> <span>Delete</span>
                      </button>
                      <button
                        type="button"
                        className="btn-selection-action btn-selection-cancel"
                        onClick={handleCancelSelection}
                        title="Cancel selection mode"
                      >
                        <X size={16} /> <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
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

                    {isBlocked || isBlockedBy ? (
                      <div className="chat-composer-blocked-notice">
                        <Ban size={18} className="composer-blocked-icon" />
                        <span>
                          {isBlocked
                            ? `You blocked @${activePartner.username}. Unblock to send messages.`
                            : `You cannot send messages to @${activePartner.username}.`}
                        </span>
                      </div>
                    ) : isVoiceRecording ? (
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

                        {/* Hidden Document / Video File Input (Phase 4) */}
                        <input
                          type="file"
                          ref={docFileInputRef}
                          accept="video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,text/plain"
                          style={{ display: 'none' }}
                          onChange={handleSendFile}
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
                          onClick={() => docFileInputRef.current?.click()}
                          title="Attach Document or Video"
                          aria-label="Attach File"
                          disabled={sending || uploadingMedia}
                        >
                          <Paperclip size={20} />
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
                  </>
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
            {/* Quick Reactions Bar */}
            {!contextMenu.message.is_deleted && (
              <div className="vg-quick-reactions-bar">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="vg-quick-react-btn"
                    onClick={() => {
                      handleToggleReaction(contextMenu.message.id, emoji);
                      setContextMenu(null);
                    }}
                    title={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {!contextMenu.message.is_deleted && (
              <button className="vg-ctx-item" onClick={() => handleStartReply(contextMenu.message)}>
                <Reply size={15} /> Reply
              </button>
            )}
            {!contextMenu.message.is_deleted && (
              <button className="vg-ctx-item" onClick={() => handleStartForward(contextMenu.message)}>
                <Share2 size={15} /> Forward
              </button>
            )}
            {!contextMenu.message.is_deleted && (
              <button className="vg-ctx-item" onClick={() => handleCopyMessage(contextMenu.message)}>
                <Copy size={15} /> Copy
              </button>
            )}
            {!contextMenu.message.is_deleted && (
              <button className="vg-ctx-item" onClick={() => handleToggleSelectMode(contextMenu.message)}>
                <CheckSquare size={15} /> Select
              </button>
            )}
            {!contextMenu.message.is_deleted && (
              <button className="vg-ctx-item" onClick={() => handleToggleStar(contextMenu.message)}>
                <Star size={15} fill={contextMenu.message.is_starred ? '#f59e0b' : 'none'} color={contextMenu.message.is_starred ? '#f59e0b' : 'currentColor'} />
                {contextMenu.message.is_starred ? 'Unstar' : 'Star'}
              </button>
            )}
            {!contextMenu.message.is_deleted && (
              <button className="vg-ctx-item" onClick={() => handleTogglePin(contextMenu.message)}>
                <Pin size={15} /> {pinnedMessage?.id === contextMenu.message.id ? 'Unpin' : 'Pin'}
              </button>
            )}
            {contextMenu.message.is_mine && !contextMenu.message.is_deleted && (
              <button className="vg-ctx-item" onClick={() => handleStartEdit(contextMenu.message)}>
                <Edit2 size={15} /> Edit
              </button>
            )}
            {contextMenu.message.is_mine && !contextMenu.message.is_deleted && (
              <button className="vg-ctx-item" onClick={() => handleOpenMessageInfo(contextMenu.message)}>
                <Info size={15} /> Message Info
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

      {/* Forward Message Modal */}
      {forwardModalTarget && (
        <div className="modal-backdrop" onClick={() => setForwardModalTarget(null)}>
          <div className="modal-card vg-forward-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Forward Message</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setForwardModalTarget(null)}
              >
                ✕
              </button>
            </div>

            <p className="forward-message-preview">
              "{forwardModalTarget.content?.slice(0, 80) || '(Encrypted media)'}"
            </p>

            <div className="forward-search-wrap">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search conversations..."
                value={forwardSearchQuery}
                onChange={(e) => setForwardSearchQuery(e.target.value)}
                className="forward-search-input"
                autoFocus
              />
            </div>

            <div className="forward-recipient-list">
              {conversations
                .filter((c) =>
                  !forwardSearchQuery.trim() ||
                  c.partner_username.toLowerCase().includes(forwardSearchQuery.toLowerCase())
                )
                .map((c) => {
                  const uname = c.partner_username.toLowerCase();
                  const isSelected = forwardSelectedUsers.includes(uname);
                  return (
                    <div
                      key={c.partner_id}
                      className={`forward-recipient-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setForwardSelectedUsers((prev) =>
                          isSelected ? prev.filter((u) => u !== uname) : [...prev, uname]
                        );
                      }}
                    >
                      <img
                        src={c.partner_avatar_url || '/uploads/avatars/default-avatar.png'}
                        alt={c.partner_username}
                        className="forward-recipient-avatar"
                      />
                      <span className="forward-recipient-name">@{c.partner_username}</span>
                      <div className={`forward-checkbox ${isSelected ? 'checked' : ''}`}>
                        {isSelected && '✓'}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="forward-modal-footer">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setForwardModalTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={forwardSelectedUsers.length === 0 || forwardSending}
                onClick={handleExecuteForward}
              >
                {forwardSending ? 'Forwarding...' : `Forward (${forwardSelectedUsers.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Info Modal */}
      {messageInfoTarget && (
        <div className="modal-backdrop" onClick={() => setMessageInfoTarget(null)}>
          <div className="modal-card vg-info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Message Info</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setMessageInfoTarget(null)}
              >
                ✕
              </button>
            </div>

            <div className="vg-info-preview">
              <p className="vg-info-preview-text">
                {messageInfoTarget.message.content?.slice(0, 120) || '(Encrypted media)'}
              </p>
            </div>

            {messageInfoTarget.loading ? (
              <div className="vg-info-loading">Loading message timestamps...</div>
            ) : messageInfoTarget.data ? (
              <div className="vg-info-timestamps">
                <div className="vg-info-status-card">
                  <div className="vg-info-status-icon read">
                    <CheckCheck size={18} />
                  </div>
                  <div className="vg-info-status-meta">
                    <h4>Read</h4>
                    <p>
                      {messageInfoTarget.data.readAt
                        ? new Date(messageInfoTarget.data.readAt).toLocaleString([], {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })
                        : 'Unread'}
                    </p>
                  </div>
                </div>

                <div className="vg-info-status-card">
                  <div className="vg-info-status-icon delivered">
                    <Check size={18} />
                  </div>
                  <div className="vg-info-status-meta">
                    <h4>Delivered</h4>
                    <p>
                      {messageInfoTarget.data.deliveredAt
                        ? new Date(messageInfoTarget.data.deliveredAt).toLocaleString([], {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })
                        : 'Pending delivery'}
                    </p>
                  </div>
                </div>

                <div className="vg-info-status-card">
                  <div className="vg-info-status-icon sent">
                    <Clock size={18} />
                  </div>
                  <div className="vg-info-status-meta">
                    <h4>Sent</h4>
                    <p>
                      {new Date(messageInfoTarget.data.createdAt).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="vg-info-error">Failed to load details.</div>
            )}
          </div>
        </div>
      )}

      {/* Starred Messages Modal */}
      {isStarredModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsStarredModalOpen(false)}>
          <div className="modal-card vg-starred-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title-wrap">
                <Star size={18} fill="#f59e0b" color="#f59e0b" />
                <h3>Starred Messages</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsStarredModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="starred-messages-list">
              {loadingStarred ? (
                <div className="starred-loading">Loading starred messages...</div>
              ) : starredMessages.length === 0 ? (
                <div className="starred-empty">
                  <Star size={32} color="#64748b" />
                  <p>No starred messages yet.</p>
                  <span>Star important messages to easily find them later.</span>
                </div>
              ) : (
                starredMessages.map((sm) => (
                  <div
                    key={sm.id}
                    className="starred-item"
                    onClick={() => {
                      setIsStarredModalOpen(false);
                      if (activePartner && activePartner.username.toLowerCase() === sm.partner_username.toLowerCase()) {
                        scrollToMessage(sm.id);
                      } else {
                        selectConversation(sm.partner_username);
                        setTimeout(() => scrollToMessage(sm.id), 400);
                      }
                    }}
                  >
                    <div className="starred-item-header">
                      <span className="starred-sender">@{sm.sender_username}</span>
                      <span className="starred-date">{formatMessageTime(sm.created_at)}</span>
                    </div>
                    <p className="starred-content">
                      {sm.content?.slice(0, 140) || '(Encrypted media)'}
                    </p>
                    <span className="starred-conversation-tag">
                      Chat with @{sm.partner_username} →
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Phase 5: Conversation Sidebar Context Menu */}
      {convContextMenu && (
        <div className="vg-context-overlay" onClick={() => setConvContextMenu(null)}>
          <div
            className="vg-context-menu"
            style={{ top: convContextMenu.y, left: convContextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="vg-ctx-item"
              onClick={() => {
                const c = convContextMenu.conversation;
                setConvContextMenu(null);
                if (c.is_muted) {
                  handleToggleMute(c, null);
                } else {
                  setMuteTargetConv(c);
                  setIsMuteModalOpen(true);
                }
              }}
            >
              {convContextMenu.conversation.is_muted ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <span>{convContextMenu.conversation.is_muted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button
              type="button"
              className="vg-ctx-item"
              onClick={() => {
                const c = convContextMenu.conversation;
                setConvContextMenu(null);
                handleTogglePinConv(c);
              }}
            >
              {convContextMenu.conversation.is_pinned ? <PinOff size={15} /> : <Pin size={15} />}
              <span>{convContextMenu.conversation.is_pinned ? 'Unpin' : 'Pin to top'}</span>
            </button>

            <button
              type="button"
              className="vg-ctx-item"
              onClick={() => {
                const c = convContextMenu.conversation;
                setConvContextMenu(null);
                handleToggleArchiveConv(c);
              }}
            >
              {convContextMenu.conversation.is_archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
              <span>{convContextMenu.conversation.is_archived ? 'Unarchive' : 'Archive'}</span>
            </button>

            <div className="conv-dropdown-divider" />

            <button
              type="button"
              className="vg-ctx-item vg-ctx-danger"
              onClick={() => {
                const c = convContextMenu.conversation;
                setConvContextMenu(null);
                setClearChatTargetConv(c);
                setIsClearChatModalOpen(true);
              }}
            >
              <Trash2 size={15} />
              <span>Clear Chat</span>
            </button>
          </div>
        </div>
      )}

      {/* Phase 5: Mute Conversation Duration Modal */}
      {isMuteModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setIsMuteModalOpen(false);
            setMuteTargetConv(null);
          }}
        >
          <div className="modal-card mute-duration-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title-wrap">
                <VolumeX size={18} color="#f87171" />
                <h3>Mute Notifications</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => {
                  setIsMuteModalOpen(false);
                  setMuteTargetConv(null);
                }}
              >
                ✕
              </button>
            </div>
            <p className="mute-modal-desc">
              Other participants won't see that you muted this chat. You won't receive sound or desktop notifications.
            </p>
            <div className="mute-options-list">
              <label className={`mute-option-item ${muteDurationHours === 8 ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="muteDuration"
                  value="8"
                  checked={muteDurationHours === 8}
                  onChange={() => setMuteDurationHours(8)}
                />
                <span className="mute-option-label">8 Hours</span>
              </label>
              <label className={`mute-option-item ${muteDurationHours === 168 ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="muteDuration"
                  value="168"
                  checked={muteDurationHours === 168}
                  onChange={() => setMuteDurationHours(168)}
                />
                <span className="mute-option-label">1 Week</span>
              </label>
              <label className={`mute-option-item ${muteDurationHours === null ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="muteDuration"
                  value="always"
                  checked={muteDurationHours === null}
                  onChange={() => setMuteDurationHours(null)}
                />
                <span className="mute-option-label">Always (Until unmuted)</span>
              </label>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setIsMuteModalOpen(false);
                  setMuteTargetConv(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary btn-mute-confirm"
                onClick={() => handleToggleMute(muteTargetConv, muteDurationHours)}
              >
                Mute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 5: Clear Chat Modal */}
      {isClearChatModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setIsClearChatModalOpen(false);
            setClearChatTargetConv(null);
          }}
        >
          <div className="modal-card clear-chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title-wrap">
                <Trash2 size={18} color="#ef4444" />
                <h3>Clear Chat History</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => {
                  setIsClearChatModalOpen(false);
                  setClearChatTargetConv(null);
                }}
              >
                ✕
              </button>
            </div>
            <p className="clear-chat-modal-desc">
              Are you sure you want to clear this chat history? Messages will be deleted from your view only. The other participant will still keep their messages.
            </p>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setIsClearChatModalOpen(false);
                  setClearChatTargetConv(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => handleClearChat(clearChatTargetConv)}
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 5: Report User / Chat Modal */}
      {isReportModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setIsReportModalOpen(false)}
        >
          <div className="modal-card report-chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title-wrap">
                <Flag size={18} color="#ef4444" />
                <h3>Report @{activePartner?.username || 'User'}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsReportModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitReport}>
              <p className="report-modal-desc">
                Select a reason for reporting this user or conversation. Our moderation team will investigate.
              </p>
              <div className="report-reasons-list">
                {[
                  { value: 'spam', label: 'Spam or unsolicited commercial messages' },
                  { value: 'harassment', label: 'Harassment, bullying, or hate speech' },
                  { value: 'inappropriate', label: 'Inappropriate or harmful media content' },
                  { value: 'fraud', label: 'Fraud, scams, or impersonation' },
                  { value: 'other', label: 'Other issue' }
                ].map((item) => (
                  <label key={item.value} className={`report-reason-item ${reportReason === item.value ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="reportReason"
                      value={item.value}
                      checked={reportReason === item.value}
                      onChange={() => setReportReason(item.value)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
              <div className="report-details-box">
                <label htmlFor="report-details-textarea" className="report-details-label">
                  Additional Details (optional):
                </label>
                <textarea
                  id="report-details-textarea"
                  className="report-details-textarea"
                  rows={3}
                  placeholder="Describe what occurred..."
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  maxLength={500}
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setIsReportModalOpen(false)}
                  disabled={submittingReport}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-danger"
                  disabled={submittingReport || !reportReason}
                >
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
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

        /* ===== Quick Reactions Bar in Context Menu ===== */
        .vg-quick-reactions-bar {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 8px;
          margin-bottom: 6px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          overflow-x: auto;
        }

        .vg-quick-react-btn {
          background: none;
          border: none;
          font-size: 1.15rem;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 6px;
          transition: transform 0.15s, background 0.15s;
          line-height: 1;
        }

        .vg-quick-react-btn:hover {
          transform: scale(1.25);
          background: rgba(255, 255, 255, 0.1);
        }

        /* ===== Reaction Pills below/inside bubbles ===== */
        .message-reactions-row {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 5px;
        }

        .reaction-pill {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 2px 7px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: var(--text-primary, #f8fafc);
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .reaction-pill:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: scale(1.05);
        }

        .reaction-pill.my-reaction {
          background: rgba(99, 102, 241, 0.25);
          border-color: rgba(99, 102, 241, 0.5);
        }

        .reaction-emoji {
          font-size: 0.85rem;
          line-height: 1;
        }

        .reaction-count {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-secondary, #94a3b8);
        }

        .reaction-pill.my-reaction .reaction-count {
          color: #a5b4fc;
        }

        .message-starred-icon,
        .message-pinned-icon {
          display: inline-block;
          vertical-align: middle;
          margin-left: 2px;
        }

        /* ===== Pinned Message Banner ===== */
        .pinned-message-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          background: rgba(99, 102, 241, 0.1);
          border-bottom: 1px solid rgba(99, 102, 241, 0.2);
          cursor: pointer;
          transition: background 0.15s;
          backdrop-filter: blur(8px);
          z-index: 10;
        }

        .pinned-message-banner:hover {
          background: rgba(99, 102, 241, 0.16);
        }

        .pinned-banner-content {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .pinned-banner-icon {
          color: #818cf8;
          flex-shrink: 0;
        }

        .pinned-banner-text {
          min-width: 0;
        }

        .pinned-banner-label {
          display: block;
          font-size: 0.72rem;
          font-weight: 600;
          color: #818cf8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .pinned-banner-snippet {
          font-size: 0.8rem;
          color: var(--text-secondary, #cbd5e1);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pinned-banner-close {
          background: none;
          border: none;
          color: var(--text-secondary, #94a3b8);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pinned-banner-close:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        /* ===== Forward Message Modal ===== */
        .vg-forward-modal {
          max-width: 440px;
          width: 90%;
        }

        .forward-message-preview {
          font-size: 0.85rem;
          color: var(--text-secondary, #94a3b8);
          background: rgba(255, 255, 255, 0.04);
          border-left: 3px solid #818cf8;
          padding: 8px 12px;
          border-radius: 0 6px 6px 0;
          margin-bottom: 14px;
          font-style: italic;
        }

        .forward-search-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 8px 12px;
          margin-bottom: 12px;
        }

        .forward-search-input {
          background: none;
          border: none;
          outline: none;
          color: var(--text-primary, #f8fafc);
          font-size: 0.85rem;
          width: 100%;
        }

        .forward-recipient-list {
          max-height: 240px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 16px;
        }

        .forward-recipient-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .forward-recipient-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .forward-recipient-item.selected {
          background: rgba(99, 102, 241, 0.15);
        }

        .forward-recipient-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
        }

        .forward-recipient-name {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-primary, #f8fafc);
          flex: 1;
        }

        .forward-checkbox {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: bold;
          color: #fff;
          transition: all 0.15s;
        }

        .forward-checkbox.checked {
          background: #6366f1;
          border-color: #6366f1;
        }

        .forward-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        /* ===== Message Info Modal ===== */
        .vg-info-modal {
          max-width: 400px;
          width: 90%;
        }

        .vg-info-preview {
          background: rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 16px;
        }

        .vg-info-preview-text {
          font-size: 0.9rem;
          color: var(--text-primary, #f8fafc);
          margin: 0;
        }

        .vg-info-timestamps {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .vg-info-status-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
        }

        .vg-info-status-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .vg-info-status-icon.read {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
        }

        .vg-info-status-icon.delivered {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
        }

        .vg-info-status-icon.sent {
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc;
        }

        .vg-info-status-meta h4 {
          margin: 0 0 2px 0;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary, #f8fafc);
        }

        .vg-info-status-meta p {
          margin: 0;
          font-size: 0.78rem;
          color: var(--text-secondary, #94a3b8);
        }

        /* ===== Starred Messages Modal ===== */
        .vg-starred-modal {
          max-width: 480px;
          width: 90%;
        }

        .starred-messages-list {
          max-height: 360px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .starred-empty {
          text-align: center;
          padding: 36px 16px;
          color: var(--text-secondary, #94a3b8);
        }

        .starred-empty p {
          font-size: 1rem;
          font-weight: 500;
          margin: 10px 0 4px 0;
        }

        .starred-empty span {
          font-size: 0.8rem;
          color: #64748b;
        }

        .starred-item {
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }

        .starred-item:hover {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(245, 158, 11, 0.3);
        }

        .starred-item-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.78rem;
          margin-bottom: 4px;
        }

        .starred-sender {
          font-weight: 600;
          color: #818cf8;
        }

        .starred-date {
          color: #64748b;
        }

        .starred-content {
          font-size: 0.85rem;
          color: var(--text-primary, #f8fafc);
          margin: 0 0 6px 0;
        }

        .starred-conversation-tag {
          font-size: 0.72rem;
          color: #f59e0b;
          font-weight: 500;
        }

        /* Multi-Select Mode Styles */
        .message-bubble-row.selection-mode {
          cursor: pointer;
          user-select: none;
          padding: 3px 8px;
          border-radius: 12px;
          transition: background-color 0.15s ease;
        }

        .message-bubble-row.selection-mode:hover {
          background: rgba(99, 102, 241, 0.08);
        }

        .message-bubble-row.selection-mode.is-selected {
          background: rgba(99, 102, 241, 0.16);
        }

        .message-select-checkbox {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 10px;
          flex-shrink: 0;
          font-size: 11px;
          font-weight: 700;
          color: #ffffff;
          transition: all 0.2s ease;
          align-self: center;
        }

        .message-bubble-row.outgoing .message-select-checkbox {
          margin-right: 10px;
          margin-left: 0;
          order: -1;
        }

        .message-select-checkbox.checked {
          background: #6366f1;
          border-color: #6366f1;
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.4);
        }

        .selection-action-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(99, 102, 241, 0.2);
          animation: slideUpFade 0.2s ease-out;
          width: 100%;
        }

        .selection-count-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #a5b4fc;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .selection-actions-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-selection-action {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          color: #e2e8f0;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-selection-action:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.14);
          border-color: rgba(255, 255, 255, 0.25);
          transform: translateY(-1px);
        }

        .btn-selection-action:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .btn-selection-danger {
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.3);
          background: rgba(239, 68, 68, 0.08);
        }

        .btn-selection-danger:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.5);
          color: #fca5a5;
        }

        .btn-selection-cancel {
          background: transparent;
          border-color: transparent;
          color: #94a3b8;
        }

        .btn-selection-cancel:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #f1f5f9;
        }

        /* ===== Phase 3: Presence, Status & Search Styles ===== */
        .receipt-check-sent {
          color: #64748b;
          opacity: 0.75;
        }

        .last-seen-label {
          color: #94a3b8;
          font-size: 0.76rem;
        }

        .new-messages-separator {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 18px 0;
          position: relative;
        }

        .new-messages-separator::before {
          content: '';
          position: absolute;
          left: 10%;
          right: 10%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.4), transparent);
        }

        .new-messages-pill {
          background: rgba(99, 102, 241, 0.18);
          color: #a5b4fc;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 4px 14px;
          border-radius: 12px;
          border: 1px solid rgba(99, 102, 241, 0.35);
          letter-spacing: 0.02em;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          position: relative;
          z-index: 1;
        }

        .in-chat-search-container {
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding: 8px 16px 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          animation: slideDown 0.18s ease;
        }

        .search-filter-chips {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .search-filter-chips::-webkit-scrollbar {
          display: none;
        }

        .search-filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          color: #94a3b8;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .search-filter-chip:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #f1f5f9;
        }

        .search-filter-chip.active {
          background: #6366f1;
          border-color: #6366f1;
          color: #ffffff;
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.35);
        }

        .search-results-info {
          font-size: 0.75rem;
          color: #818cf8;
          font-weight: 500;
          margin-left: auto;
          white-space: nowrap;
        }

        /* Phase 4: Audio Speed Button */
        .audio-speed-btn {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #818cf8;
          cursor: pointer;
          transition: all 0.15s ease;
          margin-left: auto;
        }

        .audio-speed-btn:hover {
          background: rgba(99, 102, 241, 0.25);
          color: #ffffff;
        }

        /* Phase 4: Encrypted Video Player */
        .encrypted-video-wrap {
          position: relative;
          max-width: 340px;
          border-radius: 12px;
          overflow: hidden;
        }

        .encrypted-chat-video {
          width: 100%;
          border-radius: 10px;
          display: block;
          max-height: 260px;
          background: #000;
        }

        /* Phase 4: Encrypted Document Card */
        .encrypted-doc-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          min-width: 240px;
          max-width: 320px;
        }

        .doc-icon-wrap {
          font-size: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .doc-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex: 1;
        }

        .doc-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: #f1f5f9;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .doc-meta {
          font-size: 0.72rem;
          color: #94a3b8;
          margin-top: 2px;
        }

        .btn-doc-download {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.2);
          color: #818cf8;
          text-decoration: none;
          font-weight: 700;
          transition: all 0.15s ease;
        }

        .btn-doc-download:hover {
          background: #6366f1;
          color: #ffffff;
        }

        /* Phase 4: Draft Snippet in Sidebar */
        .draft-snippet {
          color: #f59e0b !important;
        }

        .draft-tag {
          font-weight: 600;
          color: #fbbf24;
        }

        /* Phase 4: Message Failed & Retry Tag */
        .message-failed-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          padding: 2px 6px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 6px;
          font-size: 0.72rem;
          color: #fca5a5;
        }

        .btn-retry-msg {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: rgba(239, 68, 68, 0.25);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #fef2f2;
          border-radius: 4px;
          padding: 1px 6px;
          font-size: 0.7rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-retry-msg:hover {
          background: #ef4444;
          color: #ffffff;
        }

        .btn-discard-msg {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 0.75rem;
          padding: 0 3px;
          cursor: pointer;
        }

        .btn-discard-msg:hover {
          color: #f87171;
        }

        /* Phase 5: Conversation Menu & Dropdown */
        .conv-menu-wrap {
          position: relative;
        }

        .conv-dropdown-menu {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          padding: 6px;
          min-width: 210px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
          z-index: 100;
          backdrop-filter: blur(12px);
          animation: fadeIn 0.15s ease-out;
        }

        .conv-dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 12px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: #e2e8f0;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .conv-dropdown-item:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }

        .conv-dropdown-item.text-danger {
          color: #f87171;
        }

        .conv-dropdown-item.text-danger:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        .conv-dropdown-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 6px 0;
        }

        /* Phase 5: Blocked User Banner & Composer Notice */
        .chat-blocked-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          background: rgba(239, 68, 68, 0.12);
          border-bottom: 1px solid rgba(239, 68, 68, 0.25);
          color: #fca5a5;
          font-size: 0.82rem;
          font-weight: 500;
          gap: 10px;
        }

        .blocked-banner-icon {
          flex-shrink: 0;
          color: #ef4444;
        }

        .btn-unblock-banner {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #ffffff;
          padding: 3px 10px;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-unblock-banner:hover {
          background: #ef4444;
        }

        .chat-composer-blocked-notice {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          color: #94a3b8;
          font-size: 0.88rem;
          font-style: italic;
        }

        .composer-blocked-icon {
          color: #ef4444;
        }

        /* Phase 5: Sidebar Pin & Mute Badges */
        .conversation-pin-icon {
          margin-left: 5px;
          vertical-align: -1px;
        }

        .conversation-mute-icon {
          margin-right: 4px;
          color: #94a3b8;
          vertical-align: -1px;
        }

        .btn-sidebar-icon.active-archived {
          background: rgba(99, 102, 241, 0.2) !important;
          color: #818cf8 !important;
          border-color: rgba(99, 102, 241, 0.4) !important;
        }

        /* Phase 5: Modals (Mute, Clear, Report) */
        .mute-duration-modal,
        .clear-chat-modal,
        .report-chat-modal {
          max-width: 420px;
          width: 90%;
        }

        .mute-modal-desc,
        .clear-chat-modal-desc,
        .report-modal-desc {
          font-size: 0.85rem;
          color: #94a3b8;
          margin-bottom: 16px;
          line-height: 1.5;
        }

        .mute-options-list,
        .report-reasons-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;
        }

        .mute-option-item,
        .report-reason-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          cursor: pointer;
          color: #cbd5e1;
          font-size: 0.85rem;
          transition: all 0.15s ease;
        }

        .mute-option-item:hover,
        .report-reason-item:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .mute-option-item.selected,
        .report-reason-item.selected {
          background: rgba(99, 102, 241, 0.12);
          border-color: rgba(99, 102, 241, 0.4);
          color: #ffffff;
        }

        .report-details-box {
          margin-bottom: 20px;
        }

        .report-details-label {
          display: block;
          font-size: 0.8rem;
          color: #94a3b8;
          margin-bottom: 6px;
          font-weight: 500;
        }

        .report-details-textarea {
          width: 100%;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 10px;
          color: #f1f5f9;
          font-size: 0.85rem;
          resize: vertical;
          outline: none;
        }

        .report-details-textarea:focus {
          border-color: #6366f1;
        }

        .btn-mute-confirm {
          background: #6366f1;
        }
      `}</style>
    </div>
  );
}

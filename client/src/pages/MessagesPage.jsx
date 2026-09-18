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

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
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
import GroupDetailsModal from '../components/GroupDetailsModal';
import CallHistoryModal from '../components/CallHistoryModal';
import KeyBackupModal from '../components/KeyBackupModal';
import senderKeysService from '../services/crypto/senderKeys';
import VibiEmptyState from '../components/VibiEmptyState';
import soundFx from '../services/soundFxService';
import navigationService from '../services/navigationService';
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
  CornerUpRight,
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
  Key,
  UserPlus,
  LogOut,
  Sparkles,
  Heart,
  PinOff,
  ChevronDown,
  SquarePen,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';

function playNotificationChime() {
  try {
    soundFx.play('receive');
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

const mediaPayloadCache = new Map();

function parseMediaPayload(content) {
  if (!content || typeof content !== 'string') return null;
  if (mediaPayloadCache.has(content)) {
    return mediaPayloadCache.get(content);
  }
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && ['image', 'audio', 'video', 'document'].includes(parsed.type)) {
        if (mediaPayloadCache.size > 500) {
          const firstKey = mediaPayloadCache.keys().next().value;
          mediaPayloadCache.delete(firstKey);
        }
        mediaPayloadCache.set(content, parsed);
        return parsed;
      }
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
  onUnreadCountChange,
  onBack
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
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showMediaWhenTyping, setShowMediaWhenTyping] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [newMessagesWhileScrolledUp, setNewMessagesWhileScrolledUp] = useState(0);

  // Advanced Security & Media States
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [isPeerVerified, setIsPeerVerified] = useState(false);
  const [ephemeralTimer, setEphemeralTimer] = useState(null);
  const [isEphemeralMenuOpen, setIsEphemeralMenuOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isGroupDetailsOpen, setIsGroupDetailsOpen] = useState(false);
  const [isCallHistoryOpen, setIsCallHistoryOpen] = useState(false);
  const [isKeyBackupOpen, setIsKeyBackupOpen] = useState(false);

  // In-Chat Encrypted Search State
  const [isSearchInChatOpen, setIsSearchInChatOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  // Ephemeral Real-Time States
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [partnerTypingName, setPartnerTypingName] = useState('');
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());

  // New Chat Search Modal State
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Redesign: Sidebar Filter tabs, inline search, and quick action more menu
  const [inboxFilter, setInboxFilter] = useState('all'); // 'all' | 'unread' | 'groups'
  const [inboxSearchQuery, setInboxSearchQuery] = useState('');
  const [isSidebarMoreOpen, setIsSidebarMoreOpen] = useState(false);

  // Phase 1: Core Message Actions & Status States
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedMessagesForAction, setSelectedMessagesForAction] = useState([]);
  const selectedMessageForAction = selectedMessagesForAction.length === 1 ? selectedMessagesForAction[0] : null;
  const isActionSelectionActive = selectedMessagesForAction.length > 0;
  const selectedActionMsgIds = useMemo(
    () => new Set(selectedMessagesForAction.map((m) => Number(m.id))),
    [selectedMessagesForAction]
  );
  const [isActionBarMoreOpen, setIsActionBarMoreOpen] = useState(false);
  const [deleteModalTarget, setDeleteModalTarget] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [activePinIndex, setActivePinIndex] = useState(0);
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

  // Phase 3 & 4: Message Micro-Interactions & Reactions (Option 1)
  const [burstingHeartMsgId, setBurstingHeartMsgId] = useState(null);
  const [swipingMessage, setSwipingMessage] = useState(null);
  const [showExtendedReactions, setShowExtendedReactions] = useState(false);
  const lastTapMsgRef = useRef({ id: null, time: 0 });
  const newlySentMsgIdsRef = useRef(new Set());
  const swipeStateRef = useRef(null);
  const justDoubleTappedRef = useRef(0);
  const justSwipedRef = useRef(0);

  const messagesEndRef = useRef(null);
  const chatStreamRef = useRef(null);
  const fileInputRef = useRef(null);
  const docFileInputRef = useRef(null);
  const chatInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const partnerTypingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const partnerTypingExpiresAtRef = useRef(0);
  const longPressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const activePartnerRef = useRef(activePartner);
  activePartnerRef.current = activePartner;
  const selectedMessagesForActionRef = useRef(selectedMessagesForAction);
  selectedMessagesForActionRef.current = selectedMessagesForAction;
  const selectedMessageForActionRef = useRef(selectedMessageForAction);
  selectedMessageForActionRef.current = selectedMessageForAction;
  const justSelectedActionRef = useRef(0);
  const contextMenuRef = useRef(null);
  const isInitialPartnerLoadRef = useRef(true);
  const activePartnerUsernameRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const isNearBottomRef = useRef(true);
  const isInputFocusedRef = useRef(isInputFocused);
  isInputFocusedRef.current = isInputFocused;

  // Ephemeral typing handlers with sticky hysteresis
  const handleIncomingTyping = useCallback((isTyping) => {
    if (isTyping) {
      setIsPartnerTyping(true);
      partnerTypingExpiresAtRef.current = Date.now() + 5000;
      if (partnerTypingTimeoutRef.current) {
        clearTimeout(partnerTypingTimeoutRef.current);
      }
      partnerTypingTimeoutRef.current = setTimeout(() => {
        setIsPartnerTyping(false);
      }, 5000);
    } else {
      // Hysteresis guard: only turn off if sticky expiration window has elapsed
      if (Date.now() >= partnerTypingExpiresAtRef.current) {
        if (partnerTypingTimeoutRef.current) {
          clearTimeout(partnerTypingTimeoutRef.current);
          partnerTypingTimeoutRef.current = null;
        }
        setIsPartnerTyping(false);
      }
    }
  }, []);

  const stopPartnerTypingImmediately = useCallback(() => {
    partnerTypingExpiresAtRef.current = 0;
    if (partnerTypingTimeoutRef.current) {
      clearTimeout(partnerTypingTimeoutRef.current);
      partnerTypingTimeoutRef.current = null;
    }
    setIsPartnerTyping(false);
  }, []);

  // Clear typing timers on conversation change
  useEffect(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    lastTypingSentRef.current = 0;
    stopPartnerTypingImmediately();
    setSelectedMessagesForAction([]);
    setIsActionBarMoreOpen(false);
  }, [activePartner?.id, stopPartnerTypingImmediately]);

  // Refs for tracking modal states synchronously in popstate handler
  const isNewChatModalOpenRef = useRef(isNewChatModalOpen);
  isNewChatModalOpenRef.current = isNewChatModalOpen;
  const isSafetyModalOpenRef = useRef(isSafetyModalOpen);
  isSafetyModalOpenRef.current = isSafetyModalOpen;
  const isCallHistoryOpenRef = useRef(isCallHistoryOpen);
  isCallHistoryOpenRef.current = isCallHistoryOpen;
  const isKeyBackupOpenRef = useRef(isKeyBackupOpen);
  isKeyBackupOpenRef.current = isKeyBackupOpen;
  const isCreateGroupOpenRef = useRef(isCreateGroupOpen);
  isCreateGroupOpenRef.current = isCreateGroupOpen;
  const isGroupDetailsOpenRef = useRef(isGroupDetailsOpen);
  isGroupDetailsOpenRef.current = isGroupDetailsOpen;
  const groupSettingsBackHandlerRef = useRef(null);
  const activeConversationIdRef = useRef(activeConversationId);
  activeConversationIdRef.current = activeConversationId;
  const isStarredModalOpenRef = useRef(isStarredModalOpen);
  isStarredModalOpenRef.current = isStarredModalOpen;
  const deleteModalTargetRef = useRef(deleteModalTarget);
  deleteModalTargetRef.current = deleteModalTarget;
  const forwardModalTargetRef = useRef(forwardModalTarget);
  forwardModalTargetRef.current = forwardModalTarget;
  const messageInfoTargetRef = useRef(messageInfoTarget);
  messageInfoTargetRef.current = messageInfoTarget;
  const isMuteModalOpenRef = useRef(isMuteModalOpen);
  isMuteModalOpenRef.current = isMuteModalOpen;
  const isClearChatModalOpenRef = useRef(isClearChatModalOpen);
  isClearChatModalOpenRef.current = isClearChatModalOpen;
  const isReportModalOpenRef = useRef(isReportModalOpen);
  isReportModalOpenRef.current = isReportModalOpen;
  const isConvMenuOpenRef = useRef(isConvMenuOpen);
  isConvMenuOpenRef.current = isConvMenuOpen;
  const isEphemeralMenuOpenRef = useRef(isEphemeralMenuOpen);
  isEphemeralMenuOpenRef.current = isEphemeralMenuOpen;
  const isSelectionModeRef = useRef(isSelectionMode);
  isSelectionModeRef.current = isSelectionMode;
  const isSearchInChatOpenRef = useRef(isSearchInChatOpen);
  isSearchInChatOpenRef.current = isSearchInChatOpen;
  const isActionBarMoreOpenRef = useRef(isActionBarMoreOpen);
  isActionBarMoreOpenRef.current = isActionBarMoreOpen;

  const pushModalHistory = (modalName) => {
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({
        tab: 'messages',
        modal: modalName,
        inChatWith: activePartnerRef.current?.username || null
      }, '');
    }
  };

  const closeModalWithHistory = (modalName, closeAction) => {
    closeAction();
    if (typeof window !== 'undefined' && window.history && window.history.state?.modal === modalName) {
      window.history.back();
    }
  };

  const openNewChatModal = () => {
    pushModalHistory('new_chat');
    setIsNewChatModalOpen(true);
  };

  const closeNewChatModal = () => {
    closeModalWithHistory('new_chat', () => setIsNewChatModalOpen(false));
  };

  const openSafetyModal = () => {
    pushModalHistory('safety');
    setIsSafetyModalOpen(true);
  };

  const closeSafetyModal = () => {
    closeModalWithHistory('safety', () => setIsSafetyModalOpen(false));
  };

  const openCallHistoryModal = () => {
    pushModalHistory('call_history');
    setIsCallHistoryOpen(true);
  };

  const closeCallHistoryModal = () => {
    closeModalWithHistory('call_history', () => setIsCallHistoryOpen(false));
  };

  const openKeyBackupModal = () => {
    pushModalHistory('key_backup');
    setIsKeyBackupOpen(true);
  };

  const closeKeyBackupModal = () => {
    closeModalWithHistory('key_backup', () => setIsKeyBackupOpen(false));
  };

  const openCreateGroupModal = () => {
    pushModalHistory('create_group');
    setIsCreateGroupOpen(true);
  };

  const closeCreateGroupModal = () => {
    closeModalWithHistory('create_group', () => setIsCreateGroupOpen(false));
  };

  const [groupDetailsInitialScreen, setGroupDetailsInitialScreen] = useState('overview');
  const [groupDetailsInitialAction, setGroupDetailsInitialAction] = useState(null);

  const openGroupDetailsModal = (screen = 'overview', action = null) => {
    setGroupDetailsInitialScreen(screen);
    setGroupDetailsInitialAction(action);
    pushModalHistory('group_details');
    setIsGroupDetailsOpen(true);
  };

  const closeGroupDetailsModal = () => {
    closeModalWithHistory('group_details', () => {
      setIsGroupDetailsOpen(false);
      setGroupDetailsInitialAction(null);
    });
  };

  const openStarredModal = () => {
    pushModalHistory('starred');
    setIsStarredModalOpen(true);
  };

  const closeStarredModal = () => {
    closeModalWithHistory('starred', () => setIsStarredModalOpen(false));
  };

  // Handle native back gestures and browser history navigation in Messages
  useEffect(() => {
    const handlePopState = (e) => {
      // 1. Close open chat modals/menus first if any are active
      if (isNewChatModalOpenRef.current) {
        setIsNewChatModalOpen(false);
        return true;
      }
      if (isSafetyModalOpenRef.current) {
        setIsSafetyModalOpen(false);
        return true;
      }
      if (isCallHistoryOpenRef.current) {
        setIsCallHistoryOpen(false);
        return true;
      }
      if (isKeyBackupOpenRef.current) {
        setIsKeyBackupOpen(false);
        return true;
      }
      if (isCreateGroupOpenRef.current) {
        setIsCreateGroupOpen(false);
        return true;
      }
      if (isGroupDetailsOpenRef.current) {
        if (groupSettingsBackHandlerRef.current && groupSettingsBackHandlerRef.current(true)) {
          return true;
        }
        setIsGroupDetailsOpen(false);
        setGroupDetailsInitialAction(null);
        return true;
      }
      if (isStarredModalOpenRef.current) {
        setIsStarredModalOpen(false);
        return true;
      }
      if (forwardModalTargetRef.current) {
        setForwardModalTarget(null);
        return true;
      }
      if (deleteModalTargetRef.current) {
        setDeleteModalTarget(null);
        return true;
      }
      if (messageInfoTargetRef.current) {
        setMessageInfoTarget(null);
        return true;
      }
      if (isMuteModalOpenRef.current) {
        setIsMuteModalOpen(false);
        return true;
      }
      if (isClearChatModalOpenRef.current) {
        setIsClearChatModalOpen(false);
        return true;
      }
      if (isReportModalOpenRef.current) {
        setIsReportModalOpen(false);
        return true;
      }
      if (isConvMenuOpenRef.current) {
        setIsConvMenuOpen(false);
        return true;
      }
      if (isEphemeralMenuOpenRef.current) {
        setIsEphemeralMenuOpen(false);
        return true;
      }
      if (isSelectionModeRef.current) {
        setIsSelectionMode(false);
        setSelectedMessageIds(new Set());
        return true;
      }
      if (isSearchInChatOpenRef.current) {
        setIsSearchInChatOpen(false);
        setChatSearchQuery('');
        return true;
      }
      if (isActionBarMoreOpenRef.current) {
        setIsActionBarMoreOpen(false);
      }
      if (selectedMessagesForActionRef.current && selectedMessagesForActionRef.current.length > 0) {
        setSelectedMessagesForAction([]);
        setIsActionBarMoreOpen(false);
        return true;
      }

      // 2. Active chat conversation
      if (activePartnerRef.current) {
        // If back was pressed or popstate occurred, exit chat view to conversation list
        if (!e?.state || e.state.inChatWith !== activePartnerRef.current.username) {
          setActivePartner(null);
          return true;
        }
      }

      return false;
    };

    return navigationService.registerBackInterceptor('messages_page_back', handlePopState, 20);
  }, []);

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

  // Reset initial load flag whenever switching to a new partner
  useEffect(() => {
    if (activePartner?.username !== activePartnerUsernameRef.current) {
      activePartnerUsernameRef.current = activePartner?.username || null;
      isInitialPartnerLoadRef.current = true;
      isNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
      setNewMessagesWhileScrolledUp(0);
      prevMessagesLengthRef.current = 0;
    }
  }, [activePartner?.username]);

  // Auto-scroll to bottom of message thread (isolated to chat-stream container to prevent window shifting)
  const scrollToBottom = useCallback((smooth = false) => {
    const doScroll = () => {
      if (chatStreamRef.current) {
        chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
      }
      if (messagesEndRef.current) {
        try {
          messagesEndRef.current.scrollIntoView({
            behavior: smooth ? 'smooth' : 'auto',
            block: 'end'
          });
        } catch {
          if (chatStreamRef.current) {
            chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
          }
        }
      }
    };

    doScroll();
    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 40);
    setTimeout(doScroll, 120);
  }, []);

  // Handle scroll events in chat stream: tracks isNearBottom and toggles floating jump-to-bottom button
  const handleChatStreamScroll = useCallback(() => {
    if (contextMenu) setContextMenu(null);
    if (selectedMessageForActionRef.current) {
      setSelectedMessageForAction(null);
      setIsActionBarMoreOpen(false);
    }

    const el = chatStreamRef.current;
    if (!el) return;

    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distFromBottom < 120;
    isNearBottomRef.current = nearBottom;

    if (nearBottom) {
      setShowScrollBottomBtn(false);
      setNewMessagesWhileScrolledUp(0);
    } else {
      setShowScrollBottomBtn(true);
    }
  }, [contextMenu]);

  // WhatsApp-grade instant bottom placement before browser paint on initial message load
  useLayoutEffect(() => {
    if (isInitialPartnerLoadRef.current && messages.length > 0 && !loadingMessages) {
      if (chatStreamRef.current) {
        chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
      }
    }
  }, [messages, loadingMessages]);

  // Whenever new messages arrive or partner starts/stops typing, ensure thread is scrolled
  useEffect(() => {
    if (messages.length === 0) {
      prevMessagesLengthRef.current = 0;
      return;
    }

    if (isInitialPartnerLoadRef.current) {
      // Instant snap on initial load — start from bottom as WA does
      scrollToBottom(false);
      isInitialPartnerLoadRef.current = false;
      prevMessagesLengthRef.current = messages.length;
      isNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
      setNewMessagesWhileScrolledUp(0);
      return;
    }

    const hasNewMessages = messages.length > prevMessagesLengthRef.current;
    const addedCount = hasNewMessages ? messages.length - prevMessagesLengthRef.current : 0;
    const lastMsg = messages[messages.length - 1];

    if (hasNewMessages && lastMsg?.is_mine) {
      // Current user sent a message: scroll to bottom
      scrollToBottom(true);
      isNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
      setNewMessagesWhileScrolledUp(0);
    } else if (isNearBottomRef.current) {
      // User is currently at the bottom watching the conversation: keep them at bottom
      if (hasNewMessages || isPartnerTyping) {
        scrollToBottom(true);
      }
    } else {
      // USER IS SCROLLED UP READING OLD SMS:
      // DO NOT scroll to bottom! Preserve user's reading position!
      if (hasNewMessages) {
        setNewMessagesWhileScrolledUp((prev) => prev + addedCount);
      }
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, isPartnerTyping, scrollToBottom]);

  // Manage body class for active chat to optimize mobile viewport & prevent window scrolling behind keyboard
  useEffect(() => {
    if (activePartner) {
      document.body.classList.add('has-active-chat');
    } else {
      document.body.classList.remove('has-active-chat');
      document.documentElement.style.removeProperty('--chat-viewport-height');
    }
    return () => {
      document.body.classList.remove('has-active-chat');
      document.documentElement.style.removeProperty('--chat-viewport-height');
    };
  }, [activePartner]);

  // Handle mobile visualViewport resize when virtual keyboard opens or closes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleVisualViewportChange = () => {
      if (activePartnerRef.current) {
        const vv = window.visualViewport;
        if (vv) {
          document.documentElement.style.setProperty('--chat-viewport-height', `${vv.height}px`);
          document.documentElement.style.setProperty('--chat-viewport-top', `${vv.offsetTop || 0}px`);
        }
        // Only scroll to bottom if user is already near bottom or actively typing in the input
        if (isNearBottomRef.current || isInputFocusedRef.current) {
          scrollToBottom(false);
        }
      }
    };

    window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    window.visualViewport.addEventListener('scroll', handleVisualViewportChange);
    handleVisualViewportChange();

    return () => {
      window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      window.visualViewport.removeEventListener('scroll', handleVisualViewportChange);
      document.documentElement.style.removeProperty('--chat-viewport-height');
      document.documentElement.style.removeProperty('--chat-viewport-top');
    };
  }, [scrollToBottom]);

  // ==========================================================================
  // 1. Initial Data Fetching (Conversations List)
  // ==========================================================================

  const fetchConversations = useCallback(async (archived = isArchivedView) => {
    try {
      const res = await apiClient.get(`/messages/conversations${archived ? '?archived=true' : ''}`);
      let convsList = res.success && res.data?.conversations ? res.data.conversations : [];

      // Merge locally stored groups if any (fallback/offline persistence)
      try {
        const cacheKey = `vg_local_groups_${user?.id || 'guest'}`;
        const localGroups = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        if (localGroups.length > 0 && !archived) {
          const serverIds = new Set(convsList.map((c) => String(c.partner_id || c.conversation_id || c.id)));
          const missingGroups = localGroups.filter(
            (g) => !serverIds.has(String(g.partner_id || g.conversation_id || g.id))
          );
          convsList = [...convsList, ...missingGroups];
        }
      } catch (locErr) {}

      if (convsList.length > 0) {
        const decryptedConvs = await Promise.all(
          convsList.map(async (c) => {
            let preview = c.last_message;
            if (c.last_ciphertext && c.last_iv_nonce && !c.is_group) {
              try {
                preview = await e2eeService.decryptMessage(
                  { ciphertext: c.last_ciphertext, iv_nonce: c.last_iv_nonce },
                  c.partner_id
                );
              } catch (_) {}
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
      } else {
        setConversations([]);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, [isArchivedView, user?.id]);

  // Fetch messages for active conversation partner
  const fetchMessagesForPartner = useCallback(async (username, isInitialLoad = false) => {
    if (!username) return;
    try {
      if (isInitialLoad) {
        setLoadingMessages(true);
        setMessages([]);
      }
      const res = await apiClient.get(`/messages/${username}`);
      if (res.success && res.data) {
        const partner = res.data.partner;
        setActivePartner((prev) => {
          if (!prev) return partner;
          if (
            prev.id === partner.id &&
            prev.username === partner.username &&
            prev.full_name === partner.full_name &&
            prev.avatar_url === partner.avatar_url &&
            prev.is_online === partner.is_online &&
            prev.last_seen_at === partner.last_seen_at
          ) {
            return prev;
          }
          return partner;
        });
        setActiveConversationId(res.data.conversationId || null);
        setEphemeralTimer(res.data.ephemeralTimerSeconds || null);
        setPinnedMessage(res.data.pinnedMessage || null);
        setPinnedMessages(
          Array.isArray(res.data.pinnedMessages)
            ? res.data.pinnedMessages
            : (res.data.pinnedMessage ? [res.data.pinnedMessage] : [])
        );
        setActivePinIndex(0);

        // Real-time typing status from serverless sync
        if (typeof res.data.isPartnerTyping === 'boolean') {
          handleIncomingTyping(res.data.isPartnerTyping);
        }

        // Phase 5: Conversation controls & privacy status
        setIsMuted(Boolean(res.data.isMuted));
        setIsPinned(Boolean(res.data.isPinned));
        setIsArchived(Boolean(res.data.isArchived));
        setIsBlocked(Boolean(res.data.isBlocked));
        setIsBlockedBy(Boolean(res.data.isBlockedBy));

        // Phase 4: Restore draft if one exists for this partner (only on initial load)
        if (isInitialLoad) {
          try {
            const storedDraft = localStorage.getItem(`vg_draft_${partner.username}`) || '';
            setMessageInput(storedDraft);
          } catch {}
        }

        // Check verification status from local keyStore
        if (user && !partner.is_group) {
          const verified = await keyStore.isPeerVerified(user.id, partner.id);
          setIsPeerVerified(verified);
        } else if (partner.is_group) {
          setIsPeerVerified(true);
        }

        // Decrypt all incoming/outgoing messages (groups use plaintext/senderKeys)
        let decryptedMessages = res.data.messages || [];
        if (!partner.is_group) {
          decryptedMessages = await e2eeService.decryptMessageList(
            res.data.messages,
            partner.id
          );
        }

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

        // Deduplicate messages by ID to prevent duplicate placeholders or messages
        const uniqueMessages = [];
        const seenMsgIds = new Set();
        for (const msg of decryptedMessages) {
          const key = String(msg.id);
          if (!seenMsgIds.has(key)) {
            seenMsgIds.add(key);
            uniqueMessages.push(msg);
          }
        }

        setMessages((prev) => {
          // Retain any pending or failed optimistic messages awaiting network response or retry
          const pendingOrFailed = prev.filter(
            (m) => (m.pending || m.failed) && String(m.id).startsWith('temp-')
          );

          if (!isInitialLoad && prev.length === uniqueMessages.length && prev.length > 0 && pendingOrFailed.length === 0) {
            const isUnchanged =
              prev[0]?.id === uniqueMessages[0]?.id &&
              prev[prev.length - 1]?.id === uniqueMessages[uniqueMessages.length - 1]?.id &&
              !uniqueMessages.some((msg, idx) => {
                const old = prev[idx];
                return (
                  !old ||
                  old.id !== msg.id ||
                  old.content !== msg.content ||
                  old.is_read !== msg.is_read ||
                  old.delivered_at !== msg.delivered_at ||
                  old.is_deleted !== msg.is_deleted ||
                  old.edited_at !== msg.edited_at ||
                  old.is_starred !== msg.is_starred ||
                  (old.reactions?.length || 0) !== (msg.reactions?.length || 0)
                );
              });
            if (isUnchanged) {
              return prev;
            }
          }

          if (!isInitialLoad && uniqueMessages.length > prev.length) {
            const lastMsg = uniqueMessages[uniqueMessages.length - 1];
            if (lastMsg && !lastMsg.is_mine) {
              stopPartnerTypingImmediately();
            }
          }

          if (pendingOrFailed.length > 0) {
            const remaining = pendingOrFailed.filter(
              (p) => !uniqueMessages.some((m) => m.content === p.content && m.is_mine)
            );
            return [...uniqueMessages, ...remaining];
          }

          return uniqueMessages;
        });

        if (isInitialLoad) {
          if (firstUnreadId) {
            setTimeout(() => {
              const unreadEl = document.getElementById('new-messages-divider');
              if (unreadEl) {
                unreadEl.scrollIntoView({ behavior: 'auto', block: 'center' });
              } else {
                scrollToBottom(false);
              }
            }, 40);
          } else {
            scrollToBottom(false);
          }
        }
        if (onUnreadCountChange) onUnreadCountChange();
      } else if (username.startsWith('group-')) {
        setMessages([]);
      }
    } catch (err) {
      console.error(`Error loading messages for @${username}:`, err);
      if (username.startsWith('group-')) {
        setMessages([]);
      }
    } finally {
      if (isInitialLoad) setLoadingMessages(false);
    }
  }, [user, onUnreadCountChange, handleIncomingTyping, stopPartnerTypingImmediately, scrollToBottom]);

  // Serverless fallback: Poll active conversation if socket is not connected
  useEffect(() => {
    if (!activePartner?.username) return;
    const partnerUsername = activePartner.username;
    const interval = setInterval(() => {
      if (!socketService.isConnected()) {
        fetchMessagesForPartner(partnerUsername, false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [activePartner?.username, fetchMessagesForPartner]);

  // Fast ephemeral typing check (every 1.5s) when in active conversation
  useEffect(() => {
    if (!activePartner?.username) return;
    const partnerUsername = activePartner.username;
    let isMounted = true;

    const checkTyping = async () => {
      try {
        const res = await apiClient.get(`/messages/${partnerUsername}/typing`);
        if (isMounted && res.success && res.data) {
          handleIncomingTyping(Boolean(res.data.isTyping));
        }
      } catch (err) {
        // Quietly handle poll glitches
      }
    };

    const typingPollInterval = setInterval(checkTyping, 1500);
    return () => {
      isMounted = false;
      clearInterval(typingPollInterval);
    };
  }, [activePartner?.username, handleIncomingTyping]);

  // Initial Load
  useEffect(() => {
    fetchConversations();

    if (initialTargetUsername) {
      if (typeof window !== 'undefined' && window.history) {
        if (!window.history.state?.inChatWith) {
          window.history.replaceState({ tab: 'messages', inChatWith: initialTargetUsername, targetDM: initialTargetUsername }, '');
        }
      }
      fetchMessagesForPartner(initialTargetUsername, true);
    }
  }, [fetchConversations, initialTargetUsername, fetchMessagesForPartner]);

  // Request online presence list on mount and maintain presence heartbeat
  useEffect(() => {
    if (!user) return;

    const syncPresence = () => {
      apiClient.post('/messages/heartbeat').catch(() => {});
      socketService.emit('presence:get', (activeIds) => {
        if (Array.isArray(activeIds)) {
          setOnlineUserIds(new Set(activeIds.map(Number)));
        }
      });
    };

    syncPresence();
    const interval = setInterval(syncPresence, 25000);
    return () => clearInterval(interval);
  }, [user]);

  // Clean up deleted or left group from conversation list and active chat
  const handleGroupDeletedOrLeft = useCallback((deletedGroupId) => {
    if (!deletedGroupId) return;
    const cleanId = String(deletedGroupId).replace(/^group-/, '');

    // Remove from conversations list
    setConversations((prev) =>
      prev.filter(
        (c) =>
          c.conversation_id !== cleanId &&
          c.partner_id !== `group-${cleanId}` &&
          c.partner_username !== `group-${cleanId}` &&
          c.id !== cleanId
      )
    );

    // Remove from localStorage cache
    try {
      const cacheKey = `vg_local_groups_${user?.id || 'guest'}`;
      const existing = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      localStorage.setItem(
        cacheKey,
        JSON.stringify(existing.filter((g) => g.id !== cleanId))
      );
    } catch {}

    // If active conversation is the one deleted/left, clear and navigate back
    const currentPartner = activePartnerRef.current;
    if (
      currentPartner &&
      (String(currentPartner.id).replace(/^group-/, '') === cleanId ||
       currentPartner.username === `group-${cleanId}` ||
       String(activeConversationIdRef.current) === cleanId)
    ) {
      setActivePartner(null);
      setActiveConversationId(null);
      setMessages([]);
      if (typeof onBack === 'function') onBack();
    }
  }, [user?.id, onBack]);

  // ==========================================================================
  // 2. Real-Time Socket Event Subscriptions (No Polling)
  // ==========================================================================
  useEffect(() => {
    if (!user) return;

    // 1. Real-time Incoming Message Handler
    const handleReceiveMessage = async (msg) => {
      if (!msg) return;
      console.log('⚡ [Socket] Real-time message received:', msg);

      const isMine = Number(msg.sender_id) === Number(user?.id);
      if (!isMine) {
        playNotificationChime();
      }

      const currentPartner = activePartnerRef.current;
      const rawConvId = msg.conversation_id ? String(msg.conversation_id) : null;
      const cleanConvId = rawConvId ? rawConvId.replace(/^(group-)+/i, '').trim().toLowerCase() : null;

      const partnerIdClean = currentPartner?.id ? String(currentPartner.id).replace(/^(group-)+/i, '').trim().toLowerCase() : null;
      const partnerConvIdClean = currentPartner?.conversation_id ? String(currentPartner.conversation_id).replace(/^(group-)+/i, '').trim().toLowerCase() : null;
      const partnerUsernameClean = currentPartner?.username ? String(currentPartner.username).replace(/^(group-)+/i, '').trim().toLowerCase() : null;
      const activeConvClean = activeConversationIdRef.current ? String(activeConversationIdRef.current).replace(/^(group-)+/i, '').trim().toLowerCase() : null;

      const isGroupChat = Boolean(
        currentPartner?.is_group && cleanConvId && (
          cleanConvId === partnerIdClean ||
          cleanConvId === partnerConvIdClean ||
          cleanConvId === partnerUsernameClean ||
          cleanConvId === activeConvClean
        )
      );
      const isCurrentChat = isGroupChat || (currentPartner && (
        Number(msg.sender_id) === Number(currentPartner.id) ||
        (Number(msg.recipient_id) === Number(currentPartner.id) && Number(msg.sender_id) === Number(user?.id))
      ));

      // Decrypt message content (group chats use plaintext content)
      let decryptedContent = msg.content;
      if (!isGroupChat && (msg.ciphertext || !msg.content)) {
        decryptedContent = await e2eeService.decryptMessage(
          msg,
          isCurrentChat ? currentPartner.id : msg.sender_id
        );
      }

      const processedMsg = {
        ...msg,
        content: decryptedContent,
        is_mine: isMine
      };

      if (isCurrentChat) {
        setMessages((prev) => {
          if (prev.some((m) => Number(m.id) === Number(processedMsg.id))) return prev;
          if (processedMsg.is_mine) {
            const hasTemp = prev.some((m) => String(m.id).startsWith('temp-') && m.content === processedMsg.content);
            if (hasTemp) {
              return prev.map((m) =>
                String(m.id).startsWith('temp-') && m.content === processedMsg.content
                  ? processedMsg
                  : m
              );
            }
          }
          return [...prev, processedMsg];
        });

        setTimeout(() => scrollToBottom(true), 30);

        if (!processedMsg.is_mine) {
          stopPartnerTypingImmediately();
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
        const matchedConv = isGroupChat || convId
          ? prev.find((c) => c.conversation_id === convId || c.partner_username === `group-${convId}` || c.partner_id === `group-${convId}`)
          : prev.find((c) => Number(c.partner_id) === Number(partnerId));
        const exists = Boolean(matchedConv);
        const isConvMuted = Boolean(matchedConv?.is_muted);

        // Trigger desktop notification if not muted and in background
        if (!processedMsg.is_mine && !isConvMuted) {
          if (document.hidden || !isCurrentChat) {
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
          const isThisConv = (isGroupChat || convId)
            ? (c.conversation_id === convId || c.partner_username === `group-${convId}` || c.partner_id === `group-${convId}`)
            : (Number(c.partner_id) === Number(partnerId));
          if (isThisConv) {
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
    const handleTypingStatus = ({ userId, conversationId, username, fullName, isTyping }) => {
      const currentPartner = activePartnerRef.current;
      if (!currentPartner) return;
      if (currentPartner.is_group) {
        const cleanPayloadConv = conversationId ? String(conversationId).replace(/^(group-)+/i, '').trim().toLowerCase() : null;
        const currentConv = String(currentPartner.conversation_id || currentPartner.id).replace(/^(group-)+/i, '').trim().toLowerCase();
        if (cleanPayloadConv && cleanPayloadConv === currentConv && Number(userId) !== Number(user?.id)) {
          setPartnerTypingName(fullName || (username ? `@${username}` : 'Someone'));
          handleIncomingTyping(Boolean(isTyping));
        }
      } else if (Number(userId) === Number(currentPartner.id)) {
        setPartnerTypingName(currentPartner.full_name || `@${String(currentPartner.username || '').replace(/^(group-)+/i, '')}`);
        handleIncomingTyping(Boolean(isTyping));
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
      if (status === 'offline') {
        setActivePartner((prev) =>
          prev && Number(prev.id) === uid
            ? { ...prev, is_online: false, last_seen_at: lastSeen || prev.last_seen_at || new Date().toISOString() }
            : prev
        );
      } else if (status === 'online') {
        setActivePartner((prev) =>
          prev && Number(prev.id) === uid ? { ...prev, is_online: true } : prev
        );
      }
    };

    // 4. Delivery & Read Receipts
    const handleDeliveryReceipt = ({ messageId, conversationId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          Number(m.id) === Number(messageId) ? { ...m, is_delivered: true } : m
        )
      );
    };

    const handleReadReceipt = ({ messageId, conversationId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          Number(m.id) === Number(messageId)
            ? { ...m, is_read: true, is_delivered: true }
            : m
        )
      );
    };

    // 5. Real-Time Message Edit
    const handleMessageEdit = async (payload) => {
      if (!payload?.id) return;
      const currentPartner = activePartnerRef.current;
      const isCurrentChat = currentPartner && Number(payload.conversation_id) === Number(currentPartner.id);

      let decryptedContent = payload.content;
      if (payload.ciphertext && currentPartner) {
        decryptedContent = await e2eeService.decryptMessage(payload, currentPartner.id);
      }

      setMessages((prev) =>
        prev.map((m) =>
          Number(m.id) === Number(payload.id)
            ? {
                ...m,
                ...payload,
                content: decryptedContent,
                is_edited: true,
                edited_at: payload.edited_at || new Date().toISOString()
              }
            : m
        )
      );

      // Update sidebar if last message was edited
      setConversations((prev) =>
        prev.map((c) =>
          Number(c.id) === Number(payload.id)
            ? { ...c, last_message: decryptedContent }
            : c
        )
      );
    };

    // 6. Real-Time Message Delete
    const handleMessageDelete = ({ messageId, deleteForEveryone }) => {
      if (deleteForEveryone) {
        setMessages((prev) =>
          prev.map((m) =>
            Number(m.id) === Number(messageId)
              ? {
                  ...m,
                  is_deleted: true,
                  content: 'This message was deleted',
                  ciphertext: null,
                  iv_nonce: null
                }
              : m
          )
        );

        setConversations((prev) =>
          prev.map((c) =>
            Number(c.id) === Number(messageId)
              ? { ...c, last_message: 'This message was deleted', is_deleted: true }
              : c
          )
        );
      } else {
        setMessages((prev) => prev.filter((m) => Number(m.id) !== Number(messageId)));
      }
    };

    // 7. Real-Time Message Reaction
    const handleMessageReaction = (payload) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (Number(m.id) !== Number(payload.messageId)) return m;
          const currentReactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
          const existingIdx = currentReactions.findIndex(
            (r) => Number(r.user_id) === Number(payload.userId)
          );

          if (payload.action === 'removed') {
            if (existingIdx !== -1) currentReactions.splice(existingIdx, 1);
          } else if (payload.action === 'added') {
            if (existingIdx !== -1) {
              currentReactions[existingIdx] = {
                reaction: payload.reaction,
                user_id: payload.userId,
                username: payload.username
              };
            } else {
              currentReactions.push({
                reaction: payload.reaction,
                user_id: payload.userId,
                username: payload.username
              });
            }
          }

          return { ...m, reactions: currentReactions };
        })
      );
    };

    // 8. Real-Time Conversation Pin
    const handleConvPin = (payload) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.conversation_id === payload.conversationId
            ? { ...c, is_pinned: payload.isPinned }
            : c
        )
      );
    };

    // 9. Real-Time Message Pin
    const handleMessagePin = (payload) => {
      if (payload.conversationId === activeConversationId) {
        setPinnedMessage(payload.pinnedMessage || null);
        if (Array.isArray(payload.pinnedMessages)) {
          setPinnedMessages(payload.pinnedMessages);
        } else if (payload.pinnedMessage) {
          setPinnedMessages([payload.pinnedMessage]);
        } else {
          setPinnedMessages([]);
        }
      }
    };

    // 10. Real-Time Group Events
    const handleGroupDeletedEvent = (payload) => {
      const gId = payload?.conversationId ? String(payload.conversationId).replace(/^group-/, '') : null;
      if (!gId) return;
      handleGroupDeletedOrLeft(gId);
    };

    const handleGroupUpdatedEvent = (payload) => {
      const gId = String(payload?.conversation?.id || payload?.conversationId || '').replace(/^(group-)+/i, '').trim();
      if (!gId) {
        fetchConversations();
        return;
      }
      const updatedTitle = payload?.conversation?.title;
      const updatedMemberCount = payload?.memberCount || payload?.members?.length;

      setConversations((prev) =>
        prev.map((c) => {
          const cId = String(c.conversation_id || c.partner_id || '').replace(/^(group-)+/i, '').trim();
          const cUser = String(c.partner_username || '').replace(/^(group-)+/i, '').trim();
          if (cId === gId || cUser === gId) {
            return {
              ...c,
              ...(updatedTitle ? { partner_full_name: updatedTitle, group_title: updatedTitle, title: updatedTitle } : {}),
              ...(updatedMemberCount ? { member_count: updatedMemberCount } : {})
            };
          }
          return c;
        })
      );

      if (activePartnerRef.current) {
        const curId = String(activePartnerRef.current.id || activePartnerRef.current.conversation_id || '').replace(/^(group-)+/i, '').trim();
        const curUser = String(activePartnerRef.current.username || '').replace(/^(group-)+/i, '').trim();
        if (curId === gId || curUser === gId) {
          setActivePartner((prev) => (prev ? {
            ...prev,
            ...(updatedTitle ? { title: updatedTitle, full_name: updatedTitle } : {}),
            ...(updatedMemberCount ? { member_count: updatedMemberCount } : {})
          } : prev));
        }
      }
      fetchConversations();
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
    socketService.on('group:deleted', handleGroupDeletedEvent);
    socketService.on('group:left', handleGroupDeletedEvent);
    socketService.on('group:removed', handleGroupDeletedEvent);
    socketService.on('group:updated', handleGroupUpdatedEvent);
    socketService.on('group:members_added', handleGroupUpdatedEvent);
    socketService.on('group:member_removed', handleGroupUpdatedEvent);
    socketService.on('group:member_left', handleGroupUpdatedEvent);

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
      socketService.off('group:deleted', handleGroupDeletedEvent);
      socketService.off('group:left', handleGroupDeletedEvent);
      socketService.off('group:removed', handleGroupDeletedEvent);
      socketService.off('group:updated', handleGroupUpdatedEvent);
      socketService.off('group:members_added', handleGroupUpdatedEvent);
      socketService.off('group:member_removed', handleGroupUpdatedEvent);
      socketService.off('group:member_left', handleGroupUpdatedEvent);
    };
  }, [user, activeConversationId, fetchConversations, onUnreadCountChange]);

  // Join/leave active conversation room on socket
  useEffect(() => {
    const rawId = activeConversationId || (activePartner?.is_group ? (activePartner.conversation_id || activePartner.id) : null);
    if (!rawId) return;

    const cleanId = String(rawId).replace(/^(group-)+/i, '').trim();
    if (!cleanId) return;

    socketService.joinConversation(cleanId);
    if (activePartner?.is_group) {
      socketService.joinConversation(`group-${cleanId}`);
    }

    return () => {
      socketService.leaveConversation(cleanId);
      if (activePartner?.is_group) {
        socketService.leaveConversation(`group-${cleanId}`);
      }
    };
  }, [activeConversationId, activePartner?.id, activePartner?.is_group]);

  // Window-level escape and click dismissal for Context Menu & Active Banners
  useEffect(() => {
    // Request desktop notification permission if supported and default
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const handleGlobalClick = () => {
      setIsActionBarMoreOpen(false);
      setContextMenu(null);
      setIsConvMenuOpen(false);
      setConvContextMenu(null);
    };
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isActionBarMoreOpenRef.current) {
          setIsActionBarMoreOpen(false);
          return;
        }
        if (selectedMessagesForActionRef.current && selectedMessagesForActionRef.current.length > 0) {
          handleDeselectMessage();
          return;
        }
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

    // If input was emptied out, immediately stop typing
    if (!val.trim()) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      lastTypingSentRef.current = 0;
      socketService.sendTypingStop(activeConversationId, activePartner.id);
      return;
    }

    // Heartbeat throttle: emit typing:start at most once every 2200ms while actively typing
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2200) {
      lastTypingSentRef.current = now;
      socketService.sendTypingStart(activeConversationId, activePartner.id);
    }

    // Inactivity pause timer: if user stops typing for 3500ms, send typing:stop
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      lastTypingSentRef.current = 0;
      socketService.sendTypingStop(activeConversationId, activePartner.id);
    }, 3500);
  };

  // Auto-resize chat input textarea as content expands
  const adjustChatInputHeight = () => {
    const el = chatInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(Math.max(el.scrollHeight, 36), 160);
    el.style.height = `${newHeight}px`;
  };

  useEffect(() => {
    adjustChatInputHeight();
    const rafId = requestAnimationFrame(() => {
      adjustChatInputHeight();
      if (isNearBottomRef.current) {
        scrollToBottom(false);
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [messageInput, scrollToBottom]);

  // Submit on Enter without Shift, allow Shift+Enter for newlines
  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // ==========================================================================
  // 4. Send or Edit Encrypted Text Message
  // ==========================================================================
  const handleSendMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (guardDemoAction('message')) return;
    if (!messageInput.trim() || !activePartner || sending) return;

    const textToSend = messageInput.trim();
    setMessageInput('');
    setIsInputFocused(false);
    setShowMediaWhenTyping(false);
    if (chatInputRef.current) {
      chatInputRef.current.style.height = 'auto';
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    lastTypingSentRef.current = 0;
    socketService.sendTypingStop(activeConversationId, activePartner.id);

    // Case A: Editing an existing message
    if (editingMessage) {
      const targetId = editingMessage.id;
      if (editingMessage.created_at) {
        const elapsed = Date.now() - new Date(editingMessage.created_at).getTime();
        if (!isNaN(elapsed) && elapsed > 15 * 60 * 1000) {
          alert('Messages can only be edited within 15 minutes of sending.');
          setEditingMessage(null);
          return;
        }
      }
      setEditingMessage(null);
      try {
        setSending(true);
        let encEnvelope = { ciphertext: null, ivNonce: null, senderDeviceId: null };
        if (!activePartner.is_group) {
          try {
            encEnvelope = await e2eeService.encryptMessage(activePartner.id, textToSend);
          } catch (e2eeErr) {
            console.warn('E2EE pairwise encrypt skipped for edit:', e2eeErr);
          }
        }

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
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    lastTypingSentRef.current = 0;
    socketService.sendTypingStop(activeConversationId, activePartner.id);

    const activeReply = replyingTo;
    setReplyingTo(null);

    const tempId = `temp-${Date.now()}`;
    newlySentMsgIdsRef.current.add(tempId);
    setTimeout(() => {
      newlySentMsgIdsRef.current.delete(tempId);
    }, 2500);

    const optimisticMessage = {
      id: tempId,
      sender_id: user.id,
      recipient_id: activePartner.id,
      content: textToSend,
      is_read: false,
      created_at: new Date().toISOString(),
      is_mine: true,
      is_encrypted: !activePartner.is_group,
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
      soundFx.play('send');
    } catch {}

    try {
      setSending(true);

      const isGroup = Boolean(
        activePartner.is_group ||
        activePartner.type === 'group' ||
        String(activePartner.username || '').startsWith('group-') ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          String(activePartner.id || activePartner.conversation_id || '').replace(/^(group-)+/i, '')
        )
      );

      let encEnvelope = { ciphertext: null, ivNonce: null, senderDeviceId: null };
      if (!isGroup) {
        try {
          encEnvelope = await e2eeService.encryptMessage(activePartner.id, textToSend);
        } catch (e2eeErr) {
          console.warn('E2EE pairwise encrypt skipped/fallback:', e2eeErr);
        }
      }

      const targetParam = isGroup
        ? `group-${String(activePartner.conversation_id || activePartner.id || activePartner.username).replace(/^(group-)+/i, '')}`
        : (activePartner.username || activePartner.id);
      const res = await apiClient.post(`/messages/${targetParam}`, {
        content: encEnvelope.ciphertext ? '' : textToSend,
        ciphertext: encEnvelope.ciphertext || null,
        ivNonce: encEnvelope.ivNonce || null,
        senderDeviceId: encEnvelope.senderDeviceId || null,
        replyToId: activeReply?.id || null
      });

      if (res.success && res.data?.message) {
        const realId = Number(res.data.message.id);
        newlySentMsgIdsRef.current.add(realId);
        setTimeout(() => {
          newlySentMsgIdsRef.current.delete(realId);
        }, 2500);

        setMessages((prev) => {
          const alreadyHasRealMsg = prev.some((m) => Number(m.id) === realId);
          if (alreadyHasRealMsg) {
            return prev.filter((m) => m.id !== tempId);
          }
          return prev.map((m) =>
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
          );
        });

        setConversations((prev) =>
          prev.map((c) => {
            const isMatch = isGroup
              ? (c.conversation_id === activePartner.id || c.partner_username === targetParam || c.partner_id === targetParam)
              : (c.partner_username?.toLowerCase() === activePartner.username?.toLowerCase());
            return isMatch
              ? { ...c, last_message: textToSend, last_message_at: new Date().toISOString() }
              : c;
          })
        );
      } else {
        throw new Error(res?.error || 'Send failed');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // Retain optimistic message in state marked as failed
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

      const isGroup = Boolean(
        activePartner.is_group ||
        activePartner.type === 'group' ||
        String(activePartner.username || '').startsWith('group-') ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          String(activePartner.id || activePartner.conversation_id || '').replace(/^(group-)+/i, '')
        )
      );

      let encEnvelope = { ciphertext: null, ivNonce: null, senderDeviceId: null };
      if (!isGroup) {
        try {
          encEnvelope = await e2eeService.encryptMessage(activePartner.id, textToSend);
        } catch (e2eeErr) {
          console.warn('E2EE pairwise encrypt skipped on retry:', e2eeErr);
        }
      }

      const targetParam = isGroup
        ? `group-${String(activePartner.conversation_id || activePartner.id || activePartner.username).replace(/^(group-)+/i, '')}`
        : (activePartner.username || activePartner.id);
      const res = await apiClient.post(`/messages/${targetParam}`, {
        content: encEnvelope.ciphertext ? '' : textToSend,
        ciphertext: encEnvelope.ciphertext || null,
        ivNonce: encEnvelope.ivNonce || null,
        senderDeviceId: encEnvelope.senderDeviceId || null,
        replyToId: failedMsg.reply_to_id || null
      });

      if (res.success && res.data?.message) {
        const realId = Number(res.data.message.id);
        newlySentMsgIdsRef.current.add(realId);
        setTimeout(() => {
          newlySentMsgIdsRef.current.delete(realId);
        }, 2500);

        setMessages((prev) => {
          const alreadyHasRealMsg = prev.some((m) => Number(m.id) === realId);
          if (alreadyHasRealMsg) {
            return prev.filter((m) => m.id !== retryId);
          }
          return prev.map((m) =>
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
          );
        });

        setConversations((prev) =>
          prev.map((c) => {
            const isMatch = isGroup
              ? (c.conversation_id === activePartner.id || c.partner_username === targetParam || c.partner_id === targetParam)
              : (c.partner_username?.toLowerCase() === activePartner.username?.toLowerCase());
            return isMatch
              ? { ...c, last_message: textToSend, last_message_at: new Date().toISOString() }
              : c;
          })
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
      let encEnvelope = { ciphertext: null, ivNonce: null, senderDeviceId: null };
      if (!activePartner.is_group) {
        try {
          encEnvelope = await e2eeService.encryptMessage(activePartner.id, payloadString);
        } catch (e2eeErr) {
          console.warn('E2EE photo encrypt notice:', e2eeErr);
        }
      }

      const targetParam = activePartner.is_group
        ? `group-${String(activePartner.conversation_id || activePartner.id || activePartner.username).replace(/^(group-)+/i, '')}`
        : (activePartner.username || activePartner.id);
      const res = await apiClient.post(`/messages/${targetParam}`, {
        content: payloadString,
        ciphertext: encEnvelope.ciphertext || null,
        ivNonce: encEnvelope.ivNonce || null,
        senderDeviceId: encEnvelope.senderDeviceId || null,
        replyToId: activeReply?.id || null
      });

      if (res.success && res.data?.message) {
        const newMsgId = Number(res.data.message.id);
        setMessages((prev) => {
          if (prev.some((m) => Number(m.id) === newMsgId)) return prev;
          return [
            ...prev,
            {
              ...res.data.message,
              content: payloadString,
              is_mine: true,
              is_encrypted: true,
              reply_to_message: activeReply
            }
          ];
        });
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
      let encEnvelope = { ciphertext: null, ivNonce: null, senderDeviceId: null };
      if (!activePartner.is_group) {
        try {
          encEnvelope = await e2eeService.encryptMessage(activePartner.id, payloadString);
        } catch (e2eeErr) {
          console.warn('E2EE file encrypt notice:', e2eeErr);
        }
      }

      const targetParam = activePartner.is_group
        ? `group-${String(activePartner.conversation_id || activePartner.id || activePartner.username).replace(/^(group-)+/i, '')}`
        : (activePartner.username || activePartner.id);
      const res = await apiClient.post(`/messages/${targetParam}`, {
        content: payloadString,
        ciphertext: encEnvelope.ciphertext || null,
        ivNonce: encEnvelope.ivNonce || null,
        senderDeviceId: encEnvelope.senderDeviceId || null,
        replyToId: activeReply?.id || null
      });

      if (res.success && res.data?.message) {
        const newMsgId = Number(res.data.message.id);
        setMessages((prev) => {
          if (prev.some((m) => Number(m.id) === newMsgId)) return prev;
          return [
            ...prev,
            {
              ...res.data.message,
              content: payloadString,
              is_mine: true,
              is_encrypted: true,
              reply_to_message: activeReply
            }
          ];
        });
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
        durationSeconds: Math.max(1, Math.round(durationSeconds || 0))
      };

      const payloadString = JSON.stringify(mediaPayload);

      // 3. Encrypt payload metadata inside E2EE envelope
      let encEnvelope = { ciphertext: null, ivNonce: null, senderDeviceId: null };
      if (!activePartner.is_group) {
        try {
          encEnvelope = await e2eeService.encryptMessage(activePartner.id, payloadString);
        } catch (e2eeErr) {
          console.warn('E2EE voice encrypt notice:', e2eeErr);
        }
      }

      const targetParam = activePartner.is_group
        ? `group-${String(activePartner.conversation_id || activePartner.id || activePartner.username).replace(/^(group-)+/i, '')}`
        : (activePartner.username || activePartner.id);
      const res = await apiClient.post(`/messages/${targetParam}`, {
        content: payloadString,
        ciphertext: encEnvelope.ciphertext || null,
        ivNonce: encEnvelope.ivNonce || null,
        senderDeviceId: encEnvelope.senderDeviceId || null,
        replyToId: activeReply?.id || null
      });

      if (res.success && res.data?.message) {
        const newMsgId = Number(res.data.message.id);
        setMessages((prev) => {
          if (prev.some((m) => Number(m.id) === newMsgId)) return prev;
          return [
            ...prev,
            {
              ...res.data.message,
              content: payloadString,
              is_mine: true,
              is_encrypted: true,
              reply_to_message: activeReply
            }
          ];
        });
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
  // 6b. VibeGrid Message Action Handlers (WhatsApp Classic Selection & Actions)
  // ==========================================================================
  const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
  const isMessageEditable = (msg) => {
    if (!msg || !msg.is_mine || msg.is_deleted || msg.message_type === 'call_log') return false;
    if (!msg.created_at) return true;
    const elapsed = Date.now() - new Date(msg.created_at).getTime();
    return !isNaN(elapsed) && elapsed <= FIFTEEN_MINUTES_MS;
  };

  const handleSelectMessageForAction = (msg) => {
    if (!msg || msg.is_deleted) return;
    if (typeof window !== 'undefined' && window.getSelection) {
      const sel = window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
    }
    justSelectedActionRef.current = Date.now();
    setIsActionBarMoreOpen(false);
    if (!selectedMessagesForActionRef.current || selectedMessagesForActionRef.current.length === 0) {
      pushModalHistory('message_action');
    }
    setSelectedMessagesForAction([msg]);
  };

  const handleToggleSelectMessageForAction = (msg) => {
    if (!msg || msg.is_deleted) return;
    if (typeof window !== 'undefined' && window.getSelection) {
      const sel = window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
    }
    justSelectedActionRef.current = Date.now();
    setIsActionBarMoreOpen(false);
    setSelectedMessagesForAction((prev) => {
      const exists = prev.some((m) => Number(m.id) === Number(msg.id));
      if (exists) {
        const next = prev.filter((m) => Number(m.id) !== Number(msg.id));
        if (next.length === 0) {
          if (typeof window !== 'undefined' && window.history && window.history.state?.modal === 'message_action') {
            window.history.back();
          }
        }
        return next;
      } else {
        if (prev.length === 0) {
          pushModalHistory('message_action');
        }
        return [...prev, msg];
      }
    });
  };

  const handleDeselectMessage = () => {
    setSelectedMessagesForAction([]);
    setIsActionBarMoreOpen(false);
    setShowExtendedReactions(false);
    if (typeof window !== 'undefined' && window.history && window.history.state?.modal === 'message_action') {
      window.history.back();
    }
  };

  const handleToggleStarSelected = () => {
    if (selectedMessagesForAction.length === 0) return;
    const msgs = [...selectedMessagesForAction];
    handleDeselectMessage();
    if (msgs.length === 1) {
      handleToggleStar(msgs[0]);
    } else {
      const allStarred = msgs.every((m) => m.is_starred);
      const targetStar = !allStarred;
      const ids = msgs.map((m) => Number(m.id));
      setMessages((prev) =>
        prev.map((m) => (ids.includes(Number(m.id)) ? { ...m, is_starred: targetStar } : m))
      );
      apiClient.post('/messages/bulk/star', { messageIds: ids, isStarred: targetStar }).catch((err) => {
        console.warn('Bulk star failed:', err);
      });
    }
  };

  const handleDeleteSelected = () => {
    const nonDeleted = selectedMessagesForAction.filter((m) => !m.is_deleted);
    if (nonDeleted.length === 0) return;
    if (nonDeleted.length === 1) {
      handlePromptDelete(nonDeleted[0]);
    } else {
      setDeleteModalTarget({
        message: { content: `${nonDeleted.length} messages` },
        isBulk: true,
        messages: nonDeleted
      });
    }
  };

  const isMessageDeletableForEveryone = (msg) => {
    if (!msg || !msg.is_mine || msg.is_deleted) return false;
    if (!msg.created_at) return true;
    const DELETE_LIMIT_MINUTES = 60;
    const msgTime = new Date(msg.created_at).getTime();
    const diffMinutes = (Date.now() - msgTime) / (1000 * 60);
    return diffMinutes <= DELETE_LIMIT_MINUTES;
  };

  const handleForwardSelected = () => {
    if (selectedMessagesForAction.length === 0) return;
    const msgs = [...selectedMessagesForAction];
    // Clear selection directly without window.history.back() race condition
    setSelectedMessagesForAction([]);
    setIsActionBarMoreOpen(false);
    if (msgs.length === 1) {
      handleStartForward(msgs[0]);
    } else {
      setForwardModalTarget({
        id: msgs.map((m) => Number(m.id)),
        isBulk: true,
        content: `${msgs.length} selected messages`
      });
      setForwardSelectedUsers([]);
      setForwardSearchQuery('');
    }
  };

  const handleShareSelected = async () => {
    if (selectedMessagesForAction.length === 0) return;
    const msgs = [...selectedMessagesForAction];
    handleDeselectMessage();

    const nonDeleted = msgs.filter((m) => !m.is_deleted);
    if (nonDeleted.length === 0) return;

    let shareTitle = nonDeleted.length === 1 ? 'Shared Message' : `${nonDeleted.length} Shared Messages`;
    let shareText = '';
    let shareUrl = '';

    if (nonDeleted.length === 1) {
      const single = nonDeleted[0];
      const media = parseMediaPayload(single.content);
      if (media && media.url) {
        shareText = media.caption || (media.name ? `Attachment: ${media.name}` : single.content) || '';
        shareUrl = media.url;
      } else {
        shareText = single.content || '';
      }
    } else {
      shareText = nonDeleted
        .map((m) => {
          const media = parseMediaPayload(m.content);
          if (media && media.url) {
            return `[Media: ${media.name || media.type || 'file'}] ${media.caption || ''}\n${media.url}`;
          }
          return m.content || '';
        })
        .filter(Boolean)
        .join('\n\n');
    }

    const shareData = {
      title: shareTitle,
      text: shareText
    };
    if (shareUrl) {
      shareData.url = shareUrl;
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') {
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(shareText || shareUrl || '');
            alert('Message content copied to clipboard.');
          }
        }
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(shareText || shareUrl || '');
      alert('Message content copied to clipboard for sharing.');
    } else {
      alert('Sharing is not supported on this browser.');
    }
  };

  const handleCopySelected = () => {
    if (selectedMessagesForAction.length === 0) return;
    const msgs = [...selectedMessagesForAction];
    handleDeselectMessage();
    const texts = msgs
      .map((m) => (m.is_deleted ? '' : m.content))
      .filter(Boolean);
    if (texts.length > 0 && navigator.clipboard) {
      navigator.clipboard.writeText(texts.join('\n\n')).catch(() => {});
    }
  };

  const handleContextMenu = (e, msg) => {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    if (!msg || msg.is_deleted) return;

    // If mobile long-press timer already triggered selection, ignore synthetic contextmenu event
    if (longPressFiredRef.current) return;
    if (Date.now() - justSelectedActionRef.current < 450) return;
    justSelectedActionRef.current = Date.now();

    if (selectedMessagesForActionRef.current && selectedMessagesForActionRef.current.length > 0) {
      handleToggleSelectMessageForAction(msg);
    } else {
      handleSelectMessageForAction(msg);
    }
  };

  const handleStartReply = (msg) => {
    setContextMenu(null);
    setEditingMessage(null);
    const cleanSender = msg.is_mine
      ? user?.username
      : (msg.sender_username && !msg.sender_username.startsWith('group-')
          ? msg.sender_username
          : (msg.sender_full_name || (activePartner?.is_group ? 'member' : String(activePartner?.username || '').replace(/^(group-)+/i, ''))));

    setReplyingTo({
      id: msg.id,
      sender_id: msg.sender_id,
      sender_username: cleanSender,
      content: msg.content,
      is_deleted: msg.is_deleted,
      is_mine: msg.is_mine
    });
  };

  const handleTouchStart = (e, msg) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressFiredRef.current = false;
    if (!msg || msg.is_deleted) return;

    // If multi-select is ALREADY active, don't set a long-press timer; single tap handles toggle directly
    if (selectedMessagesForActionRef.current && selectedMessagesForActionRef.current.length > 0) {
      return;
    }

    const touch = e.touches?.[0];
    if (!touch) return;

    // Deselect any active text range before long-press starts to prevent Android highlight handles
    if (typeof window !== 'undefined' && window.getSelection) {
      const sel = window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
    }

    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    swipeStateRef.current = {
      id: msg.id,
      startX: touch.clientX,
      startY: touch.clientY,
      isHorizontal: null,
      thresholdMet: false,
      msg
    };

    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressFiredRef.current = true;
      justSelectedActionRef.current = Date.now();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
      handleSelectMessageForAction(msg);
    }, 400);
  };

  const handleTouchMove = (e) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartPosRef.current.x;
    const deltaY = touch.clientY - touchStartPosRef.current.y;

    // Determine gesture direction
    if (swipeStateRef.current && swipeStateRef.current.isHorizontal === null) {
      if (Math.abs(deltaY) > 8 && Math.abs(deltaY) >= Math.abs(deltaX)) {
        swipeStateRef.current.isHorizontal = false;
      } else if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
        swipeStateRef.current.isHorizontal = true;
        // Cancel long press immediately on horizontal swipe
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
    }

    // Cancel long press and reset double-tap candidate on movement/scroll
    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
      lastTapMsgRef.current = { id: null, time: 0 };
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    // Rubber-band horizontal swipe for swipe-to-reply
    if (swipeStateRef.current?.isHorizontal && !isSelectionMode) {
      const isIncoming = !swipeStateRef.current.msg.is_mine;
      const directedDelta = isIncoming ? deltaX : -deltaX;
      if (directedDelta > 0) {
        const dampedOffset = Math.min(directedDelta * 0.55, 68);
        const isThresholdMet = dampedOffset >= 40;
        if (isThresholdMet && !swipeStateRef.current.thresholdMet) {
          swipeStateRef.current.thresholdMet = true;
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(20); } catch (_) {}
          }
        } else if (!isThresholdMet && swipeStateRef.current.thresholdMet) {
          swipeStateRef.current.thresholdMet = false;
        }
        setSwipingMessage({
          id: swipeStateRef.current.id,
          offset: isIncoming ? dampedOffset : -dampedOffset,
          rawOffset: dampedOffset,
          isThresholdMet
        });
      }
    }
  };

  const handleTouchEnd = (e, msg) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Handle swipe-to-reply release
    if (swipingMessage && swipingMessage.id === msg?.id) {
      if (swipingMessage.isThresholdMet && swipeStateRef.current?.msg && !msg.is_deleted) {
        handleStartReply(swipeStateRef.current.msg);
        justSwipedRef.current = Date.now();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(30); } catch (_) {}
        }
      }
      setSwipingMessage(null);
      swipeStateRef.current = null;
      return;
    }
    swipeStateRef.current = null;

    // Handle double-tap detection if tap wasn't a long-press or scroll
    if (!longPressFiredRef.current && msg && !msg.is_deleted && !isSelectionMode) {
      const now = Date.now();
      if (last.id && Number(last.id) === Number(msg.id) && (now - last.time) < 350) {
        // Double tap confirmed!
        lastTapMsgRef.current = { id: null, time: 0 };
        justDoubleTappedRef.current = Date.now();
        triggerHeartBurst(msg);
      } else {
        lastTapMsgRef.current = { id: msg.id, time: now };
      }
    }
  };

  const handleStartEdit = (msg) => {
    setContextMenu(null);
    setReplyingTo(null);
    if (!isMessageEditable(msg)) {
      alert('Messages can only be edited within 15 minutes of sending.');
      return;
    }
    setEditingMessage({ id: msg.id, content: msg.content, created_at: msg.created_at });
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
    if (!msg || msg.is_deleted) return;
    if (msg.is_mine) {
      setDeleteModalTarget({ message: msg });
    } else {
      handleDeleteMessage(msg, 'for_me');
    }
  };

  const handleDeleteMessage = async (msg, type = 'for_everyone') => {
    setContextMenu(null);
    setDeleteModalTarget(null);

    if (!msg || msg.is_deleted) return;

    // If message is a pending / sending / failed optimistic message with a local temp ID
    if (String(msg.id).startsWith('temp-') || msg.pending || msg.failed) {
      setMessages((prev) => prev.filter((m) => String(m.id) !== String(msg.id)));
      handleDeselectMessage();
      return;
    }

    if (type === 'for_everyone') {
      if (!msg.is_mine) {
        alert('You can only delete your own messages for everyone.');
        return;
      }
      if (!isMessageDeletableForEveryone(msg)) {
        alert('Messages can only be deleted for everyone within 60 minutes of sending.');
        return;
      }
    }

    try {
      const res = await apiClient.delete(`/messages/msg/${msg.id}?type=${type}`);
      if (res.success) {
        // Both for_everyone and for_me display "This message was deleted"
        setMessages((prev) =>
          prev.map((m) =>
            String(m.id) === String(msg.id)
              ? { ...m, is_deleted: true, content: 'This message was deleted', ciphertext: null, iv_nonce: null }
              : m
          )
        );
        // Clean up from pinned messages
        setPinnedMessages((prev) => prev.filter((pm) => String(pm.id) !== String(msg.id)));
        setPinnedMessage((prev) => (prev && String(prev.id) === String(msg.id) ? null : prev));
        handleDeselectMessage();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete message.');
    }
  };

  const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🙏'];
  const EXTENDED_REACTIONS = ['🔥', '👏', '🎉', '💯', '🚀', '✨', '👀', '⚡', '🥰', '🥺', '😎', '🤝'];

  // Toggle emoji reaction
  const handleToggleReaction = async (messageId, reaction) => {
    if (!messageId || !reaction) return;
    const targetMsg = messages.find((m) => Number(m.id) === Number(messageId));
    if (targetMsg && targetMsg.is_deleted) return;

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
      if (reaction === '❤️') {
        soundFx.play('like');
      } else {
        soundFx.play('reaction');
      }
    } catch {}

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

  // Phase 3: Double-tap / Double-click Heart Burst Delight
  const triggerHeartBurst = useCallback(
    (msg) => {
      if (!msg || msg.is_deleted) return;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([15, 30, 15]);
        } catch (_) {}
      }
      setBurstingHeartMsgId({ id: msg.id, key: Date.now() });
      setTimeout(() => {
        setBurstingHeartMsgId((curr) => (curr?.id === msg.id ? null : curr));
      }, 950);
      handleToggleReaction(msg.id, '❤️');
    },
    [handleToggleReaction]
  );

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
    if (!msg || msg.is_deleted) return;
    if (guardDemoAction('star')) return;
    const targetStarred = !msg.is_starred;

    // 1. Optimistic update in active messages stream
    setMessages((prev) =>
      prev.map((m) =>
        Number(m.id) === Number(msg.id) ? { ...m, is_starred: targetStarred } : m
      )
    );

    // 2. Synchronize starredMessages array (used by StarredMessagesModal)
    setStarredMessages((prev) => {
      if (targetStarred) {
        const alreadyExists = prev.some((sm) => Number(sm.id) === Number(msg.id));
        if (alreadyExists) return prev;
        const newItem = {
          ...msg,
          is_starred: true,
          starred_at: new Date().toISOString(),
          sender_username: msg.sender_username || (msg.is_mine ? user?.username : activePartner?.username),
          partner_username: activePartner?.username || msg.partner_username || 'chat'
        };
        return [newItem, ...prev];
      } else {
        return prev.filter((sm) => Number(sm.id) !== Number(msg.id));
      }
    });

    // 3. Local cache persistence
    try {
      const cacheKey = `vg_starred_${user?.id || 'guest'}`;
      const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      let updated;
      if (targetStarred) {
        const newItem = {
          ...msg,
          is_starred: true,
          starred_at: new Date().toISOString(),
          sender_username: msg.sender_username || (msg.is_mine ? user?.username : activePartner?.username),
          partner_username: activePartner?.username || msg.partner_username || 'chat'
        };
        updated = [newItem, ...cached.filter((x) => Number(x.id) !== Number(msg.id))];
      } else {
        updated = cached.filter((x) => Number(x.id) !== Number(msg.id));
      }
      localStorage.setItem(cacheKey, JSON.stringify(updated));
    } catch (_) {}

    // 4. Backend sync
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
      console.warn('Failed to star message on server:', err);
    }
  };

  // Open Starred Messages Modal
  const handleOpenStarredMessages = async () => {
    openStarredModal();
    setLoadingStarred(true);

    // Load local cache immediately for zero latency
    try {
      const cacheKey = `vg_starred_${user?.id || 'guest'}`;
      const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      if (cached.length > 0) {
        setStarredMessages(cached);
      }
    } catch (_) {}

    try {
      const res = await apiClient.get('/messages/starred');
      if (res.success && res.data?.starredMessages) {
        setStarredMessages(res.data.starredMessages);
        try {
          const cacheKey = `vg_starred_${user?.id || 'guest'}`;
          localStorage.setItem(cacheKey, JSON.stringify(res.data.starredMessages));
        } catch (_) {}
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
    if (!msg || msg.is_deleted) return;
    if (guardDemoAction('pin')) return;
    if (!activeConversationId) return;
    const cleanConvId = String(activeConversationId).replace(/^(group-)+/i, '').trim();
    const isCurrentlyPinned = pinnedMessages.some((pm) => Number(pm.id) === Number(msg.id)) || Number(pinnedMessage?.id) === Number(msg.id);

    try {
      const res = await apiClient.post(`/messages/conv/${cleanConvId}/pin`, {
        messageId: msg.id,
        isPinned: !isCurrentlyPinned
      });
      if (res.success && res.data) {
        setPinnedMessage(res.data.pinnedMessage || null);
        if (Array.isArray(res.data.pinnedMessages)) {
          setPinnedMessages(res.data.pinnedMessages);
        } else if (res.data.pinnedMessage) {
          setPinnedMessages([res.data.pinnedMessage]);
        } else {
          setPinnedMessages([]);
        }
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
    const msg = messages.find((m) => Number(m.id) === Number(messageId));
    if (msg && msg.is_deleted) return;
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
    const ids = Array.from(selectedMessageIds).filter(
      (id) => !messages.find((m) => Number(m.id) === Number(id))?.is_deleted
    );
    if (ids.length === 0) {
      handleCancelSelection();
      return;
    }
    try {
      const res = await apiClient.post('/messages/bulk/delete', { messageIds: ids, type });
      if (res.success) {
        setMessages((prev) =>
          prev.map((m) =>
            ids.includes(Number(m.id))
              ? { ...m, is_deleted: true, content: 'This message was deleted', ciphertext: null, iv_nonce: null }
              : m
          )
        );
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
        const cleanConvId = String(activeConversationId).replace(/^(group-)+/i, '').trim();
        await apiClient.put(`/conversations/${cleanConvId}/ephemeral`, {
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
    const rawConvId = target?.conversation_id || activeConversationId;
    if (!rawConvId) return;
    const convId = String(rawConvId).replace(/^(group-)+/i, '').trim();
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
    const rawConvId = targetConv?.conversation_id || activeConversationId;
    if (!rawConvId) return;
    const convId = String(rawConvId).replace(/^(group-)+/i, '').trim();
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
    const rawConvId = targetConv?.conversation_id || activeConversationId;
    if (!rawConvId) return;
    const convId = String(rawConvId).replace(/^(group-)+/i, '').trim();
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
    const rawConvId = target?.conversation_id || activeConversationId;
    if (!rawConvId) return;
    const convId = String(rawConvId).replace(/^(group-)+/i, '').trim();
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

  const selectConversation = (usernameOrIdentifier) => {
    if (!usernameOrIdentifier) return;
    const username = typeof usernameOrIdentifier === 'string' ? usernameOrIdentifier : usernameOrIdentifier.partner_username;
    if (!username) return;

    // Immediately clear messages to guarantee fresh view with zero old SMS leakage
    setMessages([]);
    setLoadingMessages(true);

    // Immediately activate partner metadata if object or available in conversations/local groups
    let targetPartner = typeof usernameOrIdentifier === 'object' && usernameOrIdentifier !== null ? usernameOrIdentifier : null;
    if (!targetPartner) {
      const cleanUsername = String(username).replace(/^(group-)+/i, '').trim().toLowerCase();
      targetPartner = conversations.find(
        (c) => {
          const cUser = (c.partner_username || '').toLowerCase();
          const cId = (c.partner_id || c.conversation_id || c.id || '').toString().toLowerCase().replace(/^(group-)+/i, '').trim();
          return cUser === username.toLowerCase() ||
                 cUser === cleanUsername ||
                 cUser === `group-${cleanUsername}` ||
                 cId === cleanUsername;
        }
      );
    }
    if (!targetPartner && username.startsWith('group-')) {
      try {
        const cacheKey = `vg_local_groups_${user?.id || 'guest'}`;
        const localGroups = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        const cleanUsername = String(username).replace(/^(group-)+/i, '').trim().toLowerCase();
        targetPartner = localGroups.find(
          (g) => {
            const gUser = (g.partner_username || '').toLowerCase();
            const gId = (g.partner_id || g.conversation_id || g.id || '').toString().toLowerCase().replace(/^(group-)+/i, '').trim();
            return gUser === username.toLowerCase() ||
                   gUser === cleanUsername ||
                   gId === cleanUsername;
          }
        );
      } catch (_) {}
    }

    if (targetPartner) {
      const isGroup = Boolean(targetPartner.is_group || targetPartner.type === 'group' || username.startsWith('group-'));
      const cleanTargetId = String(targetPartner.conversation_id || targetPartner.partner_id || targetPartner.id || username).replace(/^(group-)+/i, '').trim();
      setActivePartner({
        id: isGroup ? cleanTargetId : (targetPartner.partner_id || targetPartner.id || username),
        conversation_id: cleanTargetId,
        username: isGroup ? `group-${cleanTargetId}` : (targetPartner.partner_username || username),
        full_name: targetPartner.partner_full_name || targetPartner.group_title || targetPartner.title || (isGroup ? 'Group Chat' : `@${username}`),
        title: targetPartner.group_title || targetPartner.title || targetPartner.partner_full_name || (isGroup ? 'Group Chat' : `@${username}`),
        avatar_url: targetPartner.partner_avatar_url || (isGroup ? '/uploads/avatars/default-group.png' : '/uploads/avatars/default-avatar.png'),
        is_group: isGroup,
        member_count: targetPartner.member_count || (targetPartner.members ? targetPartner.members.length : 2),
        members: targetPartner.members || [],
        created_by: targetPartner.created_by,
        user_role: targetPartner.user_role || targetPartner.role,
        is_online: Boolean(targetPartner.is_online)
      });
      setActiveConversationId(cleanTargetId);
    }

    isInitialPartnerLoadRef.current = true;
    prevMessagesLengthRef.current = 0;
    if (typeof window !== 'undefined' && window.history) {
      if (window.history.state?.inChatWith !== username) {
        window.history.pushState({ tab: 'messages', inChatWith: username }, '');
      }
    }
    fetchMessagesForPartner(username, true);
    setConversations((prev) =>
      prev.map((c) =>
        (c.partner_username || '').toLowerCase() === (username || '').toLowerCase()
          ? { ...c, unread_count: 0 }
          : c
      )
    );
  };

  const startNewChat = (targetUser) => {
    isInitialPartnerLoadRef.current = true;
    prevMessagesLengthRef.current = 0;
    setIsNewChatModalOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    if (typeof window !== 'undefined' && window.history) {
      if (window.history.state?.inChatWith !== targetUser.username) {
        window.history.pushState({ tab: 'messages', inChatWith: targetUser.username }, '');
      }
    }
    fetchMessagesForPartner(targetUser.username, true);
  };

  const isCurrentPartnerOnline = Boolean(
    activePartner && (
      onlineUserIds.has(Number(activePartner.id)) ||
      Boolean(activePartner.is_online)
    )
  );

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

  // Redesigned filtered conversations list
  const filteredConversations = useMemo(() => {
    let list = conversations;

    // 1. Filter by selected tab
    if (inboxFilter === 'unread') {
      list = list.filter((c) => (c.unread_count || 0) > 0);
    } else if (inboxFilter === 'groups') {
      list = list.filter((c) => Boolean(c.is_group || c.type === 'group' || String(c.partner_username || '').startsWith('group-')));
    }

    // 2. Filter by search query
    if (inboxSearchQuery.trim()) {
      const q = inboxSearchQuery.toLowerCase().trim();
      list = list.filter((c) => {
        const isGroup = Boolean(c.is_group || c.type === 'group' || String(c.partner_username || '').startsWith('group-'));
        const displayName = isGroup ? (c.group_title || c.partner_full_name || 'Group Chat') : (c.partner_username || '');
        const lastMsg = c.last_message || '';
        return displayName.toLowerCase().includes(q) || lastMsg.toLowerCase().includes(q);
      });
    }

    return list;
  }, [conversations, inboxFilter, inboxSearchQuery]);

  // Dynamic counts for filter badges
  const totalConversationsCount = conversations.length;
  const unreadConversationsCount = useMemo(() => conversations.filter((c) => (c.unread_count || 0) > 0).length, [conversations]);
  const groupsConversationsCount = useMemo(
    () => conversations.filter((c) => Boolean(c.is_group || c.type === 'group' || String(c.partner_username || '').startsWith('group-'))).length,
    [conversations]
  );

  return (
    <div className="messages-page-wrapper">
      <div className={`messages-layout-container ${activePartner ? 'has-active-chat' : 'no-active-chat'}`}>
        {/* ================================================================== */}
        {/* 1. Left Pane: Conversations Inbox (Redesigned VibeGrid Direct)     */}
        {/* ================================================================== */}
        <aside className="messages-sidebar">
          {/* Header Area */}
          <div className="messages-sidebar-header-redesign">
            <div className="messages-sidebar-user-block">
              <h3 className="messages-sidebar-title">Direct</h3>
              <div className="messages-sidebar-user-tag">
                <span className="user-status-dot-active" />
                <span className="messages-header-sub">@{user?.username}</span>
              </div>
            </div>
            <button
              type="button"
              className="btn-new-message-gradient"
              onClick={openNewChatModal}
              title="New Message"
              aria-label="New Message"
            >
              <SquarePen size={16} className="new-msg-icon" />
              <span>New Message</span>
            </button>
          </div>

          {/* Quick Action Icons Row */}
          <div className="messages-quick-actions-row">
            <button
              type="button"
              className="btn-quick-action"
              onClick={openCallHistoryModal}
              title="Call History & Logs"
              aria-label="Call History"
            >
              <PhoneCall size={18} />
            </button>
            <button
              type="button"
              className="btn-quick-action"
              onClick={openCreateGroupModal}
              title="Create Encrypted Group"
              aria-label="Create Group"
            >
              <UserPlus size={18} />
            </button>
            <button
              type="button"
              className="btn-quick-action"
              onClick={handleOpenStarredMessages}
              title="Starred Messages"
              aria-label="Starred Messages"
            >
              <Star size={18} />
            </button>
            <button
              type="button"
              className="btn-quick-action"
              onClick={openKeyBackupModal}
              title="E2EE Keys Backup & Restore"
              aria-label="Key Backup"
            >
              <KeyRound size={18} />
            </button>
            <button
              type="button"
              className={`btn-quick-action ${isArchivedView ? 'active-archived' : ''}`}
              onClick={() => {
                const next = !isArchivedView;
                setIsArchivedView(next);
                fetchConversations(next);
              }}
              title={isArchivedView ? "View Active Inbox" : "View Archived Chats"}
              aria-label="Archived Chats"
            >
              {isArchivedView ? <ArchiveRestore size={18} /> : <Archive size={18} />}
            </button>
            <div className="quick-action-more-wrap">
              <button
                type="button"
                className={`btn-quick-action ${isSidebarMoreOpen ? 'active' : ''}`}
                onClick={() => setIsSidebarMoreOpen(!isSidebarMoreOpen)}
                title="More options"
                aria-label="More options"
              >
                <MoreHorizontal size={18} />
              </button>
              {isSidebarMoreOpen && (
                <div className="sidebar-more-dropdown">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSidebarMoreOpen(false);
                      const next = !isArchivedView;
                      setIsArchivedView(next);
                      fetchConversations(next);
                    }}
                  >
                    <Archive size={15} />
                    <span>{isArchivedView ? 'Active Inbox' : 'Archived Chats'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSidebarMoreOpen(false);
                      openKeyBackupModal();
                    }}
                  >
                    <KeyRound size={15} />
                    <span>Security & Keys</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSidebarMoreOpen(false);
                      fetchConversations(isArchivedView);
                    }}
                  >
                    <RotateCw size={15} />
                    <span>Refresh Inbox</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="messages-inbox-search-wrap">
            <div className="messages-inbox-search-bar">
              <Search size={16} className="search-icon-dim" />
              <input
                type="text"
                value={inboxSearchQuery}
                onChange={(e) => setInboxSearchQuery(e.target.value)}
                placeholder="Search chats, groups, people..."
                className="messages-inbox-search-input"
              />
              {inboxSearchQuery && (
                <button
                  type="button"
                  className="btn-clear-inbox-search"
                  onClick={() => setInboxSearchQuery('')}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills: All, Unread, Groups with dynamic counts */}
          <div className="messages-filter-tabs-row">
            <button
              type="button"
              className={`filter-pill-btn ${inboxFilter === 'all' ? 'active' : ''}`}
              onClick={() => setInboxFilter('all')}
            >
              <span>All</span>
              <span className="filter-count-badge">{totalConversationsCount}</span>
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${inboxFilter === 'unread' ? 'active' : ''}`}
              onClick={() => setInboxFilter('unread')}
            >
              <span>Unread</span>
              <span className="filter-count-badge">{unreadConversationsCount}</span>
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${inboxFilter === 'groups' ? 'active' : ''}`}
              onClick={() => setInboxFilter('groups')}
            >
              <span>Groups</span>
              <span className="filter-count-badge">{groupsConversationsCount}</span>
            </button>
          </div>

          {/* Scrollable Conversation Cards List */}
          <div className="messages-inbox-list custom-scrollbar">
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
            ) : filteredConversations.length === 0 ? (
              <div className="conversations-empty">
                <VibiEmptyState
                  pose="mail"
                  title={
                    inboxSearchQuery
                      ? 'No matches found'
                      : inboxFilter === 'unread'
                      ? 'No unread messages'
                      : inboxFilter === 'groups'
                      ? 'No group channels'
                      : isArchivedView
                      ? 'No archived conversations'
                      : 'No messages yet'
                  }
                  subtitle={
                    inboxSearchQuery
                      ? `No results found for "${inboxSearchQuery}"`
                      : isArchivedView
                      ? 'Chats you archive will appear here safely.'
                      : 'Connect with friends or start a group to chat!'
                  }
                  actionLabel={!isArchivedView && !inboxSearchQuery ? 'Send a Message' : undefined}
                  onAction={!isArchivedView && !inboxSearchQuery ? openNewChatModal : undefined}
                  className="vibi-empty-compact"
                />
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isGroup = Boolean(c.is_group || c.type === 'group' || String(c.partner_username || '').startsWith('group-'));
                const cConvClean = String(c.conversation_id || c.partner_id || c.id || '').replace(/^(group-)+/i, '').trim().toLowerCase();
                const activeConvClean = String(activeConversationId || activePartner?.conversation_id || activePartner?.id || '').replace(/^(group-)+/i, '').trim().toLowerCase();

                const isActive = activePartner && (
                  isGroup
                    ? (cConvClean && cConvClean === activeConvClean)
                    : (String(activePartner.username || '').toLowerCase() === String(c.partner_username || '').toLowerCase())
                );
                const hasUnread = c.unread_count > 0;
                const isOnline = !isGroup && onlineUserIds.has(Number(c.partner_id));
                const displayName = isGroup ? (c.group_title || c.partner_full_name || 'Group Chat') : `@${String(c.partner_username || '').replace(/^(group-)+/i, '')}`;
                const targetKey = isGroup
                  ? `group-${cConvClean}`
                  : (c.partner_username || c.partner_id);
                const memberCount = c.member_count || (c.members ? c.members.length : 3);
                const isDeletedSnippet = c.last_message_deleted || (typeof c.last_message === 'string' && c.last_message.toLowerCase().includes('message was deleted'));

                return (
                  <div
                    key={c.partner_id || c.conversation_id || c.id}
                    className={`conversation-card ${isActive ? 'active' : ''} ${hasUnread ? 'has-unread' : ''} ${isGroup ? 'group-conv-card' : ''}`}
                    onClick={() => selectConversation(targetKey)}
                    onContextMenu={(e) => handleConversationContextMenu(e, c)}
                  >
                    {/* Left: Avatar */}
                    <div className="conversation-avatar-wrap">
                      {isGroup ? (
                        <div className="group-card-avatar" title={displayName}>
                          <Users size={20} className="group-avatar-icon" />
                        </div>
                      ) : (
                        <img
                          src={c.partner_avatar_url || '/uploads/avatars/default-avatar.png'}
                          alt={c.partner_username}
                          className="conversation-avatar-img"
                        />
                      )}
                      {isOnline && <span className="conversation-online-indicator" title="Online" />}
                      {hasUnread && <span className="conversation-unread-dot" />}
                    </div>

                    {/* Middle: Content */}
                    <div className="conversation-meta">
                      <div className="conversation-name-row">
                        <span className="conversation-username">
                          {displayName}
                          {isGroup && (
                            <span className="group-members-pill">
                              <Users size={11} className="pill-users-icon" /> {memberCount}
                            </span>
                          )}
                          {c.is_pinned && (
                            <Pin size={11} className="conversation-pin-icon" fill="#818cf8" color="#818cf8" title="Pinned to top" />
                          )}
                        </span>
                        <div className="conversation-time-wrap">
                          {c.is_muted && (
                            <VolumeX size={12} className="conversation-mute-icon" title="Muted" />
                          )}
                          <span className="conversation-time">
                            {formatRelativeTime(c.last_message_at)}
                          </span>
                        </div>
                      </div>

                      <div className="conversation-preview-row">
                        {drafts[c.partner_username] ? (
                          <span className="conversation-snippet draft-snippet">
                            <span className="draft-tag">Draft: </span>
                            {drafts[c.partner_username]}
                          </span>
                        ) : isDeletedSnippet ? (
                          <span className="conversation-snippet deleted-snippet">
                            {c.last_sender_id === user?.id ? 'You: ' : ''}
                            <em>This message was deleted</em>
                          </span>
                        ) : (
                          <span className="conversation-snippet">
                            {c.last_sender_id === user?.id ? 'You: ' : ''}
                            {c.last_message || (isGroup ? 'Group created' : 'Encrypted message')}
                          </span>
                        )}

                        <div className="conversation-card-right-status">
                          {c.last_sender_id === user?.id && !hasUnread && (
                            <CheckCheck size={14} className="conversation-read-tick" />
                          )}
                          {hasUnread && (
                            <span className="conversation-badge">{c.unread_count}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Chevron */}
                    <ChevronRight size={18} className="conversation-chevron-icon" />
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
              {/* Chat Header / WhatsApp Classic Top Action Bar */}
              {selectedMessagesForAction.length > 0 ? (
                <div className="chat-header chat-top-action-bar" data-testid="chat-top-action-bar">
                  <div className="top-action-bar-left">
                    <button
                      type="button"
                      className="btn-action-bar-back"
                      onClick={handleDeselectMessage}
                      title="Deselect message"
                      aria-label="Deselect message"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <span className="action-bar-count">
                      <span className="count-num">{selectedMessagesForAction.length}</span>
                      <span className="count-label"> selected</span>
                    </span>
                  </div>

                  <div className="top-action-bar-right">
                    {/* Reply: only if exactly 1 message is selected and not deleted */}
                    {selectedMessagesForAction.length === 1 && !selectedMessagesForAction[0].is_deleted && (
                      <button
                        type="button"
                        className="btn-action-icon"
                        onClick={() => {
                          const msg = selectedMessagesForAction[0];
                          handleDeselectMessage();
                          handleStartReply(msg);
                        }}
                        title="Reply"
                        aria-label="Reply"
                      >
                        <Reply size={19} />
                      </button>
                    )}

                    {/* Star / Unstar: stars or unstars all selected messages */}
                    {selectedMessagesForAction.some((m) => !m.is_deleted) && (
                      <button
                        type="button"
                        className="btn-action-icon"
                        onClick={handleToggleStarSelected}
                        title={selectedMessagesForAction.every((m) => m.is_starred) ? 'Unstar' : 'Star'}
                        aria-label="Star"
                      >
                        <Star
                          size={19}
                          fill={selectedMessagesForAction.every((m) => m.is_starred) ? '#f59e0b' : 'none'}
                          color={selectedMessagesForAction.every((m) => m.is_starred) ? '#f59e0b' : 'currentColor'}
                        />
                      </button>
                    )}

                    {/* Delete: deletes 1 or all selected messages */}
                    {selectedMessagesForAction.some((m) => !m.is_deleted) && (
                      <button
                        type="button"
                        className="btn-action-icon btn-action-danger"
                        onClick={handleDeleteSelected}
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Trash2 size={19} />
                      </button>
                    )}

                    {/* Forward: forwards 1 or all selected messages */}
                    {selectedMessagesForAction.some((m) => !m.is_deleted) && (
                      <button
                        type="button"
                        className="btn-action-icon"
                        onClick={handleForwardSelected}
                        title="Forward"
                        aria-label="Forward"
                      >
                        <CornerUpRight size={19} />
                      </button>
                    )}

                    {/* Share: shares 1 or all selected messages natively or copies */}
                    {selectedMessagesForAction.some((m) => !m.is_deleted) && (
                      <button
                        type="button"
                        className="btn-action-icon"
                        onClick={handleShareSelected}
                        title="Share"
                        aria-label="Share"
                      >
                        <Share2 size={19} />
                      </button>
                    )}

                    {/* Copy text: copies 1 or all selected messages */}
                    {selectedMessagesForAction.some((m) => !m.is_deleted && m.content) && (
                      <button
                        type="button"
                        className="btn-action-icon"
                        onClick={handleCopySelected}
                        title="Copy text"
                        aria-label="Copy text"
                      >
                        <Copy size={19} />
                      </button>
                    )}

                    {/* More actions dropdown (Pin, Edit, Info, Select all) */}
                    <div className="action-bar-more-wrap">
                      <button
                        type="button"
                        className="btn-action-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsActionBarMoreOpen((prev) => !prev);
                        }}
                        title="More options"
                        aria-label="More options"
                      >
                        <MoreVertical size={19} />
                      </button>

                      {isActionBarMoreOpen && (
                        <>
                          <div
                            className="action-bar-more-backdrop"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsActionBarMoreOpen(false);
                            }}
                          />
                          <div className="action-bar-more-dropdown" onClick={(e) => e.stopPropagation()}>
                            {selectedMessagesForAction.some((m) => !m.is_deleted && m.content) && (
                              <button
                                type="button"
                                className="action-bar-dropdown-item"
                                onClick={() => {
                                  setIsActionBarMoreOpen(false);
                                  handleCopySelected();
                                }}
                              >
                                <Copy size={15} /> Copy
                              </button>
                            )}
                            {selectedMessagesForAction.some((m) => !m.is_deleted) && (
                              <button
                                type="button"
                                className="action-bar-dropdown-item"
                                onClick={() => {
                                  setIsActionBarMoreOpen(false);
                                  handleShareSelected();
                                }}
                              >
                                <Share2 size={15} /> Share
                              </button>
                            )}
                            {selectedMessagesForAction.length === 1 && !selectedMessagesForAction[0].is_deleted && (
                              <button
                                type="button"
                                className="action-bar-dropdown-item"
                                onClick={() => {
                                  const msg = selectedMessagesForAction[0];
                                  handleDeselectMessage();
                                  handleTogglePin(msg);
                                }}
                              >
                                <Pin size={15} /> {(pinnedMessages.some((pm) => Number(pm.id) === Number(selectedMessagesForAction[0].id)) || pinnedMessage?.id === selectedMessagesForAction[0].id) ? 'Unpin' : 'Pin'}
                              </button>
                            )}
                            {selectedMessagesForAction.length === 1 && isMessageEditable(selectedMessagesForAction[0]) && (
                              <button
                                type="button"
                                className="action-bar-dropdown-item"
                                onClick={() => {
                                  const msg = selectedMessagesForAction[0];
                                  handleDeselectMessage();
                                  handleStartEdit(msg);
                                }}
                              >
                                <Edit2 size={15} /> Edit
                              </button>
                            )}
                            {selectedMessagesForAction.length === 1 && selectedMessagesForAction[0].is_mine && !selectedMessagesForAction[0].is_deleted && (
                              <button
                                type="button"
                                className="action-bar-dropdown-item"
                                onClick={() => {
                                  const msg = selectedMessagesForAction[0];
                                  handleDeselectMessage();
                                  handleOpenMessageInfo(msg);
                                }}
                              >
                                <Info size={15} /> Message Info
                              </button>
                            )}
                            <button
                              type="button"
                              className="action-bar-dropdown-item"
                              onClick={() => {
                                setIsActionBarMoreOpen(false);
                                setSelectedMessagesForAction(messages.filter((m) => !m.is_deleted));
                              }}
                            >
                              <CheckSquare size={15} /> Select all
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="chat-header">
                <button
                  type="button"
                  className="btn-chat-back-mobile"
                  onClick={() => navigationService.goBack(() => setActivePartner(null))}
                  title="Back to conversations"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={20} />
                </button>
                <div
                  className="chat-header-user"
                  onClick={() => {
                    if (activePartner?.is_group) {
                      openGroupDetailsModal();
                    } else if (onNavigateToProfile) {
                      onNavigateToProfile(activePartner.username);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="chat-header-avatar-wrap">
                    {activePartner?.is_group ? (
                      <div className="group-avatar-icon-wrap header-group-avatar">
                        <Users size={22} className="group-avatar-icon" />
                      </div>
                    ) : (
                      <img
                        src={activePartner.avatar_url || '/uploads/avatars/default-avatar.png'}
                        alt={activePartner.username}
                        className="chat-header-avatar"
                      />
                    )}
                    {!activePartner?.is_group && isCurrentPartnerOnline && (
                      <span className="header-online-indicator" title="Online" />
                    )}
                  </div>

                  <div className="chat-header-names">
                    <div className="chat-header-title-row">
                      <span className="chat-header-username">
                        {activePartner?.is_group ? (activePartner.title || activePartner.full_name || 'Group Chat') : `@${activePartner.username}`}
                      </span>
                      <button
                        type="button"
                        className={`btn-safety-badge ${isPeerVerified ? 'verified' : 'unverified'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activePartner?.is_group) {
                            openGroupDetailsModal();
                          } else {
                            openSafetyModal();
                          }
                        }}
                        title={activePartner?.is_group ? 'Multi-Party Encrypted Group (Click for details)' : isPeerVerified ? 'Cryptographic Identity Verified' : 'Click to verify Safety Number'}
                      >
                        {activePartner?.is_group ? (
                          <>
                            <ShieldCheck size={13} className="safety-badge-icon" />
                            <span className="safety-badge-text">Group E2EE</span>
                          </>
                        ) : isPeerVerified ? (
                          <>
                            <ShieldCheck size={13} className="safety-badge-icon" />
                            <span className="safety-badge-text">Verified</span>
                          </>
                        ) : (
                          <>
                            <Shield size={13} className="safety-badge-icon" />
                            <span className="safety-badge-text">E2EE</span>
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
                        <span className="typing-sub-label">
                          {partnerTypingName || (activePartner?.is_group ? 'Someone' : (activePartner.full_name || `@${String(activePartner.username || '').replace(/^(group-)+/i, '')}`))} is typing...
                        </span>
                      ) : activePartner?.is_group ? (
                        <span className="group-members-sub">
                          {activePartner.members && activePartner.members.length > 0
                            ? `${activePartner.members.length} members: ` + activePartner.members.map((m) => `@${String(m.username || '').replace(/^(group-)+/i, '')}`).join(', ')
                            : `${activePartner.member_count || 2} members`}
                        </span>
                      ) : isCurrentPartnerOnline ? (
                        <span className="online-sub-label">
                          <span className="online-dot-pulse" /> Online
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
                  <div className="ephemeral-menu-wrap desktop-action-only">
                    <button
                      type="button"
                      className={`btn-chat-action ${ephemeralTimer ? 'active-timer' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEphemeralMenuOpen((prev) => !prev);
                      }}
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
                    className={`btn-chat-action desktop-action-only ${isSearchInChatOpen ? 'active-search' : ''}`}
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
                    className="btn-chat-action btn-profile-action desktop-action-only"
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsConvMenuOpen((prev) => !prev);
                      }}
                      title="Conversation Options"
                      aria-label="Conversation Options"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {isConvMenuOpen && (
                      <div
                        className="conv-dropdown-menu"
                        onClick={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                      >
                        {activePartner?.is_group ? (
                          <>
                            <button
                              type="button"
                              className="conv-dropdown-item"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsConvMenuOpen(false);
                                openGroupDetailsModal('overview');
                              }}
                            >
                              <Users size={16} />
                              <span>Group Info & Members</span>
                            </button>

                            <button
                              type="button"
                              className="conv-dropdown-item"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
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
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsConvMenuOpen(false);
                                handleTogglePinConv();
                              }}
                            >
                              {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                              <span>{isPinned ? 'Unpin Conversation' : 'Pin to Top'}</span>
                            </button>

                            <div className="conv-dropdown-divider" />

                            <button
                              type="button"
                              className="conv-dropdown-item text-danger"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
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
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsConvMenuOpen(false);
                                openGroupDetailsModal('overview', 'leave');
                              }}
                            >
                              <LogOut size={16} />
                              <span>Leave / Manage Group</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="conv-dropdown-item"
                              onClick={() => {
                                setIsConvMenuOpen(false);
                                initiateAudioCall();
                              }}
                            >
                              <Phone size={16} />
                              <span>Voice Call</span>
                            </button>

                        <button
                          type="button"
                          className="conv-dropdown-item"
                          onClick={() => {
                            setIsConvMenuOpen(false);
                            initiateVideoCall();
                          }}
                        >
                          <Video size={16} />
                          <span>Video Call</span>
                        </button>

                        <div className="conv-dropdown-divider" />

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
                          className="conv-dropdown-item mobile-only-action"
                          onClick={() => {
                            setIsConvMenuOpen(false);
                            setIsSearchInChatOpen((prev) => !prev);
                          }}
                        >
                          <Search size={16} />
                          <span>Search in Chat</span>
                        </button>

                        <button
                          type="button"
                          className="conv-dropdown-item mobile-only-action"
                          onClick={() => {
                            setIsConvMenuOpen(false);
                            if (onNavigateToProfile) onNavigateToProfile(activePartner.username);
                          }}
                        >
                          <UserIcon size={16} />
                          <span>View Profile</span>
                        </button>

                        <button
                          type="button"
                          className="conv-dropdown-item"
                          onClick={() => {
                            setIsConvMenuOpen(false);
                            openSafetyModal();
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
                      </>
                    )}
                  </div>
                    )}
                  </div>
                </div>
              </div>
            )}

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

              {/* Pinned Message Header Banner (Multiple Pins Supported) */}
              {(pinnedMessages.length > 0 || pinnedMessage) && (() => {
                const effectiveList = pinnedMessages.length > 0 ? pinnedMessages : (pinnedMessage ? [pinnedMessage] : []);
                const count = effectiveList.length;
                const currentPin = effectiveList[activePinIndex % count] || effectiveList[0];
                if (!currentPin) return null;

                return (
                  <div
                    className="pinned-message-banner"
                    onClick={() => {
                      scrollToMessage(currentPin.id);
                      if (count > 1) {
                        setActivePinIndex((prev) => (prev + 1) % count);
                      }
                    }}
                    title={count > 1 ? `Click to jump to next pinned message (${((activePinIndex % count) + 1)}/${count})` : "Click to jump to pinned message"}
                  >
                    <div className="pinned-banner-content">
                      <Pin size={14} className="pinned-banner-icon" />
                      <div className="pinned-banner-text">
                        <span className="pinned-banner-label">
                          Pinned Message {count > 1 ? `(${((activePinIndex % count) + 1)}/${count})` : ''} {currentPin.sender_username && `· @${String(currentPin.sender_username).replace(/^(group-)+/i, '')}`}
                        </span>
                        <p className="pinned-banner-snippet">
                          {currentPin.content?.slice(0, 90) || '…'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="pinned-banner-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(currentPin);
                      }}
                      title="Unpin this message"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })()}

              {/* Chat Message Stream */}
              <div
                className="chat-stream"
                ref={chatStreamRef}
                onScroll={handleChatStreamScroll}
                onClick={(e) => {
                  if (longPressFiredRef.current) {
                    longPressFiredRef.current = false;
                    return;
                  }
                  if (Date.now() - justSelectedActionRef.current < 450) return;
                  if (selectedMessagesForAction.length > 0 && !e.target.closest('.message-bubble-row') && !e.target.closest('.vg-wa-floating-reactions')) {
                    handleDeselectMessage();
                  }
                }}
              >
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
                    {messages.length === 0 ? (
                      <VibiEmptyState
                        pose="wave"
                        title={activePartner?.is_group
                          ? `Welcome to ${activePartner.title || activePartner.full_name || 'Group Chat'}! 👥`
                          : (activePartner ? `Say hi to @${String(activePartner.username || '').replace(/^(group-)+/i, '')}! 👋` : 'Say hi! 👋')}
                        subtitle={activePartner?.is_group
                          ? `${activePartner.member_count || 2} members are here. Start the discussion!`
                          : "End-to-end encrypted session established. Break the ice with a friendly wave!"}
                        actionLabel="Wave Hello 👋"
                        onAction={() => {
                          setMessageInput(activePartner?.is_group ? '👋 Hey everyone!' : '👋 Hey there!');
                          if (chatInputRef.current) chatInputRef.current.focus();
                        }}
                      />
                    ) : (
                      <VibiEmptyState
                        pose="magnifier"
                        title="No messages found"
                        subtitle="Try clearing your search query or media filter."
                      />
                    )}
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

                    const isNewlySent = m.pending || newlySentMsgIdsRef.current.has(m.id) || newlySentMsgIdsRef.current.has(Number(m.id));

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
                          className={`message-bubble-row ${m.is_mine ? 'outgoing' : 'incoming'} ${isSelectionMode ? 'selection-mode' : ''} ${selectedMessageIds.has(Number(m.id)) ? 'is-selected' : ''} ${selectedActionMsgIds.has(Number(m.id)) ? 'is-action-selected' : ''} ${isNewlySent ? 'vibe-msg-send-spring' : ''}`}
                          onClick={(e) => {
                            if (isSelectionMode) {
                              if (!m.is_deleted) handleToggleMessageSelection(m.id);
                            } else if (m.is_deleted) {
                              if (selectedMessagesForAction.length > 0) {
                                e.stopPropagation();
                                handleDeselectMessage();
                              }
                              return;
                            } else if (longPressFiredRef.current) {
                              longPressFiredRef.current = false;
                              e.stopPropagation();
                              return;
                            } else if (Date.now() - justSelectedActionRef.current < 450 || Date.now() - justDoubleTappedRef.current < 450 || Date.now() - justSwipedRef.current < 450) {
                              e.stopPropagation();
                              return;
                            } else if (selectedMessagesForAction.length > 0) {
                              e.stopPropagation();
                              handleToggleSelectMessageForAction(m);
                            }
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (!m.is_deleted && !isSelectionMode) {
                              triggerHeartBurst(m);
                            }
                          }}
                          onContextMenu={(e) => {
                            if (m.is_deleted) {
                              e.preventDefault();
                              e.stopPropagation();
                              return;
                            }
                            if (isSelectionMode) {
                              e.preventDefault();
                              handleToggleMessageSelection(m.id);
                            } else {
                              handleContextMenu(e, m);
                            }
                          }}
                          onTouchStart={(e) => {
                            if (m.is_deleted) return;
                            if (!isSelectionMode) handleTouchStart(e, m);
                          }}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={(e) => handleTouchEnd(e, m)}
                          onTouchCancel={(e) => handleTouchEnd(e, m)}
                        >
                          {/* Swipe to Reply Cue */}
                          {swipingMessage?.id === m.id && swipingMessage.rawOffset > 8 && (
                            <div
                              className={`vibe-swipe-reply-cue ${m.is_mine ? 'outgoing-cue' : 'incoming-cue'} ${swipingMessage.isThresholdMet ? 'threshold-met' : ''}`}
                              style={{
                                opacity: Math.min(swipingMessage.rawOffset / 25, 1),
                                transform: `translateY(-50%) scale(${Math.min(0.6 + swipingMessage.rawOffset / 60, 1.15)})`
                              }}
                              aria-hidden="true"
                              data-testid="swipe-reply-cue"
                            >
                              <CornerUpLeft size={16} />
                            </div>
                          )}

                          {/* Selection Checkbox in Multi-Select Mode */}
                          {isSelectionMode && (
                            <div className={`message-select-checkbox ${selectedMessageIds.has(Number(m.id)) ? 'checked' : ''}`}>
                              {selectedMessageIds.has(Number(m.id)) && '✓'}
                            </div>
                          )}

                          <div
                            className={`message-bubble ${mediaPayload ? 'has-media' : ''} ${m.is_deleted ? 'deleted-bubble' : ''} ${selectedActionMsgIds.has(Number(m.id)) ? 'is-highlighted-bubble' : ''}`}
                            style={
                              swipingMessage?.id === m.id
                                ? { transform: `translateX(${swipingMessage.offset}px)`, transition: 'none' }
                                : undefined
                            }
                          >
                            {/* Floating 3D Heart Burst Overlay */}
                            {burstingHeartMsgId?.id === m.id && (
                              <div className="vibe-heart-burst-overlay" aria-hidden="true" data-testid="heart-burst-overlay">
                                <span className="vibe-heart-burst-main">❤️</span>
                                <span className="vibe-heart-particle p1" />
                                <span className="vibe-heart-particle p2" />
                                <span className="vibe-heart-particle p3" />
                                <span className="vibe-heart-particle p4" />
                                <span className="vibe-heart-particle p5" />
                                <span className="vibe-heart-particle p6" />
                              </div>
                            )}
                            {/* Phase 4 Option 1: Dynamic Magnifier & Full Picker Pill */}
                            {selectedMessagesForAction.length === 1 && Number(selectedMessagesForAction[0].id) === Number(m.id) && !m.is_deleted && (
                              <div
                                className={`vg-wa-floating-reactions ${showExtendedReactions ? 'extended-open' : ''}`}
                                onClick={(e) => e.stopPropagation()}
                                data-testid="wa-floating-reactions"
                              >
                                <div className="vg-reactions-main-row">
                                  {QUICK_REACTIONS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      className="vg-wa-react-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (typeof navigator !== 'undefined' && navigator.vibrate) {
                                          try { navigator.vibrate([15, 25]); } catch (_) {}
                                        }
                                        handleToggleReaction(m.id, emoji);
                                        handleDeselectMessage();
                                        setShowExtendedReactions(false);
                                      }}
                                      title={`React ${emoji}`}
                                      aria-label={`React ${emoji}`}
                                    >
                                      {emoji}
                                    </button>
                                  ))}

                                  {/* Plus Button to toggle Extended Emoji Drawer */}
                                  <button
                                    type="button"
                                    className={`vg-wa-more-btn ${showExtendedReactions ? 'is-active' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowExtendedReactions((prev) => !prev);
                                      if (typeof navigator !== 'undefined' && navigator.vibrate) {
                                        try { navigator.vibrate(15); } catch (_) {}
                                      }
                                    }}
                                    title={showExtendedReactions ? 'Show fewer' : 'More reactions'}
                                    aria-label={showExtendedReactions ? 'Show fewer' : 'More reactions'}
                                    data-testid="reaction-more-btn"
                                  >
                                    <Plus size={16} className={`vg-plus-icon ${showExtendedReactions ? 'rotated' : ''}`} />
                                  </button>
                                </div>

                                {showExtendedReactions && (
                                  <div className="vg-reactions-extended-grid" data-testid="reactions-extended-grid">
                                    {EXTENDED_REACTIONS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        className="vg-wa-react-btn extended-btn"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (typeof navigator !== 'undefined' && navigator.vibrate) {
                                            try { navigator.vibrate([15, 25]); } catch (_) {}
                                          }
                                          handleToggleReaction(m.id, emoji);
                                          handleDeselectMessage();
                                          setShowExtendedReactions(false);
                                        }}
                                        title={`React ${emoji}`}
                                        aria-label={`React ${emoji}`}
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Group sender author tag */}
                            {Boolean(activePartner?.is_group) && !m.is_mine && !m.is_deleted && (
                              <div className="group-sender-tag">
                                @{String(m.sender_username || m.sender_full_name || 'member').replace(/^(group-)+/i, '')}
                              </div>
                            )}

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
                                    ? `@${String(m.reply_to_message.sender_username).replace(/^(group-)+/i, '')}`
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
                              {(pinnedMessages.some((pm) => Number(pm.id) === Number(m.id)) || pinnedMessage?.id === m.id) && (
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
                                  className={`message-receipt-tick ${m.is_read ? 'receipt-read-flip' : ''}`}
                                  title={m.is_read ? 'Read' : m.delivered_at ? 'Delivered' : 'Sent'}
                                  aria-label={m.is_read ? 'Read receipt: Read' : m.delivered_at ? 'Read receipt: Delivered' : 'Read receipt: Sent'}
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
                              {m.reactions && m.reactions.length > 0 && !m.is_deleted && (
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

                            {/* Hover Quick Action Bar */}
                            {!m.is_deleted && !isSelectionMode && (
                              <div
                                className={`msg-quick-action-bar ${m.is_mine ? 'outgoing-actions' : 'incoming-actions'}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className={`msg-quick-action-btn msg-star-btn ${m.is_starred ? 'is-starred' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleStar(m);
                                  }}
                                  title={m.is_starred ? 'Unstar message' : 'Star message'}
                                  aria-label={m.is_starred ? 'Unstar message' : 'Star message'}
                                >
                                  <Star
                                    size={13}
                                    fill={m.is_starred ? '#f59e0b' : 'none'}
                                    color={m.is_starred ? '#f59e0b' : 'currentColor'}
                                  />
                                </button>
                                <button
                                  type="button"
                                  className="msg-quick-action-btn msg-react-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectMessageForAction(m);
                                  }}
                                  title="React"
                                  aria-label="React"
                                >
                                  <Smile size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="msg-quick-action-btn msg-reply-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartReply(m);
                                  }}
                                  title="Reply"
                                  aria-label="Reply"
                                >
                                  <Reply size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="msg-quick-action-btn msg-more-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectMessageForAction(m);
                                  }}
                                  title="More options"
                                  aria-label="More options"
                                >
                                  <MoreVertical size={13} />
                                </button>
                              </div>
                            )}
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

                <div ref={messagesEndRef} className="chat-stream-bottom-anchor" />
              </div>

              {/* WhatsApp-Style Floating Scroll-to-Bottom Button */}
              {showScrollBottomBtn && (
                <button
                  type="button"
                  className="btn-scroll-bottom-floating"
                  onClick={() => {
                    scrollToBottom(true);
                    setShowScrollBottomBtn(false);
                    setNewMessagesWhileScrolledUp(0);
                  }}
                  title="Scroll to latest messages"
                  aria-label="Scroll to bottom"
                  data-testid="scroll-to-bottom-btn"
                >
                  <ChevronDown size={20} />
                  {newMessagesWhileScrolledUp > 0 && (
                    <span className="scroll-bottom-badge">
                      {newMessagesWhileScrolledUp}
                    </span>
                  )}
                </button>
              )}

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
                              {replyingTo.is_mine
                                ? 'Replying to yourself'
                                : `Replying to @${String(replyingTo.sender_username || 'member').replace(/^(group-)+/i, '')}`}
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
                            ? `You blocked @${String(activePartner.username || '').replace(/^(group-)+/i, '')}. Unblock to send messages.`
                            : `You cannot send messages to @${String(activePartner.username || '').replace(/^(group-)+/i, '')}.`}
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

                        {/* Section 1: The Main Input Capsule */}
                        <div className={`chat-input-pill ${isInputFocused || messageInput.trim() ? 'is-typing' : ''}`}>
                          {/* Left-side action symbols: Hidden when typing/focused to maximize space */}
                          {(!isInputFocused && !messageInput.trim()) || showMediaWhenTyping ? (
                            <div className="composer-left-actions">
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

                              {showMediaWhenTyping && (
                                <button
                                  type="button"
                                  className="btn-composer-icon btn-collapse-media"
                                  onClick={() => setShowMediaWhenTyping(false)}
                                  title="Hide media actions"
                                  aria-label="Hide media actions"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn-composer-icon btn-expand-media"
                              onClick={() => setShowMediaWhenTyping(true)}
                              title="Add media"
                              aria-label="Add media"
                            >
                              <Plus size={18} />
                            </button>
                          )}

                          <textarea
                            ref={chatInputRef}
                            rows={1}
                            placeholder={
                              uploadingMedia
                                ? "Encrypting..."
                                : (activePartner.is_group
                                    ? `Message ${activePartner.title || activePartner.full_name || 'group'}...`
                                    : `Message @${String(activePartner.username || '').replace(/^(group-)+/i, '')}...`)
                            }
                            value={messageInput}
                            onFocus={() => {
                              setIsInputFocused(true);
                              setTimeout(() => scrollToBottom(true), 120);
                              setTimeout(() => scrollToBottom(true), 320);
                            }}
                            onBlur={() => {
                              if (!messageInput.trim()) {
                                setIsInputFocused(false);
                                setShowMediaWhenTyping(false);
                              }
                            }}
                            onInput={adjustChatInputHeight}
                            onChange={handleInputChange}
                            onKeyDown={handleInputKeyDown}
                            className="chat-input-field"
                            maxLength={5000}
                            disabled={uploadingMedia}
                            aria-label={
                              activePartner.is_group
                                ? `Message ${activePartner.title || activePartner.full_name || 'group'}`
                                : `Message @${String(activePartner.username || '').replace(/^(group-)+/i, '')}`
                            }
                          />
                        </div>

                        {/* Section 2: Dedicated Separate Send Button Section with ONLY the Symbol */}
                        <div className="chat-send-section">
                          <button
                            type="submit"
                            className={`btn-chat-send-circle ${messageInput.trim() ? 'active' : ''}`}
                            disabled={!messageInput.trim() || sending || uploadingMedia}
                            title="Send message"
                            aria-label="Send message"
                          >
                            <Send size={18} className="send-icon-svg" />
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="chat-no-selection">
              <VibiEmptyState
                pose="mail"
                title="Your Direct Messages"
                subtitle="End-to-end encrypted messaging, voice notes, photos, and video calling on VibeGrid."
                actionLabel="Start a New Chat"
                onAction={openNewChatModal}
              />
            </div>
          )}
        </section>
      </div>

      {/* Safety Number Verification Modal */}
      <SafetyNumberModal
        isOpen={isSafetyModalOpen}
        onClose={closeSafetyModal}
        peerUser={activePartner}
        myUserId={user?.id}
        onVerificationChanged={(verified) => setIsPeerVerified(verified)}
      />

      {/* New Message Search Modal */}
      {isNewChatModalOpen && (
        <div className="modal-backdrop" onClick={closeNewChatModal}>
          <div className="modal-card new-chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Message</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closeNewChatModal}
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
        onClose={closeCreateGroupModal}
        onGroupCreated={(group) => {
          fetchConversations();
          if (group) {
            selectConversation(group);
          }
        }}
      />

      {/* Group Details / Settings Modal */}
      <GroupDetailsModal
        isOpen={isGroupDetailsOpen}
        onClose={closeGroupDetailsModal}
        onRegisterBackHandler={(handler) => {
          groupSettingsBackHandlerRef.current = handler;
        }}
        group={activePartner}
        conversationId={activeConversationId || (activePartner?.conversation_id || activePartner?.id)}
        initialScreen={groupDetailsInitialScreen}
        initialAction={groupDetailsInitialAction}
        pinnedMessages={pinnedMessages}
        onGroupUpdated={(updatedGroup) => {
          setActivePartner((prev) => (prev ? { ...prev, ...updatedGroup } : prev));
          fetchConversations();
        }}
        onGroupDeleted={(gId) => {
          handleGroupDeletedOrLeft(gId);
        }}
        onGroupLeft={(gId) => {
          handleGroupDeletedOrLeft(gId);
        }}
      />

      {/* Call History Modal */}
      <CallHistoryModal
        isOpen={isCallHistoryOpen}
        onClose={closeCallHistoryModal}
      />

      {/* Key Backup Modal */}
      <KeyBackupModal
        isOpen={isKeyBackupOpen}
        onClose={closeKeyBackupModal}
      />

      {/* Delete Confirmation Modal */}
      {deleteModalTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteModalTarget(null)}>
          <div className="modal-card vg-delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete {deleteModalTarget.isBulk ? `${deleteModalTarget.messages.length} Messages` : 'Message'}</h3>
            <p className="vg-delete-preview">
              {deleteModalTarget.isBulk
                ? `Are you sure you want to delete ${deleteModalTarget.messages.length} selected messages?`
                : (deleteModalTarget.message?.content?.slice(0, 80) || '(media)')}
            </p>
            <div className="vg-delete-actions">
              {(() => {
                const targetMsgs = deleteModalTarget.isBulk
                  ? deleteModalTarget.messages
                  : (deleteModalTarget.message ? [deleteModalTarget.message] : []);
                const myMsgs = targetMsgs.filter((m) => m.is_mine);
                const hasMyMsgs = myMsgs.length > 0;
                const allEligible = hasMyMsgs && myMsgs.every((m) => isMessageDeletableForEveryone(m));
                const hasExpired = hasMyMsgs && !allEligible;

                return (
                  <>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        if (deleteModalTarget.isBulk) {
                          const localMsgs = deleteModalTarget.messages.filter(
                            (m) => String(m.id).startsWith('temp-') || m.pending || m.failed
                          );
                          const serverMsgs = deleteModalTarget.messages.filter(
                            (m) => !String(m.id).startsWith('temp-') && !m.pending && !m.failed
                          );
                          const localIds = localMsgs.map((m) => String(m.id));
                          const serverIds = serverMsgs.map((m) => Number(m.id));

                          if (localIds.length > 0) {
                            setMessages((prev) => prev.filter((m) => !localIds.includes(String(m.id))));
                          }

                          if (serverIds.length > 0) {
                            apiClient
                              .post('/messages/bulk/delete', { messageIds: serverIds, type: 'for_me' })
                              .then(() => {
                                setMessages((prev) =>
                                  prev.map((m) =>
                                    serverIds.includes(Number(m.id))
                                      ? {
                                          ...m,
                                          is_deleted: true,
                                          content: 'This message was deleted',
                                          ciphertext: null,
                                          iv_nonce: null
                                        }
                                      : m
                                  )
                                );
                                setPinnedMessages((prev) => prev.filter((pm) => !serverIds.includes(Number(pm.id))));
                                setPinnedMessage((prev) => (prev && serverIds.includes(Number(prev.id)) ? null : prev));
                                setDeleteModalTarget(null);
                                handleDeselectMessage();
                              })
                              .catch((err) => alert(err.message || 'Bulk delete failed.'));
                          } else {
                            setDeleteModalTarget(null);
                            handleDeselectMessage();
                          }
                        } else {
                          handleDeleteMessage(deleteModalTarget.message, 'for_me');
                        }
                      }}
                    >
                      <Trash size={14} /> Delete for me
                    </button>

                    {hasMyMsgs && (
                      <button
                        type="button"
                        className="btn-danger"
                        disabled={!allEligible}
                        title={!allEligible ? 'Delete for everyone is only available within 60 minutes of sending.' : undefined}
                        style={!allEligible ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                        onClick={() => {
                          if (!allEligible) return;
                          if (deleteModalTarget.isBulk) {
                            const localMsgs = deleteModalTarget.messages.filter(
                              (m) => (String(m.id).startsWith('temp-') || m.pending || m.failed) && m.is_mine
                            );
                            const serverMsgs = deleteModalTarget.messages.filter(
                              (m) => !String(m.id).startsWith('temp-') && !m.pending && !m.failed && m.is_mine
                            );
                            const localIds = localMsgs.map((m) => String(m.id));
                            const serverIds = serverMsgs.map((m) => Number(m.id));

                            if (localIds.length > 0) {
                              setMessages((prev) => prev.filter((m) => !localIds.includes(String(m.id))));
                            }

                            if (serverIds.length > 0) {
                              apiClient
                                .post('/messages/bulk/delete', { messageIds: serverIds, type: 'for_everyone' })
                                .then(() => {
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      serverIds.includes(Number(m.id))
                                        ? {
                                            ...m,
                                            is_deleted: true,
                                            content: 'This message was deleted',
                                            ciphertext: null,
                                            iv_nonce: null
                                          }
                                        : m
                                    )
                                  );
                                  setPinnedMessages((prev) => prev.filter((pm) => !serverIds.includes(Number(pm.id))));
                                  setPinnedMessage((prev) => (prev && serverIds.includes(Number(prev.id)) ? null : prev));
                                  setDeleteModalTarget(null);
                                  handleDeselectMessage();
                                })
                                .catch((err) => alert(err.message || 'Bulk delete failed.'));
                            } else {
                              setDeleteModalTarget(null);
                              handleDeselectMessage();
                            }
                          } else {
                            handleDeleteMessage(deleteModalTarget.message, 'for_everyone');
                          }
                        }}
                      >
                        <Trash2 size={14} /> Delete for everyone {hasExpired ? '(Expired: >60m)' : ''}
                      </button>
                    )}

                    {hasExpired && (
                      <span style={{ fontSize: '11px', color: '#ef4444', textAlign: 'center' }}>
                        "Delete for everyone" is only allowed within 60 minutes of sending.
                      </span>
                    )}
                  </>
                );
              })()}
              <button
                type="button"
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
        <div className="modal-backdrop" onClick={closeStarredModal}>
          <div className="modal-card vg-starred-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title-wrap">
                <Star size={18} fill="#f59e0b" color="#f59e0b" />
                <h3>Starred Messages</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closeStarredModal}
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
                      closeStarredModal();
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
                      <div className="starred-item-header-actions">
                        <span className="starred-date">{formatMessageTime(sm.created_at)}</span>
                        <button
                          type="button"
                          className="starred-item-unstar-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStar(sm);
                          }}
                          title="Unstar message"
                          aria-label="Unstar message"
                        >
                          <Star size={13} fill="#f59e0b" color="#f59e0b" />
                        </button>
                      </div>
                    </div>
                    <p className="starred-content">
                      {sm.content?.slice(0, 140) || '(Encrypted media)'}
                    </p>
                    <span className="starred-conversation-tag">
                      {String(sm.partner_username || '').startsWith('group-')
                        ? `Chat in ${sm.conversation_title || 'Group'} →`
                        : `Chat with @${sm.partner_username} →`}
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
          width: 40px;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
          border-radius: 12px;
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

        .chat-stream {
          padding-bottom: 32px !important;
        }

        .chat-stream-bottom-anchor {
          height: 32px;
          min-height: 32px;
          width: 100%;
          flex-shrink: 0;
          pointer-events: none;
        }

        .chat-composer-container {
          padding: 12px 20px 16px;
          border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
          background: var(--card-bg, #131722);
          flex-shrink: 0;
        }

        .chat-composer-bar {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          width: 100%;
          background: transparent;
          border: none;
          padding: 0;
        }

        .chat-input-pill {
          display: flex;
          align-items: flex-end;
          flex: 1;
          min-width: 0;
          background: var(--bg-page, #0b0e14);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
          border-radius: 24px;
          padding: 4px 8px 4px 10px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .chat-input-pill:focus-within {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }

        .composer-left-actions {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
          margin-bottom: 2px;
          animation: fadeIn 0.15s ease;
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
          flex-shrink: 0;
          margin-bottom: 1px;
        }

        .btn-composer-icon:hover {
          color: #818cf8;
          background: rgba(255, 255, 255, 0.08);
          transform: scale(1.08);
        }

        .btn-expand-media {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 50%;
          margin-right: 4px;
          color: var(--text-secondary, #94a3b8);
        }

        .btn-expand-media:hover {
          background: rgba(99, 102, 241, 0.15);
          color: #818cf8;
        }

        .btn-collapse-media {
          color: var(--text-secondary, #94a3b8);
          margin-left: 2px;
        }

        .btn-collapse-media:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.12);
        }

        .chat-input-field {
          flex: 1;
          min-width: 0;
          box-sizing: border-box;
          border: none;
          outline: none;
          background: transparent;
          color: var(--text-primary, #f8fafc);
          font-family: inherit;
          font-size: 0.94rem;
          line-height: 1.4;
          padding: 8px 6px;
          margin: 0;
          resize: none;
          min-height: 36px;
          max-height: 160px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: anywhere;
          scrollbar-width: thin;
        }

        .chat-input-field::-webkit-scrollbar {
          width: 4px;
        }

        .chat-input-field::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 4px;
        }

        .chat-input-field::placeholder {
          color: var(--text-secondary, #64748b);
        }

        /* Section 2: Dedicated Circular Send Button */
        .chat-send-section {
          display: flex;
          align-items: flex-end;
          flex-shrink: 0;
        }

        .btn-chat-send-circle {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
          outline: none;
          cursor: pointer;
          background: var(--bg-page, #0b0e14);
          color: var(--text-secondary, #64748b);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          margin-bottom: 2px;
          flex-shrink: 0;
          padding: 0;
        }

        .btn-chat-send-circle.active,
        .btn-chat-send-circle:not(:disabled) {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: #ffffff;
          border-color: transparent;
          box-shadow: 0 2px 10px rgba(99, 102, 241, 0.4);
        }

        .btn-chat-send-circle:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.6);
        }

        .btn-chat-send-circle:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .send-icon-svg {
          transform: translate(1px, -1px);
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
          flex-shrink: 0;
          margin-bottom: 1px;
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

        /* Group Avatar & Badges */
        .group-avatar-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
          flex-shrink: 0;
        }

        .header-group-avatar {
          width: 44px;
          height: 44px;
        }

        .group-avatar-icon {
          stroke-width: 2.2;
        }

        .group-members-pill {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 1px 6px;
          border-radius: 10px;
          background: rgba(99, 102, 241, 0.15);
          color: #818cf8;
          font-size: 0.72rem;
          font-weight: 600;
          margin-left: 6px;
        }

        .group-members-sub {
          font-size: 0.78rem;
          color: var(--text-secondary, #94a3b8);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 320px;
          display: inline-block;
        }

        .group-sender-tag {
          font-size: 0.76rem;
          font-weight: 700;
          color: #818cf8;
          margin-bottom: 3px;
          user-select: none;
        }

        /* Message Bubble Quick Action Bar (Hover Toolbar) */
        .msg-quick-action-bar {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 2px 4px;
          border-radius: 20px;
          background: var(--card-bg, #1e293b);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
          position: absolute;
          top: -12px;
          opacity: 0;
          pointer-events: none;
          transform: translateY(4px);
          transition: all 0.18s cubic-bezier(0.2, 0, 0, 1);
          z-index: 20;
        }

        .message-bubble-row:hover .msg-quick-action-bar {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }

        .message-bubble-row.outgoing .msg-quick-action-bar {
          right: 8px;
        }

        .message-bubble-row.incoming .msg-quick-action-bar {
          left: 8px;
        }

        .msg-quick-action-btn {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          color: var(--text-secondary, #94a3b8);
          cursor: pointer;
          transition: all 0.15s ease;
          padding: 0;
        }

        .msg-quick-action-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: var(--text-primary, #f8fafc);
          transform: scale(1.15);
        }

        .msg-quick-action-btn.msg-star-btn:hover,
        .msg-quick-action-btn.msg-star-btn.is-starred {
          color: #f59e0b;
        }

        .starred-item-header-actions {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .starred-item-unstar-btn {
          background: transparent;
          border: none;
          color: #f59e0b;
          cursor: pointer;
          padding: 2px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .starred-item-unstar-btn:hover {
          background: rgba(245, 158, 11, 0.15);
          transform: scale(1.2);
        }

        .message-bubble-row {
          position: relative;
          display: flex;
          margin-bottom: 8px;
        }

        .message-bubble-row.vibe-msg-send-spring {
          animation: vibeSendSpring 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        @keyframes vibeSendSpring {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.92);
          }
          65% {
            opacity: 1;
            transform: translateY(-3px) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .vibe-heart-burst-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 60px;
          height: 60px;
        }

        .vibe-heart-burst-main {
          font-size: 2.3rem;
          line-height: 1;
          display: inline-block;
          animation: vibeHeartBurstAnim 0.75s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          filter: drop-shadow(0 4px 12px rgba(255, 45, 85, 0.5));
          user-select: none;
        }

        @keyframes vibeHeartBurstAnim {
          0% {
            transform: scale(0) rotate(-15deg);
            opacity: 0;
          }
          25% {
            transform: scale(1.4) rotate(4deg);
            opacity: 1;
          }
          50% {
            transform: scale(1.1) rotate(0deg);
            opacity: 1;
          }
          75% {
            transform: scale(1.2) translateY(-14px);
            opacity: 0.85;
          }
          100% {
            transform: scale(0.7) translateY(-32px);
            opacity: 0;
          }
        }

        .vibe-heart-particle {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          pointer-events: none;
          animation: vibeParticlePop 0.65s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }

        .vibe-heart-particle.p1 { background: #ff2d55; --tx: -24px; --ty: -20px; }
        .vibe-heart-particle.p2 { background: #ff6b81; --tx: 24px; --ty: -22px; }
        .vibe-heart-particle.p3 { background: #ffd32a; --tx: -28px; --ty: 8px; }
        .vibe-heart-particle.p4 { background: #ff3838; --tx: 28px; --ty: 6px; }
        .vibe-heart-particle.p5 { background: #ff9ff3; --tx: -12px; --ty: 24px; }
        .vibe-heart-particle.p6 { background: #54a0ff; --tx: 14px; --ty: 22px; }

        @keyframes vibeParticlePop {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) scale(0);
            opacity: 0;
          }
        }

        /* Swipe-to-reply cue behind or beside the bubble */
        .vibe-swipe-reply-cue {
          position: absolute;
          top: 50%;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--primary, #6366f1);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 10;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
          transition: background-color 0.15s ease, box-shadow 0.15s ease;
        }

        .vibe-swipe-reply-cue.incoming-cue {
          left: 6px;
        }

        .vibe-swipe-reply-cue.outgoing-cue {
          right: 6px;
        }

        .vibe-swipe-reply-cue.threshold-met {
          background: #10b981;
          box-shadow: 0 0 14px rgba(16, 185, 129, 0.65);
        }

        /* 3D Read Receipt Axis Flip */
        .receipt-read-flip .receipt-check-read {
          display: inline-block;
          animation: receiptFlip3D 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          transform-origin: center center;
        }

        @keyframes receiptFlip3D {
          0% {
            transform: scale(0.6) rotateY(90deg);
            opacity: 0.3;
          }
          60% {
            transform: scale(1.3) rotateY(-15deg);
            opacity: 1;
          }
          100% {
            transform: scale(1) rotateY(0deg);
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .message-bubble-row.vibe-msg-send-spring,
          .vibe-heart-burst-main,
          .vibe-heart-particle,
          .receipt-read-flip .receipt-check-read {
            animation: none !important;
            transform: none !important;
          }
        }

        .message-bubble-row.outgoing {
          justify-content: flex-end;
        }

        .message-bubble-row.incoming {
          justify-content: flex-start;
        }

        .message-bubble {
          position: relative;
          max-width: 68%;
          padding: 10px 14px;
          word-break: break-word;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }

        .message-bubble-row.outgoing .message-bubble {
          background: var(--outgoing-bubble-bg, linear-gradient(135deg, #6366f1 0%, #4f46e5 100%));
          color: var(--outgoing-bubble-text, #ffffff);
          border-radius: 18px 18px 4px 18px;
          box-shadow: 0 3px 12px rgba(99, 102, 241, 0.28);
        }

        .message-bubble-row.incoming .message-bubble {
          background: var(--incoming-bubble-bg, var(--card-bg, #1a202c));
          color: var(--incoming-bubble-text, var(--text-primary, #f8fafc));
          border-radius: 18px 18px 18px 4px;
          border: 1px solid var(--incoming-bubble-border, var(--border-color, rgba(255, 255, 255, 0.08)));
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .message-text {
          margin: 0;
          font-size: 0.92rem;
          line-height: 1.45;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
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
          color: #38bdf8 !important;
          filter: drop-shadow(0 0 2px rgba(56, 189, 248, 0.45));
        }

        .receipt-check-delivered {
          color: rgba(255, 255, 255, 0.75);
        }

        .receipt-check-sent {
          color: rgba(255, 255, 255, 0.6);
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
          width: 100%;
          max-width: 290px;
          min-width: 210px;
          padding: 8px 10px 6px;
          box-sizing: border-box;
        }

        .audio-note-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          margin-bottom: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          width: 100%;
          box-sizing: border-box;
        }

        .audio-header-left {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          flex: 1;
          overflow: hidden;
        }

        .audio-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 0.8rem;
        }

        .audio-header-right {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .audio-lock-tag {
          font-size: 0.68rem;
          background: rgba(255, 255, 255, 0.15);
          color: inherit;
          padding: 2px 6px;
          border-radius: 6px;
          white-space: nowrap;
          flex-shrink: 0;
          line-height: 1.2;
        }

        .message-bubble:not(.mine) .audio-lock-tag {
          background: rgba(99, 102, 241, 0.12);
          color: #818cf8;
        }

        .encrypted-audio-player {
          width: 100%;
          height: 38px;
          border-radius: 20px;
          display: block;
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
          border-radius: 18px 18px 18px 4px;
          background: var(--bg-card, #1a202c);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
          display: inline-flex;
          align-items: center;
          gap: 5px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
          animation: typingBubbleEnter 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes typingBubbleEnter {
          from {
            opacity: 0;
            transform: scale(0.85) translateY(4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .typing-dots-bubble .dot {
          width: 7px;
          height: 7px;
          background: var(--primary, #6366f1);
          border-radius: 50%;
          animation: typingDotPulse 1.4s infinite ease-in-out both;
        }

        .typing-dots-bubble .dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dots-bubble .dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes typingDotPulse {
          0%, 80%, 100% { transform: scale(0.65); opacity: 0.35; }
          40% { transform: scale(1.15); opacity: 1; }
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

        /* ===== WhatsApp Classic Top Action Bar & Floating Reaction Pill ===== */
        .action-bar-more-backdrop {
          position: fixed;
          inset: 0;
          z-index: 990;
          background: transparent;
        }

        .chat-top-action-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-card, #1e293b);
          border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
          padding: 6px 10px;
          min-height: 56px;
          animation: waBarSlideDown 0.14s ease-out;
          z-index: 100;
          box-sizing: border-box;
          width: 100%;
          overflow: visible;
        }

        @keyframes waBarSlideDown {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .top-action-bar-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          min-width: 0;
        }

        .btn-action-bar-back {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          min-width: 36px;
          min-height: 36px;
          padding: 0;
          border: none;
          background: transparent;
          color: var(--text-primary, #ffffff);
          border-radius: 50%;
          cursor: pointer;
          transition: background 0.15s ease;
          flex-shrink: 0;
        }

        .btn-action-bar-back:hover,
        .btn-action-bar-back:focus-visible {
          background: rgba(255, 255, 255, 0.1);
        }

        .action-bar-count {
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--text-primary, #ffffff);
          letter-spacing: 0.2px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .top-action-bar-right {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }

        .btn-action-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          min-width: 36px;
          min-height: 36px;
          padding: 0;
          border: none;
          background: transparent;
          color: var(--text-secondary, #94a3b8);
          border-radius: 50%;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
          flex-shrink: 0;
        }

        .btn-action-icon:hover,
        .btn-action-icon:focus-visible {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary, #ffffff);
        }

        .btn-action-icon:active {
          transform: scale(0.94);
        }

        .btn-action-danger {
          color: #f87171;
        }

        .btn-action-danger:hover,
        .btn-action-danger:focus-visible {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        .action-bar-more-wrap {
          position: relative;
        }

        .action-bar-more-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          background: var(--bg-card, #1e293b);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
          border-radius: 12px;
          padding: 6px;
          min-width: 175px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
          z-index: 1000;
          animation: waMenuScale 0.12s ease-out;
        }

        @keyframes waMenuScale {
          from {
            opacity: 0;
            transform: scale(0.92) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .action-bar-dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 14px;
          border: none;
          background: transparent;
          color: var(--text-primary, #e2e8f0);
          font-size: 0.88rem;
          font-weight: 500;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.12s ease;
          text-align: left;
        }

        .action-bar-dropdown-item:hover,
        .action-bar-dropdown-item:focus-visible {
          background: rgba(255, 255, 255, 0.08);
        }

        /* Message bubble highlight when selected for action */
        .message-bubble.is-highlighted-bubble {
          box-shadow: 0 0 0 2.5px #6366f1, 0 6px 20px rgba(99, 102, 241, 0.35) !important;
          transform: translateZ(0);
        }

        .message-bubble-row.is-action-selected {
          background: rgba(99, 102, 241, 0.08);
          border-radius: 12px;
        }

        /* ==========================================================================
           Phase 4: Message Reaction Experience (Option 1: Dynamic Magnifier & Full Picker Pill)
           ========================================================================== */
        .vg-wa-floating-reactions {
          position: absolute;
          top: -50px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          background: rgba(30, 41, 59, 0.94);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.18));
          border-radius: 9999px;
          padding: 4px 10px;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08);
          z-index: 60;
          animation: waReactionPop 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          user-select: none;
          transition: border-radius 0.2s ease, padding 0.2s ease, top 0.2s ease;
        }

        .vg-wa-floating-reactions.extended-open {
          border-radius: 22px;
          padding: 8px 12px;
          top: -110px;
        }

        .vg-reactions-main-row {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .message-bubble-row.outgoing .vg-wa-floating-reactions {
          right: 0;
        }

        .message-bubble-row.incoming .vg-wa-floating-reactions {
          left: 0;
        }

        @keyframes waReactionPop {
          0% {
            opacity: 0;
            transform: scale(0.7) translateY(12px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .vg-wa-react-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border: none;
          background: transparent;
          font-size: 1.35rem;
          line-height: 1;
          border-radius: 50%;
          cursor: pointer;
          padding: 0;
          transition: transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease, background 0.12s ease;
          user-select: none;
        }

        /* Fluid Magnifier Physics */
        .vg-reactions-main-row:hover .vg-wa-react-btn {
          transform: scale(0.92);
          opacity: 0.85;
        }

        .vg-wa-react-btn:hover {
          transform: scale(1.55) translateY(-6px) !important;
          opacity: 1 !important;
          z-index: 10;
        }

        /* Adjacent sibling magnification */
        .vg-wa-react-btn:hover + .vg-wa-react-btn {
          transform: scale(1.22) translateY(-2px) !important;
          opacity: 0.95 !important;
          z-index: 5;
        }

        .vg-reactions-main-row:has(.vg-wa-react-btn:nth-child(2):hover) .vg-wa-react-btn:nth-child(1),
        .vg-reactions-main-row:has(.vg-wa-react-btn:nth-child(3):hover) .vg-wa-react-btn:nth-child(2),
        .vg-reactions-main-row:has(.vg-wa-react-btn:nth-child(4):hover) .vg-wa-react-btn:nth-child(3),
        .vg-reactions-main-row:has(.vg-wa-react-btn:nth-child(5):hover) .vg-wa-react-btn:nth-child(4),
        .vg-reactions-main-row:has(.vg-wa-react-btn:nth-child(6):hover) .vg-wa-react-btn:nth-child(5) {
          transform: scale(1.22) translateY(-2px) !important;
          opacity: 0.95 !important;
          z-index: 5;
        }

        .vg-wa-react-btn:active {
          transform: scale(1.1) !important;
        }

        .vg-wa-more-btn {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary, #ffffff);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          margin-left: 3px;
          transition: background 0.18s ease, transform 0.18s ease;
        }

        .vg-wa-more-btn:hover,
        .vg-wa-more-btn.is-active {
          background: var(--primary, #6366f1);
          color: #ffffff;
          transform: scale(1.1);
        }

        .vg-plus-icon {
          transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .vg-plus-icon.rotated {
          transform: rotate(45deg);
        }

        /* Extended Mini Emoji Grid Drawer */
        .vg-reactions-extended-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 6px;
          padding-top: 6px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          width: 100%;
          animation: drawerSlideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes drawerSlideDown {
          0% {
            opacity: 0;
            transform: translateY(-8px) scaleY(0.85);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        .vg-wa-react-btn.extended-btn {
          width: 32px;
          height: 32px;
          font-size: 1.25rem;
        }

        .vg-wa-react-btn.extended-btn:hover {
          transform: scale(1.4) translateY(-3px) !important;
        }

        /* Enhanced message reaction pill row */
        .message-reactions-row {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 6px;
        }

        .reaction-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 9999px;
          padding: 2px 8px;
          font-size: 0.8rem;
          color: var(--text-primary, #ffffff);
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
          animation: reactionPillPop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .reaction-pill:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: scale(1.06);
        }

        .reaction-pill.my-reaction {
          background: rgba(99, 102, 241, 0.22);
          border-color: rgba(99, 102, 241, 0.65);
          color: #a5b4fc;
          box-shadow: 0 0 8px rgba(99, 102, 241, 0.3);
        }

        @keyframes reactionPillPop {
          0% {
            opacity: 0;
            transform: scale(0.6);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* WhatsApp-style Floating Scroll-to-Bottom Button */
        .btn-scroll-bottom-floating {
          position: absolute;
          right: 20px;
          bottom: 84px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--bg-card, #1e293b);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
          color: var(--text-primary, #ffffff);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
          cursor: pointer;
          z-index: 35;
          transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
          animation: waBtnFadeIn 0.18s ease-out;
        }

        .btn-scroll-bottom-floating:hover {
          transform: translateY(-2px);
          background: var(--bg-hover, #334155);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
        }

        .btn-scroll-bottom-floating:active {
          transform: scale(0.92);
        }

        @keyframes waBtnFadeIn {
          from {
            opacity: 0;
            transform: scale(0.8) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .scroll-bottom-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          background: #22c55e;
          color: #ffffff;
          font-size: 0.72rem;
          font-weight: 700;
          min-width: 20px;
          height: 20px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 5px;
          box-shadow: 0 2px 6px rgba(34, 197, 94, 0.5);
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
          border-radius: 14px;
          padding: 6px;
          min-width: 175px;
          max-width: calc(100vw - 24px);
          max-height: calc(100vh - 90px);
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          box-shadow: 0 10px 36px rgba(0, 0, 0, 0.45);
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
          transition: all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          animation: reactionPop 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes reactionPop {
          0% { transform: scale(0.8); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }

        .reaction-pill:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: scale(1.08);
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
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.22);
          color: inherit;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
          line-height: 1.2;
        }

        .message-bubble:not(.mine) .audio-speed-btn {
          background: rgba(99, 102, 241, 0.12);
          border-color: rgba(99, 102, 241, 0.25);
          color: #6366f1;
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
          transform: translateZ(0);
          backface-visibility: hidden;
          contain: content;
        }

        .encrypted-chat-video {
          width: 100%;
          border-radius: 10px;
          display: block;
          max-height: 260px;
          background: #000;
          transform: translateZ(0);
          backface-visibility: hidden;
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
          background: var(--card-bg, #1e293b);
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
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
          color: var(--text-primary, #e2e8f0);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .conv-dropdown-item:hover {
          background: var(--hover-bg, rgba(255, 255, 255, 0.08));
          color: var(--text-primary, #ffffff);
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
          background: var(--border-color, rgba(255, 255, 255, 0.08));
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

        .archived-view-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          margin: 8px 12px;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 10px;
          color: #c7d2fe;
          font-size: 0.88rem;
          font-weight: 500;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn-back-inbox {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #f8fafc;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-back-inbox:hover {
          background: #6366f1;
          border-color: #6366f1;
          color: #ffffff;
        }

        @media (max-width: 640px) {
          .chat-top-action-bar {
            padding: 4px 6px;
            gap: 2px;
            overflow: visible;
          }
          .top-action-bar-left {
            gap: 4px;
          }
          .top-action-bar-right {
            gap: 1px;
          }
          .count-label {
            display: none;
          }
          .btn-action-bar-back,
          .btn-action-icon {
            width: 35px;
            height: 35px;
            min-width: 35px;
            min-height: 35px;
          }
          .desktop-action-only {
            display: none !important;
          }
          .chat-header {
            padding: 8px 10px;
            gap: 6px;
          }
          .chat-header-user {
            min-width: 0;
            flex: 1;
            overflow: hidden;
            gap: 8px;
          }
          .chat-header-avatar-wrap {
            flex-shrink: 0;
          }
          .chat-header-avatar {
            width: 36px;
            height: 36px;
          }
          .chat-header-names {
            min-width: 0;
            flex: 1;
            overflow: hidden;
          }
          .chat-header-title-row {
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .chat-header-username {
            font-size: 0.95rem;
            max-width: 105px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex-shrink: 1;
          }
          .btn-safety-badge {
            padding: 3px 5px;
            flex-shrink: 0;
            border-radius: 50%;
          }
          .safety-badge-text {
            display: none;
          }
          .chat-header-actions {
            gap: 4px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
          }
          .btn-chat-action {
            width: 40px;
            height: 40px;
            min-width: 40px;
            min-height: 40px;
            padding: 0;
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .btn-chat-back-mobile {
            min-width: 44px;
            min-height: 44px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 4px 6px;
            margin-right: 2px;
            border-radius: 12px;
            flex-shrink: 0;
          }
          .conv-dropdown-menu {
            right: 0;
            max-width: calc(100vw - 20px);
          }
          .chat-composer-bar {
            gap: 6px;
            padding: 0;
          }
          .chat-input-pill {
            padding: 2px 6px 2px 8px;
            border-radius: 20px;
          }
          .btn-composer-icon {
            width: 36px;
            height: 36px;
            min-width: 36px;
            min-height: 36px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            margin-bottom: 1px;
          }
          .chat-input-field {
            font-size: 0.88rem;
            padding: 6px 4px;
            min-height: 24px;
          }
          .chat-send-section {
            flex-shrink: 0;
          }
          .btn-chat-send-circle {
            width: 42px;
            height: 42px;
            min-width: 42px;
            min-height: 42px;
            margin-bottom: 1px;
          }
          .btn-chat-send {
            padding: 6px 10px;
            font-size: 0.82rem;
            flex-shrink: 0;
            margin-bottom: 1px;
          }

          body.has-active-chat .top-navbar,
          body.has-active-chat .mobile-bottom-navbar {
            display: none !important;
          }

          body.has-active-chat .main-content {
            padding: 0 !important;
            margin: 0 !important;
            height: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
          }

          body.has-active-chat .messages-page-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            border-radius: 0 !important;
            border: none !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100% !important;
            height: var(--chat-viewport-height, 100dvh) !important;
            max-height: var(--chat-viewport-height, 100dvh) !important;
            overflow: hidden !important;
            z-index: 50 !important;
          }

          body.has-active-chat .messages-layout-container {
            height: 100% !important;
            max-height: 100% !important;
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }

          body.has-active-chat .messages-chat-panel {
            height: 100% !important;
            max-height: 100% !important;
            min-height: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            position: relative !important;
            overflow: hidden !important;
          }

          body.has-active-chat .chat-header {
            flex-shrink: 0 !important;
          }

          body.has-active-chat .chat-stream {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }

          body.has-active-chat .chat-composer-container {
            flex-shrink: 0 !important;
            position: relative !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 20 !important;
            background: var(--card-bg, #131722) !important;
            padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px)) !important;
            border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.1)) !important;
          }
        }

        @media (min-width: 641px) {
          .mobile-only-action {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

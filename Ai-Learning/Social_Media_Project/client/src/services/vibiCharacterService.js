/**
 * client/src/services/vibiCharacterService.js
 * ============================================
 * VIBGRID — VIBI AI ASSISTANT: DYNAMIC LIVING CHARACTER SERVICE
 *
 * Responsibilities:
 * 1. Manages Vibi's emotional & behavioral states (36 manifest states: idle_floating,
 *    curious, celebrate, new_message, missed_call, group_invitation, join_request,
 *    dragging_move, docking_snap, thinking, responding_talking, sleepy, etc.)
 * 2. Enforces anti-spam cooldowns and event priority to avoid annoying the user.
 * 3. Ambient micro-behaviors (gentle bounce, head tilt, look around, blink, tail wag).
 * 4. Tracks user inactivity to trigger calm sleepy/wake-up micro-behaviors.
 * 5. Listens to real VibeGrid events (incoming messages, missed calls, group invites,
 *    join requests, celebrations, call initiations).
 * 6. Manages drag coordinates, safe-edge docking (snapping), and collision boundaries.
 * 7. Respects user preferences (animations OFF, notifications OFF, reduced-motion).
 */

import { MANIFEST_STATES, resolveCanonicalState } from './vibiAssetRegistry';
import socketService from './socketService';

export const VIBI_STATES = Object.freeze({
  // Canonical / Core aliases
  IDLE: 'idle',
  LISTENING: 'listening',
  THINKING: 'thinking',
  RESPONDING: 'responding',
  SUCCESS: 'success',
  CELEBRATE: 'celebrate',
  ERROR: 'error',
  NEW_MESSAGE: 'new_message',
  MISSED_CALL: 'missed_call',
  WELCOME: 'welcome',
  SLEEPY: 'sleepy',
  WAKE_UP: 'wake_up',

  // Extended manifest states
  IDLE_FLOATING: MANIFEST_STATES.IDLE_FLOATING,
  CELEBRATING: MANIFEST_STATES.CELEBRATING,
  HAPPY_RESPONSE: MANIFEST_STATES.HAPPY_RESPONSE,
  RESPONDING_TALKING: MANIFEST_STATES.RESPONDING_TALKING,
  TYPING_PROCESSING: MANIFEST_STATES.TYPING_PROCESSING,
  LISTENING_SPEAKING: MANIFEST_STATES.LISTENING_SPEAKING,
  DRAGGING_MOVE: MANIFEST_STATES.DRAGGING_MOVE,
  DRAGGING_MOVE_ALT: MANIFEST_STATES.DRAGGING_MOVE_ALT,
  DOCKING_SNAP: MANIFEST_STATES.DOCKING_SNAP,
  DOCKING_SNAP_ALT: MANIFEST_STATES.DOCKING_SNAP_ALT,
  BLINK: MANIFEST_STATES.BLINK,
  CURIOUS: MANIFEST_STATES.CURIOUS,
  LOOK_AROUND: MANIFEST_STATES.LOOK_AROUND,
  HEAD_TILT: MANIFEST_STATES.HEAD_TILT,
  GENTLE_BOUNCE: MANIFEST_STATES.GENTLE_BOUNCE,
  TAIL_WAG: MANIFEST_STATES.TAIL_WAG,
  EXCITED: MANIFEST_STATES.EXCITED,
  FOCUSED: MANIFEST_STATES.FOCUSED,
  SURPRISED: MANIFEST_STATES.SURPRISED,
  QUESTION: MANIFEST_STATES.QUESTION,
  VIBI_NOTICED_YOU: MANIFEST_STATES.VIBI_NOTICED_YOU,
  PEEK_AND_WAVE: MANIFEST_STATES.PEEK_AND_WAVE,
  PEEK_AND_WAVE_ALT: MANIFEST_STATES.PEEK_AND_WAVE_ALT,
  PEEK_FROM_EDGE: MANIFEST_STATES.PEEK_FROM_EDGE,
  PEEK_FROM_EDGE_ALT: MANIFEST_STATES.PEEK_FROM_EDGE_ALT,
  GROUP_INVITATION: MANIFEST_STATES.GROUP_INVITATION,
  JOIN_REQUEST: MANIFEST_STATES.JOIN_REQUEST,
  IMPORTANT_ACTIVITY: MANIFEST_STATES.IMPORTANT_ACTIVITY,
  SLEEPING: MANIFEST_STATES.SLEEPING,
  SLEEPING_ALT: MANIFEST_STATES.SLEEPING_ALT,
  WAKE_UP_ALT: MANIFEST_STATES.WAKE_UP_ALT
});

export const VIBI_DOCK_STORAGE_KEY = 'vibegrid_vibi_position';

// Safe margins in pixels to avoid covering navigation or screen edges
export const SAFE_MARGINS = {
  TOP: 60,
  BOTTOM: 84, // Clear bottom navigation (68px) + safe bar
  LEFT: 16,
  RIGHT: 16
};

// Subtle ambient micro-behavior pool
const AMBIENT_MICRO_STATES = [
  VIBI_STATES.BLINK,
  VIBI_STATES.LOOK_AROUND,
  VIBI_STATES.HEAD_TILT,
  VIBI_STATES.CURIOUS,
  VIBI_STATES.GENTLE_BOUNCE,
  VIBI_STATES.TAIL_WAG
];

class VibiCharacterService {
  constructor() {
    this.currentState = VIBI_STATES.IDLE;
    this.lastReactionTimestamp = 0;
    this.lastReactionTimestamp = 0;
    this.cooldownDurationMs = 15000; // 15s cooldown between spontaneous ambient reactions
    this.revertTimer = null;
    this.inactivityTimer = null;
    this.ambientTimer = null;
    this.isInactive = false;
    this.isTabHidden = false;
    this.subscribers = new Set();
    this.inactivityTimeoutMs = 45000; // 45s enters sleepy state
    this.cleanupListeners = null;
  }

  /**
   * Subscribe to character state updates
   * @param {Function} callback - (state, metadata) => void
   * @returns {Function} unsubscribe
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers of state change
   */
  _notify(state, metadata = {}) {
    this.subscribers.forEach((cb) => {
      try {
        cb(state, metadata);
      } catch (err) {
        console.error('[VibiCharacterService] Subscriber error:', err);
      }
    });
  }

  /**
   * Get the current character state
   * @returns {string}
   */
  getState() {
    return this.currentState;
  }

  /**
   * Transition to a new state
   * @param {string} newState
   * @param {Object} [options={}]
   * @param {number} [options.durationMs=0] - Auto-revert to idle after duration (0 = sticky)
   * @param {boolean} [options.force=false] - Bypass anti-spam cooldown
   * @param {Object} [options.metadata={}]
   * @returns {boolean} Whether transition was accepted
   */
  setState(newState, { durationMs = 0, force = false, metadata = {}, preferences = null } = {}) {
    // If animations are disabled in preferences, only accept IDLE
    if (preferences && preferences.animations === false && newState !== VIBI_STATES.IDLE) {
      return false;
    }

    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia) {
      try {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && !force && newState !== VIBI_STATES.IDLE) {
          return false;
        }
      } catch {}
    }

    // Anti-spam check for ambient reactions
    if (!force && durationMs > 0) {
      const now = Date.now();
      if (now - this.lastReactionTimestamp < this.cooldownDurationMs) {
        return false;
      }
      this.lastReactionTimestamp = now;
    }

    if (this.revertTimer) {
      clearTimeout(this.revertTimer);
      this.revertTimer = null;
    }

    this.currentState = newState;
    this._notify(this.currentState, metadata);

    // Auto-revert back to IDLE after duration
    if (durationMs > 0) {
      this.revertTimer = setTimeout(() => {
        this.currentState = this.isInactive ? VIBI_STATES.SLEEPY : VIBI_STATES.IDLE;
        this._notify(this.currentState);
        this.revertTimer = null;
      }, durationMs);
    }

    return true;
  }

  // ==========================================
  // Direct Action Triggers
  // ==========================================

  celebrate(options = {}) {
    return this.setState(VIBI_STATES.CELEBRATE, {
      durationMs: 3000,
      force: true,
      ...options
    });
  }

  happy(options = {}) {
    return this.setState(VIBI_STATES.SUCCESS, {
      durationMs: 2200,
      force: true,
      ...options
    });
  }

  listen(options = {}) {
    return this.setState(VIBI_STATES.LISTENING, {
      durationMs: 0,
      force: true,
      ...options
    });
  }

  think(options = {}) {
    return this.setState(VIBI_STATES.THINKING, {
      durationMs: 0,
      force: true,
      ...options
    });
  }

  concerned(options = {}) {
    return this.setState(VIBI_STATES.ERROR, {
      durationMs: 2800,
      force: true,
      ...options
    });
  }

  welcome(options = {}) {
    return this.setState(VIBI_STATES.WELCOME, {
      durationMs: 2500,
      force: true,
      ...options
    });
  }

  newMessage(options = {}) {
    return this.setState(VIBI_STATES.NEW_MESSAGE, {
      durationMs: 3500,
      force: true,
      ...options
    });
  }

  missedCall(options = {}) {
    return this.setState(VIBI_STATES.MISSED_CALL, {
      durationMs: 4000,
      force: true,
      ...options
    });
  }

  groupInvitation(options = {}) {
    return this.setState(VIBI_STATES.GROUP_INVITATION, {
      durationMs: 3500,
      force: true,
      ...options
    });
  }

  joinRequest(options = {}) {
    return this.setState(VIBI_STATES.JOIN_REQUEST, {
      durationMs: 3500,
      force: true,
      ...options
    });
  }

  dragging(isDragging) {
    if (isDragging) {
      this.setState(VIBI_STATES.DRAGGING_MOVE, { durationMs: 0, force: true });
    } else {
      this.dockSnap();
    }
  }

  dockSnap() {
    this.setState(VIBI_STATES.DOCKING_SNAP, { durationMs: 800, force: true });
  }

  curious(options = {}) {
    return this.setState(VIBI_STATES.CURIOUS, { durationMs: 2000, ...options });
  }

  bounce(options = {}) {
    return this.setState(VIBI_STATES.GENTLE_BOUNCE, { durationMs: 1600, ...options });
  }

  idle() {
    if (this.revertTimer) {
      clearTimeout(this.revertTimer);
      this.revertTimer = null;
    }
    this.currentState = VIBI_STATES.IDLE;
    this._notify(this.currentState);
  }

  // ==========================================
  // Ambient Watchers & Real Event Integration
  // ==========================================

  /**
   * Schedule next spontaneous micro-behavior
   */
  _scheduleAmbientMicroBehavior(preferences = {}) {
    if (this.ambientTimer) {
      clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }

    if (this.isInactive || this.isTabHidden || preferences.animations === false) {
      return;
    }

    // Schedule between 18s and 32s
    const nextInterval = 18000 + Math.random() * 14000;
    this.ambientTimer = setTimeout(() => {
      if (
        !this.isInactive &&
        !this.isTabHidden &&
        this.currentState === VIBI_STATES.IDLE &&
        preferences.animations !== false
      ) {
        const randomState = AMBIENT_MICRO_STATES[Math.floor(Math.random() * AMBIENT_MICRO_STATES.length)];
        this.setState(randomState, { durationMs: 1600, force: false, preferences });
      }
      this._scheduleAmbientMicroBehavior(preferences);
    }, nextInterval);
  }

  /**
   * Initialize ambient activity and visibility watchers + real event handlers
   * @param {Object} preferences - User preferences
   * @returns {Function} cleanup function
   */
  initActivityWatchers(preferences = {}) {
    if (typeof window === 'undefined') return () => {};

    const handleUserActivity = () => {
      if (this.isInactive) {
        this.isInactive = false;
        // Waking up from sleepy state: briefly wave/stretch then return to idle
        if (this.currentState === VIBI_STATES.SLEEPY || this.currentState === MANIFEST_STATES.SLEEPING) {
          this.setState(VIBI_STATES.WAKE_UP, { durationMs: 1800, force: true });
        }
      }

      // Reset inactivity countdown
      if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
      this.inactivityTimer = setTimeout(() => {
        if (!this.isTabHidden && preferences.animations !== false) {
          this.isInactive = true;
          this.setState(VIBI_STATES.SLEEPY, { durationMs: 0, force: true });
        }
      }, this.inactivityTimeoutMs);

      // Reschedule ambient micro-behavior
      this._scheduleAmbientMicroBehavior(preferences);
    };

    const handleVisibilityChange = () => {
      this.isTabHidden = document.hidden;
      if (document.hidden) {
        // Tab hidden: freeze timers
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
        if (this.ambientTimer) clearTimeout(this.ambientTimer);
      } else {
        // Tab restored
        handleUserActivity();
        if (preferences.welcome && preferences.animations !== false) {
          this.welcome({ preferences });
        }
      }
    };

    // Real VibeGrid Event Listeners
    const handleCelebrateEvent = () => {
      if (preferences.animations !== false) {
        this.celebrate();
      }
    };

    const handleCallEvent = () => {
      if (preferences.animations !== false) {
        this.setState(VIBI_STATES.LISTENING_SPEAKING, { durationMs: 4000 });
      }
    };

    const handleNewMessageEvent = () => {
      if (preferences.animations !== false) {
        this.newMessage({ preferences });
      }
    };

    const handleMissedCallEvent = () => {
      if (preferences.animations !== false) {
        this.missedCall({ preferences });
      }
    };

    const handleGroupInviteEvent = () => {
      if (preferences.animations !== false) {
        this.groupInvitation({ preferences });
      }
    };

    const handleJoinRequestEvent = () => {
      if (preferences.animations !== false) {
        this.joinRequest({ preferences });
      }
    };

    // Global DOM Event Listeners
    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('touchstart', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('vibegrid:celebrate', handleCelebrateEvent);
    window.addEventListener('vibegrid:initiate-call', handleCallEvent);
    window.addEventListener('vibegrid:new-message', handleNewMessageEvent);
    window.addEventListener('vibegrid:missed-call', handleMissedCallEvent);
    window.addEventListener('vibegrid:group-invite', handleGroupInviteEvent);
    window.addEventListener('vibegrid:join-request', handleJoinRequestEvent);

    // Socket Service Real Event Listeners (if socketService is present)
    const handleSocketMessage = () => handleNewMessageEvent();
    const handleSocketMissedCall = () => handleMissedCallEvent();
    const handleSocketNotification = (notif) => {
      if (!notif) return;
      const type = notif.type || notif.notificationType;
      if (type === 'group_invite' || type === 'group:invite') {
        handleGroupInviteEvent();
      } else if (type === 'join_request' || type === 'group:join_request') {
        handleJoinRequestEvent();
      } else if (type === 'message') {
        handleNewMessageEvent();
      }
    };

    try {
      if (socketService && typeof socketService.on === 'function') {
        socketService.on('message:receive', handleSocketMessage);
        socketService.on('call:cancelled', handleSocketMissedCall);
        socketService.on('notification:receive', handleSocketNotification);
      }
    } catch {}

    // Start inactivity countdown
    this.inactivityTimer = setTimeout(() => {
      if (!this.isTabHidden && preferences.animations !== false) {
        this.isInactive = true;
        this.setState(VIBI_STATES.SLEEPY, { durationMs: 0, force: true });
      }
    }, this.inactivityTimeoutMs);

    // Start ambient micro-behavior loop
    this._scheduleAmbientMicroBehavior(preferences);

    const cleanup = () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('vibegrid:celebrate', handleCelebrateEvent);
      window.removeEventListener('vibegrid:initiate-call', handleCallEvent);
      window.removeEventListener('vibegrid:new-message', handleNewMessageEvent);
      window.removeEventListener('vibegrid:missed-call', handleMissedCallEvent);
      window.removeEventListener('vibegrid:group-invite', handleGroupInviteEvent);
      window.removeEventListener('vibegrid:join-request', handleJoinRequestEvent);

      try {
        if (socketService && typeof socketService.off === 'function') {
          socketService.off('message:receive', handleSocketMessage);
          socketService.off('call:cancelled', handleSocketMissedCall);
          socketService.off('notification:receive', handleSocketNotification);
        }
      } catch {}

      if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
      if (this.revertTimer) clearTimeout(this.revertTimer);
      if (this.ambientTimer) clearTimeout(this.ambientTimer);
    };

    this.cleanupListeners = cleanup;
    return cleanup;
  }

  // ==========================================
  // Movable Dock Coordinates & Boundaries
  // ==========================================

  getDockPosition(itemWidth = 120, itemHeight = 48) {
    if (typeof window === 'undefined') {
      return { x: 20, y: 100, isLeftDocked: false };
    }

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    try {
      const stored = localStorage.getItem(VIBI_DOCK_STORAGE_KEY);
      if (stored) {
        const { x, y } = JSON.parse(stored);
        const clamped = this.clampPosition(x, y, itemWidth, itemHeight);
        const isLeftDocked = clamped.x < screenWidth / 2;
        return { ...clamped, isLeftDocked };
      }
    } catch {}

    const defaultX = screenWidth - itemWidth - SAFE_MARGINS.RIGHT;
    const defaultY = screenHeight - itemHeight - SAFE_MARGINS.BOTTOM;
    return {
      x: Math.max(SAFE_MARGINS.LEFT, defaultX),
      y: Math.max(SAFE_MARGINS.TOP, defaultY),
      isLeftDocked: false
    };
  }

  saveDockPosition(x, y) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(VIBI_DOCK_STORAGE_KEY, JSON.stringify({ x: Math.round(x), y: Math.round(y) }));
    } catch {}
  }

  resetDockPosition() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(VIBI_DOCK_STORAGE_KEY);
    } catch {}
  }

  clampPosition(x, y, itemWidth = 120, itemHeight = 48) {
    if (typeof window === 'undefined') return { x, y };

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const minX = SAFE_MARGINS.LEFT;
    const maxX = Math.max(minX, screenWidth - itemWidth - SAFE_MARGINS.RIGHT);

    const minY = SAFE_MARGINS.TOP;
    const maxY = Math.max(minY, screenHeight - itemHeight - SAFE_MARGINS.BOTTOM);

    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY)
    };
  }

  snapToEdge(x, y, itemWidth = 120, itemHeight = 48) {
    if (typeof window === 'undefined') {
      return { x, y, isLeftDocked: false };
    }

    const screenWidth = window.innerWidth;
    const clamped = this.clampPosition(x, y, itemWidth, itemHeight);

    const midPoint = screenWidth / 2;
    const isLeftDocked = (clamped.x + itemWidth / 2) < midPoint;

    const snappedX = isLeftDocked
      ? SAFE_MARGINS.LEFT
      : Math.max(SAFE_MARGINS.LEFT, screenWidth - itemWidth - SAFE_MARGINS.RIGHT);

    return {
      x: snappedX,
      y: clamped.y,
      isLeftDocked
    };
  }
}

const vibiCharacterService = new VibiCharacterService();
export default vibiCharacterService;

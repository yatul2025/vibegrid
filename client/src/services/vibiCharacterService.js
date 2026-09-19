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

export const VIBI_EMOTIONS = Object.freeze({
  IDLE: 'idle',
  HAPPY: 'happy',
  EXCITED: 'excited',
  CURIOUS: 'curious',
  THINKING: 'thinking',
  LISTENING: 'listening',
  RESPONDING: 'responding',
  SURPRISED: 'surprised',
  CONCERNED: 'concerned',
  SAD: 'sad',
  CONFUSED: 'confused',
  FRUSTRATED: 'frustrated',
  PROUD: 'proud',
  CELEBRATING: 'celebrating',
  SLEEPY: 'sleepy',
  WELCOME: 'welcome',
  ATTENTIVE: 'attentive',
  PLAYFUL: 'playful',
  ERROR: 'error',
  SUCCESS: 'success'
});

export const VIBI_STATES = Object.freeze({
  // Core 20 Emotions
  IDLE: 'idle',
  HAPPY: 'happy',
  EXCITED: 'excited',
  CURIOUS: 'curious',
  THINKING: 'thinking',
  LISTENING: 'listening',
  RESPONDING: 'responding',
  SURPRISED: 'surprised',
  CONCERNED: 'concerned',
  SAD: 'sad',
  CONFUSED: 'confused',
  FRUSTRATED: 'frustrated',
  PROUD: 'proud',
  CELEBRATING: 'celebrating',
  SLEEPY: 'sleepy',
  WELCOME: 'welcome',
  ATTENTIVE: 'attentive',
  PLAYFUL: 'playful',
  ERROR: 'error',
  SUCCESS: 'success',

  // Canonical / Core aliases
  CELEBRATE: 'celebrate',
  NEW_MESSAGE: 'new_message',
  MISSED_CALL: 'missed_call',
  WAKE_UP: 'wake_up',

  // Extended manifest states
  IDLE_FLOATING: MANIFEST_STATES.IDLE_FLOATING,
  HAPPY_RESPONSE: MANIFEST_STATES.HAPPY_RESPONSE,
  RESPONDING_TALKING: MANIFEST_STATES.RESPONDING_TALKING,
  TYPING_PROCESSING: MANIFEST_STATES.TYPING_PROCESSING,
  LISTENING_SPEAKING: MANIFEST_STATES.LISTENING_SPEAKING,
  DRAGGING_MOVE: MANIFEST_STATES.DRAGGING_MOVE,
  DRAGGING_MOVE_ALT: MANIFEST_STATES.DRAGGING_MOVE_ALT,
  DOCKING_SNAP: MANIFEST_STATES.DOCKING_SNAP,
  DOCKING_SNAP_ALT: MANIFEST_STATES.DOCKING_SNAP_ALT,
  BLINK: MANIFEST_STATES.BLINK,
  LOOK_AROUND: MANIFEST_STATES.LOOK_AROUND,
  HEAD_TILT: MANIFEST_STATES.HEAD_TILT,
  GENTLE_BOUNCE: MANIFEST_STATES.GENTLE_BOUNCE,
  TAIL_WAG: MANIFEST_STATES.TAIL_WAG,
  FOCUSED: MANIFEST_STATES.FOCUSED,
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

export const EMOTION_PRIORITY = Object.freeze({
  IDLE: -1,
  RANDOM_ACTIVITY: 0,
  NORMAL: 0,
  ACTION_RESULT: 1,
  CONTEXTUAL: 2,
  CONTEXTUAL_REACTION: 2,
  USER_INTERACTION: 3,
  IMPORTANT_MESSAGE: 4,
  CALL: 5,
  CRITICAL: 6
});

export const DEFAULT_EMOTION_PRIORITY = Object.freeze({
  [VIBI_STATES.IDLE]: EMOTION_PRIORITY.IDLE,
  [VIBI_STATES.IDLE_FLOATING]: EMOTION_PRIORITY.IDLE,

  // Ambient / Normal
  [VIBI_STATES.SLEEPY]: EMOTION_PRIORITY.NORMAL,
  [VIBI_STATES.SLEEPING]: EMOTION_PRIORITY.NORMAL,
  [VIBI_STATES.SLEEPING_ALT]: EMOTION_PRIORITY.NORMAL,
  [VIBI_STATES.WAKE_UP]: EMOTION_PRIORITY.NORMAL,
  [VIBI_STATES.WAKE_UP_ALT]: EMOTION_PRIORITY.NORMAL,
  [VIBI_STATES.BLINK]: EMOTION_PRIORITY.NORMAL,
  [VIBI_STATES.LOOK_AROUND]: EMOTION_PRIORITY.NORMAL,
  [VIBI_STATES.HEAD_TILT]: EMOTION_PRIORITY.NORMAL,
  [VIBI_STATES.GENTLE_BOUNCE]: EMOTION_PRIORITY.NORMAL,
  [VIBI_STATES.TAIL_WAG]: EMOTION_PRIORITY.NORMAL,
  [VIBI_STATES.PLAYFUL]: EMOTION_PRIORITY.NORMAL,
  [VIBI_STATES.CURIOUS]: EMOTION_PRIORITY.NORMAL,

  // Action Result
  [VIBI_STATES.HAPPY]: EMOTION_PRIORITY.ACTION_RESULT,
  [VIBI_STATES.HAPPY_RESPONSE]: EMOTION_PRIORITY.ACTION_RESULT,
  [VIBI_STATES.SUCCESS]: EMOTION_PRIORITY.ACTION_RESULT,
  [VIBI_STATES.PROUD]: EMOTION_PRIORITY.ACTION_RESULT,
  [VIBI_STATES.CONFUSED]: EMOTION_PRIORITY.ACTION_RESULT,
  [VIBI_STATES.SAD]: EMOTION_PRIORITY.ACTION_RESULT,
  [VIBI_STATES.FRUSTRATED]: EMOTION_PRIORITY.ACTION_RESULT,
  [VIBI_STATES.DOCKING_SNAP]: EMOTION_PRIORITY.ACTION_RESULT,
  [VIBI_STATES.DOCKING_SNAP_ALT]: EMOTION_PRIORITY.ACTION_RESULT,

  // User Interaction / Assistant
  [VIBI_STATES.LISTENING]: EMOTION_PRIORITY.USER_INTERACTION,
  [VIBI_STATES.THINKING]: EMOTION_PRIORITY.USER_INTERACTION,
  [VIBI_STATES.TYPING_PROCESSING]: EMOTION_PRIORITY.USER_INTERACTION,
  [VIBI_STATES.RESPONDING]: EMOTION_PRIORITY.USER_INTERACTION,
  [VIBI_STATES.RESPONDING_TALKING]: EMOTION_PRIORITY.USER_INTERACTION,
  [VIBI_STATES.ATTENTIVE]: EMOTION_PRIORITY.USER_INTERACTION,
  [VIBI_STATES.FOCUSED]: EMOTION_PRIORITY.USER_INTERACTION,
  [VIBI_STATES.WELCOME]: EMOTION_PRIORITY.USER_INTERACTION,
  [VIBI_STATES.PEEK_AND_WAVE]: EMOTION_PRIORITY.USER_INTERACTION,
  [VIBI_STATES.DRAGGING_MOVE]: EMOTION_PRIORITY.USER_INTERACTION,
  [VIBI_STATES.DRAGGING_MOVE_ALT]: EMOTION_PRIORITY.USER_INTERACTION,

  // Important Messages / Social
  [VIBI_STATES.NEW_MESSAGE]: EMOTION_PRIORITY.IMPORTANT_MESSAGE,
  [VIBI_STATES.GROUP_INVITATION]: EMOTION_PRIORITY.IMPORTANT_MESSAGE,
  [VIBI_STATES.JOIN_REQUEST]: EMOTION_PRIORITY.IMPORTANT_MESSAGE,
  [VIBI_STATES.CELEBRATE]: EMOTION_PRIORITY.IMPORTANT_MESSAGE,
  [VIBI_STATES.CELEBRATING]: EMOTION_PRIORITY.IMPORTANT_MESSAGE,
  [VIBI_STATES.EXCITED]: EMOTION_PRIORITY.IMPORTANT_MESSAGE,

  // Calls
  [VIBI_STATES.SURPRISED]: EMOTION_PRIORITY.CALL,
  [VIBI_STATES.LISTENING_SPEAKING]: EMOTION_PRIORITY.CALL,
  [VIBI_STATES.MISSED_CALL]: EMOTION_PRIORITY.CALL,

  // Critical
  [VIBI_STATES.CONCERNED]: EMOTION_PRIORITY.CRITICAL,
  [VIBI_STATES.ERROR]: EMOTION_PRIORITY.CRITICAL,
  [VIBI_STATES.QUESTION]: EMOTION_PRIORITY.CRITICAL
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
export const AMBIENT_MICRO_STATES = Object.freeze([
  VIBI_STATES.BLINK,
  VIBI_STATES.LOOK_AROUND,
  VIBI_STATES.HEAD_TILT,
  VIBI_STATES.CURIOUS,
  VIBI_STATES.GENTLE_BOUNCE,
  VIBI_STATES.TAIL_WAG,
  VIBI_STATES.PLAYFUL,
  VIBI_STATES.ATTENTIVE
]);

class VibiCharacterService {
  constructor() {
    this.currentState = VIBI_STATES.IDLE;
    this.currentPriority = EMOTION_PRIORITY.IDLE;
    this.lastReactionTimestamp = 0;
    this.lastEmotionSetTimestamp = 0;
    this.minDisplayDurationMs = 350; // Minimum screen time before same-priority can replace
    this.cooldownDurationMs = 4000; // 4s cooldown between spontaneous ambient reactions
    this.revertTimer = null;
    this.inactivityTimer = null;
    this.ambientTimer = null;
    this.typingTimer = null;
    this.isInactive = false;
    this.isTabHidden = false;
    this.isUserTyping = false;
    this.typingStartTime = 0;
    this.lastLongTypingReaction = -60000;
    this.lastScrollReactionTimestamp = -60000;
    this.scrollCooldownMs = 12000; // At most once every 12-15s
    this.lastUserActivityTimestamp = 0;
    this.recentAmbientActivities = []; // Track last 3 ambient activities for anti-repetition
    this.recentEvents = [];
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
   * Get current emotion priority level
   * @returns {number}
   */
  getPriority() {
    return this.currentPriority;
  }

  /**
   * Master Emotion Transition Controller
   * Respects priority hierarchy, duration auto-reverts, anti-spam, and user preferences.
   *
   * @param {string} emotion - Target emotion or state
   * @param {Object} [options={}]
   * @param {number} [options.priority] - Explicit priority level
   * @param {number} [options.durationMs=0] - Auto-revert to idle/sleepy after duration (0 = sticky)
   * @param {boolean} [options.force=false] - Bypass priority and cooldown checks
   * @param {Object} [options.metadata={}] - Custom metadata passed to subscribers
   * @param {Object} [options.preferences=null] - User preferences
   * @returns {boolean} Whether transition was accepted
   */
  setEmotion(emotion, { priority, durationMs = 0, force = false, metadata = {}, preferences = null } = {}) {
    // If animations are disabled in preferences, only accept IDLE
    if (preferences && preferences.animations === false && emotion !== VIBI_STATES.IDLE) {
      return false;
    }

    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia) {
      try {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && !force && emotion !== VIBI_STATES.IDLE) {
          return false;
        }
      } catch {}
    }

    const targetPriority = typeof priority === 'number'
      ? priority
      : (DEFAULT_EMOTION_PRIORITY[emotion] ?? EMOTION_PRIORITY.NORMAL);

    const now = Date.now();

    if (!force) {
      // 1. Lower priority cannot interrupt higher priority
      if (targetPriority < this.currentPriority) {
        return false;
      }

      // 2. Same priority: respect minimum display duration to prevent visual flicker
      if (targetPriority === this.currentPriority && (now - this.lastEmotionSetTimestamp < this.minDisplayDurationMs)) {
        return false;
      }

      // 3. Ambient reaction anti-spam cooldown
      if (durationMs > 0 && targetPriority <= EMOTION_PRIORITY.NORMAL) {
        if (now - this.lastReactionTimestamp < this.cooldownDurationMs) {
          return false;
        }
        this.lastReactionTimestamp = now;
      }
    }

    // Clear existing revert timer
    if (this.revertTimer) {
      clearTimeout(this.revertTimer);
      this.revertTimer = null;
    }

    this.currentState = emotion;
    this.currentPriority = targetPriority;
    this.lastEmotionSetTimestamp = now;
    this._notify(this.currentState, { priority: targetPriority, ...metadata });

    // Auto-revert back to baseline after duration
    if (durationMs > 0) {
      this.revertTimer = setTimeout(() => {
        this.currentState = this.isInactive ? VIBI_STATES.SLEEPY : VIBI_STATES.IDLE;
        this.currentPriority = this.isInactive ? EMOTION_PRIORITY.NORMAL : EMOTION_PRIORITY.IDLE;
        this._notify(this.currentState, { autoReverted: true });
        this.revertTimer = null;
      }, durationMs);
    }

    return true;
  }

  /**
   * Compatibility alias for setState -> delegates directly to setEmotion
   */
  setState(newState, options = {}) {
    return this.setEmotion(newState, options);
  }

  /**
   * Rapid event grouping (e.g., 3+ messages/events within 3s)
   */
  handleRapidEvent(eventType, preferences = {}) {
    const now = Date.now();
    this.recentEvents = this.recentEvents.filter(e => now - e.timestamp < 3000);
    this.recentEvents.push({ type: eventType, timestamp: now });

    if (this.recentEvents.length >= 3) {
      return this.setEmotion(VIBI_STATES.ATTENTIVE, {
        priority: EMOTION_PRIORITY.IMPORTANT_MESSAGE,
        durationMs: 3000,
        force: true,
        preferences,
        metadata: { rapidEvent: true, count: this.recentEvents.length, type: eventType }
      });
    }
    return false;
  }

  // ==========================================
  // 20 Core Emotion Helper Triggers
  // ==========================================

  idle() {
    if (this.revertTimer) {
      clearTimeout(this.revertTimer);
      this.revertTimer = null;
    }
    this.currentState = VIBI_STATES.IDLE;
    this.currentPriority = EMOTION_PRIORITY.IDLE;
    this._notify(this.currentState);
    return true;
  }

  happy(options = {}) {
    return this.setEmotion(VIBI_STATES.SUCCESS, {
      priority: EMOTION_PRIORITY.ACTION_RESULT,
      durationMs: 2200,
      force: true,
      ...options
    });
  }

  excited(options = {}) {
    return this.setEmotion(VIBI_STATES.EXCITED, {
      priority: EMOTION_PRIORITY.IMPORTANT_MESSAGE,
      durationMs: 2600,
      force: true,
      ...options
    });
  }

  curious(options = {}) {
    return this.setEmotion(VIBI_STATES.CURIOUS, {
      priority: EMOTION_PRIORITY.NORMAL,
      durationMs: 2200,
      force: true,
      ...options
    });
  }

  think(options = {}) {
    return this.setEmotion(VIBI_STATES.THINKING, {
      priority: EMOTION_PRIORITY.USER_INTERACTION,
      durationMs: 0,
      force: true,
      ...options
    });
  }

  thinking(options = {}) {
    return this.think(options);
  }

  listen(options = {}) {
    return this.setEmotion(VIBI_STATES.LISTENING, {
      priority: EMOTION_PRIORITY.USER_INTERACTION,
      durationMs: 0,
      force: true,
      ...options
    });
  }

  listening(options = {}) {
    return this.listen(options);
  }

  responding(options = {}) {
    return this.setEmotion(VIBI_STATES.RESPONDING, {
      priority: EMOTION_PRIORITY.USER_INTERACTION,
      durationMs: 0,
      force: true,
      ...options
    });
  }

  surprised(options = {}) {
    return this.setEmotion(VIBI_STATES.SURPRISED, {
      priority: EMOTION_PRIORITY.CALL,
      durationMs: 2400,
      force: true,
      ...options
    });
  }

  concerned(options = {}) {
    return this.setEmotion(VIBI_STATES.ERROR, {
      priority: EMOTION_PRIORITY.CRITICAL,
      durationMs: 2800,
      force: true,
      ...options
    });
  }

  sad(options = {}) {
    return this.setEmotion(VIBI_STATES.SAD, {
      priority: EMOTION_PRIORITY.ACTION_RESULT,
      durationMs: 2600,
      force: true,
      ...options
    });
  }

  confused(options = {}) {
    return this.setEmotion(VIBI_STATES.CONFUSED, {
      priority: EMOTION_PRIORITY.ACTION_RESULT,
      durationMs: 2600,
      force: true,
      ...options
    });
  }

  frustrated(options = {}) {
    return this.setEmotion(VIBI_STATES.FRUSTRATED, {
      priority: EMOTION_PRIORITY.ACTION_RESULT,
      durationMs: 2600,
      force: true,
      ...options
    });
  }

  proud(options = {}) {
    return this.setEmotion(VIBI_STATES.PROUD, {
      priority: EMOTION_PRIORITY.ACTION_RESULT,
      durationMs: 2600,
      force: true,
      ...options
    });
  }

  celebrate(options = {}) {
    return this.setEmotion(VIBI_STATES.CELEBRATE, {
      priority: EMOTION_PRIORITY.IMPORTANT_MESSAGE,
      durationMs: 3000,
      force: true,
      ...options
    });
  }

  celebrating(options = {}) {
    return this.celebrate(options);
  }

  sleepy(options = {}) {
    return this.setEmotion(VIBI_STATES.SLEEPY, {
      priority: EMOTION_PRIORITY.NORMAL,
      durationMs: 0,
      force: true,
      ...options
    });
  }

  welcome(options = {}) {
    return this.setEmotion(VIBI_STATES.WELCOME, {
      priority: EMOTION_PRIORITY.USER_INTERACTION,
      durationMs: 2500,
      force: true,
      ...options
    });
  }

  attentive(options = {}) {
    return this.setEmotion(VIBI_STATES.ATTENTIVE, {
      priority: EMOTION_PRIORITY.USER_INTERACTION,
      durationMs: 2500,
      force: true,
      ...options
    });
  }

  playful(options = {}) {
    return this.setEmotion(VIBI_STATES.PLAYFUL, {
      priority: EMOTION_PRIORITY.NORMAL,
      durationMs: 2200,
      force: false,
      ...options
    });
  }

  error(options = {}) {
    return this.setEmotion(VIBI_STATES.ERROR, {
      priority: EMOTION_PRIORITY.CRITICAL,
      durationMs: 2800,
      force: true,
      ...options
    });
  }

  success(options = {}) {
    return this.setEmotion(VIBI_STATES.SUCCESS, {
      priority: EMOTION_PRIORITY.ACTION_RESULT,
      durationMs: 2200,
      force: true,
      ...options
    });
  }

  // ==========================================
  // Direct Event Helpers
  // ==========================================

  newMessage(options = {}) {
    return this.setEmotion(VIBI_STATES.NEW_MESSAGE, {
      priority: EMOTION_PRIORITY.IMPORTANT_MESSAGE,
      durationMs: 3500,
      force: true,
      ...options
    });
  }

  missedCall(options = {}) {
    return this.setEmotion(VIBI_STATES.MISSED_CALL, {
      priority: EMOTION_PRIORITY.CALL,
      durationMs: 4000,
      force: true,
      ...options
    });
  }

  groupInvitation(options = {}) {
    return this.setEmotion(VIBI_STATES.GROUP_INVITATION, {
      priority: EMOTION_PRIORITY.IMPORTANT_MESSAGE,
      durationMs: 3500,
      force: true,
      ...options
    });
  }

  joinRequest(options = {}) {
    return this.setEmotion(VIBI_STATES.JOIN_REQUEST, {
      priority: EMOTION_PRIORITY.IMPORTANT_MESSAGE,
      durationMs: 3500,
      force: true,
      ...options
    });
  }

  dragging(isDragging) {
    if (isDragging) {
      this.setEmotion(VIBI_STATES.DRAGGING_MOVE, { priority: EMOTION_PRIORITY.USER_INTERACTION, durationMs: 0, force: true });
    } else {
      this.dockSnap();
    }
  }

  dockSnap() {
    this.setEmotion(VIBI_STATES.DOCKING_SNAP, { priority: EMOTION_PRIORITY.ACTION_RESULT, durationMs: 800, force: true });
  }

  bounce(options = {}) {
    return this.setEmotion(VIBI_STATES.GENTLE_BOUNCE, { priority: EMOTION_PRIORITY.NORMAL, durationMs: 1600, ...options });
  }

  lookAround(options = {}) {
    return this.setEmotion(VIBI_STATES.LOOK_AROUND, {
      priority: EMOTION_PRIORITY.RANDOM_ACTIVITY,
      durationMs: 1600,
      force: false,
      ...options
    });
  }

  headTilt(options = {}) {
    return this.setEmotion(VIBI_STATES.HEAD_TILT, {
      priority: EMOTION_PRIORITY.RANDOM_ACTIVITY,
      durationMs: 1600,
      force: false,
      ...options
    });
  }

  blink(options = {}) {
    return this.setEmotion(VIBI_STATES.BLINK, {
      priority: EMOTION_PRIORITY.RANDOM_ACTIVITY,
      durationMs: 1200,
      force: false,
      ...options
    });
  }

  tailWag(options = {}) {
    return this.setEmotion(VIBI_STATES.TAIL_WAG, {
      priority: EMOTION_PRIORITY.RANDOM_ACTIVITY,
      durationMs: 1600,
      force: false,
      ...options
    });
  }

  notification(options = {}) {
    return this.setEmotion(VIBI_STATES.NEW_MESSAGE, {
      priority: EMOTION_PRIORITY.CONTEXTUAL,
      durationMs: 2500,
      force: true,
      ...options
    });
  }

  /**
   * Cancel any active ambient reaction immediately when user interacts
   */
  cancelAmbientReaction() {
    if (this.currentPriority <= EMOTION_PRIORITY.RANDOM_ACTIVITY) {
      if (this.revertTimer) {
        clearTimeout(this.revertTimer);
        this.revertTimer = null;
      }
      this.currentState = this.isInactive ? VIBI_STATES.SLEEPY : VIBI_STATES.IDLE;
      this.currentPriority = this.isInactive ? EMOTION_PRIORITY.NORMAL : EMOTION_PRIORITY.IDLE;
      this._notify(this.currentState, { cancelled: true });
    }
  }

  // ==========================================
  // Ambient Watchers & Real Event Integration
  // ==========================================

  /**
   * Pick next random ambient state avoiding consecutive repetition
   * @returns {string}
   */
  _getNextRandomAmbientState() {
    // Exclude recent ambient activities (last 2-3) to ensure natural variety
    const available = AMBIENT_MICRO_STATES.filter(
      (st) => !this.recentAmbientActivities.includes(st) && st !== this.currentState
    );
    const pool = available.length > 0
      ? available
      : AMBIENT_MICRO_STATES.filter((st) => st !== this.currentState);

    const chosen = pool[Math.floor(Math.random() * pool.length)] || VIBI_STATES.LOOK_AROUND;

    this.recentAmbientActivities.push(chosen);
    if (this.recentAmbientActivities.length > 3) {
      this.recentAmbientActivities.shift();
    }
    return chosen;
  }

  /**
   * Schedule next spontaneous random micro-behavior during idle time
   */
  _scheduleAmbientMicroBehavior(preferences = {}) {
    if (this.ambientTimer) {
      clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }

    if (this.isInactive || this.isTabHidden || preferences.animations === false) {
      return;
    }

    // Schedule between 10s and 20s of idle time (subtle, occasional cadence)
    const nextInterval = 10000 + Math.random() * 10000;
    this.ambientTimer = setTimeout(() => {
      if (
        !this.isInactive &&
        !this.isTabHidden &&
        preferences.animations !== false &&
        (this.currentState === VIBI_STATES.IDLE || this.currentState === VIBI_STATES.IDLE_FLOATING) &&
        !this.isUserTyping &&
        this.currentPriority <= EMOTION_PRIORITY.IDLE
      ) {
        const randomState = this._getNextRandomAmbientState();
        // Subtle, brief display duration (1200ms - 1800ms)
        const durationMs = 1300 + Math.floor(Math.random() * 500);
        this.setEmotion(randomState, {
          priority: EMOTION_PRIORITY.RANDOM_ACTIVITY,
          durationMs,
          force: false,
          preferences,
          metadata: { ambient: true }
        });
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

    // 1. Mouse & Touch General Activity Watcher (Throttled, does NOT cancel ambientTimer)
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - this.lastUserActivityTimestamp < 800) {
        return; // Prevent high-frequency churn on mousemove
      }
      this.lastUserActivityTimestamp = now;

      if (this.isInactive) {
        this.isInactive = false;
        // Waking up from sleepy state: briefly wave/stretch then return to idle
        if (this.currentState === VIBI_STATES.SLEEPY || this.currentState === MANIFEST_STATES.SLEEPING) {
          this.setState(VIBI_STATES.WAKE_UP, { durationMs: 1800, force: true, preferences });
        }
      }

      // Reset inactivity countdown (45s)
      if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
      this.inactivityTimer = setTimeout(() => {
        if (!this.isTabHidden && preferences.animations !== false) {
          this.isInactive = true;
          this.setState(VIBI_STATES.SLEEPY, { durationMs: 0, force: true, preferences });
        }
      }, this.inactivityTimeoutMs);

      // Ensure ambient loop is active if it was cleared
      if (!this.ambientTimer && !this.isInactive && !this.isTabHidden && preferences.animations !== false) {
        this._scheduleAmbientMicroBehavior(preferences);
      }
    };

    // 2. Direct User Click/Touch Interaction Watcher (Cancels idle reaction immediately)
    const handleDirectInteraction = () => {
      this.cancelAmbientReaction();
      handleUserActivity();
    };

    // 3. Typing Activity Watcher
    const handleKeyActivity = (e) => {
      const target = e.target;
      const isEditable = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.getAttribute?.('role') === 'textbox'
      );

      handleUserActivity();

      if (!isEditable || preferences.animations === false) {
        return;
      }

      // Ignore non-printable modifier/navigation keys
      const ignoredKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (e.key && ignoredKeys.includes(e.key)) {
        return;
      }

      const now = Date.now();

      // Cancel any ongoing random ambient activity immediately
      if (this.currentPriority <= EMOTION_PRIORITY.RANDOM_ACTIVITY) {
        this.cancelAmbientReaction();
      }

      if (!this.isUserTyping) {
        // Typing session began: show subtle listening/attention expression
        this.isUserTyping = true;
        this.typingStartTime = now;

        if (this.currentPriority <= EMOTION_PRIORITY.CONTEXTUAL) {
          this.setEmotion(VIBI_STATES.ATTENTIVE, {
            priority: EMOTION_PRIORITY.CONTEXTUAL,
            durationMs: 2500,
            force: true,
            preferences,
            metadata: { typing: true }
          });
        }
      } else {
        // Sustained typing session: react occasionally to longer typing activity (>3.5s)
        const sessionDuration = now - this.typingStartTime;
        if (sessionDuration > 3500 && (now - this.lastLongTypingReaction > 12000)) {
          this.lastLongTypingReaction = now;
          const longerTypingPool = [VIBI_STATES.HEAD_TILT, VIBI_STATES.LISTENING, VIBI_STATES.CURIOUS];
          const chosen = longerTypingPool[Math.floor(Math.random() * longerTypingPool.length)];
          this.setEmotion(chosen, {
            priority: EMOTION_PRIORITY.CONTEXTUAL,
            durationMs: 1400,
            force: true,
            preferences,
            metadata: { longTyping: true }
          });
        }
      }

      // Debounce the end of typing
      if (this.typingTimer) clearTimeout(this.typingTimer);
      this.typingTimer = setTimeout(() => {
        this.isUserTyping = false;
        this.typingStartTime = 0;
        // Gracefully revert to idle when user stops typing
        if (this.currentPriority <= EMOTION_PRIORITY.CONTEXTUAL) {
          this.idle();
        }
      }, 1600);
    };

    // 4. Scroll Activity Watcher (Throttled, subtle glance without interrupting scroll)
    const handleScrollActivity = () => {
      handleUserActivity();

      if (preferences.animations === false || this.isInactive || this.isTabHidden) {
        return;
      }

      const now = Date.now();
      if (now - this.lastScrollReactionTimestamp < this.scrollCooldownMs) {
        return;
      }

      // Don't interrupt typing, calls, or high-priority interactions
      if (this.currentPriority > EMOTION_PRIORITY.RANDOM_ACTIVITY || this.isUserTyping) {
        return;
      }

      this.lastScrollReactionTimestamp = now;

      // Brief subtle glance
      const scrollPool = [VIBI_STATES.LOOK_AROUND, VIBI_STATES.CURIOUS, VIBI_STATES.ATTENTIVE];
      const chosen = scrollPool[Math.floor(Math.random() * scrollPool.length)];

      this.setEmotion(chosen, {
        priority: EMOTION_PRIORITY.CONTEXTUAL,
        durationMs: 1400,
        force: false,
        preferences,
        metadata: { scrollReaction: true }
      });
    };

    // 5. Visibility Change
    const handleVisibilityChange = () => {
      this.isTabHidden = document.hidden;
      if (document.hidden) {
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
        if (this.ambientTimer) clearTimeout(this.ambientTimer);
        if (this.typingTimer) clearTimeout(this.typingTimer);
        this.isUserTyping = false;
      } else {
        handleUserActivity();
        this._scheduleAmbientMicroBehavior(preferences);
        if (preferences.welcome && preferences.animations !== false) {
          this.welcome({ preferences });
        }
      }
    };

    // 6. Real VibeGrid Event Listeners
    const handleCelebrateEvent = () => {
      if (preferences.animations !== false) {
        this.celebrate({ preferences });
      }
    };

    const handleCallEvent = () => {
      if (preferences.animations !== false) {
        this.setState(VIBI_STATES.LISTENING_SPEAKING, { durationMs: 4000, preferences });
      }
    };

    // Custom Emotion Trigger Event
    const handleCustomEmotion = (e) => {
      if (!e || !e.detail) return;
      const { emotion, priority, durationMs, force, metadata } = e.detail;
      if (emotion) {
        this.setEmotion(emotion, { priority, durationMs, force, metadata, preferences });
      }
    };

    const handleNewMessageEvent = () => {
      if (preferences.animations !== false) {
        const grouped = this.handleRapidEvent('message', preferences);
        if (!grouped) {
          this.newMessage({ preferences });
        }
      }
    };

    const handleNotificationEvent = (e) => {
      if (preferences.animations !== false) {
        const notifType = e?.detail?.type || 'notification';
        const grouped = this.handleRapidEvent(notifType, preferences);
        if (!grouped) {
          this.setEmotion(VIBI_STATES.NEW_MESSAGE, {
            priority: EMOTION_PRIORITY.CONTEXTUAL,
            durationMs: 2500,
            force: true,
            preferences,
            metadata: { notification: true, detail: e?.detail }
          });
        }
      }
    };

    const handleMissedCallEvent = () => {
      if (preferences.animations !== false) {
        this.missedCall({ preferences });
      }
    };

    const handleGroupInviteEvent = () => {
      if (preferences.animations !== false) {
        const grouped = this.handleRapidEvent('group_invite', preferences);
        if (!grouped) {
          this.groupInvitation({ preferences });
        }
      }
    };

    const handleJoinRequestEvent = () => {
      if (preferences.animations !== false) {
        this.joinRequest({ preferences });
      }
    };

    // Global DOM Event Listeners
    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('touchstart', handleDirectInteraction, { passive: true });
    window.addEventListener('mousedown', handleDirectInteraction, { passive: true });
    window.addEventListener('keydown', handleKeyActivity, { passive: true, capture: true });
    window.addEventListener('scroll', handleScrollActivity, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('vibegrid:emotion', handleCustomEmotion);
    window.addEventListener('vibegrid:celebrate', handleCelebrateEvent);
    window.addEventListener('vibegrid:initiate-call', handleCallEvent);
    window.addEventListener('vibegrid:new-message', handleNewMessageEvent);
    window.addEventListener('vibegrid:notification', handleNotificationEvent);
    window.addEventListener('vibegrid:missed-call', handleMissedCallEvent);
    window.addEventListener('vibegrid:group-invite', handleGroupInviteEvent);
    window.addEventListener('vibegrid:join-request', handleJoinRequestEvent);

    // Socket Service Real Event Listeners (if socketService is present)
    const handleSocketMessage = () => handleNewMessageEvent();
    const handleSocketMissedCall = () => handleMissedCallEvent();
    const handleSocketIncomingCall = () => {
      if (preferences.animations !== false) {
        this.surprised({ preferences });
      }
    };
    const handleSocketCallAccepted = () => {
      if (preferences.animations !== false) {
        this.listening({ preferences });
      }
    };
    const handleSocketCallEnded = () => {
      if (preferences.animations !== false) {
        this.happy({ preferences });
      }
    };
    const handleSocketCallRejected = () => {
      if (preferences.animations !== false) {
        this.concerned({ preferences });
      }
    };

    const handleSocketNotification = (notif) => {
      if (!notif) return;
      const type = notif.type || notif.notificationType;
      if (type === 'group_invite' || type === 'group:invite') {
        handleGroupInviteEvent();
      } else if (type === 'join_request' || type === 'group:join_request') {
        handleJoinRequestEvent();
      } else if (type === 'message') {
        handleNewMessageEvent();
      } else {
        handleNotificationEvent({ detail: notif });
      }
    };

    try {
      if (socketService && typeof socketService.on === 'function') {
        socketService.on('message:receive', handleSocketMessage);
        socketService.on('call:cancelled', handleSocketMissedCall);
        socketService.on('call:incoming', handleSocketIncomingCall);
        socketService.on('call:accepted', handleSocketCallAccepted);
        socketService.on('call:ended', handleSocketCallEnded);
        socketService.on('call:rejected', handleSocketCallRejected);
        socketService.on('notification:receive', handleSocketNotification);
      }
    } catch {}

    // Start inactivity countdown
    this.inactivityTimer = setTimeout(() => {
      if (!this.isTabHidden && preferences.animations !== false) {
        this.isInactive = true;
        this.setState(VIBI_STATES.SLEEPY, { durationMs: 0, force: true, preferences });
      }
    }, this.inactivityTimeoutMs);

    // Start ambient micro-behavior loop
    this._scheduleAmbientMicroBehavior(preferences);

    const cleanup = () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('touchstart', handleDirectInteraction);
      window.removeEventListener('mousedown', handleDirectInteraction);
      window.removeEventListener('keydown', handleKeyActivity, { capture: true });
      window.removeEventListener('scroll', handleScrollActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('vibegrid:emotion', handleCustomEmotion);
      window.removeEventListener('vibegrid:celebrate', handleCelebrateEvent);
      window.removeEventListener('vibegrid:initiate-call', handleCallEvent);
      window.removeEventListener('vibegrid:new-message', handleNewMessageEvent);
      window.removeEventListener('vibegrid:notification', handleNotificationEvent);
      window.removeEventListener('vibegrid:missed-call', handleMissedCallEvent);
      window.removeEventListener('vibegrid:group-invite', handleGroupInviteEvent);
      window.removeEventListener('vibegrid:join-request', handleJoinRequestEvent);

      try {
        if (socketService && typeof socketService.off === 'function') {
          socketService.off('message:receive', handleSocketMessage);
          socketService.off('call:cancelled', handleSocketMissedCall);
          socketService.off('call:incoming', handleSocketIncomingCall);
          socketService.off('call:accepted', handleSocketCallAccepted);
          socketService.off('call:ended', handleSocketCallEnded);
          socketService.off('call:rejected', handleSocketCallRejected);
          socketService.off('notification:receive', handleSocketNotification);
        }
      } catch {}

      if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
      if (this.revertTimer) clearTimeout(this.revertTimer);
      if (this.ambientTimer) clearTimeout(this.ambientTimer);
      if (this.typingTimer) clearTimeout(this.typingTimer);
      this.isUserTyping = false;
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

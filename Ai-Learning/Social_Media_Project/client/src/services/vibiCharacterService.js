/**
 * client/src/services/vibiCharacterService.js
 * ============================================
 * VIBGRID — VIBI AI ASSISTANT: DYNAMIC LIVING CHARACTER SERVICE
 *
 * Responsibilities:
 * 1. Manages Vibi's emotional & behavioral states (idle, listening, thinking, celebrate, etc.)
 * 2. Enforces anti-spam cooldowns and event priority to avoid annoying the user.
 * 3. Tracks user inactivity to trigger calm sleepy/wake-up micro-behaviors.
 * 4. Listens to VibeGrid system events (celebrations, calls, theme changes) and reacts intelligently.
 * 5. Manages drag coordinates, safe-edge docking (snapping), and collision boundaries.
 * 6. Respects user preferences (animations OFF, notifications OFF, reduced-motion).
 */

export const VIBI_STATES = Object.freeze({
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
  WAKE_UP: 'wake_up'
});

export const VIBI_DOCK_STORAGE_KEY = 'vibegrid_vibi_position';

// Safe margins in pixels to avoid covering navigation or screen edges
export const SAFE_MARGINS = {
  TOP: 60,
  BOTTOM: 84, // Clear bottom navigation (68px) + home bar
  LEFT: 16,
  RIGHT: 16
};

class VibiCharacterService {
  constructor() {
    this.currentState = VIBI_STATES.IDLE;
    this.lastReactionTimestamp = 0;
    this.cooldownDurationMs = 15000; // 15s between spontaneous ambient reactions
    this.revertTimer = null;
    this.inactivityTimer = null;
    this.blinkTimer = null;
    this.isInactive = false;
    this.isTabHidden = false;
    this.subscribers = new Set();
    this.inactivityTimeoutMs = 45000; // 45s of no interaction enters sleepy state
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
   * @param {string} newState - One of VIBI_STATES
   * @param {Object} [options={}]
   * @param {number} [options.durationMs=0] - Auto-revert to idle after duration (0 = sticky)
   * @param {boolean} [options.force=false] - Bypass anti-spam cooldown (for user-driven actions)
   * @param {Object} [options.metadata={}]
   * @returns {boolean} Whether transition was accepted
   */
  setState(newState, { durationMs = 0, force = false, metadata = {}, preferences = null } = {}) {
    // If animations are disabled in preferences, only accept IDLE
    if (preferences && preferences.animations === false && newState !== VIBI_STATES.IDLE) {
      return false;
    }

    // Anti-spam check for ambient reactions
    if (!force && durationMs > 0) {
      const now = Date.now();
      if (now - this.lastReactionTimestamp < this.cooldownDurationMs) {
        return false; // Still cooling down, suppress reaction
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

  /**
   * Trigger celebration on user success or completed action
   * @param {Object} [options={}]
   */
  celebrate(options = {}) {
    return this.setState(VIBI_STATES.CELEBRATE, {
      durationMs: 3000,
      force: true,
      ...options
    });
  }

  /**
   * Trigger happy/success reaction
   */
  happy(options = {}) {
    return this.setState(VIBI_STATES.SUCCESS, {
      durationMs: 2200,
      force: true,
      ...options
    });
  }

  /**
   * Trigger attentive listening reaction
   */
  listen(options = {}) {
    return this.setState(VIBI_STATES.LISTENING, {
      durationMs: 0, // sticky until input finishes
      force: true,
      ...options
    });
  }

  /**
   * Trigger thinking/processing reaction
   */
  think(options = {}) {
    return this.setState(VIBI_STATES.THINKING, {
      durationMs: 0,
      force: true,
      ...options
    });
  }

  /**
   * Trigger concerned/error reaction
   */
  concerned(options = {}) {
    return this.setState(VIBI_STATES.ERROR, {
      durationMs: 2800,
      force: true,
      ...options
    });
  }

  /**
   * Trigger welcome greeting
   */
  welcome(options = {}) {
    return this.setState(VIBI_STATES.WELCOME, {
      durationMs: 2500,
      force: true,
      ...options
    });
  }

  /**
   * Return to calm idle
   */
  idle() {
    if (this.revertTimer) {
      clearTimeout(this.revertTimer);
      this.revertTimer = null;
    }
    this.currentState = VIBI_STATES.IDLE;
    this._notify(this.currentState);
  }

  /**
   * Initialize ambient activity and visibility watchers
   * @param {Object} preferences - User preferences
   * @returns {Function} cleanup function
   */
  initActivityWatchers(preferences = {}) {
    if (typeof window === 'undefined') return () => {};

    const handleUserActivity = () => {
      if (this.isInactive) {
        this.isInactive = false;
        // If waking up from sleepy state, briefly wave/stretch then idle
        if (this.currentState === VIBI_STATES.SLEEPY) {
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
    };

    const handleVisibilityChange = () => {
      this.isTabHidden = document.hidden;
      if (document.hidden) {
        // Tab hidden: freeze timers and enter calm state
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
      } else {
        // User returned to tab: short friendly greeting if enabled
        handleUserActivity();
        if (preferences.welcome && preferences.animations !== false) {
          this.welcome({ preferences });
        }
      }
    };

    // System event listeners for contextual awareness
    const handleCelebrateEvent = () => {
      if (preferences.animations !== false) {
        this.celebrate();
      }
    };

    const handleCallEvent = () => {
      if (preferences.animations !== false) {
        this.setState(VIBI_STATES.LISTENING, { durationMs: 4000 });
      }
    };

    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('touchstart', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('vibegrid:celebrate', handleCelebrateEvent);
    window.addEventListener('vibegrid:initiate-call', handleCallEvent);

    // Initial inactivity timer
    this.inactivityTimer = setTimeout(() => {
      if (!this.isTabHidden && preferences.animations !== false) {
        this.isInactive = true;
        this.setState(VIBI_STATES.SLEEPY, { durationMs: 0, force: true });
      }
    }, this.inactivityTimeoutMs);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('vibegrid:celebrate', handleCelebrateEvent);
      window.removeEventListener('vibegrid:initiate-call', handleCallEvent);
      if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
      if (this.revertTimer) clearTimeout(this.revertTimer);
    };
  }

  /**
   * Read stored position or calculate default bottom-right docked position
   * @param {number} [itemWidth=120]
   * @param {number} [itemHeight=48]
   * @returns {{ x: number, y: number, isLeftDocked: boolean }}
   */
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
        // Clamp within current viewport in case screen resized or orientation changed
        const clamped = this.clampPosition(x, y, itemWidth, itemHeight);
        const isLeftDocked = clamped.x < screenWidth / 2;
        return { ...clamped, isLeftDocked };
      }
    } catch {}

    // Default: bottom-right corner docked above bottom bar
    const defaultX = screenWidth - itemWidth - SAFE_MARGINS.RIGHT;
    const defaultY = screenHeight - itemHeight - SAFE_MARGINS.BOTTOM;
    return {
      x: Math.max(SAFE_MARGINS.LEFT, defaultX),
      y: Math.max(SAFE_MARGINS.TOP, defaultY),
      isLeftDocked: false
    };
  }

  /**
   * Save docked position
   * @param {number} x
   * @param {number} y
   */
  saveDockPosition(x, y) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(VIBI_DOCK_STORAGE_KEY, JSON.stringify({ x: Math.round(x), y: Math.round(y) }));
    } catch {}
  }

  /**
   * Reset position to default
   */
  resetDockPosition() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(VIBI_DOCK_STORAGE_KEY);
    } catch {}
  }

  /**
   * Clamp x, y coordinates strictly within screen collision boundaries
   * @param {number} x
   * @param {number} y
   * @param {number} itemWidth
   * @param {number} itemHeight
   * @returns {{ x: number, y: number }}
   */
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

  /**
   * Calculate snapping to nearest safe edge (left or right)
   * @param {number} x
   * @param {number} y
   * @param {number} itemWidth
   * @param {number} itemHeight
   * @returns {{ x: number, y: number, isLeftDocked: boolean }}
   */
  snapToEdge(x, y, itemWidth = 120, itemHeight = 48) {
    if (typeof window === 'undefined') {
      return { x, y, isLeftDocked: false };
    }

    const screenWidth = window.innerWidth;
    const clamped = this.clampPosition(x, y, itemWidth, itemHeight);

    // Snap to left or right edge
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

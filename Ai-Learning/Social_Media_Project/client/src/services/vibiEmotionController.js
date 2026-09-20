/**
 * client/src/services/vibiEmotionController.js
 * =============================================
 * VIBGRID — CENTRALIZED VIBI EMOTION CONTROLLER
 *
 * Single Source of Truth for Vibi's 20 Distinct Emotional States:
 * IDLE, WELCOME, ATTENTIVE, LISTENING, THINKING, CURIOUS,
 * HAPPY, EXCITED, PLAYFUL, SURPRISED, CONFUSED, CONCERNED,
 * SAD, FRUSTRATED, PROUD, SUCCESS, ERROR, CELEBRATING,
 * SLEEPY, RESPONDING.
 *
 * Each emotion defines exact visual specifications:
 * - expression / eye movement
 * - ear movement / positioning
 * - mouth shape / expression
 * - head movement / tilt / nod
 * - body movement / posture
 * - tail movement (swish, wag, relaxed)
 * - V emblem / core reaction (color, glow filter, pulse rate)
 */

export const VIBI_EMOTIONS = Object.freeze({
  IDLE: 'idle',
  WELCOME: 'welcome',
  ATTENTIVE: 'attentive',
  LISTENING: 'listening',
  THINKING: 'thinking',
  CURIOUS: 'curious',
  HAPPY: 'happy',
  EXCITED: 'excited',
  PLAYFUL: 'playful',
  SURPRISED: 'surprised',
  CONFUSED: 'confused',
  CONCERNED: 'concerned',
  SAD: 'sad',
  FRUSTRATED: 'frustrated',
  PROUD: 'proud',
  SUCCESS: 'success',
  ERROR: 'error',
  CELEBRATING: 'celebrating',
  SLEEPY: 'sleepy',
  RESPONDING: 'responding'
});

export const EMOTION_CONFIGS = Object.freeze({
  [VIBI_EMOTIONS.IDLE]: {
    name: 'Idle',
    description: 'Gentle breathing, natural blinking, relaxed tail',
    eyes: 'natural_open',
    ears: 'relaxed_upright',
    mouth: 'neutral_gentle',
    head: 'neutral_stable',
    body: 'gentle_breathing',
    tail: 'relaxed_swish',
    vEmblem: {
      primaryColor: '#FFA000',
      secondaryColor: '#FF5500',
      pulseDuration: '2.4s',
      glowIntensity: 'medium'
    },
    badge: null,
    defaultPriority: 0,
    defaultDurationMs: 0
  },
  [VIBI_EMOTIONS.WELCOME]: {
    name: 'Welcome',
    description: 'Looks toward user, friendly smile, enthusiastic waving arm & bounce',
    eyes: 'warm_crescents',
    ears: 'alert_upward',
    mouth: 'joyful_smile',
    head: 'friendly_bob',
    body: 'subtle_lift',
    tail: 'cheerful_swish',
    vEmblem: {
      primaryColor: '#F59E0B',
      secondaryColor: '#D97706',
      pulseDuration: '1.6s',
      glowIntensity: 'high'
    },
    badge: '👋',
    defaultPriority: 3,
    defaultDurationMs: 2800
  },
  [VIBI_EMOTIONS.ATTENTIVE]: {
    name: 'Attentive',
    description: 'Ears up, eyes focused toward event, small alert movement',
    eyes: 'wide_specular_focus',
    ears: 'perked_high',
    mouth: 'neutral_firm',
    head: 'perk_forward',
    body: 'alert_still',
    tail: 'held_horizontal',
    vEmblem: {
      primaryColor: '#00E5FF',
      secondaryColor: '#0284C7',
      pulseDuration: '1.8s',
      glowIntensity: 'high'
    },
    badge: '💬',
    defaultPriority: 3,
    defaultDurationMs: 2500
  },
  [VIBI_EMOTIONS.LISTENING]: {
    name: 'Listening',
    description: 'Eyes focused, ears angled forward, subtle listening nod',
    eyes: 'receptive_focus',
    ears: 'forward_listening',
    mouth: 'receptive_o',
    head: 'gentle_listening_nod',
    body: 'slight_lean_in',
    tail: 'slow_calm_swish',
    vEmblem: {
      primaryColor: '#00E5FF',
      secondaryColor: '#0369A1',
      pulseDuration: '1.5s',
      glowIntensity: 'high'
    },
    badge: '🎧',
    defaultPriority: 3,
    defaultDurationMs: 0
  },
  [VIBI_EMOTIONS.THINKING]: {
    name: 'Thinking',
    description: 'Eyes look upward, head tilt, ears move slightly, slower rhythmic pulse',
    eyes: 'looking_upward',
    ears: 'slight_curious_angle',
    mouth: 'thoughtful_pucker',
    head: 'inquisitive_tilt',
    body: 'floating_hover',
    tail: 'slow_pendulum',
    vEmblem: {
      primaryColor: '#38BDF8',
      secondaryColor: '#0284C7',
      pulseDuration: '1.3s',
      glowIntensity: 'high'
    },
    badge: '💡',
    defaultPriority: 3,
    defaultDurationMs: 0
  },
  [VIBI_EMOTIONS.CURIOUS]: {
    name: 'Curious',
    description: 'Strong head tilt, ears raised, eyes looking around inquisitively',
    eyes: 'inquisitive_brows_open',
    ears: 'perked_asymmetric',
    mouth: 'curious_perk',
    head: 'strong_side_tilt',
    body: 'curious_lean',
    tail: 'lively_swish',
    vEmblem: {
      primaryColor: '#818CF8',
      secondaryColor: '#4F46E5',
      pulseDuration: '1.7s',
      glowIntensity: 'medium'
    },
    badge: '❓',
    defaultPriority: 2,
    defaultDurationMs: 2400
  },
  [VIBI_EMOTIONS.HAPPY]: {
    name: 'Happy',
    description: 'Clear radiant smile, bright crescent eyes, enthusiastic tail wag, small bounce',
    eyes: 'happy_crescents',
    ears: 'upright_cheerful',
    mouth: 'radiant_smile',
    head: 'happy_sway',
    body: 'light_bounce',
    tail: 'fast_happy_wag',
    vEmblem: {
      primaryColor: '#FBBF24',
      secondaryColor: '#D97706',
      pulseDuration: '1.4s',
      glowIntensity: 'high'
    },
    badge: '✨',
    defaultPriority: 2,
    defaultDurationMs: 2400
  },
  [VIBI_EMOTIONS.EXCITED]: {
    name: 'Excited',
    description: 'Energetic bounce, ears up, rapid tail wagging, radiant core',
    eyes: 'sparkling_wide',
    ears: 'high_alert_flutter',
    mouth: 'open_cheer',
    head: 'rapid_perk_bob',
    body: 'energetic_bounce',
    tail: 'rapid_tail_wag',
    vEmblem: {
      primaryColor: '#F59E0B',
      secondaryColor: '#B45309',
      pulseDuration: '0.85s',
      glowIntensity: 'maximum'
    },
    badge: '🎉',
    defaultPriority: 4,
    defaultDurationMs: 2600
  },
  [VIBI_EMOTIONS.PLAYFUL]: {
    name: 'Playful',
    description: 'Playful head movement, wink, small bounce, cheeky expression',
    eyes: 'cheeky_wink_star',
    ears: 'swaying_perk',
    mouth: 'playful_smirk',
    head: 'cocked_playful_wobble',
    body: 'playful_shifty',
    tail: 'bouncy_wag',
    vEmblem: {
      primaryColor: '#FB7185',
      secondaryColor: '#E11D48',
      pulseDuration: '1.2s',
      glowIntensity: 'high'
    },
    badge: '🌸',
    defaultPriority: 2,
    defaultDurationMs: 2200
  },
  [VIBI_EMOTIONS.SURPRISED]: {
    name: 'Surprised',
    description: 'Eyes widen, ears rise quickly, quick startled body reaction',
    eyes: 'startled_wide_specular',
    ears: 'snap_straight_up',
    mouth: 'wide_open_o',
    head: 'snap_back_rise',
    body: 'startled_lift',
    tail: 'fluffed_raised',
    vEmblem: {
      primaryColor: '#F97316',
      secondaryColor: '#C2410C',
      pulseDuration: '0.9s',
      glowIntensity: 'maximum'
    },
    badge: '❗',
    defaultPriority: 5,
    defaultDurationMs: 2200
  },
  [VIBI_EMOTIONS.CONFUSED]: {
    name: 'Confused',
    description: 'Head tilt, uneven ear position, questioning quizzical expression',
    eyes: 'asymmetric_quizzical',
    ears: 'uneven_ear_angle',
    mouth: 'sideways_smirk',
    head: 'quizzical_wobble',
    body: 'hesitant_hover',
    tail: 'still_twitching',
    vEmblem: {
      primaryColor: '#A78BFA',
      secondaryColor: '#7C3AED',
      pulseDuration: '2.0s',
      glowIntensity: 'medium'
    },
    badge: '❓',
    defaultPriority: 2,
    defaultDurationMs: 2500
  },
  [VIBI_EMOTIONS.CONCERNED]: {
    name: 'Concerned',
    description: 'Softer empathetic eyes, ears slightly lowered, worried expression',
    eyes: 'empathic_droop',
    ears: 'slightly_lowered',
    mouth: 'soft_worried_pout',
    head: 'concerned_lean_down',
    body: 'protective_tuck',
    tail: 'low_gentle_flick',
    vEmblem: {
      primaryColor: '#F59E0B',
      secondaryColor: '#D97706',
      pulseDuration: '2.2s',
      glowIntensity: 'medium'
    },
    badge: '💧',
    defaultPriority: 4,
    defaultDurationMs: 2800
  },
  [VIBI_EMOTIONS.SAD]: {
    name: 'Sad',
    description: 'Lowered drooped ears, softer drooped eyes, slow depressed movement',
    eyes: 'sad_droop_shaded',
    ears: 'fully_lowered_droop',
    mouth: 'drooped_sad_curve',
    head: 'drooped_downward',
    body: 'deflated_slump',
    tail: 'tucked_tail_down',
    vEmblem: {
      primaryColor: '#60A5FA',
      secondaryColor: '#1D4ED8',
      pulseDuration: '3.5s',
      glowIntensity: 'low'
    },
    badge: '🥺',
    defaultPriority: 2,
    defaultDurationMs: 2800
  },
  [VIBI_EMOTIONS.FRUSTRATED]: {
    name: 'Frustrated',
    description: 'Brief annoyed expression, ears pinned back, determined furrowed brow and head shake',
    eyes: 'furrowed_annoyed_glare',
    ears: 'pinned_backward',
    mouth: 'tight_pressed_line',
    head: 'frustrated_side_shake',
    body: 'stiff_tense',
    tail: 'sharp_angry_swish',
    vEmblem: {
      primaryColor: '#EF4444',
      secondaryColor: '#991B1B',
      pulseDuration: '1.0s',
      glowIntensity: 'maximum'
    },
    badge: '💢',
    defaultPriority: 3,
    defaultDurationMs: 2400
  },
  [VIBI_EMOTIONS.PROUD]: {
    name: 'Proud',
    description: 'Confident smile, chest slightly forward, tail proudly raised, regal poise',
    eyes: 'confident_squints',
    ears: 'tall_regal_erect',
    mouth: 'satisfied_grin',
    head: 'chin_raised_up',
    body: 'chest_forward_puff',
    tail: 'high_arching_tail',
    vEmblem: {
      primaryColor: '#FBBF24',
      secondaryColor: '#B45309',
      pulseDuration: '1.5s',
      glowIntensity: 'high'
    },
    badge: '⭐',
    defaultPriority: 2,
    defaultDurationMs: 2600
  },
  [VIBI_EMOTIONS.SUCCESS]: {
    name: 'Success',
    description: 'Happy fulfilled expression, small celebratory bounce, emerald-gold glowing core',
    eyes: 'radiant_sparkle_crescents',
    ears: 'perked_joyful',
    mouth: 'victorious_smile',
    head: 'triumphant_nod',
    body: 'victorious_hop',
    tail: 'merry_wag',
    vEmblem: {
      primaryColor: '#10B981',
      secondaryColor: '#059669',
      pulseDuration: '1.1s',
      glowIntensity: 'maximum'
    },
    badge: '✅',
    defaultPriority: 3,
    defaultDurationMs: 2400
  },
  [VIBI_EMOTIONS.ERROR]: {
    name: 'Error',
    description: 'Concerned alert expression, small shiver/shake, lowered ears, coral warning core',
    eyes: 'alarmed_wide',
    ears: 'twitching_lowered',
    mouth: 'firm_alarm_line',
    head: 'shiver_recoil',
    body: 'tense_alarm_shiver',
    tail: 'stiff_down',
    vEmblem: {
      primaryColor: '#DC2626',
      secondaryColor: '#7F1D1D',
      pulseDuration: '0.8s',
      glowIntensity: 'maximum'
    },
    badge: '⚠️',
    defaultPriority: 6,
    defaultDurationMs: 2800
  },
  [VIBI_EMOTIONS.CELEBRATING]: {
    name: 'Celebrating',
    description: 'Jump, both paws raised up in victory, energetic tail wag, celebration aura',
    eyes: 'star_burst_joy',
    ears: 'dancing_flutter',
    mouth: 'cheering_open',
    head: 'celebration_bob',
    body: 'full_air_jump',
    tail: 'super_speed_wag',
    vEmblem: {
      primaryColor: '#F59E0B',
      secondaryColor: '#EC4899',
      pulseDuration: '0.75s',
      glowIntensity: 'maximum'
    },
    badge: '🎊',
    defaultPriority: 4,
    defaultDurationMs: 3200
  },
  [VIBI_EMOTIONS.SLEEPY]: {
    name: 'Sleepy',
    description: 'Slow blinking, drooping ears, slow calm breathing, lavender dream core',
    eyes: 'drooping_lashes_closed',
    ears: 'soft_drooped_ears',
    mouth: 'gentle_slumber_rest',
    head: 'slow_drifting_nod',
    body: 'deep_sleep_breathing',
    tail: 'curled_resting',
    vEmblem: {
      primaryColor: '#C084FC',
      secondaryColor: '#7C3AED',
      pulseDuration: '4.5s',
      glowIntensity: 'low'
    },
    badge: '💤',
    defaultPriority: 1,
    defaultDurationMs: 0
  },
  [VIBI_EMOTIONS.RESPONDING]: {
    name: 'Responding',
    description: 'Active eyes, subtle animated mouth movement, conversational head cadence, pulsing V core',
    eyes: 'engaging_bright',
    ears: 'attuned_forward',
    mouth: 'animated_conversational',
    head: 'conversational_cadence',
    body: 'attentive_hover',
    tail: 'engaged_rhythmic_swish',
    vEmblem: {
      primaryColor: '#06B6D4',
      secondaryColor: '#0891B2',
      pulseDuration: '1.1s',
      glowIntensity: 'high'
    },
    badge: '💭',
    defaultPriority: 3,
    defaultDurationMs: 0
  }
});

class VibiEmotionController {
  constructor() {
    this.currentEmotion = VIBI_EMOTIONS.IDLE;
    this.currentPriority = 0;
    this.revertTimer = null;
    this.subscribers = new Set();
    this.history = [];
    this.maxHistoryLength = 25;
  }

  /**
   * Get list of all 20 supported emotions
   * @returns {string[]}
   */
  getAllEmotions() {
    return Object.values(VIBI_EMOTIONS);
  }

  /**
   * Get current active emotion string
   * @returns {string}
   */
  getEmotion() {
    return this.currentEmotion;
  }

  /**
   * Get detailed visual specification for an emotion
   * @param {string} [emotion]
   * @returns {Object}
   */
  getEmotionConfig(emotion = null) {
    const key = emotion ? String(emotion).toLowerCase().trim() : this.currentEmotion;
    return EMOTION_CONFIGS[key] || EMOTION_CONFIGS[VIBI_EMOTIONS.IDLE];
  }

  /**
   * Subscribe to emotion changes
   * @param {Function} callback - (emotion, config, metadata) => void
   * @returns {Function} unsubscribe
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers
   */
  _notify(metadata = {}) {
    const config = this.getEmotionConfig(this.currentEmotion);
    this.subscribers.forEach((cb) => {
      try {
        cb(this.currentEmotion, config, metadata);
      } catch (err) {
        console.error('[VibiEmotionController] Subscriber error:', err);
      }
    });
  }

  /**
   * Set emotion state with priority, duration auto-revert, and metadata
   *
   * @param {string} emotion - One of 20 VIBI_EMOTIONS
   * @param {Object} [options={}]
   * @param {number} [options.priority]
   * @param {number} [options.durationMs]
   * @param {boolean} [options.force=false]
   * @param {Object} [options.metadata={}]
   * @returns {boolean} Whether transition succeeded
   */
  setEmotion(emotion, { priority, durationMs, force = false, metadata = {} } = {}) {
    const targetEmotion = String(emotion || '').toLowerCase().trim();
    const config = EMOTION_CONFIGS[targetEmotion];

    if (!config) {
      console.warn(`[VibiEmotionController] Unknown emotion '${emotion}', falling back to IDLE`);
      return false;
    }

    const targetPriority = typeof priority === 'number' ? priority : config.defaultPriority;
    const targetDuration = typeof durationMs === 'number' ? durationMs : config.defaultDurationMs;

    if (!force && targetPriority < this.currentPriority) {
      return false; // Priority rejection
    }

    if (this.revertTimer) {
      clearTimeout(this.revertTimer);
      this.revertTimer = null;
    }

    const previousEmotion = this.currentEmotion;
    this.currentEmotion = targetEmotion;
    this.currentPriority = targetPriority;

    // Record transition history
    this.history.unshift({
      from: previousEmotion,
      to: targetEmotion,
      priority: targetPriority,
      durationMs: targetDuration,
      timestamp: Date.now()
    });
    if (this.history.length > this.maxHistoryLength) {
      this.history.pop();
    }

    this._notify({ previousEmotion, ...metadata });

    // Auto-revert back to IDLE if duration was specified
    if (targetDuration > 0 && targetEmotion !== VIBI_EMOTIONS.IDLE) {
      this.revertTimer = setTimeout(() => {
        this.resetToIdle({ autoReverted: true });
      }, targetDuration);
    }

    return true;
  }

  /**
   * Reset back to IDLE state
   * @param {Object} [metadata={}]
   */
  resetToIdle(metadata = {}) {
    if (this.revertTimer) {
      clearTimeout(this.revertTimer);
      this.revertTimer = null;
    }
    this.currentEmotion = VIBI_EMOTIONS.IDLE;
    this.currentPriority = 0;
    this._notify({ reset: true, ...metadata });
    return true;
  }

  /**
   * Return recent transition history
   * @returns {Array}
   */
  getHistory() {
    return [...this.history];
  }
}

const vibiEmotionController = new VibiEmotionController();
export default vibiEmotionController;

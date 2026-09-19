/**
 * client/src/services/vibiAssetRegistry.js
 * ==========================================
 * VIBGRID — VIBI AI ASSISTANT: ASSET REGISTRY & MANIFEST ADAPTER
 *
 * Maps all 36 dynamic character states from VIBI_ANTIGRAVITY_MANIFEST.json
 * to WebP animated image paths and transparent PNG frame sequences.
 */

export const VIBI_ASSETS_BASE = '/assets/vibi';

// Canonical manifest states
export const MANIFEST_STATES = Object.freeze({
  BLINK: 'blink',
  CELEBRATING: 'celebrating',
  CURIOUS: 'curious',
  DOCKING_SNAP: 'docking_snap',
  DOCKING_SNAP_ALT: 'docking_snap_alt',
  DRAGGING_MOVE: 'dragging_move',
  DRAGGING_MOVE_ALT: 'dragging_move_alt',
  EXCITED: 'excited',
  FOCUSED: 'focused',
  GENTLE_BOUNCE: 'gentle_bounce',
  GROUP_INVITATION: 'group_invitation',
  HAPPY_RESPONSE: 'happy_response',
  HEAD_TILT: 'head_tilt',
  IDLE_FLOATING: 'idle_floating',
  IMPORTANT_ACTIVITY: 'important_activity',
  JOIN_REQUEST: 'join_request',
  LISTENING: 'listening',
  LISTENING_SPEAKING: 'listening_speaking',
  LOOK_AROUND: 'look_around',
  MISSED_CALL: 'missed_call',
  NEW_MESSAGE: 'new_message',
  PEEK_AND_WAVE: 'peek_and_wave',
  PEEK_AND_WAVE_ALT: 'peek_and_wave_alt',
  PEEK_FROM_EDGE: 'peek_from_edge',
  PEEK_FROM_EDGE_ALT: 'peek_from_edge_alt',
  QUESTION: 'question',
  RESPONDING_TALKING: 'responding_talking',
  SLEEPING: 'sleeping',
  SLEEPING_ALT: 'sleeping_alt',
  SURPRISED: 'surprised',
  TAIL_WAG: 'tail_wag',
  THINKING: 'thinking',
  TYPING_PROCESSING: 'typing_processing',
  VIBI_NOTICED_YOU: 'vibi_noticed_you',
  WAKE_UP: 'wake_up',
  WAKE_UP_ALT: 'wake_up_alt'
});

// Friendly aliases to canonical states
export const STATE_ALIASES = Object.freeze({
  idle: MANIFEST_STATES.IDLE_FLOATING,
  celebrate: MANIFEST_STATES.CELEBRATING,
  celebrating: MANIFEST_STATES.CELEBRATING,
  success: MANIFEST_STATES.HAPPY_RESPONSE,
  happy: MANIFEST_STATES.HAPPY_RESPONSE,
  excited: MANIFEST_STATES.EXCITED,
  curious: MANIFEST_STATES.CURIOUS,
  thinking: MANIFEST_STATES.THINKING,
  listening: MANIFEST_STATES.LISTENING,
  surprised: MANIFEST_STATES.SURPRISED,
  sad: MANIFEST_STATES.QUESTION,
  confused: MANIFEST_STATES.QUESTION,
  frustrated: MANIFEST_STATES.QUESTION,
  proud: MANIFEST_STATES.HAPPY_RESPONSE,
  attentive: MANIFEST_STATES.FOCUSED,
  playful: MANIFEST_STATES.GENTLE_BOUNCE,
  sleepy: MANIFEST_STATES.SLEEPING,
  welcome: MANIFEST_STATES.PEEK_AND_WAVE,
  responding: MANIFEST_STATES.RESPONDING_TALKING,
  typing: MANIFEST_STATES.TYPING_PROCESSING,
  error: MANIFEST_STATES.QUESTION,
  concerned: MANIFEST_STATES.QUESTION,
  dragging: MANIFEST_STATES.DRAGGING_MOVE,
  docking: MANIFEST_STATES.DOCKING_SNAP,
  bounce: MANIFEST_STATES.GENTLE_BOUNCE,
  wave: MANIFEST_STATES.PEEK_AND_WAVE,
  look: MANIFEST_STATES.LOOK_AROUND,
  call: MANIFEST_STATES.LISTENING_SPEAKING
});

// Frame count per state from manifest (all 12 frames except blink with 8)
export const STATE_CONFIG = Object.freeze({
  [MANIFEST_STATES.BLINK]: { frames: 8, durationMs: 75 },
  default: { frames: 12, durationMs: 75 }
});

/**
 * Resolves any mood or state string to canonical manifest state
 * @param {string} moodOrState
 * @returns {string}
 */
export function resolveCanonicalState(moodOrState) {
  if (!moodOrState) return MANIFEST_STATES.IDLE_FLOATING;
  const lower = String(moodOrState).toLowerCase().trim();
  if (STATE_ALIASES[lower]) {
    return STATE_ALIASES[lower];
  }
  const manifestValues = Object.values(MANIFEST_STATES);
  if (manifestValues.includes(lower)) {
    return lower;
  }
  return MANIFEST_STATES.IDLE_FLOATING;
}

/**
 * Gets WebP and frame URLs for a given state or mood
 * @param {string} moodOrState
 * @param {string} [basePath=VIBI_ASSETS_BASE]
 * @returns {{ state: string, webpUrl: string, frameUrls: string[], frameCount: number, durationMs: number }}
 */
export function getVibiAsset(moodOrState, basePath = VIBI_ASSETS_BASE) {
  const state = resolveCanonicalState(moodOrState);
  const config = STATE_CONFIG[state] || STATE_CONFIG.default;
  const frameCount = config.frames;
  const durationMs = config.durationMs;

  const webpUrl = `${basePath}/vibi_webp/${state}.webp`;
  const frameUrls = [];
  for (let i = 0; i < frameCount; i++) {
    const padded = String(i).padStart(2, '0');
    frameUrls.push(`${basePath}/vibi_frames/${state}/${padded}.png`);
  }

  return {
    state,
    webpUrl,
    frameUrls,
    frameCount,
    durationMs
  };
}

export default {
  MANIFEST_STATES,
  STATE_ALIASES,
  resolveCanonicalState,
  getVibiAsset,
  VIBI_ASSETS_BASE
};

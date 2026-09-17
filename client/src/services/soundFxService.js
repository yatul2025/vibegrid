/**
 * soundFxService.js
 * =================
 * Phase 9 Option 6: Unified VibeGrid Sound Engine
 *
 * Capabilities:
 * - 100% Native Web Audio API procedural synthesis (0 kB external media files)
 * - Zero network latency & full offline availability
 * - Autoplay compliance: auto-unlocks AudioContext on first user touch/click/key
 * - 5 Sound Themes / Packs: Modern (default), Kalimba, Retro 8-bit, Cyber, Minimalist
 * - 7 Core UI Events: like, send, receive, reaction, toggle, celebration, refresh
 * - Reactive state persistence via localStorage with pub/sub subscriber support
 * - Master volume control (0.0 to 1.0) and global mute toggle
 * - Safe for SSR and unit testing environments
 */

const STORAGE_KEY_ENABLED = 'vibegrid_sound_enabled';
const STORAGE_KEY_PACK = 'vibegrid_sound_pack';
const STORAGE_KEY_VOLUME = 'vibegrid_sound_volume';

export const SOUND_PACKS = [
  {
    id: 'modern',
    name: 'Modern Neo-Digital',
    icon: '🫧',
    description: 'Crisp bubble pops, crystal glass chimes & airy whooshes (iOS/macOS style).'
  },
  {
    id: 'kalimba',
    name: 'Warm Kalimba & Marimba',
    icon: '🪵',
    description: 'Natural wooden resonance, gentle kalimba tines & organic bamboo clicks.'
  },
  {
    id: 'retro',
    name: 'Retro 8-Bit Arcade',
    icon: '👾',
    description: 'Classic chiptune square waves, coin pings & nostalgic arcade fanfares.'
  },
  {
    id: 'cyber',
    name: 'Futuristic Cyber Ambient',
    icon: '⚡',
    description: 'Sub-bass impacts, holographic sonar pings & crystalline laser blips.'
  },
  {
    id: 'minimal',
    name: 'Minimalist Tactile Clicks',
    icon: '🎛️',
    description: 'Subtle camera shutter clicks, precision rotary detents & mechanical switches.'
  }
];

class SoundFxService {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.subscribers = new Set();
    this.isUnlocked = false;

    // Load initial preferences
    this.enabled = this._loadEnabled();
    this.pack = this._loadPack();
    this.volume = this._loadVolume();

    // Auto-unlock on first user interaction in browser
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this._initContext();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        this.isUnlocked = true;
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
        window.removeEventListener('touchstart', unlock, true);
      };

      window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
      window.addEventListener('keydown', unlock, { capture: true, passive: true });
      window.addEventListener('touchstart', unlock, { capture: true, passive: true });
    }
  }

  // ==========================================
  // Storage & State
  // ==========================================
  _loadEnabled() {
    if (typeof window === 'undefined' || !window.localStorage) return true;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_ENABLED);
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  }

  _loadPack() {
    if (typeof window === 'undefined' || !window.localStorage) return 'modern';
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_PACK);
      return SOUND_PACKS.some((p) => p.id === stored) ? stored : 'modern';
    } catch {
      return 'modern';
    }
  }

  _loadVolume() {
    if (typeof window === 'undefined' || !window.localStorage) return 0.7;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_VOLUME);
      const parsed = parseFloat(stored);
      return !isNaN(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.7;
    } catch {
      return 0.7;
    }
  }

  _notify() {
    const state = {
      enabled: this.enabled,
      pack: this.pack,
      volume: this.volume
    };
    this.subscribers.forEach((callback) => {
      try {
        callback(state);
      } catch (err) {
        console.warn('SoundFx subscriber error:', err);
      }
    });
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback({
      enabled: this.enabled,
      pack: this.pack,
      volume: this.volume
    });
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // ==========================================
  // Controls
  // ==========================================
  isEnabled() {
    return this.enabled;
  }

  setEnabled(val) {
    this.enabled = Boolean(val);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_ENABLED, String(this.enabled));
      }
    } catch {}
    this._updateMasterGain();
    this._notify();
  }

  toggleEnabled() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  getPack() {
    return this.pack;
  }

  setPack(packId) {
    if (!SOUND_PACKS.some((p) => p.id === packId)) return;
    this.pack = packId;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_PACK, packId);
      }
    } catch {}
    this._notify();
  }

  getVolume() {
    return this.volume;
  }

  setVolume(val) {
    const clamped = Math.max(0, Math.min(1, parseFloat(val) || 0));
    this.volume = clamped;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_VOLUME, String(clamped));
      }
    } catch {}
    this._updateMasterGain();
    this._notify();
  }

  getPacks() {
    return SOUND_PACKS;
  }

  // ==========================================
  // Audio Context Core
  // ==========================================
  _initContext() {
    if (this.audioCtx) return this.audioCtx;
    if (typeof window === 'undefined') return null;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    try {
      this.audioCtx = new AudioContextClass();
      this.masterGain = this.audioCtx.createGain();
      this._updateMasterGain();
      this.masterGain.connect(this.audioCtx.destination);
    } catch (err) {
      console.warn('AudioContext initialization error:', err);
      this.audioCtx = null;
    }

    return this.audioCtx;
  }

  _updateMasterGain() {
    if (!this.masterGain || !this.audioCtx) return;
    const targetGain = this.enabled ? this.volume : 0;
    try {
      this.masterGain.gain.setValueAtTime(targetGain, this.audioCtx.currentTime);
    } catch {}
  }

  _createGain(startGain = 0.3) {
    if (!this.audioCtx || !this.masterGain) return null;
    try {
      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(startGain, this.audioCtx.currentTime);
      gain.connect(this.masterGain);
      return gain;
    } catch {
      return null;
    }
  }

  // ==========================================
  // Public Play Trigger
  // ==========================================
  play(eventType, packOverride = null) {
    if (!this.enabled && !packOverride) return;
    const ctx = this._initContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const selectedPack = packOverride || this.pack;

    try {
      switch (selectedPack) {
        case 'kalimba':
          this._playKalimba(ctx, eventType);
          break;
        case 'retro':
          this._playRetro(ctx, eventType);
          break;
        case 'cyber':
          this._playCyber(ctx, eventType);
          break;
        case 'minimal':
          this._playMinimal(ctx, eventType);
          break;
        case 'modern':
        default:
          this._playModern(ctx, eventType);
          break;
      }
    } catch (err) {
      console.warn(`[SoundFxService] Error playing ${eventType}:`, err);
    }
  }

  // ==========================================
  // Pack 1: Modern Neo-Digital
  // ==========================================
  _playModern(ctx, type) {
    const now = ctx.currentTime;
    if (type === 'like') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.35);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'send') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.25);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.14);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === 'receive') {
      [1318.5, 1975.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = this._createGain(0.2 - i * 0.05);
        if (!gain) return;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);
        gain.gain.setValueAtTime(0.2, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.38);
        osc.connect(gain);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.38);
      });
    } else if (type === 'reaction') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.3);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.04);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.09);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (type === 'toggle') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.25);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.035);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.035);
    } else if (type === 'celebration') {
      [1046.5, 1318.5, 1567.98, 2093.0].forEach((freq, idx) => {
        const t = now + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = this._createGain(0.2);
        if (!gain) return;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.45);
      });
    } else if (type === 'refresh') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.2);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.02);
    }
  }

  // ==========================================
  // Pack 2: Warm Kalimba & Marimba
  // ==========================================
  _playKalimba(ctx, type) {
    const now = ctx.currentTime;
    if (type === 'like') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.35);
      if (!gain) return;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'send') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.28);
      if (!gain) return;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(392.0, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.14);
    } else if (type === 'receive') {
      [523.25, 783.99].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = this._createGain(0.22);
        if (!gain) return;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + i * 0.06);
        gain.gain.setValueAtTime(0.25, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.5);
        osc.connect(gain);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.5);
      });
    } else if (type === 'reaction') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.3);
      if (!gain) return;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.05);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === 'toggle') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.28);
      if (!gain) return;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.04);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'celebration') {
      [523.25, 587.33, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const t = now + idx * 0.07;
        const osc = ctx.createOscillator();
        const gain = this._createGain(0.2);
        if (!gain) return;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.6);
      });
    } else if (type === 'refresh') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.22);
      if (!gain) return;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.03);
    }
  }

  // ==========================================
  // Pack 3: Retro 8-Bit Arcade
  // ==========================================
  _playRetro(ctx, type) {
    const now = ctx.currentTime;
    if (type === 'like') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.22);
      if (!gain) return;
      osc.type = 'square';
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.setValueAtTime(1318.51, now + 0.06);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'send') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.18);
      if (!gain) return;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.12);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.14);
    } else if (type === 'receive') {
      [659.25, 987.77].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = this._createGain(0.16);
        if (!gain) return;
        osc.type = 'square';
        osc.frequency.setValueAtTime(f, now + i * 0.07);
        gain.gain.setValueAtTime(0.18, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.25);
        osc.connect(gain);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.25);
      });
    } else if (type === 'reaction') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.2);
      if (!gain) return;
      osc.type = 'square';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.setValueAtTime(1100, now + 0.04);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'toggle') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.18);
      if (!gain) return;
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.035);
    } else if (type === 'celebration') {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, idx) => {
        const t = now + idx * 0.07;
        const osc = ctx.createOscillator();
        const gain = this._createGain(0.15);
        if (!gain) return;
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    } else if (type === 'refresh') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.18);
      if (!gain) return;
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.015);
    }
  }

  // ==========================================
  // Pack 4: Futuristic Cyber Ambient
  // ==========================================
  _playCyber(ctx, type) {
    const now = ctx.currentTime;
    if (type === 'like') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.35);
      if (!gain) return;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'send') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.25);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.2);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'receive') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.2);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'reaction') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.25);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400, now);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.08);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'toggle') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.2);
      if (!gain) return;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.03);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.03);
    } else if (type === 'celebration') {
      [880, 1100, 1320, 1760].forEach((freq, idx) => {
        const t = now + idx * 0.05;
        const osc = ctx.createOscillator();
        const gain = this._createGain(0.15);
        if (!gain) return;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.4);
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    } else if (type === 'refresh') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.2);
      if (!gain) return;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1500, now);
      osc.frequency.exponentialRampToValueAtTime(500, now + 0.02);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.02);
    }
  }

  // ==========================================
  // Pack 5: Minimalist Tactile Clicks
  // ==========================================
  _playMinimal(ctx, type) {
    const now = ctx.currentTime;
    if (type === 'like') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.22);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.025);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.025);
    } else if (type === 'send') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.18);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.04);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'receive') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.18);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1700, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'reaction') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.18);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1100, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.02);
    } else if (type === 'toggle') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.2);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.022);
    } else if (type === 'celebration') {
      [800, 1000, 1200, 1400, 1600].forEach((freq, idx) => {
        const t = now + idx * 0.03;
        const osc = ctx.createOscillator();
        const gain = this._createGain(0.14);
        if (!gain) return;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.05);
      });
    } else if (type === 'refresh') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.18);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.01);
    }
  }
}

export const soundFx = new SoundFxService();
export default soundFx;

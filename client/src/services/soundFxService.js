/**
 * soundFxService.js
 * =================
 * Phase 9 Option 6: Unified VibeGrid Sound Engine
 *
 * Capabilities:
 * - 100% Native Web Audio API procedural synthesis (0 kB external media files)
 * - Zero network latency & full offline availability
 * - Autoplay compliance: async unlock & resume on user gesture without clipping
 * - 5 Sound Themes / Packs: Modern (default), Kalimba, Retro 8-bit, Cyber, Minimalist
 * - 8 Core UI Events: click, like, send, receive, reaction, toggle, celebration, refresh
 * - Global UI Click sounds with dedicated user setting (ON/OFF toggle in Settings)
 * - Reactive state persistence via localStorage with pub/sub subscriber support
 * - Master volume control (0.0 to 1.0) and global mute toggle
 * - Safe for SSR and unit testing environments
 */

const STORAGE_KEY_ENABLED = 'vibegrid_sound_enabled';
const STORAGE_KEY_PACK = 'vibegrid_sound_pack';
const STORAGE_KEY_VOLUME = 'vibegrid_sound_volume';
const STORAGE_KEY_CLICK_ENABLED = 'vibegrid_sound_click_enabled';

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
    this.lastClickTime = 0;

    // Load initial preferences
    this.enabled = this._loadEnabled();
    this.pack = this._loadPack();
    this.volume = this._loadVolume();
    this.clickEnabled = this._loadClickEnabled();

    // Auto-unlock on first user interaction in browser
    if (typeof window !== 'undefined') {
      const unlock = () => {
        const ctx = this._initContext();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        this.isUnlocked = true;
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('mousedown', unlock, true);
        window.removeEventListener('click', unlock, true);
        window.removeEventListener('keydown', unlock, true);
        window.removeEventListener('touchstart', unlock, true);
      };

      window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
      window.addEventListener('mousedown', unlock, { capture: true, passive: true });
      window.addEventListener('click', unlock, { capture: true, passive: true });
      window.addEventListener('keydown', unlock, { capture: true, passive: true });
      window.addEventListener('touchstart', unlock, { capture: true, passive: true });

      // Global UI Click Sound Listener (captures clicks on buttons, tabs, links, pills)
      window.addEventListener(
        'click',
        (e) => {
          if (!this.enabled || !this.clickEnabled) return;
          try {
            const target = e.target;
            if (!target || typeof target.closest !== 'function') return;

            // Never play click sound for switches or text inputs
            if (target.closest('.switch-toggle, .spring-switch-toggle, input[type="checkbox"], input[type="range"]')) {
              return;
            }
            if (target.closest('input:not([type="button"]):not([type="submit"]):not([type="radio"]), textarea, [contenteditable="true"]')) {
              return;
            }

            // Check if clicking an interactive element
            const isClickable = target.closest(
              'button, a, [role="button"], [role="tab"], [role="menuitem"], [role="radio"], .btn, .btn-primary, .btn-secondary, .btn-outline, .btn-ghost, .btn-sound, .clickable, .tab-btn, .nav-item, .mobile-nav-item, .settings-nav-item, .nav-icon-btn-mobile, .conversation-item, .sound-pack-card, .theme-card, .avatar-option, .reaction-pill, .filter-chip, .emoji-btn, select, input[type="button"], input[type="submit"]'
            );

            let isPointer = false;
            try {
              if (window.getComputedStyle) {
                const style = window.getComputedStyle(target);
                if (style && style.cursor === 'pointer') {
                  isPointer = true;
                }
              }
            } catch {}

            if (isClickable || isPointer) {
              const nowMs = Date.now();
              if (nowMs - this.lastClickTime > 35) {
                this.lastClickTime = nowMs;
                this.play('click');
              }
            }
          } catch {}
        },
        { capture: true, passive: true }
      );
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
    if (typeof window === 'undefined' || !window.localStorage) return 0.8;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_VOLUME);
      const parsed = parseFloat(stored);
      return !isNaN(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.8;
    } catch {
      return 0.8;
    }
  }

  _loadClickEnabled() {
    if (typeof window === 'undefined' || !window.localStorage) return true;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_CLICK_ENABLED);
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  }

  _notify() {
    const state = {
      enabled: this.enabled,
      pack: this.pack,
      volume: this.volume,
      clickEnabled: this.clickEnabled
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
      volume: this.volume,
      clickEnabled: this.clickEnabled
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

  isClickSoundEnabled() {
    return this.clickEnabled;
  }

  setClickSoundEnabled(val) {
    this.clickEnabled = Boolean(val);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_CLICK_ENABLED, String(this.clickEnabled));
      }
    } catch {}
    if (this.clickEnabled && this.enabled) {
      this.play('click');
    }
    this._notify();
  }

  toggleClickSound() {
    this.setClickSoundEnabled(!this.clickEnabled);
    return this.clickEnabled;
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
      const targetGain = this.enabled ? this.volume : 0;
      this.masterGain.gain.value = targetGain;
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
      this.masterGain.gain.value = targetGain;
    } catch {}
  }

  _createGain(startGain = 0.5) {
    if (!this.audioCtx || !this.masterGain) return null;
    try {
      const gain = this.audioCtx.createGain();
      gain.gain.value = startGain;
      gain.gain.setValueAtTime(startGain, this.audioCtx.currentTime);
      gain.connect(this.masterGain);
      return gain;
    } catch {
      return null;
    }
  }

  // ==========================================
  // Public Play Trigger (Async Safe)
  // ==========================================
  async play(eventType, packOverride = null) {
    if (!this.enabled && !packOverride) return;
    if (eventType === 'click' && !this.clickEnabled && !packOverride) return;

    const ctx = this._initContext();
    if (!ctx) return;

    // Await audio context resumption if currently suspended (Safari/Chrome autoplay compliance)
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn('[SoundFxService] AudioContext resume failed:', err);
      }
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

    if (type === 'click') {
      // Crisp subtle UI micro-tick with tactile body
      const osc1 = ctx.createOscillator();
      const gain1 = this._createGain(0.65);
      if (gain1) {
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(2200, now);
        osc1.frequency.exponentialRampToValueAtTime(850, now + 0.045);
        gain1.gain.setValueAtTime(0.65, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        osc1.connect(gain1);
        osc1.start(now);
        osc1.stop(now + 0.055);
      }

      const osc2 = ctx.createOscillator();
      const gain2 = this._createGain(0.45);
      if (gain2) {
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(800, now);
        osc2.frequency.exponentialRampToValueAtTime(320, now + 0.055);
        gain2.gain.setValueAtTime(0.45, now);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
        osc2.connect(gain2);
        osc2.start(now);
        osc2.stop(now + 0.065);
      }
    } else if (type === 'like') {
      // Bouncy bubble pop
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.75);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(920, now + 0.1);
      gain.gain.setValueAtTime(0.75, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.17);
    } else if (type === 'send') {
      // Airy whoosh swoosh
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.65);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.16);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0.65, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.21);
    } else if (type === 'receive') {
      // Crystal 3-tone glass notification chime (D5 + A5 + D6 harmonic cascade)
      [
        { freq: 587.33, delay: 0.0, gain: 0.75 },
        { freq: 880.00, delay: 0.07, gain: 0.70 },
        { freq: 1174.66, delay: 0.14, gain: 0.55 }
      ].forEach(({ freq, delay, gain: toneGain }) => {
        const t = now + delay;
        const osc = ctx.createOscillator();
        const gain = this._createGain(toneGain);
        if (!gain) return;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(toneGain, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    } else if (type === 'reaction') {
      // Waterdrop pop
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.65);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(550, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(850, now + 0.12);
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.14);
    } else if (type === 'toggle') {
      // Audible tactile magnetic switch snap: transient tick + resonant body latch
      const osc1 = ctx.createOscillator();
      const gain1 = this._createGain(0.7);
      if (gain1) {
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(1600, now);
        osc1.frequency.exponentialRampToValueAtTime(750, now + 0.04);
        gain1.gain.setValueAtTime(0.7, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
        osc1.connect(gain1);
        osc1.start(now);
        osc1.stop(now + 0.05);
      }

      const osc2 = ctx.createOscillator();
      const gain2 = this._createGain(0.8);
      if (gain2) {
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(520, now);
        osc2.frequency.exponentialRampToValueAtTime(180, now + 0.08);
        gain2.gain.setValueAtTime(0.8, now);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
        osc2.connect(gain2);
        osc2.start(now);
        osc2.stop(now + 0.09);
      }
    } else if (type === 'celebration') {
      // Celestial fanfare (C6, E6, G6, C7)
      [1046.5, 1318.5, 1567.98, 2093.0].forEach((freq, idx) => {
        const t = now + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = this._createGain(0.5);
        if (!gain) return;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.58);
      });
    } else if (type === 'refresh') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.55);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.05);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.07);
    }
  }

  // ==========================================
  // Pack 2: Warm Kalimba & Marimba
  // ==========================================
  _playKalimba(ctx, type) {
    const now = ctx.currentTime;

    if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.75);
      if (!gain) return;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(850, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.06);
      gain.gain.setValueAtTime(0.75, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.075);
    } else if (type === 'like') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.75);
      if (!gain) return;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      gain.gain.setValueAtTime(0.75, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.23);
    } else if (type === 'send') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.7);
      if (!gain) return;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(392.0, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.16);
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'receive') {
      // 3-tone warm kalimba chord
      [
        { freq: 783.99, delay: 0.0, gain: 0.75 },
        { freq: 987.77, delay: 0.08, gain: 0.70 },
        { freq: 1174.66, delay: 0.16, gain: 0.60 }
      ].forEach(({ freq, delay, gain: toneGain }) => {
        const t = now + delay;
        const osc = ctx.createOscillator();
        const gain = this._createGain(toneGain);
        if (!gain) return;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(toneGain, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.58);
      });
    } else if (type === 'reaction') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.7);
      if (!gain) return;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.08);
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.23);
    } else if (type === 'toggle') {
      // Organic double wooden latch
      const osc1 = ctx.createOscillator();
      const gain1 = this._createGain(0.75);
      if (gain1) {
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(740, now);
        osc1.frequency.exponentialRampToValueAtTime(420, now + 0.04);
        gain1.gain.setValueAtTime(0.75, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
        osc1.connect(gain1);
        osc1.start(now);
        osc1.stop(now + 0.05);
      }

      const t2 = now + 0.03;
      const osc2 = ctx.createOscillator();
      const gain2 = this._createGain(0.8);
      if (gain2) {
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(440, t2);
        osc2.frequency.exponentialRampToValueAtTime(220, t2 + 0.07);
        gain2.gain.setValueAtTime(0.8, t2);
        gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.075);
        osc2.connect(gain2);
        osc2.start(t2);
        osc2.stop(t2 + 0.08);
      }
    } else if (type === 'celebration') {
      [523.25, 587.33, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const t = now + idx * 0.07;
        const osc = ctx.createOscillator();
        const gain = this._createGain(0.5);
        if (!gain) return;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.68);
      });
    } else if (type === 'refresh') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.55);
      if (!gain) return;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.07);
    }
  }

  // ==========================================
  // Pack 3: Retro 8-Bit Arcade
  // ==========================================
  _playRetro(ctx, type) {
    const now = ctx.currentTime;

    if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.6);
      if (!gain) return;
      osc.type = 'square';
      osc.frequency.setValueAtTime(1300, now);
      osc.frequency.exponentialRampToValueAtTime(650, now + 0.045);
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.055);
    } else if (type === 'like') {
      // Coin sound
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.65);
      if (!gain) return;
      osc.type = 'square';
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.setValueAtTime(1318.51, now + 0.06);
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.39);
    } else if (type === 'send') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.6);
      if (!gain) return;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(1400, now + 0.14);
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.19);
    } else if (type === 'receive') {
      // Classic 8-bit power-up fanfare
      [
        { freq: 659.25, delay: 0.0, gain: 0.65 },
        { freq: 987.77, delay: 0.07, gain: 0.65 },
        { freq: 1318.51, delay: 0.14, gain: 0.60 }
      ].forEach(({ freq, delay, gain: toneGain }) => {
        const t = now + delay;
        const osc = ctx.createOscillator();
        const gain = this._createGain(toneGain);
        if (!gain) return;
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(toneGain, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.34);
      });
    } else if (type === 'reaction') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.6);
      if (!gain) return;
      osc.type = 'square';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.setValueAtTime(1100, now + 0.05);
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'toggle') {
      // 2-tone arcade switch
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.65);
      if (!gain) return;
      osc.type = 'square';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880.00, now + 0.035);
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.085);
    } else if (type === 'celebration') {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, idx) => {
        const t = now + idx * 0.07;
        const osc = ctx.createOscillator();
        const gain = this._createGain(0.45);
        if (!gain) return;
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.48);
      });
    } else if (type === 'refresh') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.5);
      if (!gain) return;
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  }

  // ==========================================
  // Pack 4: Futuristic Cyber Ambient
  // ==========================================
  _playCyber(ctx, type) {
    const now = ctx.currentTime;

    if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.65);
      if (!gain) return;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.045);
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.055);
    } else if (type === 'like') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.75);
      if (!gain) return;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);
      gain.gain.setValueAtTime(0.75, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'send') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.65);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(1300, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.24);
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.26);
    } else if (type === 'receive') {
      // Holographic sonar chime with overtone
      const osc1 = ctx.createOscillator();
      const gain1 = this._createGain(0.75);
      if (gain1) {
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1760, now);
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.4);
        gain1.gain.setValueAtTime(0.75, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
        osc1.connect(gain1);
        osc1.start(now);
        osc1.stop(now + 0.44);
      }

      const osc2 = ctx.createOscillator();
      const gain2 = this._createGain(0.45);
      if (gain2) {
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(2640, now);
        gain2.gain.setValueAtTime(0.45, now);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        osc2.connect(gain2);
        osc2.start(now);
        osc2.stop(now + 0.38);
      }
    } else if (type === 'reaction') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.65);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400, now);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.1);
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === 'toggle') {
      // Cybernetic switch relay: high buzz transient + sub-bass pulse
      const osc1 = ctx.createOscillator();
      const gain1 = this._createGain(0.75);
      if (gain1) {
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(880, now);
        osc1.frequency.exponentialRampToValueAtTime(220, now + 0.06);
        gain1.gain.setValueAtTime(0.75, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
        osc1.connect(gain1);
        osc1.start(now);
        osc1.stop(now + 0.07);
      }

      const osc2 = ctx.createOscillator();
      const gain2 = this._createGain(0.65);
      if (gain2) {
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(130, now);
        gain2.gain.setValueAtTime(0.65, now);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        osc2.connect(gain2);
        osc2.start(now);
        osc2.stop(now + 0.085);
      }
    } else if (type === 'celebration') {
      [880, 1100, 1320, 1760].forEach((freq, idx) => {
        const t = now + idx * 0.06;
        const osc = ctx.createOscillator();
        const gain = this._createGain(0.45);
        if (!gain) return;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.45);
        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.62);
      });
    } else if (type === 'refresh') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.55);
      if (!gain) return;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1500, now);
      osc.frequency.exponentialRampToValueAtTime(500, now + 0.04);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  }

  // ==========================================
  // Pack 5: Minimalist Tactile Clicks
  // ==========================================
  _playMinimal(ctx, type) {
    const now = ctx.currentTime;

    if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.75);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2000, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.035);
      gain.gain.setValueAtTime(0.75, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.045);
    } else if (type === 'like') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.75);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.05);
      gain.gain.setValueAtTime(0.75, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'send') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.65);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.06);
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.07);
    } else if (type === 'receive') {
      // Crisp acoustic glass bell ping
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.75);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, now);
      gain.gain.setValueAtTime(0.75, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'reaction') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.65);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'toggle') {
      // Heavy tactile mechanical switch latch
      const osc1 = ctx.createOscillator();
      const gain1 = this._createGain(0.8);
      if (gain1) {
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(1400, now);
        osc1.frequency.exponentialRampToValueAtTime(300, now + 0.06);
        gain1.gain.setValueAtTime(0.8, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
        osc1.connect(gain1);
        osc1.start(now);
        osc1.stop(now + 0.07);
      }

      const osc2 = ctx.createOscillator();
      const gain2 = this._createGain(0.6);
      if (gain2) {
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(2400, now);
        gain2.gain.setValueAtTime(0.6, now);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
        osc2.connect(gain2);
        osc2.start(now);
        osc2.stop(now + 0.035);
      }
    } else if (type === 'celebration') {
      [800, 1000, 1200, 1400, 1600].forEach((freq, idx) => {
        const t = now + idx * 0.04;
        const osc = ctx.createOscillator();
        const gain = this._createGain(0.45);
        if (!gain) return;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.14);
      });
    } else if (type === 'refresh') {
      const osc = ctx.createOscillator();
      const gain = this._createGain(0.55);
      if (!gain) return;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.045);
    }
  }
}

export const soundFx = new SoundFxService();
export default soundFx;

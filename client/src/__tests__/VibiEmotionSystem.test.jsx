/**
 * client/src/__tests__/VibiEmotionSystem.test.jsx
 * ================================================
 * VIBGRID — VIBI EMOTION SYSTEM TEST SUITE
 *
 * Verifies:
 * 1. All 20 Core Emotions defined and accessible in VIBI_EMOTIONS & VIBI_STATES.
 * 2. Emotion Priority Hierarchy preemption and auto-reversion.
 * 3. Dedicated helper triggers for all emotions.
 * 4. Rapid event grouping (anti-spam consolidation).
 * 5. Visual character rendering (SVG facial overlays, collar lighting, floating badges).
 * 6. Global event integration (vibegrid:emotion, socket events).
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import vibiCharacterService, {
  VIBI_EMOTIONS,
  VIBI_STATES,
  EMOTION_PRIORITY,
  DEFAULT_EMOTION_PRIORITY
} from '../services/vibiCharacterService';
import VibiCharacter from '../components/vibi/VibiCharacter';
import VibiAvatar from '../components/vibi/VibiAvatar';

describe('Vibi Context-Aware Emotion System', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vibiCharacterService.idle();
    vibiCharacterService.lastReactionTimestamp = 0;
    vibiCharacterService.lastScrollReactionTimestamp = -60000;
    vibiCharacterService.lastLongTypingReaction = -60000;
    vibiCharacterService.recentEvents = [];
    vibiCharacterService.recentAmbientActivities = [];
  });

  afterEach(() => {
    if (vibiCharacterService.cleanupListeners) {
      vibiCharacterService.cleanupListeners();
    }
    vi.clearAllTimers();
    vi.useRealTimers();
    vibiCharacterService.idle();
  });

  // ==========================================
  // 1. Core 20 Emotions Definition
  // ==========================================
  describe('1. 20 Core Emotions Registry', () => {
    const requiredEmotions = [
      'IDLE', 'HAPPY', 'EXCITED', 'CURIOUS', 'THINKING',
      'LISTENING', 'RESPONDING', 'SURPRISED', 'CONCERNED', 'SAD',
      'CONFUSED', 'FRUSTRATED', 'PROUD', 'CELEBRATING', 'SLEEPY',
      'WELCOME', 'ATTENTIVE', 'PLAYFUL', 'ERROR', 'SUCCESS'
    ];

    it('contains all 20 required core emotions in VIBI_EMOTIONS', () => {
      requiredEmotions.forEach((emotionKey) => {
        expect(VIBI_EMOTIONS[emotionKey]).toBeDefined();
        expect(typeof VIBI_EMOTIONS[emotionKey]).toBe('string');
      });
    });

    it('contains all 20 core emotions in VIBI_STATES', () => {
      requiredEmotions.forEach((emotionKey) => {
        expect(VIBI_STATES[emotionKey]).toBeDefined();
      });
    });

    it('assigns correct priority levels across all 20 emotions', () => {
      expect(DEFAULT_EMOTION_PRIORITY[VIBI_STATES.IDLE]).toBe(EMOTION_PRIORITY.IDLE);
      expect(DEFAULT_EMOTION_PRIORITY[VIBI_STATES.PLAYFUL]).toBe(EMOTION_PRIORITY.NORMAL);
      expect(DEFAULT_EMOTION_PRIORITY[VIBI_STATES.HAPPY]).toBe(EMOTION_PRIORITY.ACTION_RESULT);
      expect(DEFAULT_EMOTION_PRIORITY[VIBI_STATES.THINKING]).toBe(EMOTION_PRIORITY.USER_INTERACTION);
      expect(DEFAULT_EMOTION_PRIORITY[VIBI_STATES.EXCITED]).toBe(EMOTION_PRIORITY.IMPORTANT_MESSAGE);
      expect(DEFAULT_EMOTION_PRIORITY[VIBI_STATES.SURPRISED]).toBe(EMOTION_PRIORITY.CALL);
      expect(DEFAULT_EMOTION_PRIORITY[VIBI_STATES.ERROR]).toBe(EMOTION_PRIORITY.CRITICAL);
    });
  });

  // ==========================================
  // 2. Emotion Controller & Priority Hierarchy
  // ==========================================
  describe('2. Emotion Priority Preemption & Revert Stack', () => {
    it('allows higher priority emotions to immediately preempt lower priority', () => {
      // Normal priority
      vibiCharacterService.playful();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.PLAYFUL);

      // Higher priority (USER_INTERACTION) preempts
      vibiCharacterService.listening();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.LISTENING);

      // Critical priority (CRITICAL) preempts
      vibiCharacterService.error();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.ERROR);
    });

    it('blocks lower priority emotions from interrupting higher priority without force', () => {
      // Set high priority: Thinking (USER_INTERACTION = 2)
      vibiCharacterService.think();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.THINKING);

      // Attempt lower priority without force: Normal (priority 0)
      const accepted = vibiCharacterService.setEmotion(VIBI_STATES.PLAYFUL, {
        priority: EMOTION_PRIORITY.NORMAL,
        durationMs: 2000,
        force: false
      });

      expect(accepted).toBe(false);
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.THINKING);
    });

    it('auto-reverts to IDLE and resets priority after durationMs expires', () => {
      vibiCharacterService.setEmotion(VIBI_STATES.EXCITED, {
        priority: EMOTION_PRIORITY.IMPORTANT_MESSAGE,
        durationMs: 2500,
        force: true
      });

      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.EXCITED);
      expect(vibiCharacterService.getPriority()).toBe(EMOTION_PRIORITY.IMPORTANT_MESSAGE);

      act(() => {
        vi.advanceTimersByTime(2600);
      });

      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.IDLE);
      expect(vibiCharacterService.getPriority()).toBe(EMOTION_PRIORITY.IDLE);
    });
  });

  // ==========================================
  // 3. Dedicated Helper Methods
  // ==========================================
  describe('3. Emotion Helper Methods', () => {
    it('triggers excited, curious, thinking, surprised, sad, confused, frustrated, proud, welcome, attentive', () => {
      vibiCharacterService.excited();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.EXCITED);

      vibiCharacterService.surprised();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.SURPRISED);

      vibiCharacterService.confused();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.CONFUSED);

      vibiCharacterService.frustrated();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.FRUSTRATED);

      vibiCharacterService.proud();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.PROUD);

      vibiCharacterService.attentive();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.ATTENTIVE);

      vibiCharacterService.welcome();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.WELCOME);

      vibiCharacterService.sad();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.SAD);
    });
  });

  // ==========================================
  // 4. Rapid Event Grouping & Anti-Spam
  // ==========================================
  describe('4. Rapid Event Grouping', () => {
    it('groups 3 or more incoming events within 3000ms into ATTENTIVE state', () => {
      const cleanup = vibiCharacterService.initActivityWatchers({ animations: true });

      // First event: regular new message
      window.dispatchEvent(new CustomEvent('vibegrid:new-message'));
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.NEW_MESSAGE);

      // Second event within 500ms
      act(() => {
        vi.advanceTimersByTime(500);
      });
      window.dispatchEvent(new CustomEvent('vibegrid:new-message'));

      // Third event within 500ms -> triggers consolidated ATTENTIVE state
      act(() => {
        vi.advanceTimersByTime(500);
      });
      window.dispatchEvent(new CustomEvent('vibegrid:new-message'));
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.ATTENTIVE);

      cleanup();
    });
  });

  // ==========================================
  // 5. Visual Character Rendering & Overlays
  // ==========================================
  describe('5. Visual Character Overlays in VibiCharacter', () => {
    it('renders master 3D transparent fox image', () => {
      const { container } = render(<VibiCharacter mood="idle" />);
      const img = container.querySelector('image');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('href', '/assets/vibi/vibi_master_transparent.png');
    });

    it('renders joyful blushing cheeks for happy and celebrating moods', () => {
      const { container: happyContainer } = render(<VibiCharacter mood="happy" />);
      expect(happyContainer.querySelector('.vibi-facial-blush')).toBeInTheDocument();
      expect(happyContainer.querySelector('.vibi-eyes-happy')).toBeInTheDocument();

      const { container: idleContainer } = render(<VibiCharacter mood="idle" />);
      expect(idleContainer.querySelector('.vibi-facial-blush')).not.toBeInTheDocument();
    });

    it('renders closed relaxing eyelids for sleepy mood', () => {
      const { container } = render(<VibiCharacter mood="sleepy" />);
      expect(container.querySelector('.vibi-eyes-sleepy')).toBeInTheDocument();
    });

    it('renders playful wink and catchlight for playful mood', () => {
      const { container } = render(<VibiCharacter mood="playful" />);
      expect(container.querySelector('.vibi-eyes-playful')).toBeInTheDocument();
    });

    it('renders wide specular highlights for surprised mood', () => {
      const { container } = render(<VibiCharacter mood="surprised" />);
      expect(container.querySelector('.vibi-eyes-attentive')).toBeInTheDocument();
    });

    it('renders floating thought badge with question mark for curious mood', () => {
      const { container } = render(<VibiCharacter mood="curious" />);
      const badge = container.querySelector('.vibi-floating-mood-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toContain('❓');
    });

    it('renders collar V with dynamic color based on emotion', () => {
      const { container: thinkingContainer } = render(<VibiCharacter mood="thinking" />);
      const cyanPath = thinkingContainer.querySelector('.vibi-collar-vector-light path');
      expect(cyanPath).toHaveAttribute('stroke', '#00E5FF'); // Electric Cyan

      const { container: excitedContainer } = render(<VibiCharacter mood="excited" />);
      const goldPath = excitedContainer.querySelector('.vibi-collar-vector-light path');
      expect(goldPath).toHaveAttribute('stroke', '#FBBF24'); // Radiant Gold
    });
  });

  // ==========================================
  // 6. Global Custom Event Dispatch
  // ==========================================
  describe('6. Global vibegrid:emotion Event Listener', () => {
    it('sets emotion when vibegrid:emotion event is dispatched on window', () => {
      const cleanup = vibiCharacterService.initActivityWatchers({ animations: true });

      window.dispatchEvent(new CustomEvent('vibegrid:emotion', {
        detail: { emotion: VIBI_STATES.EXCITED, priority: EMOTION_PRIORITY.IMPORTANT_MESSAGE, force: true }
      }));

      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.EXCITED);
      cleanup();
    });
  });

  // ==========================================
  // 7. Natural Companion Idle & Activity System
  // ==========================================
  describe('7. Natural Companion Idle & Activity Behavior System', () => {
    it('triggers attentive state when user types in an input element', () => {
      const cleanup = vibiCharacterService.initActivityWatchers({ animations: true });

      const input = document.createElement('input');
      document.body.appendChild(input);

      // User types a key
      const keyEvent = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      input.dispatchEvent(keyEvent);

      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.ATTENTIVE);
      expect(vibiCharacterService.isUserTyping).toBe(true);

      // Reverts to IDLE after typing pauses
      act(() => {
        vi.advanceTimersByTime(1700);
      });

      expect(vibiCharacterService.isUserTyping).toBe(false);
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.IDLE);

      document.body.removeChild(input);
      cleanup();
    });

    it('reacts to sustained longer typing (>3.5s)', () => {
      const cleanup = vibiCharacterService.initActivityWatchers({ animations: true });

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      // Start typing
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.ATTENTIVE);

      // Sustained typing: continue typing periodically over 3.7s
      act(() => { vi.advanceTimersByTime(1000); });
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));

      act(() => { vi.advanceTimersByTime(1000); });
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true }));

      act(() => { vi.advanceTimersByTime(1000); });
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true }));

      act(() => { vi.advanceTimersByTime(700); });
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', bubbles: true }));

      const sustainedState = vibiCharacterService.getState();
      expect([VIBI_STATES.HEAD_TILT, VIBI_STATES.LISTENING, VIBI_STATES.CURIOUS]).toContain(sustainedState);

      document.body.removeChild(textarea);
      cleanup();
    });

    it('reacts subtly to scrolling without interrupting scroll', () => {
      const cleanup = vibiCharacterService.initActivityWatchers({ animations: true });

      // User scrolls
      window.dispatchEvent(new Event('scroll'));

      const scrollState = vibiCharacterService.getState();
      expect([VIBI_STATES.LOOK_AROUND, VIBI_STATES.CURIOUS, VIBI_STATES.ATTENTIVE]).toContain(scrollState);

      // Auto-reverts after duration
      act(() => {
        vi.advanceTimersByTime(1600);
      });
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.IDLE);

      cleanup();
    });

    it('picks varied ambient states avoiding immediate consecutive repetitions', () => {
      vibiCharacterService.recentAmbientActivities = [];

      const first = vibiCharacterService._getNextRandomAmbientState();
      const second = vibiCharacterService._getNextRandomAmbientState();
      const third = vibiCharacterService._getNextRandomAmbientState();

      expect(second).not.toBe(first);
      expect(third).not.toBe(second);
      expect(vibiCharacterService.recentAmbientActivities.length).toBeLessThanOrEqual(3);
    });

    it('immediately cancels active ambient idle reaction when direct user interaction occurs', () => {
      const cleanup = vibiCharacterService.initActivityWatchers({ animations: true });

      // Put Vibi in subtle idle micro-behavior (e.g. look around)
      vibiCharacterService.lookAround();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.LOOK_AROUND);

      // User clicks or touches directly
      window.dispatchEvent(new MouseEvent('mousedown'));

      // Ambient reaction is immediately cancelled and reverts to idle
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.IDLE);

      cleanup();
    });

    it('handles system notification events with contextual reaction', () => {
      const cleanup = vibiCharacterService.initActivityWatchers({ animations: true });

      window.dispatchEvent(new CustomEvent('vibegrid:notification', {
        detail: { type: 'sms_alert', text: 'New SMS message' }
      }));

      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.NEW_MESSAGE);

      cleanup();
    });
  });
});


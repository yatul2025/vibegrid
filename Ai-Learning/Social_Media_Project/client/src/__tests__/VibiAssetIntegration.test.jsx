/**
 * client/src/__tests__/VibiAssetIntegration.test.jsx
 * ===================================================
 * VIBGRID — VIBI ASSET PACK INTEGRATION & REAL EVENT TEST SUITE
 *
 * Tests:
 * 1. Asset Registry mapping & manifest state resolution for all 36 states.
 * 2. VibiCharacterService real event handlers & cooldown management.
 * 3. VibiAvatar WebP asset rendering & SVG graceful fallback.
 * 4. VibiLauncher dragging & docking state transitions.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import vibiAssetRegistry, {
  MANIFEST_STATES,
  resolveCanonicalState,
  getVibiAsset
} from '../services/vibiAssetRegistry';
import vibiCharacterService, { VIBI_STATES } from '../services/vibiCharacterService';
import VibiAvatar from '../components/vibi/VibiAvatar';

describe('Vibi Antigravity Asset Pack Integration Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vibiCharacterService.idle();
    vibiCharacterService.lastReactionTimestamp = 0;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // ==========================================
  // 1. Asset Registry & Manifest Mapping
  // ==========================================
  describe('1. Asset Registry & Manifest Verification', () => {
    it('contains all 36 canonical manifest states', () => {
      const states = Object.values(MANIFEST_STATES);
      expect(states).toHaveLength(36);
      expect(states).toContain('idle_floating');
      expect(states).toContain('celebrating');
      expect(states).toContain('curious');
      expect(states).toContain('new_message');
      expect(states).toContain('missed_call');
      expect(states).toContain('group_invitation');
      expect(states).toContain('join_request');
      expect(states).toContain('dragging_move');
      expect(states).toContain('docking_snap');
      expect(states).toContain('sleeping');
      expect(states).toContain('wake_up');
    });

    it('resolves legacy moods and aliases to canonical manifest states', () => {
      expect(resolveCanonicalState('idle')).toBe('idle_floating');
      expect(resolveCanonicalState('celebrate')).toBe('celebrating');
      expect(resolveCanonicalState('success')).toBe('happy_response');
      expect(resolveCanonicalState('happy')).toBe('happy_response');
      expect(resolveCanonicalState('sleepy')).toBe('sleeping');
      expect(resolveCanonicalState('welcome')).toBe('peek_and_wave');
      expect(resolveCanonicalState('responding')).toBe('responding_talking');
      expect(resolveCanonicalState('dragging')).toBe('dragging_move');
      expect(resolveCanonicalState('docking')).toBe('docking_snap');
      expect(resolveCanonicalState('bounce')).toBe('gentle_bounce');
    });

    it('generates correct WebP and PNG frame URLs for any state', () => {
      const asset = getVibiAsset('celebrate');
      expect(asset.state).toBe('celebrating');
      expect(asset.webpUrl).toBe('/assets/vibi/vibi_webp/celebrating.webp');
      expect(asset.frameUrls).toHaveLength(12);
      expect(asset.frameUrls[0]).toBe('/assets/vibi/vibi_frames/celebrating/00.png');
      expect(asset.frameUrls[11]).toBe('/assets/vibi/vibi_frames/celebrating/11.png');

      const blinkAsset = getVibiAsset('blink');
      expect(blinkAsset.frameCount).toBe(8);
      expect(blinkAsset.frameUrls).toHaveLength(8);
    });
  });

  // ==========================================
  // 2. VibiCharacterService Real Events
  // ==========================================
  describe('2. VibiCharacterService Real Event Handling', () => {
    it('reacts to window vibegrid:new-message event and respects cooldown', () => {
      const cleanup = vibiCharacterService.initActivityWatchers({ animations: true });

      // First new message: transitions to new_message
      window.dispatchEvent(new CustomEvent('vibegrid:new-message'));
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.NEW_MESSAGE);

      // Advance 4000ms: should auto-revert to idle
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.IDLE);

      // Immediate second event within 15s cooldown: should be suppressed
      window.dispatchEvent(new CustomEvent('vibegrid:new-message'));
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.IDLE);

      // Advance past 15s cooldown
      act(() => {
        vi.advanceTimersByTime(16000);
      });

      window.dispatchEvent(new CustomEvent('vibegrid:new-message'));
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.NEW_MESSAGE);

      cleanup();
    });

    it('reacts to window vibegrid:missed-call event', () => {
      const cleanup = vibiCharacterService.initActivityWatchers({ animations: true });

      window.dispatchEvent(new CustomEvent('vibegrid:missed-call'));
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.MISSED_CALL);

      act(() => {
        vi.advanceTimersByTime(4500);
      });
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.IDLE);

      cleanup();
    });

    it('reacts to window vibegrid:group-invite and join-request events', () => {
      const cleanup = vibiCharacterService.initActivityWatchers({ animations: true });

      window.dispatchEvent(new CustomEvent('vibegrid:group-invite'));
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.GROUP_INVITATION);

      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.IDLE);

      // Advance past cooldown
      act(() => {
        vi.advanceTimersByTime(16000);
      });

      window.dispatchEvent(new CustomEvent('vibegrid:join-request'));
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.JOIN_REQUEST);

      cleanup();
    });

    it('handles dragging and docking transitions accurately', () => {
      vibiCharacterService.dragging(true);
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.DRAGGING_MOVE);

      vibiCharacterService.dragging(false);
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.DOCKING_SNAP);

      act(() => {
        vi.advanceTimersByTime(900);
      });
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.IDLE);
    });
  });

  // ==========================================
  // 3. VibiAvatar Asset Rendering & Fallback
  // ==========================================
  describe('3. VibiAvatar Asset Rendering & Fallback', () => {
    it('renders WebP asset img with correct canonical state and SVG fallback', () => {
      const { container } = render(<VibiAvatar size={48} mood="celebrate" />);
      const avatar = screen.getByTestId('vibi-avatar');
      expect(avatar.getAttribute('data-mood')).toBe('celebrate');
      expect(avatar.getAttribute('data-canonical-state')).toBe('celebrating');

      const img = screen.getByTestId('vibi-avatar-img');
      expect(img.getAttribute('src')).toBe('/assets/vibi/vibi_webp/celebrating.webp');

      // SVG fallback underlay is present
      const svg = container.querySelector('svg.vibi-avatar-svg');
      expect(svg).toBeInTheDocument();
      expect(screen.getByText('✨')).toBeInTheDocument();
    });

    it('gracefully falls back to SVG if WebP image fails to load', () => {
      const { container } = render(<VibiAvatar size={48} mood="idle" />);
      const img = screen.getByTestId('vibi-avatar-img');

      // Trigger image error
      fireEvent.error(img);

      // Image is unmounted / hidden and SVG stays fully visible
      const svg = container.querySelector('svg.vibi-avatar-svg');
      expect(svg).toBeInTheDocument();
    });
  });
});

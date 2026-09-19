/**
 * client/src/__tests__/VibiDynamicCompanion.test.jsx
 * ====================================================
 * Tests for Vibi Dynamic Living Character, Personality & Movable Launcher
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import vibiCharacterService, {
  VIBI_STATES,
  SAFE_MARGINS,
  VIBI_DOCK_STORAGE_KEY
} from '../services/vibiCharacterService';
import VibiAvatar from '../components/vibi/VibiAvatar';
import VibiLauncher from '../components/vibi/VibiLauncher';
import { VibiAssistantProvider, useVibiAssistant } from '../context/VibiAssistantContext';
import AuthContext from '../context/AuthContext';

describe('Vibi Dynamic Living Character, Personality & Movable Launcher', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vibiCharacterService.idle();
    vibiCharacterService.resetDockPosition();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vibiCharacterService.idle();
  });

  describe('1. Personality States & Transitions', () => {
    it('initializes in IDLE state', () => {
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.IDLE);
    });

    it('transitions to CELEBRATE on celebrate() and auto-reverts to IDLE after duration', () => {
      vi.useFakeTimers();

      vibiCharacterService.celebrate();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.CELEBRATE);

      // Fast-forward past duration (3000ms)
      act(() => {
        vi.advanceTimersByTime(3500);
      });

      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.IDLE);
      vi.useRealTimers();
    });

    it('transitions to THINKING and LISTENING appropriately', () => {
      vibiCharacterService.think();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.THINKING);

      vibiCharacterService.listen();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.LISTENING);

      vibiCharacterService.concerned();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.ERROR);
    });

    it('subscribers receive state transitions in real time', () => {
      const listener = vi.fn();
      const unsub = vibiCharacterService.subscribe(listener);

      vibiCharacterService.happy();
      expect(listener).toHaveBeenCalledWith(VIBI_STATES.SUCCESS, expect.any(Object));

      unsub();
      vibiCharacterService.idle();
      // Should not be called again after unsubscribe
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Anti-Spam & Cooldown Rules', () => {
    it('suppresses rapid consecutive ambient reactions within cooldown window', () => {
      // First ambient reaction succeeds
      const first = vibiCharacterService.setState(VIBI_STATES.NEW_MESSAGE, { durationMs: 2000, force: false });
      expect(first).toBe(true);

      // Immediate second ambient reaction is blocked by anti-spam cooldown
      const second = vibiCharacterService.setState(VIBI_STATES.NEW_MESSAGE, { durationMs: 2000, force: false });
      expect(second).toBe(false);
    });

    it('allows forced user-driven reactions to bypass cooldown', () => {
      vibiCharacterService.setState(VIBI_STATES.NEW_MESSAGE, { durationMs: 2000, force: false });

      // User asking or executing an action forces celebration/thinking
      const userReaction = vibiCharacterService.celebrate();
      expect(userReaction).toBe(true);
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.CELEBRATE);
    });

    it('respects animations preference: rejects non-idle transitions when animations is false', () => {
      const rejected = vibiCharacterService.setState(VIBI_STATES.CELEBRATE, {
        preferences: { animations: false }
      });
      expect(rejected).toBe(false);
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.IDLE);
    });
  });

  describe('3. Movable Character & Safe-Edge Snapping Physics', () => {
    it('clamps coordinates strictly within safe screen boundaries', () => {
      // Mock screen 375x812 (iPhone standard)
      vi.stubGlobal('innerWidth', 375);
      vi.stubGlobal('innerHeight', 812);

      // Attempt to drag off top-left
      const offTopLeft = vibiCharacterService.clampPosition(-50, -50, 100, 48);
      expect(offTopLeft.x).toBe(SAFE_MARGINS.LEFT);
      expect(offTopLeft.y).toBe(SAFE_MARGINS.TOP);

      // Attempt to drag off bottom-right
      const offBottomRight = vibiCharacterService.clampPosition(500, 900, 100, 48);
      expect(offBottomRight.x).toBe(375 - 100 - SAFE_MARGINS.RIGHT);
      expect(offBottomRight.y).toBe(812 - 48 - SAFE_MARGINS.BOTTOM);
    });

    it('snaps to nearest safe edge (left or right)', () => {
      vi.stubGlobal('innerWidth', 400);
      vi.stubGlobal('innerHeight', 800);

      // Near left side (x = 100, mid = 200) -> snaps to left edge
      const snapLeft = vibiCharacterService.snapToEdge(100, 300, 100, 48);
      expect(snapLeft.x).toBe(SAFE_MARGINS.LEFT);
      expect(snapLeft.isLeftDocked).toBe(true);

      // Near right side (x = 260, mid = 200) -> snaps to right edge
      const snapRight = vibiCharacterService.snapToEdge(260, 300, 100, 48);
      expect(snapRight.x).toBe(400 - 100 - SAFE_MARGINS.RIGHT);
      expect(snapRight.isLeftDocked).toBe(false);
    });

    it('persists and restores custom dock position in localStorage', () => {
      vi.stubGlobal('innerWidth', 400);
      vi.stubGlobal('innerHeight', 800);

      vibiCharacterService.saveDockPosition(16, 250);
      const restored = vibiCharacterService.getDockPosition(100, 48);

      expect(restored.x).toBe(16);
      expect(restored.y).toBe(250);
      expect(restored.isLeftDocked).toBe(true);
    });
  });

  describe('4. VibiAvatar Expressive Renderings', () => {
    it('renders different visual moods correctly with appropriate test attributes', () => {
      const { rerender } = render(<VibiAvatar size={40} mood="idle" />);
      expect(screen.getByTestId('vibi-avatar')).toHaveAttribute('data-mood', 'idle');

      rerender(<VibiAvatar size={40} mood="celebrate" />);
      expect(screen.getByTestId('vibi-avatar')).toHaveAttribute('data-mood', 'celebrate');
      expect(screen.getByText('✨')).toBeInTheDocument();

      rerender(<VibiAvatar size={40} mood="thinking" />);
      expect(screen.getByTestId('vibi-avatar')).toHaveAttribute('data-mood', 'thinking');
      expect(screen.getByText('💡')).toBeInTheDocument();

      rerender(<VibiAvatar size={40} mood="sleepy" />);
      expect(screen.getByTestId('vibi-avatar')).toHaveAttribute('data-mood', 'sleepy');
      expect(screen.getByText('zZ')).toBeInTheDocument();
    });
  });

  describe('5. Interactive Movable VibiLauncher & Gestures', () => {
    it('renders movable launcher with dynamic mood attribute', () => {
      render(
        <AuthContext.Provider value={{ user: { username: 'testuser' } }}>
          <VibiAssistantProvider>
            <VibiLauncher />
          </VibiAssistantProvider>
        </AuthContext.Provider>
      );

      const fab = screen.getByTestId('vibi-launcher-fab');
      expect(fab).toBeInTheDocument();
      expect(fab).toHaveAttribute('data-mood', 'idle');
    });

    it('performs clean tap to open assistant when movement is within threshold (< 6px)', () => {
      render(
        <AuthContext.Provider value={{ user: { username: 'testuser' } }}>
          <VibiAssistantProvider>
            <VibiLauncher />
          </VibiAssistantProvider>
        </AuthContext.Provider>
      );

      const container = screen.getByTestId('vibi-launcher-container');

      // Pointer down and pointer up without moving
      fireEvent.pointerDown(container, { clientX: 100, clientY: 200, button: 0 });
      fireEvent.pointerUp(window, { clientX: 101, clientY: 201 });

      // Clean tap opens Vibi, which triggers welcome reaction
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.WELCOME);
    });

    it('drags and moves launcher when movement exceeds 6px threshold', () => {
      vi.stubGlobal('innerWidth', 400);
      vi.stubGlobal('innerHeight', 800);

      render(
        <AuthContext.Provider value={{ user: { username: 'testuser' } }}>
          <VibiAssistantProvider>
            <VibiLauncher />
          </VibiAssistantProvider>
        </AuthContext.Provider>
      );

      const container = screen.getByTestId('vibi-launcher-container');

      // Start drag at (100, 200)
      fireEvent.pointerDown(container, { clientX: 100, clientY: 200, button: 0 });

      // Move by 30px to (130, 220) -> exceeds threshold
      fireEvent.pointerMove(window, { clientX: 130, clientY: 220 });
      expect(container.className).toContain('is-dragging');

      // Release drag
      fireEvent.pointerUp(window, { clientX: 130, clientY: 220 });

      // Saved position should be snapped to nearest edge
      const saved = JSON.parse(localStorage.getItem(VIBI_DOCK_STORAGE_KEY));
      expect(saved).toBeDefined();
      expect(typeof saved.x).toBe('number');
      expect(typeof saved.y).toBe('number');
    });
  });

  describe('6. Master OFF Rule & Character Teardown', () => {
    function MasterSwitchApp() {
      const { updatePreferences } = useVibiAssistant();
      return (
        <div>
          <button onClick={() => updatePreferences({ enabled: false })}>Turn OFF</button>
          <VibiLauncher />
        </div>
      );
    }

    it('completely unmounts launcher and resets character to IDLE when Master switch is turned OFF', async () => {
      render(
        <AuthContext.Provider value={{ user: { username: 'testuser' } }}>
          <VibiAssistantProvider>
            <MasterSwitchApp />
          </VibiAssistantProvider>
        </AuthContext.Provider>
      );

      expect(screen.getByTestId('vibi-launcher-fab')).toBeInTheDocument();

      // Trigger celebrate
      vibiCharacterService.celebrate();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.CELEBRATE);

      // Turn OFF Master Switch
      fireEvent.click(screen.getByText('Turn OFF'));

      await waitFor(() => {
        expect(screen.queryByTestId('vibi-launcher-fab')).not.toBeInTheDocument();
        expect(vibiCharacterService.getState()).toBe(VIBI_STATES.IDLE);
      });
    });
  });
});

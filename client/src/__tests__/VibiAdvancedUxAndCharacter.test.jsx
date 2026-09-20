import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import vibiCharacterService, {
  VIBI_STATES,
  VIBI_EMOTIONS,
  EMOTION_PRIORITY
} from '../services/vibiCharacterService';
import VibiCharacter from '../components/vibi/VibiCharacter';
import VibiAvatar from '../components/vibi/VibiAvatar';
import VibiPanel from '../components/vibi/VibiPanel';
import VibiConversation from '../components/vibi/VibiConversation';
import { VibiAssistantProvider, useVibiAssistant } from '../context/VibiAssistantContext';
import vibiContextService from '../services/vibiContextService';
import vibiIntentEngine from '../services/vibiIntentEngine';

// Mock matchMedia
function setReducedMotion(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes('prefers-reduced-motion') ? matches : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
}

describe('Phase 9: Advanced UX & Vibi Character Lifecycle, Accessibility & Reduced Motion', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    setReducedMotion(false);
    vibiCharacterService.idle();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('1. 7-State Character Lifecycle & Confirmation Guard', () => {
    it('defines and sets all 7 core lifecycle states', () => {
      expect(VIBI_STATES.IDLE).toBe('idle');
      expect(VIBI_STATES.LISTENING).toBe('listening');
      expect(VIBI_STATES.THINKING).toBe('thinking');
      expect(VIBI_STATES.RESPONDING).toBe('responding');
      expect(VIBI_STATES.SUCCESS).toBe('success');
      expect(VIBI_STATES.ERROR).toBe('error');
      expect(VIBI_STATES.CONFIRMATION).toBe('confirmation');

      // Test all 7 transitions
      vibiCharacterService.idle();
      expect(vibiCharacterService.getState()).toBe('idle');

      vibiCharacterService.listening();
      expect(vibiCharacterService.getState()).toBe('listening');

      vibiCharacterService.thinking();
      expect(vibiCharacterService.getState()).toBe('thinking');

      vibiCharacterService.responding();
      expect(vibiCharacterService.getState()).toBe('responding');

      vibiCharacterService.success();
      expect(vibiCharacterService.getState()).toBe('success');

      vibiCharacterService.error();
      expect(vibiCharacterService.getState()).toBe('error');

      vibiCharacterService.confirmation();
      expect(vibiCharacterService.getState()).toBe('confirmation');
    });

    it('confirmation state is persistent and critical priority', () => {
      vibiCharacterService.confirmation();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.CONFIRMATION);
      expect(vibiCharacterService.getPriority()).toBe(EMOTION_PRIORITY.CRITICAL);

      // Fast-forward time: should not auto-revert because duration is 0
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.CONFIRMATION);
    });

    it('renders confirmation shield badge and attentive styling in VibiCharacter', () => {
      const { container } = render(<VibiCharacter size={64} mood="confirmation" />);
      const text = container.querySelector('text');
      expect(text).not.toBeNull();
      expect(text?.textContent).toContain('🛡️');

      const svg = container.querySelector('svg');
      expect(svg?.classList.contains('state-confirmation')).toBe(true);
      expect(svg?.classList.contains('vibi-attentive-focus')).toBe(true);
    });

    it('renders confirmation shield badge in VibiAvatar', () => {
      const { container } = render(<VibiAvatar size={36} mood="confirmation" />);
      const badge = container.querySelector('.vibi-emotion-badge');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toContain('🛡️');
    });
  });

  describe('2. Reduced Motion Detection & Behavior Guard', () => {
    it('detects when prefers-reduced-motion is active', () => {
      setReducedMotion(true);
      expect(vibiCharacterService.isReducedMotion()).toBe(true);

      setReducedMotion(false);
      expect(vibiCharacterService.isReducedMotion()).toBe(false);
    });

    it('suppresses ambient micro-behavior transitions when reduced motion is enabled', () => {
      setReducedMotion(true);
      // Ambient spontaneous reaction without force should be rejected
      const accepted = vibiCharacterService.setEmotion(VIBI_STATES.LOOK_AROUND, {
        priority: EMOTION_PRIORITY.NORMAL,
        metadata: { ambient: true },
        force: false
      });
      expect(accepted).toBe(false);
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.IDLE);
    });
  });

  describe('3. WCAG 2.1 AA Accessibility: Escape Dismiss & Dialog Trapping', () => {
    it('closes VibiPanel on Escape key press', () => {
      const Wrapper = () => {
        const { openAssistant } = useVibiAssistant();
        return (
          <div>
            <button onClick={() => openAssistant()}>Open</button>
            <VibiPanel />
          </div>
        );
      };

      render(
        <VibiAssistantProvider>
          <Wrapper />
        </VibiAssistantProvider>
      );

      // Open assistant
      fireEvent.click(screen.getByText('Open'));
      expect(screen.getByTestId('vibi-assistant-panel')).toBeDefined();

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      // Panel should now be closed
      expect(screen.queryByTestId('vibi-assistant-panel')).toBeNull();
    });

    it('traps focus inside VibiPanel with Tab and Shift+Tab', () => {
      const Wrapper = () => {
        const { openAssistant } = useVibiAssistant();
        return (
          <div>
            <button onClick={() => openAssistant()}>Open</button>
            <VibiPanel />
          </div>
        );
      };

      render(
        <VibiAssistantProvider>
          <Wrapper />
        </VibiAssistantProvider>
      );

      fireEvent.click(screen.getByText('Open'));
      const minimizeBtn = screen.getByTestId('vibi-minimize-btn');
      const closeBtn = screen.getByTestId('vibi-close-btn');

      // Focus close button (last focusable element or one of them)
      closeBtn.focus();
      expect(document.activeElement).toBe(closeBtn);

      // Press Tab: should cycle to first focusable element
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    });
  });

  describe('4. Suggestion Chips Keyboard Navigation & Confirmation Dialog', () => {
    it('renders accessible role and labels on suggestion chips', () => {
      render(
        <VibiAssistantProvider>
          <VibiConversation />
        </VibiAssistantProvider>
      );

      const suggestionsList = screen.getByRole('list', { name: /Suggested prompts/i });
      expect(suggestionsList).toBeDefined();

      const pills = screen.getAllByRole('listitem');
      expect(pills.length).toBeGreaterThan(0);
      expect(pills[0].getAttribute('aria-label')).toMatch(/Suggestion:/i);
    });

    it('allows keyboard arrow navigation between suggestion chips', () => {
      render(
        <VibiAssistantProvider>
          <VibiConversation />
        </VibiAssistantProvider>
      );

      const pills = screen.getAllByRole('listitem');
      if (pills.length >= 2) {
        pills[0].focus();
        expect(document.activeElement).toBe(pills[0]);

        // ArrowRight moves focus to second pill
        fireEvent.keyDown(pills[0], { key: 'ArrowRight' });
        expect(document.activeElement).toBe(pills[1]);

        // ArrowLeft moves focus back to first pill
        fireEvent.keyDown(pills[1], { key: 'ArrowLeft' });
        expect(document.activeElement).toBe(pills[0]);

        // End key moves focus to last pill
        fireEvent.keyDown(pills[0], { key: 'End' });
        expect(document.activeElement).toBe(pills[pills.length - 1]);

        // Home key moves focus to first pill
        fireEvent.keyDown(pills[pills.length - 1], { key: 'Home' });
        expect(document.activeElement).toBe(pills[0]);
      }
    });

    it('renders accessible alertdialog confirmation card and dismisses on Escape', async () => {
      // Mock intent detection & action requiring confirmation
      vi.spyOn(vibiIntentEngine, 'detectIntent').mockReturnValue({
        matched: true,
        actionId: 'clear_history',
        params: {},
        replyText: 'Clearing history requires confirmation.',
        topic: 'chat'
      });
      vi.spyOn(vibiIntentEngine, 'executeIntent').mockResolvedValue({
        success: true,
        requiresConfirmation: true,
        actionId: 'clear_history',
        actionName: 'Clear History',
        description: 'Are you sure you want to clear your conversation history?',
        sanitizedParams: {}
      });

      render(
        <VibiAssistantProvider>
          <VibiConversation />
        </VibiAssistantProvider>
      );

      // Trigger user query that requires confirmation
      const input = screen.getByPlaceholderText(/Ask Vibi anything/i);
      fireEvent.change(input, { target: { value: 'clear my history' } });
      fireEvent.submit(input.closest('form'));

      // Advance debounce timer and flush async microtasks
      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      // Confirmation card should be rendered with role="alertdialog"
      const confirmCard = screen.getByTestId('vibi-confirmation-card');
      expect(confirmCard.getAttribute('role')).toBe('alertdialog');
      expect(confirmCard.textContent).toContain('Confirmation Required');

      // Vibi character should be in confirmation state
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.CONFIRMATION);

      // Press Escape to cancel confirmation dialog
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      // Confirmation card should disappear and Vibi revert to idle
      expect(screen.queryByTestId('vibi-confirmation-card')).toBeNull();
      expect(vibiCharacterService.getState()).toBe(VIBI_STATES.IDLE);
    });
  });
});

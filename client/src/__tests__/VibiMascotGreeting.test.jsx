/**
 * client/src/__tests__/VibiMascotGreeting.test.jsx
 * ================================================
 * Unit and integration tests for Phase 1 Delight Feature:
 * Vibi Mascot & App Open Animation (Option 2)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import VibiMascotGreeting from '../components/VibiMascotGreeting';

describe('VibiMascotGreeting Component (Phase 1 Delight Feature)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders greeting with personalized username when user is logged in', () => {
    const mockUser = { username: 'alex', full_name: 'Alex Rivera' };
    render(<VibiMascotGreeting user={mockUser} forceShow={true} />);

    // Fast-forward initial layout delay
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const greetingElement = screen.getByTestId('vibi-mascot-greeting');
    expect(greetingElement).toBeInTheDocument();
    expect(greetingElement).toHaveAttribute('role', 'status');
    expect(greetingElement).toHaveAttribute('aria-live', 'polite');

    expect(screen.getByText('Vibi')).toBeInTheDocument();
    expect(screen.getByText('Welcome back, @alex! 🦊👋')).toBeInTheDocument();
    expect(screen.getByTestId('vibi-character-art')).toBeInTheDocument();
  });

  it('renders generic warm greeting when no user is logged in (guest / demo mode)', () => {
    render(<VibiMascotGreeting user={null} forceShow={true} />);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText('Welcome to VibeGrid! 🦊👋')).toBeInTheDocument();
  });

  it('dismisses immediately when close button or mascot card is clicked', () => {
    const onDismiss = vi.fn();
    render(<VibiMascotGreeting user={{ username: 'sarah' }} forceShow={true} onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const closeBtn = screen.getByLabelText('Dismiss greeting');
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);

    // Fast-forward exit transition
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId('vibi-mascot-greeting')).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after the display duration', () => {
    render(<VibiMascotGreeting user={{ username: 'david' }} forceShow={true} />);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByTestId('vibi-mascot-greeting')).toBeInTheDocument();

    // Fast-forward 2800ms auto-dismiss + 450ms exit transition
    act(() => {
      vi.advanceTimersByTime(3400);
    });

    expect(screen.queryByTestId('vibi-mascot-greeting')).not.toBeInTheDocument();
  });

  it('sets sessionStorage on first run and does not show on subsequent mounts unless forced', () => {
    const { unmount } = render(<VibiMascotGreeting user={{ username: 'charlie' }} />);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByTestId('vibi-mascot-greeting')).toBeInTheDocument();
    expect(sessionStorage.getItem('vibegrid_vibi_mascot_seen')).toBe('true');

    unmount();

    // Mount second time without forceShow
    render(<VibiMascotGreeting user={{ username: 'charlie' }} />);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByTestId('vibi-mascot-greeting')).not.toBeInTheDocument();
  });
});

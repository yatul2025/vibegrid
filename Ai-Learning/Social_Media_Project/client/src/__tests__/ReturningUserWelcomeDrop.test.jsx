/**
 * client/src/__tests__/ReturningUserWelcomeDrop.test.jsx
 * ======================================================
 * Unit and integration tests for Phase 2 Delight Feature:
 * Returning User Welcome Drop (Option 5: Vibi's Daily Drop)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReturningUserWelcomeDrop from '../components/ReturningUserWelcomeDrop';

describe('ReturningUserWelcomeDrop Component (Phase 2 Delight Feature)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders personalized greeting, Vibi avatar icon, and streak badge for logged in user', () => {
    const mockUser = { username: 'maya', full_name: 'Maya Lin' };
    render(<ReturningUserWelcomeDrop user={mockUser} unreadCount={2} forceShow={true} />);

    // Fast-forward initial entrance delay (600ms)
    act(() => {
      vi.advanceTimersByTime(700);
    });

    const dropElem = screen.getByTestId('welcome-user-drop');
    expect(dropElem).toBeInTheDocument();
    expect(dropElem).toHaveAttribute('role', 'status');
    expect(dropElem).toHaveAttribute('aria-live', 'polite');

    expect(screen.getByText(/Welcome back, @maya!/i)).toBeInTheDocument();
    expect(screen.getByText(/DAY STREAK/i)).toBeInTheDocument();
    expect(screen.getByText(/2 new updates waiting!/i)).toBeInTheDocument();
  });

  it('renders guest fallback title when user is null', () => {
    render(<ReturningUserWelcomeDrop user={null} unreadCount={0} forceShow={true} />);

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.getByText(/Welcome to VibeGrid!/i)).toBeInTheDocument();
    expect(screen.getByText(/Catch the vibe!/i)).toBeInTheDocument();
  });

  it('dismisses immediately when close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<ReturningUserWelcomeDrop user={{ username: 'leo' }} forceShow={true} onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(700);
    });

    const closeBtn = screen.getByLabelText('Close welcome greeting');
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);

    // Fast-forward exit transition (380ms)
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.queryByTestId('welcome-user-drop')).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after the display duration', () => {
    render(<ReturningUserWelcomeDrop user={{ username: 'zack' }} forceShow={true} />);

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByTestId('welcome-user-drop')).toBeInTheDocument();

    // Fast-forward 3200ms auto-dismiss + 380ms exit animation
    act(() => {
      vi.advanceTimersByTime(3700);
    });

    expect(screen.queryByTestId('welcome-user-drop')).not.toBeInTheDocument();
  });

  it('sets sessionStorage on first appearance and skips on second mount unless forced', () => {
    const { unmount } = render(<ReturningUserWelcomeDrop user={{ username: 'rachel' }} />);

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByTestId('welcome-user-drop')).toBeInTheDocument();
    expect(sessionStorage.getItem('vibegrid_welcome_drop_seen')).toBe('true');

    unmount();

    // Mount second time
    render(<ReturningUserWelcomeDrop user={{ username: 'rachel' }} />);
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.queryByTestId('welcome-user-drop')).not.toBeInTheDocument();
  });
});

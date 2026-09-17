/**
 * client/src/__tests__/NetworkStatusPill.test.jsx
 * ===============================================
 * Unit and integration tests for Phase 7 Delight Feature:
 * Offline & Reconnection Experience (Option 1: Floating Dynamic Pill & Emerald Pulse)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import NetworkStatusPill from '../components/NetworkStatusPill';

describe('NetworkStatusPill Component (Phase 7 Delight Feature: Option 1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders nothing when network is online and no reconnect has occurred', () => {
    render(<NetworkStatusPill isOffline={false} />);
    expect(screen.queryByTestId('network-status-pill')).not.toBeInTheDocument();
  });

  it('renders frosted amber pill with radar dot when isOffline is true', () => {
    render(<NetworkStatusPill isOffline={true} />);

    const pillContainer = screen.getByTestId('network-status-pill');
    expect(pillContainer).toBeInTheDocument();
    expect(pillContainer).toHaveAttribute('role', 'status');
    expect(pillContainer).toHaveAttribute('aria-live', 'polite');

    const offlinePill = screen.getByTestId('network-pill-offline');
    expect(offlinePill).toBeInTheDocument();
    expect(screen.getByText(/Offline Mode · Cached feed available/i)).toBeInTheDocument();
  });

  it('triggers emerald reconnection ripple and haptic feedback when transitioning from offline to online', () => {
    const vibrateSpy = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateSpy,
      configurable: true,
      writable: true
    });

    const { rerender } = render(<NetworkStatusPill isOffline={true} />);
    expect(screen.getByTestId('network-pill-offline')).toBeInTheDocument();

    // Transition to online
    act(() => {
      rerender(<NetworkStatusPill isOffline={false} />);
    });

    const onlinePill = screen.getByTestId('network-pill-online');
    expect(onlinePill).toBeInTheDocument();
    expect(screen.getByText(/Back Online · Everything synced ✨/i)).toBeInTheDocument();

    // Verify emerald shockwave ripple element
    expect(onlinePill.querySelector('.emerald-reconnect-ripple')).toBeInTheDocument();

    // Verify haptics was emitted
    expect(vibrateSpy).toHaveBeenCalledWith([25, 50]);

    // Fast-forward auto-dismiss timer (2.8s + 400ms exit)
    act(() => {
      vi.advanceTimersByTime(2800);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId('network-status-pill')).not.toBeInTheDocument();
  });

  it('responds to window online and offline events when prop is omitted', () => {
    render(<NetworkStatusPill />);
    expect(screen.queryByTestId('network-status-pill')).not.toBeInTheDocument();

    // Dispatch offline event
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByTestId('network-pill-offline')).toBeInTheDocument();

    // Dispatch online event
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.getByTestId('network-pill-online')).toBeInTheDocument();
  });

  it('renders correctly when forced via forceShowState', () => {
    const { rerender } = render(<NetworkStatusPill forceShowState="offline" />);
    expect(screen.getByTestId('network-pill-offline')).toBeInTheDocument();

    rerender(<NetworkStatusPill forceShowState="reconnected" />);
    expect(screen.getByTestId('network-pill-online')).toBeInTheDocument();
  });
});

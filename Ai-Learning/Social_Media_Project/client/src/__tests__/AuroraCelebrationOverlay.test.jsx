/**
 * client/src/__tests__/AuroraCelebrationOverlay.test.jsx
 * =======================================================
 * Unit and integration tests for Phase 5 Delight Feature:
 * Success / Celebration Animations (Option 2: Aurora Radiance & Shimmer Ring)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AuroraCelebrationOverlay, { triggerCelebration } from '../components/AuroraCelebrationOverlay';

describe('AuroraCelebrationOverlay (Phase 5 Delight Feature: Option 2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders nothing when no celebration has occurred', () => {
    render(<AuroraCelebrationOverlay />);
    expect(screen.queryByTestId('aurora-celebration-overlay')).not.toBeInTheDocument();
  });

  it('mounts and displays celebration title and subtitle upon triggerCelebration call', () => {
    const vibrateSpy = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateSpy,
      configurable: true,
      writable: true
    });

    render(<AuroraCelebrationOverlay />);

    act(() => {
      triggerCelebration({
        title: 'Post Published! 🎉',
        subtitle: 'Shared to your feed and followers'
      });
    });

    const overlay = screen.getByTestId('aurora-celebration-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('role', 'status');
    expect(overlay).toHaveAttribute('aria-live', 'polite');

    expect(screen.getByText('Post Published! 🎉')).toBeInTheDocument();
    expect(screen.getByText('Shared to your feed and followers')).toBeInTheDocument();

    // Verify haptic feedback was called
    expect(vibrateSpy).toHaveBeenCalledWith([25, 40]);
  });

  it('renders stroke-dash checkmark SVG and expanding radiance rings', () => {
    render(<AuroraCelebrationOverlay />);

    act(() => {
      triggerCelebration({
        title: 'Story is Live! 📸'
      });
    });

    const capsule = screen.getByTestId('aurora-shimmer-capsule');
    expect(capsule).toBeInTheDocument();

    const checkSvg = capsule.querySelector('.aurora-check-svg');
    expect(checkSvg).toBeInTheDocument();

    const checkPath = capsule.querySelector('.aurora-check-path');
    expect(checkPath).toBeInTheDocument();

    const rings = screen.getByTestId('aurora-celebration-overlay').querySelectorAll('.aurora-radiance-ring');
    expect(rings.length).toBe(2);
  });

  it('auto-dismisses after the specified duration', () => {
    render(<AuroraCelebrationOverlay />);

    act(() => {
      triggerCelebration({
        title: 'Profile Saved! ✨',
        duration: 2000
      });
    });

    expect(screen.getByText('Profile Saved! ✨')).toBeInTheDocument();

    // Advance to timer expiration
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Animate out duration
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.queryByTestId('aurora-celebration-overlay')).not.toBeInTheDocument();
  });

  it('dismisses when close button is clicked', () => {
    render(<AuroraCelebrationOverlay />);

    act(() => {
      triggerCelebration({
        title: 'Following @alex! ✨'
      });
    });

    const closeBtn = screen.getByLabelText('Dismiss celebration');
    expect(closeBtn).toBeInTheDocument();

    act(() => {
      fireEvent.click(closeBtn);
    });

    // Advance exit animation timer (350ms)
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.queryByTestId('aurora-celebration-overlay')).not.toBeInTheDocument();
  });

  it('dismisses when capsule itself is tapped', () => {
    render(<AuroraCelebrationOverlay />);

    act(() => {
      triggerCelebration({
        title: 'Tap to dismiss test'
      });
    });

    const capsule = screen.getByTestId('aurora-shimmer-capsule');
    act(() => {
      fireEvent.click(capsule);
    });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.queryByTestId('aurora-celebration-overlay')).not.toBeInTheDocument();
  });
});

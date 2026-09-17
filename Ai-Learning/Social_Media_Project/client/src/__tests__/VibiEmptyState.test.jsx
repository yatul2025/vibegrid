/**
 * client/src/__tests__/VibiEmptyState.test.jsx
 * ============================================
 * Unit and integration tests for Phase 6 Delight Feature:
 * Empty States Delight (Option 1: Vibi's Mascot Moments)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import VibiEmptyState from '../components/VibiEmptyState';

describe('VibiEmptyState Component (Phase 6 Delight Feature: Option 1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders title and subtitle with proper accessibility roles', () => {
    render(
      <VibiEmptyState
        title="Your feed is waiting!"
        subtitle="Be the first one to share a photo moment with the VibeGrid community."
      />
    );

    const container = screen.getByTestId('vibi-empty-state');
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute('role', 'status');
    expect(container).toHaveAttribute('aria-live', 'polite');

    expect(screen.getByText('Your feed is waiting!')).toBeInTheDocument();
    expect(
      screen.getByText('Be the first one to share a photo moment with the VibeGrid community.')
    ).toBeInTheDocument();
  });

  it('renders contextual pose accessories for camera, mail, wave, treasure, magnifier', () => {
    const { rerender, container } = render(<VibiEmptyState pose="camera" />);
    expect(container.querySelector('.vibi-accessory-camera')).toBeInTheDocument();

    rerender(<VibiEmptyState pose="mail" />);
    expect(container.querySelector('.vibi-accessory-mail')).toBeInTheDocument();

    rerender(<VibiEmptyState pose="wave" />);
    expect(container.querySelector('.vibi-accessory-wave')).toBeInTheDocument();

    rerender(<VibiEmptyState pose="treasure" />);
    expect(container.querySelector('.vibi-accessory-treasure')).toBeInTheDocument();

    rerender(<VibiEmptyState pose="magnifier" />);
    expect(container.querySelector('.vibi-accessory-magnifier')).toBeInTheDocument();
  });

  it('triggers wiggle animation on mascot click and resets after timeout', () => {
    const { container } = render(<VibiEmptyState title="Wiggle Test" />);
    const stage = container.querySelector('.vibi-empty-mascot-stage');

    expect(stage).not.toHaveClass('wiggling');

    act(() => {
      fireEvent.click(stage);
    });

    expect(stage).toHaveClass('wiggling');

    act(() => {
      vi.advanceTimersByTime(650);
    });

    expect(stage).not.toHaveClass('wiggling');
  });

  it('triggers wiggle animation on Enter key down', () => {
    const { container } = render(<VibiEmptyState title="Key Wiggle Test" />);
    const stage = container.querySelector('.vibi-empty-mascot-stage');

    act(() => {
      fireEvent.keyDown(stage, { key: 'Enter', code: 'Enter' });
    });

    expect(stage).toHaveClass('wiggling');
  });

  it('renders action button and triggers onAction callback when clicked', () => {
    const onAction = vi.fn();
    render(
      <VibiEmptyState
        title="Action Test"
        actionLabel="Create Your First Post"
        onAction={onAction}
      />
    );

    const btn = screen.getByRole('button', { name: /create your first post/i });
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders secondary button and custom children', () => {
    const onSecondary = vi.fn();
    render(
      <VibiEmptyState
        title="Secondary Test"
        secondaryLabel="Show All Posts"
        onSecondaryAction={onSecondary}
      >
        <span data-testid="custom-child">Extra Content</span>
      </VibiEmptyState>
    );

    const secBtn = screen.getByRole('button', { name: /show all posts/i });
    expect(secBtn).toBeInTheDocument();
    fireEvent.click(secBtn);
    expect(onSecondary).toHaveBeenCalledTimes(1);

    expect(screen.getByTestId('custom-child')).toBeInTheDocument();
  });
});

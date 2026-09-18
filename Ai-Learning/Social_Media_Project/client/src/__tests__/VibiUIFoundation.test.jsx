/**
 * client/src/__tests__/VibiUIFoundation.test.jsx
 * ===============================================
 * Comprehensive Tests for Phase 2: Vibi UI Foundation
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  VibiAssistantProvider,
  useVibiAssistant
} from '../context/VibiAssistantContext';
import VibiAvatar from '../components/vibi/VibiAvatar';
import VibiHeaderEntry from '../components/vibi/VibiHeaderEntry';
import VibiLauncher from '../components/vibi/VibiLauncher';
import VibiPanel from '../components/vibi/VibiPanel';
import VibiConversation from '../components/vibi/VibiConversation';

// Test wrapper containing full UI shell
function FullVibiUIShell() {
  return (
    <VibiAssistantProvider>
      <div>
        <header>
          <VibiHeaderEntry />
        </header>
        <main>
          <h1>Test Main Page</h1>
        </main>
        <VibiLauncher />
        <VibiPanel />
      </div>
    </VibiAssistantProvider>
  );
}

describe('Vibi UI Foundation (Phase 2)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders VibiAvatar with SVG mascot and status dot', () => {
    const { container } = render(<VibiAvatar size={48} withStatusDot={true} isOnline={true} />);
    const svg = container.querySelector('svg.vibi-avatar-svg');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('width')).toBe('48');
    const dot = container.querySelector('.vibi-status-dot.online');
    expect(dot).toBeTruthy();
  });

  it('renders VibiHeaderEntry and toggles panel on click', () => {
    render(<FullVibiUIShell />);

    const headerBtn = screen.getByTestId('vibi-header-entry');
    expect(headerBtn).toBeTruthy();

    // Initially panel is not visible
    expect(screen.queryByTestId('vibi-assistant-panel')).toBeNull();

    // Click header entry to open
    fireEvent.click(headerBtn);
    expect(screen.getByTestId('vibi-assistant-panel')).toBeTruthy();

    // Click again to close
    fireEvent.click(headerBtn);
    expect(screen.queryByTestId('vibi-assistant-panel')).toBeNull();
  });

  it('renders Floating Action Button (FAB) launcher and opens panel', () => {
    render(<FullVibiUIShell />);

    const fab = screen.getByTestId('vibi-launcher-fab');
    expect(fab).toBeTruthy();
    expect(fab.textContent).toContain('Ask Vibi');

    // Tap launcher to open
    fireEvent.click(fab);
    expect(screen.getByTestId('vibi-assistant-panel')).toBeTruthy();

    // Once open and not minimized, floating launcher is hidden to prevent overlap
    expect(screen.queryByTestId('vibi-launcher-fab')).toBeNull();
  });

  it('supports minimizing and restoring panel from dock', () => {
    render(<FullVibiUIShell />);

    // Open via header
    fireEvent.click(screen.getByTestId('vibi-header-entry'));
    expect(screen.getByTestId('vibi-assistant-panel')).toBeTruthy();

    // Click minimize button
    const minBtn = screen.getByTestId('vibi-minimize-btn');
    fireEvent.click(minBtn);

    // Panel is closed, launcher shows minimized state
    expect(screen.queryByTestId('vibi-assistant-panel')).toBeNull();
    const fab = screen.getByTestId('vibi-launcher-fab');
    expect(fab).toBeTruthy();
    expect(fab.textContent).toContain('Vibi (Minimized)');

    // Click minimized launcher to restore
    fireEvent.click(fab);
    expect(screen.getByTestId('vibi-assistant-panel')).toBeTruthy();
  });

  it('closes panel on backdrop click or close button', () => {
    render(<FullVibiUIShell />);

    // Open via header
    fireEvent.click(screen.getByTestId('vibi-header-entry'));
    expect(screen.getByTestId('vibi-assistant-panel')).toBeTruthy();

    // Click backdrop
    const backdrop = screen.getByTestId('vibi-panel-backdrop');
    fireEvent.click(backdrop);
    expect(screen.queryByTestId('vibi-assistant-panel')).toBeNull();

    // Open again and click close button
    fireEvent.click(screen.getByTestId('vibi-header-entry'));
    expect(screen.getByTestId('vibi-assistant-panel')).toBeTruthy();
    const closeBtn = screen.getByTestId('vibi-close-btn');
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('vibi-assistant-panel')).toBeNull();
  });

  it('displays empty state with suggestions and sends message on click', async () => {
    vi.useFakeTimers();

    render(<FullVibiUIShell />);

    // Open panel
    fireEvent.click(screen.getByTestId('vibi-header-entry'));
    expect(screen.getByTestId('vibi-empty-thread')).toBeTruthy();

    // Click a suggestion chip
    const exploreChip = screen.getByText('Explore Trending');
    fireEvent.click(exploreChip);

    // Empty state disappears, user message appears
    expect(screen.queryByTestId('vibi-empty-thread')).toBeNull();
    expect(screen.getByText('Show me what is trending on VibeGrid')).toBeTruthy();

    // Advance timer for Vibi assistant native response
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText(/Hey! I'm Vibi/)).toBeTruthy();

    vi.useRealTimers();
  });

  it('sends message through text input and supports clearing thread', async () => {
    render(<FullVibiUIShell />);

    // Open panel
    fireEvent.click(screen.getByTestId('vibi-header-entry'));

    const input = screen.getByPlaceholderText('Ask Vibi anything...');
    const sendBtn = screen.getByTestId('vibi-send-btn');

    // Type and send
    fireEvent.change(input, { target: { value: 'How do I use groups?' } });
    fireEvent.click(sendBtn);

    expect(screen.getByText('How do I use groups?')).toBeTruthy();

    // Click clear chat button
    const clearBtn = screen.getByText('Clear Chat');
    fireEvent.click(clearBtn);

    // Back to empty state
    expect(screen.getByTestId('vibi-empty-thread')).toBeTruthy();
  });
});

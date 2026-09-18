/**
 * client/src/__tests__/VibiCoreFoundation.test.jsx
 * ==================================================
 * Tests for Phase 1: Vibi Core Foundation
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  VibiAssistantProvider,
  useVibiAssistant,
  DEFAULT_VIBI_PREFERENCES,
  VIBI_PREFERENCES_STORAGE_KEY
} from '../context/VibiAssistantContext';
import navigationService from '../services/navigationService';

// Test consumer component
function TestConsumer() {
  const {
    isEnabled,
    preferences,
    isOpen,
    isMinimized,
    mode,
    messages,
    isTyping,
    openAssistant,
    closeAssistant,
    minimizeAssistant,
    restoreAssistant,
    toggleAssistant,
    updatePreferences,
    resetPreferences,
    clearConversation,
    addMessage,
    setIsTyping
  } = useVibiAssistant();

  return (
    <div>
      <span data-testid="is-enabled">{String(isEnabled)}</span>
      <span data-testid="is-open">{String(isOpen)}</span>
      <span data-testid="is-minimized">{String(isMinimized)}</span>
      <span data-testid="mode">{mode}</span>
      <span data-testid="is-typing">{String(isTyping)}</span>
      <span data-testid="messages-count">{messages.length}</span>
      <span data-testid="pref-welcome">{String(preferences.welcome)}</span>
      <span data-testid="pref-fab">{String(preferences.floatingButton)}</span>

      <button data-testid="btn-open" onClick={() => openAssistant({ mode: 'chat', initialPrompt: 'Hello Vibi' })}>Open</button>
      <button data-testid="btn-close" onClick={closeAssistant}>Close</button>
      <button data-testid="btn-minimize" onClick={minimizeAssistant}>Minimize</button>
      <button data-testid="btn-restore" onClick={restoreAssistant}>Restore</button>
      <button data-testid="btn-toggle" onClick={toggleAssistant}>Toggle</button>
      <button data-testid="btn-add-msg" onClick={() => addMessage({ sender: 'vibi', text: 'Hey there!' })}>Add Message</button>
      <button data-testid="btn-clear" onClick={clearConversation}>Clear</button>
      <button data-testid="btn-disable-master" onClick={() => updatePreferences({ enabled: false })}>Disable Master</button>
      <button data-testid="btn-enable-master" onClick={() => updatePreferences({ enabled: true })}>Enable Master</button>
      <button data-testid="btn-toggle-welcome" onClick={() => updatePreferences({ welcome: false })}>Toggle Welcome</button>
      <button data-testid="btn-reset-prefs" onClick={resetPreferences}>Reset Prefs</button>
      <button data-testid="btn-typing" onClick={() => setIsTyping(true)}>Set Typing</button>
    </div>
  );
}

describe('Vibi Core Foundation (Phase 1)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders with default preferences and closed state', () => {
    render(
      <VibiAssistantProvider>
        <TestConsumer />
      </VibiAssistantProvider>
    );

    expect(screen.getByTestId('is-enabled').textContent).toBe('true');
    expect(screen.getByTestId('is-open').textContent).toBe('false');
    expect(screen.getByTestId('is-minimized').textContent).toBe('false');
    expect(screen.getByTestId('mode').textContent).toBe('chat');
    expect(screen.getByTestId('is-typing').textContent).toBe('false');
    expect(screen.getByTestId('messages-count').textContent).toBe('0');
    expect(screen.getByTestId('pref-welcome').textContent).toBe('true');
    expect(screen.getByTestId('pref-fab').textContent).toBe('true');
  });

  it('opens assistant with initial prompt and registers back interceptor', () => {
    const registerSpy = vi.spyOn(navigationService, 'registerBackInterceptor');

    render(
      <VibiAssistantProvider>
        <TestConsumer />
      </VibiAssistantProvider>
    );

    fireEvent.click(screen.getByTestId('btn-open'));

    expect(screen.getByTestId('is-open').textContent).toBe('true');
    expect(screen.getByTestId('messages-count').textContent).toBe('1');
    expect(registerSpy).toHaveBeenCalledWith('vibi-assistant-panel', expect.any(Function), 25);
  });

  it('minimizes and restores assistant correctly', () => {
    render(
      <VibiAssistantProvider>
        <TestConsumer />
      </VibiAssistantProvider>
    );

    fireEvent.click(screen.getByTestId('btn-open'));
    expect(screen.getByTestId('is-open').textContent).toBe('true');
    expect(screen.getByTestId('is-minimized').textContent).toBe('false');

    fireEvent.click(screen.getByTestId('btn-minimize'));
    expect(screen.getByTestId('is-minimized').textContent).toBe('true');

    fireEvent.click(screen.getByTestId('btn-restore'));
    expect(screen.getByTestId('is-minimized').textContent).toBe('false');
    expect(screen.getByTestId('is-open').textContent).toBe('true');
  });

  it('closes assistant via close button, escape key, and toggle', () => {
    render(
      <VibiAssistantProvider>
        <TestConsumer />
      </VibiAssistantProvider>
    );

    // Open then close
    fireEvent.click(screen.getByTestId('btn-open'));
    expect(screen.getByTestId('is-open').textContent).toBe('true');
    fireEvent.click(screen.getByTestId('btn-close'));
    expect(screen.getByTestId('is-open').textContent).toBe('false');

    // Toggle open
    fireEvent.click(screen.getByTestId('btn-toggle'));
    expect(screen.getByTestId('is-open').textContent).toBe('true');

    // Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('is-open').textContent).toBe('false');
  });

  it('enforces Master OFF rule: blocks opening and forces immediate close when master disabled', () => {
    render(
      <VibiAssistantProvider>
        <TestConsumer />
      </VibiAssistantProvider>
    );

    // Open while enabled
    fireEvent.click(screen.getByTestId('btn-open'));
    expect(screen.getByTestId('is-open').textContent).toBe('true');

    // Disable master switch
    fireEvent.click(screen.getByTestId('btn-disable-master'));
    expect(screen.getByTestId('is-enabled').textContent).toBe('false');
    expect(screen.getByTestId('is-open').textContent).toBe('false');

    // Attempt to open while disabled
    fireEvent.click(screen.getByTestId('btn-open'));
    expect(screen.getByTestId('is-open').textContent).toBe('false');
  });

  it('updates, persists, and resets preferences in localStorage', () => {
    render(
      <VibiAssistantProvider>
        <TestConsumer />
      </VibiAssistantProvider>
    );

    // Update individual toggle
    fireEvent.click(screen.getByTestId('btn-toggle-welcome'));
    expect(screen.getByTestId('pref-welcome').textContent).toBe('false');

    const stored = JSON.parse(localStorage.getItem(VIBI_PREFERENCES_STORAGE_KEY));
    expect(stored.welcome).toBe(false);
    expect(stored.enabled).toBe(true);

    // Reset preferences
    fireEvent.click(screen.getByTestId('btn-reset-prefs'));
    expect(screen.getByTestId('pref-welcome').textContent).toBe('true');
    const resetStored = JSON.parse(localStorage.getItem(VIBI_PREFERENCES_STORAGE_KEY));
    expect(resetStored.welcome).toBe(true);
  });

  it('handles message additions, typing state, and conversation clearance', () => {
    render(
      <VibiAssistantProvider>
        <TestConsumer />
      </VibiAssistantProvider>
    );

    fireEvent.click(screen.getByTestId('btn-add-msg'));
    expect(screen.getByTestId('messages-count').textContent).toBe('1');

    fireEvent.click(screen.getByTestId('btn-typing'));
    expect(screen.getByTestId('is-typing').textContent).toBe('true');

    fireEvent.click(screen.getByTestId('btn-clear'));
    expect(screen.getByTestId('messages-count').textContent).toBe('0');
    expect(screen.getByTestId('is-typing').textContent).toBe('false');
  });
});

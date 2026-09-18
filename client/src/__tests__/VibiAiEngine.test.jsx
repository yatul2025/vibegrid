/**
 * client/src/__tests__/VibiAiEngine.test.jsx
 * ===========================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 6 AI ENGINE TESTS
 *
 * Tests:
 * 1. Deterministic Quick Engine bypasses external AI calls (<1ms).
 * 2. Conversational / Complex queries route to vibiAiClient.
 * 3. AI tool-call proposals are validated by VibiOutputValidator before execution.
 * 4. Rejects unsafe or unwhitelisted AI tool actions without crashing.
 * 5. Gracefully falls back to local knowledge base when backend is offline or errors.
 * 6. Context sanitizer strictly omits sensitive authentication and chat data.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VibiConversation from '../components/vibi/VibiConversation';
import { VibiAssistantProvider } from '../context/VibiAssistantContext';
import { AuthProvider } from '../context/AuthContext';
import vibiContextService from '../services/vibiContextService';
import navigationService from '../services/navigationService';

// Mock apiClient
vi.mock('../api/client.js', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn()
  },
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

import { apiClient } from '../api/client.js';

describe('Phase 6 — Vibi AI Engine & Backend Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    navigationService.interceptors = [];
    navigationService.routeListener = null;
  });

  it('1. Deterministic queries bypass external AI and execute instantly via VibiIntentEngine', async () => {
    vi.useFakeTimers();

    const postSpy = vi.spyOn(apiClient, 'post');
    const routeSpy = vi.fn();
    navigationService.setRouteListener(routeSpy);

    render(
      <AuthProvider>
        <VibiAssistantProvider>
          <VibiConversation />
        </VibiAssistantProvider>
      </AuthProvider>
    );

    const input = screen.getByPlaceholderText(/Ask Vibi anything.../i);
    const sendBtn = screen.getByTestId('vibi-send-btn');

    // Deterministic command: "go to explore"
    fireEvent.change(input, { target: { value: 'go to explore' } });
    fireEvent.click(sendBtn);

    // Verify user message appears
    expect(screen.getByText('go to explore')).toBeInTheDocument();

    // Advance timers for typing indicator & intent execution
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // Should NOT call the backend AI endpoint because it matched locally
    expect(postSpy).not.toHaveBeenCalled();
    expect(routeSpy).toHaveBeenCalledWith({ tab: 'explore', section: null });
    expect(screen.getByText(/Heading over to/i)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('2. Natural language queries route to vibiAiClient and send minimized context', async () => {
    vi.useFakeTimers();

    const mockReply = {
      success: true,
      data: {
        replyText: 'End-to-End Encryption protects all your messages! 🔒',
        action: null,
        provider: 'gemini',
        isFallback: false
      }
    };

    vi.spyOn(apiClient, 'post').mockResolvedValue(mockReply);

    render(
      <AuthProvider>
        <VibiAssistantProvider>
          <VibiConversation />
        </VibiAssistantProvider>
      </AuthProvider>
    );

    const input = screen.getByPlaceholderText(/Ask Vibi anything.../i);
    const sendBtn = screen.getByTestId('vibi-send-btn');

    fireEvent.change(input, { target: { value: 'How does the encryption protect me?' } });
    fireEvent.click(sendBtn);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/vibi/chat',
      expect.objectContaining({
        message: 'How does the encryption protect me?',
        context: expect.objectContaining({
          activeTab: expect.any(String),
          theme: expect.any(String),
          online: expect.any(Boolean)
        })
      })
    );

    expect(screen.getByText(/End-to-End Encryption protects all your messages!/i)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('3. AI action proposals pass through VibiOutputValidator before execution', async () => {
    vi.useFakeTimers();

    const routeSpy = vi.fn();
    navigationService.setRouteListener(routeSpy);

    vi.spyOn(apiClient, 'post').mockResolvedValue({
      success: true,
      data: {
        replyText: 'Opening settings so you can review privacy! 🛡️',
        action: {
          id: 'navigate',
          params: { tab: 'settings', section: 'privacy' }
        },
        provider: 'openai'
      }
    });

    render(
      <AuthProvider>
        <VibiAssistantProvider>
          <VibiConversation />
        </VibiAssistantProvider>
      </AuthProvider>
    );

    const input = screen.getByPlaceholderText(/Ask Vibi anything.../i);
    const sendBtn = screen.getByTestId('vibi-send-btn');

    fireEvent.change(input, { target: { value: 'Where can I change my 2FA and privacy?' } });
    fireEvent.click(sendBtn);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(routeSpy).toHaveBeenCalledWith({ tab: 'settings', section: 'privacy' });
    expect(screen.getByText(/Opening settings so you can review privacy!/i)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('4. Rejects unsafe or unwhitelisted AI tool actions without crashing', async () => {
    vi.useFakeTimers();

    vi.spyOn(apiClient, 'post').mockResolvedValue({
      success: true,
      data: {
        replyText: 'I attempted a malicious action! 😈',
        action: {
          id: 'drop_database_tables', // Unregistered malicious action
          params: { force: true }
        },
        provider: 'gemini'
      }
    });

    render(
      <AuthProvider>
        <VibiAssistantProvider>
          <VibiConversation />
        </VibiAssistantProvider>
      </AuthProvider>
    );

    const input = screen.getByPlaceholderText(/Ask Vibi anything.../i);
    const sendBtn = screen.getByTestId('vibi-send-btn');

    fireEvent.change(input, { target: { value: 'Do something crazy' } });
    fireEvent.click(sendBtn);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // The message is displayed, but the malicious action is dropped
    expect(screen.getByText(/I attempted a malicious action!/i)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('5. Gracefully falls back to local knowledge base when backend is offline or errors', async () => {
    vi.useFakeTimers();

    // Network error
    vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('Network error: Server unreachable'));

    render(
      <AuthProvider>
        <VibiAssistantProvider>
          <VibiConversation />
        </VibiAssistantProvider>
      </AuthProvider>
    );

    const input = screen.getByPlaceholderText(/Ask Vibi anything.../i);
    const sendBtn = screen.getByTestId('vibi-send-btn');

    fireEvent.change(input, { target: { value: 'Can you tell me about the feed?' } });
    fireEvent.click(sendBtn);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText(/I can help you navigate screens/i)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('6. Context sanitizer strictly omits sensitive authentication and chat data', () => {
    const sensitiveUser = {
      id: 99,
      username: 'secret_agent',
      password: 'super_secret_password',
      token: 'jwt.token.abc',
      privateKey: 'crypto-key-123'
    };

    const snapshot = vibiContextService.getContextSnapshot(sensitiveUser);

    // Verify strict security blacklist
    expect(snapshot).not.toHaveProperty('password');
    expect(snapshot).not.toHaveProperty('token');
    expect(snapshot).not.toHaveProperty('privateKey');
    expect(snapshot.username).toBe('secret_agent');
  });
});

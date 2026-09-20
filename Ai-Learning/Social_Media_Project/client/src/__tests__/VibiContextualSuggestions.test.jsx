import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import vibiProactiveService from '../services/vibiProactiveService';
import vibiContextService from '../services/vibiContextService';
import VibiConversation from '../components/vibi/VibiConversation';
import { VibiAssistantProvider } from '../context/VibiAssistantContext';
import { AuthProvider } from '../context/AuthContext';

describe('Vibi Contextual Smart Suggestions & Multi-Modal Signals Suite (Phase 6)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vibiContextService.clearSelectedText();
    vibiContextService.clearFocusedField();
    vibiContextService.clearRecentTopic();
    vi.restoreAllMocks();
  });

  describe('1. Dynamic Post-Response Suggestion Generator', () => {
    it('generates tailored suggestions for E2EE cryptography topics', () => {
      const suggestions = vibiProactiveService.generatePostResponseSuggestions(
        'e2ee',
        'Your chats are end-to-end encrypted with Signal Protocol AES-256-GCM.',
        { currentTab: 'messages' }
      );

      expect(suggestions.length).toBeGreaterThanOrEqual(2);
      expect(suggestions.length).toBeLessThanOrEqual(4);
      expect(suggestions.some((s) => s.label.includes('Safety Number'))).toBe(true);
      expect(suggestions.some((s) => s.label.includes('Key Backup'))).toBe(true);
    });

    it('generates tailored suggestions for WebRTC calls and diagnostic topics', () => {
      const suggestions = vibiProactiveService.generatePostResponseSuggestions(
        'calls',
        'WebRTC calls use peer-to-peer media streams with audio ringing feedback.',
        { currentTab: 'feed' }
      );

      expect(suggestions.length).toBeGreaterThanOrEqual(2);
      expect(suggestions.length).toBeLessThanOrEqual(4);
      expect(suggestions.some((s) => s.label.includes('Call Diagnostics'))).toBe(true);
      expect(suggestions.some((s) => s.label.includes('Camera & Mic Access'))).toBe(true);
    });

    it('generates tailored suggestions for Appearance and themes', () => {
      const suggestions = vibiProactiveService.generatePostResponseSuggestions(
        'appearance',
        'VibeGrid supports 10 dynamic themes including Cyberpunk and OLED Dark.',
        { currentTab: 'settings', activeSection: 'appearance' }
      );

      expect(suggestions.length).toBeGreaterThanOrEqual(2);
      expect(suggestions.length).toBeLessThanOrEqual(4);
      expect(suggestions.some((s) => s.label.includes('Cyberpunk'))).toBe(true);
      expect(suggestions.some((s) => s.label.includes('Sound Effects'))).toBe(true);
    });

    it('filters out redundant navigation actions for the currently active tab and section', () => {
      const suggestions = vibiProactiveService.generatePostResponseSuggestions(
        null,
        'Opening Settings for you.',
        { currentTab: 'settings', activeSection: 'privacy' }
      );

      // Should not suggest navigating to Settings > Privacy since we are already there
      const redundant = suggestions.find(
        (s) => s.actionId === 'navigate' && s.params?.tab === 'settings' && s.params?.section === 'privacy'
      );
      expect(redundant).toBeUndefined();
    });

    it('strictly enforces the anti-spam rule (maximum 4 suggestions)', () => {
      const suggestions = vibiProactiveService.generatePostResponseSuggestions(
        'e2ee',
        'Encryption details here',
        { currentTab: 'feed' }
      );
      expect(suggestions.length).toBeLessThanOrEqual(4);
    });
  });

  describe('2. Multi-Modal Interaction Signals: Text Selection & Focused Field', () => {
    it('captures authorized non-sensitive text selection into the context snapshot', () => {
      vibiContextService.setSelectedText('Network connection timed out after 30s');
      expect(vibiContextService.getSelectedText()).toBe('Network connection timed out after 30s');

      const snapshot = vibiContextService.getContextSnapshot();
      expect(snapshot.selectedText).toBe('Network connection timed out after 30s');
    });

    it('strictly rejects capturing sensitive text (passwords, tokens, keys) into context', () => {
      vibiContextService.setSelectedText('my_super_secret_password_123');
      expect(vibiContextService.getSelectedText()).toBeNull();

      vibiContextService.setSelectedText('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.auth_token_xyz');
      expect(vibiContextService.getSelectedText()).toBeNull();
    });

    it('tracks focused field (search, comment, caption) while ignoring password fields', () => {
      vibiContextService.setFocusedField('search');
      expect(vibiContextService.getFocusedField()).toBe('search');

      vibiContextService.setFocusedField('password');
      // Must ignore password inputs
      expect(vibiContextService.getFocusedField()).toBeNull();
    });

    it('embeds selected text explain option into contextual suggestions', () => {
      vibiContextService.setSelectedText('Signal Protocol Ratchet');
      const suggestions = vibiProactiveService.generatePostResponseSuggestions(
        null,
        'Here is some info',
        { currentTab: 'feed', selectedText: 'Signal Protocol Ratchet' }
      );

      expect(suggestions.some((s) => s.id === 'explain_selection')).toBe(true);
      expect(suggestions.find((s) => s.id === 'explain_selection').prompt).toContain('Signal Protocol Ratchet');
    });
  });

  describe('3. UI Suggestion Chips & Click Interaction', () => {
    it('renders post-response suggestion buttons and dispatches prompt on click', async () => {
      const { useVibiAssistant } = await import('../context/VibiAssistantContext');

      function TestConversationWrapper() {
        const { addMessage } = useVibiAssistant();
        React.useEffect(() => {
          addMessage({
            sender: 'vibi',
            text: 'E2EE encrypts messages on your device.',
            topic: 'e2ee',
            suggestions: [
              { id: 'verify_keys', label: 'Verify Safety Number', prompt: 'How do I verify E2EE safety numbers?' }
            ]
          });
        }, [addMessage]);

        return <VibiConversation />;
      }

      render(
        <AuthProvider>
          <VibiAssistantProvider>
            <TestConversationWrapper />
          </VibiAssistantProvider>
        </AuthProvider>
      );

      expect(screen.getByText('Verify Safety Number')).toBeInTheDocument();

      // Clicking suggestion button sends the prompt
      fireEvent.click(screen.getByText('Verify Safety Number'));

      await waitFor(() => {
        expect(screen.getAllByText(/How do I verify E2EE safety numbers\?/).length).toBeGreaterThan(0);
      });
    });
  });
});

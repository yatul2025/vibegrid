import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import vibiActionRegistry from '../services/vibiActionRegistry';
import vibiOutputValidator from '../services/vibiOutputValidator';
import vibiIntentEngine from '../services/vibiIntentEngine';
import vibiAuditLog from '../services/vibiAuditLog';
import navigationService from '../services/navigationService';
import soundFx from '../services/soundFxService';
import VibiConversation from '../components/vibi/VibiConversation';
import { VibiAssistantProvider } from '../context/VibiAssistantContext';
import { AuthProvider } from '../context/AuthContext';

describe('Vibi Intent & Action Engine Suite (Phase 5)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vibiAuditLog.clearAuditLogs();
    navigationService.interceptors = [];
    navigationService.routeListener = null;

    localStorage.setItem(
      'vibegrid_user',
      JSON.stringify({
        id: 10,
        username: 'vibi_tester',
        full_name: 'Vibi Tester'
      })
    );
  });

  describe('1. Action Registry Whitelist', () => {
    it('contains all core whitelisted actions and rejects unregistered actions', () => {
      const actions = vibiActionRegistry.listActions();
      const ids = actions.map((a) => a.id);

      expect(ids).toContain('navigate');
      expect(ids).toContain('open_modal');
      expect(ids).toContain('toggle_theme');
      expect(ids).toContain('toggle_sound');
      expect(ids).toContain('scroll_top');
      expect(ids).toContain('clear_vibi_chat');
      expect(ids).toContain('explain_feature');
      expect(ids).toContain('get_app_status');

      expect(vibiActionRegistry.isWhitelisted('navigate')).toBe(true);
      expect(vibiActionRegistry.isWhitelisted('delete_database')).toBe(false);
      expect(vibiActionRegistry.isWhitelisted('read_private_keys')).toBe(false);
    });
  });

  describe('2. AI Output / Tool-Call Validator', () => {
    it('validates approved actions with valid parameters', () => {
      const result = vibiOutputValidator.validateAction('navigate', { tab: 'explore' });
      expect(result.valid).toBe(true);
      expect(result.sanitizedParams.tab).toBe('explore');
      expect(result.pendingConfirmation).toBe(false);
    });

    it('rejects unregistered actions', () => {
      const result = vibiOutputValidator.validateAction('unauthorized_eval', { code: 'alert(1)' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('unregistered_action');
    });

    it('rejects missing required parameters', () => {
      const result = vibiOutputValidator.validateAction('navigate', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing_required_param');
    });

    it('rejects invalid enum values', () => {
      const result = vibiOutputValidator.validateAction('navigate', { tab: 'malicious_path_outside_app' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid_enum_value');
    });

    it('flags destructive actions requiring user confirmation', () => {
      const result = vibiOutputValidator.validateAction('clear_vibi_chat', {});
      expect(result.valid).toBe(true);
      expect(result.pendingConfirmation).toBe(true);
    });
  });

  describe('3. Quick Action & Intent Engine', () => {
    it('matches navigation requests to primary tabs', () => {
      const matchExplore = vibiIntentEngine.detectIntent('go to explore');
      expect(matchExplore.matched).toBe(true);
      expect(matchExplore.actionId).toBe('navigate');
      expect(matchExplore.params.tab).toBe('explore');

      const matchMessages = vibiIntentEngine.detectIntent('open messages');
      expect(matchMessages.matched).toBe(true);
      expect(matchMessages.actionId).toBe('navigate');
      expect(matchMessages.params.tab).toBe('messages');
    });

    it('matches nested settings navigation requests', () => {
      const matchPrivacy = vibiIntentEngine.detectIntent('open privacy settings');
      expect(matchPrivacy.matched).toBe(true);
      expect(matchPrivacy.actionId).toBe('navigate');
      expect(matchPrivacy.params.tab).toBe('settings');
      expect(matchPrivacy.params.section).toBe('privacy');

      const matchVibiSettings = vibiIntentEngine.detectIntent('assistant settings');
      expect(matchVibiSettings.matched).toBe(true);
      expect(matchVibiSettings.params.section).toBe('vibi');
    });

    it('matches theme and sound effect toggles', () => {
      const matchTheme = vibiIntentEngine.detectIntent('switch to dark mode');
      expect(matchTheme.matched).toBe(true);
      expect(matchTheme.actionId).toBe('toggle_theme');
      expect(matchTheme.params.theme).toBe('dark');

      const matchMute = vibiIntentEngine.detectIntent('turn off sound');
      expect(matchMute.matched).toBe(true);
      expect(matchMute.actionId).toBe('toggle_sound');
      expect(matchMute.params.enabled).toBe(false);
    });

    it('matches educational and help explanations', () => {
      const matchE2EE = vibiIntentEngine.detectIntent('what is e2ee');
      expect(matchE2EE.matched).toBe(true);
      expect(matchE2EE.actionId).toBe('explain_feature');
      expect(matchE2EE.params.topic).toBe('e2ee');

      const matchHelp = vibiIntentEngine.detectIntent('help');
      expect(matchHelp.matched).toBe(true);
      expect(matchHelp.actionId).toBe('explain_feature');
      expect(matchHelp.params.topic).toBe('vibi');
    });
  });

  describe('4. Execution & Vibi Audit Logging', () => {
    it('executes valid actions, calls callbacks, and writes success audit entry', async () => {
      const navSpy = vi.fn();
      const intent = {
        actionId: 'navigate',
        params: { tab: 'feed' },
        replyText: 'Navigated!'
      };

      const result = await vibiIntentEngine.executeIntent(
        intent,
        {},
        { onNavigate: navSpy },
        'vibi_tester'
      );

      expect(result.success).toBe(true);
      expect(navSpy).toHaveBeenCalledWith('feed', null);

      const logs = vibiAuditLog.getAuditLogs(10);
      expect(logs.length).toBe(1);
      expect(logs[0].actionId).toBe('navigate');
      expect(logs[0].status).toBe('success');
      expect(logs[0].user).toBe('vibi_tester');
    });

    it('halts and writes pending_confirmation audit entry when confirmation is needed', async () => {
      const clearSpy = vi.fn();
      const intent = {
        actionId: 'clear_vibi_chat',
        params: {}
      };

      const result = await vibiIntentEngine.executeIntent(
        intent,
        {},
        { onClearChat: clearSpy },
        'vibi_tester'
      );

      expect(result.requiresConfirmation).toBe(true);
      expect(clearSpy).not.toHaveBeenCalled();

      const logs = vibiAuditLog.getAuditLogs(10);
      expect(logs[0].actionId).toBe('clear_vibi_chat');
      expect(logs[0].status).toBe('pending_confirmation');
    });

    it('rejects invalid action and writes rejected audit entry with reason', async () => {
      const intent = {
        actionId: 'exploit_bypass',
        params: {}
      };

      const result = await vibiIntentEngine.executeIntent(
        intent,
        {},
        {},
        'vibi_tester'
      );

      expect(result.success).toBe(false);
      expect(result.rejected).toBe(true);

      const logs = vibiAuditLog.getAuditLogs(10);
      expect(logs[0].actionId).toBe('exploit_bypass');
      expect(logs[0].status).toBe('rejected');
      expect(logs[0].failureReason).toContain('unregistered_action');
    });
  });

  describe('5. UI Conversation Flow', () => {
    it('handles natural language command in Vibi conversation and responds with action confirmation', async () => {
      vi.useFakeTimers();

      const routeSpy = vi.fn();
      navigationService.setRouteListener(routeSpy);

      render(
        <AuthProvider>
          <VibiAssistantProvider>
            <VibiConversation />
          </VibiAssistantProvider>
        </AuthProvider>
      );

      const input = screen.getByPlaceholderText(/Ask Vibi anything/i);
      fireEvent.change(input, { target: { value: 'go to explore' } });

      const sendBtn = screen.getByRole('button', { name: /Send/i });
      fireEvent.click(sendBtn);

      // Verify user message appears immediately
      expect(screen.getByText('go to explore')).toBeInTheDocument();

      // Advance timers for typing & intent execution
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      // Verify Vibi responded with navigation feedback
      expect(screen.getByText(/Heading over to \*\*Explore\*\*/i)).toBeInTheDocument();

      // Verify route listener was called
      expect(routeSpy).toHaveBeenCalledWith({ tab: 'explore', section: null });

      vi.useRealTimers();
    });
  });
});

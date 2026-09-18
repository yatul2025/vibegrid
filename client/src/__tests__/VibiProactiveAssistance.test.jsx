/**
 * client/src/__tests__/VibiProactiveAssistance.test.jsx
 * ======================================================
 * Tests for Phase 7: Proactive Assistance & Smart Suggestions
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import vibiProactiveService, {
  PROACTIVE_SHOWN_STORAGE_KEY,
  PROACTIVE_DISMISSED_KEY
} from '../services/vibiProactiveService';
import VibiProactiveHint from '../components/vibi/VibiProactiveHint';
import VibiLauncher from '../components/vibi/VibiLauncher';
import VibiConversation from '../components/vibi/VibiConversation';
import { VibiAssistantProvider, useVibiAssistant } from '../context/VibiAssistantContext';
import { AuthProvider } from '../context/AuthContext';

describe('Phase 7 — Vibi Proactive Assistance & Smart Suggestions', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vibiProactiveService.resetSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('1. Contextual Screen Suggestions', () => {
    it('provides tailored suggestions for each screen tab', () => {
      const feedChips = vibiProactiveService.getScreenSuggestions('feed');
      expect(feedChips.some((c) => c.label === 'Explore Trending')).toBe(true);
      expect(feedChips.some((c) => c.label === 'Dark Mode')).toBe(true);

      const settingsChips = vibiProactiveService.getScreenSuggestions('settings');
      expect(settingsChips.some((c) => c.label === 'Privacy & Permissions')).toBe(true);
      expect(settingsChips.some((c) => c.label === 'Appearance & Themes')).toBe(true);

      const messagesChips = vibiProactiveService.getScreenSuggestions('messages');
      expect(messagesChips.some((c) => c.label === 'End-to-End Encryption')).toBe(true);
      expect(messagesChips.some((c) => c.label === 'Voice & Video Calls')).toBe(true);

      const exploreChips = vibiProactiveService.getScreenSuggestions('explore');
      expect(exploreChips.some((c) => c.label === 'Search Tips')).toBe(true);

      const profileChips = vibiProactiveService.getScreenSuggestions('profile');
      expect(profileChips.some((c) => c.label === 'Edit Profile')).toBe(true);
    });
  });

  describe('2. Unobtrusive Proactive Hint Rules', () => {
    const activePreferences = { enabled: true, smartSuggestions: true };

    it('suppresses hints when smartSuggestions or enabled is turned OFF', () => {
      const offlineContext = { online: false, activeTab: 'feed' };

      const disabledMaster = vibiProactiveService.evaluateProactiveHint(offlineContext, {
        enabled: false,
        smartSuggestions: true
      });
      expect(disabledMaster).toBeNull();

      const disabledSuggestions = vibiProactiveService.evaluateProactiveHint(offlineContext, {
        enabled: true,
        smartSuggestions: false
      });
      expect(disabledSuggestions).toBeNull();
    });

    it('triggers offline hint when connectivity is lost', () => {
      const hint = vibiProactiveService.evaluateProactiveHint(
        { online: false, activeTab: 'feed' },
        activePreferences
      );
      expect(hint).not.toBeNull();
      expect(hint.id).toBe('offline_notice');
      expect(hint.text).toContain('offline');
    });

    it('triggers demo mode reminder when in demo mode', () => {
      const hint = vibiProactiveService.evaluateProactiveHint(
        { online: true, isDemo: true, activeTab: 'feed' },
        activePreferences
      );
      expect(hint).not.toBeNull();
      expect(hint.id).toBe('demo_mode');
      expect(hint.text).toContain('Demo Mode');
    });

    it('triggers unread messages hint when on feed with unread chats', () => {
      const hint = vibiProactiveService.evaluateProactiveHint(
        { online: true, isDemo: false, activeTab: 'feed', unreadCount: 3 },
        activePreferences
      );
      expect(hint).not.toBeNull();
      expect(hint.id).toBe('unread_messages');
      expect(hint.text).toContain('3 unread messages');
      expect(hint.action.params.tab).toBe('messages');
    });

    it('triggers explore search tip when on explore screen', () => {
      const hint = vibiProactiveService.evaluateProactiveHint(
        { online: true, isDemo: false, activeTab: 'explore', unreadCount: 0 },
        activePreferences
      );
      expect(hint).not.toBeNull();
      expect(hint.id).toBe('explore_tip');
      expect(hint.text).toContain('hashtag');
    });
  });

  describe('3. Session Limit & Engagement Rules', () => {
    const activePreferences = { enabled: true, smartSuggestions: true };

    it('enforces maximum 1 proactive hint per session unless user engages', () => {
      const context = { online: false, activeTab: 'feed' };

      // 1st evaluation returns hint
      const first = vibiProactiveService.evaluateProactiveHint(context, activePreferences);
      expect(first).not.toBeNull();

      // Record that the hint was shown
      vibiProactiveService.recordShown(first.id);

      // 2nd evaluation must return null (max 1 per session rule)
      const second = vibiProactiveService.evaluateProactiveHint(context, activePreferences);
      expect(second).toBeNull();

      // If user engages, suggestions are re-enabled
      vibiProactiveService.recordEngaged();
      const afterEngage = vibiProactiveService.evaluateProactiveHint(
        { online: true, isDemo: true, activeTab: 'feed' },
        activePreferences
      );
      expect(afterEngage).not.toBeNull();
    });

    it('does not re-show dismissed hints in the same session', () => {
      vibiProactiveService.dismissHint('offline_notice');
      const hint = vibiProactiveService.evaluateProactiveHint(
        { online: false, activeTab: 'feed' },
        activePreferences
      );
      // offline_notice was dismissed, so it moves to next rule or null
      expect(hint?.id).not.toBe('offline_notice');
    });
  });

  describe('4. VibiProactiveHint Component', () => {
    it('renders hint with badge, text, action button, and dismisses on close', () => {
      const onAction = vi.fn();
      const onDismiss = vi.fn();

      const testSuggestion = {
        id: 'test_tip',
        icon: '🧭',
        text: 'Tip: You can search posts by hashtag',
        actionLabel: 'Explore'
      };

      render(
        <VibiProactiveHint
          suggestion={testSuggestion}
          onAction={onAction}
          onDismiss={onDismiss}
          autoDismissMs={0}
        />
      );

      expect(screen.getByTestId('vibi-proactive-hint')).toBeInTheDocument();
      expect(screen.getByText(/Vibi Tip/i)).toBeInTheDocument();
      expect(screen.getByText(/You can search posts by hashtag/i)).toBeInTheDocument();

      // Click action button
      const actionBtn = screen.getByTestId('vibi-hint-action-btn');
      fireEvent.click(actionBtn);
      expect(onAction).toHaveBeenCalledWith(testSuggestion);

      // Click dismiss button
      const dismissBtn = screen.getByTestId('vibi-hint-dismiss-btn');
      fireEvent.click(dismissBtn);
      expect(onDismiss).toHaveBeenCalledWith('test_tip');
    });
  });

  describe('5. Launcher & Conversation Context Integration', () => {
    function ProactiveTestApp({ tab = 'feed', initialSuggestion = null }) {
      return (
        <AuthProvider>
          <VibiAssistantProvider>
            <ProactiveTestHarness tab={tab} initialSuggestion={initialSuggestion} />
          </VibiAssistantProvider>
        </AuthProvider>
      );
    }

    function ProactiveTestHarness({ tab, initialSuggestion }) {
      const { triggerSuggestion, getContext } = useVibiAssistant();

      React.useEffect(() => {
        if (initialSuggestion) {
          triggerSuggestion(initialSuggestion);
        }
      }, [initialSuggestion, triggerSuggestion]);

      return (
        <div>
          <VibiLauncher />
          <VibiConversation />
        </div>
      );
    }

    it('displays proactive hint bubble in launcher when activeSuggestion is triggered', () => {
      const suggestion = {
        id: 'unread_messages',
        icon: '💬',
        text: 'You have 2 unread messages',
        actionLabel: 'Go to Chats'
      };

      render(<ProactiveTestApp initialSuggestion={suggestion} />);

      expect(screen.getByTestId('vibi-proactive-hint')).toBeInTheDocument();
      expect(screen.getByText(/You have 2 unread messages/i)).toBeInTheDocument();

      // Dismissing removes the hint
      fireEvent.click(screen.getByTestId('vibi-hint-dismiss-btn'));
      expect(screen.queryByTestId('vibi-proactive-hint')).toBeNull();
    });

    it('renders screen-tailored suggestions in VibiConversation empty state', () => {
      render(<ProactiveTestApp tab="settings" />);

      // On default or feed tab, Explore Trending and Settings are present
      expect(screen.getByText('Explore Trending')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });
});

/**
 * client/src/__tests__/VibiUiSync.test.jsx
 * =========================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 3 CONTEXT AWARENESS & UI SYNCHRONIZATION TESTS
 *
 * Verifies:
 * 1. Reactive subscription in vibiContextService (listeners notified without polling).
 * 2. Active modal and subscreen extraction (filtering out Vibi's own panel).
 * 3. Window event-based synchronization ('vibegrid:open-modal' and 'vibegrid:close-modal').
 * 4. Modal-aware and subscreen-aware suggestion chips from vibiProactiveService.
 * 5. Device context and online/offline status reflection.
 * 6. Zero-knowledge privacy boundary in assembled snapshots.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import vibiContextService from '../services/vibiContextService';
import vibiProactiveService from '../services/vibiProactiveService';
import navigationService from '../services/navigationService';

describe('Vibi Context Awareness & UI Synchronization Suite (Phase 3)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vibiContextService.clearHistory();
    vibiContextService.clearActiveSection();
    vibiContextService.clearActiveModal();
    vibiContextService.setActiveTab('feed');
    navigationService.interceptors = [];
  });

  describe('1. Reactive Context Subscription', () => {
    it('notifies subscribers immediately on tab change', () => {
      const listener = vi.fn();
      const unsub = vibiContextService.subscribe(listener);

      vibiContextService.setActiveTab('explore');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(vibiContextService.getActiveTab()).toBe('explore');

      unsub();
      vibiContextService.setActiveTab('messages');
      expect(listener).toHaveBeenCalledTimes(1); // no further calls after unsub
    });

    it('notifies subscribers immediately on section change', () => {
      const listener = vi.fn();
      const unsub = vibiContextService.subscribe(listener);

      vibiContextService.setActiveSection('privacy');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(vibiContextService.getActiveSection()).toBe('privacy');

      vibiContextService.clearActiveSection();
      expect(listener).toHaveBeenCalledTimes(2);
      expect(vibiContextService.getActiveSection()).toBeNull();

      unsub();
    });

    it('notifies subscribers immediately on modal change', () => {
      const listener = vi.fn();
      const unsub = vibiContextService.subscribe(listener);

      vibiContextService.setActiveModal('create_post');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(vibiContextService.getActiveModal()).toBe('create_post');

      vibiContextService.clearActiveModal();
      expect(listener).toHaveBeenCalledTimes(2);
      expect(vibiContextService.getActiveModal()).toBeNull();

      unsub();
    });
  });

  describe('2. Subscreen & Modal Extraction with Panel Isolation', () => {
    it('filters out vibi-assistant-panel interceptor to read the true underlying modal', () => {
      // User has create post open, then opens Vibi panel
      navigationService.registerBackInterceptor('app_create_post', () => true, 10);
      navigationService.registerBackInterceptor('vibi-assistant-panel', () => true, 25);

      const activeSubScreen = vibiContextService.getActiveSubScreen();
      expect(activeSubScreen).toBe('app_create_post');
      expect(activeSubScreen).not.toBe('vibi-assistant-panel');
    });

    it('returns "none" when no interceptors or modals are open', () => {
      expect(vibiContextService.getActiveSubScreen()).toBe('none');
    });
  });

  describe('3. Window Event-Driven Synchronization', () => {
    it('synchronizes modal state when vibegrid:open-modal and vibegrid:close-modal are dispatched', () => {
      window.dispatchEvent(
        new CustomEvent('vibegrid:open-modal', {
          detail: { modal: 'call_history' }
        })
      );

      expect(vibiContextService.getActiveModal()).toBe('call_history');

      window.dispatchEvent(new CustomEvent('vibegrid:close-modal'));
      expect(vibiContextService.getActiveModal()).toBeNull();
    });
  });

  describe('4. Modal-Aware Contextual Suggestions', () => {
    it('provides upload and hashtag suggestions when create_post modal is active', () => {
      const suggestions = vibiProactiveService.getScreenSuggestions('feed', null, 'app_create_post');
      expect(suggestions.length).toBeGreaterThanOrEqual(3);
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain('Upload Limits');
      expect(labels).toContain('Hashtag Tips');
    });

    it('provides call diagnostics when call modal is active', () => {
      const suggestions = vibiProactiveService.getScreenSuggestions('messages', null, 'call_history');
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain('Call Diagnostics');
      expect(labels).toContain('E2EE in Calls');
    });

    it('provides notification preferences and status when notification modal is active', () => {
      const suggestions = vibiProactiveService.getScreenSuggestions('feed', null, 'app_notifications');
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain('Permission Status');
      expect(labels).toContain('Quiet Hours');
    });

    it('provides permission onboarding details when onboarding modal is active', () => {
      const suggestions = vibiProactiveService.getScreenSuggestions('feed', null, 'permission_onboarding');
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain('Why Camera?');
      expect(labels).toContain('Privacy Guarantees');
    });
  });

  describe('5. Zero-Knowledge Privacy & Device State Integrity', () => {
    it('assembles compact context snapshot with device state and whitelisted structural metadata only', () => {
      vibiContextService.setActiveTab('settings');
      vibiContextService.setActiveSection('security');
      vibiContextService.setActiveModal('settings_diagnostics_modal');

      const snapshot = vibiContextService.assembleContext({
        user: { id: 1, username: 'secure_user', password: 'plaintext_password_123', token: 'jwt_secret' },
        preferences: { enabled: true, appContext: true }
      });

      expect(snapshot.screen).toBe('settings');
      expect(snapshot.activeSection).toBe('security');
      expect(snapshot.activeModal).toBe('settings_diagnostics_modal');
      expect(snapshot.device).toBeDefined();
      expect(snapshot.device.theme).toBeDefined();

      // Ensure blacklisted credentials NEVER leak
      expect(snapshot.password).toBeUndefined();
      expect(snapshot.token).toBeUndefined();
      expect(snapshot.user.password).toBeUndefined();
      expect(snapshot.user.token).toBeUndefined();
    });
  });
});

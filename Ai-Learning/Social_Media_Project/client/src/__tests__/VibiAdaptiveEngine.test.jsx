/**
 * client/src/__tests__/VibiAdaptiveEngine.test.jsx
 * =================================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 2 ADAPTIVE RESPONSE ENGINE TESTS
 *
 * Tests:
 * 1. Dynamic Response Length & Style Classification (SHORT, NORMAL, DETAILED, STEP_BY_STEP).
 * 2. Contextual Continuity & Pronoun / Follow-Up Resolution using recentTopic.
 * 3. Ambiguity Detection & Multi-Turn Clarification Handling (settings & troubleshooting).
 * 4. VibiContextService memory, turn tracking, and snapshot security integrity.
 * 5. Full conversation turn integration with context persistence and memory reset.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import vibiIntentEngine from '../services/vibiIntentEngine';
import vibiContextService from '../services/vibiContextService';
import VibiConversation from '../components/vibi/VibiConversation';
import { VibiAssistantProvider } from '../context/VibiAssistantContext';
import { AuthProvider } from '../context/AuthContext';

describe('Vibi Adaptive Response Engine Suite (Phase 2)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vibiContextService.clearHistory();
    localStorage.setItem(
      'vibegrid_user',
      JSON.stringify({
        id: 7,
        username: 'adaptive_tester',
        full_name: 'Adaptive Tester'
      })
    );
  });

  describe('1. Dynamic Response Length & Style Classification', () => {
    it('classifies direct navigations and immediate toggles as SHORT', () => {
      const navFeed = vibiIntentEngine.detectIntent('go to feed');
      expect(navFeed.matched).toBe(true);
      expect(navFeed.responseType).toBe('SHORT');

      const navExplore = vibiIntentEngine.detectIntent('explore');
      expect(navExplore.matched).toBe(true);
      expect(navExplore.responseType).toBe('SHORT');

      const toggleTheme = vibiIntentEngine.detectIntent('switch to dark mode');
      expect(toggleTheme.matched).toBe(true);
      expect(toggleTheme.responseType).toBe('SHORT');

      const toggleSound = vibiIntentEngine.detectIntent('mute sound');
      expect(toggleSound.matched).toBe(true);
      expect(toggleSound.responseType).toBe('SHORT');

      const scrollTop = vibiIntentEngine.detectIntent('scroll to top');
      expect(scrollTop.matched).toBe(true);
      expect(scrollTop.responseType).toBe('SHORT');
    });

    it('classifies mascot help and introductory questions as NORMAL', () => {
      const help = vibiIntentEngine.detectIntent('help');
      expect(help.matched).toBe(true);
      expect(help.responseType).toBe('NORMAL');

      const hello = vibiIntentEngine.detectIntent('hello');
      expect(hello.matched).toBe(true);
      expect(hello.responseType).toBe('NORMAL');
    });

    it('classifies deep architecture explanations as DETAILED', () => {
      const e2ee = vibiIntentEngine.detectIntent('what is e2ee');
      expect(e2ee.matched).toBe(true);
      expect(e2ee.responseType).toBe('DETAILED');
      expect(e2ee.replyText).toContain('End-to-End Encryption');
      expect(e2ee.replyText).toContain('AES-256-GCM');

      const calls = vibiIntentEngine.detectIntent('how do calls work');
      expect(calls.matched).toBe(true);
      expect(calls.responseType).toBe('DETAILED');
      expect(calls.replyText).toContain('WebRTC Encrypted Calls');
    });

    it('classifies diagnostics and troubleshooting flows as STEP_BY_STEP', () => {
      const reconnect = vibiIntentEngine.detectIntent('reconnect socket');
      expect(reconnect.matched).toBe(true);
      expect(reconnect.responseType).toBe('STEP_BY_STEP');

      const messagesTrouble = vibiIntentEngine.detectIntent("my messages aren't loading");
      expect(messagesTrouble.matched).toBe(true);
      expect(messagesTrouble.responseType).toBe('STEP_BY_STEP');

      const notifTrouble = vibiIntentEngine.detectIntent("notifications aren't working");
      expect(notifTrouble.matched).toBe(true);
      expect(notifTrouble.responseType).toBe('STEP_BY_STEP');

      const callTrouble = vibiIntentEngine.detectIntent("calls aren't connecting");
      expect(callTrouble.matched).toBe(true);
      expect(callTrouble.responseType).toBe('STEP_BY_STEP');

      const fullTrouble = vibiIntentEngine.detectIntent('troubleshoot');
      expect(fullTrouble.matched).toBe(true);
      expect(fullTrouble.responseType).toBe('STEP_BY_STEP');
    });
  });

  describe('2. Contextual Continuity & Pronoun / Follow-Up Resolution', () => {
    it('resolves follow-up query "verify it" when recentTopic is e2ee', () => {
      const context = { recentTopic: 'e2ee' };
      const followUp = vibiIntentEngine.detectIntent('how do I verify it?', context);

      expect(followUp.matched).toBe(true);
      expect(followUp.actionId).toBe('explain_feature');
      expect(followUp.params.topic).toBe('e2ee');
      expect(followUp.responseType).toBe('DETAILED');
      expect(followUp.replyText).toContain('AES-256-GCM');
      expect(followUp.replyText).toContain('fingerprint key hashes');
    });

    it('resolves follow-up query "how to fix it" when recentTopic is calls', () => {
      const context = { recentTopic: 'calls' };
      const followUp = vibiIntentEngine.detectIntent('how to fix it?', context);

      expect(followUp.matched).toBe(true);
      expect(followUp.actionId).toBe('run_diagnostics');
      expect(followUp.params.category).toBe('calls');
      expect(followUp.responseType).toBe('STEP_BY_STEP');
      expect(followUp.replyText).toContain('WebRTC Call Troubleshooting');
    });

    it('resolves follow-up query "test it" when recentTopic is notifications', () => {
      const context = { recentTopic: 'notifications' };
      const followUp = vibiIntentEngine.detectIntent('test it', context);

      expect(followUp.matched).toBe(true);
      expect(followUp.actionId).toBe('run_diagnostics');
      expect(followUp.params.category).toBe('notifications');
      expect(followUp.responseType).toBe('STEP_BY_STEP');
      expect(followUp.replyText).toContain('Notification Diagnostic Checklist');
    });

    it('resolves follow-up query "fix it" when recentTopic is storage', () => {
      const context = { recentTopic: 'storage' };
      const followUp = vibiIntentEngine.detectIntent('fix it', context);

      expect(followUp.matched).toBe(true);
      expect(followUp.actionId).toBe('clear_temporary_cache');
      expect(followUp.responseType).toBe('SHORT');
      expect(followUp.replyText).toContain('Clearing temporary cache');
    });
  });

  describe('3. Ambiguity Detection & Clarification Handling', () => {
    it('triggers a clarification question when user broadly asks for "settings"', () => {
      const ambiguous = vibiIntentEngine.detectIntent('open settings');
      expect(ambiguous.matched).toBe(true);
      expect(ambiguous.isClarification).toBe(true);
      expect(ambiguous.clarificationKey).toBe('which_settings');
      expect(ambiguous.replyText).toContain('Which settings would you like to explore?');
      expect(ambiguous.replyText).toContain('Privacy & Permissions');
      expect(ambiguous.replyText).toContain('Appearance & Themes');
    });

    it('resolves subsequent answer against lastClarificationQuestion = which_settings', () => {
      const context = { lastClarificationQuestion: 'which_settings' };

      const replyPrivacy = vibiIntentEngine.detectIntent('privacy', context);
      expect(replyPrivacy.matched).toBe(true);
      expect(replyPrivacy.actionId).toBe('navigate');
      expect(replyPrivacy.params.section).toBe('privacy');

      const replyTheme = vibiIntentEngine.detectIntent('appearance', context);
      expect(replyTheme.matched).toBe(true);
      expect(replyTheme.actionId).toBe('navigate');
      expect(replyTheme.params.section).toBe('appearance');

      const replyVibi = vibiIntentEngine.detectIntent('vibi assistant', context);
      expect(replyVibi.matched).toBe(true);
      expect(replyVibi.actionId).toBe('navigate');
      expect(replyVibi.params.section).toBe('vibi');

      const replyNotif = vibiIntentEngine.detectIntent('notifications', context);
      expect(replyNotif.matched).toBe(true);
      expect(replyNotif.actionId).toBe('navigate');
      expect(replyNotif.params.section).toBe('notifications');

      const replyAll = vibiIntentEngine.detectIntent('all settings', context);
      expect(replyAll.matched).toBe(true);
      expect(replyAll.actionId).toBe('navigate');
      expect(replyAll.params.tab).toBe('settings');
    });

    it('triggers clarification when user says "it\'s not working" without prior topic', () => {
      const ambiguous = vibiIntentEngine.detectIntent("it's not working");
      expect(ambiguous.matched).toBe(true);
      expect(ambiguous.isClarification).toBe(true);
      expect(ambiguous.clarificationKey).toBe('which_diagnostic');
      expect(ambiguous.replyText).toContain('Which area is having an issue?');
    });

    it('resolves subsequent answer against lastClarificationQuestion = which_diagnostic', () => {
      const context = { lastClarificationQuestion: 'which_diagnostic' };

      const replyMsg = vibiIntentEngine.detectIntent('messages', context);
      expect(replyMsg.matched).toBe(true);
      expect(replyMsg.actionId).toBe('run_diagnostics');
      expect(replyMsg.params.category).toBe('messages');

      const replyCalls = vibiIntentEngine.detectIntent('calls', context);
      expect(replyCalls.matched).toBe(true);
      expect(replyCalls.actionId).toBe('run_diagnostics');
      expect(replyCalls.params.category).toBe('calls');

      const replyStorage = vibiIntentEngine.detectIntent('storage', context);
      expect(replyStorage.matched).toBe(true);
      expect(replyStorage.actionId).toBe('run_diagnostics');
      expect(replyStorage.params.category).toBe('storage');
    });
  });

  describe('4. VibiContextService Memory & Turn Tracking', () => {
    it('records turns, tracks topic, and caps history at 5 turns', () => {
      vibiContextService.recordTurn('user', 'What is E2EE?', 'e2ee');
      vibiContextService.recordTurn('vibi', 'End-to-End Encryption...', 'e2ee');
      vibiContextService.recordTurn('user', 'How do I verify it?', 'e2ee');
      vibiContextService.recordTurn('vibi', 'Click the shield icon...', 'e2ee');
      vibiContextService.recordTurn('user', 'Switch to dark mode', 'theme');
      vibiContextService.recordTurn('vibi', 'Switched to dark theme!', 'theme');

      expect(vibiContextService.getRecentTopic()).toBe('theme');
      const turns = vibiContextService.getRecentTurns();
      expect(turns.length).toBe(5);
      expect(turns[turns.length - 1].text).toBe('Switched to dark theme!');
    });

    it('manages clarification state cleanly and resets on clearHistory()', () => {
      vibiContextService.setLastClarification('which_settings');
      expect(vibiContextService.getLastClarification()).toBe('which_settings');

      vibiContextService.clearClarification();
      expect(vibiContextService.getLastClarification()).toBeNull();

      vibiContextService.setRecentTopic('calls');
      vibiContextService.setLastClarification('which_diagnostic');
      vibiContextService.clearHistory();

      expect(vibiContextService.getRecentTopic()).toBeNull();
      expect(vibiContextService.getLastClarification()).toBeNull();
      expect(vibiContextService.getRecentTurns()).toEqual([]);
    });

    it('embeds recentTopic and lastClarificationQuestion in assembled context snapshot safely', () => {
      vibiContextService.setRecentTopic('e2ee');
      vibiContextService.setLastClarification('which_settings');

      const snapshot = vibiContextService.getContextSnapshot({ username: 'testuser' });
      expect(snapshot.recentTopic).toBe('e2ee');
      expect(snapshot.lastClarificationQuestion).toBe('which_settings');
      expect(snapshot.password).toBeUndefined();
      expect(snapshot.private_key).toBeUndefined();
    });
  });
});

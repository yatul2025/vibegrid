import { describe, it, expect, beforeEach } from 'vitest';
import vibiContextService from '../services/vibiContextService';
import vibiIntentEngine, { EXECUTION_STATES } from '../services/vibiIntentEngine';
import navigationService from '../services/navigationService';

describe('Phase 7 — Advanced Context Engine & Centralized Context Orchestrator', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    navigationService.interceptors = [];
    vibiContextService.clearHistory();
    vibiContextService.clearActiveSection();
    vibiContextService.clearActiveModal();
    vibiContextService.clearSelectedText();
    vibiContextService.clearFocusedField();
    vibiContextService.clearRecentActions();
    vibiContextService.setActiveTab('feed');
    vibiContextService.clearActiveChatMetadata();
  });

  describe('1. The 7 Context Domains Orchestration', () => {
    it('aggregates all 7 distinct context domains cleanly in getWorkflowContext()', () => {
      // 1. Conversation domain
      vibiContextService.setRecentTopic('e2ee');
      vibiContextService.setLastClarification('which_settings');
      vibiContextService.recordTurn('user', 'How do safety numbers work?', 'e2ee');

      // 2. Page domain
      vibiContextService.setActiveTab('settings');
      vibiContextService.setActiveSection('privacy');

      // 3. UI domain
      vibiContextService.setActiveModal('key_backup');
      vibiContextService.setFocusedField('search');

      // 4. Selection domain
      vibiContextService.setSelectedText('Verified Signal Safety Number 12345');

      // 5. Recent Actions domain
      vibiContextService.recordRecentAction('toggle_theme', { theme: 'cyberpunk' }, 'success');

      // 6. Application State domain
      vibiContextService.setActiveChatMetadata({ id: 'chat_42', name: 'Alice Smith', type: 'direct' });
      vibiContextService.setE2eeReady(true);

      const workflow = vibiContextService.getWorkflowContext({
        user: { username: 'bob', full_name: 'Bob Ross', is_verified: true },
        preferences: { enabled: true, appContext: true }
      });

      // Domain 1: Conversation
      expect(workflow.conversation.recentTopic).toBe('e2ee');
      expect(workflow.conversation.lastClarificationQuestion).toBe('which_settings');
      expect(workflow.conversation.recentTurns).toHaveLength(1);

      // Domain 2: Page
      expect(workflow.page.currentTab).toBe('settings');
      expect(workflow.page.activeSection).toBe('privacy');

      // Domain 3: UI
      expect(workflow.ui.activeModal).toBe('key_backup');
      expect(workflow.ui.focusedField).toBe('search');

      // Domain 4: Selection
      expect(workflow.selection.selectedText).toBe('Verified Signal Safety Number 12345');

      // Domain 5: Recent Actions
      expect(workflow.recentActions).toHaveLength(1);
      expect(workflow.recentActions[0].actionId).toBe('toggle_theme');
      expect(workflow.recentActions[0].paramsSummary).toEqual({ theme: 'cyberpunk' });

      // Domain 6: Application State
      expect(workflow.appState.activeChat.name).toBe('Alice Smith');
      expect(workflow.appState.e2eeReady).toBe(true);

      // Domain 7: Permissions Context
      expect(workflow.permissions).toBeDefined();
      expect(workflow.permissions.notifications).toBeDefined();
      expect(workflow.permissions.soundEnabled).toBe(true);
    });
  });

  describe('2. Recent Actions FIFO Queue & Bounds', () => {
    it('enforces FIFO queue bounded strictly to 5 actions', () => {
      for (let i = 1; i <= 7; i++) {
        vibiContextService.recordRecentAction(`action_${i}`, { step: i }, 'success');
      }

      const actions = vibiContextService.getRecentActions();
      expect(actions).toHaveLength(5);
      expect(actions[0].actionId).toBe('action_3');
      expect(actions[4].actionId).toBe('action_7');
    });

    it('clears recent actions on demand', () => {
      vibiContextService.recordRecentAction('open_modal', { modal: 'create_post' }, 'success');
      expect(vibiContextService.getRecentActions()).toHaveLength(1);

      vibiContextService.clearRecentActions();
      expect(vibiContextService.getRecentActions()).toHaveLength(0);
    });
  });

  describe('3. Dynamic Irrelevance Filter & Pruner', () => {
    it('prunes unneeded domains for appearance queries (strips chat and selection)', () => {
      vibiContextService.setActiveTab('feed');
      vibiContextService.setSelectedText('Unrelated paragraph text from home feed');
      vibiContextService.setActiveChatMetadata({ id: 'dm_99', name: 'Secret DM', type: 'direct' });

      const fullSnapshot = vibiContextService.getContextSnapshot();
      const pruned = vibiContextService.buildRelevantContext('Switch to cyberpunk theme', fullSnapshot);

      expect(pruned.theme).toBeDefined();
      expect(pruned.selectedText).toBeUndefined(); // Pruned: irrelevant to theme
      expect(pruned.activeChat).toBeUndefined();   // Pruned: irrelevant to theme
    });

    it('retains selectedText when user query explicitly references "this" or asks to explain', () => {
      vibiContextService.setSelectedText('Double Ratchet Cryptographic Algorithm');

      const fullSnapshot = vibiContextService.getContextSnapshot();
      const pruned = vibiContextService.buildRelevantContext('What does this mean?', fullSnapshot);

      expect(pruned.selectedText).toBe('Double Ratchet Cryptographic Algorithm');
    });

    it('attaches recentActions when user query asks "what did you just do"', () => {
      vibiContextService.recordRecentAction('toggle_theme', { theme: 'dark' }, 'success');

      const fullSnapshot = vibiContextService.getContextSnapshot();
      const pruned = vibiContextService.buildRelevantContext('What did you just do?', fullSnapshot);

      expect(pruned.recentActions).toBeDefined();
      expect(pruned.recentActions[0].actionId).toBe('toggle_theme');
    });

    it('guarantees pruned context is ultra-compact (< 500 bytes)', () => {
      vibiContextService.setActiveTab('explore');
      vibiContextService.setRecentTopic('calls');

      const pruned = vibiContextService.buildRelevantContext('Tell me about WebRTC');
      const sizeInBytes = new TextEncoder().encode(JSON.stringify(pruned)).length;

      expect(sizeInBytes).toBeLessThan(500);
    });
  });

  describe('4. Security Shield & Blacklist Protection', () => {
    it('purges blacklisted password and token fields from recorded actions', () => {
      vibiContextService.recordRecentAction('login_user', {
        username: 'alice',
        password: 'SuperSecretPassword123!',
        token: 'jwt.token.abc'
      }, 'success');

      const actions = vibiContextService.getRecentActions();
      expect(actions[0].paramsSummary.username).toBe('alice');
      expect(actions[0].paramsSummary.password).toBeUndefined();
      expect(actions[0].paramsSummary.token).toBeUndefined();
    });

    it('enforces dormant state when Vibi Master Control is disabled', () => {
      const workflow = vibiContextService.getWorkflowContext({
        user: { username: 'test' },
        preferences: { enabled: false }
      });

      expect(workflow.status).toBe('dormant');
      expect(workflow.appContextEnabled).toBe(false);
      expect(workflow.conversation).toBeUndefined();
    });
  });

  describe('5. Intent Engine Action History Integration', () => {
    it('automatically records successful action execution in vibiContextService history', async () => {
      const callbacks = {
        setTheme: () => {},
        theme: 'dark'
      };

      const result = await vibiIntentEngine.executeIntent(
        { actionId: 'toggle_theme', params: { theme: 'cyberpunk' }, replyText: 'Cyberpunk applied' },
        {},
        callbacks,
        'tester',
        { bypassReplayGuard: true }
      );

      expect(result.success).toBe(true);

      const recent = vibiContextService.getRecentActions();
      expect(recent.length).toBeGreaterThan(0);
      expect(recent[recent.length - 1].actionId).toBe('toggle_theme');
      expect(recent[recent.length - 1].status).toBe('success');
    });

    it('answers "what did you just do" query referencing the recently executed action', () => {
      vibiContextService.recordRecentAction('toggle_theme', { theme: 'oled' }, 'success');

      const intent = vibiIntentEngine.detectIntent('what did you just do');
      expect(intent.matched).toBe(true);
      expect(intent.topic).toBe('recent_action');
      expect(intent.replyText).toContain('toggle_theme');
      expect(intent.replyText).toContain('success');
    });
  });
});

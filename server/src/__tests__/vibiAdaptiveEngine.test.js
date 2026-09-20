/**
 * server/src/__tests__/vibiAdaptiveEngine.test.js
 * ===============================================
 * VIBGRID — VIBI AI ASSISTANT: SERVER PHASE 2 ADAPTIVE ENGINE TESTS
 *
 * Verifies:
 * 1. Query Knowledge Base returns adaptive responseType tags (SHORT, NORMAL, DETAILED, STEP_BY_STEP).
 * 2. Multi-turn clarification answer resolution against lastClarificationQuestion.
 * 3. Follow-up pronoun resolution using recentTopic.
 * 4. Vibi Controller sanitizes recentTopic and lastClarificationQuestion and returns them.
 */

const { queryKnowledgeBase } = require('../services/vibiAiService');
const { handleVibiChat } = require('../controllers/vibiController');

jest.mock('../config/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] })
}));

describe('Server Vibi Adaptive Response Engine Suite (Phase 2)', () => {
  describe('1. Dynamic Response Length & Style Classification', () => {
    it('returns SHORT responseType for navigation and theme queries', () => {
      const feed = queryKnowledgeBase('go to feed', {});
      expect(feed.responseType).toBe('SHORT');
      expect(feed.action?.id).toBe('navigate');

      const theme = queryKnowledgeBase('switch to dark mode', {});
      expect(theme.responseType).toBe('SHORT');
      expect(theme.action?.id).toBe('navigate');
      expect(theme.action?.params?.section).toBe('appearance');
    });

    it('returns DETAILED responseType for E2EE and WebRTC explanations', () => {
      const e2ee = queryKnowledgeBase('what is e2ee', {});
      expect(e2ee.responseType).toBe('DETAILED');
      expect(e2ee.replyText).toContain('AES-256-GCM');
      expect(e2ee.action?.id).toBe('explain_feature');

      const calls = queryKnowledgeBase('how do calls work', {});
      expect(calls.responseType).toBe('DETAILED');
      expect(calls.action?.id).toBe('explain_feature');
    });

    it('returns NORMAL responseType for greetings and general inquiries', () => {
      const greeting = queryKnowledgeBase('hello', { activeTab: 'feed' });
      expect(greeting.responseType).toBe('NORMAL');
      expect(greeting.topic).toBe('greeting');
    });
  });

  describe('2. Follow-Up & Pronoun Resolution via recentTopic', () => {
    it('resolves pronoun query when recentTopic is e2ee', () => {
      const res = queryKnowledgeBase('how does it work', { recentTopic: 'e2ee' });
      expect(res.responseType).toBe('DETAILED');
      expect(res.topic).toBe('e2ee');
      expect(res.replyText).toContain('End-to-End Encryption');
    });

    it('resolves pronoun query when recentTopic is calls', () => {
      const res = queryKnowledgeBase('how to fix it', { recentTopic: 'calls' });
      expect(res.responseType).toBe('STEP_BY_STEP');
      expect(res.topic).toBe('calls');
      expect(res.replyText).toContain('WebRTC Call Troubleshooting');
    });

    it('resolves pronoun query when recentTopic is notifications', () => {
      const res = queryKnowledgeBase('verify it', { recentTopic: 'notifications' });
      expect(res.responseType).toBe('STEP_BY_STEP');
      expect(res.topic).toBe('notifications');
      expect(res.replyText).toContain('Notification Diagnostic Checklist');
    });
  });

  describe('3. Clarification Resolution via lastClarificationQuestion', () => {
    it('resolves "privacy" against which_settings clarification', () => {
      const res = queryKnowledgeBase('privacy', { lastClarificationQuestion: 'which_settings' });
      expect(res.action?.id).toBe('navigate');
      expect(res.action?.params?.section).toBe('privacy');
      expect(res.responseType).toBe('SHORT');
    });

    it('resolves "appearance" against which_settings clarification', () => {
      const res = queryKnowledgeBase('theme and appearance', { lastClarificationQuestion: 'which_settings' });
      expect(res.action?.id).toBe('navigate');
      expect(res.action?.params?.section).toBe('appearance');
      expect(res.responseType).toBe('SHORT');
    });
  });

  describe('4. Controller Sanitization & Response Output', () => {
    it('passes sanitized recentTopic and returns responseType and topic', async () => {
      const req = {
        body: {
          message: 'verify it',
          context: {
            recentTopic: 'e2ee',
            lastClarificationQuestion: null,
            activeTab: 'feed'
          }
        },
        user: { id: 1, username: 'testuser' }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await handleVibiChat(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0]?.data;
      expect(data.responseType).toBe('DETAILED');
      expect(data.topic).toBe('e2ee');
      expect(data.replyText).toContain('End-to-End Encryption');
    });
  });

  describe('5. Composite Multi-Intent Routing & Confidence (Phase 4)', () => {
    it('parses composite query into sequential actions with confidence score', () => {
      const res = queryKnowledgeBase('go to feed and then open explore', {});
      expect(res.action?.id).toBe('navigate');
      expect(res.actions).toHaveLength(2);
      expect(res.confidence).toBe(0.90);
      expect(res.safetyTier).toBe('READ_ONLY');
      expect(res.responseType).toBe('STEP_BY_STEP');
    });

    it('returns confidence and safetyTier through controller', async () => {
      const req = {
        body: {
          message: 'go to feed',
          context: { activeTab: 'explore' }
        },
        user: { id: 1, username: 'testuser' }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await handleVibiChat(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0]?.data;
      expect(data.confidence).toBeGreaterThanOrEqual(0.85);
      expect(data.safetyTier).toBe('READ_ONLY');
    });
  });
});

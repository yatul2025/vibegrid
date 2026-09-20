import { describe, it, expect, beforeEach } from 'vitest';
import vibiMemoryService, {
  VIBI_MEMORY_PERSISTENT_KEY,
  VIBI_MEMORY_SESSION_KEY
} from '../services/vibiMemoryService';
import vibiContextService from '../services/vibiContextService';
import vibiIntentEngine from '../services/vibiIntentEngine';

describe('Phase 8 — Controlled Memory & Personalization Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vibiMemoryService.clearAllMemory();
    vibiContextService.clearHistory();
    vibiContextService.clearRecentActions();
  });

  describe('1. Ephemeral vs Persistent Memory Separation', () => {
    it('stores explicit facts in persistent localStorage', () => {
      const res = vibiMemoryService.rememberFact('theme_preference', 'User prefers dark OLED theme');
      expect(res.success).toBe(true);

      expect(vibiMemoryService.getFact('theme_preference')).toBe('User prefers dark OLED theme');

      const rawStored = localStorage.getItem(VIBI_MEMORY_PERSISTENT_KEY);
      expect(rawStored).toContain('User prefers dark OLED theme');
    });

    it('stores ephemeral session topics in sessionStorage without polluting persistent facts', () => {
      vibiMemoryService.recordSessionTopic('end_to_end_encryption');
      vibiMemoryService.recordSessionTopic('webrtc_calls');

      const all = vibiMemoryService.getAllMemories();
      expect(all.sessionTopics).toEqual(['end_to_end_encryption', 'webrtc_calls']);
      expect(all.persistentCount).toBe(0);

      const rawSession = sessionStorage.getItem(VIBI_MEMORY_SESSION_KEY);
      expect(rawSession).toContain('end_to_end_encryption');
    });
  });

  describe('2. Capacity Limits & Bounds', () => {
    it('enforces maximum 30 persistent facts limit via FIFO eviction', () => {
      for (let i = 1; i <= 32; i++) {
        vibiMemoryService.rememberFact(`preference_${i}`, `Preference number ${i}`);
      }

      const all = vibiMemoryService.getAllMemories();
      expect(all.persistentCount).toBe(30);

      // Oldest entries (1 and 2) should have been evicted
      expect(vibiMemoryService.getFact('preference_1')).toBeNull();
      expect(vibiMemoryService.getFact('preference_2')).toBeNull();
      expect(vibiMemoryService.getFact('preference_32')).toBe('Preference number 32');
    });

    it('truncates facts exceeding maximum character length (120 chars)', () => {
      const longFact = 'A'.repeat(200);
      const res = vibiMemoryService.rememberFact('long_entry', longFact);

      expect(res.success).toBe(true);
      expect(res.fact.length).toBe(120);
    });
  });

  describe('3. Security Shield & Blacklist Protection', () => {
    it('strictly rejects remembering passwords or auth tokens', () => {
      const res1 = vibiMemoryService.rememberFact('my_password', 'SuperSecret123!');
      expect(res1.success).toBe(false);
      expect(res1.reason).toBe('security_blacklist_violation');

      const res2 = vibiMemoryService.rememberFact('auth_token', 'jwt.secret.token');
      expect(res2.success).toBe(false);
      expect(res2.reason).toBe('security_blacklist_violation');

      const res3 = vibiMemoryService.rememberFact('note', 'My private key is abcxyz');
      expect(res3.success).toBe(false);
      expect(res3.reason).toBe('security_blacklist_violation');

      expect(vibiMemoryService.getAllMemories().persistentCount).toBe(0);
    });
  });

  describe('4. Transparency, Deletion & Export Controls', () => {
    it('allows granular deletion of a single remembered fact via forgetFact', () => {
      vibiMemoryService.rememberFact('favorite_color', 'Neon Cyan');
      vibiMemoryService.rememberFact('favorite_tab', 'explore');

      expect(vibiMemoryService.getAllMemories().persistentCount).toBe(2);

      const removed = vibiMemoryService.forgetFact('favorite_color');
      expect(removed).toBe(true);
      expect(vibiMemoryService.getFact('favorite_color')).toBeNull();
      expect(vibiMemoryService.getFact('favorite_tab')).toBe('explore');
    });

    it('purges all persistent and session memory via clearAllMemory', () => {
      vibiMemoryService.rememberFact('theme', 'cyberpunk');
      vibiMemoryService.recordSessionTopic('diagnostics');

      expect(vibiMemoryService.getAllMemories().persistentCount).toBe(1);

      vibiMemoryService.clearAllMemory();

      const all = vibiMemoryService.getAllMemories();
      expect(all.persistentCount).toBe(0);
      expect(all.sessionTopics).toHaveLength(0);
      expect(localStorage.getItem(VIBI_MEMORY_PERSISTENT_KEY)).toBeNull();
      expect(sessionStorage.getItem(VIBI_MEMORY_SESSION_KEY)).toBeNull();
    });

    it('exports all memories as structured JSON for user auditability', () => {
      vibiMemoryService.rememberFact('style', 'concise');
      const exportedJson = vibiMemoryService.exportMemory();
      const parsed = JSON.parse(exportedJson);

      expect(parsed.persistentFacts.style).toBe('concise');
      expect(parsed.persistentCount).toBe(1);
    });
  });

  describe('5. Intent Engine Natural Language Integration', () => {
    it('answers "what do you remember about me" with transparent memory overview', () => {
      vibiMemoryService.rememberFact('preferred_theme', 'AMOLED Dark');

      const intent = vibiIntentEngine.detectIntent('what do you remember about me');
      expect(intent.matched).toBe(true);
      expect(intent.topic).toBe('memory');
      expect(intent.replyText).toContain('preferred_theme');
      expect(intent.replyText).toContain('AMOLED Dark');
      expect(intent.replyText).toContain('forget everything');
    });

    it('understands "remember that I prefer short answers" and saves preference', () => {
      const intent = vibiIntentEngine.detectIntent('remember that I prefer short answers');
      expect(intent.matched).toBe(true);
      expect(intent.topic).toBe('memory');
      expect(intent.replyText).toContain('I will remember');

      const fact = vibiMemoryService.getFact('i_prefer_short');
      expect(fact).toContain('I prefer short answers');
    });

    it('understands "forget everything" and wipes memory', () => {
      vibiMemoryService.rememberFact('temporary_fact', 'To be forgotten');
      expect(vibiMemoryService.getAllMemories().persistentCount).toBe(1);

      const intent = vibiIntentEngine.detectIntent('forget everything');
      expect(intent.matched).toBe(true);
      expect(intent.topic).toBe('memory');
      expect(intent.replyText).toContain('Memory completely wiped');

      expect(vibiMemoryService.getAllMemories().persistentCount).toBe(0);
    });
  });

  describe('6. Context Engine Memory Integration', () => {
    it('includes memory in getWorkflowContext', () => {
      vibiMemoryService.rememberFact('preferred_style', 'detailed');

      const workflow = vibiContextService.getWorkflowContext({
        user: { username: 'test_user' },
        preferences: { enabled: true, appContext: true }
      });

      expect(workflow.memory).toBeDefined();
      expect(workflow.memory.persistentFacts.preferred_style).toBe('detailed');
    });

    it('attaches memory domain in buildRelevantContext when query asks about memory', () => {
      vibiMemoryService.rememberFact('font_size', 'large');

      const relevant = vibiContextService.buildRelevantContext('Show my memory');
      expect(relevant.memory).toBeDefined();
      expect(relevant.memory.facts.font_size).toBe('large');
    });
  });
});

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import vibiIntentEngine, { EXECUTION_STATES } from '../services/vibiIntentEngine';
import vibiActionRegistry from '../services/vibiActionRegistry';
import vibiAuditLog from '../services/vibiAuditLog';

describe('Vibi Action Execution Framework & Safe Dispatcher Suite (Phase 5)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vibiAuditLog.clearAuditLogs();
    vibiIntentEngine.setExecutionState(EXECUTION_STATES.IDLE);
    vibiIntentEngine.recentActionNonces.clear();
  });

  describe('1. Execution State Machine & Transitions', () => {
    it('starts in IDLE state', () => {
      expect(vibiIntentEngine.getExecutionState()).toBe(EXECUTION_STATES.IDLE);
      expect(vibiIntentEngine.isExecuting()).toBe(false);
    });

    it('transitions to SUCCESS state after clean execution', async () => {
      const intent = { actionId: 'toggle_sound', params: { enabled: true } };
      const res = await vibiIntentEngine.executeIntent(intent);

      expect(res.success).toBe(true);
      expect(res.state).toBe(EXECUTION_STATES.SUCCESS);
      expect(vibiIntentEngine.getExecutionState()).toBe(EXECUTION_STATES.IDLE);
    });

    it('transitions to AWAITING_CONFIRMATION when confirmation guard triggers', async () => {
      const intent = { actionId: 'clear_vibi_chat', params: {} };
      const res = await vibiIntentEngine.executeIntent(intent);

      expect(res.requiresConfirmation).toBe(true);
      expect(res.state).toBe(EXECUTION_STATES.AWAITING_CONFIRMATION);
    });

    it('transitions to FAILED state when validation fails', async () => {
      const intent = { actionId: 'unregistered_action_xyz', params: {} };
      const res = await vibiIntentEngine.executeIntent(intent);

      expect(res.success).toBe(false);
      expect(res.state).toBe(EXECUTION_STATES.FAILED);
    });
  });

  describe('2. Action Timeout & Fallback Safeguards', () => {
    it('times out and transitions to TIMED_OUT when action handler exceeds timeout limit', async () => {
      // Register a slow action for testing
      vibiActionRegistry.registerAction({
        id: 'test_slow_action',
        name: 'Slow Action',
        category: 'ui',
        safetyTier: 'READ_ONLY',
        requiresConfirmation: false,
        handler: () => new Promise((resolve) => setTimeout(resolve, 500))
      });

      const intent = { actionId: 'test_slow_action', params: {} };
      const res = await vibiIntentEngine.executeIntent(intent, {}, {}, 'test_user', { timeoutMs: 50 });

      expect(res.success).toBe(false);
      expect(res.state).toBe(EXECUTION_STATES.TIMED_OUT);
      expect(res.error).toContain('action_timeout');

      // Verify audit log captured timeout
      const logs = vibiAuditLog.getAuditLogs(5);
      expect(logs[0].status).toBe('failed');
      expect(logs[0].failureReason).toContain('action_timeout');
    });
  });

  describe('3. Replay Protection & Idempotency Guard', () => {
    it('prevents rapid double-execution of state mutating actions', async () => {
      let runCount = 0;
      vibiActionRegistry.registerAction({
        id: 'test_mutating_action',
        name: 'Mutating Action',
        category: 'ui',
        safetyTier: 'STATE_MUTATING',
        requiresConfirmation: false,
        handler: async () => {
          runCount++;
          return { success: true };
        }
      });

      const intent = { actionId: 'test_mutating_action', params: {} };

      // First run: allowed
      const res1 = await vibiIntentEngine.executeIntent(intent, {}, {}, 'tester');
      expect(res1.success).toBe(true);
      expect(runCount).toBe(1);

      // Immediate second run: suppressed by replay guard
      const res2 = await vibiIntentEngine.executeIntent(intent, {}, {}, 'tester');
      expect(res2.success).toBe(false);
      expect(res2.isDuplicate).toBe(true);
      expect(runCount).toBe(1); // handler was not invoked a second time
    });

    it('allows repeated execution when bypassReplayGuard option is provided', async () => {
      let runCount = 0;
      vibiActionRegistry.registerAction({
        id: 'test_mutating_bypass',
        name: 'Mutating Action Bypass',
        category: 'ui',
        safetyTier: 'STATE_MUTATING',
        requiresConfirmation: false,
        handler: async () => {
          runCount++;
          return { success: true };
        }
      });

      const intent = { actionId: 'test_mutating_bypass', params: {} };

      await vibiIntentEngine.executeIntent(intent, {}, {}, 'tester');
      await vibiIntentEngine.executeIntent(intent, {}, {}, 'tester', { bypassReplayGuard: true });

      expect(runCount).toBe(2);
    });
  });

  describe('4. Universal Execution Duration & Audit Receipt', () => {
    it('returns durationMs, actionId, and safetyTier in execution result', async () => {
      const intent = { actionId: 'scroll_top', params: {} };
      const res = await vibiIntentEngine.executeIntent(intent);

      expect(res.success).toBe(true);
      expect(typeof res.durationMs).toBe('number');
      expect(res.durationMs).toBeGreaterThanOrEqual(0);
      expect(res.actionId).toBe('scroll_top');
      expect(res.safetyTier).toBe('READ_ONLY');

      // Check audit log contains durationMs and safetyTier
      const logs = vibiAuditLog.getAuditLogs(5);
      expect(logs[0].actionId).toBe('scroll_top');
      expect(logs[0].safetyTier).toBe('READ_ONLY');
      expect(typeof logs[0].durationMs).toBe('number');
    });
  });
});

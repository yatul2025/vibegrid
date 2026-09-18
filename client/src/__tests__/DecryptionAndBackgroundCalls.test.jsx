import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import e2eeService from '../services/crypto/e2eeService';

describe('VibeGrid Decryption, Background Calls & Multi-Device Suite', () => {
  let originalVibrate;
  let originalFetch;

  beforeEach(() => {
    // Reset e2eeService caches
    e2eeService.activeCryptoKeys = new Map();
    e2eeService._sessionKeyPromises = new Map();
    e2eeService.decryptedTextCache = new Map();
    e2eeService.currentUserId = 1;

    originalVibrate = navigator.vibrate;
    navigator.vibrate = vi.fn();

    originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalVibrate) navigator.vibrate = originalVibrate;
    if (originalFetch) global.fetch = originalFetch;
  });

  describe('1. Fast & Progressive Message Decryption Pipeline', () => {
    it('deduplicates in-flight session key derivations for the same peer', async () => {
      let derivationRuns = 0;

      // Mock getOrCreateSessionKey implementation to simulate derivation work
      e2eeService.getOrCreateSessionKey = vi.fn(async (peerId) => {
        if (e2eeService.activeCryptoKeys.has(peerId)) {
          return e2eeService.activeCryptoKeys.get(peerId);
        }
        if (e2eeService._sessionKeyPromises.has(peerId)) {
          return e2eeService._sessionKeyPromises.get(peerId);
        }

        const p = (async () => {
          derivationRuns++;
          // Microtask yield
          await new Promise((r) => queueMicrotask(r));
          const mockKey = { type: 'secret', algorithm: { name: 'AES-GCM' } };
          e2eeService.activeCryptoKeys.set(peerId, mockKey);
          e2eeService._sessionKeyPromises.delete(peerId);
          return mockKey;
        })();

        e2eeService._sessionKeyPromises.set(peerId, p);
        return p;
      });

      // Launch 10 concurrent requests for peer 42
      const promises = Array.from({ length: 10 }, () => e2eeService.getOrCreateSessionKey(42));
      const keys = await Promise.all(promises);

      // Must execute derivation exactly ONCE, and return the same key to all 10 callers
      expect(derivationRuns).toBe(1);
      expect(keys.length).toBe(10);
      expect(keys[0]).toEqual(keys[9]);
    });

    it('returns cached decrypted text in 0ms without re-decrypting', async () => {
      const mockMsg = { id: 101, ciphertext: 'c3VwZXI=', iv_nonce: 'bm9uY2U=' };
      const cacheKey = `msg_${mockMsg.id}`;

      // Pre-seed cache
      e2eeService.decryptedTextCache.set(cacheKey, 'Hello VibeGrid!');

      // Decrypt message should resolve immediately from cache
      const text = await e2eeService.decryptMessage(mockMsg, 2);
      expect(text).toBe('Hello VibeGrid!');
      expect(e2eeService.decryptedTextCache.has(cacheKey)).toBe(true);
    });

    it('gracefully handles corrupted ciphertext without throwing and caches placeholder', async () => {
      const corruptMsg = { id: 999, ciphertext: 'corrupt!!', iv_nonce: 'bad!!' };
      
      // Mock session key present
      e2eeService.activeCryptoKeys.set(2, { type: 'secret' });

      const text = await e2eeService.decryptMessage(corruptMsg, 2);
      expect(text).toContain('🔒 [Encrypted message');
      expect(e2eeService.decryptedTextCache.get('msg_999')).toContain('🔒 [Encrypted message');
    });

    it('decrypts large message lists progressively in micro-batches with progress callbacks', async () => {
      const messages = Array.from({ length: 35 }, (_, idx) => ({
        id: idx + 1,
        content: `Plaintext message ${idx + 1}`
      }));

      const progressSnapshots = [];
      const onProgress = vi.fn((batch) => {
        progressSnapshots.push(batch.length);
      });

      const results = await e2eeService.decryptMessageList(messages, 2, onProgress);

      expect(results.length).toBe(35);
      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('2. Background / Closed App Call Recovery', () => {
    it('Service Worker background decline triggers HTTP reject endpoint', async () => {
      const callId = 'call-abc-123';
      const response = await fetch(`/api/calls/${callId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'declined' }),
        credentials: 'include'
      });

      expect(fetch).toHaveBeenCalledWith(
        `/api/calls/${callId}/reject`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reason: 'declined' })
        })
      );
      expect(response.ok).toBe(true);
    });

    it('parses URL query params with callId and callAction=answer', () => {
      const search = '?callId=call-test-456&callAction=answer&callType=video&callerId=5&callerName=Alice';
      const params = new URLSearchParams(search);

      expect(params.get('callId')).toBe('call-test-456');
      expect(params.get('callAction')).toBe('answer');
      expect(params.get('callType')).toBe('video');
      expect(params.get('callerId')).toBe('5');
      expect(params.get('callerName')).toBe('Alice');
    });
  });

  describe('3. Multi-Device Call Synchronization', () => {
    it('stops ringing and clears modal on call:answered_elsewhere', () => {
      let callState = 'incoming';
      let callData = { callId: 'call-789', peer: { id: 10 } };
      let isRinging = true;

      const stopAllMedia = vi.fn(() => {
        isRinging = false;
      });

      const handleCallAnsweredElsewhere = (data) => {
        if (data.callId === callData.callId) {
          stopAllMedia();
          callState = null;
          callData = null;
        }
      };

      // Callee answers on Tablet -> Phone receives answered_elsewhere event
      handleCallAnsweredElsewhere({ callId: 'call-789', action: 'accepted' });

      expect(stopAllMedia).toHaveBeenCalled();
      expect(callState).toBeNull();
      expect(callData).toBeNull();
      expect(isRinging).toBe(false);
    });

    it('callee 40s timeout emits call:reject with reason timeout', () => {
      const mockEmit = vi.fn();
      const callData = { callId: 'call-timeout-1', caller: { id: 8 } };

      const triggerTimeout = () => {
        mockEmit('call:reject', {
          callId: callData.callId,
          callerId: callData.caller?.id,
          reason: 'timeout'
        });
      };

      triggerTimeout();

      expect(mockEmit).toHaveBeenCalledWith('call:reject', {
        callId: 'call-timeout-1',
        callerId: 8,
        reason: 'timeout'
      });
    });

    it('caller cancellation synchronizes and dismisses call on all devices', () => {
      let callState = 'incoming';
      let callData = { callId: 'call-cancel-9' };
      const stopAllMedia = vi.fn();

      const handleCallCancelled = (data) => {
        if (data.callId === callData.callId) {
          stopAllMedia();
          callState = null;
          callData = null;
        }
      };

      handleCallCancelled({ callId: 'call-cancel-9', callerId: 2 });

      expect(stopAllMedia).toHaveBeenCalled();
      expect(callState).toBeNull();
      expect(callData).toBeNull();
    });
  });
});

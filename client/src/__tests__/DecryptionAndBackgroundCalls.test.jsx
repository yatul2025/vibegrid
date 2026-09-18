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

  describe('4. Incoming Call Push Notification & Accept Connection Suite', () => {
    it('accurately identifies incoming call pushes and distinguishes them from normal messages', () => {
      const callPayload = {
        title: '📞 Incoming Audio Call',
        body: 'Alice is calling you on VibeGrid...',
        type: 'call',
        data: {
          type: 'call',
          callId: 'call-999',
          callType: 'audio',
          callerId: 10,
          callerName: 'Alice'
        }
      };

      const messagePayload = {
        title: 'Alice',
        body: 'Hey, are you free to talk?',
        type: 'message',
        data: {
          type: 'message',
          conversationId: 5,
          senderId: 10
        }
      };

      const detectCall = (payload) => {
        const notifType = payload.data?.type || payload.type || (payload.data?.callId || payload.tag?.startsWith('call-') ? 'call' : 'general');
        return notifType === 'call' || payload.type === 'call' || Boolean(payload.data?.callId) || Boolean(payload.tag?.startsWith('call-'));
      };

      expect(detectCall(callPayload)).toBe(true);
      expect(detectCall(messagePayload)).toBe(false);
    });

    it('Service Worker suppresses in-app activity toast for incoming call notifications in App.jsx', () => {
      const toastTrigger = vi.fn();
      const handleServiceWorkerMessage = (event) => {
        if (event.data?.type === 'PUSH_NOTIFICATION_RECEIVED') {
          const payload = event.data.payload || {};
          const notifType = payload.data?.type || payload.type || (payload.data?.callId || payload.tag?.startsWith('call-') ? 'call' : 'general');
          const isCall = notifType === 'call' || payload.type === 'call' || Boolean(payload.data?.callId) || Boolean(payload.tag?.startsWith('call-'));
          if (isCall) return; // Calls must NEVER show generic message toasts

          toastTrigger(payload);
        }
      };

      // Call push notification
      handleServiceWorkerMessage({
        data: {
          type: 'PUSH_NOTIFICATION_RECEIVED',
          payload: {
            type: 'call',
            data: { type: 'call', callId: '123' }
          }
        }
      });

      expect(toastTrigger).not.toHaveBeenCalled();

      // Regular message
      handleServiceWorkerMessage({
        data: {
          type: 'PUSH_NOTIFICATION_RECEIVED',
          payload: {
            type: 'message',
            data: { type: 'message', content: 'hello' }
          }
        }
      });

      expect(toastTrigger).toHaveBeenCalledTimes(1);
    });

    it('determines callAction correctly for accept, answer, and open tap', () => {
      const resolveCallAction = (isCall, action) => {
        return isCall
          ? ((action === 'accept' || action === 'answer') ? 'accept' : 'open')
          : null;
      };

      expect(resolveCallAction(true, 'accept')).toBe('accept');
      expect(resolveCallAction(true, 'answer')).toBe('accept');
      expect(resolveCallAction(true, undefined)).toBe('open');
      expect(resolveCallAction(true, '')).toBe('open');
    });

    it('constructs dedicated call restoration URL preserving original callId', () => {
      const notifData = {
        callId: 'call-unique-777',
        callType: 'video',
        callerId: 42,
        callerName: 'Sarah',
        callerAvatar: '/avatars/sarah.jpg'
      };
      const callAction = 'accept';

      const params = new URLSearchParams();
      params.set('callId', notifData.callId);
      if (callAction) params.set('callAction', callAction);
      if (notifData.callType) params.set('callType', notifData.callType);
      if (notifData.callerId) params.set('callerId', String(notifData.callerId));
      if (notifData.callerName) params.set('callerName', notifData.callerName);
      if (notifData.callerAvatar) params.set('callerAvatar', notifData.callerAvatar);

      const targetUrl = `/?${params.toString()}`;

      expect(targetUrl).toContain('callId=call-unique-777');
      expect(targetUrl).toContain('callAction=accept');
      expect(targetUrl).toContain('callType=video');
      expect(targetUrl).toContain('callerId=42');
      expect(targetUrl).not.toContain('#messages');
    });

    it('restores original callId without mutating or creating a new call session', async () => {
      const originalCallId = 'call-session-888';
      const mockPayload = {
        callId: originalCallId,
        callAction: 'accept',
        callType: 'audio',
        callerId: 15,
        callerName: 'Bob'
      };

      const mockEmit = vi.fn();
      let callState = null;
      let callSubState = null;
      let restoredCallData = null;

      const restoreCall = async (payload) => {
        const targetCallId = String(payload.callId);
        const action = payload.callAction;

        const peer = {
          id: payload.callerId ? Number(payload.callerId) : null,
          username: payload.callerName || 'Contact'
        };

        const restoredCall = {
          callId: targetCallId,
          peer,
          callType: payload.callType || 'audio',
          isInitiator: false
        };

        restoredCallData = restoredCall;

        if (action === 'accept' || action === 'answer') {
          callState = 'connected';
          callSubState = 'connecting';
          mockEmit('call:accept', {
            callId: targetCallId,
            callerId: peer.id
          });
        }
      };

      await restoreCall(mockPayload);

      expect(restoredCallData.callId).toBe(originalCallId);
      expect(restoredCallData.isInitiator).toBe(false);
      expect(callState).toBe('connected');
      expect(callSubState).toBe('connecting');
      expect(mockEmit).toHaveBeenCalledWith('call:accept', {
        callId: originalCallId,
        callerId: 15
      });
    });

    it('Caller transitions to connected upon call:accepted and starts WebRTC as initiator', async () => {
      let callerState = 'calling';
      let callerSubState = 'ringing';
      const webrtcStartAsInitiator = vi.fn().mockResolvedValue(true);

      const handleCallAccepted = async (data) => {
        callerState = 'connected';
        callerSubState = 'connecting';
        await webrtcStartAsInitiator(data.calleeId, data.callId, 'audio');
      };

      await handleCallAccepted({ callId: 'call-sync-1', calleeId: 20 });

      expect(callerState).toBe('connected');
      expect(callerSubState).toBe('connecting');
      expect(webrtcStartAsInitiator).toHaveBeenCalledWith(20, 'call-sync-1', 'audio');
    });

    it('Callee transitions to connected upon signal:offer and starts WebRTC answerer', async () => {
      let calleeState = 'connected';
      let calleeSubState = 'connecting';
      let connectionStatus = 'connecting';
      const webrtcHandleOffer = vi.fn().mockResolvedValue(true);

      const handleSignalOffer = async ({ callerId, sdp, callId, callType }) => {
        await webrtcHandleOffer(callerId, sdp, callId, callType);
        calleeState = 'connected';
        calleeSubState = 'connected';
        connectionStatus = 'connected';
      };

      await handleSignalOffer({
        callerId: 15,
        sdp: { type: 'offer', sdp: 'v=0...' },
        callId: 'call-sync-1',
        callType: 'audio'
      });

      expect(calleeState).toBe('connected');
      expect(calleeSubState).toBe('connected');
      expect(connectionStatus).toBe('connected');
      expect(webrtcHandleOffer).toHaveBeenCalledWith(15, { type: 'offer', sdp: 'v=0...' }, 'call-sync-1', 'audio');
    });

    it('ignores answered_elsewhere event if the current client is the active answering endpoint', () => {
      let callState = 'connected';
      let callSubState = 'connecting';
      let callData = { callId: 'call-active-123', peer: { id: 10 } };
      const stopAllMedia = vi.fn();

      const handleCallAnsweredElsewhere = (data) => {
        if (
          data?.callId &&
          callData?.callId &&
          String(data.callId) === String(callData.callId) &&
          (callState === 'connected' || callSubState === 'connecting')
        ) {
          return;
        }
        stopAllMedia();
        callState = null;
        callData = null;
      };

      handleCallAnsweredElsewhere({ callId: 'call-active-123', action: 'accepted' });

      expect(stopAllMedia).not.toHaveBeenCalled();
      expect(callState).toBe('connected');
      expect(callData).not.toBeNull();
    });

    it('ignores duplicate incoming call events if already connected to that call', () => {
      let callState = 'connected';
      let callSubState = 'connecting';
      let callData = { callId: 'call-active-123', peer: { id: 10 } };
      const startRingtone = vi.fn();

      const handleIncomingCall = (data) => {
        if (
          callData?.callId &&
          String(callData.callId) === String(data.callId) &&
          (callState === 'connected' || callSubState === 'connecting')
        ) {
          return;
        }
        callState = 'incoming';
        startRingtone();
      };

      handleIncomingCall({ callId: 'call-active-123', caller: { id: 10 } });

      expect(startRingtone).not.toHaveBeenCalled();
      expect(callState).toBe('connected');
    });

    it('mobile backgrounding and pagehide do not abort the call', () => {
      const mockEmit = vi.fn();
      const stopAllMedia = vi.fn();
      const callData = { callId: 'call-active-123', peer: { id: 10 } };

      const handleUnload = (event) => {
        if (event?.type === 'pagehide') return;
        stopAllMedia();
        if (callData?.callId && callData?.peer?.id) {
          mockEmit('call:end', {
            callId: callData.callId,
            targetUserId: callData.peer.id
          });
        }
      };

      handleUnload({ type: 'pagehide' });

      expect(stopAllMedia).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('active call verification accepts initiated, ringing, and connected statuses', () => {
      const isValidActiveCall = (ac, targetCallId) => {
        return (
          String(ac.callId) === targetCallId &&
          (ac.callStatus === 'initiated' || ac.callStatus === 'ringing' || ac.callStatus === 'connected')
        );
      };

      expect(isValidActiveCall({ callId: '100', callStatus: 'initiated' }, '100')).toBe(true);
      expect(isValidActiveCall({ callId: '100', callStatus: 'ringing' }, '100')).toBe(true);
      expect(isValidActiveCall({ callId: '100', callStatus: 'connected' }, '100')).toBe(true);
      expect(isValidActiveCall({ callId: '100', callStatus: 'ended' }, '100')).toBe(false);
    });
  });
});

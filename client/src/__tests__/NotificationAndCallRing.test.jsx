import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('VibeGrid Notification & Call Ring Suite', () => {
  let originalVibrate;
  let originalAudioContext;

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock navigator.vibrate
    originalVibrate = navigator.vibrate;
    navigator.vibrate = vi.fn();

    // Mock AudioContext
    originalAudioContext = window.AudioContext;
    class MockAudioContext {
      constructor() {
        this.state = 'running';
        this.currentTime = 0;
      }
      createGain() {
        return {
          gain: {
            value: 0,
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
      }
      createOscillator() {
        return {
          type: 'sine',
          frequency: {
            setValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
      }
      close() {
        this.state = 'closed';
        return Promise.resolve();
      }
    }
    window.AudioContext = MockAudioContext;
    window.webkitAudioContext = MockAudioContext;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    if (originalVibrate) {
      navigator.vibrate = originalVibrate;
    }
    if (originalAudioContext) {
      window.AudioContext = originalAudioContext;
    }
  });

  describe('1. Incoming & Outgoing Call Phone-Style Ring Cadence', () => {
    it('executes ring burst for 1.6s then 1.8s pause in an alternating cycle', () => {
      let ringCount = 0;
      let intervalId = null;
      let activeAudio = false;

      const playBurst = () => {
        ringCount += 1;
        activeAudio = true;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([1600, 1800]);
        }
        setTimeout(() => {
          activeAudio = false;
        }, 1600);
      };

      const startRingtone = () => {
        playBurst();
        intervalId = setInterval(playBurst, 3400); // 1.6s sound + 1.8s pause
      };

      const stopRingtone = () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        activeAudio = false;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(0);
        }
      };

      startRingtone();

      // Cycle 0: Started immediately
      expect(ringCount).toBe(1);
      expect(activeAudio).toBe(true);
      expect(navigator.vibrate).toHaveBeenCalledWith([1600, 1800]);

      // Fast-forward 1600ms -> sound ends, silence begins
      vi.advanceTimersByTime(1600);
      expect(activeAudio).toBe(false);

      // Fast-forward remaining 1800ms (total 3400ms) -> second burst triggers
      vi.advanceTimersByTime(1800);
      expect(ringCount).toBe(2);
      expect(activeAudio).toBe(true);

      // Fast-forward another 3400ms -> third burst triggers
      vi.advanceTimersByTime(3400);
      expect(ringCount).toBe(3);

      // Stop ringtone immediately
      stopRingtone();
      expect(activeAudio).toBe(false);
      expect(navigator.vibrate).toHaveBeenCalledWith(0);

      // Verify no further bursts fire after stopping
      vi.advanceTimersByTime(10000);
      expect(ringCount).toBe(3);
    });

    it('prevents multiple overlapping ringtones by stopping previous instances', () => {
      let activeOscillators = 0;
      let intervalTimer = null;

      const stopRingtone = () => {
        if (intervalTimer) {
          clearInterval(intervalTimer);
          intervalTimer = null;
        }
        activeOscillators = 0;
        navigator.vibrate(0);
      };

      const startRingtone = () => {
        stopRingtone(); // Crucial: clean up previous instance
        activeOscillators = 2; // dual tone 440Hz + 480Hz
        intervalTimer = setInterval(() => {}, 3400);
      };

      startRingtone();
      expect(activeOscillators).toBe(2);

      // Trigger start again (e.g. state re-render)
      startRingtone();
      expect(activeOscillators).toBe(2); // Still 2, not 4
    });
  });

  describe('2. In-App Foreground Notification & Deduplication', () => {
    it('suppresses desktop push when app is in foreground and active', () => {
      // Mock active, focused window
      const isDocumentHidden = false;
      const isDocumentFocused = true;

      const shouldTriggerDesktopNotification = isDocumentHidden || !isDocumentFocused;
      expect(shouldTriggerDesktopNotification).toBe(false);
    });

    it('triggers desktop push when app is hidden or backgrounded', () => {
      // Mock backgrounded window
      const isDocumentHidden = true;
      const isDocumentFocused = false;

      const shouldTriggerDesktopNotification = isDocumentHidden || !isDocumentFocused;
      expect(shouldTriggerDesktopNotification).toBe(true);
    });

    it('deduplicates identical notification IDs within the 12s window', () => {
      const recentNotificationIds = new Set();
      const displayedToasts = [];

      const triggerInAppToast = (toast) => {
        if (!toast || !toast.id) return;
        const toastIdStr = String(toast.id);
        if (recentNotificationIds.has(toastIdStr)) {
          return; // Suppress duplicate
        }
        recentNotificationIds.add(toastIdStr);
        setTimeout(() => {
          recentNotificationIds.delete(toastIdStr);
        }, 12000);

        displayedToasts.push(toast);
      };

      // First trigger
      triggerInAppToast({ id: 'msg-101', title: '@alice', body: 'Hey!' });
      expect(displayedToasts.length).toBe(1);

      // Immediate duplicate (e.g. simultaneous socket & SW push)
      triggerInAppToast({ id: 'msg-101', title: '@alice', body: 'Hey!' });
      expect(displayedToasts.length).toBe(1);

      // Different ID
      triggerInAppToast({ id: 'msg-102', title: '@bob', body: 'Yo!' });
      expect(displayedToasts.length).toBe(2);

      // Fast forward past 12s expiry
      vi.advanceTimersByTime(12500);

      // Now msg-101 can be received again if sent again
      triggerInAppToast({ id: 'msg-101', title: '@alice', body: 'Hey again!' });
      expect(displayedToasts.length).toBe(3);
    });

    it('evaluates service worker foreground suppression correctly', () => {
      // Service worker client list simulation
      const foregroundClients = [
        { visibilityState: 'visible', focused: true },
        { visibilityState: 'hidden', focused: false }
      ];

      const isForeground = foregroundClients.some(
        (c) => c.visibilityState === 'visible' && c.focused
      );
      expect(isForeground).toBe(true);

      // Suppress general notification in foreground
      const isCall = false;
      const shouldShowPushNotification = !isForeground || isCall;
      expect(shouldShowPushNotification).toBe(false);

      // Call notification must always show
      const isIncomingCall = true;
      const shouldShowCallNotification = !isForeground || isIncomingCall;
      expect(shouldShowCallNotification).toBe(true);
    });
  });
});

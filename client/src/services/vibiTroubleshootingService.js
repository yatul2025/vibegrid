/**
 * client/src/services/vibiTroubleshootingService.js
 * ==================================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 8 TROUBLESHOOTING & SELF-HEALING
 *
 * Self-healing capabilities:
 * 1. "My messages aren't loading" -> Check network, socket, offer reconnect.
 * 2. "Notifications aren't working" -> Check Notification.permission, guide user, offer test.
 * 3. "Calls aren't connecting" -> Check microphone/camera permissions & WebRTC.
 * 4. "App feels slow" -> Check localStorage size, offer safe temporary cache cleanup.
 * 5. "I can't upload images" -> Check size limits (5MB) and format support.
 *
 * ABSOLUTE SAFETY GUARD:
 * NEVER delete or clear IndexedDB databases, user session tokens, or E2EE cryptographic keys!
 */

import socketService from './socketService';

export const PROTECTED_STORAGE_KEYS = Object.freeze([
  'vibegrid_user',
  'vibegrid_token',
  'vibegrid_theme',
  'vibegrid_vibi_preferences',
  'vibegrid_vibi_proactive_shown_count',
  'vibegrid_vibi_proactive_dismissed',
  'vibegrid_auth'
]);

export class VibiTroubleshootingService {
  /**
   * 1. Diagnose Messages & Real-time Connectivity
   */
  async diagnoseMessages() {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const isSocketConnected = Boolean(socketService?.socket?.connected);

    let recommendation = '';
    let status = 'healthy';

    if (!isOnline) {
      status = 'error';
      recommendation = "You appear to be offline. Check your Wi-Fi or mobile data connection.";
    } else if (!isSocketConnected) {
      status = 'warning';
      recommendation = "Real-time socket is disconnected. VibeGrid is using HTTP polling fallback, but you can try reconnecting.";
    } else {
      recommendation = "Connection and real-time socket are both online and operational! ⚡";
    }

    return {
      category: 'messages',
      status,
      details: {
        online: isOnline,
        socketConnected: isSocketConnected
      },
      message: recommendation,
      action: !isOnline || !isSocketConnected ? { id: 'reconnect_network', label: 'Reconnect Now' } : null
    };
  }

  /**
   * 2. Diagnose Notification Permissions & Delivery
   */
  async diagnoseNotifications() {
    let permission = 'unsupported';
    if (typeof window !== 'undefined' && 'Notification' in window) {
      permission = Notification.permission; // 'granted', 'denied', 'default'
    }

    let status = 'healthy';
    let message = '';
    let action = null;

    if (permission === 'unsupported') {
      status = 'warning';
      message = "Browser notifications are not supported in this browser environment.";
    } else if (permission === 'denied') {
      status = 'error';
      message = "Notifications are blocked by your browser. To enable them, click the lock/settings icon in your browser address bar and allow Notifications.";
    } else if (permission === 'default') {
      status = 'warning';
      message = "Notification permission has not been granted yet. Tap below to send a permission request and test notification.";
      action = { id: 'test_notification', label: 'Test Notifications' };
    } else {
      message = "Notifications are permitted and active! 🔔";
      action = { id: 'test_notification', label: 'Send Test Notification' };
    }

    return {
      category: 'notifications',
      status,
      details: { permission },
      message,
      action
    };
  }

  /**
   * 3. Diagnose WebRTC Calls, Camera & Microphone Access
   */
  async diagnoseCallsAndMedia() {
    const hasWebRTC = typeof window !== 'undefined' && Boolean(window.RTCPeerConnection);
    const hasMediaDevices = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

    let micStatus = 'unknown';
    let camStatus = 'unknown';

    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      try {
        const micPermission = await navigator.permissions.query({ name: 'microphone' });
        micStatus = micPermission.state; // 'granted', 'denied', 'prompt'
      } catch {
        micStatus = 'unsupported_query';
      }

      try {
        const camPermission = await navigator.permissions.query({ name: 'camera' });
        camStatus = camPermission.state;
      } catch {
        camStatus = 'unsupported_query';
      }
    }

    let status = 'healthy';
    let message = '';

    if (!hasWebRTC) {
      status = 'error';
      message = "WebRTC peer-to-peer calling is not supported in this browser.";
    } else if (micStatus === 'denied' || camStatus === 'denied') {
      status = 'warning';
      message = `Microphone (${micStatus}) or Camera (${camStatus}) is blocked in browser permissions. Please allow access in browser site settings to place calls.`;
    } else {
      message = `WebRTC engine is ready! Mic: ${micStatus}, Camera: ${camStatus}. 📞`;
    }

    return {
      category: 'calls',
      status,
      details: {
        hasWebRTC,
        hasMediaDevices,
        micStatus,
        camStatus
      },
      message,
      action: { id: 'navigate', params: { tab: 'settings', section: 'privacy' }, label: 'Privacy Settings' }
    };
  }

  /**
   * 4. Diagnose Local Storage & Temporary Cache Size
   */
  diagnoseStorage() {
    let totalBytes = 0;
    let itemCount = 0;
    let cacheKeysCount = 0;

    try {
      if (typeof localStorage !== 'undefined') {
        itemCount = localStorage.length;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          const val = localStorage.getItem(key) || '';
          totalBytes += (key.length + val.length) * 2; // UTF-16 bytes approx
          if (this.isClearableCacheKey(key)) {
            cacheKeysCount++;
          }
        }
      }
    } catch {
      // ignore
    }

    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
    const isHigh = totalBytes > 4 * 1024 * 1024; // > 4MB

    return {
      category: 'performance',
      status: isHigh ? 'warning' : 'healthy',
      details: {
        totalMB: Number(totalMB),
        itemCount,
        cacheKeysCount
      },
      message: isHigh
        ? `Local storage usage is elevated (${totalMB} MB). Clearing non-essential cache can speed up performance.`
        : `Storage is healthy (${totalMB} MB used). Key security data and E2EE keys are protected. 🚀`,
      action: { id: 'clear_temporary_cache', label: 'Clear Temp Cache' }
    };
  }

  /**
   * 5. Diagnose Image Upload Requirements
   * @param {File|Object} [file]
   */
  diagnoseImageUpload(file = null) {
    const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
    const SUPPORTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

    if (!file) {
      return {
        category: 'uploads',
        status: 'healthy',
        details: {
          maxSizeMB: 5,
          supportedFormats: ['JPEG', 'PNG', 'WebP', 'GIF']
        },
        message: "📸 **Image Upload Rules**:\n- Maximum file size: **5 MB**\n- Supported formats: **JPEG, PNG, WebP, GIF**\n- Automatically compressed on device before upload."
      };
    }

    const size = file.size || 0;
    const type = file.type || '';
    const sizeMB = (size / (1024 * 1024)).toFixed(2);

    if (size > MAX_SIZE_BYTES) {
      return {
        category: 'uploads',
        status: 'error',
        details: { sizeMB: Number(sizeMB), type },
        message: `File size is ${sizeMB} MB, exceeding the 5 MB limit. Please compress or resize the image before uploading.`
      };
    }

    if (type && !SUPPORTED_TYPES.includes(type.toLowerCase())) {
      return {
        category: 'uploads',
        status: 'error',
        details: { sizeMB: Number(sizeMB), type },
        message: `Unsupported format (${type}). VibeGrid supports JPEG, PNG, WebP, and GIF.`
      };
    }

    return {
      category: 'uploads',
      status: 'healthy',
      details: { sizeMB: Number(sizeMB), type },
      message: `Image is valid (${sizeMB} MB, ${type}) and ready for upload! ✨`
    };
  }

  /**
   * Run Full System Diagnostics
   */
  async runFullDiagnostics() {
    const [messages, notifications, calls] = await Promise.all([
      this.diagnoseMessages(),
      this.diagnoseNotifications(),
      this.diagnoseCallsAndMedia()
    ]);
    const storage = this.diagnoseStorage();
    const uploads = this.diagnoseImageUpload();

    const results = [messages, notifications, calls, storage, uploads];
    const issues = results.filter((r) => r.status === 'error' || r.status === 'warning');

    return {
      healthy: issues.length === 0,
      timestamp: Date.now(),
      summary: issues.length === 0
        ? "All VibeGrid systems are operational and healthy! 🦊✅"
        : `Found ${issues.length} potential area${issues.length > 1 ? 's' : ''} to optimize.`,
      diagnostics: {
        messages,
        notifications,
        calls,
        storage,
        uploads
      }
    };
  }

  /**
   * Check if a storage key is safe temporary cache
   * @param {string} key
   * @returns {boolean}
   */
  isClearableCacheKey(key) {
    if (!key || typeof key !== 'string') return false;
    // Check if key is explicitly protected
    if (PROTECTED_STORAGE_KEYS.includes(key)) return false;
    if (key.includes('keyStore') || key.includes('e2ee') || key.includes('crypto')) return false;

    // Check if key is temporary
    return (
      key.startsWith('_temp_') ||
      key.startsWith('_cache_') ||
      key.includes('_preview') ||
      key.includes('_scratch') ||
      key.startsWith('explore_cache_')
    );
  }

  /**
   * Safe Self-Healing: Clear Temporary Non-Critical Cache
   * Strict Rule: NEVER delete user credentials or E2EE encryption keys!
   */
  clearTemporaryCache() {
    let removedCount = 0;
    try {
      if (typeof localStorage !== 'undefined') {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (this.isClearableCacheKey(key)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => {
          localStorage.removeItem(k);
          removedCount++;
        });
      }

      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('explore_cached_feed');
        sessionStorage.removeItem('temp_draft_preview');
      }
    } catch (err) {
      console.warn('[VibiTroubleshoot] Cache cleanup encountered an error:', err);
    }

    return {
      success: true,
      removedCount,
      message: `Cleared ${removedCount} temporary cached items. Your account and encrypted messages are completely safe! 🧹✨`
    };
  }

  /**
   * Self-Healing: Reconnect Socket & Refresh Realtime Connection
   */
  reconnectNetwork() {
    try {
      if (socketService) {
        if (socketService.socket?.connected) {
          socketService.disconnect?.();
        }
        socketService.connect?.();
      }
      return {
        success: true,
        message: "Network & real-time connection refreshed successfully! ⚡"
      };
    } catch (err) {
      return {
        success: false,
        message: `Reconnect failed: ${err.message}`
      };
    }
  }

  /**
   * Self-Healing: Test Notification Dispatch
   */
  async sendTestNotification() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return {
        success: false,
        message: "Notifications are not supported by this browser."
      };
    }

    if (Notification.permission === 'granted') {
      try {
        new Notification("VibeGrid • Vibi Test", {
          body: "Your notifications are working properly! 🦊🔔",
          icon: "/favicon.ico"
        });
        return {
          success: true,
          message: "Test notification sent! Look for the banner on your device. 🔔"
        };
      } catch (err) {
        return {
          success: false,
          message: `Could not show notification: ${err.message}`
        };
      }
    }

    if (Notification.permission === 'default') {
      try {
        const result = await Notification.requestPermission();
        if (result === 'granted') {
          new Notification("VibeGrid • Vibi Test", {
            body: "Your notifications are working properly! 🦊🔔",
            icon: "/favicon.ico"
          });
          return {
            success: true,
            message: "Permission granted! Test notification sent. 🔔"
          };
        } else {
          return {
            success: false,
            message: "Notification permission was declined."
          };
        }
      } catch (err) {
        return {
          success: false,
          message: `Request failed: ${err.message}`
        };
      }
    }

    return {
      success: false,
      message: "Notifications are blocked. Please enable notifications in your browser's site settings."
    };
  }
}

const vibiTroubleshootingService = new VibiTroubleshootingService();
export default vibiTroubleshootingService;

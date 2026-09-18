/**
 * client/src/services/permissionService.js
 * ========================================
 * VibeGrid Device Permission & Live State Management Service
 * 
 * Responsibilities:
 * 1. Inspect live browser permission states (Notifications, Microphone, Camera, Push Subscription).
 * 2. Evaluate whether onboarding should be shown for a given user (New user vs. Cleared site data vs. Active session).
 * 3. Safely request permissions one-by-one with immediate stream track teardown.
 * 4. Persist onboarding completion in localStorage and database without unnecessary re-prompts.
 */

import apiClient from '../api/client';
import pushNotificationService from './pushNotificationService';

class PermissionService {
  /**
   * Check current Notification permission
   * @returns {'granted' | 'denied' | 'default' | 'unsupported'}
   */
  getNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission || 'default';
  }

  /**
   * Check queryable permission state via Permissions API
   * @param {'microphone' | 'camera'} name
   * @returns {Promise<'granted' | 'denied' | 'prompt' | 'unknown'>}
   */
  async queryDevicePermission(name) {
    if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
      return 'unknown';
    }
    try {
      const status = await navigator.permissions.query({ name });
      return status.state || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Inspect current active Web Push subscription from service worker
   * @returns {Promise<{ active: boolean, endpoint: string | null }>}
   */
  async getPushSubscriptionStatus() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return { active: false, endpoint: null };
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg || !reg.pushManager) {
        return { active: false, endpoint: null };
      }
      const sub = await reg.pushManager.getSubscription();
      return {
        active: Boolean(sub),
        endpoint: sub ? sub.endpoint : null
      };
    } catch (e) {
      console.warn('[PermissionService] Failed to inspect push subscription:', e);
      return { active: false, endpoint: null };
    }
  }

  /**
   * Collect snapshot of all live permissions, subscriptions, and platform flags
   */
  async getLivePermissionState() {
    const notifPermission = this.getNotificationPermission();
    const pushSub = await this.getPushSubscriptionStatus();
    const micState = await this.queryDevicePermission('microphone');
    const camState = await this.queryDevicePermission('camera');

    const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = typeof window !== 'undefined' && Boolean(
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone
    );

    let swRegistered = false;
    let swScope = null;
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          swRegistered = true;
          swScope = reg.scope;
        }
      } catch {}
    }

    return {
      notifications: notifPermission,
      pushSubscription: pushSub,
      serviceWorker: { registered: swRegistered, scope: swScope },
      microphone: micState,
      camera: camState,
      isIosSafari: isIos && !isStandalone,
      isPwaInstalled: isStandalone
    };
  }

  /**
   * Determine whether the permission onboarding modal should be displayed.
   * Conforms to VibeGrid specifications:
   * 1. If user has already completed the permission flow, do NOT show screens during normal app usage.
   * 2. Only show on startup for brand new users (has_completed_onboarding === false).
   * 3. Re-checking for existing users is triggered on-demand via Settings -> "Re-check & Setup Permissions".
   *
   * @param {Object} user
   * @returns {Promise<boolean>}
   */
  async shouldShowPermissionOnboarding(user) {
    if (!user || !user.id) return false;

    // Demo personas never see onboarding
    const isDemo = Boolean(user.is_demo_session || user.isDemoSession || user.sessionType === 'demo');
    if (isDemo) return false;

    // Check if dismissed in this session
    const isSessionDismissed = typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem(`vg_onboarding_dismissed_${user.id}`) === 'true';
    if (isSessionDismissed) return false;

    // 1. Completed Users: If user has already completed onboarding (DB flag is true OR localStorage completed flag is present),
    // do NOT show permission screens again during normal app usage.
    const hasLocalFlag = typeof localStorage !== 'undefined' &&
      localStorage.getItem(`vibegrid_onboarding_${user.id}`) === 'completed';

    if (user.has_completed_onboarding || hasLocalFlag) {
      // Auto-heal localStorage flag if missing
      if (!hasLocalFlag && typeof localStorage !== 'undefined') {
        localStorage.setItem(`vibegrid_onboarding_${user.id}`, 'completed');
      }
      // Silently sync push subscription in background if notifications are already granted
      if (this.getNotificationPermission() === 'granted') {
        const pushSub = await this.getPushSubscriptionStatus();
        if (!pushSub.active) {
          pushNotificationService.syncPushSubscription().catch(() => {});
        }
      }
      return false;
    }

    // 2. Only prompt for brand new accounts that have never completed onboarding
    if (user.has_completed_onboarding === false) {
      return true;
    }

    return false;
  }

  /**
   * Request Notification Permission and register Web Push subscription
   */
  async requestNotificationAndPush() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { granted: false, error: 'Web notifications are not supported on this browser.' };
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const subRes = await pushNotificationService.subscribeToPushNotifications();
        return {
          granted: true,
          permission,
          subscribed: Boolean(subRes?.success)
        };
      } else {
        return {
          granted: false,
          permission,
          denied: permission === 'denied'
        };
      }
    } catch (err) {
      console.warn('[PermissionService] Notification request failed:', err);
      return { granted: false, error: err.message };
    }
  }

  /**
   * Request Microphone Permission via getUserMedia
   * Immediately stops all tracks to avoid leaving hardware engaged.
   */
  async requestMicrophonePermission() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { granted: false, error: 'Audio recording is not supported on this device.' };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately release microphone hardware
      stream.getTracks().forEach((track) => track.stop());
      return { granted: true };
    } catch (err) {
      console.warn('[PermissionService] Microphone request failed:', err.name, err.message);
      return {
        granted: false,
        error: err.message,
        denied: err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
      };
    }
  }

  /**
   * Request Camera Permission via getUserMedia
   * Immediately stops all tracks to avoid leaving hardware engaged.
   */
  async requestCameraPermission() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { granted: false, error: 'Camera is not supported on this device.' };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Immediately release camera hardware
      stream.getTracks().forEach((track) => track.stop());
      return { granted: true };
    } catch (err) {
      console.warn('[PermissionService] Camera request failed:', err.name, err.message);
      return {
        granted: false,
        error: err.message,
        denied: err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
      };
    }
  }

  /**
   * Mark onboarding complete both locally and in the database
   */
  async markOnboardingCompleted(userId) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`vibegrid_onboarding_${userId}`, 'completed');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`vg_onboarding_dismissed_${userId}`, 'true');
    }

    try {
      await apiClient.post('/users/onboarding-complete');
    } catch (e) {
      console.warn('[PermissionService] Failed to record onboarding completion on server:', e);
    }
  }

  /**
   * Dismiss onboarding for current session without persistent mark
   */
  dismissOnboardingForSession(userId) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`vg_onboarding_dismissed_${userId}`, 'true');
    }
  }
}

const permissionService = new PermissionService();
export default permissionService;

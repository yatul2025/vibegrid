/**
 * client/src/services/pushNotificationService.js
 * ===============================================
 * Client-Side Web Push Notification Service
 * 
 * Manages W3C Push API subscription lifecycle:
 * - Permission requests
 * - PushManager subscription via VAPID public key
 * - Synchronization with VibeGrid backend
 * - Diagnostics & Testing
 */

import apiClient from '../api/client';

/**
 * Converts a base64 URL-safe VAPID key to a Uint8Array required by pushManager.subscribe()
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks if the current browser environment supports the W3C Web Push & Service Worker APIs
 */
export function isPushNotificationSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Gets current notification permission state
 */
export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/**
 * Retrieves the current PushSubscription from the service worker, if active
 */
export async function getExistingSubscription() {
  if (!isPushNotificationSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('[Push Service] Failed to get existing subscription:', err);
    return null;
  }
}

/**
 * Subscribes the current device/browser to real Web Push notifications
 */
export async function subscribeToPushNotifications() {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported on this browser or platform.');
  }

  // 1. Request Notification permission from the user
  const permission = await Notification.requestPermission();
  if (permission === 'denied') {
    throw new Error('Notification permission was blocked by the browser. Please allow notifications in your browser/device settings.');
  }
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  // 2. Fetch VAPID Public Key from the backend
  const keyRes = await apiClient.get('/notifications/vapid-public-key');
  if (!keyRes.success || !keyRes.data?.publicKey) {
    throw new Error('Failed to retrieve VAPID public key from the server.');
  }
  const vapidPublicKey = keyRes.data.publicKey;

  // 3. Wait for service worker registration to be ready
  const registration = await navigator.serviceWorker.ready;

  // Check if an existing subscription already exists
  let subscription = await registration.pushManager.getSubscription();

  // If already subscribed, ensure it has valid keys; otherwise renew
  if (subscription) {
    const subJSON = subscription.toJSON();
    if (!subJSON.keys?.p256dh || !subJSON.keys?.auth) {
      try {
        await subscription.unsubscribe();
        subscription = null;
      } catch (err) {
        console.warn('[Push Service] Could not unsubscribe stale subscription:', err);
      }
    }
  }

  if (!subscription) {
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });
  }

  // 4. Extract keys reliably
  const subJSON = subscription.toJSON();
  let p256dh = subJSON.keys?.p256dh;
  let auth = subJSON.keys?.auth;

  if (!p256dh && subscription.getKey) {
    const raw = subscription.getKey('p256dh');
    if (raw) {
      p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(raw)));
    }
  }
  if (!auth && subscription.getKey) {
    const raw = subscription.getKey('auth');
    if (raw) {
      auth = btoa(String.fromCharCode.apply(null, new Uint8Array(raw)));
    }
  }

  // Send subscription credentials to backend
  const res = await apiClient.post('/notifications/push-subscribe', {
    endpoint: subscription.endpoint,
    keys: {
      p256dh,
      auth
    },
    userAgent: navigator.userAgent
  });

  if (!res.success) {
    throw new Error(res.error || 'Failed to save push subscription on the server.');
  }

  console.log('✅ [Push Service] Successfully subscribed to Web Push:', subscription.endpoint);
  return subscription;
}

/**
 * Unsubscribes current device from Web Push notifications
 */
export async function unsubscribeFromPushNotifications() {
  if (!isPushNotificationSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Notify backend to remove subscription
      await apiClient.post('/notifications/push-unsubscribe', { endpoint });
      console.log('✅ [Push Service] Successfully unsubscribed from Web Push.');
      return true;
    }
    return false;
  } catch (err) {
    console.error('[Push Service] Unsubscribe failed:', err);
    throw err;
  }
}

/**
 * Automatically synchronizes current device's Web Push subscription with the logged-in user.
 * Invoked on login or app launch if notification permission is already granted.
 */
export async function syncPushSubscription() {
  if (!isPushNotificationSupported()) return null;
  if (getNotificationPermission() !== 'granted') return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const subJSON = subscription.toJSON();
      if (!subJSON.keys?.p256dh || !subJSON.keys?.auth) {
        try {
          await subscription.unsubscribe();
          subscription = null;
        } catch (err) {}
      }
    }

    if (!subscription) {
      const keyRes = await apiClient.get('/notifications/vapid-public-key');
      if (!keyRes.success || !keyRes.data?.publicKey) {
        return null;
      }
      const convertedVapidKey = urlBase64ToUint8Array(keyRes.data.publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
    }

    const subJSON = subscription.toJSON();
    let p256dh = subJSON.keys?.p256dh;
    let auth = subJSON.keys?.auth;

    if (!p256dh && subscription.getKey) {
      const raw = subscription.getKey('p256dh');
      if (raw) p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(raw)));
    }
    if (!auth && subscription.getKey) {
      const raw = subscription.getKey('auth');
      if (raw) auth = btoa(String.fromCharCode.apply(null, new Uint8Array(raw)));
    }

    await apiClient.post('/notifications/push-subscribe', {
      endpoint: subscription.endpoint,
      keys: { p256dh, auth },
      userAgent: navigator.userAgent
    });

    console.log('✅ [Push Service] Successfully synced Web Push subscription for current user:', subscription.endpoint);
    return subscription;
  } catch (err) {
    console.warn('[Push Service] Auto-sync push subscription notice:', err.message);
    return null;
  }
}

/**
 * Triggers a real Web Push test notification from the backend to test background delivery
 */
export async function sendTestNotification() {
  const res = await apiClient.post('/notifications/test-push');
  if (!res.success) {
    throw new Error(res.error || 'Failed to send test push notification.');
  }
  return res.data;
}

/**
 * Compiles comprehensive diagnostics about the Web Push state for debugging
 */
export async function getPushDiagnostics() {
  const supported = isPushNotificationSupported();
  const permission = getNotificationPermission();

  let swRegistered = false;
  let swScope = null;
  let activeSub = null;
  let backendStatus = null;

  if (supported) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        swRegistered = true;
        swScope = reg.scope;
        activeSub = await reg.pushManager.getSubscription();
      }
    } catch (e) {
      console.warn('[Diagnostics] SW inspection error:', e);
    }

    try {
      const statusRes = await apiClient.get('/notifications/push-status');
      if (statusRes.success) {
        backendStatus = statusRes.data;
      }
    } catch (e) {
      // Backend may be offline or auth expired
    }
  }

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;

  let platformNotes = 'Standard modern browser environment.';
  if (isIos && !isStandalone) {
    platformNotes = '⚠️ iOS/iPadOS requires adding VibeGrid to your Home Screen ("Add to Home Screen") to receive Web Push notifications.';
  } else if (isIos && isStandalone) {
    platformNotes = '✅ Running as installed iOS PWA. Web Push is supported on iOS 16.4+.';
  } else if (isStandalone) {
    platformNotes = '✅ Running as installed PWA. Web Push runs with native OS notification priority.';
  }

  return {
    supported,
    permission,
    serviceWorker: {
      registered: swRegistered,
      scope: swScope
    },
    subscription: activeSub ? {
      endpoint: activeSub.endpoint,
      endpointDomain: new URL(activeSub.endpoint).hostname,
      hasKeys: Boolean(activeSub.toJSON().keys)
    } : null,
    backendStatus,
    platform: {
      isIos,
      isStandalone,
      notes: platformNotes,
      userAgent: navigator.userAgent
    }
  };
}

export default {
  urlBase64ToUint8Array,
  isPushNotificationSupported,
  getNotificationPermission,
  getExistingSubscription,
  subscribeToPushNotifications,
  syncPushSubscription,
  unsubscribeFromPushNotifications,
  sendTestNotification,
  getPushDiagnostics
};

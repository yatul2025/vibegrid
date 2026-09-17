/**
 * client/src/services/pwaManager.js
 * =================================
 * Progressive Web App Lifecycle, Installation & Offline Sync Manager
 */

import { useState, useEffect } from 'react';

// Store deferred install prompt event globally
let deferredInstallPrompt = null;
const installListeners = new Set();
let updateAvailableListener = null;

/**
 * Register Service Worker in the browser
 */
export function registerServiceWorker(onUpdateAvailable) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Register immediately if already interactive/complete, or on load
  const doRegister = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ [PWA] Service Worker registered with scope:', registration.scope);

        // Check for updates to the service worker immediately and after 2 seconds
        try {
          registration.update();
        } catch {}

        setTimeout(() => {
          try {
            registration.update();
          } catch {}
        }, 2000);

        // Check if there is already a waiting service worker and activate immediately
        if (registration.waiting) {
          console.log('🔄 [PWA] Existing waiting worker detected — activating immediately.');
          try {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          } catch {}
          if (onUpdateAvailable) onUpdateAvailable();
          if (updateAvailableListener) updateAvailableListener();
        }

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker == null) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
              console.log('🔄 [PWA] New version deployed — activating immediately.');
              try {
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              } catch {}
              if (onUpdateAvailable) onUpdateAvailable();
              if (updateAvailableListener) updateAvailableListener();
            }
          });
        });

        // Fast update polling: check every 10 seconds so deployed updates apply quickly
        setInterval(() => {
          try {
            registration.update();
          } catch {}
        }, 10000);

        // Check for updates whenever the tab becomes visible again
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            try {
              registration.update();
            } catch {}
          }
        });
      })
      .catch((error) => {
        console.warn('⚠️ [PWA] Service Worker registration failed:', error);
      });

    // Auto-refresh when new service worker activates so users immediately get UI updates
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('⚡ [PWA] New service worker took control — refreshing application');
      if (!window.__vg_sw_reloaded) {
        window.__vg_sw_reloaded = true;
        window.location.reload();
      }
    });
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    doRegister();
  } else {
    window.addEventListener('load', doRegister);
  }

  // Listen for native beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default mini-infobar on mobile Chrome
    e.preventDefault();
    deferredInstallPrompt = e;
    installListeners.forEach((listener) => listener(true));
    console.log('📲 [PWA] App is installable — prompt captured');
  });

  // Listen for appinstalled
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installListeners.forEach((listener) => listener(false));
    console.log('🎉 [PWA] VibeGrid was successfully installed!');
  });
}

/**
 * React Hook for PWA installation, online status, and update state
 */
export function usePWA() {
  const [isInstallable, setIsInstallable] = useState(Boolean(deferredInstallPrompt));
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isStandaloneMQ = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
    return (
      Boolean(isStandaloneMQ) ||
      window.navigator.standalone === true ||
      (document.referrer && document.referrer.includes('android-app://'))
    );
  });
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof navigator === 'undefined') return false;
    return !navigator.onLine;
  });
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    // Check standalone display mode changes
    let mediaQuery;
    let handleDisplayChange;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      mediaQuery = window.matchMedia('(display-mode: standalone)');
      handleDisplayChange = (e) => setIsInstalled(e.matches);
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleDisplayChange);
      }
    }

    // Install prompt listener
    const handlePromptChange = (canInstall) => {
      setIsInstallable(canInstall && !isInstalled);
    };
    installListeners.add(handlePromptChange);

    // Online / Offline network listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update listener
    updateAvailableListener = () => setHasUpdate(true);

    // Actively check if a waiting worker is already present
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.waiting && navigator.serviceWorker.controller) {
          setHasUpdate(true);
        }
      }).catch(() => {});
    }

    return () => {
      if (mediaQuery && mediaQuery.removeEventListener && handleDisplayChange) {
        mediaQuery.removeEventListener('change', handleDisplayChange);
      }
      installListeners.delete(handlePromptChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      updateAvailableListener = null;
    };
  }, [isInstalled]);

  const promptInstall = async () => {
    if (!deferredInstallPrompt) {
      // If prompt not available (e.g. iOS Safari), return guide instructions
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIos) {
        alert('To install VibeGrid on iOS: Tap the Share button (⎋) at the bottom of Safari, then choose "Add to Home Screen" (+).');
      }
      return false;
    }

    try {
      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('👍 [PWA] User accepted the install prompt');
        setIsInstallable(false);
        deferredInstallPrompt = null;
        return true;
      } else {
        console.log('👎 [PWA] User dismissed the install prompt');
        return false;
      }
    } catch (err) {
      console.warn('Install prompt error:', err);
      return false;
    }
  };

  const applyUpdate = () => {
    forceUpdateApp();
  };

  return {
    isInstallable,
    isInstalled,
    isOffline,
    hasUpdate,
    promptInstall,
    applyUpdate
  };
}

/**
 * Hard-force purge caches, unregister service workers, and reload to guaranteed newest release
 */
export async function forceUpdateApp() {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
    }
  } catch (err) {
    console.warn('Purge error:', err);
  }
  if (typeof window !== 'undefined') {
    window.location.reload(true);
  }
}

if (typeof window !== 'undefined') {
  window.__vg_force_update = forceUpdateApp;
}

export default {
  registerServiceWorker,
  usePWA,
  forceUpdateApp
};

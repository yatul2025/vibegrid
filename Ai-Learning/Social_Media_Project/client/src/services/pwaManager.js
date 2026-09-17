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

  // Register only when window is loaded for optimal performance
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ [PWA] Service Worker registered with scope:', registration.scope);

        // Check for updates to the service worker immediately
        try {
          registration.update();
        } catch {}

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

        // Periodically check for updates every 30 seconds so app automatically updates after every deployment
        setInterval(() => {
          try {
            registration.update();
          } catch {}
        }, 30000);

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
  });

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
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        setTimeout(() => {
          window.location.reload();
        }, 200);
      }).catch(() => {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
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

export default {
  registerServiceWorker,
  usePWA
};

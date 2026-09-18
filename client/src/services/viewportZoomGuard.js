/**
 * client/src/services/viewportZoomGuard.js
 * ========================================
 * Native PWA Viewport & Anti-Zoom Guard
 *
 * Prevents unwanted page-wide pinch-to-zoom, double-tap zoom, and trackpad zoom
 * while preserving 100% of single-finger scrolling, swipe navigation, tapping,
 * typing, and interactive gestures.
 */

let isGuardInitialized = false;

/**
 * Checks whether an event target allows zoom (e.g. detailed photo viewer)
 */
function isZoomAllowed(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.closest('.allow-zoom, [data-allow-zoom="true"]'));
}

export function initViewportZoomGuard() {
  if (isGuardInitialized || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  isGuardInitialized = true;

  // 1. Intercept iOS Safari multi-finger gesture events (Pinch / Spread / Rotate)
  const preventGesture = (e) => {
    if (isZoomAllowed(e.target)) return;
    if (e.cancelable) {
      e.preventDefault();
    }
  };

  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, { passive: false });
  document.addEventListener('gestureend', preventGesture, { passive: false });

  // 2. Intercept multi-finger touchmove (Android Chrome, iPadOS, iOS fallback)
  // Only blocks when 2 or more fingers are active (pinch/spread).
  // Single-finger scrolling (e.touches.length === 1) is completely untouched!
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches && e.touches.length > 1) {
        if (isZoomAllowed(e.target)) return;
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    },
    { passive: false }
  );

  // 3. Prevent rapid double-tap to zoom on iOS
  // Preserves taps on inputs, textareas, selects, and buttons
  let lastTouchEndTime = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      const timeSinceLastTouch = now - lastTouchEndTime;

      if (timeSinceLastTouch <= 300 && timeSinceLastTouch > 0) {
        const target = e.target;
        const tagName = target?.tagName;

        // Allow rapid taps inside form fields
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
          lastTouchEndTime = now;
          return;
        }

        if (isZoomAllowed(target)) {
          lastTouchEndTime = now;
          return;
        }

        // Prevent iOS double-tap viewport zoom
        if (e.cancelable) {
          e.preventDefault();
        }
      }
      lastTouchEndTime = now;
    },
    { passive: false }
  );

  // 4. Intercept desktop trackpad pinch-to-zoom (wheel event with ctrlKey)
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) {
        if (isZoomAllowed(e.target)) return;
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    },
    { passive: false }
  );

  // 5. Monitor visualViewport scale drift and restore 1:1 if needed
  if (window.visualViewport) {
    const handleViewportChange = () => {
      try {
        const scale = window.visualViewport.scale;
        if (typeof scale === 'number' && Math.abs(scale - 1.0) > 0.05) {
          // Viewport scaled beyond 1:1, scroll into standard alignment
          document.documentElement.style.setProperty('--vg-viewport-scale', String(scale));
        } else {
          document.documentElement.style.setProperty('--vg-viewport-scale', '1');
        }
      } catch {}
    };

    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
  }
}

export default {
  initViewportZoomGuard,
  isZoomAllowed
};

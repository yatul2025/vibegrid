/**
 * client/src/services/navigationService.js
 * =========================================
 * VibeGrid Global Navigation & History Service
 * 
 * Central coordinator for all PWA navigation, history states,
 * nested modal/drawer interceptors, and unified back actions.
 */

class NavigationService {
  constructor() {
    // LIFO stack of back interceptors: [{ id, priority, handler }]
    this.interceptors = [];

    // Internal route stack to track navigation depth independently of browser history
    this.historyStack = [];

    // Scroll position cache by screen key: { 'feed': 450, 'explore': 120 }
    this.scrollCache = new Map();

    // Primary route listener registered by App.jsx
    this.routeListener = null;

    // Flag to suppress duplicate handling during programmatic history.back()
    this.isProgrammaticBack = false;
  }

  /**
   * Register a LIFO back-press interceptor (for modals, drawers, subviews, chat views).
   * Priority: higher priority handlers are queried first. Default priority = 10.
   * @param {string} id - Unique identifier for the interceptor
   * @param {Function} handler - () => boolean (returns true if handled, false to delegate)
   * @param {number} priority - Execution order priority
   * @returns {Function} cleanup function to unregister
   */
  registerBackInterceptor(id, handler, priority = 10) {
    // Remove any existing entry with same id
    this.interceptors = this.interceptors.filter((i) => i.id !== id);
    this.interceptors.push({ id, handler, priority, timestamp: Date.now() });
    
    // Sort descending by priority, then descending by timestamp (newest first)
    this.interceptors.sort((a, b) => b.priority - a.priority || b.timestamp - a.timestamp);

    return () => this.unregisterBackInterceptor(id);
  }

  unregisterBackInterceptor(id) {
    this.interceptors = this.interceptors.filter((i) => i.id !== id);
  }

  /**
   * Set primary route listener (called by App.jsx to receive popstate tab transitions)
   */
  setRouteListener(listener) {
    this.routeListener = listener;
  }

  /**
   * Programmatically navigate to a tab and optional section
   */
  navigate(tab, options = {}) {
    if (this.routeListener) {
      this.routeListener({ tab, ...options });
    }
  }

  /**
   * Check if any active modal, drawer, or nested subview intercepts back.
   * Runs handlers in order of highest priority / most recently registered.
   * @returns {boolean} true if an interceptor consumed the back event
   */
  dispatchBackInterceptors(event = null) {
    for (const item of this.interceptors) {
      try {
        if (item.handler && item.handler(event)) {
          return true;
        }
      } catch (err) {
        console.error(`[NavigationService] Interceptor '${item.id}' threw error:`, err);
      }
    }
    return false;
  }

  /**
   * Unified in-app Back action.
   * Works identically whether triggered from in-app back arrow, browser back button,
   * or Android hardware/gesture back.
   * 
   * @param {Function} fallbackAction - Safe fallback when no history exists
   */
  goBack(fallbackAction = null) {
    // 1. First, check if any active child/modal/drawer interceptor can handle it locally
    if (this.dispatchBackInterceptors({ source: 'in_app_back' })) {
      return;
    }

    // 2. Check if we have browser history to pop
    const hasBrowserHistory = typeof window !== 'undefined' && 
      window.history && 
      (window.history.length > 1 || (window.history.state && !window.history.state.root));

    if (hasBrowserHistory) {
      try {
        this.isProgrammaticBack = true;
        window.history.back();
        setTimeout(() => {
          this.isProgrammaticBack = false;
        }, 300);
        return;
      } catch (err) {
        console.warn('[NavigationService] window.history.back() failed, falling back:', err);
      }
    }

    // 3. If no browser history or history.back() failed, use the safe contextual fallback
    if (typeof fallbackAction === 'function') {
      fallbackAction();
    } else if (this.routeListener) {
      // Safe default fallback: go to feed
      this.routeListener({ tab: 'feed', fallback: true });
    }
  }

  /**
   * Handle popstate events globally. Called by the single App.jsx popstate listener.
   */
  handlePopState(event) {
    // 1. Let child interceptors consume first (e.g. subviews, modals, drawers)
    if (this.dispatchBackInterceptors(event)) {
      return true;
    }

    // 2. Otherwise, delegate to primary route listener
    if (this.routeListener) {
      this.routeListener(event.state || null, event);
      return true;
    }

    return false;
  }

  /**
   * Cache scroll position for a given view/key
   */
  saveScroll(key, y) {
    if (key) {
      this.scrollCache.set(key, y);
    }
  }

  /**
   * Retrieve cached scroll position
   */
  getScroll(key) {
    return this.scrollCache.get(key) || 0;
  }
}

const navigationService = new NavigationService();
export default navigationService;

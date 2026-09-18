import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import navigationService from '../services/navigationService';

describe('VibeGrid Global Back Navigation Suite', () => {
  beforeEach(() => {
    // Reset interceptor stack and caches
    navigationService.interceptors = [];
    navigationService.routeListener = null;
    navigationService.scrollCache.clear();
    navigationService.historyStack = [];
  });

  describe('1. NavigationService Interceptor Registry (LIFO & Priority)', () => {
    it('registers and unregisters back interceptors cleanly', () => {
      const handler = vi.fn(() => true);
      const unregister = navigationService.registerBackInterceptor('test_modal', handler, 20);

      expect(navigationService.interceptors.length).toBe(1);
      expect(navigationService.interceptors[0].id).toBe('test_modal');
      expect(navigationService.interceptors[0].priority).toBe(20);

      unregister();
      expect(navigationService.interceptors.length).toBe(0);
    });

    it('executes higher priority interceptors first', () => {
      const callOrder = [];
      const handlerLow = vi.fn(() => {
        callOrder.push('low');
        return true;
      });
      const handlerHigh = vi.fn(() => {
        callOrder.push('high');
        return true;
      });

      navigationService.registerBackInterceptor('low', handlerLow, 10);
      navigationService.registerBackInterceptor('high', handlerHigh, 25);

      const handled = navigationService.dispatchBackInterceptors({ type: 'popstate' });
      expect(handled).toBe(true);
      expect(callOrder).toEqual(['high']);
      expect(handlerHigh).toHaveBeenCalledTimes(1);
      expect(handlerLow).not.toHaveBeenCalled();
    });

    it('cascades to lower priority interceptor if high priority returns false', () => {
      const callOrder = [];
      const handlerHigh = vi.fn(() => {
        callOrder.push('high');
        return false; // did not consume event
      });
      const handlerLow = vi.fn(() => {
        callOrder.push('low');
        return true; // consumed event
      });

      navigationService.registerBackInterceptor('low', handlerLow, 10);
      navigationService.registerBackInterceptor('high', handlerHigh, 25);

      const handled = navigationService.dispatchBackInterceptors({ type: 'popstate' });
      expect(handled).toBe(true);
      expect(callOrder).toEqual(['high', 'low']);
      expect(handlerHigh).toHaveBeenCalledTimes(1);
      expect(handlerLow).toHaveBeenCalledTimes(1);
    });

    it('returns false when no interceptor handles the event', () => {
      navigationService.registerBackInterceptor('idle', () => false, 10);
      const handled = navigationService.dispatchBackInterceptors({ type: 'popstate' });
      expect(handled).toBe(false);
    });
  });

  describe('2. Unified goBack Dispatching', () => {
    it('dispatches to active interceptor before history fallback', () => {
      const handler = vi.fn(() => true);
      navigationService.registerBackInterceptor('active_modal', handler, 20);

      const fallback = vi.fn();
      navigationService.goBack(fallback);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(fallback).not.toHaveBeenCalled();
    });

    it('invokes contextual fallback when no interceptor is registered and history is shallow', () => {
      const fallback = vi.fn();
      navigationService.goBack(fallback);

      expect(fallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. PopState Coordination & Safe Route Restoration', () => {
    it('intercepts popstate and prevents route listener when interceptor consumes it', () => {
      const routeListener = vi.fn();
      navigationService.setRouteListener(routeListener);

      const modalHandler = vi.fn(() => true);
      navigationService.registerBackInterceptor('comment_modal', modalHandler, 25);

      const event = { state: { tab: 'feed' }, preventDefault: vi.fn() };
      navigationService.handlePopState(event);

      expect(modalHandler).toHaveBeenCalledTimes(1);
      expect(routeListener).not.toHaveBeenCalled();
    });

    it('forwards popstate to route listener when no interceptor consumes it', () => {
      const routeListener = vi.fn();
      navigationService.setRouteListener(routeListener);

      const event = { state: { tab: 'explore' } };
      navigationService.handlePopState(event);

      expect(routeListener).toHaveBeenCalledWith(event.state, event);
    });
  });

  describe('4. Scroll Position Cache Per Route', () => {
    it('saves and retrieves scroll positions accurately', () => {
      navigationService.saveScroll('feed', 420);
      navigationService.saveScroll('profile_atulyadav', 1050);

      expect(navigationService.getScroll('feed')).toBe(420);
      expect(navigationService.getScroll('profile_atulyadav')).toBe(1050);
      expect(navigationService.getScroll('unknown_tab')).toBe(0);
    });
  });
});

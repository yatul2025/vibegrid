import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initViewportZoomGuard } from '../services/viewportZoomGuard';

describe('Native PWA Viewport & Anti-Zoom Guard Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes and registers event listeners without errors', () => {
    expect(() => initViewportZoomGuard()).not.toThrow();
  });

  it('intercepts multi-finger gesturestart and prevents default', () => {
    initViewportZoomGuard();

    const event = new CustomEvent('gesturestart', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    document.dispatchEvent(event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('intercepts multi-finger touchmove when e.touches.length > 1', () => {
    initViewportZoomGuard();

    const touchMoveEvent = new CustomEvent('touchmove', { cancelable: true });
    Object.defineProperty(touchMoveEvent, 'touches', {
      value: [{ clientX: 10, clientY: 10 }, { clientX: 50, clientY: 50 }],
      writable: false
    });

    const preventDefaultSpy = vi.spyOn(touchMoveEvent, 'preventDefault');
    document.dispatchEvent(touchMoveEvent);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('does NOT intercept single-finger touchmove (preserves normal scrolling)', () => {
    initViewportZoomGuard();

    const singleTouchEvent = new CustomEvent('touchmove', { cancelable: true });
    Object.defineProperty(singleTouchEvent, 'touches', {
      value: [{ clientX: 10, clientY: 10 }],
      writable: false
    });

    const preventDefaultSpy = vi.spyOn(singleTouchEvent, 'preventDefault');
    document.dispatchEvent(singleTouchEvent);
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('intercepts ctrlKey wheel event (desktop trackpad pinch zoom)', () => {
    initViewportZoomGuard();

    const wheelEvent = new WheelEvent('wheel', {
      ctrlKey: true,
      cancelable: true
    });
    const preventDefaultSpy = vi.spyOn(wheelEvent, 'preventDefault');

    window.dispatchEvent(wheelEvent);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('does NOT intercept regular mouse wheel events (preserves mouse scrolling)', () => {
    initViewportZoomGuard();

    const normalWheelEvent = new WheelEvent('wheel', {
      ctrlKey: false,
      cancelable: true
    });
    const preventDefaultSpy = vi.spyOn(normalWheelEvent, 'preventDefault');

    window.dispatchEvent(normalWheelEvent);
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });
});

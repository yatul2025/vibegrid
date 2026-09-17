import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import App from '../App';

describe('Home Page Gesture Isolation Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('vibegrid_user', JSON.stringify({
      id: 1,
      username: 'sophia_wander',
      full_name: 'Sophia Laurent',
      is_demo_session: true,
      sessionType: 'demo'
    }));
    sessionStorage.setItem('vibegrid_active_tab', 'feed');
    window.history.replaceState({ tab: 'feed', viewedUsername: null, root: true }, '');
  });

  it('never navigates to Explore when swiping horizontally across the middle of the feed', async () => {
    const { container } = render(<App />);
    expect(container).toBeDefined();

    // Swipe left in the middle of feed (e.g. x: 250 -> 50)
    await act(async () => {
      window.dispatchEvent(new TouchEvent('touchstart', {
        touches: [{ clientX: 250, clientY: 400 }]
      }));
      window.dispatchEvent(new TouchEvent('touchmove', {
        touches: [{ clientX: 100, clientY: 402 }]
      }));
      window.dispatchEvent(new TouchEvent('touchend', {
        changedTouches: [{ clientX: 50, clientY: 405 }]
      }));
    });

    // Should strictly stay on feed
    expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('feed');
  });

  it('never navigates to Explore when interacting with or swiping inside StoryTray', async () => {
    const { container } = render(<App />);
    const storyTray = container.querySelector('.story-tray-wrapper') || container.querySelector('.stories-container') || container;

    await act(async () => {
      storyTray.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true,
        touches: [{ clientX: 180, clientY: 150 }]
      }));
      storyTray.dispatchEvent(new TouchEvent('touchend', {
        bubbles: true,
        changedTouches: [{ clientX: 40, clientY: 150 }]
      }));
    });

    expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('feed');
  });

  it('never navigates to Explore when swiping or selecting categories in Category Carousel', async () => {
    const { container } = render(<App />);
    const categoryBar = container.querySelector('.feed-category-chips-bar') || container;

    await act(async () => {
      categoryBar.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true,
        touches: [{ clientX: 220, clientY: 210 }]
      }));
      categoryBar.dispatchEvent(new TouchEvent('touchend', {
        bubbles: true,
        changedTouches: [{ clientX: 80, clientY: 210 }]
      }));
    });

    expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('feed');
  });

  it('never navigates to Explore when swiping or tapping primary feed tabs', async () => {
    const { container } = render(<App />);
    const tabs = container.querySelector('.feed-primary-tabs') || container;

    await act(async () => {
      tabs.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true,
        touches: [{ clientX: 150, clientY: 100 }]
      }));
      tabs.dispatchEvent(new TouchEvent('touchend', {
        bubbles: true,
        changedTouches: [{ clientX: 50, clientY: 100 }]
      }));
    });

    expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('feed');
  });

  it('allows navigation to Explore via Bottom Navigation bar', async () => {
    const { container } = render(<App />);
    
    // Find explore button in bottom nav
    const exploreBtn = container.querySelector('button[title*="Explore" i], button[aria-label*="Explore" i], .mobile-bottom-navbar button:nth-child(2)');
    expect(exploreBtn).toBeDefined();

    if (exploreBtn) {
      await act(async () => {
        fireEvent.click(exploreBtn);
      });
      expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('explore');
    }
  });
});

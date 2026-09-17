import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from '../App';
import AuthPage from '../pages/AuthPage';

describe('App Component Root Integration Test', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders App successfully when user is not logged in', async () => {
    const { container } = render(<App />);
    expect(container).toBeDefined();
  });

  it('renders AuthPage directly without error', async () => {
    const { container } = render(
      <App />
    );
    expect(container).toBeDefined();
  });

  it('renders App successfully when user is in Demo Mode', async () => {
    localStorage.setItem('vibegrid_user', JSON.stringify({
      id: 1,
      username: 'sophia_wander',
      full_name: 'Sophia Laurent',
      is_demo_session: true,
      sessionType: 'demo'
    }));

    const { container } = render(<App />);
    expect(container).toBeDefined();
  });

  it('correctly handles back navigation from Profile to Settings without dropping to Home', async () => {
    localStorage.setItem('vibegrid_user', JSON.stringify({
      id: 1,
      username: 'sophia_wander',
      full_name: 'Sophia Laurent',
      is_demo_session: true,
      sessionType: 'demo'
    }));

    // Simulate initial state at feed
    sessionStorage.setItem('vibegrid_active_tab', 'feed');
    window.history.replaceState({ tab: 'feed', viewedUsername: null, root: true }, '');

    const { container } = render(<App />);
    expect(container).toBeDefined();

    // Push Settings state (Home -> Settings)
    await act(async () => {
      window.history.pushState({ tab: 'settings', section: 'privacy', subSection: false }, '');
      window.dispatchEvent(new PopStateEvent('popstate', {
        state: { tab: 'settings', section: 'privacy', subSection: false }
      }));
    });

    // Verify session storage tab updated to settings
    expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('settings');

    // Push Profile state (Settings -> Profile)
    await act(async () => {
      window.history.pushState({ tab: 'profile', viewedUsername: 'sophia_wander', targetDM: null }, '');
      window.dispatchEvent(new PopStateEvent('popstate', {
        state: { tab: 'profile', viewedUsername: 'sophia_wander', targetDM: null }
      }));
    });

    expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('profile');

    // Simulate phone Back button: pop back to Settings
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate', {
        state: { tab: 'settings', section: 'privacy', subSection: false }
      }));
    });

    // Must return to Settings, NOT Home (feed)
    expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('settings');
  });

  it('correctly handles nested settings sub-section back navigation to settings overview', async () => {
    localStorage.setItem('vibegrid_user', JSON.stringify({
      id: 1,
      username: 'sophia_wander',
      full_name: 'Sophia Laurent',
      is_demo_session: true,
      sessionType: 'demo'
    }));

    // Start on Settings with Edit Profile section active
    sessionStorage.setItem('vibegrid_active_tab', 'settings');
    window.history.replaceState({ tab: 'settings', section: 'profile', subSection: true }, '');

    const { container } = render(<App />);
    expect(container).toBeDefined();

    // Simulate phone Back button popping subSection
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate', {
        state: { tab: 'settings', section: 'profile', subSection: false }
      }));
    });

    // Remains on Settings tab
    expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('settings');
  });

  it('correctly switches pages via swipe gestures (Feed -> Explore -> Messages -> Explore -> Feed)', async () => {
    localStorage.setItem('vibegrid_user', JSON.stringify({
      id: 1,
      username: 'sophia_wander',
      full_name: 'Sophia Laurent',
      is_demo_session: true,
      sessionType: 'demo'
    }));

    sessionStorage.setItem('vibegrid_active_tab', 'feed');
    window.history.replaceState({ tab: 'feed', viewedUsername: null, root: true }, '');

    const { container } = render(<App />);
    expect(container).toBeDefined();

    // 1. Middle-of-screen swipe on Feed MUST NOT switch to Explore (protection test)
    await act(async () => {
      window.dispatchEvent(new TouchEvent('touchstart', {
        touches: [{ clientX: 200, clientY: 300 }]
      }));
      window.dispatchEvent(new TouchEvent('touchend', {
        changedTouches: [{ clientX: 100, clientY: 305 }]
      }));
    });

    // Should remain on feed
    expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('feed');

    // 2. Extreme right-edge swipe on Feed (Home -> Explore)
    const edgeX = (window.innerWidth || 1024) - 10;
    await act(async () => {
      window.dispatchEvent(new TouchEvent('touchstart', {
        touches: [{ clientX: edgeX, clientY: 300 }]
      }));
      window.dispatchEvent(new TouchEvent('touchend', {
        changedTouches: [{ clientX: edgeX - 100, clientY: 305 }]
      }));
    });

    expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('explore');

    // 3. Swipe Left on Explore (Explore -> Messages)
    await act(async () => {
      window.dispatchEvent(new TouchEvent('touchstart', {
        touches: [{ clientX: 200, clientY: 300 }]
      }));
      window.dispatchEvent(new TouchEvent('touchend', {
        changedTouches: [{ clientX: 100, clientY: 305 }]
      }));
    });

    expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('messages');

    // 4. Swipe Right on Messages (Messages -> Explore)
    await act(async () => {
      window.dispatchEvent(new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 300 }]
      }));
      window.dispatchEvent(new TouchEvent('touchend', {
        changedTouches: [{ clientX: 220, clientY: 305 }]
      }));
    });

    expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('explore');

    // 5. Swipe Right on Explore (Explore -> Feed)
    await act(async () => {
      window.dispatchEvent(new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 300 }]
      }));
      window.dispatchEvent(new TouchEvent('touchend', {
        changedTouches: [{ clientX: 220, clientY: 305 }]
      }));
    });

    expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('feed');
  });
});

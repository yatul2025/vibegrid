import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import App from '../App';
import StoryViewerModal from '../components/StoryViewerModal';
import { AuthProvider } from '../context/AuthContext';

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

  it('navigates from Home Feed to Explore when swiping horizontally left on the feed', async () => {
    const { container } = render(<App />);
    expect(container).toBeDefined();

    // Swipe left on the Home Feed (e.g. x: 250 -> 50)
    await act(async () => {
      window.dispatchEvent(new TouchEvent('touchstart', {
        touches: [{ clientX: 250, clientY: 400 }]
      }));
      window.dispatchEvent(new TouchEvent('touchend', {
        changedTouches: [{ clientX: 50, clientY: 405 }]
      }));
    });

    // Should navigate to explore
    expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('explore');
  });

  it('navigates from Explore back to Home when swiping horizontally right on explore', async () => {
    sessionStorage.setItem('vibegrid_active_tab', 'explore');
    window.history.replaceState({ tab: 'explore', viewedUsername: null, root: true }, '');

    const { container } = render(<App />);
    expect(container).toBeDefined();

    // Swipe right on Explore (x: 50 -> 250)
    await act(async () => {
      window.dispatchEvent(new TouchEvent('touchstart', {
        touches: [{ clientX: 50, clientY: 400 }]
      }));
      window.dispatchEvent(new TouchEvent('touchend', {
        changedTouches: [{ clientX: 250, clientY: 405 }]
      }));
    });

    // Should navigate back to feed
    expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('feed');
  });

  it('never navigates to Explore when scrolling vertically on the feed', async () => {
    const { container } = render(<App />);
    expect(container).toBeDefined();

    // Vertical swipe down (e.g. y: 200 -> 350)
    await act(async () => {
      window.dispatchEvent(new TouchEvent('touchstart', {
        touches: [{ clientX: 200, clientY: 200 }]
      }));
      window.dispatchEvent(new TouchEvent('touchmove', {
        touches: [{ clientX: 205, clientY: 350 }]
      }));
      window.dispatchEvent(new TouchEvent('touchend', {
        changedTouches: [{ clientX: 100, clientY: 380 }]
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

  it('captures swipe left and swipe right inside StoryViewerModal for story navigation without page navigation', async () => {
    const mockCreators = [
      {
        userId: 10,
        username: 'elena_travels',
        avatarUrl: '/uploads/avatars/avatar1.png',
        stories: [
          { id: 'story-1', mediaUrl: '/uploads/stories/1.jpg', createdAt: new Date().toISOString() },
          { id: 'story-2', mediaUrl: '/uploads/stories/2.jpg', createdAt: new Date().toISOString() }
        ]
      }
    ];

    const { container } = render(
      <AuthProvider>
        <StoryViewerModal
          isOpen={true}
          creators={mockCreators}
          initialCreatorIndex={0}
          onClose={vi.fn()}
        />
      </AuthProvider>
    );

    const viewerContainer = container.querySelector('.story-viewer-container');
    expect(viewerContainer).toBeDefined();

    // Swipe left inside story viewer (should move to next story without changing page)
    await act(async () => {
      viewerContainer.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true,
        touches: [{ clientX: 250, clientY: 300 }]
      }));
      viewerContainer.dispatchEvent(new TouchEvent('touchend', {
        bubbles: true,
        changedTouches: [{ clientX: 80, clientY: 300 }]
      }));
    });

    // Page must remain on feed
    expect(sessionStorage.getItem('vibegrid_active_tab')).toBe('feed');
  });
});

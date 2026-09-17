import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider } from '../context/AuthContext';
import App from '../App';
import FeedPage from '../pages/FeedPage';
import SettingsPage from '../pages/SettingsPage';
import soundFx from '../services/soundFxService';
import apiClient from '../api/client';

// Mock apiClient
vi.mock('../api/client', () => {
  return {
    default: {
      get: vi.fn(),
      post: vi.fn(() => Promise.resolve({ success: true })),
      delete: vi.fn(() => Promise.resolve({ success: true }))
    }
  };
});

// Mock socketService
vi.mock('../services/socketService', () => {
  return {
    default: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      isConnected: vi.fn(() => true)
    }
  };
});

describe('Phase 11: Grand Finale Polish & Micro-Interactions Suite', () => {
  const mockPost = {
    id: 101,
    user_id: 2,
    username: 'alex_vibe',
    full_name: 'Alex Vibe',
    caption: 'Testing Grand Finale Phase 11 #vibegrid',
    image_url: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131',
    likes_count: 5,
    comments_count: 2,
    is_liked: false,
    is_saved: false,
    created_at: new Date().toISOString()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();

    apiClient.get.mockImplementation((url) => {
      if (url.includes('/feed/stories')) {
        return Promise.resolve({ success: true, data: { creators: [] } });
      }
      if (url.includes('/feed')) {
        return Promise.resolve({
          success: true,
          data: { posts: [mockPost] }
        });
      }
      return Promise.resolve({ success: true, data: {} });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers double-tap heart burst overlay and soundFx.playPluck on post photo double-click', async () => {
    const pluckSpy = vi.spyOn(soundFx, 'playPluck').mockImplementation(() => {});

    render(
      <AuthProvider>
        <FeedPage />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByAltText(/Testing Grand Finale Phase 11/i)).toBeInTheDocument();
    });

    const postImg = screen.getByAltText(/Testing Grand Finale Phase 11/i);
    const mediaContainer = postImg.closest('.post-card-media');
    expect(mediaContainer).not.toBeNull();

    // Double click media container
    act(() => {
      fireEvent.doubleClick(mediaContainer);
    });

    // Check that double-tap burst overlay is rendered with 4 particles
    const burst = screen.getByTestId('double-tap-heart-burst');
    expect(burst).toBeInTheDocument();
    expect(burst.querySelectorAll('.heart-burst-particle').length).toBe(4);

    // Verify soundFx.playPluck was called
    expect(pluckSpy).toHaveBeenCalled();
  });

  it('supports mobile touch double-tap via rapid onTouchEnd events', async () => {
    const pluckSpy = vi.spyOn(soundFx, 'playPluck').mockImplementation(() => {});

    render(
      <AuthProvider>
        <FeedPage />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByAltText(/Testing Grand Finale Phase 11/i)).toBeInTheDocument();
    });

    const postImg = screen.getByAltText(/Testing Grand Finale Phase 11/i);
    const mediaContainer = postImg.closest('.post-card-media');

    // Rapid double-touch on mobile (<380ms)
    act(() => {
      fireEvent.touchEnd(mediaContainer);
      fireEvent.touchEnd(mediaContainer);
    });

    // Verify double-tap burst appeared
    expect(screen.getByTestId('double-tap-heart-burst')).toBeInTheDocument();
    expect(pluckSpy).toHaveBeenCalled();
  });

  it('renders Vibi Mascot Easter Egg card in Settings Appearance section with summon button', () => {
    localStorage.setItem(
      'vibegrid_user',
      JSON.stringify({ id: 1, username: 'tester', full_name: 'Test User' })
    );

    render(
      <AuthProvider>
        <SettingsPage initialSection="appearance" currentTheme="dark" />
      </AuthProvider>
    );

    const eggCard = screen.getByTestId('vibi-easter-egg-card');
    expect(eggCard).toBeInTheDocument();

    const summonBtn = screen.getByTestId('summon-vibi-easter-egg-btn');
    expect(summonBtn).toBeInTheDocument();

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    act(() => {
      fireEvent.click(summonBtn);
    });

    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('triggers Vibi Easter Egg when key sequence "v-i-b-i" or custom event is fired', async () => {
    localStorage.setItem(
      'vibegrid_user',
      JSON.stringify({ id: 1, username: 'tester', full_name: 'Test User' })
    );

    const celebSpy = vi.spyOn(soundFx, 'playCelebration').mockImplementation(() => {});

    render(<App />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
    });

    // Verify celebration sound was played
    expect(celebSpy).toHaveBeenCalled();

    // Verify Vibi secret greeting message appears
    await waitFor(() => {
      expect(
        screen.getByText(/You unlocked the Secret Vibe Sparkle! You're an official Vibe Legend!/i)
      ).toBeInTheDocument();
    });

    // Verify a11y announcement
    const liveRegion = document.getElementById('a11y-live-region');
    expect(liveRegion.textContent).toContain('Secret Vibe Sparkle unlocked!');
  });
});

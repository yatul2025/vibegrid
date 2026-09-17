import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfilePage from '../pages/ProfilePage';
import apiClient from '../api/client';

const mockUser = {
  id: 'usr_1',
  username: 'alex_creator',
  full_name: 'Alex Creator',
  bio: 'Design & Code Enthusiast ✨',
  location: 'San Francisco, CA',
  website: 'vibegrid.app',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  is_email_verified: true,
  email: 'alex@vibegrid.app',
  created_at: '2025-01-01T00:00:00.000Z'
};

const mockStats = { posts: 1, followers: 1250, following: 320 };

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    updateUser: vi.fn(),
    logout: vi.fn(),
    guardDemoAction: vi.fn().mockReturnValue(false)
  })
}));

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

describe('Profile & Settings Delight Suite (Phase 8 Option 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    apiClient.get.mockImplementation((url) => {
      if (url.includes('/users/alex_creator')) {
        return Promise.resolve({
          success: true,
          data: {
            profile: mockUser,
            stats: mockStats,
            isOwnProfile: true,
            isFollowing: false
          }
        });
      }
      if (url.includes('/posts/user/')) {
        return Promise.resolve({
          success: true,
          data: { posts: [{ id: 1, image_url: 'test.jpg' }] }
        });
      }
      if (url.includes('/posts/saved')) {
        return Promise.resolve({
          success: true,
          data: { posts: [{ id: 2, image_url: 'saved.jpg' }] }
        });
      }
      return Promise.resolve({ success: true, data: {} });
    });
  });

  it('triggers jelly stat bounce animation and haptics on stat clicks', async () => {
    const vibrateMock = vi.fn();
    navigator.vibrate = vibrateMock;

    render(<ProfilePage targetUsername="alex_creator" />);

    const followersStat = await screen.findByTitle('View followers');
    expect(followersStat).toBeInTheDocument();

    fireEvent.click(followersStat);
    expect(followersStat).toHaveClass('bump');
    expect(vibrateMock).toHaveBeenCalledWith([10, 25]);
  });

  it('provides 1-tap quick copy with haptics on location chip click', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    });
    const vibrateMock = vi.fn();
    navigator.vibrate = vibrateMock;

    render(<ProfilePage targetUsername="alex_creator" />);

    const locChip = await screen.findByText('San Francisco, CA');
    expect(locChip).toBeInTheDocument();

    const chipWrapper = locChip.closest('.profile-info-pill');
    expect(chipWrapper).toBeInTheDocument();

    fireEvent.click(chipWrapper);
    expect(writeTextMock).toHaveBeenCalledWith('San Francisco, CA');
    expect(vibrateMock).toHaveBeenCalledWith(18);
  });

  it('supports sliding tab items with haptic tick and ARIA attributes', async () => {
    const vibrateMock = vi.fn();
    navigator.vibrate = vibrateMock;

    render(<ProfilePage targetUsername="alex_creator" />);

    const postsTab = await screen.findByText('POSTS');
    expect(postsTab).toBeInTheDocument();
    const postsButton = postsTab.closest('button');
    expect(postsButton).toHaveAttribute('role', 'tab');
    expect(postsButton).toHaveAttribute('aria-selected', 'true');

    const savedTab = await screen.findByText('SAVED');
    expect(savedTab).toBeInTheDocument();
    const savedButton = savedTab.closest('button');
    expect(savedButton).toHaveAttribute('role', 'tab');
    expect(savedButton).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(savedButton);
    expect(savedButton).toHaveAttribute('aria-selected', 'true');
    expect(vibrateMock).toHaveBeenCalledWith(12);
  });
});

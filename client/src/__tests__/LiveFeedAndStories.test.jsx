import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StoryTray from '../components/StoryTray';
import StoryViewerModal from '../components/StoryViewerModal';
import FeedPage from '../pages/FeedPage';
import apiClient from '../api/client';

// Mock useAuth
const mockGuardDemoAction = vi.fn().mockReturnValue(false);
const mockUser = {
  id: 1,
  username: 'sophia_wander',
  full_name: 'Sophia Chen',
  avatar_url: '/uploads/avatars/sophia.jpg'
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isDemo: false,
    guardDemoAction: mockGuardDemoAction
  })
}));

// Mock apiClient
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn()
  }
}));

describe('Live Feed & Ephemeral Stories Components Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 1. StoryTray Tests
  // ==========================================================================
  describe('StoryTray', () => {
    const mockCreators = [
      {
        userId: 1,
        username: 'sophia_wander',
        avatarUrl: '/uploads/avatars/sophia.jpg',
        isExternal: false,
        stories: [{ id: 10, mediaUrl: '/uploads/stories/s1.jpg' }]
      },
      {
        userId: 'ext_alex',
        username: 'alex_design',
        avatarUrl: 'https://images.unsplash.com/alex.jpg',
        isExternal: true,
        source: 'Unsplash',
        stories: [{ id: 'ext_s1', mediaUrl: 'https://images.unsplash.com/story1.jpg', isExternal: true }]
      }
    ];

    it('renders story circles and discovery badge for external stories', () => {
      render(
        <StoryTray
          creators={mockCreators}
          loading={false}
          viewedCreatorIds={new Set()}
          closeFriendIds={new Set()}
          onOpenViewer={vi.fn()}
          onOpenCreateStory={vi.fn()}
        />
      );

      // Current user story label
      expect(screen.getByText('Your Story')).toBeDefined();

      // External creator story label
      expect(screen.getByTitle('alex_design')).toBeDefined();

      // Check for discovery badge 🌐
      const discoveryBadge = screen.getByTitle('Discovery Story');
      expect(discoveryBadge).toBeDefined();
      expect(discoveryBadge.textContent).toBe('🌐');
    });
  });

  // ==========================================================================
  // 2. StoryViewerModal Tests
  // ==========================================================================
  describe('StoryViewerModal', () => {
    const mockCreators = [
      {
        userId: 'ext_creator_1',
        username: 'travel_lens',
        avatarUrl: 'https://images.unsplash.com/avatar.jpg',
        isExternal: true,
        source: 'Unsplash',
        stories: [
          {
            id: 'ext_story_1',
            mediaUrl: 'https://images.unsplash.com/photo.jpg',
            createdAt: new Date().toISOString(),
            isExternal: true,
            source: 'Unsplash'
          }
        ]
      }
    ];

    it('shows external source badge and prevents DM replies to discovery stories', async () => {
      render(
        <StoryViewerModal
          isOpen={true}
          creators={mockCreators}
          initialCreatorIndex={0}
          closeFriendIds={new Set()}
          onClose={vi.fn()}
        />
      );

      // Verify source pill
      expect(screen.getByText(/Via Unsplash/i)).toBeDefined();

      // Try typing and sending a reply
      const replyInput = screen.getByPlaceholderText(/Send message/i);
      expect(replyInput).toBeDefined();

      fireEvent.change(replyInput, { target: { value: 'Awesome discovery photo!' } });
      const sendBtn = screen.getByTitle('Send reply');
      fireEvent.click(sendBtn);

      // Verify notification toast indicates replies are disabled for discovery stories
      await waitFor(() => {
        expect(screen.getByText(/Direct replies are unavailable for discovery stories/i)).toBeDefined();
      });

      // apiClient.post(/messages/...) should NOT have been called
      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 3. FeedPage Tests (Live Feed, Source Attribution, & Delta Polling)
  // ==========================================================================
  describe('FeedPage', () => {
    const mockPosts = [
      {
        id: 1,
        user_id: 1,
        username: 'sophia_wander',
        full_name: 'Sophia Chen',
        avatar_url: '/uploads/avatars/sophia.jpg',
        caption: 'Sunny day in Santorini!',
        image_url: '/uploads/posts/santorini.jpg',
        created_at: new Date('2026-09-14T02:00:00Z').toISOString(),
        likes_count: 10,
        comments_count: 2,
        is_liked: false,
        is_saved: false,
        is_external: false
      },
      {
        id: 'ext_photo_1',
        user_id: null,
        username: 'nordic_landscapes',
        full_name: 'Nordic Explorer',
        avatar_url: 'https://images.unsplash.com/avatar_nordic.jpg',
        caption: 'Glacier lagoon reflections 🧊',
        image_url: 'https://images.unsplash.com/glacier.jpg',
        source_url: 'https://unsplash.com/photos/glacier',
        created_at: new Date('2026-09-14T01:30:00Z').toISOString(),
        likes_count: 42,
        comments_count: 6,
        is_liked: false,
        is_saved: false,
        is_external: true,
        source: 'Unsplash'
      }
    ];

    it('loads live feed and renders external attribution badge on external posts', async () => {
      apiClient.get.mockImplementation((url) => {
        if (url === '/feed') {
          return Promise.resolve({
            success: true,
            data: { posts: mockPosts }
          });
        }
        if (url === '/feed/stories') {
          return Promise.resolve({
            success: true,
            data: { creators: [] }
          });
        }
        return Promise.resolve({ success: true, data: {} });
      });

      render(<FeedPage onOpenCreatePost={vi.fn()} onNavigateToProfile={vi.fn()} />);

      // Wait for posts to load
      await waitFor(() => {
        expect(screen.getByText('Sunny day in Santorini!')).toBeDefined();
        expect(screen.getByText('Glacier lagoon reflections 🧊')).toBeDefined();
      });

      // Verify external attribution badge
      const sourceBadge = screen.getByText('🌐 Via Unsplash');
      expect(sourceBadge).toBeDefined();
      expect(sourceBadge.getAttribute('href')).toBe('https://unsplash.com/photos/glacier');
    });

    it('optimistically likes external posts without triggering database mutation endpoint', async () => {
      apiClient.get.mockImplementation((url) => {
        if (url === '/feed') {
          return Promise.resolve({
            success: true,
            data: { posts: mockPosts }
          });
        }
        if (url === '/feed/stories') {
          return Promise.resolve({ success: true, data: { creators: [] } });
        }
        return Promise.resolve({ success: true, data: {} });
      });

      render(<FeedPage onOpenCreatePost={vi.fn()} onNavigateToProfile={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Glacier lagoon reflections 🧊')).toBeDefined();
      });

      // Find like button on the external post (second post)
      const likeButtons = screen.getAllByTitle('Like post');
      expect(likeButtons.length).toBe(2);
      fireEvent.click(likeButtons[1]);

      // Optimistic like count increments to 43
      await waitFor(() => {
        expect(screen.getByText('43')).toBeDefined();
      });

      // No POST /posts/:id/like was called for external post
      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });
});

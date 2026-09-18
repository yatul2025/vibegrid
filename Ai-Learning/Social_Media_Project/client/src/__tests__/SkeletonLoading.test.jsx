import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Skeleton, {
  SkeletonLine,
  SkeletonCircle,
  SkeletonRect,
  SkeletonPill,
  ExploreGridSkeleton,
  ConversationsListSkeleton,
  ChatThreadSkeleton,
  ProfileSkeleton,
  NotificationsSkeleton,
  UserListSkeleton,
  GroupOverviewSkeleton,
  MediaFilesSkeleton,
  PinnedMessagesSkeleton,
  JoinRequestsSkeleton,
  SettingsSkeleton,
  CommentsSkeleton,
  CallHistorySkeleton
} from '../components/common/Skeleton';
import ExplorePage from '../pages/ExplorePage';
import { AuthProvider } from '../context/AuthContext';
import apiClient from '../api/client';

describe('VibeGrid Global Skeleton Loading System', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Primitive Skeleton Components', () => {
    it('renders SkeletonLine with shimmer class and custom styles', () => {
      const { container } = render(<SkeletonLine width="150px" height="18px" />);
      const el = container.firstChild;
      expect(el).toHaveClass('skeleton-line');
      expect(el).toHaveClass('shimmer');
      expect(el).toHaveStyle({ width: '150px', height: '18px' });
    });

    it('renders SkeletonCircle with avatar and shimmer classes', () => {
      const { container } = render(<SkeletonCircle size={48} />);
      const el = container.firstChild;
      expect(el).toHaveClass('skeleton-avatar');
      expect(el).toHaveClass('shimmer');
      expect(el).toHaveStyle({ width: '48px', height: '48px', borderRadius: '50%' });
    });

    it('renders SkeletonRect with media and shimmer classes', () => {
      const { container } = render(<SkeletonRect width="200px" height="100px" borderRadius="12px" />);
      const el = container.firstChild;
      expect(el).toHaveClass('skeleton-media');
      expect(el).toHaveClass('shimmer');
      expect(el).toHaveStyle({ width: '200px', height: '100px', borderRadius: '12px' });
    });

    it('renders SkeletonPill with button and shimmer classes', () => {
      const { container } = render(<SkeletonPill width="80px" height="30px" />);
      const el = container.firstChild;
      expect(el).toHaveClass('skeleton-btn');
      expect(el).toHaveClass('shimmer');
      expect(el).toHaveStyle({ width: '80px', height: '30px', borderRadius: '9999px' });
    });
  });

  describe('Layout-Matched Skeletons', () => {
    it('renders ExploreGridSkeleton with specified item count', () => {
      render(<ExploreGridSkeleton count={6} />);
      const grid = screen.getByTestId('explore-grid-skeleton');
      expect(grid).toBeInTheDocument();
      expect(grid.children).toHaveLength(6);
    });

    it('renders ConversationsListSkeleton with avatar and text placeholders', () => {
      render(<ConversationsListSkeleton count={4} />);
      const list = screen.getByTestId('conversations-skeleton');
      expect(list).toBeInTheDocument();
      expect(list.children).toHaveLength(4);
    });

    it('renders ChatThreadSkeleton with incoming and outgoing chat bubbles', () => {
      render(<ChatThreadSkeleton count={5} />);
      const thread = screen.getByTestId('chat-thread-skeleton');
      expect(thread).toBeInTheDocument();
      expect(thread.children).toHaveLength(5);
    });

    it('renders ProfileSkeleton with header stats and photo grid', () => {
      render(<ProfileSkeleton />);
      const profile = screen.getByTestId('profile-skeleton');
      expect(profile).toBeInTheDocument();
      expect(screen.getByTestId('explore-grid-skeleton')).toBeInTheDocument();
    });

    it('renders NotificationsSkeleton with activity rows', () => {
      render(<NotificationsSkeleton count={5} />);
      const notifs = screen.getByTestId('notifications-skeleton');
      expect(notifs).toBeInTheDocument();
      expect(notifs.children).toHaveLength(5);
    });

    it('renders UserListSkeleton in normal and compact modes', () => {
      const { rerender } = render(<UserListSkeleton count={3} />);
      const list = screen.getByTestId('user-list-skeleton');
      expect(list).toBeInTheDocument();
      expect(list.children).toHaveLength(3);

      rerender(<UserListSkeleton count={4} compact />);
      const compactList = screen.getByTestId('user-list-skeleton');
      expect(compactList.children).toHaveLength(4);
    });

    it('renders GroupOverviewSkeleton with header and settings rows', () => {
      render(<GroupOverviewSkeleton />);
      expect(screen.getByTestId('group-overview-skeleton')).toBeInTheDocument();
    });

    it('renders MediaFilesSkeleton with tabs and grid', () => {
      render(<MediaFilesSkeleton />);
      expect(screen.getByTestId('media-files-skeleton')).toBeInTheDocument();
    });

    it('renders PinnedMessagesSkeleton with card rows', () => {
      render(<PinnedMessagesSkeleton count={3} />);
      const pinned = screen.getByTestId('pinned-messages-skeleton');
      expect(pinned).toBeInTheDocument();
      expect(pinned.children).toHaveLength(3);
    });

    it('renders JoinRequestsSkeleton with action pills', () => {
      render(<JoinRequestsSkeleton count={2} />);
      const reqs = screen.getByTestId('join-requests-skeleton');
      expect(reqs).toBeInTheDocument();
      expect(reqs.children).toHaveLength(2);
    });

    it('renders SettingsSkeleton with profile summary and preference rows', () => {
      render(<SettingsSkeleton />);
      expect(screen.getByTestId('settings-skeleton')).toBeInTheDocument();
    });

    it('renders CommentsSkeleton with comment rows', () => {
      render(<CommentsSkeleton count={3} />);
      const comments = screen.getByTestId('comments-skeleton');
      expect(comments).toBeInTheDocument();
      expect(comments.children).toHaveLength(3);
    });

    it('renders CallHistorySkeleton with call log rows', () => {
      render(<CallHistorySkeleton count={4} />);
      const calls = screen.getByTestId('call-history-skeleton');
      expect(calls).toBeInTheDocument();
      expect(calls.children).toHaveLength(4);
    });
  });

  describe('Cache Respect & Seamless Transition', () => {
    it('renders ExploreGridSkeleton when cache is empty and data is loading', async () => {
      // Setup pending API call
      vi.spyOn(apiClient, 'get').mockImplementation(() => new Promise(() => {}));

      render(
        <AuthProvider>
          <ExplorePage />
        </AuthProvider>
      );

      // Skeletons are visible while loading
      expect(screen.getByTestId('explore-grid-skeleton')).toBeInTheDocument();
    });

    it('does NOT render ExploreGridSkeleton when content is already present in cache', async () => {
      const cachedPosts = [
        {
          id: 99,
          username: 'sarah_adventures',
          image_url: 'https://example.com/photo.jpg',
          caption: 'Beautiful sunrise!',
          likes_count: 12,
          comments_count: 3
        }
      ];
      localStorage.setItem('vibegrid_cached_explore', JSON.stringify(cachedPosts));

      vi.spyOn(apiClient, 'get').mockImplementation(() => new Promise(() => {}));

      render(
        <AuthProvider>
          <ExplorePage />
        </AuthProvider>
      );

      // Skeleton is NOT displayed because cached posts are already loaded
      expect(screen.queryByTestId('explore-grid-skeleton')).not.toBeInTheDocument();
      expect(screen.getByAltText('Beautiful sunrise!')).toBeInTheDocument();
    });
  });
});

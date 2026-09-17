/**
 * client/src/pages/FeedPage.jsx
 * =============================
 * Chronological Home Feed View
 * 
 * Features:
 * 1. Displays chronological post feed from PostgreSQL.
 * 2. Optimistic like toggle (instant UI update + background API call).
 * 3. Double-tap photo to like with heart burst animation.
 * 4. Interactive comments thread modal with live comment counting.
 * 5. Author card with avatar, username, and formatted relative time.
 * 6. Author post deletion with instant removal.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import CommentsModal from '../components/CommentsModal';
import StoryTray from '../components/StoryTray';
import CreateStoryModal from '../components/CreateStoryModal';
import StoryViewerModal from '../components/StoryViewerModal';
import HashtagFeedModal from '../components/HashtagFeedModal';
import FeedSidebar from '../components/FeedSidebar';
import ConfirmModal from '../components/ConfirmModal';
import HidePostModal from '../components/HidePostModal';
import { triggerCelebration } from '../components/AuroraCelebrationOverlay';
import VibiEmptyState from '../components/VibiEmptyState';
import { formatCaptionWithHashtags } from '../utils/textFormatters';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Star,
  Globe,
  Shield,
  Trash2,
  RotateCw,
  PlusSquare,
  Sparkles
} from 'lucide-react';

// Relative time formatting helper (e.g., "Just now", "5m ago", "2h ago")
function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Category definitions for live syndication
const FEED_CATEGORIES = [
  { id: 'all', label: 'All', icon: '🌟' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { id: 'jokes', label: 'Jokes & Memes', icon: '😂' },
  { id: 'education', label: 'Education & Science', icon: '🎓' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'news', label: 'News', icon: '📰' },
  { id: 'photography', label: 'Photography', icon: '📸' }
];

export default function FeedPage({ onOpenCreatePost, onNavigateToProfile }) {
  const { user, guardDemoAction } = useAuth();
  const [posts, setPosts] = useState(() => {
    try {
      const cached = localStorage.getItem('vibegrid_cached_feed');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      return !localStorage.getItem('vibegrid_cached_feed');
    } catch {
      return true;
    }
  });
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [moderatingId, setModeratingId] = useState(null);
  const [postToDelete, setPostToDelete] = useState(null);
  const [postToHide, setPostToHide] = useState(null);

  // Engagement States
  const [activeCommentPost, setActiveCommentPost] = useState(null);
  const [animatingPostId, setAnimatingPostId] = useState(null);
  const [activeHashtag, setActiveHashtag] = useState(null);
  const [inlineComments, setInlineComments] = useState({});
  const [submittingCommentPostId, setSubmittingCommentPostId] = useState(null);
  const [reactionToast, setReactionToast] = useState(null);

  // Close Friends State
  const [closeFriendIds, setCloseFriendIds] = useState(() => {
    try {
      const saved = localStorage.getItem('vibegrid_close_friends');
      return saved ? new Set(JSON.parse(saved)) : new Set([2, 3, 4]);
    } catch {
      return new Set([2, 3, 4]);
    }
  });
  const [feedMode, setFeedMode] = useState('forYou'); // 'forYou' | 'following' | 'closeFriends'
  const filterCloseFriends = feedMode === 'closeFriends';
  const setFilterCloseFriends = (val) => setFeedMode(val ? 'closeFriends' : 'forYou');

  // Stories States (Phase 9)
  const [storyCreators, setStoryCreators] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const [viewerCreatorIndex, setViewerCreatorIndex] = useState(0);
  const [viewedCreatorIds, setViewedCreatorIds] = useState(new Set());

  // Live Aggregated Feed States
  const [newPostsAvailable, setNewPostsAvailable] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch active stories (combining real VibeGrid stories + external discovery stories)
  const fetchStories = async (forceRefresh = false) => {
    try {
      setStoriesLoading(true);
      const url = forceRefresh ? '/feed/stories?refresh=true' : '/feed/stories';
      let res = await apiClient.get(url);
      if (!res.success && res.error) {
        res = await apiClient.get('/stories/active');
      }
      const creators = res.data?.creators || res.creators;
      if (res.success && creators) {
        setStoryCreators(creators);
      }
    } catch (err) {
      try {
        const fallback = await apiClient.get('/stories/active');
        if (fallback.success && (fallback.data?.creators || fallback.creators)) {
          setStoryCreators(fallback.data?.creators || fallback.creators);
        }
      } catch (fbErr) {
        console.error('Failed to load active stories:', fbErr);
      }
    } finally {
      setStoriesLoading(false);
    }
  };

  // Fetch live feed posts from API (with category & force refresh support)
  const fetchFeed = async (cat = selectedCategory, forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const params = new URLSearchParams();
      if (cat && cat !== 'all') params.append('category', cat);
      if (forceRefresh) params.append('refresh', 'true');

      const queryString = params.toString() ? `?${params.toString()}` : '';
      let res = await apiClient.get(`/feed${queryString}`);
      if (!res.success && res.error) {
        res = await apiClient.get('/posts/feed');
      }
      const fetchedPosts = res.data?.posts || res.posts;
      if (res.success && fetchedPosts) {
        setPosts(fetchedPosts);
        setNewPostsAvailable([]);
        try {
          if (cat === 'all') {
            localStorage.setItem('vibegrid_cached_feed', JSON.stringify(fetchedPosts));
          }
        } catch {}
      } else {
        setError(res.error || 'Failed to load feed.');
      }
    } catch (err) {
      try {
        const fallback = await apiClient.get('/posts/feed');
        if (fallback.success && fallback.data?.posts) {
          setPosts(fallback.data.posts);
          try {
            localStorage.setItem('vibegrid_cached_feed', JSON.stringify(fallback.data.posts));
          } catch {}
          return;
        }
      } catch (fbErr) {
        // ignore
      }
      // If offline or network error and we have cached posts, show cached posts without error
      const cached = localStorage.getItem('vibegrid_cached_feed');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPosts(parsed);
            setError(null);
            return;
          }
        } catch {}
      }
      setError(err.message || 'Error connecting to feed.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFeed(selectedCategory, false);
    fetchStories(false);
  }, []);

  // Background Delta Polling for live fresh content (every 2.5 minutes)
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      if (posts.length === 0) return;
      const latestTimestamp = posts[0]?.created_at;
      if (!latestTimestamp) return;

      try {
        const res = await apiClient.get(`/feed?since=${encodeURIComponent(latestTimestamp)}`);
        const newItems = res.data?.posts || res.posts || [];
        if (Array.isArray(newItems) && newItems.length > 0) {
          setNewPostsAvailable((prev) => {
            const existingIds = new Set([...posts.map((p) => p.id), ...prev.map((p) => p.id)]);
            const filtered = newItems.filter((item) => !existingIds.has(item.id));
            return filtered.length > 0 ? [...filtered, ...prev] : prev;
          });
        }
      } catch (pollErr) {
        // Silent catch for background delta polling
      }
    }, 150000);

    return () => clearInterval(pollInterval);
  }, [posts]);

  const handleRefreshNewPosts = () => {
    if (newPostsAvailable.length === 0) return;
    setPosts((prev) => [...newPostsAvailable, ...prev]);
    setNewPostsAvailable([]);
  };

  const handleOpenViewer = (creatorIndex) => {
    setViewerCreatorIndex(creatorIndex);
    setIsStoryViewerOpen(true);
  };

  const handleStoryViewed = useCallback((creatorId) => {
    setViewedCreatorIds((prev) => {
      if (prev.has(creatorId)) return prev;
      const next = new Set(prev);
      next.add(creatorId);
      return next;
    });
  }, []);

  const handleStoryCreated = () => {
    fetchStories();
    triggerCelebration({
      title: 'Story is Live! 📸',
      subtitle: 'Visible to followers for 24 hours'
    });
  };

  const handleStoryDeleted = () => {
    fetchStories();
  };

  // Optimistic Like / Unlike Toggle
  const handleToggleLike = async (postId) => {
    if (guardDemoAction('like')) return;
    if (!user) {
      alert('Please sign in to like posts.');
      return;
    }

    // 1. Snapshot previous state for rollback if needed
    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return;

    const previousLiked = targetPost.is_liked;
    const previousCount = targetPost.likes_count;

    const newLiked = !previousLiked;
    const newCount = newLiked ? previousCount + 1 : Math.max(0, previousCount - 1);

    // 2. Optimistic state update (Zero UI latency!)
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, is_liked: newLiked, likes_count: newCount } : p
      )
    );

    // If modal is currently open on this post, keep it synced too
    if (activeCommentPost && activeCommentPost.id === postId) {
      setActiveCommentPost((prev) => ({ ...prev, is_liked: newLiked, likes_count: newCount }));
    }

    // External discovery items don't exist in PostgreSQL
    if (targetPost.is_external) {
      return;
    }

    try {
      // 3. Background API request
      const res = await apiClient.post(`/posts/${postId}/like`);
      if (res.success && res.data) {
        // Sync with true server count
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, is_liked: res.data.liked, likes_count: res.data.likes_count } : p
          )
        );
      } else {
        throw new Error(res.error || 'Like failed');
      }
    } catch (err) {
      console.error('[Like Toggle Error]', err);
      // Rollback on error
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, is_liked: previousLiked, likes_count: previousCount } : p
        )
      );
    }
  };

  // Optimistic Save / Unsave Toggle (Phase 12)
  const handleToggleSave = async (postId) => {
    if (guardDemoAction('save')) return;
    if (!user) {
      alert('Please sign in to save posts.');
      return;
    }

    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return;

    const previousSaved = !!targetPost.is_saved;
    const newSaved = !previousSaved;

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, is_saved: newSaved } : p))
    );

    // External discovery items don't exist in PostgreSQL
    if (targetPost.is_external) {
      return;
    }

    try {
      const res = await apiClient.post(`/posts/${postId}/save`);
      if (res.success && res.data) {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, is_saved: res.data.is_saved } : p))
        );
      } else {
        throw new Error(res.error || 'Save failed');
      }
    } catch (err) {
      console.error('[Save Toggle Error]', err);
      // Rollback
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, is_saved: previousSaved } : p))
      );
    }
  };

  // Double-tap on image to like
  const handleImageDoubleClick = (post) => {
    if (guardDemoAction('like')) return;
    // Show heart pop animation
    setAnimatingPostId(post.id);
    setTimeout(() => setAnimatingPostId(null), 800);

    // If not liked yet, like it
    if (!post.is_liked) {
      handleToggleLike(post.id);
    }
  };

  // Sync comment count update from CommentsModal
  const handleCommentCountChange = (postId, newCount) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments_count: newCount } : p))
    );
    if (activeCommentPost && activeCommentPost.id === postId) {
      setActiveCommentPost((prev) => ({ ...prev, comments_count: newCount }));
    }
  };

  // Handle post deletion (Author only) - Opens modern confirmation modal
  const handleDeletePost = (postId) => {
    if (guardDemoAction('create_post')) return;
    setPostToDelete(postId);
  };

  const handleConfirmDeletePost = async () => {
    if (!postToDelete) return;

    try {
      setDeletingId(postToDelete);
      const res = await apiClient.delete(`/posts/${postToDelete}`);
      if (res.success) {
        setPosts((prev) => prev.filter((p) => p.id !== postToDelete));
        if (activeCommentPost && activeCommentPost.id === postToDelete) {
          setActiveCommentPost(null);
        }
        setPostToDelete(null);
        setReactionToast({ customText: '🗑️ Post deleted successfully' });
        setTimeout(() => setReactionToast(null), 3000);
      } else {
        alert(res.error || 'Failed to delete post.');
      }
    } catch (err) {
      alert(err.message || 'Error deleting post.');
    } finally {
      setDeletingId(null);
    }
  };

  // Handle hiding a post via content moderation (Admin / Test accounts) - Opens modern bottom-sheet
  const handleModeratePost = (postId) => {
    setPostToHide(postId);
  };

  const handleConfirmHidePost = async (reason) => {
    if (!postToHide) return;

    try {
      setModeratingId(postToHide);
      const res = await apiClient.patch(`/posts/${postToHide}/moderate`, {
        isActive: false,
        reason: reason || 'Adult content'
      });
      if (res.success) {
        setPosts((prev) => prev.filter((p) => p.id !== postToHide));
        if (activeCommentPost && activeCommentPost.id === postToHide) {
          setActiveCommentPost(null);
        }
        setPostToHide(null);
        setReactionToast({ customText: '🛡️ Post hidden from feeds successfully!' });
        setTimeout(() => setReactionToast(null), 3000);
      } else {
        alert(res.error || 'Failed to hide post.');
      }
    } catch (err) {
      alert(err.message || 'Failed to hide post.');
    } finally {
      setModeratingId(null);
    }
  };

  // Quick Emoji Insertion into comment input
  const handleEmojiInsert = (postId, emoji) => {
    setInlineComments((prev) => ({
      ...prev,
      [postId]: ((prev[postId] || '') + emoji).slice(0, 500)
    }));
  };

  // Inline Quick Comment Submit
  const handleInlineCommentSubmit = async (postId, e) => {
    e.preventDefault();
    if (guardDemoAction('comment')) return;
    if (!user) {
      alert('Please sign in to comment.');
      return;
    }
    const text = (inlineComments[postId] || '').trim();
    if (!text || submittingCommentPostId === postId) return;

    setSubmittingCommentPostId(postId);
    // Optimistic count update
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p))
    );

    try {
      const res = await apiClient.post(`/posts/${encodeURIComponent(postId)}/comments`, { content: text });
      if (res.success) {
        setInlineComments((prev) => ({ ...prev, [postId]: '' }));
      } else {
        throw new Error(res.error || 'Failed to post comment');
      }
    } catch (err) {
      alert(err.message || 'Error posting comment');
      // Rollback
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments_count: Math.max(0, (p.comments_count || 1) - 1) } : p))
      );
    } finally {
      setSubmittingCommentPostId(null);
    }
  };

  // Toggle Close Friends Status
  const handleToggleCloseFriend = (targetUserId, targetUsername) => {
    if (!targetUserId) return;
    if (!user) {
      alert('Please sign in to manage Close Friends.');
      return;
    }

    setCloseFriendIds((prev) => {
      const next = new Set(prev);
      const isNowAdded = !next.has(targetUserId);
      if (isNowAdded) {
        next.add(targetUserId);
      } else {
        next.delete(targetUserId);
      }
      try {
        localStorage.setItem('vibegrid_close_friends', JSON.stringify([...next]));
      } catch {}

      setReactionToast({
        postId: null,
        emoji: '⭐',
        customText: isNowAdded
          ? `⭐ Added @${targetUsername || 'user'} to Close Friends`
          : `Removed @${targetUsername || 'user'} from Close Friends`
      });
      setTimeout(() => {
        setReactionToast((current) => (current?.customText ? null : current));
      }, 2400);

      return next;
    });
  };

  const filteredPosts = posts.filter((p) => {
    // 1. Primary Feed Mode
    if (feedMode === 'closeFriends') {
      if (!closeFriendIds.has(p.user_id) && (!user || p.user_id !== user.id)) {
        return false;
      }
    } else if (feedMode === 'following') {
      if (!p.is_following && (!user || p.user_id !== user.id)) {
        return false;
      }
    }

    // 2. Secondary Category Filter
    if (selectedCategory !== 'all') {
      if (!p.category) return false;
      const cleanCat = selectedCategory.toLowerCase();
      if (cleanCat === 'jokes' || cleanCat === 'humor') return p.category === 'jokes';
      if (cleanCat === 'education') return p.category === 'education';
      return p.category.toLowerCase() === cleanCat;
    }

    return true;
  });

  // Always ensure newest items are on top
  const displayedPosts = [...filteredPosts].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  return (
    <div className="feed-page-container">
      {/* Toast Notification for Close Friends toggle */}
      {reactionToast?.customText && (
        <div className="story-reaction-toast" style={{ position: 'fixed', bottom: '80px', left: '50%', zIndex: 1000 }}>
          {reactionToast.customText}
        </div>
      )}

      {/* 2-Column Responsive Layout Wrapper */}
      <div className="feed-layout-wrapper">
        <main className="feed-main-column">
          {/* Ephemeral 24-Hour Stories Bar */}
          <StoryTray
            creators={storyCreators}
            loading={storiesLoading}
            viewedCreatorIds={viewedCreatorIds}
            closeFriendIds={closeFriendIds}
            onOpenViewer={handleOpenViewer}
            onOpenCreateStory={() => setIsCreateStoryOpen(true)}
          />

          {/* Feed Header Container (Clean 2-level Instagram/Threads style) */}
          <div className="feed-header-container">
            <div className="feed-header-top">
              {/* Primary Feed Toggle: For You | Following | Close Friends */}
              <div className="feed-primary-tabs" role="tablist" aria-label="Feed Mode">
                <button
                  type="button"
                  className={`feed-primary-tab ${feedMode === 'forYou' ? 'active' : ''}`}
                  onClick={() => setFeedMode('forYou')}
                  role="tab"
                  aria-selected={feedMode === 'forYou'}
                >
                  For You
                </button>
                <button
                  type="button"
                  className={`feed-primary-tab ${feedMode === 'following' ? 'active' : ''}`}
                  onClick={() => setFeedMode('following')}
                  role="tab"
                  aria-selected={feedMode === 'following'}
                >
                  Following
                </button>
                <button
                  type="button"
                  className={`feed-primary-tab cf-primary-tab ${feedMode === 'closeFriends' ? 'active' : ''}`}
                  onClick={() => setFeedMode('closeFriends')}
                  role="tab"
                  aria-selected={feedMode === 'closeFriends'}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Star size={13} fill="currentColor" strokeWidth={0} /> Close Friends
                  </span>
                  {closeFriendIds.size > 0 && (
                    <span className="feed-cf-pill-count">{closeFriendIds.size}</span>
                  )}
                </button>
              </div>

              <div className="feed-header-controls">
                <button
                  type="button"
                  className={`feed-control-btn ${isRefreshing ? 'refreshing' : ''}`}
                  onClick={() => {
                    fetchFeed(selectedCategory, true);
                    fetchStories(true);
                  }}
                  title="Refresh feed"
                  aria-label="Refresh feed"
                  disabled={isRefreshing}
                >
                  <RotateCw size={14} className={`refresh-icon ${isRefreshing ? 'spinning' : ''}`} />
                  <span className="desktop-only">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
                {user && (
                  <button
                    type="button"
                    className="feed-control-btn feed-create-btn desktop-only"
                    onClick={onOpenCreatePost}
                    title="Create a new post"
                    aria-label="Create a new post"
                  >
                    <PlusSquare size={15} />
                    <span>Post</span>
                  </button>
                )}
              </div>
            </div>

            {/* Secondary Category Filter Pills with smooth horizontal scrolling */}
            <div className="feed-category-chips-bar-wrapper">
              <div className="feed-category-chips-bar" role="tablist" aria-label="Feed Categories">
                {FEED_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`category-chip ${selectedCategory === cat.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      fetchFeed(cat.id, false);
                    }}
                    role="tab"
                    aria-selected={selectedCategory === cat.id}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

      {error && (
        <div className="feed-error-banner">
          ⚠️ {error}
          <button type="button" onClick={fetchFeed} className="inline-link" style={{ marginLeft: '8px' }}>
            Try Again
          </button>
        </div>
      )}

      {/* Floating Fresh Posts Notification Banner */}
      {newPostsAvailable.length > 0 && (
        <button
          type="button"
          className="floating-new-posts-pill"
          onClick={handleRefreshNewPosts}
          title="Click to view new posts"
        >
          <Sparkles size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
          {newPostsAvailable.length} new {newPostsAvailable.length === 1 ? 'post' : 'posts'} available — Tap to view
        </button>
      )}

      {/* Loading Skeleton Cards */}
      {loading ? (
        <div className="feed-timeline">
          {[1, 2, 3].map((n) => (
            <div key={n} className="feed-post-card feed-skeleton-card">
              <div className="post-card-header skeleton-card-header">
                <div className="skeleton-avatar shimmer" />
                <div className="skeleton-text-group">
                  <div className="skeleton-line shimmer" style={{ width: '130px', height: '14px' }} />
                  <div className="skeleton-line shimmer" style={{ width: '70px', height: '10px', marginTop: '6px' }} />
                </div>
              </div>
              <div className="skeleton-media shimmer" />
              <div className="skeleton-card-body">
                <div className="skeleton-actions-placeholder">
                  <div className="skeleton-btn shimmer" />
                  <div className="skeleton-btn shimmer" />
                  <div className="skeleton-btn shimmer" />
                </div>
                <div className="skeleton-line shimmer" style={{ width: '90px', height: '12px', margin: '10px 0 8px' }} />
                <div className="skeleton-line shimmer" style={{ width: '85%', height: '14px', marginBottom: '6px' }} />
                <div className="skeleton-line shimmer" style={{ width: '60%', height: '14px' }} />
              </div>
            </div>
          ))}
        </div>
      ) : displayedPosts.length === 0 ? (
        /* Empty Feed State — Phase 6 Delight: Vibi's Mascot Moments */
        feedMode === 'closeFriends' ? (
          <VibiEmptyState
            pose="treasure"
            title="No Close Friends posts yet"
            subtitle="Tap the green star ★ button on any creator's post to add them to your Close Friends!"
            actionLabel="Show All Posts"
            onAction={() => setFeedMode('forYou')}
          />
        ) : feedMode === 'following' ? (
          <VibiEmptyState
            pose="wave"
            title="No posts from accounts you follow"
            subtitle="Follow interesting creators from the For You feed or Explore tab to see their latest updates here."
            actionLabel="Explore For You Feed"
            onAction={() => setFeedMode('forYou')}
          />
        ) : (
          <VibiEmptyState
            pose="camera"
            title="Your feed is waiting!"
            subtitle="Be the first one to share a photo moment with the VibeGrid community."
            actionLabel={user ? "Create Your First Post" : undefined}
            onAction={user ? onOpenCreatePost : undefined}
            secondaryLabel={!user ? "Sign in to start posting" : undefined}
          />
        )
      ) : (
        /* Posts Timeline */
        <div className="feed-timeline">
          {displayedPosts.map((post) => {
            const creatorIndex = storyCreators.findIndex((c) => c.userId === post.user_id);
            const hasActiveStory = creatorIndex !== -1;
            const isCloseFriend = closeFriendIds.has(post.user_id);

            return (
              <article key={post.id} className="feed-post-card">
                {/* Card Header: Author Info & Delete Option */}
                <div className="post-card-header">
                  <div className="post-author-info">
                    <div
                      className={`post-avatar-wrapper ${hasActiveStory ? 'has-active-story' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasActiveStory) {
                          handleOpenViewer(creatorIndex);
                        } else if (onNavigateToProfile) {
                          onNavigateToProfile(post.username);
                        }
                      }}
                      title={hasActiveStory ? `View ${post.username}'s story` : `@${post.username}`}
                    >
                      {post.avatar_url ? (
                        <img src={post.avatar_url} alt={post.username} className="post-author-avatar" />
                      ) : (
                        <div className="post-author-avatar-fallback">
                          {post.username?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="post-author-text">
                      <div className="post-author-name-row">
                        <span
                          className="post-author-username"
                          onClick={() => {
                            if (post.is_external && post.source_url) {
                              window.open(post.source_url, '_blank', 'noopener,noreferrer');
                            } else if (onNavigateToProfile) {
                              onNavigateToProfile(post.username);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          @{post.username}
                        </span>
                        {post.is_external ? (
                          <a
                            href={post.source_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="external-source-pill"
                            title={`Via ${post.source || 'External Discovery'}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            🌐 Via {post.source || 'Discovery'}
                          </a>
                        ) : (
                          <button
                            type="button"
                            className={`post-close-friend-btn ${isCloseFriend ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleCloseFriend(post.user_id, post.username);
                            }}
                            title={isCloseFriend ? 'Close Friend (Click to remove)' : 'Add to Close Friends'}
                            aria-label={isCloseFriend ? 'Remove from Close Friends' : 'Add to Close Friends'}
                          >
                            <Star size={14} fill={isCloseFriend ? 'currentColor' : 'none'} color="currentColor" strokeWidth={isCloseFriend ? 0 : 2} />
                          </button>
                        )}
                      </div>
                      <span className="post-timestamp">{formatTimeAgo(post.created_at)}</span>
                    </div>
                  </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {/* Moderate / Hide post button (Admins & Test Profiles) */}
                  {user && ([1, 2, 3, 4].includes(Number(user.id)) || Number(user.test) === 1) && (
                    <button
                      type="button"
                      className="post-moderate-btn"
                      onClick={() => handleModeratePost(post.id)}
                      disabled={moderatingId === post.id}
                      title="Hide Post (Content Moderation)"
                      aria-label="Hide Post (Content Moderation)"
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        color: '#ef4444',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {moderatingId === post.id ? '⏳' : (
                        <>
                          <Shield size={13} style={{ verticalAlign: 'middle' }} />
                          <span className="desktop-only">Hide Post</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Delete button (Author only) */}
                  {user && user.id === post.user_id && (
                    <button
                      type="button"
                      className="post-delete-btn"
                      onClick={() => handleDeletePost(post.id)}
                      disabled={deletingId === post.id}
                      title="Delete post"
                      aria-label="Delete post"
                    >
                      {deletingId === post.id ? '⏳' : <Trash2 size={16} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Card Media: Photo with Double-Tap Support */}
              <div
                className="post-card-media"
                onDoubleClick={() => handleImageDoubleClick(post)}
                title="Double click to like!"
              >
                <img
                  src={post.image_url}
                  alt={post.caption || 'User post'}
                  className="post-image"
                  loading="lazy"
                  decoding="async"
                />
                {/* Animated Heart Overlay on Double-Tap */}
                {animatingPostId === post.id && (
                  <div className="double-tap-heart-overlay">
                    <Heart size={76} fill="#ef4444" color="#ffffff" strokeWidth={1.5} />
                  </div>
                )}
              </div>

              {/* Card Engagement Actions */}
              <div className="post-card-actions">
                <div className="actions-left">
                  <button
                    type="button"
                    className={`post-action-btn ${post.is_liked ? 'liked' : ''}`}
                    onClick={() => handleToggleLike(post.id)}
                    title={post.is_liked ? 'Unlike post' : 'Like post'}
                    aria-label={post.is_liked ? 'Unlike post' : 'Like post'}
                  >
                    <span className="heart-icon-wrapper">
                      <Heart
                        size={22}
                        fill={post.is_liked ? '#ef4444' : 'none'}
                        color={post.is_liked ? '#ef4444' : 'currentColor'}
                        strokeWidth={2}
                      />
                    </span>
                    <span className="action-counter">{post.likes_count}</span>
                  </button>

                  <button
                    type="button"
                    className="post-action-btn"
                    onClick={() => {
                      if (guardDemoAction('comment')) return;
                      setActiveCommentPost(post);
                    }}
                    title="View comments thread"
                    aria-label={`View comments thread, ${post.comments_count} comments`}
                  >
                    <MessageCircle size={22} color="currentColor" strokeWidth={2} />
                    <span className="action-counter">{post.comments_count}</span>
                  </button>
                </div>

                <div className="actions-right">
                  <button
                    type="button"
                    className={`post-action-btn post-save-btn ${post.is_saved ? 'saved' : ''}`}
                    onClick={() => handleToggleSave(post.id)}
                    title={post.is_saved ? 'Remove from saved' : 'Save post'}
                    aria-label={post.is_saved ? 'Remove from saved' : 'Save post'}
                  >
                    <Bookmark
                      size={22}
                      fill={post.is_saved ? 'currentColor' : 'none'}
                      color="currentColor"
                      strokeWidth={2}
                    />
                  </button>
                </div>
              </div>

              {/* Card Caption */}
              {post.caption && (
                <div className="post-card-caption">
                  <span
                    className="caption-username"
                    onClick={() => onNavigateToProfile && onNavigateToProfile(post.username)}
                    style={{ cursor: 'pointer' }}
                  >
                    @{post.username}
                  </span>{' '}
                  <span className="caption-text">
                    {formatCaptionWithHashtags(
                      post.caption,
                      (tag) => setActiveHashtag(tag),
                      onNavigateToProfile
                    )}
                  </span>
                </div>
              )}

                {/* Quick Emoji Insertion Strip */}
                <div className="feed-quick-emoji-row">
                  {['❤️', '🔥', '👏', '😍', '😂', '🥳'].map((em) => (
                    <button
                      key={em}
                      type="button"
                      className="feed-quick-emoji-btn"
                      onClick={() => handleEmojiInsert(post.id, em)}
                      title={`Add ${em} to comment`}
                      aria-label={`Insert ${em} emoji`}
                    >
                      {em}
                    </button>
                  ))}
                </div>

                {/* View Comments Link (Quick Trigger) */}
                {post.comments_count > 0 && (
                  <div className="post-card-comments-link">
                    <button
                      type="button"
                      className="inline-comment-toggle"
                      onClick={() => setActiveCommentPost(post)}
                    >
                      View all {post.comments_count} comments
                    </button>
                  </div>
                )}

                {/* Inline Quick Comment Input Bar */}
                {user && (
                  <form
                    className="feed-inline-comment-form"
                    onSubmit={(e) => handleInlineCommentSubmit(post.id, e)}
                  >
                    <label htmlFor={`feed-comment-${post.id}`} className="sr-only">
                      Add a comment
                    </label>
                    <input
                      id={`feed-comment-${post.id}`}
                      aria-label="Add a comment"
                      type="text"
                      className="feed-inline-comment-input"
                      placeholder="Add a comment..."
                      value={inlineComments[post.id] || ''}
                      onChange={(e) =>
                        setInlineComments((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                    />
                    {(inlineComments[post.id] || '').trim() && (
                      <button
                        type="submit"
                        className="feed-inline-comment-btn"
                        disabled={submittingCommentPostId === post.id}
                        aria-busy={submittingCommentPostId === post.id ? 'true' : 'false'}
                        aria-label="Post comment"
                      >
                        {submittingCommentPostId === post.id ? '...' : 'Post'}
                      </button>
                    )}
                  </form>
                )}

              {/* Card Meta */}
              <div className="post-card-meta">
                <span>{new Date(post.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </article>
          );
        })}
        </div>
      )}
        </main>

        {/* Right Desktop Sidebar (Suggestions & Trending) */}
        <div className="feed-sidebar-column">
          <FeedSidebar
            onNavigateToProfile={onNavigateToProfile}
            onHashtagClick={(tag) => setActiveHashtag(tag)}
          />
        </div>
      </div>

      {/* Comments Thread Modal */}
      <CommentsModal
        post={activeCommentPost}
        isOpen={!!activeCommentPost}
        onClose={() => setActiveCommentPost(null)}
        onCommentCountChange={handleCommentCountChange}
        onNavigateToProfile={onNavigateToProfile}
      />

      {/* Ephemeral Story Creation Modal */}
      <CreateStoryModal
        isOpen={isCreateStoryOpen}
        onClose={() => setIsCreateStoryOpen(false)}
        onStoryCreated={handleStoryCreated}
      />

      {/* Ephemeral Story Viewer Modal */}
      <StoryViewerModal
        isOpen={isStoryViewerOpen}
        creators={storyCreators}
        initialCreatorIndex={viewerCreatorIndex}
        closeFriendIds={closeFriendIds}
        onToggleCloseFriend={handleToggleCloseFriend}
        onClose={() => setIsStoryViewerOpen(false)}
        onStoryDeleted={handleStoryDeleted}
        onStoryViewed={handleStoryViewed}
      />

      {/* Hashtag Topic Feed Modal (Phase 13) */}
      <HashtagFeedModal
        isOpen={!!activeHashtag}
        tag={activeHashtag}
        onClose={() => setActiveHashtag(null)}
        onNavigateToProfile={onNavigateToProfile}
        onHashtagClick={(tag) => setActiveHashtag(tag)}
      />

      {/* Modern Confirm Post Deletion Modal */}
      <ConfirmModal
        isOpen={!!postToDelete}
        title="Delete Post?"
        description="Are you sure you want to delete this post? This action is permanent and cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={deletingId === postToDelete}
        onConfirm={handleConfirmDeletePost}
        onClose={() => setPostToDelete(null)}
      />

      {/* Modern Content Moderation / Hide Post Sheet */}
      <HidePostModal
        isOpen={!!postToHide}
        isLoading={moderatingId === postToHide}
        onConfirm={handleConfirmHidePost}
        onClose={() => setPostToHide(null)}
      />
    </div>
  );
}

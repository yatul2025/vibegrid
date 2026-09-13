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
import { formatCaptionWithHashtags } from '../utils/textFormatters';

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

export default function FeedPage({ onOpenCreatePost, onNavigateToProfile }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

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
  const [filterCloseFriends, setFilterCloseFriends] = useState(false);

  // Stories States (Phase 9)
  const [storyCreators, setStoryCreators] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const [viewerCreatorIndex, setViewerCreatorIndex] = useState(0);
  const [viewedCreatorIds, setViewedCreatorIds] = useState(new Set());

  // Fetch active stories
  const fetchStories = async () => {
    try {
      setStoriesLoading(true);
      const res = await apiClient.get('/stories/active');
      if (res.success && res.data?.creators) {
        setStoryCreators(res.data.creators);
      }
    } catch (err) {
      console.error('Failed to load active stories:', err);
    } finally {
      setStoriesLoading(false);
    }
  };

  // Fetch feed posts from API
  const fetchFeed = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get('/posts/feed');
      if (res.success && res.data?.posts) {
        setPosts(res.data.posts);
      } else {
        setError(res.error || 'Failed to load feed.');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to feed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
    fetchStories();
  }, []);

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
  };

  const handleStoryDeleted = () => {
    fetchStories();
  };

  // Optimistic Like / Unlike Toggle
  const handleToggleLike = async (postId) => {
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

  // Handle post deletion (Author only)
  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post? This cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(postId);
      const res = await apiClient.delete(`/posts/${postId}`);
      if (res.success) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        if (activeCommentPost && activeCommentPost.id === postId) {
          setActiveCommentPost(null);
        }
      } else {
        alert(res.error || 'Failed to delete post.');
      }
    } catch (err) {
      alert(err.message || 'Error deleting post.');
    } finally {
      setDeletingId(null);
    }
  };

  // 1-Tap Quick Emoji Comment
  const handleQuickEmojiComment = async (postId, emoji) => {
    if (!user) {
      alert('Please sign in to comment.');
      return;
    }

    // Optimistically update comment count
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p))
    );
    setReactionToast({ postId, emoji });
    setTimeout(() => {
      setReactionToast((current) => (current?.postId === postId ? null : current));
    }, 2000);

    try {
      const res = await apiClient.post(`/posts/${postId}/comments`, { content: emoji });
      if (!res.success) {
        throw new Error(res.error || 'Failed to post emoji');
      }
    } catch (err) {
      console.error('Quick emoji comment failed:', err);
      // Rollback
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments_count: Math.max(0, (p.comments_count || 1) - 1) } : p))
      );
    }
  };

  // Inline Quick Comment Submit
  const handleInlineCommentSubmit = async (postId, e) => {
    e.preventDefault();
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
      const res = await apiClient.post(`/posts/${postId}/comments`, { content: text });
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

  const displayedPosts = filterCloseFriends
    ? posts.filter((p) => closeFriendIds.has(p.user_id) || (user && p.user_id === user.id))
    : posts;

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
          <div className="feed-header-brand">
            <svg viewBox="0 0 52 52" width="24" height="24" className="vg-feed-header-logo" fill="none">
              <defs>
                <linearGradient id="vgFeedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f09433" />
                  <stop offset="25%" stopColor="#e6683c" />
                  <stop offset="50%" stopColor="#dc2743" />
                  <stop offset="75%" stopColor="#cc2366" />
                  <stop offset="100%" stopColor="#bc1888" />
                </linearGradient>
              </defs>
              <rect width="52" height="52" rx="16" fill="url(#vgFeedGrad)" />
              <circle cx="41" cy="11" r="2.4" fill="white" opacity="0.95" />
              <circle cx="41" cy="19" r="1.6" fill="white" opacity="0.6" />
              <circle cx="33" cy="11" r="1.6" fill="white" opacity="0.6" />
              <path
                d="M14 15 L26 38 L38 15"
                stroke="#ffffff"
                strokeWidth="5.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h2 className="feed-header-title">Latest Feed</h2>
          </div>

          <div className="feed-header-controls">
            <button
              type="button"
              className="feed-control-btn"
              onClick={fetchFeed}
              title="Refresh feed"
            >
              <span>🔄</span>
              <span>Refresh</span>
            </button>
            {user && (
              <button
                type="button"
                className="feed-control-btn feed-create-btn"
                onClick={onOpenCreatePost}
                title="Create a new post"
              >
                <span>➕</span>
                <span>Post</span>
              </button>
            )}
          </div>
        </div>

        {/* Full-width Segmented Filter Tabs */}
        <div className="feed-tabs-row">
          <button
            type="button"
            className={`feed-tab-pill ${!filterCloseFriends ? 'active' : ''}`}
            onClick={() => setFilterCloseFriends(false)}
          >
            <span>All Posts</span>
            <span className="feed-tab-count">{posts.length}</span>
          </button>
          <button
            type="button"
            className={`feed-tab-pill cf-tab-pill ${filterCloseFriends ? 'active' : ''}`}
            onClick={() => setFilterCloseFriends(true)}
            title="Filter by Close Friends"
          >
            <span>★ Close Friends</span>
            {closeFriendIds.size > 0 && (
              <span className="feed-tab-count cf-count">{closeFriendIds.size}</span>
            )}
          </button>
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
        /* Empty Feed State */
        filterCloseFriends ? (
          <div className="feed-empty-card">
            <div className="empty-feed-icon">⭐</div>
            <h3>No Close Friends posts yet</h3>
            <p>Tap the green star ★ button on any creator's post to add them to your Close Friends!</p>
            <button type="button" className="btn-secondary" onClick={() => setFilterCloseFriends(false)}>
              Show All Posts
            </button>
          </div>
        ) : (
          <div className="feed-empty-card">
            <div className="empty-feed-icon">📸</div>
            <h3>Your feed is waiting!</h3>
            <p>Be the first one to share a photo moment with the VibeGrid community.</p>
            {user ? (
              <button type="button" className="btn-primary" onClick={onOpenCreatePost}>
                Create Your First Post
              </button>
            ) : (
              <p className="feed-empty-hint">Sign in to start posting and liking photos.</p>
            )}
          </div>
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
                          onClick={() => onNavigateToProfile && onNavigateToProfile(post.username)}
                          style={{ cursor: 'pointer' }}
                        >
                          @{post.username}
                        </span>
                        <button
                          type="button"
                          className={`post-close-friend-btn ${isCloseFriend ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCloseFriend(post.user_id, post.username);
                          }}
                          title={isCloseFriend ? 'Close Friend (Click to remove)' : 'Add to Close Friends'}
                        >
                          ★
                        </button>
                      </div>
                      <span className="post-timestamp">{formatTimeAgo(post.created_at)}</span>
                    </div>
                  </div>

                {/* Delete button (Author only) */}
                {user && user.id === post.user_id && (
                  <button
                    type="button"
                    className="post-delete-btn"
                    onClick={() => handleDeletePost(post.id)}
                    disabled={deletingId === post.id}
                    title="Delete post"
                  >
                    {deletingId === post.id ? '⏳' : '🗑️'}
                  </button>
                )}
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
                />
                {/* Animated Heart Overlay on Double-Tap */}
                {animatingPostId === post.id && (
                  <div className="double-tap-heart-overlay">
                    ❤️
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
                  >
                    <span className="heart-icon-wrapper">
                      {post.is_liked ? '❤️' : '🤍'}
                    </span>
                    <span className="action-counter">{post.likes_count}</span>
                  </button>

                  <button
                    type="button"
                    className="post-action-btn"
                    onClick={() => setActiveCommentPost(post)}
                    title="View comments thread"
                  >
                    💬
                    <span className="action-counter">{post.comments_count}</span>
                  </button>
                </div>

                <div className="actions-right">
                  <button
                    type="button"
                    className={`post-action-btn post-save-btn ${post.is_saved ? 'saved' : ''}`}
                    onClick={() => handleToggleSave(post.id)}
                    title={post.is_saved ? 'Remove from saved' : 'Save post'}
                  >
                    {post.is_saved ? '🔖' : '📑'}
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

                {/* 1-Tap Quick Emoji Reactions */}
                <div className="feed-quick-emoji-row">
                  {['❤️', '🔥', '👏', '😍', '😂', '🥳'].map((em) => (
                    <button
                      key={em}
                      type="button"
                      className="feed-quick-emoji-btn"
                      onClick={() => handleQuickEmojiComment(post.id, em)}
                      title={`Quick comment ${em}`}
                    >
                      {em}
                    </button>
                  ))}
                  {reactionToast && reactionToast.postId === post.id && (
                    <span className="feed-emoji-toast-badge">
                      {reactionToast.emoji} Added!
                    </span>
                  )}
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
                    <input
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
    </div>
  );
}

/**
 * client/src/components/HashtagFeedModal.jsx
 * ==========================================
 * Dedicated Hashtag Topic Feed Modal / View
 * 
 * Features:
 * 1. Fetches all community posts tagged with a specific #hashtag.
 * 2. Header banner displaying the hashtag name and total post count.
 * 3. 3-column responsive square photo mosaic with hover engagement overlays.
 * 4. Interactive post detail modal with like, comment, and bookmark support.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import CommentsModal from './CommentsModal';
import { formatCaptionWithHashtags } from '../utils/textFormatters';
import { ExploreGridSkeleton } from './common/Skeleton';

export default function HashtagFeedModal({
  isOpen,
  tag,
  onClose,
  onNavigateToProfile,
  onHashtagClick
}) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detail Modal States
  const [selectedPost, setSelectedPost] = useState(null);
  const [activeCommentsPost, setActiveCommentsPost] = useState(null);

  const cleanTag = (tag || '').toLowerCase().replace(/^#/, '').trim();

  // Fetch posts for this hashtag
  const fetchHashtagPosts = async () => {
    if (!cleanTag) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`/hashtags/${encodeURIComponent(cleanTag)}/posts`);
      if (res.success && res.data) {
        setPosts(res.data.posts || []);
        setPostCount(res.data.postCount || (res.data.posts ? res.data.posts.length : 0));
      } else {
        setError(res.error || 'Failed to load hashtag feed.');
      }
    } catch (err) {
      setError(err.message || 'Error loading hashtag posts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && cleanTag) {
      fetchHashtagPosts();
      setSelectedPost(null);
    }
  }, [isOpen, cleanTag]);

  // Like toggle inside detail modal
  const handleToggleLike = async (postId) => {
    if (!user) {
      alert('Please sign in to like posts.');
      return;
    }

    try {
      const res = await apiClient.post(`/posts/${postId}/like`);
      if (res.success && res.data) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, is_liked: res.data.liked, likes_count: res.data.likes_count }
              : p
          )
        );
        if (selectedPost && selectedPost.id === postId) {
          setSelectedPost((prev) => ({
            ...prev,
            is_liked: res.data.liked,
            likes_count: res.data.likes_count
          }));
        }
      }
    } catch (err) {
      console.warn('[Hashtag Like Error]', err);
    }
  };

  // Save / Bookmark toggle inside detail modal
  const handleToggleSave = async (postId) => {
    if (!user) {
      alert('Please sign in to save posts.');
      return;
    }

    const currentPost = posts.find((p) => p.id === postId) || selectedPost;
    const prevSaved = !!currentPost?.is_saved;
    const newSaved = !prevSaved;

    // Optimistic UI updates
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, is_saved: newSaved } : p))
    );
    if (selectedPost && selectedPost.id === postId) {
      setSelectedPost((prev) => ({ ...prev, is_saved: newSaved }));
    }

    try {
      const res = await apiClient.post(`/posts/${postId}/save`);
      if (res.success && res.data) {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, is_saved: res.data.is_saved } : p))
        );
        if (selectedPost && selectedPost.id === postId) {
          setSelectedPost((prev) => ({ ...prev, is_saved: res.data.is_saved }));
        }
      }
    } catch (err) {
      console.warn('[Hashtag Save Error]', err);
      // Rollback
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, is_saved: prevSaved } : p))
      );
      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost((prev) => ({ ...prev, is_saved: prevSaved }));
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card hashtag-feed-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hashtag Header Banner */}
        <div className="hashtag-modal-header">
          <div className="hashtag-title-wrap">
            <div className="hashtag-icon-circle">#</div>
            <div className="hashtag-meta">
              <h2>#{cleanTag}</h2>
              <span className="hashtag-post-counter">
                {postCount} {postCount === 1 ? 'post' : 'posts'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close hashtag view"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="feed-error-banner" style={{ margin: '12px 16px' }}>
            ⚠️ {error}
            <button
              type="button"
              onClick={fetchHashtagPosts}
              className="inline-link"
              style={{ marginLeft: '8px' }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="hashtag-modal-body">
          {loading ? (
            <div style={{ padding: '8px' }}>
              <ExploreGridSkeleton count={6} />
            </div>
          ) : posts.length === 0 ? (
            <div className="hashtag-empty-box">
              <div className="hashtag-empty-icon">#️⃣</div>
              <h3>No Posts Yet</h3>
              <p>Be the first one to share a photo tagged with <strong>#{cleanTag}</strong>!</p>
            </div>
          ) : (
            <div className="hashtag-posts-grid">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="hashtag-grid-item"
                  onClick={() => setSelectedPost(post)}
                >
                  <img
                    src={post.image_url}
                    alt={post.caption || `Post with #${cleanTag}`}
                    className="hashtag-grid-img"
                    loading="lazy"
                  />
                  <div className="hashtag-grid-overlay">
                    <div className="overlay-author">@{post.username}</div>
                    <div className="overlay-metrics">
                      <span>❤️ {post.likes_count}</span>
                      <span>💬 {post.comments_count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Post Detail Modal */}
        {selectedPost && (
          <div
            className="modal-backdrop sub-modal-backdrop"
            onClick={() => setSelectedPost(null)}
          >
            <div
              className="modal-card post-detail-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div
                  className="detail-modal-author"
                  onClick={() => {
                    setSelectedPost(null);
                    onClose();
                    if (onNavigateToProfile) onNavigateToProfile(selectedPost.username);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {selectedPost.avatar_url ? (
                    <img
                      src={selectedPost.avatar_url}
                      alt={selectedPost.username}
                      className="nav-avatar-mini"
                    />
                  ) : (
                    <span className="nav-avatar-fallback-mini">
                      {selectedPost.username?.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <strong>@{selectedPost.username}</strong>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setSelectedPost(null)}
                >
                  ✕
                </button>
              </div>

              <div className="detail-modal-media">
                <img
                  src={selectedPost.image_url}
                  alt={selectedPost.caption || 'Community photo'}
                />
              </div>

              <div className="detail-modal-content">
                {selectedPost.caption && (
                  <p className="detail-modal-caption">
                    <strong
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedPost(null);
                        onClose();
                        if (onNavigateToProfile) onNavigateToProfile(selectedPost.username);
                      }}
                    >
                      @{selectedPost.username}
                    </strong>{' '}
                    {formatCaptionWithHashtags(
                      selectedPost.caption,
                      (t) => {
                        setSelectedPost(null);
                        if (onHashtagClick) onHashtagClick(t);
                      },
                      (u) => {
                        setSelectedPost(null);
                        onClose();
                        if (onNavigateToProfile) onNavigateToProfile(u);
                      }
                    )}
                  </p>
                )}

                <div className="detail-modal-footer">
                  <div className="detail-modal-stats">
                    <button
                      type="button"
                      className={`post-action-btn ${selectedPost.is_liked ? 'liked' : ''}`}
                      onClick={() => handleToggleLike(selectedPost.id)}
                      title={selectedPost.is_liked ? 'Unlike post' : 'Like post'}
                    >
                      {selectedPost.is_liked ? '❤️' : '🤍'}{' '}
                      <span className="action-counter">{selectedPost.likes_count}</span>
                    </button>
                    <button
                      type="button"
                      className="post-action-btn"
                      onClick={() => setActiveCommentsPost(selectedPost)}
                      title="View comments"
                    >
                      💬{' '}
                      <span className="action-counter">{selectedPost.comments_count}</span>
                    </button>
                    <button
                      type="button"
                      className={`post-action-btn post-save-btn ${selectedPost.is_saved ? 'saved' : ''}`}
                      onClick={() => handleToggleSave(selectedPost.id)}
                      title={selectedPost.is_saved ? 'Remove from saved' : 'Save post'}
                    >
                      {selectedPost.is_saved ? '🔖' : '📑'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Comments Modal */}
        <CommentsModal
          post={activeCommentsPost}
          isOpen={!!activeCommentsPost}
          onClose={() => setActiveCommentsPost(null)}
          onCommentCountChange={(postId, newCount) => {
            setPosts((prev) =>
              prev.map((p) => (p.id === postId ? { ...p, comments_count: newCount } : p))
            );
            if (selectedPost && selectedPost.id === postId) {
              setSelectedPost((prev) => ({ ...prev, comments_count: newCount }));
            }
          }}
          onNavigateToProfile={(u) => {
            setActiveCommentsPost(null);
            setSelectedPost(null);
            onClose();
            if (onNavigateToProfile) onNavigateToProfile(u);
          }}
        />
      </div>
    </div>
  );
}

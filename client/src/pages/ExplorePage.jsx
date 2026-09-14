/**
 * client/src/pages/ExplorePage.jsx
 * ================================
 * User Search & Community Explore Discovery Grid
 * 
 * Features:
 * 1. Debounced (300ms) live typeahead user search across usernames and full names.
 * 2. Instant search results dropdown with user avatars and navigation.
 * 3. Discovery photo grid showcasing community posts ordered by engagement.
 * 4. Interactive post preview modal with likes and comments integration.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import CommentsModal from '../components/CommentsModal';
import HashtagFeedModal from '../components/HashtagFeedModal';
import HidePostModal from '../components/HidePostModal';
import { formatCaptionWithHashtags } from '../utils/textFormatters';

export default function ExplorePage({ onNavigateToProfile }) {
  const { user } = useAuth();

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef(null);
  const debounceRef = useRef(null);

  // Explore Posts State
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [error, setError] = useState(null);

  // Trending Topics State (Phase 13)
  const [trendingTags, setTrendingTags] = useState([]);
  const [activeHashtag, setActiveHashtag] = useState(null);

  // Modal States
  const [selectedPost, setSelectedPost] = useState(null);
  const [activeCommentsPost, setActiveCommentsPost] = useState(null);
  const [moderatingId, setModeratingId] = useState(null);
  const [postToHide, setPostToHide] = useState(null);

  // Fetch explore posts
  const fetchExplorePosts = async () => {
    try {
      setLoadingPosts(true);
      setError(null);
      const res = await apiClient.get('/posts/explore');
      if (res.success && res.data?.posts) {
        setPosts(res.data.posts);
      } else {
        setError(res.error || 'Failed to load explore feed.');
      }
    } catch (err) {
      setError(err.message || 'Error loading explore posts.');
    } finally {
      setLoadingPosts(false);
    }
  };

  // Fetch trending hashtags
  const fetchTrendingTags = async () => {
    try {
      const res = await apiClient.get('/hashtags/trending');
      if (res.success && res.data?.hashtags) {
        setTrendingTags(res.data.hashtags);
      }
    } catch (err) {
      console.warn('[Trending Tags Fetch Error]', err);
    }
  };

  useEffect(() => {
    fetchExplorePosts();
    fetchTrendingTags();
  }, []);

  // Debounced Search Handler
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    setShowDropdown(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiClient.get(`/users/search?q=${encodeURIComponent(query.trim())}`);
        if (res.success && res.data?.users) {
          setSearchResults(res.data.users);
        }
      } catch (err) {
        console.warn('[Search Error]', err);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Like toggle inside explore post modal
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
      console.warn('[Explore Like Error]', err);
    }
  };

  // Save / Bookmark toggle inside Explore detail modal (Phase 12)
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
      console.warn('[Explore Save Error]', err);
      // Rollback
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, is_saved: prevSaved } : p))
      );
      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost((prev) => ({ ...prev, is_saved: prevSaved }));
      }
    }
  };

  // Moderate / Hide post (Admin / Test accounts) - Opens modern bottom-sheet
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
        if (selectedPost && selectedPost.id === postToHide) {
          setSelectedPost(null);
        }
        setPostToHide(null);
      } else {
        alert(res.error || 'Failed to hide post.');
      }
    } catch (err) {
      alert(err.message || 'Failed to hide post.');
    } finally {
      setModeratingId(null);
    }
  };

  return (
    <div className="explore-page-container">
      {/* Search Header Bar */}
      <div className="explore-search-bar-wrapper" ref={searchContainerRef}>
        <div className="explore-search-input-box">
          <span className="search-icon">🔍</span>
          <label htmlFor="explore-search-input" className="sr-only">
            Search creators by username or name
          </label>
          <input
            id="explore-search-input"
            name="search"
            aria-label="Search creators by username or name"
            type="search"
            inputMode="search"
            placeholder="Search creators by username or name..."
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => {
              if (searchQuery.trim()) setShowDropdown(true);
            }}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowDropdown(false);
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showDropdown && searchQuery.trim() && (
          <div className="search-dropdown-menu">
            {searching ? (
              <div className="search-status-row">
                <div className="spinner-mini"></div> Searching creators...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="search-status-row no-results">
                No users found for "{searchQuery}"
              </div>
            ) : (
              searchResults.map((u) => (
                <div
                  key={u.id}
                  className="search-result-item"
                  onClick={() => {
                    setShowDropdown(false);
                    setSearchQuery('');
                    if (onNavigateToProfile) onNavigateToProfile(u.username);
                  }}
                >
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.username} className="search-avatar" />
                  ) : (
                    <div className="search-avatar-fallback">
                      {u.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="search-user-info">
                    <span className="search-username">@{u.username}</span>
                    {u.full_name && <span className="search-fullname">{u.full_name}</span>}
                  </div>
                  {u.is_following && <span className="search-following-badge">Following</span>}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Trending Topics Horizontal Bar (Phase 13) */}
      {trendingTags.length > 0 && (
        <div className="trending-tags-bar">
          <div className="trending-label">
            <span>🔥</span>
            <span>Trending:</span>
          </div>
          <div className="trending-tags-scroll">
            {trendingTags.map((t) => (
              <button
                key={t.id}
                type="button"
                className="trending-tag-pill"
                onClick={() => setActiveHashtag(t.name)}
                title={`Explore #${t.name} (${t.post_count} posts)`}
              >
                <span className="pill-tag-symbol">#</span>
                <span className="pill-tag-name">{t.name}</span>
                <span className="pill-tag-count">{t.post_count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Explore Grid Header */}
      <div className="explore-grid-header">
        <h2>Explore Moments</h2>
        <p>Discover trending photos and new creators across VibeGrid</p>
      </div>

      {error && (
        <div className="feed-error-banner">
          ⚠️ {error}
          <button type="button" onClick={fetchExplorePosts} className="inline-link" style={{ marginLeft: '8px' }}>
            Try Again
          </button>
        </div>
      )}

      {/* Explore Photos Grid */}
      {loadingPosts ? (
        <div className="explore-loading-container">
          <div className="spinner"></div>
          <p>Discovering photos...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="explore-empty-state">
          <div className="empty-explore-icon">🌐</div>
          <h3>No Explore Posts Yet</h3>
          <p>When creators share photos, they will appear here in the community explore grid.</p>
        </div>
      ) : (
        <div className="explore-mosaic-grid">
          {posts.map((post) => (
            <div
              key={post.id}
              className="explore-grid-card"
              onClick={() => setSelectedPost(post)}
            >
              <img
                src={post.image_url}
                alt={post.caption || 'Community photo'}
                className="explore-grid-img"
                loading="lazy"
              />
              <div className="explore-grid-overlay">
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

      {/* Post Detail Modal */}
      {selectedPost && (
        <div className="modal-backdrop" onClick={() => setSelectedPost(null)}>
          <div className="modal-card post-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div
                className="detail-modal-author"
                onClick={() => {
                  setSelectedPost(null);
                  if (onNavigateToProfile) onNavigateToProfile(selectedPost.username);
                }}
                style={{ cursor: 'pointer' }}
              >
                {selectedPost.avatar_url ? (
                  <img src={selectedPost.avatar_url} alt={selectedPost.username} className="nav-avatar-mini" />
                ) : (
                  <span className="nav-avatar-fallback-mini">
                    {selectedPost.username?.charAt(0).toUpperCase()}
                  </span>
                )}
                <strong>@{selectedPost.username}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {user && ([1, 2, 3, 4].includes(Number(user.id)) || Number(user.test) === 1) && (
                  <button
                    type="button"
                    onClick={() => handleModeratePost(selectedPost.id)}
                    disabled={moderatingId === selectedPost.id}
                    title="Hide Post (Content Moderation)"
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      color: '#ef4444',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {moderatingId === selectedPost.id ? '⏳' : '🛡️ Hide Post'}
                  </button>
                )}
                <button type="button" className="modal-close-btn" onClick={() => setSelectedPost(null)}>
                  ✕
                </button>
              </div>
            </div>

            <div className="detail-modal-media">
              <img src={selectedPost.image_url} alt={selectedPost.caption || 'Community photo'} />
            </div>

            <div className="detail-modal-content">
              {selectedPost.caption && (
                <p className="detail-modal-caption">
                  <strong
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedPost(null);
                      if (onNavigateToProfile) onNavigateToProfile(selectedPost.username);
                    }}
                  >
                    @{selectedPost.username}
                  </strong>{' '}
                  {formatCaptionWithHashtags(
                    selectedPost.caption,
                    (tag) => {
                      setSelectedPost(null);
                      setActiveHashtag(tag);
                    },
                    onNavigateToProfile
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
        onNavigateToProfile={onNavigateToProfile}
      />

      {/* Hashtag Topic Feed Modal (Phase 13) */}
      <HashtagFeedModal
        isOpen={!!activeHashtag}
        tag={activeHashtag}
        onClose={() => setActiveHashtag(null)}
        onNavigateToProfile={onNavigateToProfile}
        onHashtagClick={(tag) => setActiveHashtag(tag)}
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

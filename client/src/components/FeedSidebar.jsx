/**
 * client/src/components/FeedSidebar.jsx
 * =====================================
 * Desktop Right Sidebar Component
 * 
 * Features:
 * 1. "Suggestions" section: lists suggested users with avatars, names, and interactive Follow buttons.
 * 2. "Trending" section: shows top hashtags with post count (e.g. #travel 12.4K posts) and clickable tag modals.
 * 3. Sticky positioning with smooth hover states and dark/light theme support.
 */

import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';

function formatPostCount(count) {
  const num = Number(count) || 0;
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}M posts`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}K posts`;
  }
  return `${num} ${num === 1 ? 'post' : 'posts'}`;
}

export default function FeedSidebar({ onNavigateToProfile, onHashtagClick }) {
  const { user, guardDemoAction } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [followingMap, setFollowingMap] = useState({});
  const [actionLoadingMap, setActionLoadingMap] = useState({});

  // 1. Fetch Suggestions
  useEffect(() => {
    let isMounted = true;
    const fetchSuggestions = async () => {
      try {
        setLoadingSuggestions(true);
        const res = await apiClient.get('/users/suggestions');
        if (isMounted && res.success && res.data?.suggestions) {
          setSuggestions(res.data.suggestions);
          // Initialize following state from API
          const initialMap = {};
          res.data.suggestions.forEach((u) => {
            initialMap[u.id] = !!u.is_following;
          });
          setFollowingMap(initialMap);
        }
      } catch (err) {
        console.error('Failed to load suggestions:', err);
      } finally {
        if (isMounted) setLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
    return () => { isMounted = false; };
  }, [user?.id]);

  // 2. Fetch Trending Topics
  useEffect(() => {
    let isMounted = true;
    const fetchTrending = async () => {
      try {
        setLoadingTrending(true);
        const res = await apiClient.get('/hashtags/trending');
        if (isMounted && res.success && res.data?.hashtags) {
          // Load all available trending hashtags
          setTrending(res.data.hashtags || []);
        }
      } catch (err) {
        console.error('Failed to load trending hashtags:', err);
      } finally {
        if (isMounted) setLoadingTrending(false);
      }
    };

    fetchTrending();
    return () => { isMounted = false; };
  }, []);

  // Handle Follow / Following Toggle
  const handleFollowToggle = async (targetUser) => {
    if (guardDemoAction && guardDemoAction('follow')) return;

    if (!user) {
      alert('Please sign in to follow creators.');
      return;
    }
    const userId = targetUser.id;
    const currentlyFollowing = !!followingMap[userId];
    const newFollowing = !currentlyFollowing;

    // Optimistic UI update
    setFollowingMap((prev) => ({ ...prev, [userId]: newFollowing }));
    setActionLoadingMap((prev) => ({ ...prev, [userId]: true }));

    try {
      const res = await apiClient.post(`/users/${targetUser.username}/follow-toggle`);
      if (res.success && res.data) {
        setFollowingMap((prev) => ({ ...prev, [userId]: !!res.data.is_following }));
      } else {
        throw new Error(res.error || 'Failed to toggle follow');
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
      // Rollback on error
      setFollowingMap((prev) => ({ ...prev, [userId]: currentlyFollowing }));
    } finally {
      setActionLoadingMap((prev) => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <aside className="feed-desktop-sidebar" aria-label="Suggestions and Trending">
      {/* Current User Quick Mini Profile (if signed in) */}
      {user && (
        <div className="sidebar-user-card" onClick={() => onNavigateToProfile && onNavigateToProfile(user.username)}>
          <div className="sidebar-user-avatar-wrap">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} className="sidebar-user-avatar" />
            ) : (
              <div className="sidebar-user-avatar-fallback">
                {user.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-username">@{user.username}</span>
            <span className="sidebar-user-fullname">{user.full_name || 'VibeGrid Creator'}</span>
          </div>
          <button
            type="button"
            className="sidebar-profile-switch-btn"
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToProfile && onNavigateToProfile(user.username);
            }}
          >
            Profile
          </button>
        </div>
      )}

      {/* SECTION 1: Suggestions */}
      <section className="sidebar-section">
        <div className="sidebar-section-header">
          <h3 className="sidebar-section-title">Suggestions For You</h3>
        </div>

        {loadingSuggestions ? (
          <div className="sidebar-loading-list">
            {[1, 2, 3].map((n) => (
              <div key={n} className="sidebar-skeleton-row shimmer">
                <div className="sidebar-skeleton-circle" />
                <div className="sidebar-skeleton-lines">
                  <div className="sidebar-skeleton-line short" />
                  <div className="sidebar-skeleton-line" />
                </div>
              </div>
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          <p className="sidebar-empty-text">No suggestions available right now.</p>
        ) : (
          <div className="sidebar-suggestions-list">
            {suggestions.map((item) => {
              const isFollowing = followingMap[item.id];
              const isLoading = actionLoadingMap[item.id];

              return (
                <div key={item.id} className="sidebar-suggestion-item">
                  <div
                    className="sidebar-item-left"
                    onClick={() => onNavigateToProfile && onNavigateToProfile(item.username)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="sidebar-avatar-wrap">
                      {item.avatar_url ? (
                        <img src={item.avatar_url} alt={item.username} className="sidebar-avatar" />
                      ) : (
                        <div className="sidebar-avatar-fallback">
                          {item.username?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="sidebar-text-col">
                      <span className="sidebar-item-username">@{item.username}</span>
                      <span className="sidebar-item-sub">
                        {item.full_name || `${item.followers_count || 0} followers`}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`sidebar-follow-btn ${isFollowing ? 'following' : ''}`}
                    onClick={() => handleFollowToggle(item)}
                    disabled={isLoading}
                  >
                    {isLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 2: Trending */}
      <section className="sidebar-section">
        <div className="sidebar-section-header">
          <h3 className="sidebar-section-title">Trending</h3>
          <span className="sidebar-section-badge">🔥</span>
        </div>

        {loadingTrending ? (
          <div className="sidebar-loading-list">
            {[1, 2, 3].map((n) => (
              <div key={n} className="sidebar-skeleton-row shimmer">
                <div className="sidebar-skeleton-lines">
                  <div className="sidebar-skeleton-line short" />
                  <div className="sidebar-skeleton-line" />
                </div>
              </div>
            ))}
          </div>
        ) : trending.length === 0 ? (
          <p className="sidebar-empty-text">No trending tags yet. Be the first to tag a post!</p>
        ) : (
          <div className="sidebar-trending-list">
            {trending.map((tag) => (
              <div
                key={tag.id}
                className="sidebar-trending-item"
                onClick={() => onHashtagClick && onHashtagClick(tag.name)}
                role="button"
                tabIndex={0}
              >
                <div className="sidebar-trending-info">
                  <span className="sidebar-trending-tag">#{tag.name}</span>
                  <span className="sidebar-trending-count">
                    {formatPostCount(tag.post_count)}
                  </span>
                </div>
                <span className="sidebar-trending-arrow">›</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer Meta */}
      <footer className="sidebar-footer">
        <div className="sidebar-footer-links">
          <span>About</span> • <span>Help</span> • <span>Press</span> • <span>API</span> • <span>Privacy</span> • <span>Terms</span>
        </div>
        <p className="sidebar-footer-copyright">© 2026 VIBEGRID FROM ATUL</p>
      </footer>
    </aside>
  );
}

/**
 * client/src/components/FollowListModal.jsx
 * =========================================
 * Modal Dialog for Viewing Followers & Following Lists
 * 
 * Features:
 * 1. Fetches and displays list of users (avatar, username, full name).
 * 2. Supports both 'followers' and 'following' view modes.
 * 3. Navigates directly to any user's profile on click.
 * 4. Inline follow/unfollow toggle button for creators in the list.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { UserListSkeleton } from './common/Skeleton';

export default function FollowListModal({ isOpen, onClose, username, type = 'followers', onNavigateToProfile }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [togglingUser, setTogglingUser] = useState(null);

  // Fetch followers or following
  const fetchList = async () => {
    if (!username) return;
    try {
      setLoading(true);
      setError(null);
      const endpoint = type === 'following' ? `/users/${username}/following` : `/users/${username}/followers`;
      const res = await apiClient.get(endpoint);
      if (res.success && res.data?.users) {
        setUsers(res.data.users);
      } else {
        setError(res.error || 'Failed to load list.');
      }
    } catch (err) {
      setError(err.message || 'Error loading social list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && username) {
      fetchList();
    }
  }, [isOpen, username, type]);

  // Handle inline follow / unfollow toggle
  const handleInlineFollowToggle = async (targetUser) => {
    if (!currentUser) {
      alert('Please sign in to follow users.');
      return;
    }

    try {
      setTogglingUser(targetUser.username);
      const res = await apiClient.post(`/users/${targetUser.username}/follow-toggle`);
      if (res.success && res.data) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === targetUser.id ? { ...u, is_following: res.data.isFollowing } : u
          )
        );
      }
    } catch (err) {
      console.warn('[Inline Follow Error]', err);
    } finally {
      setTogglingUser(null);
    }
  };

  if (!isOpen) return null;

  const title = type === 'following' ? 'Following' : 'Followers';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card follow-list-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="follow-modal-title">
            <span>{title}</span>
            <span className="comments-count-pill">{users.length}</span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && <div className="modal-error-banner">⚠️ {error}</div>}

        {/* User List */}
        <div className="follow-list-content">
          {loading ? (
            <div style={{ padding: '8px' }}>
              <UserListSkeleton count={5} />
            </div>
          ) : users.length === 0 ? (
            <div className="follow-list-empty">
              <div className="empty-follow-icon">👥</div>
              <p className="no-users-title">No {title.toLowerCase()} yet</p>
              <p className="no-users-subtitle">
                {type === 'following'
                  ? `@${username} isn't following anyone yet.`
                  : `@${username} doesn't have any followers yet.`}
              </p>
            </div>
          ) : (
            <div className="follow-users-scroll">
              {users.map((u) => {
                const isMe = currentUser && currentUser.id === u.id;
                return (
                  <div key={u.id} className="follow-user-row">
                    <div
                      className="follow-user-meta"
                      onClick={() => {
                        onClose();
                        if (onNavigateToProfile) onNavigateToProfile(u.username);
                      }}
                    >
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.username} className="follow-user-avatar" />
                      ) : (
                        <div className="follow-user-avatar-fallback">
                          {u.username?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="follow-user-info">
                        <span className="follow-user-username">@{u.username}</span>
                        {u.full_name && <span className="follow-user-fullname">{u.full_name}</span>}
                      </div>
                    </div>

                    {currentUser && !isMe && (
                      <button
                        type="button"
                        className={`btn-follow-action ${u.is_following ? 'following' : 'follow'}`}
                        onClick={() => handleInlineFollowToggle(u)}
                        disabled={togglingUser === u.username}
                      >
                        {togglingUser === u.username
                          ? '⏳'
                          : u.is_following
                          ? 'Following'
                          : 'Follow'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

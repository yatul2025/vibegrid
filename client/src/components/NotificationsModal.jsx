/**
 * client/src/components/NotificationsModal.jsx
 * ============================================
 * Slide-Over Activity & Notifications Drawer
 * 
 * Features:
 * 1. Chronological list of real-time alerts (Likes, Comments, Follows).
 * 2. Unread indicators (blue glow dot + highlighted background).
 * 3. Quick "Mark all as read" button.
 * 4. Dismiss individual notifications.
 * 5. Direct navigation to creator profiles.
 * 6. Post preview thumbnails for likes and comments.
 */

import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';

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

export default function NotificationsModal({
  isOpen,
  onClose,
  onNavigateToProfile,
  onUnreadCountChange
}) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [markingRead, setMarkingRead] = useState(false);

  // Fetch notifications whenever modal is opened
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get('/notifications');
      if (res.success && res.data?.notifications) {
        setNotifications(res.data.notifications);
      } else {
        setError(res.error || 'Failed to load notifications.');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      setMarkingRead(true);
      const res = await apiClient.put('/notifications/mark-read');
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, is_read: true }))
        );
        if (onUnreadCountChange) {
          onUnreadCountChange(0);
        }
      }
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
    } finally {
      setMarkingRead(false);
    }
  };

  // Dismiss / delete an individual notification
  const handleDeleteNotification = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await apiClient.delete(`/notifications/${id}`);
      if (res.success) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (onUnreadCountChange) {
          onUnreadCountChange();
        }
      }
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  };

  if (!isOpen) return null;

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <div className="modal-backdrop notifications-backdrop" onClick={onClose}>
      <div
        className="notifications-drawer"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="notifications-header">
          <div className="notifications-header-title">
            <h3>Notifications</h3>
            {hasUnread && (
              <span className="notifications-badge-counter">
                {notifications.filter((n) => !n.is_read).length} new
              </span>
            )}
          </div>

          <div className="notifications-header-actions">
            {hasUnread && (
              <button
                type="button"
                className="btn-link-accent"
                onClick={handleMarkAllAsRead}
                disabled={markingRead}
                title="Mark all as read"
              >
                {markingRead ? 'Updating...' : '✓ Mark all as read'}
              </button>
            )}
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              title="Close notifications"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="notifications-body">
          {error && <div className="form-error-banner">⚠️ {error}</div>}

          {loading ? (
            <div className="notifications-loading">
              <div className="spinner"></div>
              <p>Loading activity...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notifications-empty-state">
              <div className="empty-bell-icon">🔔</div>
              <h4>No notifications yet</h4>
              <p>
                When members of the VibeGrid community like your photos, comment, or
                follow you, their updates will appear here.
              </p>
            </div>
          ) : (
            <div className="notifications-list">
              {notifications.map((notif) => {
                let actionIcon = '❤️';
                let actionText = 'liked your photo';
                if (notif.type === 'comment') {
                  actionIcon = '💬';
                  actionText = `commented: "${notif.comment_text || ''}"`;
                } else if (notif.type === 'follow') {
                  actionIcon = '👤';
                  actionText = 'started following you';
                }

                return (
                  <div
                    key={notif.id}
                    className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
                  >
                    {/* Unread indicator dot */}
                    {!notif.is_read && <span className="notification-unread-dot" />}

                    {/* Sender Avatar with action badge */}
                    <div
                      className="notification-avatar-wrap"
                      onClick={() => {
                        onNavigateToProfile && onNavigateToProfile(notif.sender_username);
                        onClose();
                      }}
                      title={`View @${notif.sender_username}'s profile`}
                      style={{ cursor: 'pointer' }}
                    >
                      <img
                        src={notif.sender_avatar_url || '/uploads/avatars/default-avatar.png'}
                        alt={notif.sender_username}
                        className="notification-avatar-img"
                      />
                      <span className="notification-type-badge">{actionIcon}</span>
                    </div>

                    {/* Notification Content */}
                    <div className="notification-content">
                      <p className="notification-text">
                        <strong
                          onClick={() => {
                            onNavigateToProfile && onNavigateToProfile(notif.sender_username);
                            onClose();
                          }}
                          className="notification-username-link"
                        >
                          @{notif.sender_username}
                        </strong>{' '}
                        {actionText}
                      </p>
                      <span className="notification-time">
                        {formatTimeAgo(notif.created_at)}
                      </span>
                    </div>

                    {/* Action Meta (Post thumbnail or follow action) */}
                    {notif.post_image_url && (
                      <div className="notification-post-thumb-wrap">
                        <img
                          src={notif.post_image_url}
                          alt="Post thumbnail"
                          className="notification-post-thumb"
                        />
                      </div>
                    )}

                    {notif.type === 'follow' && (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => {
                          onNavigateToProfile && onNavigateToProfile(notif.sender_username);
                          onClose();
                        }}
                      >
                        Profile
                      </button>
                    )}

                    {/* Dismiss Button */}
                    <button
                      type="button"
                      className="notification-dismiss-btn"
                      onClick={(e) => handleDeleteNotification(notif.id, e)}
                      title="Dismiss notification"
                    >
                      ✕
                    </button>
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

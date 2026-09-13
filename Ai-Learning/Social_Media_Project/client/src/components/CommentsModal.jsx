/**
 * client/src/components/CommentsModal.jsx
 * =======================================
 * Interactive Instagram-Style Comments Modal
 * 
 * Features:
 * 1. Side-by-side post preview and scrollable comments thread.
 * 2. Real-time comment submission with 500-char validation.
 * 3. Author and post-owner deletion permissions.
 * 4. Syncs updated comments count with parent post in real-time.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { formatCaptionWithHashtags } from '../utils/textFormatters';

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d`;
}

export default function CommentsModal({
  post,
  isOpen,
  onClose,
  onCommentCountChange,
  onNavigateToProfile,
  onHashtagClick
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const commentsEndRef = useRef(null);

  // Fetch comments from API
  const fetchComments = async () => {
    if (!post?.id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`/posts/${post.id}/comments`);
      if (res.success && res.data?.comments) {
        setComments(res.data.comments);
      }
    } catch (err) {
      setError(err.message || 'Failed to load comments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && post?.id) {
      fetchComments();
    }
  }, [isOpen, post?.id]);

  // Scroll to bottom when new comment arrives
  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Submit new comment
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    if (newComment.trim().length > 500) {
      setError('Comment cannot exceed 500 characters.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await apiClient.post(`/posts/${post.id}/comments`, {
        comment_text: newComment.trim().slice(0, 500)
      });

      if (res.success && res.data?.comment) {
        setComments((prev) => [...prev, res.data.comment]);
        setNewComment('');
        if (onCommentCountChange) {
          onCommentCountChange(post.id, res.data.comments_count);
        }
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      setError(err.message || 'Error posting comment.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete a comment
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      const res = await apiClient.delete(`/posts/comments/${commentId}`);
      if (res.success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        if (onCommentCountChange) {
          onCommentCountChange(post.id, res.data.comments_count);
        }
      }
    } catch (err) {
      alert(err.message || 'Error deleting comment.');
    }
  };

  if (!isOpen || !post) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card comments-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="comments-modal-title">
            <span>Comments</span>
            <span className="comments-count-pill">{comments.length}</span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && <div className="modal-error-banner">⚠️ {error}</div>}

        <div className="comments-modal-body">
          {/* Left: Media Preview */}
          <div className="comments-media-pane">
            <img src={post.image_url} alt={post.caption || 'Post image'} className="comments-post-img" />
          </div>

          {/* Right: Comments Thread */}
          <div className="comments-thread-pane">
            {/* Post Author & Caption Entry */}
            <div className="comments-header-entry">
              {post.avatar_url ? (
                <img src={post.avatar_url} alt={post.username} className="comment-avatar" />
              ) : (
                <div className="comment-avatar-fallback">
                  {post.username?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="comment-bubble">
                <span
                  className="comment-author-name"
                  onClick={() => {
                    onClose();
                    if (onNavigateToProfile) onNavigateToProfile(post.username);
                  }}
                >
                  @{post.username}
                </span>{' '}
                <span className="comment-text">
                  {formatCaptionWithHashtags(
                    post.caption || 'No caption',
                    (tag) => {
                      onClose();
                      if (onHashtagClick) onHashtagClick(tag);
                    },
                    (u) => {
                      onClose();
                      if (onNavigateToProfile) onNavigateToProfile(u);
                    }
                  )}
                </span>
                <div className="comment-time">{formatTimeAgo(post.created_at)}</div>
              </div>
            </div>

            <div className="comments-divider"></div>

            {/* Comments List */}
            <div className="comments-scroll-list">
              {loading ? (
                <div className="comments-loading-state">
                  <div className="spinner"></div>
                  <p>Loading comments...</p>
                </div>
              ) : comments.length === 0 ? (
                <div className="comments-empty-state">
                  <p className="no-comments-title">No comments yet.</p>
                  <p className="no-comments-subtitle">Start the conversation by leaving a message!</p>
                </div>
              ) : (
                comments.map((c) => {
                  const isCommentAuthor = user && user.id === c.user_id;
                  const isPostOwner = user && user.id === post.user_id;
                  const canDelete = isCommentAuthor || isPostOwner;

                  return (
                    <div key={c.id} className="comment-item-row">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt={c.username} className="comment-avatar" />
                      ) : (
                        <div className="comment-avatar-fallback">
                          {c.username?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="comment-bubble">
                        <span
                          className="comment-author-name"
                          onClick={() => {
                            onClose();
                            if (onNavigateToProfile) onNavigateToProfile(c.username);
                          }}
                        >
                          @{c.username}
                        </span>{' '}
                        <span className="comment-text">
                          {formatCaptionWithHashtags(
                            c.comment_text,
                            (tag) => {
                              onClose();
                              if (onHashtagClick) onHashtagClick(tag);
                            },
                            (u) => {
                              onClose();
                              if (onNavigateToProfile) onNavigateToProfile(u);
                            }
                          )}
                        </span>
                        <div className="comment-meta-row">
                          <span className="comment-time">{formatTimeAgo(c.created_at)}</span>
                          {canDelete && (
                            <button
                              type="button"
                              className="comment-delete-link"
                              onClick={() => handleDeleteComment(c.id)}
                              title="Delete comment"
                            >
                              delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Bottom Add Comment Bar */}
            {user ? (
              <form onSubmit={handleSubmit} className="comments-input-bar">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  maxLength={500}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value.slice(0, 500))}
                  disabled={submitting}
                />
                <div className="input-bar-actions">
                  <span className={`char-counter-mini ${500 - newComment.length < 50 ? 'warning' : ''}`}>
                    {500 - newComment.length}
                  </span>
                  <button
                    type="submit"
                    className="comment-post-btn"
                    disabled={submitting || !newComment.trim()}
                  >
                    Post
                  </button>
                </div>
              </form>
            ) : (
              <div className="comments-signin-prompt">
                Please sign in to leave a comment.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

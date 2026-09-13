/**
 * client/src/components/StoryViewerModal.jsx
 * ==========================================
 * Full-Screen Auto-Advancing Story Viewer
 * 
 * Features:
 * 1. Hardware-accelerated CSS keyframe progress bars (5s per story).
 * 2. Tap left / right side navigation to move backward/forward.
 * 3. Press and hold (mouse down / touch start) to pause timer.
 * 4. Close Friends green star badge (★).
 * 5. Floating reaction pill sticker (🔮 👀 🥳) directly on the story.
 * 6. Floating corner sparkle heart (💖✨).
 * 7. Bottom interactive reply capsule ("Send message") connected to direct messaging.
 * 8. Story heart like button (🤍 / ❤️) with animated heart burst.
 * 9. Quick reaction emoji tray (🔮, 👀, 🥳, ❤️, 🔥, 👏, 😂, 😍).
 * 10. Floating particle burst animations for lively feedback.
 * 11. Story deletion for author's own stories.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 24);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export default function StoryViewerModal({
  isOpen,
  creators = [],
  initialCreatorIndex = 0,
  closeFriendIds = new Set(),
  onToggleCloseFriend,
  onClose,
  onStoryDeleted,
  onStoryViewed
}) {
  const { user } = useAuth();
  const [creatorIndex, setCreatorIndex] = useState(initialCreatorIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Interactive reply & reactions states
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [likedStoryIds, setLikedStoryIds] = useState(new Set());
  const [particles, setParticles] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);
  const [showEmojiTray, setShowEmojiTray] = useState(false);

  const storyStartTimeRef = useRef(Date.now());
  const toastTimerRef = useRef(null);

  // Sync initial creator index when opened
  useEffect(() => {
    if (isOpen) {
      setCreatorIndex(initialCreatorIndex >= 0 && initialCreatorIndex < creators.length ? initialCreatorIndex : 0);
      setStoryIndex(0);
      setAnimKey((k) => k + 1);
      setIsPaused(false);
      setIsTyping(false);
      setReplyText('');
      storyStartTimeRef.current = Date.now();
    }
  }, [isOpen, initialCreatorIndex, creators.length]);

  const currentCreator = creators[creatorIndex];
  const currentStories = currentCreator?.stories || [];
  const currentStory = currentStories[storyIndex];

  // Track start time on story / creator change
  useEffect(() => {
    storyStartTimeRef.current = Date.now();
    setReplyText('');
    setShowEmojiTray(false);
  }, [creatorIndex, storyIndex]);

  // Notify parent of story viewed
  useEffect(() => {
    if (isOpen && currentCreator?.userId && onStoryViewed) {
      onStoryViewed(currentCreator.userId);
    }
  }, [isOpen, currentCreator?.userId, onStoryViewed]);

  // Navigate to next story or next creator
  const handleNext = useCallback(() => {
    if (isTyping) return; // Don't advance while user is typing a reply
    if (storyIndex < currentStories.length - 1) {
      setStoryIndex((prev) => prev + 1);
      setAnimKey((k) => k + 1);
    } else if (creatorIndex < creators.length - 1) {
      setCreatorIndex((prev) => prev + 1);
      setStoryIndex(0);
      setAnimKey((k) => k + 1);
    } else {
      onClose();
    }
  }, [isTyping, storyIndex, currentStories.length, creatorIndex, creators.length, onClose]);

  // Navigate to previous story or previous creator
  const handlePrev = useCallback(() => {
    if (isTyping) return;
    const elapsed = Date.now() - storyStartTimeRef.current;
    if (elapsed > 1200) {
      // Replay current story if played for more than 1.2 seconds
      storyStartTimeRef.current = Date.now();
      setAnimKey((k) => k + 1);
      return;
    }

    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
      setAnimKey((k) => k + 1);
    } else if (creatorIndex > 0) {
      const prevCreatorIndex = creatorIndex - 1;
      const prevCreatorStories = creators[prevCreatorIndex]?.stories || [];
      setCreatorIndex(prevCreatorIndex);
      setStoryIndex(Math.max(0, prevCreatorStories.length - 1));
      setAnimKey((k) => k + 1);
    } else {
      setAnimKey((k) => k + 1);
    }
  }, [isTyping, storyIndex, creatorIndex, creators]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Don't intercept keys if user is typing in the input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          e.target.blur();
          setIsTyping(false);
        }
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  // Helper to show transient toast feedback
  const showToast = (msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  };

  // Trigger floating particle burst
  const triggerParticles = (emoji = '❤️') => {
    const burstCount = 8;
    const newParticles = [];
    for (let i = 0; i < burstCount; i++) {
      newParticles.push({
        id: `${Date.now()}-${i}-${Math.random()}`,
        emoji,
        left: 20 + Math.random() * 60, // 20% to 80%
        drift: (Math.random() - 0.5) * 80,
        scale: 0.8 + Math.random() * 0.7,
        duration: 1.2 + Math.random() * 0.6,
        delay: Math.random() * 0.2
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);

    // Clean up particles after animation completes
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.some((np) => np.id === p.id)));
    }, 2000);
  };

  // Toggle Story Heart Like
  const handleToggleStoryLike = async (e) => {
    e?.stopPropagation();
    if (!user) {
      showToast('Please sign in to like stories');
      return;
    }
    if (!currentStory || !currentCreator) return;

    const isLiked = likedStoryIds.has(currentStory.id);
    setLikedStoryIds((prev) => {
      const next = new Set(prev);
      if (isLiked) {
        next.delete(currentStory.id);
      } else {
        next.add(currentStory.id);
      }
      return next;
    });

    if (!isLiked) {
      triggerParticles('❤️');
      showToast(`Liked @${currentCreator.username}'s story ❤️`);
      // Send DM notification if user is not liking own story
      if (currentCreator.username !== user.username) {
        try {
          await apiClient.post(`/messages/${currentCreator.username}`, {
            content: `❤️ Liked your story`
          });
        } catch {}
      }
    }
  };

  // Send Direct Message Reply
  const handleSendReply = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!replyText.trim() || sendingReply) return;
    if (!user) {
      showToast('Please sign in to reply');
      return;
    }
    if (!currentCreator) return;

    const content = replyText.trim();
    try {
      setSendingReply(true);
      await apiClient.post(`/messages/${currentCreator.username}`, {
        content: `Replied to story: ${content}`
      });

      triggerParticles('✨');
      showToast(`Reply sent to @${currentCreator.username} ✈️`);
      setReplyText('');
      setIsTyping(false);
    } catch (err) {
      showToast('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  // Send Quick Emoji Reaction
  const handleReaction = async (emoji, e) => {
    e?.stopPropagation();
    if (!user) {
      showToast('Please sign in to react');
      return;
    }
    if (!currentCreator) return;

    triggerParticles(emoji);
    showToast(`Reacted ${emoji} to @${currentCreator.username}`);

    if (currentCreator.username !== user.username) {
      try {
        await apiClient.post(`/messages/${currentCreator.username}`, {
          content: `Reacted ${emoji} to your story`
        });
      } catch {}
    }
  };

  // Delete current story
  const handleDeleteStory = async () => {
    if (!currentStory) return;
    setIsPaused(true);

    if (!window.confirm('Are you sure you want to delete this story?')) {
      setIsPaused(false);
      return;
    }

    try {
      setDeleting(true);
      const res = await apiClient.delete(`/stories/${currentStory.id}`);
      if (res.success) {
        if (onStoryDeleted) {
          onStoryDeleted(currentStory.id);
        }
        if (currentStories.length > 1) {
          if (storyIndex >= currentStories.length - 1) {
            setStoryIndex((prev) => Math.max(0, prev - 1));
          }
          setAnimKey((k) => k + 1);
          setIsPaused(false);
        } else {
          if (creatorIndex < creators.length - 1) {
            setCreatorIndex((prev) => prev);
            setStoryIndex(0);
            setAnimKey((k) => k + 1);
            setIsPaused(false);
          } else {
            onClose();
          }
        }
      } else {
        alert(res.error || 'Failed to delete story.');
        setIsPaused(false);
      }
    } catch (err) {
      alert(err.message || 'Error deleting story.');
      setIsPaused(false);
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen || !currentCreator || !currentStory) return null;

  const isMyStory = user && currentCreator.userId === user.id;
  const isCurrentStoryLiked = likedStoryIds.has(currentStory.id);
  const pausedEffective = isPaused || isTyping;

  return (
    <div className="story-viewer-overlay" onClick={onClose}>
      <div
        className="story-viewer-container"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={() => {
          if (!isTyping) setIsPaused(true);
        }}
        onMouseUp={() => {
          if (!isTyping) setIsPaused(false);
        }}
        onTouchStart={() => {
          if (!isTyping) setIsPaused(true);
        }}
        onTouchEnd={() => {
          if (!isTyping) setIsPaused(false);
        }}
      >
        {/* Floating Particles Canvas */}
        <div className="story-particles-container">
          {particles.map((p) => (
            <div
              key={p.id}
              className="story-floating-particle"
              style={{
                left: `${p.left}%`,
                '--drift-x': `${p.drift}px`,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
                transform: `scale(${p.scale})`
              }}
            >
              {p.emoji}
            </div>
          ))}
        </div>

        {/* Transient Reaction / Reply Toast */}
        {toastMessage && (
          <div className="story-reaction-toast">
            {toastMessage}
          </div>
        )}

        {/* 1. Top Segmented Progress Bars */}
        <div className="story-progress-row">
          {currentStories.map((s, idx) => {
            let statusClass = 'unseen';
            if (idx < storyIndex) {
              statusClass = 'completed';
            } else if (idx === storyIndex) {
              statusClass = `animating ${pausedEffective ? 'paused' : ''}`;
            }

            return (
              <div key={s.id} className="story-progress-track">
                <div
                  key={`${s.id}-${idx === storyIndex ? animKey : 'static'}`}
                  className={`story-progress-fill ${statusClass}`}
                  style={idx === storyIndex ? { animationPlayState: pausedEffective ? 'paused' : 'running' } : undefined}
                  onAnimationEnd={idx === storyIndex ? handleNext : undefined}
                />
              </div>
            );
          })}
        </div>

        {/* 2. Story Header (Creator Details & Controls) */}
        <div
          className="story-header-row"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="story-author-meta">
            <div className="story-viewer-avatar-wrap">
              <img
                src={currentCreator.avatarUrl || '/uploads/avatars/default-avatar.png'}
                alt={currentCreator.username}
                className="story-header-avatar"
              />
              {/* Close Friends green star badge */}
              {closeFriendIds.has(currentCreator.userId) && (
                <span className="story-avatar-star-badge" title="Close Friends">★</span>
              )}
            </div>
            <div className="story-header-names">
              <div className="story-username-line">
                <span className="story-header-username">{currentCreator.username}</span>
                {!isMyStory && (
                  <button
                    type="button"
                    className={`story-cf-pill-btn ${closeFriendIds.has(currentCreator.userId) ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onToggleCloseFriend && currentCreator) {
                        onToggleCloseFriend(currentCreator.userId, currentCreator.username);
                        triggerParticles('⭐');
                      }
                    }}
                    title={closeFriendIds.has(currentCreator.userId) ? 'In Close Friends (Click to remove)' : 'Add to Close Friends'}
                  >
                    ★ {closeFriendIds.has(currentCreator.userId) ? 'Close Friends' : 'Add to Close Friends'}
                  </button>
                )}
              </div>
              <span className="story-header-time">{formatTimeAgo(currentStory.createdAt)}</span>
            </div>
          </div>

          <div className="story-header-actions">
            {/* Play / Pause Toggle Button */}
            <button
              type="button"
              className="story-action-btn pause-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsPaused((prev) => !prev);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              title={pausedEffective ? 'Resume (Space)' : 'Pause (Space)'}
            >
              {pausedEffective ? '▶' : '❚❚'}
            </button>

            {/* Delete button for story owner */}
            {isMyStory && (
              <button
                type="button"
                className="story-action-btn delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteStory();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                title="Delete this story"
                disabled={deleting}
              >
                🗑️
              </button>
            )}

            {/* Close button */}
            <button
              type="button"
              className="story-action-btn close-btn"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              title="Close viewer (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Floating Paused Notification (Non-shifting overlay) */}
        {pausedEffective && (
          <div className="story-paused-indicator-banner">
            <span>{isTyping ? '💬 Replying' : '⏸️ Paused'}</span>
          </div>
        )}

        {/* 3. Story Media Display */}
        <div className="story-media-wrapper">
          <img
            src={currentStory.mediaUrl}
            alt={`Story by ${currentCreator.username}`}
            className="story-main-image"
          />

          {/* Floating Reaction Pill (🔮 👀 🥳 from the screenshot) */}
          <div className="story-floating-reaction-pill" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="story-pill-emoji-btn"
              onClick={(e) => handleReaction('🔮', e)}
              title="React with 🔮"
            >
              🔮
            </button>
            <button
              type="button"
              className="story-pill-emoji-btn"
              onClick={(e) => handleReaction('👀', e)}
              title="React with 👀"
            >
              👀
            </button>
            <button
              type="button"
              className="story-pill-emoji-btn"
              onClick={(e) => handleReaction('🥳', e)}
              title="React with 🥳"
            >
              🥳
            </button>
          </div>

          {/* Floating Sparkle Heart from screenshot corner */}
          <div
            className="story-corner-sparkle-heart"
            onClick={(e) => handleReaction('💖', e)}
            title="Send love"
          >
            💖✨
          </div>

          {/* Interactive Left / Right Tap Zones */}
          <div
            className="story-tap-zone story-tap-left"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            title="Previous story"
          />
          <div
            className="story-tap-zone story-tap-right"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            title="Next story"
          />
        </div>

        {/* 4. Quick Emoji Tray (Drawer) */}
        {showEmojiTray && (
          <div className="story-quick-emoji-tray" onClick={(e) => e.stopPropagation()}>
            {['🔮', '👀', '🥳', '❤️', '🔥', '👏', '😂', '😍', '✨', '💯'].map((em) => (
              <button
                key={em}
                type="button"
                className="story-tray-emoji-btn"
                onClick={(e) => handleReaction(em, e)}
              >
                {em}
              </button>
            ))}
          </div>
        )}

        {/* 5. Bottom Reply Bar (Exact layout from the screenshot) */}
        <div className="story-bottom-reply-bar" onClick={(e) => e.stopPropagation()}>
          <form className="story-reply-form-capsule" onSubmit={handleSendReply}>
            <input
              type="text"
              className="story-reply-input"
              placeholder={`Send message...`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onFocus={() => setIsTyping(true)}
              onBlur={() => {
                if (!replyText.trim()) {
                  setIsTyping(false);
                }
              }}
            />
            {replyText.trim() ? (
              <button
                type="submit"
                className="story-reply-send-arrow"
                disabled={sendingReply}
                title="Send reply"
              >
                {sendingReply ? '⏳' : '➔'}
              </button>
            ) : (
              <button
                type="button"
                className="story-toggle-emojis-btn"
                onClick={() => setShowEmojiTray((prev) => !prev)}
                title="Quick emojis"
              >
                😊
              </button>
            )}
          </form>

          {/* Heart like button right next to input pill */}
          <button
            type="button"
            className={`story-heart-like-btn ${isCurrentStoryLiked ? 'liked' : ''}`}
            onClick={handleToggleStoryLike}
            title={isCurrentStoryLiked ? 'Unlike story' : 'Like story'}
          >
            {isCurrentStoryLiked ? '❤️' : '🤍'}
          </button>
        </div>
      </div>
    </div>
  );
}

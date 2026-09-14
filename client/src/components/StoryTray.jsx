/**
 * client/src/components/StoryTray.jsx
 * ===================================
 * Horizontal Instagram-style Story Tray
 * 
 * Features:
 * 1. "Your Story" circle:
 *    - Gradient ring if you have active stories; subtle ring otherwise.
 *    - Quick '+' badge to add a new story.
 *    - Clicking avatar opens viewer if stories exist, or creator modal if none.
 * 2. Creator story circles:
 *    - Vibrant multi-stop gradient border ring for unviewed stories.
 *    - Soft gray border for stories already viewed in current session.
 *    - Truncated username label.
 * 3. Smooth horizontal drag/scroll with hidden scrollbars.
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function StoryTray({
  creators = [],
  loading = false,
  viewedCreatorIds = new Set(),
  closeFriendIds = new Set(),
  onOpenViewer,
  onOpenCreateStory
}) {
  const { user, guardDemoAction } = useAuth();

  // Find if current user has active stories in the creators list
  const myCreatorEntry = creators.find((c) => user && c.userId === user.id);
  const myStories = myCreatorEntry?.stories || [];
  const hasMyStories = myStories.length > 0;

  // Filter other creators (excluding current user so current user isn't duplicated)
  const otherCreators = creators.filter((c) => !user || c.userId !== user.id);

  return (
    <div className="story-tray-wrapper">
      <div className="story-tray-scroll">
        {/* 1. "Your Story" Circle */}
        {user && (
          <div className="story-item story-item-self">
            <div
              className={`story-avatar-container ${hasMyStories ? 'has-active-stories' : 'no-active-stories'}`}
              onClick={() => {
                if (hasMyStories) {
                  // Open viewer starting at current user's stories
                  const myIndex = creators.findIndex((c) => c.userId === user.id);
                  onOpenViewer(myIndex !== -1 ? myIndex : 0);
                } else {
                  if (guardDemoAction('create_story')) return;
                  onOpenCreateStory();
                }
              }}
              title={hasMyStories ? 'View your story' : 'Add to your story'}
              role="button"
              tabIndex={0}
            >
              <img
                src={user.avatar_url || '/uploads/avatars/default-avatar.png'}
                alt="Your avatar"
                className="story-avatar-img"
              />
              <button
                type="button"
                className="story-add-badge"
                onClick={(e) => {
                  e.stopPropagation();
                  if (guardDemoAction('create_story')) return;
                  onOpenCreateStory();
                }}
                title="Add new story"
              >
                +
              </button>
            </div>
            <span className="story-username-label">Your Story</span>
          </div>
        )}

        {/* Loading Skeleton if stories are loading */}
        {loading && creators.length === 0 && (
          <>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="story-item story-item-skeleton">
                <div className="story-skeleton-circle"></div>
                <div className="story-skeleton-text"></div>
              </div>
            ))}
          </>
        )}

        {/* 2. Other Creators' Story Circles */}
        {otherCreators.map((creator) => {
          const isCloseFriend = closeFriendIds.has(creator.userId);
          const isViewed = viewedCreatorIds.has(creator.userId);
          const creatorIndex = creators.findIndex((c) => c.userId === creator.userId);

          return (
            <div
              key={creator.userId}
              className="story-item"
              onClick={() => onOpenViewer(creatorIndex)}
              role="button"
              tabIndex={0}
            >
              <div
                className={`story-avatar-container ${
                  isCloseFriend
                    ? 'is-close-friend'
                    : isViewed
                    ? 'is-viewed'
                    : 'has-active-stories'
                }`}
              >
                <img
                  src={creator.avatarUrl || '/uploads/avatars/default-avatar.png'}
                  alt={creator.username}
                  className="story-avatar-img"
                />
                {isCloseFriend && (
                  <span className="story-tray-star-badge" title="Close Friend">★</span>
                )}
                {creator.isExternal && !isCloseFriend && (
                  <span className="story-tray-discovery-badge" title="Discovery Story">🌐</span>
                )}
              </div>
              <span className="story-username-label" title={creator.username}>
                {creator.username.length > 10 ? `${creator.username.slice(0, 9)}…` : creator.username}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

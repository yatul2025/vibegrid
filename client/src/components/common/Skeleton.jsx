/**
 * client/src/components/common/Skeleton.jsx
 * =========================================
 * VibeGrid Global Skeleton Loading System
 * 
 * Reusable, layout-matched skeleton loading components based on the 
 * existing Feed Skeleton shimmer design, speed, and styling.
 */

import React from 'react';

/**
 * Primitive: Skeleton Line
 */
export function SkeletonLine({
  width = '100%',
  height = '14px',
  borderRadius = 'var(--radius-full, 9999px)',
  style = {},
  className = ''
}) {
  return (
    <div
      className={`skeleton-line shimmer ${className}`}
      style={{ width, height, borderRadius, ...style }}
    />
  );
}

/**
 * Primitive: Skeleton Circle / Avatar
 */
export function SkeletonCircle({
  size = 40,
  style = {},
  className = ''
}) {
  return (
    <div
      className={`skeleton-avatar shimmer ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: '50%',
        flexShrink: 0,
        ...style
      }}
    />
  );
}

/**
 * Primitive: Skeleton Rect / Media / Card
 */
export function SkeletonRect({
  width = '100%',
  height = '120px',
  borderRadius = '14px',
  style = {},
  className = ''
}) {
  return (
    <div
      className={`skeleton-media shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style
      }}
    />
  );
}

/**
 * Primitive: Skeleton Button / Pill
 */
export function SkeletonPill({
  width = '70px',
  height = '28px',
  borderRadius = '9999px',
  style = {},
  className = ''
}) {
  return (
    <div
      className={`skeleton-btn shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius,
        flexShrink: 0,
        ...style
      }}
    />
  );
}

/**
 * Layout: Explore / Post Grid Skeleton
 * Matches explore-mosaic-grid and profile photo grid layouts
 */
export function ExploreGridSkeleton({ count = 9, className = '' }) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <div className={`explore-mosaic-grid vg-skeleton-grid ${className}`} data-testid="explore-grid-skeleton">
      {items.map((i) => (
        <div key={i} className="explore-grid-card vg-skeleton-photo-card shimmer">
          <div className="skeleton-media" style={{ height: '100%', minHeight: '180px' }} />
        </div>
      ))}
    </div>
  );
}

/**
 * Layout: Conversations List Skeleton
 * Matches conversation-card layout in Messages inbox
 */
export function ConversationsListSkeleton({ count = 6, className = '' }) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <div className={`vg-skeleton-conversations-list ${className}`} data-testid="conversations-skeleton">
      {items.map((i) => (
        <div key={i} className="conversation-card vg-skeleton-conv-card">
          <div className="conversation-avatar-wrap">
            <SkeletonCircle size={44} />
          </div>
          <div className="conversation-meta" style={{ flex: 1, gap: '6px' }}>
            <div className="conversation-name-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SkeletonLine width={i % 2 === 0 ? '110px' : '140px'} height="14px" />
              <SkeletonLine width="38px" height="10px" />
            </div>
            <div className="conversation-preview-row" style={{ marginTop: '4px' }}>
              <SkeletonLine width={i % 3 === 0 ? '85%' : i % 2 === 0 ? '70%' : '55%'} height="12px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Layout: Chat Thread Skeleton
 * Realistic incoming (left with avatar) and outgoing (right) encrypted message bubbles
 */
export function ChatThreadSkeleton({ count = 5, className = '' }) {
  const bubbles = [
    { isMe: false, width: '58%', lines: 2 },
    { isMe: true, width: '42%', lines: 1 },
    { isMe: false, width: '68%', lines: 3 },
    { isMe: true, width: '50%', lines: 2 },
    { isMe: false, width: '35%', lines: 1 }
  ].slice(0, count);

  return (
    <div className={`chat-messages-container vg-skeleton-chat-thread ${className}`} data-testid="chat-thread-skeleton">
      {bubbles.map((b, idx) => (
        <div
          key={idx}
          className={`message-row ${b.isMe ? 'message-outgoing' : 'message-incoming'} vg-skeleton-message-row`}
          style={{
            display: 'flex',
            justifyContent: b.isMe ? 'flex-end' : 'flex-start',
            alignItems: 'flex-end',
            gap: '8px',
            margin: '10px 0'
          }}
        >
          {!b.isMe && <SkeletonCircle size={28} style={{ marginBottom: '4px' }} />}
          <div
            className="message-bubble vg-skeleton-bubble shimmer"
            style={{
              width: b.width,
              padding: '12px 14px',
              borderRadius: b.isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: b.isMe ? 'var(--primary-light, rgba(99,102,241,0.15))' : 'var(--bg-card, rgba(255,255,255,0.05))',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            {Array.from({ length: b.lines }).map((_, lineIdx) => (
              <SkeletonLine
                key={lineIdx}
                width={lineIdx === b.lines - 1 && b.lines > 1 ? '60%' : '100%'}
                height="12px"
              />
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
              <SkeletonLine width="28px" height="8px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Layout: Profile Page Skeleton
 * Matches Profile Header (avatar, username, stats counts, bio, action buttons) & Photo Grid
 */
export function ProfileSkeleton({ className = '' }) {
  return (
    <div className={`profile-page-container vg-skeleton-profile ${className}`} data-testid="profile-skeleton">
      {/* Profile Header */}
      <div className="profile-header-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px 16px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <SkeletonCircle size={88} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <SkeletonLine width="160px" height="20px" />
              <SkeletonPill width="84px" height="28px" />
            </div>
            {/* Stats Row */}
            <div style={{ display: 'flex', gap: '24px', margin: '4px 0' }}>
              <SkeletonLine width="64px" height="14px" />
              <SkeletonLine width="76px" height="14px" />
              <SkeletonLine width="76px" height="14px" />
            </div>
            <SkeletonLine width="120px" height="14px" />
            <SkeletonLine width="80%" height="12px" />
          </div>
        </div>

        {/* Tab Navigation Placeholders */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '48px', borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '12px' }}>
          <SkeletonPill width="80px" height="30px" />
          <SkeletonPill width="80px" height="30px" />
        </div>
      </div>

      {/* Profile Photo Grid */}
      <ExploreGridSkeleton count={6} />
    </div>
  );
}

/**
 * Layout: Notifications / Activity Skeleton
 * Matches notification-item rows
 */
export function NotificationsSkeleton({ count = 6, className = '' }) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <div className={`notifications-list vg-skeleton-notifications ${className}`} data-testid="notifications-skeleton">
      {items.map((i) => (
        <div
          key={i}
          className="notification-item vg-skeleton-notif-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)'
          }}
        >
          <SkeletonCircle size={44} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SkeletonLine width={i % 2 === 0 ? '75%' : '60%'} height="13px" />
            <SkeletonLine width="50px" height="10px" />
          </div>
          <SkeletonRect width="36px" height="36px" borderRadius="8px" />
        </div>
      ))}
    </div>
  );
}

/**
 * Layout: User List Skeleton
 * For Members, FollowListModal, New Chat Search, and Add Member Drawer
 */
export function UserListSkeleton({ count = 5, compact = false, className = '' }) {
  const items = Array.from({ length: count }, (_, i) => i);
  const avatarSize = compact ? 34 : 42;

  return (
    <div className={`vg-skeleton-user-list ${className}`} data-testid="user-list-skeleton">
      {items.map((i) => (
        <div
          key={i}
          className="vg-skeleton-user-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: compact ? '8px 12px' : '12px 14px',
            borderRadius: '12px',
            marginBottom: '4px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <SkeletonCircle size={avatarSize} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
              <SkeletonLine width={i % 2 === 0 ? '110px' : '135px'} height="13px" />
              <SkeletonLine width={i % 2 === 0 ? '70px' : '85px'} height="10px" />
            </div>
          </div>
          <SkeletonPill width={compact ? '56px' : '72px'} height={compact ? '24px' : '28px'} />
        </div>
      ))}
    </div>
  );
}

/**
 * Layout: Group Overview Skeleton
 * Matches GroupSettingsModal Overview Screen
 */
export function GroupOverviewSkeleton({ className = '' }) {
  return (
    <div className={`space-y-4 vg-skeleton-group-overview ${className}`} data-testid="group-overview-skeleton">
      {/* Group Hero Header */}
      <div className="p-4 rounded-2xl vg-card-subtle flex items-center gap-4">
        <SkeletonCircle size={56} />
        <div className="space-y-2 flex-1">
          <SkeletonLine width="160px" height="18px" />
          <SkeletonLine width="90px" height="12px" />
        </div>
      </div>

      {/* Action Pills */}
      <div className="grid grid-cols-3 gap-2">
        <SkeletonRect height="50px" borderRadius="14px" />
        <SkeletonRect height="50px" borderRadius="14px" />
        <SkeletonRect height="50px" borderRadius="14px" />
      </div>

      {/* Settings Row Skeletons */}
      <div className="p-3 rounded-2xl vg-card-subtle space-y-3">
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <SkeletonCircle size={32} />
            <SkeletonLine width="120px" height="13px" />
          </div>
          <SkeletonLine width="30px" height="12px" />
        </div>
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <SkeletonCircle size={32} />
            <SkeletonLine width="140px" height="13px" />
          </div>
          <SkeletonLine width="30px" height="12px" />
        </div>
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <SkeletonCircle size={32} />
            <SkeletonLine width="110px" height="13px" />
          </div>
          <SkeletonLine width="30px" height="12px" />
        </div>
      </div>
    </div>
  );
}

/**
 * Layout: Media & Files Skeleton
 * Matches MediaFilesView (category tabs + photo/file placeholders)
 */
export function MediaFilesSkeleton({ className = '' }) {
  return (
    <div className={`space-y-4 vg-skeleton-media-files ${className}`} data-testid="media-files-skeleton">
      {/* Tab bar placeholder */}
      <div style={{ display: 'flex', gap: '8px', padding: '4px 0' }}>
        <SkeletonPill width="88px" height="30px" />
        <SkeletonPill width="88px" height="30px" />
        <SkeletonPill width="80px" height="30px" />
        <SkeletonPill width="80px" height="30px" />
      </div>

      {/* Media Grid Placeholder */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRect key={i} height="100px" borderRadius="10px" />
        ))}
      </div>
    </div>
  );
}

/**
 * Layout: Pinned Messages Skeleton
 * Matches PinnedMessagesView cards
 */
export function PinnedMessagesSkeleton({ count = 3, className = '' }) {
  return (
    <div className={`space-y-3 vg-skeleton-pinned-messages ${className}`} data-testid="pinned-messages-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3.5 rounded-xl vg-card-subtle space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SkeletonCircle size={24} />
              <SkeletonLine width="90px" height="12px" />
            </div>
            <SkeletonLine width="40px" height="10px" />
          </div>
          <SkeletonLine width={i % 2 === 0 ? '90%' : '75%'} height="13px" />
          <SkeletonLine width="50%" height="11px" />
        </div>
      ))}
    </div>
  );
}

/**
 * Layout: Join Requests Skeleton
 * Matches JoinRequestsView cards
 */
export function JoinRequestsSkeleton({ count = 3, className = '' }) {
  return (
    <div className={`space-y-3 vg-skeleton-join-requests ${className}`} data-testid="join-requests-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3.5 rounded-xl vg-card-subtle flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <SkeletonCircle size={40} />
            <div className="space-y-1.5 flex-1">
              <SkeletonLine width="110px" height="13px" />
              <SkeletonLine width="75px" height="10px" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SkeletonPill width="64px" height="28px" />
            <SkeletonPill width="64px" height="28px" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Layout: Settings Page Skeleton
 * Matches SettingsPage layout (user card + navigation chips + section rows)
 */
export function SettingsSkeleton({ className = '' }) {
  return (
    <div className={`settings-container vg-skeleton-settings ${className}`} data-testid="settings-skeleton" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px 16px' }}>
      {/* Profile Card */}
      <div className="settings-profile-card shimmer" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '18px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
        <SkeletonCircle size={56} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <SkeletonLine width="140px" height="16px" />
          <SkeletonLine width="90px" height="12px" />
        </div>
      </div>

      {/* Preference section rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <SkeletonCircle size={32} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <SkeletonLine width={i % 2 === 0 ? '130px' : '160px'} height="14px" />
                <SkeletonLine width={i % 2 === 0 ? '80px' : '100px'} height="10px" />
              </div>
            </div>
            <SkeletonPill width="42px" height="24px" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Layout: Comments Skeleton
 * Matches CommentsModal rows
 */
export function CommentsSkeleton({ count = 4, className = '' }) {
  return (
    <div className={`vg-skeleton-comments ${className}`} data-testid="comments-skeleton" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '12px 0' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <SkeletonCircle size={34} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SkeletonLine width="90px" height="12px" />
              <SkeletonLine width="40px" height="10px" />
            </div>
            <SkeletonLine width={i % 2 === 0 ? '90%' : '70%'} height="12px" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Layout: Call History Skeleton
 * Matches CallHistoryModal rows
 */
export function CallHistorySkeleton({ count = 5, className = '' }) {
  return (
    <div className={`vg-skeleton-call-history ${className}`} data-testid="call-history-skeleton" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SkeletonCircle size={38} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <SkeletonLine width="110px" height="13px" />
              <SkeletonLine width="70px" height="10px" />
            </div>
          </div>
          <SkeletonCircle size={32} />
        </div>
      ))}
    </div>
  );
}

const Skeleton = {
  Line: SkeletonLine,
  Circle: SkeletonCircle,
  Rect: SkeletonRect,
  Pill: SkeletonPill,
  ExploreGrid: ExploreGridSkeleton,
  ConversationsList: ConversationsListSkeleton,
  ChatThread: ChatThreadSkeleton,
  Profile: ProfileSkeleton,
  Notifications: NotificationsSkeleton,
  UserList: UserListSkeleton,
  GroupOverview: GroupOverviewSkeleton,
  MediaFiles: MediaFilesSkeleton,
  PinnedMessages: PinnedMessagesSkeleton,
  JoinRequests: JoinRequestsSkeleton,
  Settings: SettingsSkeleton,
  Comments: CommentsSkeleton,
  CallHistory: CallHistorySkeleton
};

export default Skeleton;

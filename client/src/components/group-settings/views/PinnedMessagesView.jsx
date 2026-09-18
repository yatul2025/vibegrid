/**
 * client/src/components/group-settings/views/PinnedMessagesView.jsx
 * =================================================================
 * Screen 6: Pinned Messages — Unified VibeGrid Design
 */

import React from 'react';
import {
  Pin,
  PinOff,
  Image as ImageIcon,
  MessageSquare,
  Clock,
  Sparkles
} from 'lucide-react';
import { PinnedMessagesSkeleton } from '../../common/Skeleton';

export default function PinnedMessagesView({
  pinnedMessages = [],
  isAdmin = false,
  onUnpinMessage,
  onCloseModal,
  onShowToast,
  loading = false
}) {
  if (loading && pinnedMessages.length === 0) {
    return <PinnedMessagesSkeleton count={3} />;
  }
  const formatTime = (ts) => {
    if (!ts) return '1d';
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-4 text-left">
      {pinnedMessages.length === 0 ? (
        <div className="py-12 px-4 text-center space-y-2 vg-card-subtle">
          <div className="w-10 h-10 mx-auto rounded-xl bg-[var(--bg-page)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)]">
            <Pin size={20} className="rotate-45" />
          </div>
          <p className="text-xs font-semibold text-[var(--text-primary)] m-0">No pinned messages</p>
          <p className="text-[11px] text-[var(--text-muted)] m-0 max-w-xs mx-auto">
            Pin important messages, guidelines, or announcements so everyone in the group can find them easily.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="p-2.5 rounded-xl bg-[var(--primary-light)] border border-[var(--primary)] text-xs text-[var(--primary)] flex items-center gap-2">
            <Pin size={14} className="rotate-45 shrink-0" />
            <span>{pinnedMessages.length} {pinnedMessages.length === 1 ? 'message pinned' : 'messages pinned'} in this conversation</span>
          </div>

          {pinnedMessages.map((msg) => {
            const senderName = msg.sender_name || msg.full_name || msg.sender?.full_name || msg.username || 'Member';
            const senderUsername = msg.sender_username || msg.username || msg.sender?.username || 'user';
            return (
              <div
                key={msg.id}
                className="p-3.5 rounded-xl vg-card-subtle space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)] flex items-center justify-center text-xs font-bold">
                      {(senderName || 'U')[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[var(--text-primary)] m-0 leading-tight">{senderName}</p>
                      <p className="text-[10px] text-[var(--text-muted)] m-0">@{senderUsername}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--text-muted)]">{msg.time || formatTime(msg.created_at)}</span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onUnpinMessage) onUnpinMessage(msg.id);
                        }}
                        title="Unpin message"
                        className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-hover)] transition-all"
                      >
                        <PinOff size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-[var(--text-secondary)] m-0 pl-0.5 break-words leading-relaxed">
                  {msg.content}
                </p>

                {(msg.hasImage || msg.message_type === 'image') && (
                  <div className="mt-1.5 rounded-lg overflow-hidden border border-[var(--border-color)] h-24 bg-[var(--bg-page)] flex items-center justify-center">
                    <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs">
                      <ImageIcon size={15} className="text-[var(--primary)]" />
                      <span>Image attachment preview</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

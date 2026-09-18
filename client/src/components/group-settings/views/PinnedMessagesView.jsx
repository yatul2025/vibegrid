/**
 * client/src/components/group-settings/views/PinnedMessagesView.jsx
 * =================================================================
 * Screen 6: Pinned Messages
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

export default function PinnedMessagesView({
  pinnedMessages = [],
  isAdmin = false,
  onUnpinMessage,
  onCloseModal,
  onShowToast
}) {
  const formatTime = (ts) => {
    if (!ts) return '1d';
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 text-left">
      {pinnedMessages.length === 0 ? (
        <div className="py-12 px-4 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-500">
            <Pin size={22} className="rotate-45" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">No pinned messages</p>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
              Pin important messages, guidelines, or announcements so everyone in the group can find them easily.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {pinnedMessages.map((msg) => {
            const senderName = msg.sender_name || msg.full_name || msg.sender?.full_name || msg.username || 'Member';
            const senderUsername = msg.sender_username || msg.username || msg.sender?.username || 'user';
            return (
              <div
                key={msg.id}
                className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-cyan-300">
                      {(senderName || 'U')[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">{senderName}</p>
                      <p className="text-[10px] text-zinc-400">@{senderUsername}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500">{msg.time || formatTime(msg.created_at)}</span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onUnpinMessage) onUnpinMessage(msg.id);
                        }}
                        title="Unpin message"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-white/10 transition-all"
                      >
                        <PinOff size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed pl-1 break-words">
                  {msg.content}
                </p>

                {(msg.hasImage || msg.message_type === 'image') && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-white/10 h-28 bg-black/40 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs">
                      <ImageIcon size={16} className="text-purple-400" />
                      <span>Image attachment preview</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pin a Message Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            if (onCloseModal) onCloseModal();
            if (onShowToast) onShowToast('Tap and hold any message in chat to pin it.', 'info');
          }}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition-all hover:scale-[1.01]"
        >
          <Pin size={15} />
          <span>Pin a Message</span>
        </button>
      </div>
    </div>
  );
}

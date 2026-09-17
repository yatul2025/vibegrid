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

  // Mock initial pinned messages if none returned yet
  const displayList = pinnedMessages.length > 0 ? pinnedMessages : [
    {
      id: 101,
      sender_name: 'Riya Singh',
      sender_username: 'riya_singh',
      time: '2d',
      content: 'Welcome to the group! 🎉 Make sure to read the guidelines in the group info before posting.'
    },
    {
      id: 102,
      sender_name: 'ATUL YADAV',
      sender_username: 'atul_yadav',
      time: '1d',
      content: 'Check out the new features and explore our media vault!'
    },
    {
      id: 103,
      sender_name: 'Pooja Gupta',
      sender_username: 'pooja_gupta',
      time: '12h',
      content: 'This is our official group photo ✨',
      hasImage: true
    }
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200 text-left">
      <div className="space-y-3">
        {displayList.map((msg) => (
          <div
            key={msg.id}
            className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-cyan-300">
                  {(msg.sender_name || 'U')[0]}
                </div>
                <div>
                  <p className="text-xs font-bold text-white leading-tight">{msg.sender_name}</p>
                  <p className="text-[10px] text-zinc-400">@{msg.sender_username || 'member'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500">{msg.time || formatTime(msg.created_at)}</span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onUnpinMessage) onUnpinMessage(msg.id);
                      if (onShowToast) onShowToast('Message unpinned', 'success');
                    }}
                    title="Unpin message"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-white/10 transition-all"
                  >
                    <PinOff size={14} />
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed pl-1">
              {msg.content}
            </p>

            {msg.hasImage && (
              <div className="mt-2 rounded-lg overflow-hidden border border-white/10 h-28 bg-black/40 flex items-center justify-center">
                <div className="flex items-center gap-2 text-zinc-400 text-xs">
                  <ImageIcon size={16} className="text-purple-400" />
                  <span>Image attachment preview</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

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

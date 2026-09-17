/**
 * client/src/components/group-settings/views/GroupInfoView.jsx
 * ============================================================
 * Screen 5: Group Info & Metadata
 */

import React, { useState } from 'react';
import {
  Users,
  Edit3,
  UserPlus,
  Share2,
  MoreHorizontal,
  Calendar,
  User,
  Hash,
  Copy,
  Check,
  Bell,
  Clock,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

export default function GroupInfoView({
  group,
  convDetails,
  members = [],
  currentUser,
  isAdmin,
  isOwner,
  onNavigate,
  onOpenAddMember,
  onUpdateTitle,
  onUpdateDescription,
  onShowToast
}) {
  const [copiedId, setCopiedId] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const title = group?.title || group?.partner_full_name || 'Group Chat';
  const description = convDetails?.description || group?.description || 'No description provided.';
  const memberCount = members.length || group?.member_count || 1;
  const rawId = String(group?.conversation_id || group?.id || '').replace(/^(group-)+/i, '').trim();
  const displayGroupId = `grp_${rawId.replace(/-/g, '').slice(0, 12)}`;

  const createdDate = convDetails?.created_at || group?.created_at
    ? new Date(convDetails?.created_at || group?.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Recently';

  const creator = members.find((m) => Number(m.id) === Number(convDetails?.created_by || group?.created_by));
  const creatorName = isOwner ? 'You' : creator?.full_name || creator?.username || 'Admin';

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(rawId);
      setCopiedId(true);
      if (onShowToast) onShowToast('Group ID copied!', 'success');
      setTimeout(() => setCopiedId(false), 2000);
    } catch {}
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 text-left">
      {/* Top Banner Identity */}
      <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-white/[0.03] border border-white/10">
        <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-emerald-500 via-cyan-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-emerald-500/10 mb-3">
          {convDetails?.avatar_url || group?.avatar_url ? (
            <img
              src={convDetails?.avatar_url || group?.avatar_url}
              alt={title}
              className="w-full h-full rounded-full object-cover bg-zinc-900"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-emerald-400">
              <Users size={32} />
            </div>
          )}
        </div>

        <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          {memberCount} members • Created {createdDate.split(',')[0]}
        </p>

        {/* 4 Action Buttons */}
        <div className="grid grid-cols-4 gap-2 w-full mt-4 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => onNavigate('overview')}
            className="flex flex-col items-center py-2 px-1 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.07] transition-all"
          >
            <Edit3 size={16} className="text-emerald-400 mb-1" />
            <span className="text-[10px] text-zinc-300">Edit Group</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddMember}
            className="flex flex-col items-center py-2 px-1 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.07] transition-all"
          >
            <UserPlus size={16} className="text-cyan-400 mb-1" />
            <span className="text-[10px] text-zinc-300">Add Members</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('invite')}
            className="flex flex-col items-center py-2 px-1 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.07] transition-all"
          >
            <Share2 size={16} className="text-indigo-400 mb-1" />
            <span className="text-[10px] text-zinc-300">Invite</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('overview')}
            className="flex flex-col items-center py-2 px-1 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.07] transition-all"
          >
            <MoreHorizontal size={16} className="text-zinc-400 mb-1" />
            <span className="text-[10px] text-zinc-300">More</span>
          </button>
        </div>
      </div>

      {/* Group Description */}
      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Group Description
        </h3>
        <p className="text-xs text-zinc-300 leading-relaxed">{description}</p>
      </div>

      {/* Group Details Card */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Group Details
        </h3>

        <div className="flex items-center justify-between py-1 text-xs">
          <span className="text-zinc-400 flex items-center gap-2">
            <User size={14} className="text-cyan-400" />
            Created by
          </span>
          <span className="font-semibold text-white">{creatorName}</span>
        </div>

        <div className="flex items-center justify-between py-1 text-xs border-t border-white/5">
          <span className="text-zinc-400 flex items-center gap-2">
            <Calendar size={14} className="text-emerald-400" />
            Creation date
          </span>
          <span className="text-zinc-300">{createdDate}</span>
        </div>

        <div className="flex items-center justify-between py-1 text-xs border-t border-white/5">
          <span className="text-zinc-400 flex items-center gap-2">
            <Hash size={14} className="text-indigo-400" />
            Group ID
          </span>
          <div className="flex items-center gap-1.5">
            <code className="text-[11px] font-mono text-zinc-300 bg-white/5 px-2 py-0.5 rounded">
              {displayGroupId}
            </code>
            <button
              type="button"
              onClick={handleCopyId}
              className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/10"
              title="Copy Group ID"
            >
              {copiedId ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications Card */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Notifications
        </h3>

        <div
          onClick={() => setIsMuted((prev) => !prev)}
          className="flex items-center justify-between py-1 cursor-pointer group"
        >
          <span className="text-xs text-zinc-300 flex items-center gap-2 group-hover:text-white">
            <Bell size={14} className="text-amber-400" />
            Mute notifications
          </span>
          <div className="flex items-center gap-1 text-xs text-zinc-400 group-hover:text-amber-300">
            <span>{isMuted ? 'Always' : 'Off'}</span>
            <ChevronRight size={14} />
          </div>
        </div>

        <div
          onClick={() => onNavigate('disappearing')}
          className="flex items-center justify-between py-1 border-t border-white/5 cursor-pointer group"
        >
          <span className="text-xs text-zinc-300 flex items-center gap-2 group-hover:text-white">
            <Clock size={14} className="text-rose-400" />
            Disappearing messages
          </span>
          <div className="flex items-center gap-1 text-xs text-zinc-400 group-hover:text-rose-300">
            <span>Off</span>
            <ChevronRight size={14} />
          </div>
        </div>
      </div>
    </div>
  );
}

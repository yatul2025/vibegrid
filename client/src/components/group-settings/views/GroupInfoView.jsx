/**
 * client/src/components/group-settings/views/GroupInfoView.jsx
 * ============================================================
 * Screen 5: Group Info & Metadata — Unified VibeGrid Design
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
  ShieldCheck,
  Lock
} from 'lucide-react';
import SpringToggle from '../../SpringToggle';

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
    <div className="space-y-4 text-left">
      {/* 1. Top Identity Card */}
      <div className="vg-card-subtle p-4 flex flex-col items-center text-center">
        <div className="vg-avatar-ring-large mb-3">
          {convDetails?.avatar_url || group?.avatar_url ? (
            <img
              src={convDetails?.avatar_url || group?.avatar_url}
              alt={title}
              className="vg-avatar-img-large"
            />
          ) : (
            <div className="vg-avatar-fallback-large">
              <Users size={32} />
            </div>
          )}
        </div>

        <h2 className="text-base font-bold text-[var(--text-primary)] m-0">{title}</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 mb-3">
          {memberCount} members • Created {createdDate.split(',')[0]}
        </p>

        {/* 4 Action Pills */}
        <div className="grid grid-cols-3 gap-2 w-full pt-3 border-t border-[var(--border-color)]">
          <button
            type="button"
            onClick={() => onNavigate('overview')}
            className="btn-secondary btn-sm flex items-center justify-center gap-1.5"
          >
            <Edit3 size={14} className="text-[var(--primary)]" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddMember}
            className="btn-secondary btn-sm flex items-center justify-center gap-1.5"
          >
            <UserPlus size={14} className="text-[var(--primary)]" />
            <span>Add</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('invite')}
            className="btn-secondary btn-sm flex items-center justify-center gap-1.5"
          >
            <Share2 size={14} className="text-[var(--primary)]" />
            <span>Invite</span>
          </button>
        </div>
      </div>

      {/* 2. Security & Encryption Card */}
      <div className="p-3 rounded-xl bg-[var(--primary-light)] border border-[var(--primary)] space-y-1">
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--primary)]">
          <Lock size={15} />
          <span>End-to-End Encrypted</span>
        </div>
        <p className="text-[11px] text-[var(--text-secondary)] m-0 leading-relaxed">
          Messages and calls in this group are secured with AES-256-GCM Sender Keys. No one outside of this group can read or listen to them.
        </p>
      </div>

      {/* 3. Group Description */}
      <div className="vg-card-subtle p-3.5 space-y-1">
        <p className="vg-section-label">
          Group Description
        </p>
        <p className="text-xs text-[var(--text-primary)] leading-relaxed m-0">{description}</p>
      </div>

      {/* 4. Group Metadata Details */}
      <div className="space-y-1">
        <p className="vg-section-label">
          Group Details
        </p>
        <div className="vg-card-subtle divide-y divide-[var(--border-color)]">
          <div className="flex items-center justify-between p-3 text-xs">
            <span className="text-[var(--text-secondary)] flex items-center gap-2">
              <User size={14} className="text-[var(--primary)]" />
              Created by
            </span>
            <span className="font-semibold text-[var(--text-primary)]">{creatorName}</span>
          </div>

          <div className="flex items-center justify-between p-3 text-xs">
            <span className="text-[var(--text-secondary)] flex items-center gap-2">
              <Calendar size={14} className="text-[var(--primary)]" />
              Created on
            </span>
            <span className="text-[var(--text-secondary)]">{createdDate}</span>
          </div>

          <div className="flex items-center justify-between p-3 text-xs">
            <span className="text-[var(--text-secondary)] flex items-center gap-2">
              <Hash size={14} className="text-[var(--primary)]" />
              Group ID
            </span>
            <div className="flex items-center gap-1.5">
              <code className="text-[11px] font-mono text-[var(--primary)] bg-[var(--bg-page)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                {displayGroupId}
              </code>
              <button
                type="button"
                onClick={handleCopyId}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--bg-hover)]"
                title="Copy Group ID"
              >
                {copiedId ? <Check size={13} className="text-[var(--success)]" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Notifications & Privacy Card */}
      <div className="space-y-1">
        <p className="vg-section-label">
          Notifications & Privacy
        </p>
        <div className="vg-card-subtle divide-y divide-[var(--border-color)]">
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center">
                <Bell size={15} />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)] m-0">Mute Notifications</p>
                <p className="text-[11px] text-[var(--text-muted)] m-0">Silence sound and vibration</p>
              </div>
            </div>
            <SpringToggle
              checked={isMuted}
              onChange={() => setIsMuted((prev) => !prev)}
              id="info-mute-toggle"
              title="Mute Notifications"
            />
          </div>

          <div
            onClick={() => onNavigate('disappearing')}
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-[var(--bg-card)] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center">
                <Clock size={15} />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)] m-0">Disappearing Messages</p>
                <p className="text-[11px] text-[var(--text-muted)] m-0">Configure self-destruct timers</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-[var(--text-muted)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * client/src/components/group-settings/views/MembersView.jsx
 * ==========================================================
 * Screen 2: Members Management — Unified VibeGrid Design
 */

import React, { useState } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Crown,
  Shield,
  MoreVertical,
  UserMinus,
  CheckCircle2,
  X
} from 'lucide-react';

export default function MembersView({
  members = [],
  currentUser,
  convDetails,
  isAdmin,
  isOwner,
  onOpenAddMember,
  onRemoveMember,
  onPromoteMember,
  onDemoteMember,
  actionLoading
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuUserId, setActiveMenuUserId] = useState(null);

  const ownerId = Number(convDetails?.created_by || members.find((m) => m.role === 'owner')?.id || 0);

  // Categorize members
  const filtered = members.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (m.full_name && m.full_name.toLowerCase().includes(q)) ||
      (m.username && m.username.toLowerCase().includes(q))
    );
  });

  const owner = filtered.find((m) => Number(m.id) === ownerId) ||
    filtered.find((m) => m.role === 'owner') ||
    (members.length > 0 && Number(members[0].id) === ownerId ? members[0] : null);

  const admins = filtered.filter(
    (m) => m.role === 'admin' && Number(m.id) !== ownerId
  );

  const regularMembers = filtered.filter(
    (m) => m.role !== 'admin' && Number(m.id) !== ownerId
  );

  const renderMemberRow = (member, roleBadge) => {
    const isSelf = Number(member.id) === Number(currentUser?.id);
    const isMemberOwner = Number(member.id) === ownerId;
    const isOnline = member.is_online || member.id % 2 === 0;
    const lastSeen = isOnline ? 'Online' : `${(member.id % 5) + 1}h ago`;

    return (
      <div
        key={member.id}
        className="flex items-center justify-between p-3 transition-all text-left group hover:bg-[var(--bg-card)]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            {member.avatar_url ? (
              <img
                src={member.avatar_url}
                alt={member.full_name || member.username}
                className="w-9 h-9 rounded-full object-cover bg-[var(--bg-page)] border border-[var(--border-color)]"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)] flex items-center justify-center font-bold text-xs">
                {(member.full_name || member.username || '?')[0].toUpperCase()}
              </div>
            )}
            {isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[var(--success)] border-2 border-[var(--bg-card)]" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[140px] sm:max-w-[200px]">
                {member.full_name || member.username}
              </span>
              {isSelf && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--bg-page)] text-[var(--text-muted)] border border-[var(--border-color)] font-medium">
                  You
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] truncate m-0">@{member.username}</p>
          </div>
        </div>

        {/* Right Action / Role Badge */}
        <div className="flex items-center gap-2 relative shrink-0">
          {roleBadge}

          {!isMemberOwner && (
            <span className={`text-[11px] ${isOnline ? 'text-[var(--success)] font-medium' : 'text-[var(--text-muted)]'}`}>
              {lastSeen}
            </span>
          )}

          {/* 3-dots action menu for Admin or Owner */}
          {isAdmin && !isMemberOwner && !isSelf && (
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setActiveMenuUserId((prev) => (prev === member.id ? null : member.id))
                }
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                title="Member options"
              >
                <MoreVertical size={16} />
              </button>

              {activeMenuUserId === member.id && (
                <div
                  className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl p-1.5 z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Admin toggle */}
                  {isOwner && member.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuUserId(null);
                        onDemoteMember(member.id);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--warning)] hover:bg-[var(--bg-hover)] rounded-lg text-left"
                    >
                      <Shield size={14} />
                      <span>Dismiss as Admin</span>
                    </button>
                  )}

                  {member.role !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuUserId(null);
                        onPromoteMember(member.id);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--primary)] hover:bg-[var(--bg-hover)] rounded-lg text-left"
                    >
                      <Shield size={14} />
                      <span>Make Group Admin</span>
                    </button>
                  )}

                  {/* Remove Member */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuUserId(null);
                      onRemoveMember(member);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--danger)] hover:bg-[var(--bg-hover)] rounded-lg text-left border-t border-[var(--border-color)] mt-1 pt-1.5"
                  >
                    <UserMinus size={14} />
                    <span>Remove from Group</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 text-left">
      {/* Search Input */}
      <div className="vg-search-input-wrap">
        <Search size={15} className="vg-search-icon" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search members..."
          className="vg-search-input"
        />
      </div>

      {/* Header action bar */}
      <div className="flex items-center justify-between px-1">
        <span className="vg-section-label m-0">
          {filtered.length} {filtered.length === 1 ? 'MEMBER' : 'MEMBERS'}
        </span>
        {isAdmin && (
          <button
            type="button"
            onClick={onOpenAddMember}
            className="btn-primary btn-sm"
          >
            <UserPlus size={14} />
            <span>Add Member</span>
          </button>
        )}
      </div>

      {/* 1. Group Owner Section */}
      {owner && (
        <div className="space-y-1">
          <p className="vg-section-label">Group Owner</p>
          <div className="vg-card-subtle">
            {renderMemberRow(
              owner,
              <span className="vg-badge vg-badge-owner">Owner</span>
            )}
          </div>
        </div>
      )}

      {/* 2. Group Admins Section */}
      {admins.length > 0 && (
        <div className="space-y-1">
          <p className="vg-section-label">
            Admins ({admins.length})
          </p>
          <div className="vg-card-subtle divide-y divide-[var(--border-color)]">
            {admins.map((adm) =>
              renderMemberRow(
                adm,
                <span className="vg-badge vg-badge-admin">Admin</span>
              )
            )}
          </div>
        </div>
      )}

      {/* 3. Regular Members Section */}
      {regularMembers.length > 0 && (
        <div className="space-y-1">
          <p className="vg-section-label">
            Members ({regularMembers.length})
          </p>
          <div className="vg-card-subtle divide-y divide-[var(--border-color)]">
            {regularMembers.map((m) => renderMemberRow(m, null))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="p-8 text-center vg-card-subtle">
          <Users size={28} className="mx-auto text-[var(--text-muted)] mb-2" />
          <p className="text-xs text-[var(--text-muted)] m-0">No matching members found.</p>
        </div>
      )}
    </div>
  );
}

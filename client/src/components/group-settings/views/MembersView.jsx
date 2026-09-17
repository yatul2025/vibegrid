/**
 * client/src/components/group-settings/views/MembersView.jsx
 * ==========================================================
 * Screen 2: Members Management
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
  X,
  AlertCircle
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
    const isMemberAdmin = member.role === 'admin' || isMemberOwner;

    // Relative online status mockup or actual
    const isOnline = member.is_online || member.id % 2 === 0;
    const lastSeen = isOnline ? 'Online' : `${(member.id % 5) + 1}h`;

    return (
      <div
        key={member.id}
        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all text-left group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            {member.avatar_url ? (
              <img
                src={member.avatar_url}
                alt={member.full_name || member.username}
                className="w-10 h-10 rounded-full object-cover bg-zinc-800"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-sm">
                {(member.full_name || member.username || '?')[0].toUpperCase()}
              </div>
            )}
            {isOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-900" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white truncate max-w-[140px] sm:max-w-[200px]">
                {member.full_name || member.username}
              </span>
              {isSelf && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-400 font-medium">
                  You
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 truncate">@{member.username}</p>
          </div>
        </div>

        {/* Right Action / Role Badge */}
        <div className="flex items-center gap-2 relative shrink-0">
          {roleBadge}

          {!isMemberOwner && !isOnline && (
            <span className="text-xs text-zinc-500">{lastSeen}</span>
          )}

          {isOnline && !isMemberOwner && member.role === 'member' && (
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
          )}

          {/* 3-dots action menu for Admin or Owner */}
          {isAdmin && !isMemberOwner && !isSelf && (
            <div>
              <button
                type="button"
                onClick={() =>
                  setActiveMenuUserId((prev) => (prev === member.id ? null : member.id))
                }
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                title="Member options"
              >
                <MoreVertical size={16} />
              </button>

              {activeMenuUserId === member.id && (
                <div
                  className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-zinc-900 border border-white/15 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
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
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-400 hover:bg-white/10 rounded-lg text-left"
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
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-400 hover:bg-white/10 rounded-lg text-left"
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
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg text-left border-t border-white/10 mt-1 pt-1.5"
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
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Search Input */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search members..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-500/50"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Add Members Action Card */}
      <button
        type="button"
        onClick={onOpenAddMember}
        className="w-full flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/15 hover:border-emerald-500/50 transition-all group text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold shadow-md group-hover:scale-105 transition-transform">
            <UserPlus size={16} />
          </div>
          <span className="text-sm font-semibold text-emerald-400">Add Members</span>
        </div>
        <span className="text-xs text-emerald-400/80 group-hover:translate-x-0.5 transition-transform">
          &gt;
        </span>
      </button>

      {/* Group Owner Section */}
      {owner && (
        <div className="space-y-2 text-left">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
            Group Owner
          </h3>
          {renderMemberRow(
            owner,
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-semibold">
              <Crown size={12} className="text-amber-400" />
              Owner
            </span>
          )}
        </div>
      )}

      {/* Admins Section */}
      {admins.length > 0 && (
        <div className="space-y-2 text-left">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
            Admins ({admins.length})
          </h3>
          <div className="space-y-2">
            {admins.map((adm) =>
              renderMemberRow(
                adm,
                <span
                  key={adm.id}
                  className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[11px] font-medium"
                >
                  Admin
                </span>
              )
            )}
          </div>
        </div>
      )}

      {/* Regular Members Section */}
      <div className="space-y-2 text-left">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
          Members ({regularMembers.length})
        </h3>
        {regularMembers.length === 0 ? (
          <p className="text-xs text-zinc-500 py-3 text-center">No matching members found.</p>
        ) : (
          <div className="space-y-2">
            {regularMembers.map((m) => renderMemberRow(m, null))}
          </div>
        )}
      </div>
    </div>
  );
}

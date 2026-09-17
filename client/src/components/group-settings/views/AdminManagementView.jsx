/**
 * client/src/components/group-settings/views/AdminManagementView.jsx
 * =================================================================
 * Screen 9: Admin Management (Current Admins & Add Admin)
 */

import React, { useState } from 'react';
import {
  Shield,
  Search,
  Plus,
  Crown,
  UserMinus,
  Check,
  X
} from 'lucide-react';

export default function AdminManagementView({
  members = [],
  convDetails,
  currentUser,
  isOwner = false,
  onPromoteMember,
  onDemoteMember,
  actionLoading = false,
  onShowToast
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [promotingId, setPromotingId] = useState(null);

  const ownerId = Number(convDetails?.created_by || 0);

  const admins = members.filter((m) => m.role === 'admin' && Number(m.id) !== ownerId);
  const nonAdmins = members.filter(
    (m) => m.role !== 'admin' && Number(m.id) !== ownerId
  );

  const filteredNonAdmins = nonAdmins.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (m.full_name && m.full_name.toLowerCase().includes(q)) ||
      (m.username && m.username.toLowerCase().includes(q))
    );
  });

  const handlePromote = async (member) => {
    try {
      setPromotingId(member.id);
      if (onPromoteMember) {
        await onPromoteMember(member.id);
      }
      if (onShowToast) onShowToast(`@${member.username} is now an Admin!`, 'success');
    } catch {
      if (onShowToast) onShowToast('Failed to promote member', 'error');
    } finally {
      setPromotingId(null);
    }
  };

  const handleDemote = async (member) => {
    try {
      if (onDemoteMember) {
        await onDemoteMember(member.id);
      }
      if (onShowToast) onShowToast(`@${member.username} dismissed as Admin.`, 'success');
    } catch {
      if (onShowToast) onShowToast('Failed to dismiss admin', 'error');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200 text-left">
      {/* Current Admins Section */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
          Current Admins ({admins.length})
        </h3>

        <div className="space-y-2">
          {admins.length === 0 ? (
            <p className="text-xs text-zinc-500 py-2 px-1">No additional admins assigned yet.</p>
          ) : (
            admins.map((admin) => (
              <div
                key={admin.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {admin.avatar_url ? (
                    <img
                      src={admin.avatar_url}
                      alt={admin.full_name}
                      className="w-10 h-10 rounded-full object-cover bg-zinc-800"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {(admin.full_name || admin.username || '?')[0]}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {admin.full_name || admin.username}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">@{admin.username}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[11px] font-medium">
                    Admin
                  </span>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => handleDemote(admin)}
                      title="Dismiss Admin"
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <UserMinus size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Admin Section */}
      <div className="space-y-2.5 pt-2">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
          Add Admin
        </h3>

        {/* Member Search Bar */}
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
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
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

        {/* Candidate Member List */}
        <div className="space-y-2 pt-1">
          {filteredNonAdmins.length === 0 ? (
            <p className="text-xs text-zinc-500 py-3 text-center">No available members found.</p>
          ) : (
            filteredNonAdmins.map((candidate) => {
              const isBusy = promotingId === candidate.id;
              return (
                <div
                  key={candidate.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {candidate.avatar_url ? (
                      <img
                        src={candidate.avatar_url}
                        alt={candidate.full_name}
                        className="w-10 h-10 rounded-full object-cover bg-zinc-800"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 text-zinc-300 font-bold text-xs flex items-center justify-center shrink-0">
                        {(candidate.full_name || candidate.username || '?')[0]}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {candidate.full_name || candidate.username}
                      </p>
                      <p className="text-[11px] text-zinc-400 truncate">@{candidate.username}</p>
                    </div>
                  </div>

                  {/* + Button to Promote */}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handlePromote(candidate)}
                    title="Make Admin"
                    className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-black flex items-center justify-center transition-all hover:scale-105 shrink-0"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

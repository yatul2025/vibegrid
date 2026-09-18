/**
 * client/src/components/group-settings/views/AdminManagementView.jsx
 * =================================================================
 * Screen 9: Admin Management (Current Admins & Add Admin) — Unified VibeGrid Design
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
    <div className="space-y-4 text-left">
      {/* 1. Notice Info Banner */}
      <div className="p-3 rounded-xl bg-[var(--primary-light)] border border-[var(--primary)] text-xs text-[var(--primary)] flex items-center gap-2.5">
        <Shield size={16} className="shrink-0" />
        <span className="leading-snug">
          Admins can manage group settings, delete messages for everyone, and moderate members.
        </span>
      </div>

      {/* 2. Current Admins Section */}
      <div className="space-y-1">
        <p className="vg-section-label">
          Current Admins ({admins.length})
        </p>

        <div className="vg-card-subtle divide-y divide-[var(--border-color)]">
          {admins.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-4 text-center m-0">No additional admins assigned yet.</p>
          ) : (
            admins.map((admin) => (
              <div
                key={admin.id}
                className="flex items-center justify-between p-3 gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {admin.avatar_url ? (
                    <img
                      src={admin.avatar_url}
                      alt={admin.full_name}
                      className="w-9 h-9 rounded-full object-cover bg-[var(--bg-page)] border border-[var(--border-color)] shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)] font-bold text-xs flex items-center justify-center shrink-0">
                      {(admin.full_name || admin.username || '?')[0]}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate m-0">
                      {admin.full_name || admin.username}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate m-0">@{admin.username}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="vg-badge vg-badge-admin">
                    Admin
                  </span>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => handleDemote(admin)}
                      title="Dismiss Admin"
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-hover)] transition-colors"
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

      {/* 3. Add New Admin Section */}
      <div className="space-y-2 pt-1">
        <p className="vg-section-label">
          Appoint New Admin
        </p>

        {/* Member Search Bar */}
        <div className="vg-search-input-wrap">
          <Search size={15} className="vg-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search members to promote..."
            className="vg-search-input"
          />
        </div>

        {/* Candidate Member List */}
        <div className="vg-card-subtle divide-y divide-[var(--border-color)] mt-2">
          {filteredNonAdmins.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-4 text-center m-0">No eligible members found.</p>
          ) : (
            filteredNonAdmins.map((candidate) => {
              const isBusy = promotingId === candidate.id;
              return (
                <div
                  key={candidate.id}
                  className="flex items-center justify-between p-3 gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {candidate.avatar_url ? (
                      <img
                        src={candidate.avatar_url}
                        alt={candidate.full_name}
                        className="w-9 h-9 rounded-full object-cover bg-[var(--bg-page)] border border-[var(--border-color)] shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[var(--bg-page)] border border-[var(--border-color)] text-[var(--text-secondary)] font-bold text-xs flex items-center justify-center shrink-0">
                        {(candidate.full_name || candidate.username || '?')[0]}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate m-0">
                        {candidate.full_name || candidate.username}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate m-0">@{candidate.username}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handlePromote(candidate)}
                    className="btn-primary btn-sm shrink-0"
                  >
                    <Plus size={14} />
                    <span>Make Admin</span>
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

/**
 * client/src/components/group-settings/views/OverviewView.jsx
 * ==========================================================
 * Screen 1: Group Settings Overview
 */

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Share2,
  Search,
  MoreHorizontal,
  Shield,
  Image as ImageIcon,
  Pin,
  Clock,
  ChevronRight,
  Edit2,
  Check,
  X,
  Copy,
  Info,
  UserCheck,
  Camera,
  LogOut,
  Trash2,
  AlertTriangle
} from 'lucide-react';

export default function OverviewView({
  group,
  members = [],
  convDetails,
  currentUser,
  isAdmin,
  isOwner,
  pinnedCount = 0,
  joinRequestsCount = 0,
  ephemeralTimer = null,
  initialAction = null,
  onNavigate,
  onUpdateTitle,
  onUpdateDescription,
  onOpenAddMember,
  onLeaveGroup,
  onDeleteGroup,
  actionLoading
}) {
  const dangerZoneRef = React.useRef(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(group?.title || group?.partner_full_name || 'Group Chat');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(convDetails?.description || group?.description || '');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(initialAction === 'leave');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(initialAction === 'delete');

  React.useEffect(() => {
    if (initialAction === 'leave') {
      setShowLeaveConfirm(true);
      setTimeout(() => {
        dangerZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } else if (initialAction === 'delete') {
      setShowDeleteConfirm(true);
      setTimeout(() => {
        dangerZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [initialAction]);

  const title = group?.title || group?.partner_full_name || 'Group Chat';
  const description = convDetails?.description || group?.description || 'No group description set. Tap to add one.';
  const memberCount = members.length || group?.member_count || 1;

  const creatorName = isOwner
    ? 'You'
    : members.find((m) => Number(m.id) === Number(convDetails?.created_by || group?.created_by))?.full_name || 'Admin';

  const formatTimerLabel = (seconds) => {
    if (!seconds) return 'Off';
    if (seconds >= 86400 * 30) return '30 days';
    if (seconds >= 86400 * 7) return '7 days';
    if (seconds >= 86400) return '24 hours';
    return `${Math.round(seconds / 3600)} hours`;
  };

  const handleSaveTitle = async () => {
    if (!titleValue.trim()) return;
    await onUpdateTitle(titleValue.trim());
    setIsEditingTitle(false);
  };

  const handleSaveDesc = async () => {
    await onUpdateDescription(descValue.trim());
    setIsEditingDesc(false);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Profile Header */}
      <div className="flex flex-col items-center text-center pt-2">
        <div className="relative group">
          <div className="w-24 h-24 rounded-full p-[2px] bg-gradient-to-tr from-emerald-500 via-cyan-500 to-indigo-500 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
            {convDetails?.avatar_url || group?.avatar_url ? (
              <img
                src={convDetails?.avatar_url || group?.avatar_url}
                alt={title}
                className="w-full h-full rounded-full object-cover bg-zinc-900"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-emerald-400">
                <Users size={38} />
              </div>
            )}
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => onNavigate('info')}
              title="Change Group Icon"
              className="absolute bottom-0 right-0 p-2 rounded-full bg-emerald-500 text-black hover:bg-emerald-400 transition-all shadow-md hover:scale-105"
            >
              <Camera size={14} />
            </button>
          )}
        </div>

        {/* Title editing */}
        <div className="mt-3 flex items-center justify-center gap-2 max-w-full px-4">
          {isEditingTitle ? (
            <div className="flex items-center gap-2 w-full max-w-xs">
              <input
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                maxLength={60}
                autoFocus
                className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-emerald-500/50 text-white text-center text-base focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                disabled={actionLoading}
                className="p-1.5 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition-all"
              >
                <Check size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setTitleValue(title);
                  setIsEditingTitle(false);
                }}
                className="p-1.5 rounded-lg bg-white/10 text-zinc-300 hover:bg-white/20 transition-all"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  title="Edit group name"
                  className="p-1 text-zinc-400 hover:text-emerald-400 transition-colors"
                >
                  <Edit2 size={15} />
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-zinc-400 mt-1">
          Created by <span className="text-zinc-200 font-medium">{creatorName}</span> • {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </p>
      </div>

      {/* Description Card */}
      <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all text-left">
        {isEditingDesc ? (
          <div className="space-y-2">
            <textarea
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Add a group description..."
              className="w-full p-2 text-xs rounded-lg bg-black/40 border border-emerald-500/50 text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingDesc(false)}
                className="px-2.5 py-1 text-xs rounded-md bg-white/10 text-zinc-300 hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDesc}
                disabled={actionLoading}
                className="px-3 py-1 text-xs rounded-md bg-emerald-500 text-black font-semibold hover:bg-emerald-400"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => isAdmin && setIsEditingDesc(true)}
            className={`group flex items-start justify-between gap-3 text-xs leading-relaxed ${isAdmin ? 'cursor-pointer' : ''}`}
          >
            <p className={`${descValue ? 'text-zinc-300' : 'text-zinc-500 italic'}`}>{description}</p>
            {isAdmin && (
              <Edit2 size={13} className="text-zinc-500 group-hover:text-emerald-400 shrink-0 mt-0.5" />
            )}
          </div>
        )}
      </div>

      {/* 4 Quick Action Square Buttons */}
      <div className="grid grid-cols-4 gap-2.5 text-center">
        <button
          type="button"
          onClick={onOpenAddMember}
          className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-emerald-500/40 transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
            <UserPlus size={18} />
          </div>
          <span className="text-[11px] font-medium text-zinc-300">Add Member</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('invite')}
          className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-cyan-500/40 transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
            <Share2 size={18} />
          </div>
          <span className="text-[11px] font-medium text-zinc-300">Invite</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('members')}
          className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-indigo-500/40 transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
            <Search size={18} />
          </div>
          <span className="text-[11px] font-medium text-zinc-300">Search</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMoreMenu((prev) => !prev)}
            className="w-full flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 text-zinc-300 border border-white/20 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <MoreHorizontal size={18} />
            </div>
            <span className="text-[11px] font-medium text-zinc-300">More</span>
          </button>

          {/* Quick Action Popover */}
          {showMoreMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-zinc-900 border border-white/15 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  onNavigate('info');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg text-left"
              >
                <Info size={14} className="text-cyan-400" />
                <span>Group Info & Details</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onNavigate('admins');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg text-left"
                >
                  <Shield size={14} className="text-amber-400" />
                  <span>Admin Management</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  setShowLeaveConfirm(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg text-left border-t border-white/10 mt-1 pt-2"
              >
                <LogOut size={14} />
                <span>Leave Group</span>
              </button>

              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/15 rounded-lg text-left font-semibold"
                >
                  <Trash2 size={14} />
                  <span>Delete Group</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Settings Navigation List Cards */}
      <div className="space-y-2 pt-1 text-left">
        {/* Members */}
        <button
          type="button"
          onClick={() => onNavigate('members')}
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-emerald-500/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform">
              <Users size={17} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Members</p>
              <p className="text-xs text-zinc-400">{memberCount} {memberCount === 1 ? 'member' : 'members'}</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
        </button>

        {/* Group Permissions */}
        <button
          type="button"
          onClick={() => onNavigate('permissions')}
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-cyan-500/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center border border-cyan-500/20 group-hover:scale-105 transition-transform">
              <Shield size={17} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Group Permissions</p>
              <p className="text-xs text-zinc-400">View and manage</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-zinc-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
        </button>

        {/* Media & Files */}
        <button
          type="button"
          onClick={() => onNavigate('media')}
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-indigo-500/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/20 group-hover:scale-105 transition-transform">
              <ImageIcon size={17} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Media & Files</p>
              <p className="text-xs text-zinc-400">Photos, Videos, Files, Links</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-zinc-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
        </button>

        {/* Pinned Messages */}
        <button
          type="button"
          onClick={() => onNavigate('pinned')}
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-amber-500/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-105 transition-transform">
              <Pin size={17} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Pinned Messages</p>
              <p className="text-xs text-zinc-400">{pinnedCount} pinned</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
        </button>

        {/* Disappearing Messages */}
        <button
          type="button"
          onClick={() => onNavigate('disappearing')}
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-rose-500/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center border border-rose-500/20 group-hover:scale-105 transition-transform">
              <Clock size={17} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Disappearing Messages</p>
              <p className="text-xs text-zinc-400">{formatTimerLabel(ephemeralTimer)}</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-zinc-500 group-hover:text-rose-400 group-hover:translate-x-0.5 transition-all" />
        </button>

        {/* Join Requests (Conditional or Admin) */}
        {(isAdmin || joinRequestsCount > 0) && (
          <button
            type="button"
            onClick={() => onNavigate('join_requests')}
            className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-emerald-500/30 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform">
                <UserCheck size={17} />
                {joinRequestsCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-black font-bold text-[10px] leading-none">
                    {joinRequestsCount}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Join Requests</p>
                <p className="text-xs text-zinc-400">{joinRequestsCount} pending approval</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
          </button>
        )}
      </div>

      {/* Quick Member Preview Roster */}
      {members.length > 0 && (
        <div className="space-y-2 pt-2 text-left">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Group Roster ({members.length})
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('members')}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Manage &gt;
            </button>
          </div>

          <div className="space-y-1.5">
            {members.slice(0, 5).map((m) => {
              const isMemAdmin = m.role === 'admin' || Number(m.id) === Number(convDetails?.created_by || group?.created_by);
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
                      {(m.full_name || m.username || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {m.full_name || m.username}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">@{m.username}</p>
                    </div>
                  </div>

                  {isMemAdmin && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-medium shrink-0">
                      Admin
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Danger Zone Actions */}
      <div ref={dangerZoneRef} className="space-y-2 pt-3 border-t border-white/10 text-left">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1">
          Group Actions
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setShowLeaveConfirm(true)}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-all"
          >
            <LogOut size={14} />
            <span>Leave Group</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-500/15 border border-rose-500/30 hover:bg-rose-500/25 text-rose-400 text-xs font-semibold transition-all"
            >
              <Trash2 size={14} />
              <span>Delete Group</span>
            </button>
          )}
        </div>
      </div>

      {/* Leave Group Confirmation Dialog */}
      {showLeaveConfirm && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-left space-y-3 animate-in fade-in duration-150">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-sm font-semibold text-rose-300">Leave this group?</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                You will stop receiving messages from this group.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowLeaveConfirm(false)}
              className="px-3 py-1.5 text-xs rounded-lg bg-white/10 text-zinc-300 hover:bg-white/20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onLeaveGroup}
              disabled={actionLoading}
              className="px-4 py-1.5 text-xs rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-500"
            >
              {actionLoading ? 'Leaving...' : 'Confirm Leave'}
            </button>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-left space-y-3 animate-in fade-in duration-150">
          <div className="flex items-start gap-3">
            <Trash2 className="text-rose-400 shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-sm font-semibold text-rose-300">Permanently delete group?</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                This will remove all members and delete all chat history for everyone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 text-xs rounded-lg bg-white/10 text-zinc-300 hover:bg-white/20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDeleteGroup}
              disabled={actionLoading}
              className="px-4 py-1.5 text-xs rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-500"
            >
              {actionLoading ? 'Deleting...' : 'Delete Forever'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

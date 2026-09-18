/**
 * client/src/components/group-settings/views/OverviewView.jsx
 * ==========================================================
 * Screen 1: Group Settings Overview — Unified VibeGrid Design
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
    <div className="space-y-4 text-left">
      {/* 1. VibeGrid Group Identity & Avatar */}
      <div className="vg-group-avatar-wrapper">
        <div className="vg-avatar-ring-large mb-3">
          {convDetails?.avatar_url || group?.avatar_url ? (
            <img
              src={convDetails?.avatar_url || group?.avatar_url}
              alt={title}
              className="vg-avatar-img-large"
            />
          ) : (
            <div className="vg-avatar-fallback-large">
              <Users size={36} />
            </div>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => onNavigate('info')}
              title="Group Details & Icon"
              className="vg-avatar-edit-badge"
            >
              <Camera size={13} />
            </button>
          )}
        </div>

        {/* Title & Inline Edit */}
        <div className="flex items-center justify-center gap-2 max-w-full px-4">
          {isEditingTitle ? (
            <div className="flex items-center gap-2 w-full max-w-xs">
              <input
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                maxLength={60}
                autoFocus
                className="vg-search-input text-center text-sm font-bold"
                style={{ padding: '6px 10px' }}
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                disabled={actionLoading}
                className="btn-primary btn-sm"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setTitleValue(title);
                  setIsEditingTitle(false);
                }}
                className="btn-secondary btn-sm"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight m-0">{title}</h2>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  title="Edit group name"
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
                >
                  <Edit2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-[var(--text-secondary)] mt-1 mb-0">
          Created by <span className="text-[var(--text-primary)] font-medium">{creatorName}</span> • {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </p>
      </div>

      {/* 2. Group Description Card */}
      <div className="vg-card-subtle p-3 text-left">
        {isEditingDesc ? (
          <div className="space-y-2">
            <textarea
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Add a group description..."
              className="vg-search-input resize-none w-full"
              style={{ padding: '8px 10px' }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingDesc(false)}
                className="btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDesc}
                disabled={actionLoading}
                className="btn-primary btn-sm"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => isAdmin && setIsEditingDesc(true)}
            className={`flex items-start justify-between gap-3 text-xs leading-relaxed ${isAdmin ? 'cursor-pointer' : ''}`}
          >
            <p className={`m-0 ${descValue ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] italic'}`}>
              {description}
            </p>
            {isAdmin && (
              <Edit2 size={13} className="text-[var(--text-muted)] hover:text-[var(--primary)] shrink-0 mt-0.5" />
            )}
          </div>
        )}
      </div>

      {/* 3. VibeGrid 4-Button Quick Action Toolbar */}
      <div className="vg-quick-actions-grid">
        <button
          type="button"
          onClick={onOpenAddMember}
          className="vg-quick-action-btn"
        >
          <div className="vg-quick-action-icon">
            <UserPlus size={16} />
          </div>
          <span className="vg-quick-action-label">Add Member</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('invite')}
          className="vg-quick-action-btn"
        >
          <div className="vg-quick-action-icon">
            <Share2 size={16} />
          </div>
          <span className="vg-quick-action-label">Invite</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('media')}
          className="vg-quick-action-btn"
        >
          <div className="vg-quick-action-icon">
            <ImageIcon size={16} />
          </div>
          <span className="vg-quick-action-label">Media</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMoreMenu((prev) => !prev)}
            className="vg-quick-action-btn w-full"
          >
            <div className="vg-quick-action-icon">
              <MoreHorizontal size={16} />
            </div>
            <span className="vg-quick-action-label">More</span>
          </button>

          {/* Quick Action Popover */}
          {showMoreMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl p-1.5 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  onNavigate('info');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg text-left"
              >
                <Info size={14} className="text-[var(--primary)]" />
                <span>Group Info & Security</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onNavigate('admins');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg text-left"
                >
                  <Shield size={14} className="text-[var(--warning)]" />
                  <span>Admin Management</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  setShowLeaveConfirm(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--danger)] hover:bg-[var(--bg-hover)] rounded-lg text-left border-t border-[var(--border-color)] mt-1 pt-2"
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--danger)] hover:bg-[var(--bg-hover)] rounded-lg text-left font-semibold"
                >
                  <Trash2 size={14} />
                  <span>Delete Group</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Settings Navigation List Cards */}
      <div className="vg-card-subtle">
        {/* Members */}
        <button
          type="button"
          onClick={() => onNavigate('members')}
          className="vg-nav-item-row"
        >
          <div className="vg-nav-item-left">
            <div className="vg-nav-item-icon">
              <Users size={17} />
            </div>
            <div>
              <p className="vg-nav-item-title">Members</p>
              <p className="vg-nav-item-desc">{memberCount} {memberCount === 1 ? 'member' : 'members'}</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-[var(--text-muted)]" />
        </button>

        {/* Group Permissions */}
        <button
          type="button"
          onClick={() => onNavigate('permissions')}
          className="vg-nav-item-row"
        >
          <div className="vg-nav-item-left">
            <div className="vg-nav-item-icon">
              <Shield size={17} />
            </div>
            <div>
              <p className="vg-nav-item-title">Group Permissions</p>
              <p className="vg-nav-item-desc">Messages, invites & info edit</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-[var(--text-muted)]" />
        </button>

        {/* Media & Files */}
        <button
          type="button"
          onClick={() => onNavigate('media')}
          className="vg-nav-item-row"
        >
          <div className="vg-nav-item-left">
            <div className="vg-nav-item-icon">
              <ImageIcon size={17} />
            </div>
            <div>
              <p className="vg-nav-item-title">Media & Files</p>
              <p className="vg-nav-item-desc">Photos, videos, documents</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-[var(--text-muted)]" />
        </button>

        {/* Pinned Messages */}
        <button
          type="button"
          onClick={() => onNavigate('pinned')}
          className="vg-nav-item-row"
        >
          <div className="vg-nav-item-left">
            <div className="vg-nav-item-icon">
              <Pin size={17} />
            </div>
            <div>
              <p className="vg-nav-item-title">Pinned Messages</p>
              <p className="vg-nav-item-desc">{pinnedCount} pinned</p>
            </div>
          </div>
          <div className="vg-nav-item-right">
            {pinnedCount > 0 && (
              <span className="vg-badge vg-badge-count">{pinnedCount}</span>
            )}
            <ChevronRight size={18} className="text-[var(--text-muted)]" />
          </div>
        </button>

        {/* Disappearing Messages */}
        <button
          type="button"
          onClick={() => onNavigate('disappearing')}
          className="vg-nav-item-row"
        >
          <div className="vg-nav-item-left">
            <div className="vg-nav-item-icon">
              <Clock size={17} />
            </div>
            <div>
              <p className="vg-nav-item-title">Disappearing Messages</p>
              <p className="vg-nav-item-desc">{formatTimerLabel(ephemeralTimer)}</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-[var(--text-muted)]" />
        </button>

        {/* Join Requests */}
        {(isAdmin || joinRequestsCount > 0) && (
          <button
            type="button"
            onClick={() => onNavigate('join_requests')}
            className="vg-nav-item-row"
          >
            <div className="vg-nav-item-left">
              <div className="vg-nav-item-icon">
                <UserCheck size={17} />
              </div>
              <div>
                <p className="vg-nav-item-title">Join Requests</p>
                <p className="vg-nav-item-desc">{joinRequestsCount} pending approval</p>
              </div>
            </div>
            <div className="vg-nav-item-right">
              {joinRequestsCount > 0 && (
                <span className="vg-badge vg-badge-count">{joinRequestsCount}</span>
              )}
              <ChevronRight size={18} className="text-[var(--text-muted)]" />
            </div>
          </button>
        )}
      </div>

      {/* 5. Danger Zone: Leave & Delete */}
      <div ref={dangerZoneRef} className="space-y-3 pt-2">
        {showLeaveConfirm ? (
          <div className="vg-danger-card">
            <p className="vg-danger-card-title">
              <AlertTriangle size={16} />
              <span>Leave this group?</span>
            </p>
            <p className="vg-danger-card-text">
              You will no longer receive new messages or participate in conversations in this group.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={onLeaveGroup}
                className="btn-danger btn-sm"
              >
                {actionLoading ? 'Leaving...' : 'Confirm Leave'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowLeaveConfirm(true)}
            className="btn-secondary w-full text-[var(--danger)]"
          >
            <LogOut size={16} />
            <span>Leave Group</span>
          </button>
        )}

        {(isAdmin || isOwner) && (
          showDeleteConfirm ? (
            <div className="vg-danger-card">
              <p className="vg-danger-card-title">
                <AlertTriangle size={16} />
                <span>Delete Group Permanently?</span>
              </p>
              <p className="vg-danger-card-text">
                This action cannot be undone. All messages, media, and membership records will be permanently erased for everyone.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={onDeleteGroup}
                  className="btn-danger btn-sm"
                >
                  {actionLoading ? 'Deleting...' : 'Delete Forever'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-secondary w-full text-xs text-[var(--danger)]"
            >
              <Trash2 size={15} />
              <span>Delete Group</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}

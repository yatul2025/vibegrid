/**
 * client/src/components/group-settings/views/PermissionsView.jsx
 * ===============================================================
 * Screen 3: Group Permissions
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  MessageSquare,
  UserPlus,
  Share2,
  Users,
  Settings,
  UserCheck,
  Crown,
  Lock,
  Check
} from 'lucide-react';

export default function PermissionsView({
  permissions = {},
  isAdmin = false,
  onUpdatePermissions,
  actionLoading = false
}) {
  const [localPerms, setLocalPerms] = useState({
    allow_member_info_edit: !!permissions.allow_member_info_edit,
    allow_member_messages: permissions.allow_member_messages !== false,
    allow_member_adds: permissions.allow_member_adds !== false,
    allow_member_invites: permissions.allow_member_invites !== false,
    require_admin_approval: !!permissions.require_admin_approval,
    admins_manage_members: permissions.admins_manage_members !== false,
    admins_manage_settings: permissions.admins_manage_settings !== false,
    admins_manage_admins: !!permissions.admins_manage_admins
  });

  useEffect(() => {
    if (permissions && typeof permissions === 'object') {
      setLocalPerms({
        allow_member_info_edit: !!permissions.allow_member_info_edit,
        allow_member_messages: permissions.allow_member_messages !== false,
        allow_member_adds: permissions.allow_member_adds !== false,
        allow_member_invites: permissions.allow_member_invites !== false,
        require_admin_approval: !!permissions.require_admin_approval,
        admins_manage_members: permissions.admins_manage_members !== false,
        admins_manage_settings: permissions.admins_manage_settings !== false,
        admins_manage_admins: !!permissions.admins_manage_admins
      });
    }
  }, [permissions]);

  const handleToggle = async (key) => {
    if (!isAdmin || actionLoading) return;
    const nextState = !localPerms[key];
    const updated = { ...localPerms, [key]: nextState };
    setLocalPerms(updated);

    // Sync to backend
    if (onUpdatePermissions) {
      await onUpdatePermissions(updated);
    }
  };

  const renderToggle = (key, label, description, icon) => {
    const isChecked = !!localPerms[key];

    return (
      <div
        key={key}
        className="flex items-start justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all text-left gap-3"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-white/5 text-zinc-300 shrink-0 mt-0.5 border border-white/10">
            {icon}
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-white">{label}</p>
            {description && (
              <p className="text-[11px] text-zinc-400 leading-relaxed">{description}</p>
            )}
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={isChecked}
          disabled={!isAdmin || actionLoading}
          onClick={() => handleToggle(key)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
            !isAdmin ? 'opacity-50 cursor-not-allowed' : ''
          } ${isChecked ? 'bg-emerald-500 shadow-lg shadow-emerald-500/25' : 'bg-zinc-800'}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out my-0.5 ${
              isChecked ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {!isAdmin && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs text-left">
          <Lock size={15} className="shrink-0" />
          <span>Only group administrators can modify group permissions.</span>
        </div>
      )}

      {/* Members Can Section */}
      <div className="space-y-2.5 text-left">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
          Members can:
        </h3>
        <div className="space-y-2">
          {renderToggle(
            'allow_member_info_edit',
            'Edit group settings',
            'Name, icon, description, disappearing messages, pin, and more.',
            <Settings size={16} className="text-emerald-400" />
          )}

          {renderToggle(
            'allow_member_messages',
            'Send new messages',
            'Allow regular members to post messages in this conversation.',
            <MessageSquare size={16} className="text-cyan-400" />
          )}

          {renderToggle(
            'allow_member_adds',
            'Add other members',
            'Allow all members to add new people directly into this group.',
            <UserPlus size={16} className="text-indigo-400" />
          )}

          {renderToggle(
            'allow_member_invites',
            'Invite via link or QR code',
            'Allow members to share the group invite code and QR badge.',
            <Share2 size={16} className="text-pink-400" />
          )}
        </div>
      </div>

      {/* Admins Can Section */}
      <div className="space-y-2.5 text-left">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
          Admins can:
        </h3>
        <div className="space-y-2">
          {renderToggle(
            'require_admin_approval',
            'Approve new members',
            'Must approve join requests before newcomers can enter.',
            <UserCheck size={16} className="text-amber-400" />
          )}

          {renderToggle(
            'admins_manage_members',
            'Manage members',
            'Add or remove members from the conversation.',
            <Users size={16} className="text-emerald-400" />
          )}

          {renderToggle(
            'admins_manage_settings',
            'Manage group settings',
            'Edit group permissions, security parameters, and metadata.',
            <Shield size={16} className="text-cyan-400" />
          )}

          {renderToggle(
            'admins_manage_admins',
            'Manage admins',
            'Add or remove other administrators.',
            <Crown size={16} className="text-purple-400" />
          )}
        </div>
      </div>
    </div>
  );
}

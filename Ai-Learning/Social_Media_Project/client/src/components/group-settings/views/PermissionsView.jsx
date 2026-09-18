/**
 * client/src/components/group-settings/views/PermissionsView.jsx
 * ===============================================================
 * Screen 3: Group Permissions — Unified VibeGrid Design + SpringToggle
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
import SpringToggle from '../../SpringToggle';

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

    if (onUpdatePermissions) {
      await onUpdatePermissions(updated);
    }
  };

  const renderToggleRow = (key, label, description, icon) => {
    const isChecked = !!localPerms[key];

    return (
      <div
        key={key}
        className="flex items-center justify-between p-3.5 transition-all text-left gap-3 hover:bg-[var(--bg-card)]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--text-primary)] m-0">{label}</p>
            {description && (
              <p className="text-[11px] text-[var(--text-muted)] m-0 leading-tight">{description}</p>
            )}
          </div>
        </div>

        {/* VibeGrid Fluid SpringToggle with haptics & audio snap */}
        <div className="shrink-0">
          <SpringToggle
            checked={isChecked}
            onChange={() => handleToggle(key)}
            disabled={!isAdmin || actionLoading}
            id={`perm-toggle-${key}`}
            title={label}
            data-testid={`perm-toggle-${key}`}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 text-left">
      {/* Banner Notice */}
      <div className="p-3 rounded-xl bg-[var(--primary-light)] border border-[var(--primary)] text-xs text-[var(--primary)] flex items-center gap-2.5">
        <Shield size={16} className="shrink-0" />
        <span className="leading-snug">
          {isAdmin
            ? 'Toggle group permissions in real-time. Changes apply to all members immediately.'
            : 'Only group administrators can modify group permissions.'}
        </span>
      </div>

      {/* 1. Member Participation Section */}
      <div className="space-y-1">
        <p className="vg-section-label">
          Members can:
        </p>
        <div className="vg-card-subtle divide-y divide-[var(--border-color)]">
          {renderToggleRow(
            'allow_member_info_edit',
            'Edit Group Info',
            'Allow members to edit the name, icon, and description',
            <Settings size={16} />
          )}

          {renderToggleRow(
            'allow_member_messages',
            'Send Messages',
            'Allow group members to send text and media',
            <MessageSquare size={16} />
          )}

          {renderToggleRow(
            'allow_member_adds',
            'Add Other Members',
            'Allow members to add friends to this group',
            <UserPlus size={16} />
          )}

          {renderToggleRow(
            'allow_member_invites',
            'Share Group Link',
            'Allow members to copy and share the invite link',
            <Share2 size={16} />
          )}
        </div>
      </div>

      {/* 2. Membership Approval Section */}
      <div className="space-y-1">
        <p className="vg-section-label">
          Membership Controls
        </p>
        <div className="vg-card-subtle divide-y divide-[var(--border-color)]">
          {renderToggleRow(
            'require_admin_approval',
            'Approve New Members',
            'Require an admin to approve join requests from invite links',
            <UserCheck size={16} />
          )}
        </div>
      </div>

      {/* 3. Administrative Powers Section */}
      <div className="space-y-1">
        <p className="vg-section-label">
          Admins can:
        </p>
        <div className="vg-card-subtle divide-y divide-[var(--border-color)]">
          {renderToggleRow(
            'admins_manage_members',
            'Admins Can Remove Members',
            'Admins can remove members and revoke invites',
            <Users size={16} />
          )}

          {renderToggleRow(
            'admins_manage_settings',
            'Admins Can Edit Permissions',
            'Allow any admin to modify these group permissions',
            <Shield size={16} />
          )}

          {renderToggleRow(
            'admins_manage_admins',
            'Admins Can Appoint Admins',
            'Allow non-owner admins to promote other members',
            <Crown size={16} />
          )}
        </div>
      </div>
    </div>
  );
}

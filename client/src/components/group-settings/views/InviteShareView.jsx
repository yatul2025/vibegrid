/**
 * client/src/components/group-settings/views/InviteShareView.jsx
 * ===============================================================
 * Screen 4: Invite & Share (QR Code, Invite Link & Settings) — Unified VibeGrid Design
 */

import React, { useState } from 'react';
import {
  QrCode,
  Share2,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Shield,
  UserCheck,
  Globe,
  Lock
} from 'lucide-react';
import SpringToggle from '../../SpringToggle';

export default function InviteShareView({
  group,
  inviteCode,
  isAdmin = false,
  permissions = {},
  onRegenerateInvite,
  onUpdatePermissions,
  actionLoading = false,
  onShowToast
}) {
  const [copied, setCopied] = useState(false);
  const [expireTime, setExpireTime] = useState('never');

  const fullUrl = `${window.location.origin}/join/${inviteCode || group?.invite_code || 'grp_' + (group?.id || 'demo')}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      if (onShowToast) onShowToast('Invite link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (onShowToast) onShowToast('Failed to copy link', 'error');
    }
  };

  const handleShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${group?.title || 'our group'} on VibeGrid`,
          text: `Use this link to join ${group?.title || 'our group'} on VibeGrid:`,
          url: fullUrl
        });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  const handleTogglePerm = async (key) => {
    if (!isAdmin || !onUpdatePermissions || actionLoading) return;
    const current = !!permissions[key];
    await onUpdatePermissions({ ...permissions, [key]: !current });
  };

  return (
    <div className="space-y-4 text-left">
      {/* 1. Branded QR Code Presentation Card */}
      <div className="vg-card-subtle p-5 flex flex-col items-center text-center">
        <div className="p-4 bg-white rounded-2xl shadow-xl inline-block mb-3 border border-[var(--border-color)]">
          <svg
            className="w-40 h-40"
            viewBox="0 0 160 160"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Corner Markers */}
            <rect x="10" y="10" width="40" height="40" rx="6" fill="#090d16" />
            <rect x="16" y="16" width="28" height="28" rx="4" fill="#ffffff" />
            <rect x="22" y="22" width="16" height="16" rx="2" fill="#6366f1" />

            <rect x="110" y="10" width="40" height="40" rx="6" fill="#090d16" />
            <rect x="116" y="16" width="28" height="28" rx="4" fill="#ffffff" />
            <rect x="122" y="22" width="16" height="16" rx="2" fill="#6366f1" />

            <rect x="10" y="110" width="40" height="40" rx="6" fill="#090d16" />
            <rect x="16" y="116" width="28" height="28" rx="4" fill="#ffffff" />
            <rect x="22" y="122" width="16" height="16" rx="2" fill="#6366f1" />

            {/* Pattern Dots */}
            <rect x="60" y="14" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="74" y="14" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="88" y="14" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="60" y="28" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="88" y="28" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="60" y="42" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="74" y="42" width="8" height="8" rx="2" fill="#090d16" />

            <rect x="14" y="60" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="28" y="60" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="42" y="60" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="14" y="74" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="42" y="74" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="14" y="88" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="28" y="88" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="42" y="88" width="8" height="8" rx="2" fill="#090d16" />

            <rect x="110" y="60" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="124" y="60" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="138" y="60" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="124" y="74" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="110" y="88" width="8" height="8" rx="2" fill="#090d16" />
            <rect x="124" y="88" width="8" height="8" rx="2" fill="#090d16" />

            {/* VibeGrid Center Brand Badge */}
            <circle cx="80" cy="80" r="14" fill="#090d16" />
            <circle cx="80" cy="80" r="11" fill="url(#qr-brand-gradient)" />
            <defs>
              <linearGradient id="qr-brand-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="50%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#f43f5e" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <h4 className="text-sm font-bold text-[var(--text-primary)] m-0">
          Scan to join this group
        </h4>
        <p className="text-xs text-[var(--text-muted)] mt-1 mb-3">
          Anyone with this QR code or invite link can join the conversation.
        </p>

        <button
          type="button"
          onClick={handleShareLink}
          className="btn-secondary btn-sm"
        >
          <Share2 size={14} />
          <span>Share QR Code</span>
        </button>
      </div>

      {/* 2. Direct Invite URL Box */}
      <div className="space-y-2">
        <p className="vg-section-label">
          Invite Link
        </p>
        <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--bg-page)] border border-[var(--border-color)]">
          <input
            type="text"
            readOnly
            value={fullUrl}
            className="flex-1 bg-transparent text-xs text-[var(--text-primary)] select-all focus:outline-none truncate font-mono px-2"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            title="Copy URL"
            className="btn-primary btn-sm shrink-0"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy Link'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={handleShareLink}
            className="btn-secondary w-full"
          >
            <Share2 size={14} />
            <span>Share Link</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={onRegenerateInvite}
              disabled={actionLoading}
              className="btn-secondary w-full text-[var(--danger)]"
            >
              <RefreshCw size={14} className={actionLoading ? 'animate-spin' : ''} />
              <span>Regenerate Link</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Link Permissions & Settings */}
      <div className="space-y-1">
        <p className="vg-section-label">
          Link Security Settings
        </p>
        <div className="vg-card-subtle divide-y divide-[var(--border-color)]">
          {/* Allow Anyone to Join */}
          <div className="flex items-center justify-between p-3.5 gap-3">
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)] m-0">Direct Join via Link</p>
              <p className="text-[11px] text-[var(--text-muted)] m-0">Members join instantly without waiting</p>
            </div>
            <SpringToggle
              checked={permissions.allow_anyone_to_join !== false}
              onChange={() => handleTogglePerm('allow_anyone_to_join')}
              disabled={!isAdmin || actionLoading}
              id="perm-allow-anyone-join"
              title="Allow direct join"
            />
          </div>

          {/* Require Admin Approval */}
          <div className="flex items-center justify-between p-3.5 gap-3">
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)] m-0">Require Admin Approval</p>
              <p className="text-[11px] text-[var(--text-muted)] m-0">New visitors must be approved before entering</p>
            </div>
            <SpringToggle
              checked={!!permissions.require_admin_approval}
              onChange={() => handleTogglePerm('require_admin_approval')}
              disabled={!isAdmin || actionLoading}
              id="perm-require-admin-approval"
              title="Require admin approval"
            />
          </div>

          {/* Expire Link Selector */}
          <div className="flex items-center justify-between p-3.5 gap-3">
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)] m-0">Link Expiration</p>
              <p className="text-[11px] text-[var(--text-muted)] m-0">Automatically rotate link after time</p>
            </div>
            <select
              value={expireTime}
              onChange={(e) => setExpireTime(e.target.value)}
              disabled={!isAdmin}
              className="bg-[var(--bg-page)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] rounded-lg px-2.5 py-1 focus:outline-none focus:border-[var(--primary)]"
            >
              <option value="never">Never</option>
              <option value="1h">1 hour</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

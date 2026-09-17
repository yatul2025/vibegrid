/**
 * client/src/components/group-settings/views/InviteShareView.jsx
 * ===============================================================
 * Screen 4: Invite & Share (QR Code, Invite Link & Settings)
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
  const [copiedQr, setCopiedQr] = useState(false);
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
    <div className="space-y-5 animate-in fade-in duration-200 text-left">
      {/* QR Code Presentation Card */}
      <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-white/[0.03] border border-white/10 shadow-xl space-y-3">
        <div className="relative p-4 rounded-xl bg-white flex items-center justify-center shadow-lg shadow-black/40">
          {/* Stylized QR Code SVG Representation */}
          <svg
            className="w-44 h-44"
            viewBox="0 0 160 160"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Corner Markers */}
            <rect x="10" y="10" width="40" height="40" rx="6" fill="#0a0c10" />
            <rect x="16" y="16" width="28" height="28" rx="4" fill="#ffffff" />
            <rect x="22" y="22" width="16" height="16" rx="2" fill="#0a0c10" />

            <rect x="110" y="10" width="40" height="40" rx="6" fill="#0a0c10" />
            <rect x="116" y="16" width="28" height="28" rx="4" fill="#ffffff" />
            <rect x="122" y="22" width="16" height="16" rx="2" fill="#0a0c10" />

            <rect x="10" y="110" width="40" height="40" rx="6" fill="#0a0c10" />
            <rect x="16" y="116" width="28" height="28" rx="4" fill="#ffffff" />
            <rect x="22" y="122" width="16" height="16" rx="2" fill="#0a0c10" />

            {/* Pattern Dots */}
            <rect x="60" y="14" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="74" y="14" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="88" y="14" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="60" y="28" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="88" y="28" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="60" y="42" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="74" y="42" width="8" height="8" rx="2" fill="#0a0c10" />

            <rect x="14" y="60" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="28" y="60" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="42" y="60" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="14" y="74" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="42" y="74" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="14" y="88" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="28" y="88" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="42" y="88" width="8" height="8" rx="2" fill="#0a0c10" />

            <rect x="110" y="60" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="124" y="60" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="138" y="60" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="124" y="74" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="110" y="88" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="138" y="88" width="8" height="8" rx="2" fill="#0a0c10" />

            <rect x="60" y="110" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="74" y="110" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="88" y="110" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="74" y="124" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="60" y="138" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="88" y="138" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="110" y="124" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="124" y="138" width="8" height="8" rx="2" fill="#0a0c10" />
            <rect x="138" y="138" width="8" height="8" rx="2" fill="#0a0c10" />

            {/* Center VibeGrid Logo Badge */}
            <circle cx="80" cy="80" r="16" fill="#0a0c10" />
            <rect x="68" y="68" width="24" height="24" rx="6" fill="url(#vg-grad)" />
            <path
              d="M74 74 L80 85 L86 74"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="vg-grad" x1="68" y1="68" x2="92" y2="92" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ec4899" />
                <stop offset="0.5" stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div>
          <h3 className="text-sm font-bold text-white">Scan to join this group</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Anyone with this QR code can join this group.
          </p>
        </div>

        <button
          type="button"
          onClick={handleShareLink}
          className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-500/20 via-cyan-500/20 to-emerald-500/20 border border-white/20 hover:border-white/40 text-xs font-semibold text-white flex items-center gap-2 transition-all hover:scale-[1.02]"
        >
          <Share2 size={14} className="text-cyan-400" />
          <span>Share QR Code</span>
        </button>
      </div>

      {/* Invite Link Section */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
          Invite Link
        </h3>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus-within:border-emerald-500/50 transition-colors">
          <input
            type="text"
            readOnly
            value={fullUrl}
            className="flex-1 bg-transparent text-xs text-zinc-300 select-all focus:outline-none truncate"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            title="Copy URL"
            className="p-1.5 text-zinc-400 hover:text-emerald-400 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          >
            {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow-md hover:scale-[1.02]"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            <span>{copied ? 'Copied' : 'Copy Link'}</span>
          </button>

          <button
            type="button"
            onClick={handleShareLink}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/[0.05] border border-white/15 hover:bg-white/10 text-white font-semibold text-xs transition-all hover:scale-[1.02]"
          >
            <Share2 size={15} />
            <span>Share Link</span>
          </button>
        </div>
      </div>

      {/* Link Settings Card */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Link Settings
        </h3>

        {/* Allow Anyone to Join */}
        <div className="flex items-center justify-between gap-3 text-left">
          <div>
            <p className="text-xs font-semibold text-white">Allow anyone to join</p>
            <p className="text-[11px] text-zinc-400">Directly enter the group without waiting.</p>
          </div>
          <button
            type="button"
            role="switch"
            disabled={!isAdmin || actionLoading}
            onClick={() => handleTogglePerm('allow_anyone_to_join')}
            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full transition-colors ${
              permissions.allow_anyone_to_join !== false ? 'bg-emerald-500' : 'bg-zinc-800'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                permissions.allow_anyone_to_join !== false ? 'translate-x-5' : 'translate-x-0.5'
              } my-0.5`}
            />
          </button>
        </div>

        {/* Require Admin Approval */}
        <div className="flex items-center justify-between gap-3 text-left border-t border-white/5 pt-3">
          <div>
            <p className="text-xs font-semibold text-white">Require admin approval</p>
            <p className="text-[11px] text-zinc-400">Joiners go to pending requests queue.</p>
          </div>
          <button
            type="button"
            role="switch"
            disabled={!isAdmin || actionLoading}
            onClick={() => handleTogglePerm('require_admin_approval')}
            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full transition-colors ${
              permissions.require_admin_approval ? 'bg-emerald-500' : 'bg-zinc-800'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                permissions.require_admin_approval ? 'translate-x-5' : 'translate-x-0.5'
              } my-0.5`}
            />
          </button>
        </div>

        {/* Expire Link Selector */}
        <div className="flex items-center justify-between gap-3 text-left border-t border-white/5 pt-3">
          <div>
            <p className="text-xs font-semibold text-white">Expire link</p>
            <p className="text-[11px] text-zinc-400">Auto-revoke code after period.</p>
          </div>
          <select
            value={expireTime}
            onChange={(e) => setExpireTime(e.target.value)}
            disabled={!isAdmin}
            className="bg-zinc-900 border border-white/15 text-xs text-white rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          >
            <option value="never">Never &gt;</option>
            <option value="1h">1 hour</option>
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
          </select>
        </div>

        {/* Regenerate Link */}
        {isAdmin && (
          <div className="border-t border-white/5 pt-3">
            <button
              type="button"
              onClick={onRegenerateInvite}
              disabled={actionLoading}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-cyan-500/40 text-xs text-cyan-400 font-medium transition-all"
            >
              <RefreshCw size={14} className={actionLoading ? 'animate-spin' : ''} />
              <span>Regenerate Link</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

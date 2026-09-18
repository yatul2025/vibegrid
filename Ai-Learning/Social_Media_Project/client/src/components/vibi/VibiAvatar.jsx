/**
 * client/src/components/vibi/VibiAvatar.jsx
 * ==========================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 2 UI FOUNDATION
 *
 * Reusable, crisp SVG Red Panda mascot avatar for Vibi.
 * Matches VibeGrid's brand mascot identity with gradient accents.
 */

import React from 'react';

export default function VibiAvatar({
  size = 36,
  withStatusDot = false,
  isOnline = true,
  className = '',
  style = {}
}) {
  return (
    <div
      className={`vibi-avatar-badge ${className}`}
      style={{ width: size, height: size, position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style }}
      aria-label="Vibi Mascot Avatar"
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="vibi-avatar-svg"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="vibiAvatarFurGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="60%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#c2410c" />
          </linearGradient>
          <linearGradient id="vibiAvatarCheekGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#fff7ed" />
          </linearGradient>
          <filter id="vibiAvatarShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Left Ear */}
        <polygon points="18,40 8,14 38,24" fill="#ea580c" />
        <polygon points="16,34 12,20 32,25" fill="#fed7aa" />
        <path d="M14 24 Q18 28 22 26" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />

        {/* Right Ear */}
        <polygon points="82,40 92,14 62,24" fill="#ea580c" />
        <polygon points="84,34 88,20 68,25" fill="#fed7aa" />
        <path d="M86 24 Q82 28 78 26" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />

        {/* Head */}
        <ellipse cx="50" cy="54" rx="36" ry="32" fill="url(#vibiAvatarFurGrad)" filter="url(#vibiAvatarShadow)" />

        {/* White Cheek Tufts */}
        <ellipse cx="30" cy="62" rx="14" ry="11" fill="url(#vibiAvatarCheekGrad)" />
        <ellipse cx="70" cy="62" rx="14" ry="11" fill="url(#vibiAvatarCheekGrad)" />

        {/* Eyebrow Spots */}
        <ellipse cx="36" cy="38" rx="4" ry="2.5" fill="#fed7aa" transform="rotate(-10 36 38)" />
        <ellipse cx="64" cy="38" rx="4" ry="2.5" fill="#fed7aa" transform="rotate(10 64 38)" />

        {/* Eyes with Highlights */}
        <g className="vibi-avatar-eyes">
          <ellipse cx="38" cy="50" rx="5" ry="6" fill="#1e293b" />
          <circle cx="36.5" cy="48" r="2" fill="#ffffff" />
          <circle cx="40" cy="52.5" r="1" fill="#ffffff" />

          <ellipse cx="62" cy="50" rx="5" ry="6" fill="#1e293b" />
          <circle cx="60.5" cy="48" r="2" fill="#ffffff" />
          <circle cx="64" cy="52.5" r="1" fill="#ffffff" />
        </g>

        {/* Snout & Nose */}
        <ellipse cx="50" cy="61" rx="8" ry="5.5" fill="#fed7aa" />
        <polygon points="46,58 54,58 50,62" fill="#431407" />
        <path
          d="M47 63 Q50 66 53 63"
          stroke="#431407"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Online / Ready Status Indicator Dot */}
      {withStatusDot && (
        <span
          className={`vibi-status-dot ${isOnline ? 'online' : 'offline'}`}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: Math.max(8, Math.round(size * 0.26)),
            height: Math.max(8, Math.round(size * 0.26)),
            borderRadius: '50%',
            backgroundColor: isOnline ? '#10b981' : '#94a3b8',
            border: '2px solid var(--bg-card, #ffffff)',
            boxShadow: isOnline ? '0 0 6px rgba(16, 185, 129, 0.6)' : 'none'
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

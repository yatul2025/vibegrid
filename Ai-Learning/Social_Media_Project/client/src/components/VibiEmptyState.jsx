import React, { useState } from 'react';

/**
 * VibiEmptyState Component
 * ========================
 * Phase 6 Delight Feature: Empty States Delight (Option 1: Vibi's Mascot Moments)
 *
 * Renders an animated, interactive empty state starring Vibi the Red Panda
 * with contextual props, accessories (camera, mail, wave, bookmark, magnifier),
 * tap-to-wiggle physics, floating sparkles, and prominent call-to-action buttons.
 */
export default function VibiEmptyState({
  pose = 'general',
  title = 'Nothing here yet!',
  subtitle = '',
  actionLabel,
  onAction,
  actionIcon,
  secondaryLabel,
  onSecondaryAction,
  children,
  className = '',
  testId = 'vibi-empty-state'
}) {
  const [isWiggling, setIsWiggling] = useState(false);

  const handleMascotClick = () => {
    setIsWiggling(true);
    setTimeout(() => setIsWiggling(false), 600);
  };

  return (
    <div
      className={`vibi-empty-state-container ${className}`}
      data-testid={testId}
      role="status"
      aria-live="polite"
    >
      {/* Interactive Mascot Stage */}
      <div
        className={`vibi-empty-mascot-stage ${isWiggling ? 'wiggling' : ''}`}
        onClick={handleMascotClick}
        title="Click Vibi for a wiggle!"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleMascotClick();
          }
        }}
      >
        {/* Floating Ambient Sparkles */}
        <span className="vibi-empty-sparkle sparkle-top-right" aria-hidden="true">✨</span>
        <span className="vibi-empty-sparkle sparkle-bottom-left" aria-hidden="true">🌟</span>
        <span className="vibi-empty-sparkle sparkle-top-left" aria-hidden="true">💫</span>

        {/* Vibi SVG Character */}
        <svg
          viewBox="0 0 100 100"
          className="vibi-empty-svg"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id="vibiEmptyFur" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="60%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#c2410c" />
            </linearGradient>
            <linearGradient id="vibiEmptyCheek" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#fff7ed" />
            </linearGradient>
            <filter id="vibiEmptyShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodOpacity="0.28" />
            </filter>
          </defs>

          {/* Tail */}
          <g className="vibi-tail-sway">
            <path
              d="M22 75 C8 64 10 44 22 36 C28 48 27 64 28 76 Z"
              fill="#ea580c"
            />
            <path d="M15 50 C18 47 24 50 25 54 C22 56 17 54 15 50 Z" fill="#fed7aa" />
            <path d="M18 61 C21 58 26 61 27 65 C24 67 20 65 18 61 Z" fill="#fed7aa" />
            <circle cx="21" cy="38" r="4.5" fill="#fff7ed" />
          </g>

          {/* Left Ear */}
          <polygon points="20,38 12,16 38,24" fill="#ea580c" />
          <polygon points="18,33 15,22 32,25" fill="#fed7aa" />

          {/* Right Ear */}
          <polygon points="80,38 88,16 62,24" fill="#ea580c" />
          <polygon points="82,33 85,22 68,25" fill="#fed7aa" />

          {/* Head */}
          <ellipse cx="50" cy="52" rx="34" ry="29" fill="url(#vibiEmptyFur)" filter="url(#vibiEmptyShadow)" />

          {/* Cheek Tufts */}
          <ellipse cx="32" cy="60" rx="13" ry="10" fill="url(#vibiEmptyCheek)" />
          <ellipse cx="68" cy="60" rx="13" ry="10" fill="url(#vibiEmptyCheek)" />

          {/* Eyebrows */}
          <ellipse cx="38" cy="39" rx="3.5" ry="2.2" fill="#fed7aa" transform="rotate(-10 38 39)" />
          <ellipse cx="62" cy="39" rx="3.5" ry="2.2" fill="#fed7aa" transform="rotate(10 62 39)" />

          {/* Eyes */}
          <g className="vibi-eyes-blink">
            <ellipse cx="40" cy="49" rx="4.8" ry="5.8" fill="#1e293b" />
            <circle cx="38.5" cy="46.8" r="1.9" fill="#ffffff" />
            <circle cx="42" cy="51" r="0.9" fill="#ffffff" />

            <ellipse cx="60" cy="49" rx="4.8" ry="5.8" fill="#1e293b" />
            <circle cx="58.5" cy="46.8" r="1.9" fill="#ffffff" />
            <circle cx="62" cy="51" r="0.9" fill="#ffffff" />
          </g>

          {/* Snout & Nose */}
          <ellipse cx="50" cy="59" rx="7" ry="5.2" fill="#fed7aa" />
          <polygon points="47,56 53,56 50,60" fill="#431407" />
          <path d="M47 61 Q50 63.5 53 61" stroke="#431407" strokeWidth="1.6" strokeLinecap="round" fill="none" />

          {/* Body */}
          <path d="M30 78 Q50 87 70 78 L66 98 L34 98 Z" fill="#c2410c" />
          <path d="M43 80 Q50 84 57 80 L54 94 Q50 96 46 94 Z" fill="#fff7ed" />

          {/* Poses / Accessories */}
          {pose === 'camera' && (
            <g className="vibi-accessory-camera">
              {/* Camera Body */}
              <rect x="40" y="74" width="20" height="15" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.2" />
              <circle cx="50" cy="81.5" r="4.5" fill="#334155" stroke="#00f0ff" strokeWidth="1" />
              <circle cx="50" cy="81.5" r="2.2" fill="#00f0ff" />
              <rect x="43" y="72" width="4" height="2" rx="0.5" fill="#ef4444" />
              {/* Paws holding camera */}
              <ellipse cx="38" cy="80" rx="4" ry="3.5" fill="#fff7ed" stroke="#ea580c" strokeWidth="1.2" />
              <ellipse cx="62" cy="80" rx="4" ry="3.5" fill="#fff7ed" stroke="#ea580c" strokeWidth="1.2" />
            </g>
          )}

          {pose === 'mail' && (
            <g className="vibi-accessory-mail">
              {/* Envelope */}
              <rect x="40" y="75" width="20" height="14" rx="2" fill="#6366f1" stroke="#a5b4fc" strokeWidth="1" />
              <polyline points="40 75 50 82 60 75" fill="none" stroke="#ffffff" strokeWidth="1.2" />
              {/* Paws */}
              <ellipse cx="38" cy="80" rx="4" ry="3.5" fill="#fff7ed" stroke="#ea580c" strokeWidth="1.2" />
              <ellipse cx="62" cy="80" rx="4" ry="3.5" fill="#fff7ed" stroke="#ea580c" strokeWidth="1.2" />
            </g>
          )}

          {pose === 'wave' && (
            <g className="vibi-accessory-wave">
              {/* Waving Paw on Left */}
              <g className="vibi-paw-wave">
                <ellipse cx="24" cy="68" rx="6.5" ry="5.5" fill="#fff7ed" stroke="#ea580c" strokeWidth="1.5" />
                <circle cx="24" cy="68" r="2" fill="#f97316" />
              </g>
              {/* Resting Paw */}
              <ellipse cx="72" cy="79" rx="5.5" ry="4.5" fill="#fff7ed" stroke="#ea580c" strokeWidth="1.5" />
            </g>
          )}

          {pose === 'treasure' && (
            <g className="vibi-accessory-treasure">
              {/* Glowing Bookmark Star */}
              <path
                d="M45 74 L55 74 L55 88 L50 84 L45 88 Z"
                fill="#f59e0b"
                stroke="#fef08a"
                strokeWidth="1"
              />
              <circle cx="50" cy="78" r="2" fill="#ffffff" />
              <ellipse cx="43" cy="81" rx="4" ry="3.5" fill="#fff7ed" stroke="#ea580c" strokeWidth="1.2" />
              <ellipse cx="57" cy="81" rx="4" ry="3.5" fill="#fff7ed" stroke="#ea580c" strokeWidth="1.2" />
            </g>
          )}

          {pose === 'magnifier' && (
            <g className="vibi-accessory-magnifier">
              {/* Magnifying Glass */}
              <circle cx="56" cy="75" r="7" fill="rgba(0, 240, 255, 0.25)" stroke="#00f0ff" strokeWidth="1.5" />
              <line x1="51" y1="80" x2="45" y2="87" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
              <ellipse cx="44" cy="82" rx="4" ry="3.5" fill="#fff7ed" stroke="#ea580c" strokeWidth="1.2" />
              <ellipse cx="64" cy="82" rx="4" ry="3.5" fill="#fff7ed" stroke="#ea580c" strokeWidth="1.2" />
            </g>
          )}

          {pose === 'general' && (
            <g className="vibi-accessory-general">
              {/* Normal resting paws */}
              <ellipse cx="36" cy="80" rx="5" ry="4" fill="#fff7ed" stroke="#ea580c" strokeWidth="1.5" />
              <ellipse cx="64" cy="80" rx="5" ry="4" fill="#fff7ed" stroke="#ea580c" strokeWidth="1.5" />
            </g>
          )}
        </svg>
      </div>

      {/* Text Group */}
      <h3 className="vibi-empty-title">{title}</h3>
      {subtitle && <p className="vibi-empty-subtitle">{subtitle}</p>}

      {/* Action Buttons & Custom Children */}
      {(actionLabel || secondaryLabel || children) && (
        <div className="vibi-empty-actions">
          {actionLabel && onAction && (
            <button
              type="button"
              className="btn-primary vibi-empty-action-btn"
              onClick={onAction}
            >
              {actionIcon && <span className="vibi-empty-btn-icon">{actionIcon}</span>}
              <span>{actionLabel}</span>
            </button>
          )}

          {secondaryLabel && onSecondaryAction && (
            <button
              type="button"
              className="btn-secondary vibi-empty-secondary-btn"
              onClick={onSecondaryAction}
            >
              {secondaryLabel}
            </button>
          )}

          {children}
        </div>
      )}
    </div>
  );
}

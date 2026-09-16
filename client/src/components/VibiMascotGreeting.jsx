/**
 * client/src/components/VibiMascotGreeting.jsx
 * ============================================
 * Phase 1: VibeGrid Mascot & App Open Animation — Option 2: Vibi (Playful Red Panda)
 *
 * Behavior:
 * 1. App opens / initial session load -> Vibi peeks in from bottom-left.
 * 2. Displays a warm, theme-aware speech bubble: "Welcome back, @username! 🦊👋".
 * 3. Winks, waves paw, stays for ~2.5 seconds, then scampers/slides back down.
 * 4. Can be tapped to dismiss immediately.
 * 5. Respects prefers-reduced-motion (skips spring/drop movement).
 * 6. Non-intrusive: pointer-events are disabled on backdrop/wrapper so
 *    buttons, feed posts, and navigation remain fully clickable.
 * 7. Session-aware: runs once per app session (stored in sessionStorage).
 */

import React, { useState, useEffect, useRef } from 'react';

export default function VibiMascotGreeting({ user, forceShow = false, onDismiss }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Check reduced motion preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
    }

    // Check session storage to only greet once per session unless forced
    try {
      const alreadySeen = sessionStorage.getItem('vibegrid_vibi_mascot_seen');
      if (!alreadySeen || forceShow) {
        // Small delay to allow home feed layout to stabilize
        const openTimer = setTimeout(() => {
          setIsVisible(true);
          sessionStorage.setItem('vibegrid_vibi_mascot_seen', 'true');
        }, 350);

        return () => clearTimeout(openTimer);
      }
    } catch {
      // Fallback if sessionStorage is disabled/blocked
      setIsVisible(true);
    }
  }, [forceShow]);

  // Auto-dismiss after 2.8 seconds
  useEffect(() => {
    if (isVisible && !isExiting) {
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, 2800);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [isVisible, isExiting]);

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsExiting(false);
      if (onDismiss) onDismiss();
    }, 450);
  };

  if (!isVisible) return null;

  const displayName = user?.username ? `@${user.username}` : (user?.full_name || 'Viber');
  const greetingMessage = user
    ? `Welcome back, ${displayName}! 🦊👋`
    : 'Welcome to VibeGrid! 🦊👋';

  return (
    <aside
      className="vibi-mascot-container"
      data-testid="vibi-mascot-greeting"
      role="status"
      aria-live="polite"
      aria-label={`Vibi mascot says: ${greetingMessage}`}
    >
      <div
        className={`vibi-mascot-wrapper ${isExiting ? 'vibi-exit' : 'vibi-enter'} ${
          prefersReducedMotion ? 'reduced-motion' : ''
        }`}
        onClick={handleDismiss}
        title="Tap to dismiss Vibi"
      >
        {/* Speech Bubble */}
        <div className="vibi-speech-bubble" data-testid="vibi-speech-bubble">
          <div className="vibi-bubble-header">
            <span className="vibi-badge">Vibi</span>
            <button
              type="button"
              className="vibi-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              aria-label="Dismiss greeting"
            >
              ✕
            </button>
          </div>
          <p className="vibi-bubble-text">{greetingMessage}</p>
        </div>

        {/* Mascot SVG (Playful Electric Red Panda) */}
        <div className="vibi-character-art" data-testid="vibi-character-art">
          <svg
            viewBox="0 0 100 115"
            className="vibi-svg"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient id="vibiFurGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="60%" stopColor="#ea580c" />
                <stop offset="100%" stopColor="#c2410c" />
              </linearGradient>
              <linearGradient id="vibiCheekGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#fff7ed" />
              </linearGradient>
              <filter id="vibiShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.25" />
              </filter>
            </defs>

            {/* Fluffy Striped Tail on Left Side */}
            <g className="vibi-tail-sway">
              <path
                d="M18 85 C4 72 6 48 20 40 C28 54 26 72 26 86 Z"
                fill="#ea580c"
              />
              {/* White Tail Rings */}
              <path
                d="M12 55 C16 52 22 55 24 60 C21 62 15 60 12 55 Z"
                fill="#fed7aa"
              />
              <path
                d="M15 68 C19 65 24 68 26 73 C23 75 18 73 15 68 Z"
                fill="#fed7aa"
              />
              <circle cx="19" cy="42" r="5" fill="#fff7ed" />
            </g>

            {/* Left Ear */}
            <polygon points="18,42 8,16 38,26" fill="#ea580c" />
            <polygon points="16,36 12,22 32,27" fill="#fed7aa" />
            <path d="M14 26 Q18 30 22 28" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />

            {/* Right Ear */}
            <polygon points="82,42 92,16 62,26" fill="#ea580c" />
            <polygon points="84,36 88,22 68,27" fill="#fed7aa" />
            <path d="M86 26 Q82 30 78 28" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />

            {/* Round Head */}
            <ellipse cx="50" cy="56" rx="36" ry="32" fill="url(#vibiFurGrad)" filter="url(#vibiShadow)" />

            {/* White Facial Cheek Tufts */}
            <ellipse cx="30" cy="64" rx="15" ry="12" fill="url(#vibiCheekGrad)" />
            <ellipse cx="70" cy="64" rx="15" ry="12" fill="url(#vibiCheekGrad)" />

            {/* White Eyebrow Accent Spots */}
            <ellipse cx="36" cy="40" rx="4" ry="2.5" fill="#fed7aa" transform="rotate(-10 36 40)" />
            <ellipse cx="64" cy="40" rx="4" ry="2.5" fill="#fed7aa" transform="rotate(10 64 40)" />

            {/* Expressive Eyes with Blink Animation */}
            <g className="vibi-eyes-blink">
              {/* Left Eye */}
              <ellipse cx="38" cy="52" rx="5.5" ry="6.5" fill="#1e293b" />
              <circle cx="36.5" cy="49.5" r="2.2" fill="#ffffff" />
              <circle cx="40.5" cy="54.5" r="1.1" fill="#ffffff" />

              {/* Right Eye (Winking/Happy Glint) */}
              <ellipse cx="62" cy="52" rx="5.5" ry="6.5" fill="#1e293b" />
              <circle cx="60.5" cy="49.5" r="2.2" fill="#ffffff" />
              <circle cx="64.5" cy="54.5" r="1.1" fill="#ffffff" />
            </g>

            {/* Snout & Nose */}
            <ellipse cx="50" cy="63" rx="8" ry="6" fill="#fed7aa" />
            <polygon points="46,60 54,60 50,64" fill="#431407" />
            <path
              d="M47 65 Q50 68 53 65"
              stroke="#431407"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />

            {/* Body / Shoulders */}
            <path d="M28 86 Q50 96 72 86 L68 115 L32 115 Z" fill="#c2410c" />
            {/* White Chest Patch */}
            <path d="M42 88 Q50 93 58 88 L55 105 Q50 108 45 105 Z" fill="#fff7ed" />

            {/* Waving Paw (Left Side) */}
            <g className="vibi-paw-wave">
              <ellipse cx="22" cy="78" rx="8" ry="6.5" fill="#fff7ed" stroke="#ea580c" strokeWidth="2" />
              <circle cx="22" cy="78" r="2.5" fill="#f97316" />
              {/* Paw Toe Dots */}
              <circle cx="17" cy="75" r="1" fill="#ea580c" />
              <circle cx="21" cy="73" r="1" fill="#ea580c" />
              <circle cx="26" cy="74" r="1" fill="#ea580c" />
            </g>

            {/* Resting Right Paw */}
            <ellipse cx="78" cy="84" rx="7" ry="5.5" fill="#fff7ed" stroke="#ea580c" strokeWidth="2" />
          </svg>
        </div>
      </div>
    </aside>
  );
}

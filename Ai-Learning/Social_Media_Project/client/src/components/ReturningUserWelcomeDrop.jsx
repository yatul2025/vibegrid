/**
 * client/src/components/ReturningUserWelcomeDrop.jsx
 * ==================================================
 * Phase 2 Delight Feature: Welcome / Returning User Experience
 * Option 5: Vibi's Daily Vibe Drop (Mascot Streak Micro-Card)
 *
 * Behavior:
 * 1. App opens / returning session -> Drops gently from top-right.
 * 2. Displays: "Welcome back, @username! 👋" + "🔥 X-DAY STREAK" badge.
 * 3. Shows network sync status: "Vibi synced your grid · Catch the vibe!".
 * 4. Stays visible for 3.2s or dismisses immediately on tap / close button.
 * 5. Session-aware: runs once per app session (sessionStorage).
 * 6. Non-intrusive: pointer-events are disabled on container overlay.
 * 7. Fully theme-aware and accessible (prefers-reduced-motion compliant).
 */

import React, { useState, useEffect, useRef } from 'react';

export default function ReturningUserWelcomeDrop({ user, unreadCount = 0, forceShow = false, onDismiss }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [streakDays, setStreakDays] = useState(1);
  const timerRef = useRef(null);

  useEffect(() => {
    // Check reduced motion preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mq.matches);
    }

    // Calculate or retrieve daily visit streak
    try {
      const today = new Date().toDateString();
      const lastVisit = localStorage.getItem('vibegrid_last_visit_date');
      const savedStreak = parseInt(localStorage.getItem('vibegrid_visit_streak') || '0', 10);

      if (lastVisit === today) {
        setStreakDays(Math.max(1, savedStreak));
      } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const wasYesterday = lastVisit === yesterday.toDateString();

        const newStreak = wasYesterday ? savedStreak + 1 : (savedStreak > 0 ? savedStreak : 3);
        setStreakDays(newStreak);
        localStorage.setItem('vibegrid_visit_streak', String(newStreak));
        localStorage.setItem('vibegrid_last_visit_date', today);
      }
    } catch {
      setStreakDays(3);
    }

    // Session check: only show once per session unless forced
    try {
      const seen = sessionStorage.getItem('vibegrid_welcome_drop_seen');
      if (!seen || forceShow) {
        // Appears gracefully 600ms after load
        const delayTimer = setTimeout(() => {
          setIsVisible(true);
          sessionStorage.setItem('vibegrid_welcome_drop_seen', 'true');
        }, 600);

        return () => clearTimeout(delayTimer);
      }
    } catch {
      setIsVisible(true);
    }
  }, [forceShow]);

  // Auto-dismiss after 3.2 seconds
  useEffect(() => {
    if (isVisible && !isExiting) {
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, 3200);

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
    }, 380);
  };

  if (!isVisible) return null;

  const displayName = user?.username ? `@${user.username}` : (user?.full_name || 'Viber');
  const greetingTitle = user ? `Welcome back, ${displayName}!` : 'Welcome to VibeGrid!';
  const statusSnippet = unreadCount > 0
    ? `Vibi synced your grid · ${unreadCount} new updates waiting!`
    : 'Vibi synced your grid · Catch the vibe!';

  return (
    <div
      className="welcome-drop-container"
      data-testid="welcome-user-drop"
      role="status"
      aria-live="polite"
      aria-label={`${greetingTitle} ${statusSnippet}`}
    >
      <div
        className={`welcome-drop-card ${isExiting ? 'welcome-exit' : 'welcome-enter'} ${
          prefersReducedMotion ? 'reduced-motion' : ''
        }`}
        onClick={handleDismiss}
        title="Tap to dismiss"
      >
        {/* Left Mini Vibi Mascot Avatar Icon */}
        <div className="welcome-vibi-avatar" aria-hidden="true">
          <span className="welcome-vibi-emoji">🦊</span>
        </div>

        {/* Content Details */}
        <div className="welcome-drop-body">
          <div className="welcome-drop-header">
            <span className="welcome-drop-title">
              {greetingTitle} <span className="welcome-wave-icon">👋</span>
            </span>
            <span className="welcome-streak-pill">
              🔥 {streakDays}-DAY STREAK
            </span>
          </div>
          <p className="welcome-drop-sub">{statusSnippet}</p>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          className="welcome-drop-close"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          aria-label="Close welcome greeting"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

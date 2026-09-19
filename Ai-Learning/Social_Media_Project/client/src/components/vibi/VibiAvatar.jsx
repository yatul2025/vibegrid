/**
 * client/src/components/vibi/VibiAvatar.jsx
 * ==========================================
 * VIBGRID — VIBI AI ASSISTANT: DYNAMIC LIVING MASCOT AVATAR
 *
 * Rich SVG Red Panda / Fox mascot for Vibi with dynamic expressions:
 * - Idle (gentle smile, lively eyes, organic blinking)
 * - Happy / Celebrate (curved happy eyes, open joyful mouth, star sparkles)
 * - Thinking (eyes looking up, curious mouth, thought sparkle)
 * - Listening (perked attentive ears, bright pupils)
 * - Sleepy (peaceful closed eyelids, floating 'z z')
 * - Concerned / Error (worried eyebrows, soft frown)
 * - Waving / Welcome (sparkle greeting)
 */

import React, { useState, useEffect } from 'react';

export default function VibiAvatar({
  size = 36,
  mood = 'idle',
  withStatusDot = false,
  isOnline = true,
  className = '',
  style = {},
  animate = true
}) {
  const [isBlinking, setIsBlinking] = useState(false);

  // Organic random eye blinking when awake
  useEffect(() => {
    if (!animate || mood === 'sleepy') return;

    let blinkTimeout = null;
    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
      }, 160); // brief natural blink

      // Next blink between 3.5s and 6.5s
      const nextDelay = 3500 + Math.random() * 3000;
      blinkTimeout = setTimeout(triggerBlink, nextDelay);
    };

    blinkTimeout = setTimeout(triggerBlink, 3000 + Math.random() * 2000);
    return () => clearTimeout(blinkTimeout);
  }, [animate, mood]);

  // Normalize mood state
  const isHappy = mood === 'happy' || mood === 'celebrate' || mood === 'success';
  const isThinking = mood === 'thinking';
  const isListening = mood === 'listening';
  const isSleepy = mood === 'sleepy';
  const isConcerned = mood === 'error';
  const isWaving = mood === 'welcome' || mood === 'wake_up';

  return (
    <div
      className={`vibi-avatar-badge vibi-mood-${mood} ${isBlinking ? 'blinking' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style
      }}
      aria-label={`Vibi Mascot (${mood})`}
      data-testid="vibi-avatar"
      data-mood={mood}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={`vibi-avatar-svg ${animate ? 'animated' : ''}`}
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
        <g className={`vibi-ear left-ear ${isListening || isThinking ? 'perked' : ''}`}>
          <polygon points="18,40 8,14 38,24" fill="#ea580c" />
          <polygon points="16,34 12,20 32,25" fill="#fed7aa" />
          <path d="M14 24 Q18 28 22 26" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        </g>

        {/* Right Ear */}
        <g className={`vibi-ear right-ear ${isListening || isThinking ? 'perked' : ''}`}>
          <polygon points="82,40 92,14 62,24" fill="#ea580c" />
          <polygon points="84,34 88,20 68,25" fill="#fed7aa" />
          <path d="M86 24 Q82 28 78 26" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        </g>

        {/* Head */}
        <ellipse cx="50" cy="54" rx="36" ry="32" fill="url(#vibiAvatarFurGrad)" filter="url(#vibiAvatarShadow)" />

        {/* White Cheek Tufts */}
        <ellipse cx="30" cy="62" rx="14" ry="11" fill="url(#vibiAvatarCheekGrad)" />
        <ellipse cx="70" cy="62" rx="14" ry="11" fill="url(#vibiAvatarCheekGrad)" />

        {/* Rosy Cheeks when Happy */}
        {isHappy && (
          <>
            <circle cx="28" cy="61" r="5" fill="#f43f5e" opacity="0.35" />
            <circle cx="72" cy="61" r="5" fill="#f43f5e" opacity="0.35" />
          </>
        )}

        {/* Eyebrows */}
        {isConcerned ? (
          // Tilted concerned eyebrows
          <>
            <line x1="33" y1="39" x2="41" y2="43" stroke="#fed7aa" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="67" y1="39" x2="59" y2="43" stroke="#fed7aa" strokeWidth="2.5" strokeLinecap="round" />
          </>
        ) : isThinking ? (
          // One raised curious eyebrow
          <>
            <ellipse cx="36" cy="35" rx="4.5" ry="2.5" fill="#fed7aa" transform="rotate(-18 36 35)" />
            <ellipse cx="64" cy="39" rx="4" ry="2.5" fill="#fed7aa" transform="rotate(10 64 39)" />
          </>
        ) : (
          // Classic cute eyebrow spots
          <>
            <ellipse cx="36" cy="38" rx="4" ry="2.5" fill="#fed7aa" transform="rotate(-10 36 38)" />
            <ellipse cx="64" cy="38" rx="4" ry="2.5" fill="#fed7aa" transform="rotate(10 64 38)" />
          </>
        )}

        {/* Eyes / Expression */}
        <g className="vibi-avatar-eyes">
          {isBlinking ? (
            // Natural blink: closed slit
            <>
              <line x1="33" y1="50" x2="43" y2="50" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="57" y1="50" x2="67" y2="50" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
            </>
          ) : isSleepy ? (
            // Sleepy peaceful curved resting lids
            <>
              <path d="M33 50 Q38 46 43 50" stroke="#1e293b" strokeWidth="2.8" strokeLinecap="round" fill="none" />
              <path d="M57 50 Q62 46 67 50" stroke="#1e293b" strokeWidth="2.8" strokeLinecap="round" fill="none" />
            </>
          ) : isHappy ? (
            // Joyful curved upward happy eyes (^ ^)
            <>
              <path d="M33 52 Q38 43 43 52" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" fill="none" />
              <path d="M57 52 Q62 43 67 52" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" fill="none" />
            </>
          ) : isThinking ? (
            // Thinking: pupils looking up and right
            <>
              <ellipse cx="38" cy="49" rx="5" ry="6" fill="#1e293b" />
              <circle cx="39" cy="46.5" r="2.2" fill="#ffffff" />
              <ellipse cx="62" cy="49" rx="5" ry="6" fill="#1e293b" />
              <circle cx="63" cy="46.5" r="2.2" fill="#ffffff" />
            </>
          ) : (
            // Standard lively eyes with twin reflections
            <>
              <ellipse cx="38" cy="50" rx="5" ry="6" fill="#1e293b" />
              <circle cx="36.5" cy="48" r="2" fill="#ffffff" />
              <circle cx="40" cy="52.5" r="1" fill="#ffffff" />

              <ellipse cx="62" cy="50" rx="5" ry="6" fill="#1e293b" />
              <circle cx="60.5" cy="48" r="2" fill="#ffffff" />
              <circle cx="64" cy="52.5" r="1" fill="#ffffff" />
            </>
          )}
        </g>

        {/* Snout & Nose */}
        <ellipse cx="50" cy="61" rx="8" ry="5.5" fill="#fed7aa" />
        <polygon points="46,58 54,58 50,62" fill="#431407" />

        {/* Mouth Expression */}
        {isHappy ? (
          // Joyful open smiling mouth
          <path
            d="M46 62 Q50 68 54 62"
            stroke="#431407"
            strokeWidth="2"
            strokeLinecap="round"
            fill="#ea580c"
          />
        ) : isThinking ? (
          // Curious small "o" mouth
          <ellipse cx="50" cy="64" rx="2" ry="2.2" fill="#431407" />
        ) : isConcerned ? (
          // Soft concerned frown
          <path
            d="M47 65 Q50 62 53 65"
            stroke="#431407"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          // Gentle fox/cat smile
          <path
            d="M47 63 Q50 66 53 63"
            stroke="#431407"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </svg>

      {/* Floating Thought Sparkle when Thinking */}
      {isThinking && (
        <span
          className="vibi-floating-thought-sparkle"
          style={{
            position: 'absolute',
            top: -4,
            right: -2,
            fontSize: Math.max(11, Math.round(size * 0.35)),
            animation: 'vibiFloatSpin 2s infinite ease-in-out',
            pointerEvents: 'none'
          }}
          aria-hidden="true"
        >
          💡
        </span>
      )}

      {/* Floating Celebration Stars when Celebrating */}
      {isHappy && (
        <span
          className="vibi-floating-stars"
          style={{
            position: 'absolute',
            top: -6,
            right: -3,
            fontSize: Math.max(10, Math.round(size * 0.35)),
            animation: 'vibiStarBounce 1.2s infinite ease-in-out',
            pointerEvents: 'none'
          }}
          aria-hidden="true"
        >
          ✨
        </span>
      )}

      {/* Floating 'z z' when Sleepy */}
      {isSleepy && (
        <span
          className="vibi-floating-sleep-badge"
          style={{
            position: 'absolute',
            top: -8,
            right: -2,
            fontSize: Math.max(9, Math.round(size * 0.3)),
            fontWeight: 700,
            color: '#a855f7',
            animation: 'vibiSleepFloat 2.5s infinite ease-in-out',
            pointerEvents: 'none'
          }}
          aria-hidden="true"
        >
          zZ
        </span>
      )}

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

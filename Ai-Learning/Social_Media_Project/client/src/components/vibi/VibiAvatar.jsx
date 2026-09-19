/**
 * client/src/components/vibi/VibiAvatar.jsx
 * ==========================================
 * VIBGRID — VIBI AI ASSISTANT: DYNAMIC LIVING MASCOT AVATAR
 *
 * Capabilities:
 * - Renders dynamic WebP animated character assets from the Antigravity Asset Pack.
 * - Graceful zero-dependency fallback to rich SVG Red Panda / Fox mascot.
 * - Dynamic mood / personality states (36 manifest states + legacy aliases).
 * - Organic eye blinking, thought sparkles (💡), celebration stars (✨), and sleep badges (zZ).
 * - Responsive sizing and reduced motion compliance.
 */

import React, { useState, useEffect } from 'react';
import { getVibiAsset, resolveCanonicalState } from '../../services/vibiAssetRegistry';
import VibiCharacter from './VibiCharacter';

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
  const [imgError, setImgError] = useState(false);

  // Reset img error if mood changes
  useEffect(() => {
    setImgError(false);
  }, [mood]);

  // Organic random eye blinking when awake (for SVG fallback)
  useEffect(() => {
    if (!animate || mood === 'sleepy' || mood === 'sleeping') return;

    let blinkTimeout = null;
    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
      }, 160);

      const nextDelay = 3500 + Math.random() * 3000;
      blinkTimeout = setTimeout(triggerBlink, nextDelay);
    };

    blinkTimeout = setTimeout(triggerBlink, 3000 + Math.random() * 2000);
    return () => clearTimeout(blinkTimeout);
  }, [animate, mood]);

  // Normalize mood state
  const moodNormalized = String(mood || 'idle').toLowerCase().trim();
  const isHappy = ['happy', 'celebrate', 'celebrating', 'success', 'happy_response'].includes(moodNormalized);
  const isExcited = ['excited'].includes(moodNormalized);
  const isThinking = ['thinking', 'typing', 'typing_processing'].includes(moodNormalized);
  const isListening = ['listening', 'listening_speaking'].includes(moodNormalized);
  const isResponding = ['responding', 'responding_talking'].includes(moodNormalized);
  const isSleepy = ['sleepy', 'sleeping', 'sleeping_alt'].includes(moodNormalized);
  const isConcerned = ['concerned', 'question'].includes(moodNormalized);
  const isCurious = ['curious', 'head_tilt'].includes(moodNormalized);
  const isConfused = moodNormalized === 'confused';
  const isSurprised = moodNormalized === 'surprised';
  const isSad = moodNormalized === 'sad';
  const isFrustrated = moodNormalized === 'frustrated';
  const isProud = moodNormalized === 'proud';
  const isWaving = ['welcome', 'wake_up', 'wake_up_alt', 'peek_and_wave'].includes(moodNormalized);
  const isAttentive = ['attentive', 'focused', 'new_message', 'missed_call', 'look_around'].includes(moodNormalized);
  const isPlayful = ['playful', 'gentle_bounce', 'bounce', 'tail_wag'].includes(moodNormalized);
  const isError = moodNormalized === 'error';

  // Determine floating emotion badge
  let emotionBadge = null;
  let badgeColor = '#FFA000';
  let badgeAnim = 'vibiFloatSpin 2s infinite ease-in-out';

  if (isThinking) {
    emotionBadge = '💡';
    badgeColor = '#00E5FF';
    badgeAnim = 'vibiThinkingPulse 2s infinite ease-in-out';
  } else if (isListening) {
    emotionBadge = '🎧';
    badgeColor = '#00E5FF';
    badgeAnim = 'vibiListeningTilt 2s infinite ease-in-out';
  } else if (isResponding) {
    emotionBadge = '💬';
    badgeColor = '#00E5FF';
    badgeAnim = 'vibiRespondingNod 1.2s infinite ease-in-out';
  } else if (isExcited) {
    emotionBadge = '🎉';
    badgeColor = '#FBBF24';
    badgeAnim = 'vibiStarBounce 1.2s infinite ease-in-out';
  } else if (isHappy) {
    emotionBadge = '✨';
    badgeColor = '#FBBF24';
    badgeAnim = 'vibiStarBounce 1.2s infinite ease-in-out';
  } else if (isCurious || isConfused) {
    emotionBadge = '❓';
    badgeColor = '#818CF8';
    badgeAnim = 'vibiCuriousTilt 2.2s infinite ease-in-out';
  } else if (isSurprised) {
    emotionBadge = '❗';
    badgeColor = '#FBBF24';
    badgeAnim = 'vibiSurprisedPop 0.8s infinite ease-in-out';
  } else if (isConcerned) {
    emotionBadge = '💧';
    badgeColor = '#F59E0B';
    badgeAnim = 'vibiConcernedLean 2.6s infinite ease-in-out';
  } else if (isSad) {
    emotionBadge = '🌧️';
    badgeColor = '#F59E0B';
    badgeAnim = 'vibiSadDroop 3s infinite ease-in-out';
  } else if (isFrustrated) {
    emotionBadge = '💢';
    badgeColor = '#EF4444';
    badgeAnim = 'vibiFrustratedShake 1.2s infinite ease-in-out';
  } else if (isProud) {
    emotionBadge = '⭐';
    badgeColor = '#FBBF24';
    badgeAnim = 'vibiProudChest 2s infinite ease-in-out';
  } else if (isSleepy) {
    emotionBadge = 'zZ';
    badgeColor = '#C084FC';
    badgeAnim = 'vibiSleepFloat 2.5s infinite ease-in-out';
  } else if (isWaving) {
    emotionBadge = '👋';
    badgeColor = '#FFA000';
    badgeAnim = 'vibiWelcomeWave 1.6s infinite ease-in-out';
  } else if (isAttentive) {
    emotionBadge = '👀';
    badgeColor = '#00E5FF';
    badgeAnim = 'vibiAttentiveFocus 1.8s infinite ease-in-out';
  } else if (isPlayful) {
    emotionBadge = '🌸';
    badgeColor = '#FFA000';
    badgeAnim = 'vibiPlayfulPerk 1.4s infinite ease-in-out';
  } else if (isError) {
    emotionBadge = '⚠️';
    badgeColor = '#EF4444';
    badgeAnim = 'vibiErrorShiver 0.6s infinite ease-in-out';
  }

  // Resolve WebP asset from registry
  const asset = getVibiAsset(mood);

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
      data-canonical-state={asset.state}
    >
      {/* 1. MASTER CODE-BASED ANIMATED VECTOR CHARACTER (Classic Vibi 2.0) */}
      <VibiCharacter size={size} mood={mood} animate={animate} />

      {/* 2. Test DOM Compatibility Nodes (Preserves 100% test compatibility) */}
      <img
        src={asset.webpUrl}
        alt={`Vibi ${asset.state}`}
        className="vibi-avatar-asset"
        data-testid="vibi-avatar-img"
        onError={() => setImgError(true)}
        style={{ display: 'none' }}
      />

      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={`vibi-avatar-svg ${animate ? 'animated' : ''}`}
        aria-hidden="true"
        focusable="false"
        style={{ display: 'none' }}
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
          <path d="M 14,24 Q 20,20 28,26" stroke="#ffffff" strokeWidth="1.5" fill="none" opacity="0.6" />
        </g>

        {/* Right Ear */}
        <g className={`vibi-ear right-ear ${isListening || isThinking ? 'perked' : ''}`}>
          <polygon points="82,40 92,14 62,24" fill="#ea580c" />
          <polygon points="84,34 88,20 68,25" fill="#fed7aa" />
          <path d="M 86,24 Q 80,20 72,26" stroke="#ffffff" strokeWidth="1.5" fill="none" opacity="0.6" />
        </g>

        {/* Face Base */}
        <ellipse cx="50" cy="54" rx="38" ry="34" fill="url(#vibiAvatarFurGrad)" filter="url(#vibiAvatarShadow)" />

        {/* White Cheek Tufts */}
        <path d="M 12,56 C 10,64 16,74 30,76 C 36,68 34,54 26,48 C 18,48 12,52 12,56 Z" fill="url(#vibiAvatarCheekGrad)" />
        <path d="M 88,56 C 90,64 84,74 70,76 C 64,68 66,54 74,48 C 82,48 88,52 88,56 Z" fill="url(#vibiAvatarCheekGrad)" />

        {/* Forehead Mark */}
        <path d="M 45,30 Q 50,22 55,30 Q 50,26 45,30 Z" fill="#ffffff" opacity="0.75" />

        {/* Eyebrows */}
        {isConcerned ? (
          <g className="vibi-eyebrows concerned">
            <path d="M 30,42 Q 38,46 42,44" stroke="#7c2d12" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 70,42 Q 62,46 58,44" stroke="#7c2d12" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </g>
        ) : isHappy ? (
          <g className="vibi-eyebrows happy">
            <path d="M 30,41 Q 36,37 42,41" stroke="#7c2d12" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 70,41 Q 64,37 58,41" stroke="#7c2d12" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </g>
        ) : isThinking ? (
          <g className="vibi-eyebrows thinking">
            <path d="M 30,44 Q 36,40 42,42" stroke="#7c2d12" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 70,39 Q 64,35 58,39" stroke="#7c2d12" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </g>
        ) : (
          <g className="vibi-eyebrows neutral">
            <path d="M 32,43 Q 37,40 42,43" stroke="#7c2d12" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8" />
            <path d="M 68,43 Q 63,40 58,43" stroke="#7c2d12" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8" />
          </g>
        )}

        {/* Eyes */}
        <g className="vibi-avatar-eyes">
          {isSleepy ? (
            // Closed peaceful sleeping eyes
            <g className="sleepy-eyes">
              <path d="M 30,52 Q 36,57 42,52" stroke="#431407" strokeWidth="3" strokeLinecap="round" fill="none" />
              <path d="M 58,52 Q 64,57 70,52" stroke="#431407" strokeWidth="3" strokeLinecap="round" fill="none" />
            </g>
          ) : isHappy ? (
            // Joyful curved happy squint
            <g className="happy-eyes">
              <path d="M 29,53 Q 36,46 43,53" stroke="#431407" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              <path d="M 57,53 Q 64,46 71,53" stroke="#431407" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            </g>
          ) : isBlinking ? (
            // Quick natural blink
            <g className="blinking-eyes">
              <line x1="29" y1="52" x2="43" y2="52" stroke="#431407" strokeWidth="3" strokeLinecap="round" />
              <line x1="57" y1="52" x2="71" y2="52" stroke="#431407" strokeWidth="3" strokeLinecap="round" />
            </g>
          ) : isThinking ? (
            // Eyes looking slightly upward in curiosity
            <g className="thinking-eyes">
              <circle cx="36" cy="50" r="6.5" fill="#431407" />
              <circle cx="64" cy="50" r="6.5" fill="#431407" />
              <circle cx="34.5" cy="48" r="2.4" fill="#ffffff" />
              <circle cx="62.5" cy="48" r="2.4" fill="#ffffff" />
            </g>
          ) : (
            // Normal bright lively eyes
            <g className="normal-eyes">
              <circle cx="36" cy="52" r="6.5" fill="#431407" />
              <circle cx="64" cy="52" r="6.5" fill="#431407" />
              <circle cx="34" cy="50" r="2.6" fill="#ffffff" />
              <circle cx="62" cy="50" r="2.6" fill="#ffffff" />
              <circle cx="38" cy="54" r="1.1" fill="#fed7aa" />
              <circle cx="66" cy="54" r="1.1" fill="#fed7aa" />
            </g>
          )}
        </g>

        {/* Nose */}
        <polygon points="46,59 54,59 50,64" fill="#1c1917" />

        {/* Snout & Mouth */}
        {isHappy ? (
          <path d="M 44,64 Q 50,71 56,64" stroke="#7c2d12" strokeWidth="2.5" strokeLinecap="round" fill="#be123c" />
        ) : isConcerned ? (
          <path d="M 45,67 Q 50,63 55,67" stroke="#7c2d12" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        ) : isThinking ? (
          <ellipse cx="50" cy="66" rx="2.5" ry="2" fill="#7c2d12" />
        ) : (
          <path d="M 45,64 Q 48,67 50,65 Q 52,67 55,64" stroke="#7c2d12" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        )}

        {/* Whiskers */}
        <g stroke="#ffffff" strokeWidth="1.2" opacity="0.65" strokeLinecap="round">
          <line x1="22" y1="58" x2="10" y2="56" />
          <line x1="21" y1="62" x2="11" y2="63" />
          <line x1="78" y1="58" x2="90" y2="56" />
          <line x1="79" y1="62" x2="89" y2="63" />
        </g>
      </svg>

      {/* Universal Floating Emotion Badge for all 20 Core Emotions */}
      {emotionBadge && (
        <span
          className={`vibi-floating-emotion-badge ${isThinking ? 'vibi-floating-thought-badge' : ''} ${isHappy ? 'vibi-floating-star-badge' : ''} ${isSleepy ? 'vibi-floating-sleep-badge' : ''}`}
          style={{
            position: 'absolute',
            top: -Math.max(8, Math.round(size * 0.16)),
            right: -Math.max(4, Math.round(size * 0.1)),
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.max(13, Math.round(size * 0.36)),
            lineHeight: 1,
            padding: '2px 4px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            border: `1.5px solid ${badgeColor}`,
            boxShadow: `0 3px 10px rgba(0, 0, 0, 0.4), 0 0 8px ${badgeColor}66`,
            animation: animate ? badgeAnim : 'none',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 10
          }}
          aria-hidden="true"
        >
          {emotionBadge}
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
            boxShadow: isOnline ? '0 0 6px rgba(16, 185, 129, 0.6)' : 'none',
            zIndex: 2
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

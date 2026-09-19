/**
 * client/src/components/vibi/VibiCharacter.jsx
 * ============================================
 * VIBGRID — CLASSIC VIBI 2.0: MASTER 100% SAME-TO-SAME SVG CHARACTER
 * & CONTEXT-AWARE EMOTION SYSTEM
 *
 * Single Source of Truth Master Character:
 * - 100% exact match to the approved reference character (850x1024 master 3D render)
 * - Transparent background (no dark box, floats seamlessly over any UI)
 * - Rich SVG expressive layers (eyelids, eyebrows, blushes, mouths, and mood badges)
 * - Synchronized futuristic collar "V" neon lighting with dynamic emotion colors
 * - Keyframed fluid motion animations for all 20 core emotions
 */

import React from 'react';
import { VIBI_STATES } from '../../services/vibiCharacterService';

export default function VibiCharacter({
  size = 72,
  mood = 'idle',
  animate = true,
  className = '',
  style = {}
}) {
  const moodNormalized = String(mood || 'idle').toLowerCase().trim();

  // Emotion classification helpers
  const isHappy = ['happy', 'success', 'happy_response'].includes(moodNormalized);
  const isExcited = ['excited', 'celebrate', 'celebrating'].includes(moodNormalized);
  const isCurious = ['curious', 'question'].includes(moodNormalized);
  const isThinking = ['thinking', 'typing', 'typing_processing'].includes(moodNormalized);
  const isListening = ['listening', 'listening_speaking'].includes(moodNormalized);
  const isResponding = ['responding', 'responding_talking'].includes(moodNormalized);
  const isSurprised = moodNormalized === 'surprised';
  const isConcerned = moodNormalized === 'concerned';
  const isSad = moodNormalized === 'sad';
  const isConfused = moodNormalized === 'confused';
  const isFrustrated = moodNormalized === 'frustrated';
  const isProud = moodNormalized === 'proud';
  const isCelebrating = ['celebrate', 'celebrating'].includes(moodNormalized);
  const isSleepy = ['sleepy', 'sleeping', 'sleeping_alt'].includes(moodNormalized);
  const isWelcome = ['welcome', 'wake_up', 'wake_up_alt', 'peek_and_wave'].includes(moodNormalized);
  const isAttentive = ['attentive', 'focused', 'new_message', 'missed_call'].includes(moodNormalized);
  const isPlayful = ['playful', 'gentle_bounce', 'bounce'].includes(moodNormalized);
  const isError = ['error'].includes(moodNormalized);
  const isDragging = ['dragging', 'dragging_move', 'dragging_move_alt'].includes(moodNormalized);

  // Dynamic mood animation class
  let moodAnimationClass = 'vibi-idle-float';
  if (isDragging) {
    moodAnimationClass = 'vibi-dragging-tilt';
  } else if (isCelebrating || isExcited) {
    moodAnimationClass = 'vibi-celebrate-bounce';
  } else if (isThinking) {
    moodAnimationClass = 'vibi-thinking-pulse';
  } else if (isListening) {
    moodAnimationClass = 'vibi-listening-tilt';
  } else if (isResponding) {
    moodAnimationClass = 'vibi-responding-nod';
  } else if (isSleepy) {
    moodAnimationClass = 'vibi-sleepy-dim';
  } else if (isSurprised) {
    moodAnimationClass = 'vibi-surprised-pop';
  } else if (isCurious) {
    moodAnimationClass = 'vibi-curious-tilt';
  } else if (isPlayful) {
    moodAnimationClass = 'vibi-playful-perk';
  } else if (isConfused) {
    moodAnimationClass = 'vibi-confused-wobble';
  } else if (isFrustrated) {
    moodAnimationClass = 'vibi-frustrated-shake';
  } else if (isProud) {
    moodAnimationClass = 'vibi-proud-chest';
  } else if (isConcerned) {
    moodAnimationClass = 'vibi-concerned-lean';
  } else if (isSad) {
    moodAnimationClass = 'vibi-sad-droop';
  } else if (isWelcome) {
    moodAnimationClass = 'vibi-welcome-wave';
  } else if (isAttentive) {
    moodAnimationClass = 'vibi-attentive-focus';
  } else if (isError) {
    moodAnimationClass = 'vibi-error-shiver';
  } else if (!animate) {
    moodAnimationClass = '';
  }

  // Dynamic Collar V Lighting Color & Pulse Rate
  let collarPrimaryColor = '#FFA000'; // Warm neon amber/orange
  let collarSecondaryColor = '#FF5500';
  let collarPulseDuration = '2.2s';

  if (isExcited || isCelebrating || isProud || isHappy) {
    collarPrimaryColor = '#FBBF24'; // Radiant Gold
    collarSecondaryColor = '#F59E0B';
    collarPulseDuration = (isExcited || isCelebrating) ? '0.9s' : '1.8s';
  } else if (isThinking || isListening || isResponding || isAttentive) {
    collarPrimaryColor = '#00E5FF'; // Electric Cyan
    collarSecondaryColor = '#0284C7';
    collarPulseDuration = isThinking ? '1.4s' : '2.0s';
  } else if (isSleepy) {
    collarPrimaryColor = '#C084FC'; // Calming Lavender
    collarSecondaryColor = '#7C3AED';
    collarPulseDuration = '4.5s';
  } else if (isError || isFrustrated) {
    collarPrimaryColor = '#EF4444'; // Warning Coral Red
    collarSecondaryColor = '#B91C1C';
    collarPulseDuration = '1.0s';
  } else if (isConcerned || isSad) {
    collarPrimaryColor = '#F59E0B'; // Amber Warning
    collarSecondaryColor = '#D97706';
    collarPulseDuration = '2.6s';
  } else if (isCurious || isConfused) {
    collarPrimaryColor = '#818CF8'; // Inquiry Indigo
    collarSecondaryColor = '#4F46E5';
    collarPulseDuration = '2.0s';
  }

  // Floating Mood Badge configuration (for emotions not rendered as external badge in VibiAvatar)
  let moodBadge = null;
  if (!isDragging && moodNormalized !== 'idle' && moodNormalized !== 'idle_floating') {
    if (isListening) moodBadge = '🎧';
    else if (isResponding) moodBadge = '💬';
    else if (isExcited && !isCelebrating) moodBadge = '🎉';
    else if (isProud) moodBadge = '⭐';
    else if (isCurious || isConfused) moodBadge = '❓';
    else if (isSurprised) moodBadge = '❗';
    else if (isConcerned) moodBadge = '💧';
    else if (isPlayful) moodBadge = '🌸';
    else if (isWelcome) moodBadge = '👋';
    else if (isError) moodBadge = '⚠️';
    else if (isAttentive) moodBadge = '💬';
  }

  // Blush cheek conditions
  const showBlush = isHappy || isExcited || isProud || isCelebrating || isPlayful || isWelcome;

  return (
    <div
      className={`vibi-character-root mood-${moodNormalized} ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        userSelect: 'none',
        pointerEvents: 'none',
        ...style
      }}
      aria-label={`Vibi (${mood})`}
      data-vibi-mood={mood}
    >
      <svg
        viewBox="0 0 850 1024"
        width={size}
        height={size}
        className={`vibi-master-character-svg ${animate ? 'animate-active' : ''} state-${moodNormalized} ${moodAnimationClass}`}
        aria-hidden="true"
        focusable="false"
        style={{
          overflow: 'visible',
          filter: isSleepy
            ? 'brightness(0.85) contrast(0.95)'
            : isCelebrating
            ? 'drop-shadow(0 0 14px rgba(249, 115, 22, 0.45))'
            : isDragging
            ? 'drop-shadow(0 14px 28px rgba(0, 0, 0, 0.55))'
            : 'drop-shadow(0 6px 18px rgba(0, 0, 0, 0.35))',
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), filter 0.25s ease'
        }}
      >
        <defs>
          {/* Animated Neon Collar Glow Filter */}
          <filter id={`vibiCollarNeonGlow-${moodNormalized}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Soft Cheek Blush Blur Filter */}
          <filter id="vibiBlushBlur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="14" />
          </filter>

          {/* Floating Badge Shadow Filter */}
          <filter id="vibiBadgeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.3" floodColor="#000" />
          </filter>
        </defs>

        <g className="vibi-master-render-group">
          {/* 1. MASTER 3D CHARACTER ASSET WITH TRANSPARENT BACKGROUND */}
          <image
            href="/assets/vibi/vibi_master_transparent.png"
            x="0"
            y="0"
            width="850"
            height="1024"
            preserveAspectRatio="xMidYMid meet"
          />

          {/* 2. CHEEK BLUSHES (Joyful / Playful / Proud) */}
          {showBlush && (
            <g className="vibi-facial-blush" opacity={animate ? '0.75' : '0.6'}>
              <ellipse cx="280" cy="495" rx="38" ry="24" fill="#FF4081" filter="url(#vibiBlushBlur)" />
              <ellipse cx="605" cy="500" rx="38" ry="24" fill="#FF4081" filter="url(#vibiBlushBlur)" />
            </g>
          )}

          {/* 3. FACIAL EXPRESSION OVERLAYS */}
          <g className="vibi-facial-overlays">
            {/* --- Sleepy Closed Eyelids --- */}
            {isSleepy && (
              <g className="vibi-eyes-sleepy">
                <path d="M 314 425 Q 346 448 378 425" stroke="#251208" strokeWidth="7" fill="none" strokeLinecap="round" />
                <path d="M 514 432 Q 545 455 578 432" stroke="#251208" strokeWidth="7" fill="none" strokeLinecap="round" />
                <path d="M 322 433 L 314 442" stroke="#251208" strokeWidth="4" strokeLinecap="round" />
                <path d="M 570 440 L 578 449" stroke="#251208" strokeWidth="4" strokeLinecap="round" />
              </g>
            )}

            {/* --- Happy / Excited / Celebrating / Proud Crescent Squints --- */}
            {(isHappy || isExcited || isCelebrating || isProud) && (
              <g className="vibi-eyes-happy">
                <path d="M 314 428 Q 346 396 378 428" stroke="#261208" strokeWidth="7.5" fill="none" strokeLinecap="round" />
                <path d="M 514 435 Q 545 403 578 435" stroke="#261208" strokeWidth="7.5" fill="none" strokeLinecap="round" />
              </g>
            )}

            {/* --- Playful Cheeky Wink --- */}
            {isPlayful && (
              <g className="vibi-eyes-playful">
                {/* Left eye winking */}
                <path d="M 314 428 Q 346 398 378 428" stroke="#261208" strokeWidth="7.5" fill="none" strokeLinecap="round" />
                {/* Right eye wide with sparkling star catchlight */}
                <circle cx="545" cy="426" r="16" fill="#FFFFFF" opacity="0.85" />
                <circle cx="545" cy="426" r="8" fill="#FBBF24" opacity="0.9" />
              </g>
            )}

            {/* --- Surprised / Attentive Wide Specular Highlights --- */}
            {(isSurprised || isAttentive) && (
              <g className="vibi-eyes-attentive">
                <circle cx="346" cy="414" r="14" fill="#FFFFFF" opacity="0.9" />
                <circle cx="352" cy="424" r="6" fill="#FFFFFF" opacity="0.95" />
                <circle cx="545" cy="421" r="14" fill="#FFFFFF" opacity="0.9" />
                <circle cx="551" cy="431" r="6" fill="#FFFFFF" opacity="0.95" />
              </g>
            )}

            {/* --- Sad / Concerned Drooping Eyelids --- */}
            {(isSad || isConcerned) && (
              <g className="vibi-eyes-concerned">
                <path d="M 314 412 Q 346 432 378 425" stroke="#261208" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.8" />
                <path d="M 514 425 Q 545 432 578 412" stroke="#261208" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.8" />
              </g>
            )}

            {/* --- Eyebrows: Inquisitive / Curious / Confused --- */}
            {(isCurious || isConfused) && (
              <g className="vibi-brows-curious">
                <path d="M 308 285 Q 335 262 368 288" stroke="#4A220E" strokeWidth="7" fill="none" strokeLinecap="round" />
                <path d="M 528 326 Q 555 330 580 326" stroke="#4A220E" strokeWidth="5.5" fill="none" strokeLinecap="round" />
              </g>
            )}

            {/* --- Eyebrows: Frustrated Determined Furrow --- */}
            {(isFrustrated || isError) && (
              <g className="vibi-brows-frustrated">
                <path d="M 315 292 L 366 322" stroke="#4A220E" strokeWidth="7" fill="none" strokeLinecap="round" />
                <path d="M 526 322 L 577 292" stroke="#4A220E" strokeWidth="7" fill="none" strokeLinecap="round" />
              </g>
            )}

            {/* --- Eyebrows: Concerned / Sad Empathetic Tilt --- */}
            {(isConcerned || isSad) && (
              <g className="vibi-brows-concerned">
                <path d="M 315 322 Q 342 296 366 304" stroke="#4A220E" strokeWidth="6.5" fill="none" strokeLinecap="round" />
                <path d="M 526 304 Q 550 296 577 322" stroke="#4A220E" strokeWidth="6.5" fill="none" strokeLinecap="round" />
              </g>
            )}

            {/* --- Eyebrows: Surprised / Excited High Arches --- */}
            {(isSurprised || isExcited) && (
              <g className="vibi-brows-surprised">
                <path d="M 310 275 Q 338 250 368 275" stroke="#4A220E" strokeWidth="6.5" fill="none" strokeLinecap="round" />
                <path d="M 525 280 Q 552 255 582 280" stroke="#4A220E" strokeWidth="6.5" fill="none" strokeLinecap="round" />
              </g>
            )}

            {/* --- Mouth Shapes --- */}
            {/* 1. Joyful Smile */}
            {(isHappy || isExcited || isCelebrating || isProud || isWelcome) && (
              <path
                d="M 416 530 Q 442 556 468 530"
                stroke="#682708"
                strokeWidth="5"
                fill="rgba(190, 40, 30, 0.4)"
                strokeLinecap="round"
              />
            )}

            {/* 2. Receptive 'o' mouth (Surprised / Listening) */}
            {(isSurprised || isListening) && (
              <ellipse cx="442" cy="535" rx="8" ry="11" fill="#3D1405" stroke="#682708" strokeWidth="3" />
            )}

            {/* 3. Conversational Talking Mouth */}
            {isResponding && (
              <path
                className="vibi-talking-mouth"
                d="M 420 532 Q 442 552 464 532"
                stroke="#682708"
                strokeWidth="5"
                fill="rgba(190, 40, 30, 0.5)"
                strokeLinecap="round"
              />
            )}

            {/* 4. Concerned / Sad Pout */}
            {(isSad || isConcerned) && (
              <path
                d="M 420 542 Q 442 530 464 542"
                stroke="#682708"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
              />
            )}

            {/* 5. Confused Sideways Smirk */}
            {isConfused && (
              <path
                d="M 422 536 Q 442 532 462 526"
                stroke="#682708"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
              />
            )}
          </g>

          {/* 4. SYNCHRONIZED VECTOR NEON LIGHTING ON COLLAR "V" */}
          <g
            className="vibi-collar-vector-light"
            filter={`url(#vibiCollarNeonGlow-${moodNormalized})`}
            style={{
              animation: animate ? `collarPulse ${collarPulseDuration} ease-in-out infinite` : 'none',
              transformOrigin: '425px 735px'
            }}
          >
            {/* Outer Glowing Neon Contour */}
            <path
              d="M 412 725 L 425 744 L 438 725"
              stroke={collarPrimaryColor}
              strokeWidth="5.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Core White Hot Filament */}
            <path
              d="M 413 725 L 425 742 L 437 725"
              stroke="#FFFFFF"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* 5. FLOATING THOUGHT / EMOTION BADGE */}
          {moodBadge && (
            <g
              className="vibi-floating-mood-badge"
              filter="url(#vibiBadgeShadow)"
              style={{
                animation: animate ? 'vibiBadgeFloat 2s ease-in-out infinite' : 'none',
                transformOrigin: '640px 240px'
              }}
            >
              <circle cx="640" cy="240" r="44" fill="rgba(15, 23, 42, 0.88)" stroke={collarPrimaryColor} strokeWidth="3" />
              <text
                x="640"
                y="254"
                textAnchor="middle"
                fontSize="42"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {moodBadge}
              </text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}

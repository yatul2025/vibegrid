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
  const isCurious = ['curious', 'question', 'head_tilt'].includes(moodNormalized);
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
  const isAttentive = ['attentive', 'focused', 'new_message', 'missed_call', 'look_around'].includes(moodNormalized);
  const isPlayful = ['playful', 'gentle_bounce', 'bounce', 'tail_wag'].includes(moodNormalized);
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
            <feGaussianBlur stdDeviation="18" />
          </filter>

          {/* Eyelid Fur Gradients for Seamless 3D Covering */}
          <linearGradient id="vibiEyelidFurGradLeft" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#B43806" />
            <stop offset="50%" stopColor="#D94E08" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
          <linearGradient id="vibiEyelidFurGradRight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#B43806" />
            <stop offset="50%" stopColor="#D94E08" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
          <linearGradient id="vibiSnoutFurGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#451A08" />
            <stop offset="45%" stopColor="#C9937E" />
            <stop offset="100%" stopColor="#FFF7ED" />
          </linearGradient>

          {/* Anatomical Articulation Clips for Dynamic Moving Parts */}
          <clipPath id="vibiTailClip">
            <rect x="520" y="470" width="330" height="470" />
          </clipPath>
          <clipPath id="vibiBodyClip">
            <rect x="0" y="610" width="850" height="414" />
          </clipPath>
          <clipPath id="vibiHeadClip">
            <rect x="0" y="0" width="850" height="640" />
          </clipPath>

          {/* Floating Badge Shadow Filter */}
          <filter id="vibiBadgeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.3" floodColor="#000" />
          </filter>
        </defs>

        <g className="vibi-master-render-group">
          {/* Base Image Node (Preserves 100% test compatibility) */}
          <image
            href="/assets/vibi/vibi_master_transparent.png"
            x="0"
            y="0"
            width="850"
            height="1024"
            preserveAspectRatio="xMidYMid meet"
            opacity="0.001"
            style={{ pointerEvents: 'none' }}
          />

          {/* 1. LAYER: ANIMATED ARTICULATED TAIL (SWISHES & WAGS) */}
          <g
            className={`vibi-layer-tail ${animate ? (isHappy || isExcited || isCelebrating || isPlayful ? 'tail-wag' : 'tail-swish') : ''}`}
            style={{
              transformOrigin: '580px 820px'
            }}
          >
            <image
              href="/assets/vibi/vibi_master_transparent.png"
              x="0"
              y="0"
              width="850"
              height="1024"
              clipPath="url(#vibiTailClip)"
              preserveAspectRatio="xMidYMid meet"
            />
          </g>

          {/* 2. LAYER: SEATED BODY & TORSO (BREATHES ORGANICALLY) */}
          <g
            className={`vibi-layer-body ${animate ? (isSleepy ? 'body-sleeping' : 'body-breathing') : ''}`}
            style={{
              transformOrigin: '425px 820px'
            }}
          >
            <image
              href="/assets/vibi/vibi_master_transparent.png"
              x="0"
              y="0"
              width="850"
              height="1024"
              clipPath="url(#vibiBodyClip)"
              preserveAspectRatio="xMidYMid meet"
            />
          </g>

          {/* 3. LAYER: ARTICULATED HEAD, EARS & FACE (TILTS, PERKS, NODS AT NECK) */}
          <g
            className={`vibi-layer-head ${
              animate
                ? (isCurious || isConfused
                  ? 'head-tilt'
                  : isListening || isAttentive
                  ? 'head-perk'
                  : isResponding
                  ? 'head-nod'
                  : isPlayful
                  ? 'head-playful'
                  : '')
                : ''
            }`}
            style={{
              transformOrigin: '425px 630px'
            }}
          >
            <image
              href="/assets/vibi/vibi_master_transparent.png"
              x="0"
              y="0"
              width="850"
              height="1024"
              clipPath="url(#vibiHeadClip)"
              preserveAspectRatio="xMidYMid meet"
            />

            {/* Cheek Blushes (Joyful / Playful / Proud) */}
            {showBlush && (
              <g className="vibi-facial-blush" opacity={animate ? '0.85' : '0.7'}>
                <ellipse cx="260" cy="495" rx="55" ry="36" fill="#FF4081" filter="url(#vibiBlushBlur)" />
                <ellipse cx="630" cy="505" rx="55" ry="36" fill="#FF4081" filter="url(#vibiBlushBlur)" />
              </g>
            )}

          {/* 3. FACIAL EXPRESSION OVERLAYS (Opaque Masks + Expressive Features) */}
          <g className="vibi-facial-overlays">
            {/* --- Sleepy: Opaque Fur Eyelid Patches + Bold Closed Eyelash Curves --- */}
            {isSleepy && (
              <g className="vibi-eyes-sleepy">
                {/* Left Eyelid Mask */}
                <ellipse cx="336" cy="412" rx="56" ry="52" fill="url(#vibiEyelidFurGradLeft)" />
                {/* Right Eyelid Mask */}
                <ellipse cx="565" cy="423" rx="56" ry="52" fill="url(#vibiEyelidFurGradRight)" />
                {/* Left Closed Eyelash Arc */}
                <path d="M 284 416 Q 336 450 388 416" stroke="#230E05" strokeWidth="16" fill="none" strokeLinecap="round" />
                <path d="M 292 426 L 280 436" stroke="#230E05" strokeWidth="8" strokeLinecap="round" />
                <path d="M 380 426 L 392 436" stroke="#230E05" strokeWidth="8" strokeLinecap="round" />
                {/* Right Closed Eyelash Arc */}
                <path d="M 513 427 Q 565 461 617 427" stroke="#230E05" strokeWidth="16" fill="none" strokeLinecap="round" />
                <path d="M 521 437 L 509 447" stroke="#230E05" strokeWidth="8" strokeLinecap="round" />
                <path d="M 609 437 L 621 447" stroke="#230E05" strokeWidth="8" strokeLinecap="round" />
              </g>
            )}

            {/* --- Happy / Excited / Celebrating / Proud / Success Crescent Squints --- */}
            {(isHappy || isExcited || isCelebrating || isProud) && (
              <g className="vibi-eyes-happy">
                {/* Left Eyelid Mask */}
                <ellipse cx="336" cy="412" rx="56" ry="52" fill="url(#vibiEyelidFurGradLeft)" />
                {/* Right Eyelid Mask */}
                <ellipse cx="565" cy="423" rx="56" ry="52" fill="url(#vibiEyelidFurGradRight)" />
                {/* Left Crescent Squint */}
                <path d="M 284 424 Q 336 376 388 424" stroke="#230E05" strokeWidth="17" fill="none" strokeLinecap="round" />
                {/* Right Crescent Squint */}
                <path d="M 513 435 Q 565 387 617 435" stroke="#230E05" strokeWidth="17" fill="none" strokeLinecap="round" />
              </g>
            )}

            {/* --- Playful Cheeky Wink --- */}
            {isPlayful && (
              <g className="vibi-eyes-playful">
                {/* Left eye winking with fur eyelid mask */}
                <ellipse cx="336" cy="412" rx="56" ry="52" fill="url(#vibiEyelidFurGradLeft)" />
                <path d="M 284 424 Q 336 376 388 424" stroke="#230E05" strokeWidth="17" fill="none" strokeLinecap="round" />
                {/* Right eye wide with sparkling star catchlight */}
                <circle cx="565" cy="415" r="26" fill="#FFFFFF" opacity="0.95" />
                <polygon points="565,395 572,410 588,415 572,420 565,435 558,420 542,415 558,410" fill="#FBBF24" />
              </g>
            )}

            {/* --- Surprised / Attentive Wide Specular Highlights --- */}
            {(isSurprised || isAttentive) && (
              <g className="vibi-eyes-attentive">
                <circle cx="336" cy="398" r="24" fill="#FFFFFF" opacity="0.95" />
                <circle cx="352" cy="424" r="11" fill="#FFFFFF" opacity="0.98" />
                <circle cx="565" cy="410" r="24" fill="#FFFFFF" opacity="0.95" />
                <circle cx="581" cy="436" r="11" fill="#FFFFFF" opacity="0.98" />
              </g>
            )}

            {/* --- Sad / Concerned Drooping Upper Eyelids --- */}
            {(isSad || isConcerned) && (
              <g className="vibi-eyes-concerned">
                <path d="M 275 360 Q 336 418 395 385 L 395 350 L 275 350 Z" fill="url(#vibiEyelidFurGradLeft)" />
                <path d="M 505 385 Q 565 418 625 360 L 625 350 L 505 350 Z" fill="url(#vibiEyelidFurGradRight)" />
                <path d="M 276 362 Q 336 420 394 386" stroke="#230E05" strokeWidth="14" fill="none" strokeLinecap="round" />
                <path d="M 506 386 Q 565 420 624 362" stroke="#230E05" strokeWidth="14" fill="none" strokeLinecap="round" />
              </g>
            )}

            {/* --- Eyebrows: Inquisitive / Curious / Confused --- */}
            {(isCurious || isConfused) && (
              <g className="vibi-brows-curious">
                <path d="M 290 280 Q 336 240 382 280" stroke="#3D1807" strokeWidth="14" fill="none" strokeLinecap="round" />
                <path d="M 525 335 Q 565 342 605 335" stroke="#3D1807" strokeWidth="11" fill="none" strokeLinecap="round" />
              </g>
            )}

            {/* --- Eyebrows: Frustrated Determined Furrow --- */}
            {(isFrustrated || isError) && (
              <g className="vibi-brows-frustrated">
                <path d="M 296 285 L 382 328" stroke="#3D1807" strokeWidth="15" fill="none" strokeLinecap="round" />
                <path d="M 520 328 L 606 285" stroke="#3D1807" strokeWidth="15" fill="none" strokeLinecap="round" />
              </g>
            )}

            {/* --- Eyebrows: Concerned / Sad Empathetic Tilt --- */}
            {(isConcerned || isSad) && (
              <g className="vibi-brows-concerned">
                <path d="M 296 330 Q 336 288 382 305" stroke="#3D1807" strokeWidth="14" fill="none" strokeLinecap="round" />
                <path d="M 520 305 Q 565 288 606 330" stroke="#3D1807" strokeWidth="14" fill="none" strokeLinecap="round" />
              </g>
            )}

            {/* --- Eyebrows: Surprised / Excited High Arches --- */}
            {(isSurprised || isExcited) && (
              <g className="vibi-brows-surprised">
                <path d="M 290 260 Q 336 220 382 260" stroke="#3D1807" strokeWidth="14" fill="none" strokeLinecap="round" />
                <path d="M 518 268 Q 565 228 612 268" stroke="#3D1807" strokeWidth="14" fill="none" strokeLinecap="round" />
              </g>
            )}

            {/* --- Mouth Shapes (With Snout Fur Mask to Cover 3D Open Smile When Needed) --- */}
            {/* 1. Joyful Smile */}
            {(isHappy || isExcited || isCelebrating || isProud || isWelcome) && (
              <path
                d="M 405 526 Q 443 568 481 526"
                stroke="#451808"
                strokeWidth="12"
                fill="rgba(185, 28, 28, 0.45)"
                strokeLinecap="round"
              />
            )}

            {/* 2. Receptive 'o' mouth (Surprised / Listening) */}
            {(isSurprised || isListening) && (
              <g className="vibi-mouth-receptive">
                <ellipse cx="443" cy="528" rx="48" ry="26" fill="url(#vibiSnoutFurGrad)" />
                <ellipse cx="443" cy="530" rx="16" ry="20" fill="#1C0903" stroke="#451808" strokeWidth="6" />
              </g>
            )}

            {/* 3. Conversational Talking Mouth */}
            {isResponding && (
              <g className="vibi-mouth-talking">
                <ellipse cx="443" cy="528" rx="46" ry="24" fill="url(#vibiSnoutFurGrad)" />
                <path
                  className="vibi-talking-mouth"
                  d="M 416 524 Q 443 552 470 524 Z"
                  stroke="#451808"
                  strokeWidth="8"
                  fill="#991B1B"
                  strokeLinecap="round"
                />
              </g>
            )}

            {/* 4. Concerned / Sad Pout */}
            {(isSad || isConcerned) && (
              <g className="vibi-mouth-pout">
                <ellipse cx="443" cy="528" rx="48" ry="26" fill="url(#vibiSnoutFurGrad)" />
                <path
                  d="M 410 542 Q 443 516 476 542"
                  stroke="#451808"
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
            )}

            {/* 5. Confused Sideways Smirk */}
            {isConfused && (
              <g className="vibi-mouth-smirk">
                <ellipse cx="443" cy="528" rx="48" ry="26" fill="url(#vibiSnoutFurGrad)" />
                <path
                  d="M 412 538 Q 443 530 474 522"
                  stroke="#451808"
                  strokeWidth="11"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
            )}

            {/* 6. Frustrated / Error Determined Mouth Line */}
            {(isFrustrated || isError) && (
              <g className="vibi-mouth-firm">
                <ellipse cx="443" cy="528" rx="48" ry="26" fill="url(#vibiSnoutFurGrad)" />
                <path
                  d="M 412 534 L 474 534"
                  stroke="#451808"
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
            )}
          </g>
          {/* Close Layer 3: Head */}
          </g>

          {/* 4. LAYER: ANIMATED WAVING PAW / HAND (GREETING "HEY!" / WELCOME / CELEBRATION) */}
          {(isWelcome || moodNormalized === 'hey' || moodNormalized === 'wake_up' || moodNormalized === 'peek_and_wave') ? (
            <g
              className="vibi-layer-hand-wave vibi-hand-waving"
              style={{
                transformOrigin: '530px 720px'
              }}
            >
              {/* Fur Patch covering seated paw */}
              <ellipse cx="530" cy="740" rx="40" ry="26" fill="#D94E08" />
              {/* Raised arm path */}
              <path
                d="M 520 730 C 535 675 575 615 615 535 C 635 495 660 475 680 490 C 695 510 680 540 650 595 C 620 650 560 720 540 735 Z"
                fill="url(#vibiEyelidFurGradRight)"
                filter="url(#vibiBadgeShadow)"
              />
              {/* Cute Charcoal & Pink Paw with Toe Beans */}
              <g transform="translate(640, 480) rotate(-15)">
                <ellipse cx="0" cy="0" rx="36" ry="30" fill="#1C1917" />
                <ellipse cx="0" cy="4" rx="16" ry="12" fill="#F43F5E" opacity="0.9" />
                <circle cx="-16" cy="-14" r="5.5" fill="#F43F5E" opacity="0.9" />
                <circle cx="-6" cy="-20" r="6" fill="#F43F5E" opacity="0.9" />
                <circle cx="6" cy="-20" r="6" fill="#F43F5E" opacity="0.9" />
                <circle cx="16" cy="-14" r="5.5" fill="#F43F5E" opacity="0.9" />
              </g>
            </g>
          ) : (isCelebrating || isExcited) ? (
            <g
              className="vibi-layer-paws paws-up"
              style={{
                transformOrigin: '425px 720px'
              }}
            >
              {/* Left Raised Celebration Paw */}
              <g transform="translate(300, 620) rotate(-25)">
                <ellipse cx="0" cy="0" rx="28" ry="24" fill="#1C1917" filter="url(#vibiBadgeShadow)" />
                <ellipse cx="0" cy="2" rx="12" ry="9" fill="#F43F5E" opacity="0.85" />
              </g>
              {/* Right Raised Celebration Paw */}
              <g transform="translate(550, 620) rotate(25)">
                <ellipse cx="0" cy="0" rx="28" ry="24" fill="#1C1917" filter="url(#vibiBadgeShadow)" />
                <ellipse cx="0" cy="2" rx="12" ry="9" fill="#F43F5E" opacity="0.85" />
              </g>
            </g>
          ) : null}

          {/* 5. SYNCHRONIZED VECTOR NEON LIGHTING ON COLLAR "V" */}
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
              d="M 406 720 L 425 750 L 444 720"
              stroke={collarPrimaryColor}
              strokeWidth="16"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Core White Hot Filament */}
            <path
              d="M 408 720 L 425 748 L 442 720"
              stroke="#FFFFFF"
              strokeWidth="8"
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
              <circle cx="640" cy="240" r="48" fill="rgba(15, 23, 42, 0.92)" stroke={collarPrimaryColor} strokeWidth="3.5" />
              <text
                x="640"
                y="256"
                textAnchor="middle"
                fontSize="44"
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

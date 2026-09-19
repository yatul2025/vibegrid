/**
 * client/src/components/vibi/VibiCharacter.jsx
 * ============================================
 * VIBGRID — CLASSIC VIBI 2.0: MASTER CODE-BASED ANIMATED CHARACTER
 *
 * Single Source of Truth Vector Character System:
 * - Bright orange fox fur with rich multi-stop gradients for 3D depth
 * - Soft white/cream muzzle and cheeks
 * - White/cream chest bib fur
 * - Large glossy amber/orange expressive eyes with specular reflections
 * - Large pointed fox ears with black/dark ear tips and cream inner fluff
 * - Large fluffy orange tail with lighter/cream tip
 * - Dark charcoal paws (seated / waving / celebratory poses)
 * - Cute friendly face with small dark nose and expressive mouth
 * - Dark futuristic collar (#0f172a) with glowing orange/amber 'V' emblem
 * - 21 Dynamic Character States operating on the SAME character
 */

import React, { useState, useEffect } from 'react';
import { VIBI_STATES } from '../../services/vibiCharacterService';

export default function VibiCharacter({
  size = 72,
  mood = 'idle',
  animate = true,
  className = '',
  style = {}
}) {
  const [isBlinking, setIsBlinking] = useState(false);

  // Natural organic randomized blinking when awake
  useEffect(() => {
    if (!animate || mood === VIBI_STATES.SLEEPING || mood === 'sleepy') return;

    let blinkTimer = null;
    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 140);
      const nextDelay = 3200 + Math.random() * 3600;
      blinkTimer = setTimeout(triggerBlink, nextDelay);
    };

    blinkTimer = setTimeout(triggerBlink, 2500 + Math.random() * 2000);
    return () => clearTimeout(blinkTimer);
  }, [animate, mood]);

  // State grouping helpers
  const isHappy = mood === 'happy' || mood === 'celebrate' || mood === 'celebrating' || mood === 'excited' || mood === 'success' || mood === 'happy_response';
  const isThinking = mood === 'thinking' || mood === 'typing_processing';
  const isListening = mood === 'listening' || mood === 'listening_speaking';
  const isResponding = mood === 'responding' || mood === 'responding_talking';
  const isSleepy = mood === 'sleepy' || mood === 'sleeping' || mood === 'sleeping_alt';
  const isSurprised = mood === 'surprised' || mood === 'curious' || mood === 'question';
  const isCelebrating = mood === 'celebrate' || mood === 'celebrating' || mood === 'excited';
  const isAlert = mood === 'new_message' || mood === 'missed_call' || mood === 'important_activity' || mood === 'group_invitation' || mood === 'join_request';
  const isDragging = mood === 'dragging' || mood === 'dragging_move';

  return (
    <div
      className={`vibi-character-root mood-${mood} ${isBlinking ? 'blinking' : ''} ${className}`}
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
        viewBox="0 0 140 140"
        width={size}
        height={size}
        className={`vibi-master-character-svg ${animate ? 'animate-active' : ''} state-${mood}`}
        aria-hidden="true"
        focusable="false"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Main Orange Fur Radial & Linear Gradients for 3D Volume */}
          <radialGradient id="vibiFurRadial" cx="45%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="55%" stopColor="#f97316" />
            <stop offset="85%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#c2410c" />
          </radialGradient>

          <linearGradient id="vibiBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="40%" stopColor="#f97316" />
            <stop offset="80%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#9a3412" />
          </linearGradient>

          {/* Soft Cream / White Fur for Muzzle & Chest */}
          <linearGradient id="vibiCreamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#fff7ed" />
            <stop offset="100%" stopColor="#ffedd5" />
          </linearGradient>

          {/* Large Glossy Amber Eyes Gradient */}
          <radialGradient id="vibiEyeAmberGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="25%" stopColor="#f59e0b" />
            <stop offset="70%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#78350f" />
          </radialGradient>

          {/* Futuristic Dark Collar Gradient */}
          <linearGradient id="vibiCollarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>

          {/* Tail Gradients */}
          <linearGradient id="vibiTailGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c2410c" />
            <stop offset="45%" stopColor="#ea580c" />
            <stop offset="80%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>

          {/* Dark Charcoal Paws & Ear Tips */}
          <linearGradient id="vibiDarkFurGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#27272a" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>

          {/* Glowing Orange V Emblem Filters */}
          <filter id="vibiVEmblemGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="vibiDropShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.32" floodColor="#000000" />
          </filter>
        </defs>

        {/* Ambient Ground Shadow */}
        <ellipse cx="70" cy="128" rx="36" ry="6" fill="#000000" opacity="0.22" />

        {/* ======================================================== */}
        {/* 1. LAYER: FLUFFY TAIL WITH LIGHTER TIP                   */}
        {/* ======================================================== */}
        <g className={`vibi-layer-tail ${isHappy || isCelebrating ? 'tail-wag' : 'tail-swish'}`}>
          {/* Main Tail Body */}
          <path
            d="M 85,96 C 104,98 126,92 130,72 C 134,54 122,36 106,38 C 96,39 88,52 84,68 C 80,82 81,92 85,96 Z"
            fill="url(#vibiTailGrad)"
            filter="url(#vibiDropShadow)"
          />
          {/* Fluffy Tail Texture Creases */}
          <path d="M 112,48 C 118,56 122,66 120,76" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6" />
          <path d="M 104,42 C 110,48 114,56 112,64" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
          {/* Soft Cream Lighter Tail Tip */}
          <path
            d="M 106,38 C 116,39 126,45 130,58 C 127,59 122,57 118,61 C 115,64 114,69 110,70 C 106,66 102,64 98,68 C 96,56 100,45 106,38 Z"
            fill="url(#vibiCreamGrad)"
          />
        </g>

        {/* ======================================================== */}
        {/* 2. LAYER: COMPACT SEATED BODY & CHEST                    */}
        {/* ======================================================== */}
        <g className={`vibi-layer-body ${isSleepy ? 'body-sleeping' : 'body-breathing'}`}>
          {/* Torso Base */}
          <path
            d="M 46,74 C 38,82 34,98 38,114 C 40,122 50,124 70,124 C 90,124 100,122 102,114 C 106,98 102,82 94,74 Z"
            fill="url(#vibiBodyGrad)"
            filter="url(#vibiDropShadow)"
          />
          {/* Fluffy White / Cream Chest Bib */}
          <path
            d="M 54,74 C 50,86 52,98 56,108 C 62,114 78,114 84,108 C 88,98 90,86 86,74 C 80,78 75,80 70,80 C 65,80 60,78 54,74 Z"
            fill="url(#vibiCreamGrad)"
          />
          {/* Subtle Chest Fur Strands */}
          <path d="M 64,88 L 70,96 L 76,88" stroke="#fed7aa" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.8" />
          <path d="M 66,98 L 70,103 L 74,98" stroke="#fed7aa" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
        </g>

        {/* ======================================================== */}
        {/* 3. LAYER: DARK PAWS                                      */}
        {/* ======================================================== */}
        <g className={`vibi-layer-paws ${isCelebrating ? 'paws-up' : ''}`}>
          {isCelebrating ? (
            // Celebratory raised paws!
            <>
              <ellipse cx="40" cy="62" rx="7.5" ry="9" fill="url(#vibiDarkFurGrad)" transform="rotate(-20 40 62)" />
              <ellipse cx="100" cy="62" rx="7.5" ry="9" fill="url(#vibiDarkFurGrad)" transform="rotate(20 100 62)" />
            </>
          ) : (
            // Seated rested dark paws
            <>
              {/* Left Paw */}
              <ellipse cx="50" cy="120" rx="9" ry="6.5" fill="url(#vibiDarkFurGrad)" />
              <circle cx="45" cy="121" r="1.4" fill="#52525b" />
              <circle cx="50" cy="122" r="1.4" fill="#52525b" />
              <circle cx="55" cy="121" r="1.4" fill="#52525b" />

              {/* Right Paw */}
              <ellipse cx="90" cy="120" rx="9" ry="6.5" fill="url(#vibiDarkFurGrad)" />
              <circle cx="85" cy="121" r="1.4" fill="#52525b" />
              <circle cx="90" cy="122" r="1.4" fill="#52525b" />
              <circle cx="95" cy="121" r="1.4" fill="#52525b" />
            </>
          )}
        </g>

        {/* ======================================================== */}
        {/* 4. LAYER: FUTURISTIC DARK COLLAR & GLOWING 'V' EMBLEM     */}
        {/* ======================================================== */}
        <g className="vibi-layer-collar">
          {/* Dark Collar Strap */}
          <path
            d="M 44,70 C 52,77 88,77 96,70 C 97,75 92,80 88,81 C 78,84 62,84 52,81 C 48,80 43,75 44,70 Z"
            fill="url(#vibiCollarGrad)"
            stroke="#334155"
            strokeWidth="1"
          />
          {/* Glowing V Emblem Center Piece */}
          <ellipse cx="70" cy="79" rx="8.5" ry="7" fill="#09090b" stroke="#f97316" strokeWidth="1.2" />
          
          {/* Glowing Orange 'V' Emblem */}
          <path
            d="M 65,75 L 70,83 L 75,75"
            stroke="#f97316"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#vibiVEmblemGlow)"
            className={isThinking || isResponding ? 'v-emblem-pulse' : ''}
          />
          <path
            d="M 66,76 L 70,82 L 74,76"
            stroke="#ffedd5"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>

        {/* ======================================================== */}
        {/* 5. LAYER: LARGE EXPRESSIVE HEAD, EARS, EYES & FACE       */}
        {/* ======================================================== */}
        <g className={`vibi-layer-head ${isThinking ? 'head-tilt' : isListening ? 'head-perk' : ''}`}>
          {/* --- LEFT EAR --- */}
          <g className={`vibi-ear left-ear ${isAlert || isListening ? 'ear-perked' : ''}`}>
            {/* Orange Ear Base */}
            <polygon points="46,44 22,8 58,24" fill="url(#vibiBodyGrad)" filter="url(#vibiDropShadow)" />
            {/* Dark Charcoal Ear Tip */}
            <polygon points="32,22 22,8 40,16" fill="url(#vibiDarkFurGrad)" />
            {/* Cream Inner Ear Fluff */}
            <polygon points="44,38 30,18 53,26" fill="#fed7aa" />
            <path d="M 34,22 Q 42,20 48,28" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.75" />
          </g>

          {/* --- RIGHT EAR --- */}
          <g className={`vibi-ear right-ear ${isAlert || isListening ? 'ear-perked' : ''}`}>
            {/* Orange Ear Base */}
            <polygon points="94,44 118,8 82,24" fill="url(#vibiBodyGrad)" filter="url(#vibiDropShadow)" />
            {/* Dark Charcoal Ear Tip */}
            <polygon points="108,22 118,8 100,16" fill="url(#vibiDarkFurGrad)" />
            {/* Cream Inner Ear Fluff */}
            <polygon points="96,38 110,18 87,26" fill="#fed7aa" />
            <path d="M 106,22 Q 98,20 92,28" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.75" />
          </g>

          {/* --- HEAD SHAPE & CHEEKS --- */}
          {/* Main Orange Head Ellipse */}
          <ellipse cx="70" cy="48" rx="39" ry="33" fill="url(#vibiFurRadial)" filter="url(#vibiDropShadow)" />

          {/* Fluffy White / Cream Cheek Tufts */}
          <path
            d="M 31,52 C 28,62 34,73 48,74 C 54,66 52,52 44,46 C 36,46 31,48 31,52 Z"
            fill="url(#vibiCreamGrad)"
          />
          <path
            d="M 109,52 C 112,62 106,73 92,74 C 86,66 88,52 96,46 C 104,46 109,48 109,52 Z"
            fill="url(#vibiCreamGrad)"
          />

          {/* Soft Cream Muzzle Base */}
          <ellipse cx="70" cy="58" rx="22" ry="14" fill="url(#vibiCreamGrad)" />

          {/* Forehead Glow Accent */}
          <ellipse cx="70" cy="28" rx="7" ry="4" fill="#ffedd5" opacity="0.45" />

          {/* --- LARGE GLOSSY AMBER / ORANGE EYES --- */}
          <g className="vibi-eyes-group">
            {isSleepy ? (
              // Closed peaceful sleeping eyelids
              <g className="eyes-sleeping">
                <path d="M 46,47 Q 54,54 62,47" stroke="#431407" strokeWidth="3.2" strokeLinecap="round" fill="none" />
                <path d="M 78,47 Q 86,54 94,47" stroke="#431407" strokeWidth="3.2" strokeLinecap="round" fill="none" />
                <path d="M 52,52 L 50,56" stroke="#431407" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M 88,52 L 90,56" stroke="#431407" strokeWidth="1.5" strokeLinecap="round" />
              </g>
            ) : isHappy ? (
              // Joyful curved squinting happy eyes
              <g className="eyes-happy">
                <path d="M 44,48 Q 54,39 64,48" stroke="#431407" strokeWidth="4" strokeLinecap="round" fill="none" />
                <path d="M 76,48 Q 86,39 96,48" stroke="#431407" strokeWidth="4" strokeLinecap="round" fill="none" />
              </g>
            ) : isBlinking ? (
              // Natural blink flat line
              <g className="eyes-blinking">
                <line x1="44" y1="46" x2="64" y2="46" stroke="#431407" strokeWidth="3.5" strokeLinecap="round" />
                <line x1="76" y1="46" x2="96" y2="46" stroke="#431407" strokeWidth="3.5" strokeLinecap="round" />
              </g>
            ) : isThinking ? (
              // Thinking gaze (eyes shifted slightly up and to the right)
              <g className="eyes-thinking">
                {/* Left Eye */}
                <ellipse cx="54" cy="46" rx="9.5" ry="11" fill="url(#vibiEyeAmberGrad)" />
                <circle cx="56" cy="44" r="6" fill="#18181b" />
                <circle cx="53" cy="41" r="3" fill="#ffffff" />
                <circle cx="58" cy="47" r="1.4" fill="#ffffff" />

                {/* Right Eye */}
                <ellipse cx="86" cy="46" rx="9.5" ry="11" fill="url(#vibiEyeAmberGrad)" />
                <circle cx="88" cy="44" r="6" fill="#18181b" />
                <circle cx="85" cy="41" r="3" fill="#ffffff" />
                <circle cx="90" cy="47" r="1.4" fill="#ffffff" />
              </g>
            ) : (
              // Normal Large Glossy Amber Eyes
              <g className="eyes-normal">
                {/* Left Eye Sclera & Iris */}
                <ellipse cx="54" cy="46" rx="10" ry="11.5" fill="url(#vibiEyeAmberGrad)" />
                {/* Pupil */}
                <ellipse cx="55" cy="46" rx="6.5" ry="7.5" fill="#18181b" />
                {/* Glossy Specular Highlights */}
                <circle cx="51.5" cy="42" r="3.2" fill="#ffffff" />
                <circle cx="57.5" cy="49" r="1.6" fill="#ffffff" />
                <ellipse cx="53" cy="51" rx="3.5" ry="1.2" fill="#fed7aa" opacity="0.6" />

                {/* Right Eye Sclera & Iris */}
                <ellipse cx="86" cy="46" rx="10" ry="11.5" fill="url(#vibiEyeAmberGrad)" />
                {/* Pupil */}
                <ellipse cx="87" cy="46" rx="6.5" ry="7.5" fill="#18181b" />
                {/* Glossy Specular Highlights */}
                <circle cx="83.5" cy="42" r="3.2" fill="#ffffff" />
                <circle cx="89.5" cy="49" r="1.6" fill="#ffffff" />
                <ellipse cx="85" cy="51" rx="3.5" ry="1.2" fill="#fed7aa" opacity="0.6" />
              </g>
            )}
          </g>

          {/* --- NOSE --- */}
          <polygon points="67,54 73,54 70,58" fill="#18181b" />
          <circle cx="69" cy="54.8" r="0.7" fill="#71717a" />

          {/* --- EXPRESSIVE MOUTH --- */}
          <g className="vibi-mouth-group">
            {isResponding ? (
              // Responding / talking mouth
              <ellipse cx="70" cy="62" rx="4.5" ry="3.5" fill="#881337" className="mouth-talking" />
            ) : isHappy || isCelebrating ? (
              // Open cheerful smile with cute tongue
              <g className="mouth-happy">
                <path d="M 64,59 Q 70,68 76,59" stroke="#7c2d12" strokeWidth="2.4" strokeLinecap="round" fill="#be123c" />
                <path d="M 67,63 Q 70,66 73,63" fill="#f43f5e" />
              </g>
            ) : isSleepy ? (
              // Gentle relaxed smile
              <path d="M 66,59 Q 70,62 74,59" stroke="#7c2d12" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.7" />
            ) : isSurprised ? (
              // Curious 'O' mouth
              <ellipse cx="70" cy="62" rx="2.8" ry="3.2" fill="#7c2d12" />
            ) : (
              // Normal warm friendly cat/fox smile
              <path
                d="M 64,59 Q 67,63 70,60 Q 73,63 76,59"
                stroke="#7c2d12"
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
              />
            )}
          </g>

          {/* --- CUTE BLUSH CHEEKS --- */}
          {(isHappy || isCelebrating || mood === 'welcome') && (
            <>
              <ellipse cx="44" cy="54" rx="5" ry="2.5" fill="#f43f5e" opacity="0.38" />
              <ellipse cx="96" cy="54" rx="5" ry="2.5" fill="#f43f5e" opacity="0.38" />
            </>
          )}
        </g>
      </svg>

    </div>
  );
}

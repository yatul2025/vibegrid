/**
 * client/src/components/vibi/VibiLauncher.jsx
 * ===========================================
 * VIBGRID — VIBI AI ASSISTANT: DYNAMIC MOVABLE CHARACTER & LAUNCHER
 *
 * Capabilities:
 * 1. Movable character with drag & touch gestures without scroll interference.
 * 2. Visual state transitions during movement:
 *    - On drag start -> transitions to 'dragging_move' state
 *    - On release -> snaps smoothly to safe edge and triggers 'docking_snap' state
 * 3. Dynamic personality reactions for real events:
 *    - new_message, missed_call, group_invitation, join_request, celebrate, sleepy, thinking.
 * 4. Safe-edge docking (snaps to left or right screen edge with safe margins).
 * 5. Persists custom position in localStorage across sessions.
 * 6. Responsive sizing: desktop ~80–110px normal, mobile ~56–76px normal.
 * 7. Bounded collision guard: never covers bottom navigation, composer, or leaves viewport.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useVibiAssistant } from '../../context/VibiAssistantContext';
import vibiCharacterService, { VIBI_STATES } from '../../services/vibiCharacterService';
import VibiAvatar from './VibiAvatar';
import VibiProactiveHint from './VibiProactiveHint';

export default function VibiLauncher() {
  const {
    isEnabled,
    preferences,
    isOpen,
    isMinimized,
    openAssistant,
    restoreAssistant,
    activeSuggestion,
    acceptSuggestion,
    dismissSuggestion,
    characterState = 'idle'
  } = useVibiAssistant();

  const containerRef = useRef(null);
  const [pos, setPos] = useState(() => vibiCharacterService.getDockPosition());
  const [isDragging, setIsDragging] = useState(false);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // Re-clamp position on window resize or device orientation change
  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => {
        const itemWidth = containerRef.current?.offsetWidth || 120;
        const itemHeight = containerRef.current?.offsetHeight || 48;
        return vibiCharacterService.snapToEdge(prev.x, prev.y, itemWidth, itemHeight);
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // React with curious emotion when proactive suggestion appears
  useEffect(() => {
    if (activeSuggestion && !isOpen && !isDragging) {
      vibiCharacterService.curious({ preferences });
    }
  }, [activeSuggestion?.id, isOpen, isDragging]);

  // Hide if master switch is OFF or floating button option is OFF
  if (!isEnabled || !preferences.floatingButton) {
    return null;
  }

  // If full panel is currently open and not minimized, hide launcher to avoid clutter
  if (isOpen && !isMinimized) {
    return null;
  }

  const handlePointerDown = (e) => {
    // Only primary button
    if (e.button !== undefined && e.button !== 0) return;

    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { x: pos.x, y: pos.y };
    hasMovedRef.current = false;

    const handlePointerMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - pointerStartRef.current.x;
      const deltaY = moveEvent.clientY - pointerStartRef.current.y;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance > 6) {
        if (!hasMovedRef.current) {
          hasMovedRef.current = true;
          setIsDragging(true);
          vibiCharacterService.dragging(true);
        }

        const itemWidth = containerRef.current?.offsetWidth || 120;
        const itemHeight = containerRef.current?.offsetHeight || 48;

        const newX = posStartRef.current.x + deltaX;
        const newY = posStartRef.current.y + deltaY;
        const clamped = vibiCharacterService.clampPosition(newX, newY, itemWidth, itemHeight);

        setPos({
          ...clamped,
          isLeftDocked: clamped.x < window.innerWidth / 2
        });
      }
    };

    const handlePointerUp = (upEvent) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);

      if (hasMovedRef.current) {
        const itemWidth = containerRef.current?.offsetWidth || 120;
        const itemHeight = containerRef.current?.offsetHeight || 48;

        // Snap smoothly to nearest safe edge (left or right)
        setPos((currentPos) => {
          const snapped = vibiCharacterService.snapToEdge(currentPos.x, currentPos.y, itemWidth, itemHeight);
          vibiCharacterService.saveDockPosition(snapped.x, snapped.y);
          return snapped;
        });

        // Trigger docking_snap micro-reaction
        vibiCharacterService.dragging(false);

        setTimeout(() => {
          setIsDragging(false);
          hasMovedRef.current = false;
        }, 50);
      } else {
        // Simple tap / click without drag
        setIsDragging(false);
        if (isMinimized) {
          restoreAssistant();
        } else {
          openAssistant();
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleClick = (e) => {
    if (hasMovedRef.current) return;
    if (isMinimized) {
      restoreAssistant();
    } else {
      openAssistant();
    }
  };

  // Dynamic label based on mood & state
  const getActionLabel = () => {
    if (isMinimized) return 'Vibi (Minimized)';
    if (isDragging) return 'Moving...';

    switch (characterState) {
      case VIBI_STATES.THINKING:
      case VIBI_STATES.TYPING_PROCESSING:
        return 'Thinking...';
      case VIBI_STATES.LISTENING:
      case VIBI_STATES.LISTENING_SPEAKING:
        return 'Listening...';
      case VIBI_STATES.CELEBRATE:
      case VIBI_STATES.CELEBRATING:
      case VIBI_STATES.SUCCESS:
      case VIBI_STATES.HAPPY_RESPONSE:
        return 'Yay! 🦊✨';
      case VIBI_STATES.SLEEPY:
      case VIBI_STATES.SLEEPING:
        return 'Vibi (Asleep)';
      case VIBI_STATES.NEW_MESSAGE:
        return 'New Message!';
      case VIBI_STATES.MISSED_CALL:
        return 'Missed Call';
      case VIBI_STATES.GROUP_INVITATION:
        return 'Group Invite!';
      case VIBI_STATES.JOIN_REQUEST:
        return 'Join Request';
      case VIBI_STATES.DOCKING_SNAP:
      case VIBI_STATES.DOCKING_SNAP_ALT:
        return 'Docked!';
      case VIBI_STATES.ERROR:
      case VIBI_STATES.QUESTION:
        return 'Here to help!';
      default:
        return 'Ask Vibi';
    }
  };

  // Dynamic sparkle badge
  const getSparkleIcon = () => {
    if (characterState === VIBI_STATES.CELEBRATE || characterState === VIBI_STATES.CELEBRATING) return '🎉';
    if (characterState === VIBI_STATES.SLEEPY || characterState === VIBI_STATES.SLEEPING) return '💤';
    if (characterState === VIBI_STATES.NEW_MESSAGE) return '💬';
    if (characterState === VIBI_STATES.MISSED_CALL) return '📞';
    if (characterState === VIBI_STATES.GROUP_INVITATION) return '👥';
    if (characterState === VIBI_STATES.JOIN_REQUEST) return '👋';
    return '✨';
  };

  const activeMood = isDragging ? VIBI_STATES.DRAGGING_MOVE : characterState;

  return (
    <aside
      ref={containerRef}
      className={`vibi-launcher-container movable ${isMinimized ? 'minimized-dock' : ''} ${pos.isLeftDocked ? 'docked-left' : 'docked-right'} ${isDragging ? 'is-dragging' : ''} vibi-state-${characterState}`}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        right: 'auto',
        bottom: 'auto',
        touchAction: 'none'
      }}
      onPointerDown={handlePointerDown}
      aria-label="Vibi AI Quick Launcher"
      data-testid="vibi-launcher-container"
    >
      {/* Subtle proactive hint bubble if active */}
      {!isOpen && activeSuggestion && !isDragging && (
        <VibiProactiveHint
          suggestion={activeSuggestion}
          onAction={(sug) => {
            vibiCharacterService.happy({ preferences });
            acceptSuggestion(sug);
          }}
          onDismiss={(id) => {
            vibiCharacterService.idle();
            dismissSuggestion(id);
          }}
        />
      )}

      <button
        type="button"
        className={`vibi-launcher-fab ${isDragging ? 'elevated' : ''} ${characterState} vibi-mood-${activeMood} vibi-state-${characterState}`}
        onClick={handleClick}
        aria-label={isMinimized ? 'Restore Vibi Assistant' : 'Open Vibi Assistant'}
        title="Chat with Vibi"
        data-testid="vibi-launcher-fab"
        data-mood={activeMood}
        style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
      >
        <VibiAvatar
          size={isMinimized ? 44 : 64}
          mood={activeMood}
          withStatusDot={false}
          isOnline={true}
        />
        <span className="sr-only vibi-fab-label">{getActionLabel()}</span>
      </button>
    </aside>
  );
}

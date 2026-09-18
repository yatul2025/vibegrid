/**
 * client/src/components/vibi/VibiLauncher.jsx
 * ===========================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 2 UI FOUNDATION
 *
 * Dockable Floating Action Button (FAB).
 * - Floats above bottom navigation and safe areas
 * - Hides when Master switch is OFF or Floating Button is OFF
 * - Shows restored/minimized chip state
 * - Tap opens or restores the Vibi panel
 */

import React from 'react';
import { useVibiAssistant } from '../../context/VibiAssistantContext';
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
    dismissSuggestion
  } = useVibiAssistant();

  // Hide if master switch is OFF or floating button option is OFF
  if (!isEnabled || !preferences.floatingButton) {
    return null;
  }

  // If full panel is currently open and not minimized, hide the launcher to avoid visual clutter
  if (isOpen && !isMinimized) {
    return null;
  }

  const handleClick = () => {
    if (isMinimized) {
      restoreAssistant();
    } else {
      openAssistant();
    }
  };

  return (
    <aside
      className={`vibi-launcher-container ${isMinimized ? 'minimized-dock' : ''}`}
      aria-label="Vibi AI Quick Launcher"
    >
      {/* Phase 7: Subtle proactive hint bubble */}
      {!isOpen && activeSuggestion && (
        <VibiProactiveHint
          suggestion={activeSuggestion}
          onAction={acceptSuggestion}
          onDismiss={dismissSuggestion}
        />
      )}

      <button
        type="button"
        className="vibi-launcher-fab"
        onClick={handleClick}
        aria-label={isMinimized ? 'Restore Vibi Assistant' : 'Open Vibi Assistant'}
        title="Chat with Vibi"
        data-testid="vibi-launcher-fab"
      >
        <VibiAvatar size={isMinimized ? 32 : 38} withStatusDot={true} isOnline={true} />
        <span className="vibi-fab-label">
          {isMinimized ? 'Vibi (Minimized)' : 'Ask Vibi'}
        </span>
        <span className="vibi-fab-sparkle" aria-hidden="true">✨</span>
      </button>
    </aside>
  );
}

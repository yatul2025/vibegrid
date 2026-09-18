/**
 * client/src/components/vibi/VibiHeaderEntry.jsx
 * ===============================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 2 UI FOUNDATION
 *
 * Header entry point for desktop and mobile navigation bars.
 * Renders Vibi mascot avatar with subtle glow and active indicator.
 */

import React from 'react';
import { useVibiAssistant } from '../../context/VibiAssistantContext';
import VibiAvatar from './VibiAvatar';

export default function VibiHeaderEntry({ isMobile = false, className = '' }) {
  const { isEnabled, isOpen, toggleAssistant } = useVibiAssistant();

  if (!isEnabled) {
    return null;
  }

  return (
    <button
      type="button"
      className={`vibi-header-entry-btn ${isOpen ? 'active' : ''} ${isMobile ? 'mobile' : 'desktop'} ${className}`}
      onClick={toggleAssistant}
      aria-label="Toggle Vibi AI Assistant"
      title="Ask Vibi AI"
      data-testid="vibi-header-entry"
    >
      <div className="vibi-header-icon-wrapper">
        <VibiAvatar size={isMobile ? 24 : 26} withStatusDot={false} />
        <span className="vibi-sparkle-pip" aria-hidden="true">✨</span>
      </div>
      {!isMobile && <span className="vibi-header-label">Vibi</span>}
    </button>
  );
}

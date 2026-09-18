/**
 * client/src/components/vibi/VibiPanel.jsx
 * ========================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 2 UI FOUNDATION
 *
 * Sliding Assistant Panel / Bottom Sheet Drawer.
 * - Mobile bottom-sheet with drag handle and safe-area padding
 * - Desktop slide-over drawer
 * - Header with Minimize and Close actions
 * - Accessible dialog attributes and backdrop dismiss
 */

import React, { useRef, useEffect } from 'react';
import { useVibiAssistant } from '../../context/VibiAssistantContext';
import VibiAvatar from './VibiAvatar';
import VibiConversation from './VibiConversation';
import { Minus, X } from 'lucide-react';

export default function VibiPanel() {
  const {
    isEnabled,
    isOpen,
    isMinimized,
    closeAssistant,
    minimizeAssistant
  } = useVibiAssistant();

  const panelRef = useRef(null);

  // Phase 10 Accessibility: Keyboard focus trap within modal dialog
  useEffect(() => {
    if (!isOpen || isMinimized) return;

    const handleTabKey = (e) => {
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusableEls = panelRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableEls || focusableEls.length === 0) return;

      const firstEl = focusableEls[0];
      const lastEl = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    window.addEventListener('keydown', handleTabKey);
    return () => window.removeEventListener('keydown', handleTabKey);
  }, [isOpen, isMinimized]);

  if (!isEnabled || !isOpen || isMinimized) {
    return null;
  }

  return (
    <>
      {/* Backdrop for outside click dismiss on mobile */}
      <div
        className="vibi-panel-backdrop"
        onClick={closeAssistant}
        aria-hidden="true"
        data-testid="vibi-panel-backdrop"
      />

      <aside
        ref={panelRef}
        className="vibi-panel-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Vibi AI Assistant Panel"
        data-testid="vibi-assistant-panel"
      >
        {/* Panel Header */}
        <div className="vibi-panel-header">
          <div className="vibi-panel-header-left">
            <VibiAvatar size={34} withStatusDot={true} isOnline={true} />
            <div className="vibi-panel-header-info">
              <div className="vibi-panel-title-row">
                <h2 className="vibi-panel-title">Vibi Assistant</h2>
                <span className="vibi-ai-badge">AI</span>
              </div>
              <span className="vibi-panel-status">Native companion • Ready</span>
            </div>
          </div>

          <div className="vibi-panel-header-actions">
            <button
              type="button"
              className="vibi-header-tool-btn"
              onClick={minimizeAssistant}
              title="Minimize to dock"
              aria-label="Minimize Vibi assistant"
              data-testid="vibi-minimize-btn"
            >
              <Minus size={17} />
            </button>
            <button
              type="button"
              className="vibi-header-tool-btn"
              onClick={closeAssistant}
              title="Close"
              aria-label="Close Vibi assistant"
              data-testid="vibi-close-btn"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Panel Conversation Body */}
        <div className="vibi-panel-body">
          <VibiConversation />
        </div>
      </aside>
    </>
  );
}

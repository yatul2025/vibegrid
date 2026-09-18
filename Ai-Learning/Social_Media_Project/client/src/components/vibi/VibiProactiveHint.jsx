/**
 * client/src/components/vibi/VibiProactiveHint.jsx
 * ==================================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 7 PROACTIVE ASSISTANCE & SMART SUGGESTIONS
 *
 * Subtle, non-blocking proactive hint bubble.
 * - Floats near Vibi launcher without obstructing page content or bottom nav
 * - Never shows popup modals; never steals keyboard focus
 * - Easily dismissable with 1 click
 * - Supports instant action trigger or conversational entry
 */

import React, { useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';

export default function VibiProactiveHint({
  suggestion,
  onAction,
  onDismiss,
  autoDismissMs = 12000
}) {
  if (!suggestion) return null;

  // Optional auto-dismiss after duration
  useEffect(() => {
    if (!autoDismissMs || autoDismissMs <= 0) return;
    const timer = setTimeout(() => {
      if (typeof onDismiss === 'function') {
        onDismiss(suggestion.id);
      }
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [suggestion.id, autoDismissMs, onDismiss]);

  return (
    <div
      className="vibi-proactive-hint-bubble"
      role="status"
      aria-live="polite"
      data-testid="vibi-proactive-hint"
    >
      <div className="vibi-proactive-hint-glow" aria-hidden="true" />
      <div className="vibi-proactive-hint-header">
        <span className="vibi-proactive-badge">
          <Sparkles size={12} className="vibi-proactive-sparkle" />
          Vibi Tip
        </span>
        <button
          type="button"
          className="vibi-proactive-close-btn"
          onClick={() => onDismiss(suggestion.id)}
          aria-label="Dismiss Vibi suggestion"
          title="Dismiss"
          data-testid="vibi-hint-dismiss-btn"
        >
          <X size={13} />
        </button>
      </div>

      <div className="vibi-proactive-body">
        <span className="vibi-proactive-icon" aria-hidden="true">
          {suggestion.icon || '💡'}
        </span>
        <p className="vibi-proactive-text">{suggestion.text}</p>
      </div>

      {suggestion.actionLabel && (
        <div className="vibi-proactive-footer">
          <button
            type="button"
            className="vibi-proactive-action-btn"
            onClick={() => onAction(suggestion)}
            data-testid="vibi-hint-action-btn"
          >
            {suggestion.actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

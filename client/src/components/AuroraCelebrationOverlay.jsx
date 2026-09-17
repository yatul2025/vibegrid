import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import soundFx from '../services/soundFxService';

/**
 * Dispatches a global celebration event that AuroraCelebrationOverlay catches.
 * @param {{ title: string, subtitle?: string, duration?: number, type?: string }} options
 */
export function triggerCelebration({
  title = 'Success!',
  subtitle = '',
  duration = 3200,
  type = 'aurora'
} = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('vibegrid:celebrate', {
      detail: { title, subtitle, duration, type, timestamp: Date.now() }
    })
  );
}

export default function AuroraCelebrationOverlay() {
  const [celebration, setCelebration] = useState(null);
  const [animatingOut, setAnimatingOut] = useState(false);

  const dismiss = useCallback(() => {
    setAnimatingOut(true);
    const timer = setTimeout(() => {
      setCelebration(null);
      setAnimatingOut(false);
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleCelebrateEvent = (e) => {
      const detail = e.detail || {};
      setCelebration({
        id: detail.timestamp || Date.now(),
        title: detail.title || 'Success!',
        subtitle: detail.subtitle || '',
        duration: detail.duration || 3200,
        type: detail.type || 'aurora'
      });
      setAnimatingOut(false);

      // Trigger lightweight haptic feedback if supported
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([25, 40]);
        } catch {
          // Ignore vibrate errors if disallowed by browser policy
        }
      }

      // Trigger Web Audio celebration sound FX
      try {
        soundFx.play('celebration');
      } catch {}
    };

    window.addEventListener('vibegrid:celebrate', handleCelebrateEvent);
    return () => window.removeEventListener('vibegrid:celebrate', handleCelebrateEvent);
  }, []);

  useEffect(() => {
    if (!celebration) return;
    const autoDismissTimer = setTimeout(() => {
      dismiss();
    }, celebration.duration || 3200);

    return () => clearTimeout(autoDismissTimer);
  }, [celebration, dismiss]);

  if (!celebration) return null;

  return (
    <div
      className={`aurora-celebration-container ${animatingOut ? 'aurora-exit' : 'aurora-enter'}`}
      role="status"
      aria-live="polite"
      data-testid="aurora-celebration-overlay"
    >
      {/* Expanding radial aurora shockwave rings */}
      <div className="aurora-radiance-ring aurora-ring-1" aria-hidden="true" />
      <div className="aurora-radiance-ring aurora-ring-2" aria-hidden="true" />

      {/* Floating Shimmer Status Capsule */}
      <div
        className="aurora-shimmer-capsule"
        onClick={dismiss}
        title="Tap to dismiss"
        data-testid="aurora-shimmer-capsule"
      >
        <div className="aurora-icon-disc" aria-hidden="true">
          <svg
            className="aurora-check-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" className="aurora-check-path" />
          </svg>
        </div>

        <div className="aurora-text-group">
          <div className="aurora-title">{celebration.title}</div>
          {celebration.subtitle ? (
            <div className="aurora-subtitle">{celebration.subtitle}</div>
          ) : null}
        </div>

        <button
          type="button"
          className="aurora-close-btn"
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          aria-label="Dismiss celebration"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

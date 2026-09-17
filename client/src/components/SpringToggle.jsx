import React from 'react';

/**
 * SpringToggle
 * ============
 * Phase 8 Option 1: Fluid Spring Switch with Haptic Pulse.
 * Features:
 * - Elastic squash & stretch physics on active press/release
 * - Bouncy overshoot easing: cubic-bezier(0.34, 1.56, 0.64, 1)
 * - Native haptic vibration on mobile devices
 * - Fully accessible with keyboard navigation and ARIA attributes
 * - Zero layout shift drop-in replacement for standard toggle switches
 */
export default function SpringToggle({
  checked = false,
  onChange,
  disabled = false,
  id,
  name,
  'aria-label': ariaLabel,
  title
}) {
  const handleChange = (e) => {
    if (disabled) return;
    
    // Haptic vibration feedback on touch devices
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(15);
      } catch {
        // Ignore haptic errors if permissions or hardware lack support
      }
    }

    if (onChange) {
      onChange(e);
    }
  };

  return (
    <label
      className={`switch-toggle spring-switch-toggle ${checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''}`}
      title={title}
    >
      <input
        type="checkbox"
        id={id}
        name={name}
        checked={Boolean(checked)}
        onChange={handleChange}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-checked={Boolean(checked)}
        role="switch"
      />
      <span className="switch-slider spring-switch-slider">
        <span className="spring-slider-track-glow" />
        <span className="spring-slider-thumb" />
      </span>
    </label>
  );
}

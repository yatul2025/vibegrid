/**
 * client/src/components/PasswordToggleIcon.jsx
 * ============================================
 * Modern, accessible SVG icons for password visibility toggle (Eye & EyeOff)
 */
import React from 'react';

export function EyeIcon({ size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function PasswordToggleButton({ isVisible, onToggle, title }) {
  const label = title || (isVisible ? 'Hide password' : 'Show password');
  return (
    <button
      type="button"
      className="password-toggle-btn"
      onClick={onToggle}
      tabIndex="-1"
      title={label}
      aria-label={label}
    >
      {isVisible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
    </button>
  );
}

export default PasswordToggleButton;

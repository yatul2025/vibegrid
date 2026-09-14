import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * client/src/components/AuthPromptModal.jsx
 * =========================================
 * Contextual Join VibeGrid Auth Prompt Modal
 * 
 * Triggered whenever a Demo Mode visitor attempts a restricted mutating action.
 * Displays:
 * 1. "Join VibeGrid" header with VibeGrid logo.
 * 2. Contextual reason (e.g. "Create an account to like posts and comments").
 * 3. [ Create an account ] button -> opens registration.
 * 4. [ Log in ] button -> opens login.
 * 5. "Continue exploring" button -> closes modal, leaving visitor in place.
 */

export default function AuthPromptModal({
  isOpen,
  title = 'Join VibeGrid',
  subtitle = 'Create an account to continue.',
  onClose,
  onNavigateToSignup,
  onNavigateToLogin
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalElement = (
    <div className="auth-prompt-backdrop" onClick={onClose} role="presentation">
      <div 
        className="auth-prompt-card" 
        onClick={(e) => e.stopPropagation()}
        role="dialog" 
        aria-modal="true"
        aria-labelledby="auth-prompt-title"
      >
        {/* Close "X" Button */}
        <button 
          type="button" 
          className="auth-prompt-close-btn" 
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>

        {/* Brand Icon */}
        <div className="auth-prompt-icon-wrapper">
          <svg viewBox="0 0 52 52" width="48" height="48" className="vg-nav-logo-svg" fill="none">
            <defs>
              <linearGradient id="vgPromptGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f09433" />
                <stop offset="25%" stopColor="#e6683c" />
                <stop offset="50%" stopColor="#dc2743" />
                <stop offset="75%" stopColor="#cc2366" />
                <stop offset="100%" stopColor="#bc1888" />
              </linearGradient>
              <linearGradient id="vgPromptVGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#fff2f6" />
              </linearGradient>
            </defs>
            <rect width="52" height="52" rx="16" fill="url(#vgPromptGrad)" />
            <circle cx="41" cy="11" r="2.4" fill="white" opacity="0.95" />
            <circle cx="41" cy="19" r="1.6" fill="white" opacity="0.6" />
            <circle cx="33" cy="11" r="1.6" fill="white" opacity="0.6" />
            <path
              d="M14 15 L26 38 L38 15"
              stroke="url(#vgPromptVGrad)"
              strokeWidth="5.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Modal Header */}
        <h2 id="auth-prompt-title" className="auth-prompt-title">{title}</h2>
        <p className="auth-prompt-subtitle">{subtitle}</p>

        {/* Actions */}
        <div className="auth-prompt-actions">
          <button
            type="button"
            className="auth-prompt-btn-primary"
            onClick={onNavigateToSignup}
          >
            Create an account
          </button>

          <button
            type="button"
            className="auth-prompt-btn-secondary"
            onClick={onNavigateToLogin}
          >
            Log in
          </button>

          <button
            type="button"
            className="auth-prompt-btn-tertiary"
            onClick={onClose}
          >
            Continue exploring
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' && document.body
    ? createPortal(modalElement, document.body)
    : null;
}

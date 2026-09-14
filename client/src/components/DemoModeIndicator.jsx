import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';

const DEMO_PERSONAS = [
  { username: 'sophia_wander', name: 'Sophia', icon: '✈️', role: 'Travel & Photography' },
  { username: 'alex_design', name: 'Alex', icon: '📐', role: 'Architecture & Design' },
  { username: 'elena_culinary', name: 'Elena', icon: '🥐', role: 'Pastry & Specialty Coffee' },
  { username: 'liam_visuals', name: 'Liam', icon: '🌧️', role: 'Street & Cyberpunk' }
];

export default function DemoModeIndicator({ onNavigateToSignup, onNavigateToLogin }) {
  const { user, isDemoMode, startDemoSession, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isDemoMode || !user) return null;

  const currentPersona = DEMO_PERSONAS.find((p) => p.username === user.username) || {
    username: user.username,
    name: user.full_name || user.username,
    icon: '👀',
    role: 'Demo Explorer'
  };

  const handleSwitchPersona = async (personaUsername) => {
    if (personaUsername === user.username) return;
    setSwitching(true);
    try {
      await startDemoSession(personaUsername);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to switch demo persona', err);
    } finally {
      setSwitching(false);
    }
  };

  const modalElement = isOpen ? (
    <div
      className="auth-prompt-backdrop"
      onClick={() => setIsOpen(false)}
      role="presentation"
    >
      <div 
        className="auth-prompt-card demo-explainer-card" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
            <button
              type="button"
              className="auth-prompt-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
            >
              &times;
            </button>

            <div className="demo-explainer-header">
              <span className="demo-badge-tag">👀 DEMO MODE</span>
              <h3 className="auth-prompt-title">
                {currentPersona.icon} @{user.username}
              </h3>
              <p className="auth-prompt-subtitle">
                You're exploring VibeGrid as @{user.username} in read-only mode.
              </p>
            </div>

            {/* Feature Access Matrix */}
            <div className="demo-features-list">
              <div className="demo-feature-item allowed">
                <span className="demo-feature-check">✓</span>
                <span>Browse feeds, stories, profiles & DMs</span>
              </div>
              <div className="demo-feature-item restricted">
                <span className="demo-feature-lock">🔒</span>
                <span>Likes, comments, and messages require an account</span>
              </div>
            </div>

            {/* Switch Persona Section */}
            <div className="demo-switch-persona-section">
              <div className="demo-switch-title">SWITCH DEMO PROFILE:</div>
              <div className="demo-personas-grid">
                {DEMO_PERSONAS.map((p) => {
                  const isActive = p.username === user.username;
                  return (
                    <button
                      key={p.username}
                      type="button"
                      className={`demo-persona-chip ${isActive ? 'active' : ''}`}
                      onClick={() => handleSwitchPersona(p.username)}
                      disabled={switching || isActive}
                      title={p.role}
                    >
                      <span className="persona-chip-icon">{p.icon}</span>
                      <span className="persona-chip-name">@{p.username}</span>
                      {isActive && <span className="persona-chip-active-dot">•</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="auth-prompt-actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="auth-prompt-btn-primary"
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToSignup?.();
                }}
              >
                Create an account
              </button>

              <button
                type="button"
                className="auth-prompt-btn-secondary"
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToLogin?.();
                }}
              >
                Log in
              </button>

              <div className="demo-footer-links">
                <button
                  type="button"
                  className="demo-exit-btn"
                  onClick={async () => {
                    setIsOpen(false);
                    await logout();
                  }}
                >
                  Exit Demo Mode
                </button>
                <span className="demo-footer-divider">•</span>
                <button
                  type="button"
                  className="auth-prompt-btn-tertiary"
                  onClick={() => setIsOpen(false)}
                >
                  Continue exploring
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null;

  return (
    <>
      {/* Subtle Navbar / Top Header Indicator Pill */}
      <button
        type="button"
        className="demo-mode-indicator-pill"
        onClick={() => setIsOpen(true)}
        title="Click to learn about Demo Mode or switch persona"
        aria-label="Demo Mode Indicator"
      >
        <span className="demo-indicator-pulse"></span>
        <span className="demo-indicator-text">
          <span className="demo-indicator-badge">DEMO MODE</span>
          <span className="demo-indicator-user">@{user.username}</span>
        </span>
      </button>

      {modalElement && typeof document !== 'undefined' && document.body
        ? createPortal(modalElement, document.body)
        : null}
    </>
  );
}

/**
 * client/src/components/ConfirmModal.jsx
 * =====================================
 * Market-level, polished confirmation modal dialog.
 * Replaces ugly browser window.confirm prompts with an Instagram / iOS style
 * dialog featuring smooth animations, backdrop blur, icon badge, and customizable actions.
 */

import React, { useEffect } from 'react';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  description = 'This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  confirmVariant,
  variant = 'danger', // 'danger' | 'warning' | 'primary'
  icon = '🗑️',
  loading,
  isLoading = false
}) {
  const finalMessage = message || description;
  const finalVariant = confirmVariant || variant;
  const finalLoading = loading !== undefined ? loading : isLoading;

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !finalLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, finalLoading]);

  if (!isOpen) return null;

  return (
    <div
      className="confirm-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="confirm-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Icon Circle */}
        <div className={`confirm-modal-icon-wrap variant-${finalVariant}`}>
          <span className="confirm-modal-icon">{icon}</span>
        </div>

        {/* Text Content */}
        <div className="confirm-modal-content">
          <h3 id="confirm-modal-title" className="confirm-modal-title">
            {title}
          </h3>
          <p className="confirm-modal-message">
            {finalMessage}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="confirm-modal-actions">
          <button
            type="button"
            className={`confirm-btn-primary variant-${finalVariant}`}
            onClick={onConfirm}
            disabled={finalLoading}
          >
            {finalLoading ? (
              <span className="confirm-btn-spinner" />
            ) : (
              confirmText
            )}
          </button>
          <button
            type="button"
            className="confirm-btn-cancel"
            onClick={onClose}
            disabled={finalLoading}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}

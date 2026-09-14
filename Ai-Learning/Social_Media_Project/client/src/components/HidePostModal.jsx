/**
 * client/src/components/HidePostModal.jsx
 * =====================================
 * Market-level Content Moderation & Hide Post Dialog.
 * Replaces ugly browser window.prompt with a sleek Instagram/Twitter-style
 * reason selection sheet with interactive preset chips and custom reason input.
 */

import React, { useState, useEffect } from 'react';

const REASON_PRESETS = [
  { id: 'adult', label: '🔞 Adult or explicit content', value: 'Adult content' },
  { id: 'spam', label: '🚫 Spam, scam, or bot', value: 'Spam or scam' },
  { id: 'harassment', label: '⚠️ Harassment or hate speech', value: 'Harassment or hate speech' },
  { id: 'violence', label: '🩸 Violence or graphic media', value: 'Violence or graphic media' },
  { id: 'misinfo', label: '📢 Misleading or false info', value: 'False information' },
  { id: 'other', label: '✍️ Other reason...', value: 'Other' }
];

export default function HidePostModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false
}) {
  const [selectedPreset, setSelectedPreset] = useState('Adult content');
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedPreset('Adult content');
      setCustomReason('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, loading]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    const finalReason = selectedPreset === 'Other'
      ? (customReason.trim() || 'Moderated by user')
      : selectedPreset;
    onConfirm(finalReason);
  };

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
      aria-labelledby="hide-post-title"
    >
      <div className="confirm-modal-card hide-post-card" onClick={(e) => e.stopPropagation()}>
        {/* Icon Circle */}
        <div className="confirm-modal-icon-wrap variant-warning">
          <span className="confirm-modal-icon">🛡️</span>
        </div>

        {/* Header */}
        <div className="confirm-modal-content">
          <h3 id="hide-post-title" className="confirm-modal-title">
            Hide Post from Feed
          </h3>
          <p className="confirm-modal-message">
            Select a moderation reason. This post will be immediately hidden from public feeds and explore.
          </p>
        </div>

        {/* Reasons Chips List */}
        <form onSubmit={handleSubmit} className="hide-post-form">
          <div className="hide-reasons-grid">
            {REASON_PRESETS.map((p) => {
              const isSelected = selectedPreset === p.value;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`hide-reason-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedPreset(p.value)}
                  disabled={loading}
                >
                  <span className="hide-chip-radio">{isSelected ? '●' : '○'}</span>
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          {selectedPreset === 'Other' && (
            <div className="hide-custom-input-wrap">
              <input
                type="text"
                className="hide-custom-input"
                placeholder="Type specific reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                maxLength={100}
                autoFocus
                disabled={loading}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="confirm-modal-actions">
            <button
              type="submit"
              className="confirm-btn-primary variant-warning"
              disabled={loading || (selectedPreset === 'Other' && !customReason.trim())}
            >
              {loading ? <span className="confirm-btn-spinner" /> : 'Hide Post'}
            </button>
            <button
              type="button"
              className="confirm-btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

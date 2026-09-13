/**
 * client/src/components/CreateStoryModal.jsx
 * ==========================================
 * Story Creator & Upload Modal
 * 
 * Features:
 * 1. Image drag-and-drop or file picker.
 * 2. Vertical 9:16 mobile aspect story preview.
 * 3. 24-hour auto-expiration reminder badge.
 * 4. Multipart upload via FormData to POST /api/stories.
 * 5. Instant callback to refresh the Story Tray.
 */

import React, { useState, useRef } from 'react';
import apiClient from '../api/client';

export default function CreateStoryModal({ isOpen, onClose, onStoryCreated }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(selected.type)) {
      setError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }

    // Validate size (max 5MB)
    if (selected.size > 5 * 1024 * 1024) {
      setError('Story image must be under 5MB.');
      return;
    }

    setError(null);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      const syntheticEvent = { target: { files: [droppedFile] } };
      handleFileChange(syntheticEvent);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select an image for your story.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('media', file);

      const res = await apiClient.post('/stories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.success) {
        if (onStoryCreated) {
          onStoryCreated(res.data);
        }
        handleClose();
      } else {
        setError(res.error || 'Failed to upload story.');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setError(null);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div
        className="modal-card story-create-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Create Story</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="story-create-form">
          {error && <div className="form-error-banner">⚠️ {error}</div>}

          {/* Ephemeral Notice */}
          <div className="story-expiry-badge">
            <span>⏱️ Disappears automatically after <strong>24 hours</strong></span>
          </div>

          {/* Dropzone / Preview Area */}
          {!previewUrl ? (
            <div
              className="story-dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <div className="story-dropzone-icon">✨</div>
              <p className="story-dropzone-title">Share a photo moment</p>
              <p className="story-dropzone-sub">Click to browse or drag & drop (Max 5MB)</p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
              />
            </div>
          ) : (
            <div className="story-preview-container">
              <img
                src={previewUrl}
                alt="Story preview"
                className="story-preview-img"
              />
              <button
                type="button"
                className="story-preview-change-btn"
                onClick={() => {
                  setFile(null);
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                disabled={loading}
              >
                Change Photo
              </button>
            </div>
          )}

          {/* Action Footer */}
          <div className="modal-actions" style={{ marginTop: '16px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !file}
            >
              {loading ? (
                <>
                  <span className="spinner-sm" style={{ marginRight: '6px' }}></span>
                  Sharing...
                </>
              ) : (
                'Share to Story'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

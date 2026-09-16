/**
 * client/src/components/CreatePostModal.jsx
 * =========================================
 * Modal Dialog for Creating & Sharing Photo Posts
 * 
 * Features:
 * 1. Image upload with drag & drop and instant preview.
 * 2. Strict file size (<5MB) and type (JPEG/PNG/WebP) validation.
 * 3. Caption input with character countdown (max 2,200 characters).
 * 4. Multi-part form data upload to POST /api/posts.
 * 5. Instant callback onPostCreated to update feed and profile in real time.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { RotateCw, ImagePlus, AlertCircle } from 'lucide-react';

export default function CreatePostModal({ isOpen, onClose, onPostCreated }) {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  // Clean up object URL when previewUrl changes or component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Reset state and revoke preview when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPreviewUrl((prev) => {
        if (prev && prev.startsWith('blob:')) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      setCaption('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle file selection
  const handleFileChange = (file) => {
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size too large. Maximum allowed size is 5MB.');
      return;
    }

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Unsupported image type. Please select a JPEG, PNG, or WebP photo.');
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Handle Drag and Drop
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Clear selected image
  const handleResetImage = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Submit Post to API
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a photo to share.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      if (caption.trim()) {
        formData.append('caption', caption.trim().slice(0, 2200));
      }

      const res = await apiClient.post('/posts', formData);

      if (res.success && res.data?.post) {
        if (onPostCreated) onPostCreated(res.data.post);
        // Reset and close
        handleResetImage();
        setCaption('');
        onClose();
      } else {
        setError(res.error || 'Failed to publish post.');
      }
    } catch (err) {
      setError(err.message || 'Error uploading post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card create-post-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h3>Create new post</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && (
          <div className="modal-error-banner" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="create-post-form">
          <div className="create-post-body">
            {/* Left: Image Upload & Preview Area */}
            <div className="create-post-media-pane">
              {previewUrl ? (
                <div className="post-preview-container">
                  <img src={previewUrl} alt="Upload preview" className="post-preview-img" />
                  <button
                    type="button"
                    className="preview-change-btn"
                    onClick={handleResetImage}
                    title="Choose a different image"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RotateCw size={14} />
                    <span>Change Photo</span>
                  </button>
                </div>
              ) : (
                <div
                  className="post-dropzone"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="dropzone-icon" style={{ display: 'flex', justifyContent: 'center' }}>
                    <ImagePlus size={44} strokeWidth={1.5} color="var(--primary)" />
                  </div>
                  <h4>Drag photos here</h4>
                  <p>or click to select from your device</p>
                  <span className="dropzone-hint">Supports JPEG, PNG, WebP up to 5MB</span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFileChange(e.target.files?.[0])}
                  />
                </div>
              )}
            </div>

            {/* Right: Caption & Author Pane */}
            <div className="create-post-details-pane">
              {user && (
                <div className="create-post-author">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="author-avatar-mini" />
                  ) : (
                    <div className="author-avatar-fallback">
                      {user.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="author-username">@{user.username}</span>
                </div>
              )}

              <div className="caption-field">
                <textarea
                  rows={6}
                  placeholder="Write a caption..."
                  aria-label="Write a caption"
                  maxLength={2200}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 2200))}
                ></textarea>
                <div className="caption-meta">
                  <span className="char-counter">{caption.length}/2,200</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer with Actions */}
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !selectedFile}
            >
              {loading ? 'Sharing post...' : 'Share Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

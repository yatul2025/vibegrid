/**
 * client/src/components/EncryptedMediaRenderer.jsx
 * ================================================
 * Client-Side Decrypting Media Renderer (Photos & Voice Notes)
 * 
 * Fetches encrypted ciphertext bytes from server, decrypts them client-side
 * using AES-256-GCM, and renders the media as a secure local Blob URL.
 */

import React, { useState, useEffect, useRef } from 'react';
import { decryptMediaToObjectUrl } from '../services/crypto/mediaCrypto';

export default function EncryptedMediaRenderer({ mediaPayload }) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!mediaPayload || !mediaPayload.url || !mediaPayload.mediaKey || !mediaPayload.iv) {
      setError(true);
      setLoading(false);
      return;
    }

    let isMounted = true;
    let createdUrl = null;

    async function fetchAndDecrypt() {
      try {
        setLoading(true);
        // Fetch raw encrypted ciphertext buffer
        const res = await fetch(mediaPayload.url);
        if (!res.ok) throw new Error('Failed to load encrypted media bytes.');

        const ciphertextBuffer = await res.arrayBuffer();

        // Client-side AES-256-GCM decryption
        const url = await decryptMediaToObjectUrl(
          ciphertextBuffer,
          mediaPayload.mediaKey,
          mediaPayload.iv,
          mediaPayload.mimeType || 'image/jpeg'
        );

        createdUrl = url;

        if (isMounted) {
          setObjectUrl(url);
          setLoading(false);
        }
      } catch (err) {
        console.error('[EncryptedMediaRenderer] Decryption error:', err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    }

    fetchAndDecrypt();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [mediaPayload]);

  const handleToggleSpeed = () => {
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  if (loading) {
    const label =
      mediaPayload?.type === 'audio'
        ? 'voice note'
        : mediaPayload?.type === 'video'
        ? 'video'
        : mediaPayload?.type === 'document'
        ? 'document'
        : 'photo';
    return (
      <div className="encrypted-media-loading">
        <div className="spinner-sm"></div>
        <span>🔒 Decrypting {label}...</span>
      </div>
    );
  }

  if (error || !objectUrl) {
    return (
      <div className="encrypted-media-error">
        <span>🔒 [Could not decrypt media attachment]</span>
      </div>
    );
  }

  if (mediaPayload.type === 'audio') {
    return (
      <div className="encrypted-audio-wrap">
        <div className="audio-note-header">
          <span className="audio-mic-icon">🎙️</span>
          <span className="audio-label">Voice Note ({mediaPayload.durationSeconds || 0}s)</span>
          <button
            type="button"
            className="audio-speed-btn"
            onClick={handleToggleSpeed}
            title="Cycle playback speed"
            data-testid="audio-speed-btn"
          >
            {playbackSpeed}x
          </button>
          <span className="audio-lock-tag" title="Decrypted client-side with AES-256-GCM">🔒 E2EE</span>
        </div>
        <audio ref={audioRef} controls src={objectUrl} className="encrypted-audio-player" />
      </div>
    );
  }

  if (mediaPayload.type === 'video') {
    return (
      <div className="encrypted-video-wrap">
        <video controls src={objectUrl} className="encrypted-chat-video" />
        <span className="img-lock-badge">🔒 Encrypted Video</span>
      </div>
    );
  }

  if (mediaPayload.type === 'document') {
    const fileName = mediaPayload.fileName || 'Document';
    const fileSizeStr = mediaPayload.fileSize ? ` · ${(mediaPayload.fileSize / 1024).toFixed(1)} KB` : '';
    return (
      <div className="encrypted-doc-wrap">
        <div className="doc-icon-wrap">📄</div>
        <div className="doc-info">
          <span className="doc-name" title={fileName}>{fileName}</span>
          <span className="doc-meta">Document{fileSizeStr} · 🔒 E2EE</span>
        </div>
        <a
          href={objectUrl}
          download={fileName}
          className="btn-doc-download"
          title="Download Decrypted File"
        >
          ⬇
        </a>
      </div>
    );
  }

  return (
    <div className="encrypted-image-wrap">
      <img
        src={objectUrl}
        alt="Encrypted attachment"
        className="encrypted-chat-img"
        onClick={() => window.open(objectUrl, '_blank')}
        title="Click to view full size"
      />
      <span className="img-lock-badge">🔒 Encrypted</span>
    </div>
  );
}

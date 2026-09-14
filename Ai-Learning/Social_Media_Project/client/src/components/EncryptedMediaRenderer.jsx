/**
 * client/src/components/EncryptedMediaRenderer.jsx
 * ================================================
 * Client-Side Decrypting Media Renderer (Photos & Voice Notes)
 * 
 * Fetches encrypted ciphertext bytes from server, decrypts them client-side
 * using AES-256-GCM, and renders the media as a secure local Blob URL.
 */

import React, { useState, useEffect } from 'react';
import { decryptMediaToObjectUrl } from '../services/crypto/mediaCrypto';

export default function EncryptedMediaRenderer({ mediaPayload }) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  if (loading) {
    return (
      <div className="encrypted-media-loading">
        <div className="spinner-sm"></div>
        <span>🔒 Decrypting {mediaPayload?.type === 'audio' ? 'voice note' : 'photo'}...</span>
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
          <span className="audio-lock-tag" title="Decrypted client-side with AES-256-GCM">🔒 E2EE</span>
        </div>
        <audio controls src={objectUrl} className="encrypted-audio-player" />
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

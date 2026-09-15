/**
 * client/src/components/EncryptedMediaRenderer.jsx
 * ================================================
 * Client-Side Decrypting Media Renderer (Photos & Voice Notes)
 * 
 * Fetches encrypted ciphertext bytes from server, decrypts them client-side
 * using AES-256-GCM, and renders the media as a secure local Blob URL.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { decryptMediaToObjectUrl } from '../services/crypto/mediaCrypto';

// Module-level in-memory cache for decrypted Object URLs to prevent repeated decryptions,
// unmounting, and video playback flickering across component re-renders.
const decryptedUrlCache = new Map();

function EncryptedMediaRenderer({ mediaPayload }) {
  const payloadUrl = mediaPayload?.url;
  const payloadKey = mediaPayload?.mediaKey;
  const payloadIv = mediaPayload?.iv;
  const payloadMime = mediaPayload?.mimeType;
  const payloadType = mediaPayload?.type;

  // Stable cache key based on URL and decryption key
  const cacheKey = useMemo(() => {
    return payloadUrl && payloadKey ? `${payloadUrl}_${payloadKey}` : null;
  }, [payloadUrl, payloadKey]);

  const [objectUrl, setObjectUrl] = useState(() => {
    return cacheKey ? (decryptedUrlCache.get(cacheKey) || null) : null;
  });
  const [loading, setLoading] = useState(() => {
    return cacheKey ? !decryptedUrlCache.has(cacheKey) : true;
  });
  const [error, setError] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loadedDuration, setLoadedDuration] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!payloadUrl || !payloadKey || !payloadIv) {
      setError(true);
      setLoading(false);
      return;
    }

    // If already in cache, update state if needed and avoid re-fetching or re-decrypting
    const cached = cacheKey ? decryptedUrlCache.get(cacheKey) : null;
    if (cached) {
      if (objectUrl !== cached) {
        setObjectUrl(cached);
      }
      setLoading(false);
      setError(false);
      return;
    }

    let isMounted = true;

    async function fetchAndDecrypt() {
      try {
        setLoading(true);
        // Fetch raw encrypted ciphertext buffer
        const res = await fetch(payloadUrl);
        if (!res.ok) throw new Error('Failed to load encrypted media bytes.');

        const ciphertextBuffer = await res.arrayBuffer();

        // Client-side AES-256-GCM decryption
        const url = await decryptMediaToObjectUrl(
          ciphertextBuffer,
          payloadKey,
          payloadIv,
          payloadMime || (payloadType === 'video' ? 'video/mp4' : 'image/jpeg')
        );

        if (cacheKey) {
          decryptedUrlCache.set(cacheKey, url);
        }

        if (isMounted) {
          setObjectUrl(url);
          setLoading(false);
          setError(false);
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
    };
  }, [payloadUrl, payloadKey, payloadIv, payloadMime, payloadType, cacheKey, objectUrl]);

  const handleToggleSpeed = () => {
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  // Only show the loading indicator if we don't have an objectUrl yet.
  // This guarantees the <video> element is NEVER unmounted during background refreshes.
  if (loading && !objectUrl) {
    const label =
      payloadType === 'audio'
        ? 'voice note'
        : payloadType === 'video'
        ? 'video'
        : payloadType === 'document'
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

  if (payloadType === 'audio') {
    const rawSecs = mediaPayload?.durationSeconds;
    const hasValidPayloadDuration = typeof rawSecs === 'number' && rawSecs > 0;
    const durationNum = hasValidPayloadDuration
      ? rawSecs
      : (loadedDuration && isFinite(loadedDuration) && loadedDuration > 0 ? loadedDuration : null);

    return (
      <div className="encrypted-audio-wrap">
        <div className="audio-note-header">
          <div className="audio-header-left">
            <span className="audio-mic-icon">🎙️</span>
            <span className="audio-label">
              Voice Note{durationNum ? ` (${durationNum}s)` : ''}
            </span>
          </div>
          <div className="audio-header-right">
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
        </div>
        <audio
          ref={audioRef}
          controls
          src={objectUrl}
          className="encrypted-audio-player"
          preload="metadata"
          onLoadedMetadata={(e) => {
            if (e.target.duration && isFinite(e.target.duration) && e.target.duration > 0) {
              setLoadedDuration(Math.round(e.target.duration));
            }
          }}
        />
      </div>
    );
  }

  if (payloadType === 'video') {
    return (
      <div className="encrypted-video-wrap">
        <video
          controls
          src={objectUrl}
          className="encrypted-chat-video"
          playsInline
          preload="metadata"
        />
        <span className="img-lock-badge">🔒 Encrypted Video</span>
      </div>
    );
  }

  if (payloadType === 'document') {
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

// React.memo with property-level equality check to prevent unnecessary re-renders during playback
export default React.memo(EncryptedMediaRenderer, (prevProps, nextProps) => {
  const prev = prevProps.mediaPayload;
  const next = nextProps.mediaPayload;
  if (!prev && !next) return true;
  if (!prev || !next) return false;
  return (
    prev.url === next.url &&
    prev.mediaKey === next.mediaKey &&
    prev.iv === next.iv &&
    prev.mimeType === next.mimeType &&
    prev.type === next.type &&
    prev.durationSeconds === next.durationSeconds &&
    prev.fileName === next.fileName &&
    prev.fileSize === next.fileSize
  );
});

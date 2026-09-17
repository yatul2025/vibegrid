import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * NetworkStatusPill Component
 * ============================
 * Phase 7 Delight Feature: Offline & Reconnection Experience
 * (Option 1: Floating Dynamic Pill & Emerald Reconnect Pulse)
 *
 * Behavior:
 * 1. Offline Mode:
 *    - Floating frosted amber capsule drops in below top navbar.
 *    - Pulsing amber radar dot + WifiOff icon.
 *    - Reassuring message: "Offline Mode · Cached feed available".
 *    - Does NOT cause jarring page layout shifts.
 * 2. Reconnection Mode:
 *    - When transitioning from offline to online:
 *    - Instantly morphs into glowing emerald glass pill.
 *    - Expanding radial shockwave ripple (.emerald-reconnect-ripple).
 *    - "Back Online · Feed & messages synced ✨".
 *    - Micro-haptic pulse (navigator.vibrate([25, 50])).
 *    - Automatically glides out smoothly after 2.8 seconds.
 */
export default function NetworkStatusPill({ isOffline: propOffline, forceShowState }) {
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof propOffline === 'boolean') return propOffline;
    if (typeof navigator !== 'undefined') return !navigator.onLine;
    return false;
  });

  const [reconnectNotice, setReconnectNotice] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const wasOfflineRef = useRef(false);
  const dismissTimerRef = useRef(null);

  const triggerReconnect = () => {
    wasOfflineRef.current = false;
    setReconnectNotice(true);
    setIsExiting(false);

    // Haptic feedback if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([25, 50]);
      } catch {
        // Ignore vibrate policy errors
      }
    }

    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setReconnectNotice(false);
        setIsExiting(false);
      }, 400);
    }, 2800);
  };

  // Sync with propOffline if supplied
  useEffect(() => {
    if (typeof propOffline === 'boolean') {
      if (wasOfflineRef.current && !propOffline) {
        // Reconnected!
        triggerReconnect();
      } else if (propOffline) {
        wasOfflineRef.current = true;
        setReconnectNotice(false);
        setIsExiting(false);
      }
      setIsOffline(propOffline);
    }
  }, [propOffline]);

  // Window network event listeners as fallback
  useEffect(() => {
    if (typeof propOffline === 'boolean') return;

    const handleOnline = () => {
      setIsOffline(false);
      if (wasOfflineRef.current) {
        triggerReconnect();
      }
    };

    const handleOffline = () => {
      wasOfflineRef.current = true;
      setIsOffline(true);
      setReconnectNotice(false);
      setIsExiting(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [propOffline]);

  // Support manual/test forceShowState ('offline' | 'reconnected')
  useEffect(() => {
    if (forceShowState === 'offline') {
      setIsOffline(true);
      setReconnectNotice(false);
    } else if (forceShowState === 'reconnected') {
      setIsOffline(false);
      triggerReconnect();
    }
  }, [forceShowState]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  if (!isOffline && !reconnectNotice) return null;

  return (
    <div
      className={`network-status-pill-container ${isExiting ? 'pill-exit' : 'pill-enter'}`}
      role="status"
      aria-live="polite"
      data-testid="network-status-pill"
    >
      {isOffline ? (
        <div className="network-status-pill offline" data-testid="network-pill-offline">
          <span className="network-dot-amber" aria-hidden="true" />
          <WifiOff size={14} className="network-pill-icon" aria-hidden="true" />
          <span className="network-pill-text">Offline Mode · Cached feed available</span>
        </div>
      ) : (
        <div className="network-status-pill online" data-testid="network-pill-online">
          {/* Expanding emerald shockwave ripple */}
          <div className="emerald-reconnect-ripple" aria-hidden="true" />
          <span className="network-dot-emerald" aria-hidden="true" />
          <Wifi size={14} className="network-pill-icon" aria-hidden="true" />
          <span className="network-pill-text">Back Online · Everything synced ✨</span>
        </div>
      )}
    </div>
  );
}

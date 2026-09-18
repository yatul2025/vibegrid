/**
 * client/src/components/CallModal.jsx
 * ===================================
 * Real-Time WebRTC Audio & Video Calling Modal / Overlay
 * 
 * Features:
 * 1. Global modal listener for incoming calls from any application view.
 * 2. Incoming call banner with ringing animations and Web Audio ring tone.
 * 3. Connected 1-on-1 audio/video call room with remote & local video PIP.
 * 4. Call controls: Mute/unmute microphone, toggle camera, share screen, end call.
 * 5. Fullscreen Mode (Native Fullscreen API & Maximize Viewport Toggle, Shortcut 'F').
 * 6. Picture-in-Picture (PiP) window for multitasking.
 * 7. Clickable PiP & Swap Feeds toggle to switch main video and corner video.
 * 8. Real-time floating animated emoji reactions (❤️, 👏, 🔥, 😂, 🎉, ✋).
 * 9. Speaker / audio output mute toggle.
 * 10. E2EE Security badge and HD Connection Quality indicator.
 * 11. Professional SVG vector icons (no emojis) and frosted glassmorphic UI dock.
 */

import React, { useState, useEffect, useRef } from 'react';
import socketService from '../services/socketService';
import webrtcService from '../services/webrtcService';
import { useAuth } from '../context/AuthContext';

// ============================================================================
// Professional Lucide-Style Crisp SVG Vector Icons
// ============================================================================
function MicIcon({ muted }) {
  if (muted) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="2" y1="2" x2="22" y2="22" />
        <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
        <path d="M5 10v2a7 7 0 0 0 12 5" />
        <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function VideoCamIcon({ off }) {
  if (off) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="2" y1="2" x2="22" y2="22" />
        <path d="m22 7-6 4v2l6 4V7Z" />
        <path d="M10.66 6H14a2 2 0 0 1 2 2v2.5" />
        <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1.34" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 7-6 4v2l6 4V7Z" />
      <rect width="14" height="12" x="2" y="6" rx="2" />
    </svg>
  );
}

function ScreenShareIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <path d="m9 10 3-3 3 3" />
      <line x1="12" y1="7" x2="12" y2="13" />
    </svg>
  );
}

function SpeakerIcon({ muted }) {
  if (muted) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="22" y1="9" x2="16" y2="15" />
        <line x1="16" y1="9" x2="22" y2="15" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function FullscreenIcon({ isFullscreen }) {
  if (isFullscreen) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14h6v6" />
        <path d="M20 10h-6V4" />
        <path d="M14 10l7-7" />
        <path d="M10 14l-7 7" />
      </svg>
    );
  }
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function PiPIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="15" x="2" y="4.5" rx="2" />
      <rect width="8" height="6" x="12" y="11.5" rx="1.5" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}

function SwapIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 3 4 4-4 4" />
      <path d="M20 7H4" />
      <path d="m8 21-4-4 4-4" />
      <path d="M4 17h16" />
    </svg>
  );
}

function ReactionsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" />
      <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" />
    </svg>
  );
}

function PhoneHangupIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 9c-3.5 0-6.7 1.3-9.1 3.5-.6.5-.7 1.4-.2 2l1.6 1.6c.5.5 1.3.6 1.9.2 1.4-.9 3-1.5 4.8-1.8.6-.1 1-.6 1-1.2V11c0-.6-.4-1-1-1zm0 0c.6 0 1 .4 1 1v2.3c0 .6.4 1.1 1 1.2 1.8.3 3.4.9 4.8 1.8.6.4 1.4.3 1.9-.2l1.6-1.6c.5-.6.4-1.5-.2-2C18.7 10.3 15.5 9 12 9z" />
    </svg>
  );
}

function PhoneAnswerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.053 15.053 0 0 1-6.59-6.59l2.2-2.21a.96.96 0 0 0 .25-1A11.36 11.36 0 0 1 8.5 3.97c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-.99-1.09z" />
    </svg>
  );
}

function VoiceWaveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5v14M7 5v14M2 9v6M22 9v6" />
    </svg>
  );
}

function FlipCameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
      <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" />
      <circle cx="12" cy="12" r="3" />
      <path d="m18 22-3-3 3-3" />
      <path d="m6 2 3 3-3 3" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function MoreOptionsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

export default function CallModal() {
  const { user } = useAuth();

  // Call State: null | 'incoming' | 'outgoing' | 'connected'
  const [callState, setCallState] = useState(null);
  // Detailed Call Sub-State State Machine:
  // 'calling' | 'ringing' | 'connecting' | 'connected' | 'reconnecting' | 'declined' | 'no_answer' | 'unavailable' | 'failed'
  const [callSubState, setCallSubState] = useState('calling');
  const [callData, setCallData] = useState(null);
  const [durationSeconds, setDurationSeconds] = useState(0);

  // Ringing and auto-dismiss timer refs
  const ringTimeoutRef = useRef(null);
  const incomingTimeoutRef = useRef(null);
  const autoDismissTimerRef = useRef(null);

  // In-Call Controls
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  // Enhanced Video Calling Features
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSwappedView, setIsSwappedView] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Production WebRTC Hardening States
  const [networkStats, setNetworkStats] = useState(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState(false);
  const [isRemoteVideoMuted, setIsRemoteVideoMuted] = useState(false);
  const [isCameraSwitching, setIsCameraSwitching] = useState(false);

  // Media Stream References
  const callCardRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const audioContextRef = useRef(null);
  const ringToneOscillatorRef = useRef(null);
  const ringToneIntervalRef = useRef(null);
  const durationTimerRef = useRef(null);

  // Unmount cleanup to guarantee zero audio or media leaks
  useEffect(() => {
    return () => {
      stopAllMedia();
    };
  }, []);

  // ==========================================================================
  // Web Audio Ringtone Generator (Phone-Style Cadence: Ring -> Pause -> Repeat)
  // ==========================================================================
  const playSingleRingBurst = (isOutgoing = false) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      // Maintain a clean, active AudioContext
      let ctx = audioContextRef.current;
      if (!ctx || ctx.state === 'closed') {
        ctx = new AudioCtx();
        audioContextRef.current = ctx;
      }
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // Stop previous burst oscillators if still active
      if (ringToneOscillatorRef.current) {
        try {
          const { osc1, osc2 } = ringToneOscillatorRef.current;
          osc1?.stop();
          osc2?.stop();
        } catch {}
        ringToneOscillatorRef.current = null;
      }

      const now = ctx.currentTime;
      const burstDuration = isOutgoing ? 1.4 : 1.6; // 1.6s ring duration

      // Phone dual-tone: 440Hz + 480Hz
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      // Smooth attack and decay envelope to eliminate harsh clicks and droning
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.05);
      gain.gain.setValueAtTime(0.06, now + burstDuration - 0.1);
      gain.gain.linearRampToValueAtTime(0.0001, now + burstDuration);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + burstDuration);
      osc2.stop(now + burstDuration);

      ringToneOscillatorRef.current = { osc1, osc2, gain, ctx };

      // Synchronize phone vibration with ring burst on supported devices (1600ms vibrate, 1800ms silence)
      if (!isOutgoing && typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([1600, 1800]);
        } catch {}
      }
    } catch (err) {
      // AudioContext autoplay restrictions before first user interaction
    }
  };

  const startRingtone = (isOutgoing = false) => {
    // 1. Unconditionally stop any previous ringtone instance and vibration
    stopRingtone();

    // 2. Play first burst immediately
    playSingleRingBurst(isOutgoing);

    // 3. Repeat cadence: Ring (1.6s) -> Pause (1.8s) -> Total Cycle: 3.4s
    const cycleMs = isOutgoing ? 3500 : 3400;
    ringToneIntervalRef.current = setInterval(() => {
      playSingleRingBurst(isOutgoing);
    }, cycleMs);
  };

  const stopRingtone = () => {
    // 1. Clear repeating ring interval
    if (ringToneIntervalRef.current) {
      clearInterval(ringToneIntervalRef.current);
      ringToneIntervalRef.current = null;
    }

    // 2. Terminate active audio nodes & AudioContext
    try {
      if (ringToneOscillatorRef.current) {
        const { osc1, osc2, gain } = ringToneOscillatorRef.current;
        if (gain && audioContextRef.current) {
          try {
            gain.gain.setValueAtTime(0.0001, audioContextRef.current.currentTime);
          } catch {}
        }
        try { osc1?.stop(); } catch {}
        try { osc2?.stop(); } catch {}
        ringToneOscillatorRef.current = null;
      }
    } catch {}

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch {}
      audioContextRef.current = null;
    }

    // 3. Immediately halt any active device vibration
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  };

  const clearAllCallTimers = () => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    if (incomingTimeoutRef.current) {
      clearTimeout(incomingTimeoutRef.current);
      incomingTimeoutRef.current = null;
    }
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  };

  /**
   * Unconditionally stops all media hardware and resets video elements
   */
  const stopAllMedia = () => {
    clearAllCallTimers();
    try {
      stopRingtone();
    } catch (e) {
      console.warn('[CallModal] Error stopping ringtone:', e);
    }

    try {
      webrtcService.endCall();
    } catch (e) {
      console.warn('[CallModal] Error ending WebRTC:', e);
    }

    try {
      if (localVideoRef.current) {
        if (localVideoRef.current.srcObject) {
          try {
            localVideoRef.current.srcObject.getTracks().forEach((t) => {
              try { t.stop(); t.enabled = false; } catch {}
            });
          } catch {}
        }
        localVideoRef.current.srcObject = null;
      }
    } catch {}

    try {
      if (remoteVideoRef.current) {
        if (remoteVideoRef.current.srcObject) {
          try {
            remoteVideoRef.current.srcObject.getTracks().forEach((t) => {
              try { t.stop(); t.enabled = false; } catch {}
            });
          } catch {}
        }
        remoteVideoRef.current.srcObject = null;
      }
    } catch {}

    try {
      if (remoteAudioRef.current) {
        if (remoteAudioRef.current.srcObject) {
          try {
            remoteAudioRef.current.srcObject.getTracks().forEach((t) => {
              try { t.stop(); t.enabled = false; } catch {}
            });
          } catch {}
        }
        remoteAudioRef.current.srcObject = null;
      }
    } catch {}
  };

  // ==========================================================================
  // Socket Signaling Event Listeners
  // ==========================================================================
  useEffect(() => {
    if (!user) return;

    // 1. Incoming Call Event
    const handleIncomingCall = (data) => {
      console.log('📞 [Socket] Incoming call received:', data);
      clearAllCallTimers();
      setCallData({
        callId: data.callId,
        peer: data.caller,
        callType: data.callType || 'audio',
        isInitiator: false
      });
      setCallState('incoming');
      setCallSubState('incoming');
      startRingtone(false);

      // Immediately send explicit delivery acknowledgement so caller transitions from Calling... to Ringing...
      if (data.callId && data.caller?.id) {
        socketService.sendCallRinging(data.callId, data.caller.id);
      }

      // Auto dismiss if caller hangs up or recipient does not answer within 40s
      incomingTimeoutRef.current = setTimeout(() => {
        handleEndCall();
      }, 40000);
    };

    // 1.1 Recipient device delivery acknowledgement
    const handleCallRinging = (data) => {
      console.log('🔔 [Socket] Delivery confirmed by callee device, status -> Ringing:', data);
      setCallSubState('ringing');
    };

    // 1.2 Caller cancelled before callee answered
    const handleCallCancelled = (data) => {
      console.log('🚫 [Socket] Call cancelled by caller:', data);
      stopAllMedia();
      setCallState(null);
      setCallData(null);
    };

    // 1.3 Callee answered or rejected on another device/tab
    const handleCallAnsweredElsewhere = (data) => {
      console.log('📱 [Socket] Call handled on another device:', data);
      stopAllMedia();
      setCallState(null);
      setCallData(null);
    };

    // 2. Call Accepted by Callee (for caller)
    const handleCallAccepted = async (data) => {
      console.log('✅ [Socket] Call accepted by peer:', data);
      clearAllCallTimers();
      stopRingtone();
      setCallState('connected');
      setCallSubState('connecting');
      setConnectionStatus('connecting');

      try {
        const targetUserId = data.calleeId || callData?.peer?.id;
        const callId = data.callId || callData?.callId;
        const callType = callData?.callType || 'audio';
        await webrtcService.startCallAsInitiator(
          targetUserId,
          callId,
          callType
        );
      } catch (err) {
        console.error('Failed to start WebRTC call:', err);
        handleEndCall();
      }
    };

    // 3. Call Rejected / Busy
    const handleCallRejected = (data) => {
      console.log('❌ [Socket] Call rejected by peer:', data);
      clearAllCallTimers();
      stopAllMedia();
      setCallState('outgoing');
      setCallSubState('declined');
      autoDismissTimerRef.current = setTimeout(() => {
        handleEndCall();
      }, 2500);
    };

    // 4. Call Ended
    const handleCallEnded = (data) => {
      console.log('⏹️ [Socket] Call ended by peer:', data?.reason || 'ended');
      handleEndCall();
    };

    // 5. WebRTC SDP Offer Relay
    const handleSignalOffer = async ({ callerId, sdp, callId, callType }) => {
      console.log('📡 [WebRTC] Signal offer received from caller:', callerId, callType);
      const effectiveCallType = callType || callData?.callType || 'audio';
      try {
        setCallData((prev) => (prev ? { ...prev, callType: effectiveCallType } : {
          callId,
          peer: { id: callerId, username: 'Peer' },
          callType: effectiveCallType,
          isInitiator: false
        }));
        await webrtcService.handleIncomingOffer(
          callerId,
          sdp,
          callId,
          effectiveCallType
        );
      } catch (err) {
        console.error('Error handling incoming SDP offer:', err);
      }
    };

    // 6. WebRTC SDP Answer Relay
    const handleSignalAnswer = async ({ sdp }) => {
      console.log('📡 [WebRTC] Signal answer received');
      try {
        await webrtcService.handleIncomingAnswer(sdp);
      } catch (err) {
        console.error('Error handling SDP answer:', err);
      }
    };

    // 7. WebRTC ICE Candidate Relay
    const handleSignalIce = async ({ candidate }) => {
      try {
        await webrtcService.handleIncomingIceCandidate(candidate);
      } catch (err) {
        console.error('Error handling ICE candidate:', err);
      }
    };

    // 8. In-Call Real-Time Emoji Reaction Relay
    const handleRemoteReaction = (data) => {
      if (data?.emoji) {
        addFloatingReaction(data.emoji);
      }
    };

    // 9. Remote ICE Restart Notification
    const handleRemoteIceRestart = async (data) => {
      console.log('🔄 [Socket] Remote peer requested ICE restart:', data);
      await webrtcService.restartIce();
    };

    // 10. Remote Audio / Video Track State Sync
    const handleRemoteTrackState = (data) => {
      setIsRemoteAudioMuted(Boolean(data.audioMuted));
      setIsRemoteVideoMuted(Boolean(data.videoMuted));
    };

    // Global custom event for initiating a call from chat or profile
    const handleCustomInitiateCall = async (event) => {
      clearAllCallTimers();
      const { targetUser, callType } = event.detail;
      const effectiveType = callType || 'audio';
      setCallData({
        peer: targetUser,
        callType: effectiveType,
        isInitiator: true
      });
      setCallState('outgoing');
      setCallSubState('calling'); // Explicitly start at "Calling..."
      setConnectionStatus('connecting');
      startRingtone(true);

      // Ringing timeout (38s)
      ringTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Outgoing call timed out - no answer');
        stopAllMedia();
        setCallState('outgoing');
        setCallSubState('no_answer'); // Show "No answer"
        socketService.sendCallCancel(null, targetUser.id);
        autoDismissTimerRef.current = setTimeout(() => {
          handleEndCall();
        }, 2500);
      }, 38000);

      // Pre-warm local media preview for caller
      try {
        await webrtcService.getLocalMedia(effectiveType);
        if (localVideoRef.current && webrtcService.localStream) {
          localVideoRef.current.srcObject = webrtcService.localStream;
          localVideoRef.current.play().catch(() => {});
        }
      } catch (e) {
        console.warn('Pre-warming camera preview:', e.message);
      }

      socketService.emit('call:initiate', {
        targetUserId: targetUser.id,
        callType: effectiveType
      }, (res) => {
        if (!res.success) {
          stopAllMedia();
          if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
          if (res.reason === 'unavailable') {
            setCallState('outgoing');
            setCallSubState('unavailable'); // Show "User unavailable"
            autoDismissTimerRef.current = setTimeout(() => {
              handleEndCall();
            }, 2500);
          } else {
            alert(res.error || 'Could not initiate call.');
            handleEndCall();
          }
        } else {
          setCallData((prev) => ({ ...prev, callId: res.callId }));
        }
      });
    };

    window.addEventListener('vibegrid:initiate-call', handleCustomInitiateCall);
    socketService.on('call:incoming', handleIncomingCall);
    socketService.on('call:ringing', handleCallRinging);
    socketService.on('call:cancelled', handleCallCancelled);
    socketService.on('call:answered_elsewhere', handleCallAnsweredElsewhere);
    socketService.on('call:accepted', handleCallAccepted);
    socketService.on('call:rejected', handleCallRejected);
    socketService.on('call:ended', handleCallEnded);
    socketService.on('signal:offer', handleSignalOffer);
    socketService.on('signal:answer', handleSignalAnswer);
    socketService.on('signal:ice-candidate', handleSignalIce);
    socketService.on('call:reaction', handleRemoteReaction);
    socketService.on('call:ice-restart', handleRemoteIceRestart);
    socketService.on('call:track-state', handleRemoteTrackState);

    return () => {
      window.removeEventListener('vibegrid:initiate-call', handleCustomInitiateCall);
      socketService.off('call:incoming', handleIncomingCall);
      socketService.off('call:ringing', handleCallRinging);
      socketService.off('call:cancelled', handleCallCancelled);
      socketService.off('call:answered_elsewhere', handleCallAnsweredElsewhere);
      socketService.off('call:accepted', handleCallAccepted);
      socketService.off('call:rejected', handleCallRejected);
      socketService.off('call:ended', handleCallEnded);
      socketService.off('signal:offer', handleSignalOffer);
      socketService.off('signal:answer', handleSignalAnswer);
      socketService.off('signal:ice-candidate', handleSignalIce);
      socketService.off('call:reaction', handleRemoteReaction);
      socketService.off('call:ice-restart', handleRemoteIceRestart);
      socketService.off('call:track-state', handleRemoteTrackState);
    };
  }, [user, callData]);

  // ==========================================================================
  // Attach Media Streams to HTML Video & Audio Elements
  // ==========================================================================
  useEffect(() => {
    const bindStreams = () => {
      if (localVideoRef.current && webrtcService.localStream) {
        if (localVideoRef.current.srcObject !== webrtcService.localStream) {
          localVideoRef.current.srcObject = webrtcService.localStream;
        }
        localVideoRef.current.play().catch(() => {});
      }

      if (webrtcService.remoteStream) {
        const vTracks = webrtcService.remoteStream.getVideoTracks();
        if (vTracks && vTracks.length > 0) {
          setHasRemoteVideo(true);
        }

        if (remoteVideoRef.current) {
          if (remoteVideoRef.current.srcObject !== webrtcService.remoteStream) {
            remoteVideoRef.current.srcObject = webrtcService.remoteStream;
          }
          remoteVideoRef.current.muted = true;
          remoteVideoRef.current.play().catch((e) => console.debug('Video play error:', e));
        }
        if (remoteAudioRef.current) {
          if (remoteAudioRef.current.srcObject !== webrtcService.remoteStream) {
            remoteAudioRef.current.srcObject = webrtcService.remoteStream;
          }
          remoteAudioRef.current.muted = isSpeakerMuted;
          if (!isSpeakerMuted) {
            remoteAudioRef.current.play().catch((e) => console.debug('Audio play error:', e));
          }
        }
      }
    };

    webrtcService.onLocalStream = (stream) => {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream || null;
        if (stream) {
          localVideoRef.current.play().catch(() => {});
        }
      }
    };

    webrtcService.onRemoteStream = (stream) => {
      console.log('📺 [CallModal] Remote stream received:', stream);
      if (!stream) {
        setHasRemoteVideo(false);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
        return;
      }

      const vTracks = stream.getVideoTracks ? stream.getVideoTracks() : [];
      if (vTracks && vTracks.length > 0) {
        setHasRemoteVideo(true);
      }
      setConnectionStatus('connected');

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.muted = true;
        remoteVideoRef.current.play().catch((e) => console.debug('Remote video play error:', e));
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.muted = isSpeakerMuted;
        if (!isSpeakerMuted) {
          remoteAudioRef.current.play().catch((e) => console.debug('Remote audio play error:', e));
        }
      }
    };

    webrtcService.onConnectionStateChange = (state) => {
      console.log('🔄 [CallModal] WebRTC connection state:', state);
      setConnectionStatus(state);
      if (state === 'connected' || state === 'completed') {
        setCallSubState('connected');
        setTimeout(bindStreams, 50);
      } else if (state === 'reconnecting') {
        setCallSubState('reconnecting');
      } else if (state === 'failed' || state === 'closed') {
        stopRingtone();
        if (state === 'failed') {
          setCallSubState('failed');
          autoDismissTimerRef.current = setTimeout(() => {
            handleEndCall();
          }, 2500);
          return;
        }
        handleEndCall();
      }
    };

    // Check if peer connection or remote tracks are already established
    if (webrtcService.peerConnection) {
      const pc = webrtcService.peerConnection;
      if (
        pc.connectionState === 'connected' ||
        pc.iceConnectionState === 'connected' ||
        pc.iceConnectionState === 'completed'
      ) {
        setConnectionStatus('connected');
      }
    }

    webrtcService.onNetworkStats = (metrics) => {
      setNetworkStats(metrics);
    };

    bindStreams();

    return () => {
      webrtcService.onLocalStream = null;
      webrtcService.onRemoteStream = null;
      webrtcService.onConnectionStateChange = null;
      webrtcService.onNetworkStats = null;
    };
  }, [callState]);

  // Screen Wake Lock (Prevent display sleep on mobile during active calls)
  useEffect(() => {
    let wakeLock = null;
    if (callState === 'connected' && 'wakeLock' in navigator) {
      navigator.wakeLock.request('screen')
        .then((wl) => { wakeLock = wl; })
        .catch(() => {});
    }
    return () => {
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [callState]);

  // Synchronize media stream attachments across view swaps and track changes
  useEffect(() => {
    if (callState === 'connected') {
      if (localVideoRef.current && webrtcService.localStream) {
        if (localVideoRef.current.srcObject !== webrtcService.localStream) {
          localVideoRef.current.srcObject = webrtcService.localStream;
        }
        localVideoRef.current.play().catch(() => {});
      }
      if (remoteVideoRef.current && webrtcService.remoteStream) {
        if (remoteVideoRef.current.srcObject !== webrtcService.remoteStream) {
          remoteVideoRef.current.srcObject = webrtcService.remoteStream;
        }
        remoteVideoRef.current.muted = true;
        remoteVideoRef.current.play().catch(() => {});
      }
      if (remoteAudioRef.current && webrtcService.remoteStream) {
        if (remoteAudioRef.current.srcObject !== webrtcService.remoteStream) {
          remoteAudioRef.current.srcObject = webrtcService.remoteStream;
        }
        remoteAudioRef.current.muted = isSpeakerMuted;
        if (!isSpeakerMuted) {
          remoteAudioRef.current.play().catch(() => {});
        }
      }
    }
  }, [callState, isSwappedView, hasRemoteVideo, isSpeakerMuted]);

  // Duration Timer (Only increments when call is genuinely connected)
  useEffect(() => {
    if (callState === 'connected' && (connectionStatus === 'connected' || connectionStatus === 'completed')) {
      durationTimerRef.current = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      if (callState !== 'connected') {
        setDurationSeconds(0);
      }
    }
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [callState, connectionStatus]);

  // Consolidated live status for the active call
  const isLive =
    callState === 'connected' &&
    (connectionStatus === 'connected' || connectionStatus === 'completed');

  // Window unload / pagehide listeners to stop camera if tab is closed or navigated
  useEffect(() => {
    const handleUnload = () => {
      stopAllMedia();
      if (callData?.callId && callData?.peer?.id) {
        socketService.emit('call:end', {
          callId: callData.callId,
          targetUserId: callData.peer.id
        });
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [callData]);

  // Fullscreen event listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Keyboard Shortcuts (F = Fullscreen, M = Mute, V = Camera, Esc = Close popup)
  useEffect(() => {
    if (callState !== 'connected') return;

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleMute();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        handleToggleVideo();
      } else if (e.key === 'Escape') {
        if (showReactions) setShowReactions(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callState, showReactions, isAudioMuted, isVideoMuted]);

  // Format timer
  const formatDuration = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // Floating Reaction Particle Generator
  const addFloatingReaction = (emoji) => {
    const id = Date.now() + Math.random();
    const xPos = 25 + Math.random() * 50; // 25% to 75% across screen
    setFloatingReactions((prev) => [...prev, { id, emoji, xPos }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2400);
  };

  const handleSendReaction = (emoji) => {
    addFloatingReaction(emoji);
    setShowReactions(false);
    if (callData?.callId) {
      socketService.emit('call:reaction', {
        targetUserId: callData.peer?.id,
        callId: callData.callId,
        emoji
      });
    }
  };

  // Fullscreen Toggle
  const toggleFullscreen = async () => {
    try {
      const card = callCardRef.current;
      if (!document.fullscreenElement) {
        if (card?.requestFullscreen) {
          await card.requestFullscreen();
        } else if (card?.webkitRequestFullscreen) {
          await card.webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen API error, falling back to viewport expand mode:', err);
      setIsMaximized((prev) => !prev);
    }
  };

  // Picture-in-Picture Toggle
  const togglePictureInPicture = async () => {
    try {
      const activeVideo = isSwappedView ? localVideoRef.current : remoteVideoRef.current;
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (activeVideo && document.pictureInPictureEnabled) {
        await activeVideo.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  };

  // Swap Feeds (Corner PiP <-> Main Stage)
  const handleSwapFeeds = () => {
    setIsSwappedView((prev) => !prev);
  };

  // Toggle Speaker / Output Mute
  const handleToggleSpeaker = () => {
    const nextMuted = !isSpeakerMuted;

    // 1. Mute or pause the dedicated remote audio tag
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = nextMuted;
      if (nextMuted) {
        remoteAudioRef.current.pause();
      } else {
        remoteAudioRef.current.play().catch(() => {});
      }
    }

    // 2. Ensure remote video element is always muted to eliminate audio leakage
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = true;
    }

    // 3. Disable/enable audio tracks directly on the remote MediaStream
    if (webrtcService.remoteStream) {
      webrtcService.remoteStream.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }

    setIsSpeakerMuted(nextMuted);
  };

  // ==========================================================================
  // Action Handlers
  // ==========================================================================
  const handleAcceptCall = async () => {
    stopRingtone();
    setCallState('connected');

    // Pre-acquire callee media so local camera/mic is active immediately
    try {
      await webrtcService.getLocalMedia(callData?.callType || 'audio');
      if (localVideoRef.current && webrtcService.localStream) {
        localVideoRef.current.srcObject = webrtcService.localStream;
        localVideoRef.current.play().catch(() => {});
      }
    } catch (e) {
      console.warn('Pre-acquiring callee media error:', e.message);
    }

    socketService.emit('call:accept', {
      callId: callData.callId,
      callerId: callData.peer.id
    });
  };

  const handleDeclineCall = () => {
    stopAllMedia();
    socketService.emit('call:reject', {
      callId: callData?.callId,
      callerId: callData?.peer?.id,
      reason: 'declined'
    });
    setCallState(null);
    setCallData(null);
    setConnectionStatus('connecting');
  };

  const handleCancelOutgoingCall = () => {
    clearAllCallTimers();
    if (callData?.peer?.id) {
      socketService.sendCallCancel(callData.callId, callData.peer.id);
    }
    handleEndCall();
  };

  const handleEndCall = () => {
    clearAllCallTimers();
    console.log('⏹️ [CallModal] handleEndCall: Dismissing call modal and stopping media');

    // 1. Snapshot call parameters before wiping state
    const currentCallId = callData?.callId;
    const currentPeerId = callData?.peer?.id;

    // 2. Immediately unmount modal and reset states so user can NEVER get stuck on call screen
    setCallState(null);
    setCallData(null);
    setConnectionStatus('connecting');
    setDurationSeconds(0);
    setIsAudioMuted(false);
    setIsVideoMuted(false);
    setIsScreenSharing(false);
    setIsFullscreen(false);
    setIsMaximized(false);
    setIsSwappedView(false);
    setShowReactions(false);
    setShowDiagnostics(false);
    setShowMoreMenu(false);
    setHasRemoteVideo(false);

    // 3. Clear call timer
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    // 4. Send socket signal to peer & server
    if (currentCallId) {
      try {
        socketService.emit('call:end', {
          callId: currentCallId,
          targetUserId: currentPeerId
        });
      } catch (e) {
        console.warn('[CallModal] socket emit call:end error:', e);
      }
    }

    // 5. Cleanly stop all media and release camera/mic hardware
    try {
      stopAllMedia();
    } catch (e) {
      console.warn('[CallModal] stopAllMedia error:', e);
    }
  };

  const handleToggleMute = () => {
    const isMutedNow = !isAudioMuted;
    webrtcService.toggleAudio(!isMutedNow);
    setIsAudioMuted(isMutedNow);

    if (callData?.peer?.id) {
      socketService.emit('call:track-state', {
        targetUserId: callData.peer.id,
        callId: callData.callId,
        audioMuted: isMutedNow,
        videoMuted: isVideoMuted
      });
    }
  };

  const handleToggleVideo = () => {
    const isVideoOff = !isVideoMuted;
    webrtcService.toggleVideo(!isVideoOff);
    setIsVideoMuted(isVideoOff);

    if (callData?.peer?.id) {
      socketService.emit('call:track-state', {
        targetUserId: callData.peer.id,
        callId: callData.callId,
        audioMuted: isAudioMuted,
        videoMuted: isVideoOff
      });
    }
  };

  const handleSwitchCamera = async () => {
    if (isCameraSwitching) return;
    setIsCameraSwitching(true);
    try {
      await webrtcService.switchCamera();
      if (localVideoRef.current && webrtcService.localStream) {
        localVideoRef.current.srcObject = webrtcService.localStream;
        localVideoRef.current.play().catch(() => {});
      }
    } finally {
      setTimeout(() => setIsCameraSwitching(false), 500);
    }
  };

  const handleToggleScreenShare = async () => {
    const active = await webrtcService.toggleScreenShare();
    setIsScreenSharing(active);
  };

  if (!callState || !callData) return null;

  const isVideoMode = callData?.callType === 'video' || isScreenSharing;
  const isExpanded = (isFullscreen || isMaximized) && isVideoMode;

  return (
    <div className={`webrtc-call-overlay ${isExpanded ? 'fullscreen-overlay' : ''}`}>
      <div 
        ref={callCardRef} 
        className={`webrtc-call-card ${isVideoMode ? 'video-mode' : 'audio-mode'} ${isExpanded ? 'is-fullscreen' : ''}`}
      >
        {/* ================================================================ */}
        {/* State 1: Incoming Call                                           */}
        {/* ================================================================ */}
        {callState === 'incoming' && (
          <div className="call-incoming-view">
            <div className="call-avatar-pulse-container">
              <img
                src={callData.peer?.avatar_url || '/uploads/avatars/default-avatar.png'}
                alt={callData.peer?.username}
                className="call-avatar-img"
              />
              <span className="pulse-ring ring-1"></span>
              <span className="pulse-ring ring-2"></span>
              <span className="pulse-ring ring-3"></span>
            </div>

            <h3 className="call-peer-name">@{callData.peer?.username}</h3>
            <p className="call-status-label">
              Incoming {callData.callType === 'video' ? 'Video' : 'Voice'} Call...
            </p>

            <div className="call-actions-row">
              <button
                type="button"
                className="call-btn btn-decline"
                onClick={handleDeclineCall}
                title="Decline Call"
                aria-label="Decline Call"
              >
                <PhoneHangupIcon />
              </button>
              <button
                type="button"
                className="call-btn btn-accept"
                onClick={handleAcceptCall}
                title="Accept Call"
                aria-label="Accept Call"
              >
                <PhoneAnswerIcon />
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* State 2: Outgoing Calling                                        */}
        {/* ================================================================ */}
        {callState === 'outgoing' && (
          <div className="call-outgoing-view">
            <div className="call-avatar-pulse-container">
              <img
                src={callData.peer?.avatar_url || '/uploads/avatars/default-avatar.png'}
                alt={callData.peer?.username}
                className="call-avatar-img"
              />
              {!['declined', 'no_answer', 'unavailable', 'failed'].includes(callSubState) && (
                <>
                  <span className="pulse-ring ring-1"></span>
                  <span className="pulse-ring ring-2"></span>
                </>
              )}
            </div>

            <h3 className="call-peer-name">{callData.peer?.full_name || `@${callData.peer?.username}`}</h3>
            {callData.peer?.full_name && (
              <span className="call-peer-subhandle">@{callData.peer?.username}</span>
            )}
            <p className={`call-status-label status-${callSubState}`}>
              {callSubState === 'calling' && 'Calling...'}
              {callSubState === 'ringing' && 'Ringing...'}
              {callSubState === 'connecting' && 'Connecting...'}
              {callSubState === 'declined' && 'Call declined'}
              {callSubState === 'no_answer' && 'No answer'}
              {callSubState === 'unavailable' && 'User unavailable'}
              {callSubState === 'failed' && 'Call failed'}
            </p>

            {!['declined', 'no_answer', 'unavailable', 'failed'].includes(callSubState) && (
              <div className="call-actions-row">
                <button
                  type="button"
                  className="call-btn btn-decline"
                  onClick={handleCancelOutgoingCall}
                  title="Cancel Call"
                  aria-label="Cancel Call"
                >
                  <PhoneHangupIcon />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* State 3: Active Connected Call                                   */}
        {/* ================================================================ */}
        {callState === 'connected' && (
          <div className={`call-connected-view ${isVideoMode ? 'video-connected-view' : 'audio-connected-view'}`}>
            {/* Top Header Bar with Live Badge, User Info, Quality, and Fullscreen Controls */}
            <div className="call-header-bar">
              <div className="call-header-info">
                <span className={`call-live-badge ${connectionStatus === 'reconnecting' ? 'status-reconnecting' : (isLive ? 'status-connected' : 'status-connecting')}`}>
                  <span className="live-pulsing-dot" />
                  {connectionStatus === 'reconnecting' ? 'RECONNECTING...' : (isLive ? 'LIVE' : 'CONNECTING...')}
                </span>
                <span className="call-peer-title">@{callData.peer?.username}</span>
                <span className="call-timer">{formatDuration(durationSeconds)}</span>
              </div>

              <div className="call-header-badges">
                {/* E2EE Security Badge */}
                <div className="call-badge-chip" title="Call audio & video are end-to-end encrypted">
                  <span className="badge-chip-icon">🔒</span>
                  <span>E2EE</span>
                </div>

                {/* Connection Quality Indicator */}
                <div
                  className={`call-badge-chip quality-chip ${networkStats?.qualityScore || 'excellent'}`}
                  title={`Connection: ${networkStats?.qualityScore ? networkStats.qualityScore.toUpperCase() : 'HD'} (Click to toggle diagnostics)`}
                  onClick={() => setShowDiagnostics((prev) => !prev)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="signal-bars">
                    <span className={`bar bar-1 ${networkStats?.qualityScore === 'poor' ? 'bar-danger' : ''}`} />
                    <span className={`bar bar-2 ${networkStats?.qualityScore === 'poor' ? 'bar-inactive' : (networkStats?.qualityScore === 'good' ? 'bar-warning' : '')}`} />
                    <span className={`bar bar-3 ${networkStats?.qualityScore !== 'excellent' ? 'bar-inactive' : ''}`} />
                  </span>
                  <span>{networkStats?.qualityScore === 'poor' ? 'Poor' : networkStats?.qualityScore === 'good' ? 'Good' : 'HD'}</span>
                </div>

                {/* Picture in Picture Button (Video Call Only) */}
                {isVideoMode && (
                  <button
                    type="button"
                    className="call-header-icon-btn"
                    onClick={togglePictureInPicture}
                    title="Picture in Picture"
                    aria-label="Picture in Picture"
                  >
                    <PiPIcon />
                  </button>
                )}

                {/* Fullscreen Button (Video Call Only) */}
                {isVideoMode && (
                  <button
                    type="button"
                    className={`call-header-icon-btn ${isFullscreen ? 'active' : ''}`}
                    onClick={toggleFullscreen}
                    title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                    aria-label="Toggle Fullscreen"
                  >
                    <FullscreenIcon isFullscreen={isFullscreen} />
                  </button>
                )}
              </div>
            </div>

            {/* Dedicated Audio Tag for Remote Voice */}
            <audio ref={remoteAudioRef} autoPlay playsInline />

            {/* STAGE: Dedicated Audio Call Stage vs Video Call Stage */}
            {!isVideoMode ? (
              /* DEDICATED AUDIO CALL STAGE */
              <div className="audio-call-stage">
                <div className="audio-call-hero-container">
                  <div className="audio-hero-pulse-ring ring-1" />
                  <div className="audio-hero-pulse-ring ring-2" />
                  <div className="audio-hero-pulse-ring ring-3" />
                  <img
                    src={callData.peer?.avatar_url || '/uploads/avatars/default-avatar.png'}
                    alt={callData.peer?.username}
                    className="audio-hero-avatar"
                  />
                  <div className="audio-hero-badge-icon">
                    <VoiceWaveIcon />
                  </div>
                </div>

                <div className="audio-call-meta">
                  <h3 className="audio-hero-name">{callData.peer?.full_name || `@${callData.peer?.username}`}</h3>
                  <span className="audio-hero-handle">@{callData.peer?.username}</span>
                  <p className="audio-hero-status">
                    {isSpeakerMuted ? '🔇 Audio Muted' : 'Voice connected · Encrypted'}
                  </p>
                </div>

                {/* In-Call Floating Animated Emoji Reactions */}
                {floatingReactions.map((r) => (
                  <div
                    key={r.id}
                    className="floating-reaction-item"
                    style={{ left: `${r.xPos}%` }}
                  >
                    {r.emoji}
                  </div>
                ))}
              </div>
            ) : (
              /* DEDICATED VIDEO CALL STAGE */
              <div className="call-remote-screen">
                {/* Primary Video Element */}
                {!isSwappedView ? (
                  <video
                    key="main-remote-video"
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`remote-video-elem ${hasRemoteVideo || isScreenSharing ? 'visible' : 'hidden'}`}
                  />
                ) : (
                  <video
                    key="main-local-video"
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`remote-video-elem mirrored ${isVideoMuted ? 'muted-video' : ''}`}
                  />
                )}

                {/* Camera Off Placeholder on Main Screen */}
                {((!isSwappedView && !hasRemoteVideo && !isScreenSharing) || 
                  (isSwappedView && isVideoMuted)) && (
                  <div className="audio-call-placeholder">
                    <div className="audio-avatar-wrapper">
                      <img
                        src={(!isSwappedView ? callData.peer?.avatar_url : user?.avatar_url) || '/uploads/avatars/default-avatar.png'}
                        alt=""
                        className="audio-call-avatar"
                      />
                      <div className="audio-voice-wave" />
                    </div>
                    <h4>{isSwappedView ? `@${user?.username} (You)` : `@${callData.peer?.username}`}</h4>
                    <p className="audio-call-status-hint">
                      {isSwappedView 
                        ? 'Your camera is turned off' 
                        : (isLive ? 'Camera turned off' : 'Connecting video...')}
                    </p>
                  </div>
                )}

                {/* In-Call Floating Animated Emoji Reactions */}
                {floatingReactions.map((r) => (
                  <div
                    key={r.id}
                    className="floating-reaction-item"
                    style={{ left: `${r.xPos}%` }}
                  >
                    {r.emoji}
                  </div>
                ))}
              </div>
            )}

            {/* Secondary Floating Corner PIP (ONLY IN VIDEO CALLS) */}
            {isVideoMode && (
              <div 
                className="call-local-pip"
                onClick={handleSwapFeeds}
                title="Click to swap view"
                role="button"
                tabIndex={0}
              >
                {!isSwappedView ? (
                  <video
                    key="pip-local-video"
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`pip-video-elem mirrored ${isVideoMuted ? 'muted-video' : ''}`}
                  />
                ) : (
                  <video
                    key="pip-remote-video"
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`pip-video-elem ${!hasRemoteVideo ? 'hidden' : ''}`}
                  />
                )}

                <div className="call-pip-swap-indicator">
                  <SwapIcon />
                  <span>Swap</span>
                </div>

                {((!isSwappedView && isVideoMuted) || (isSwappedView && !hasRemoteVideo)) && (
                  <div className="pip-video-off-label">
                    <span>Camera Off</span>
                  </div>
                )}
              </div>
            )}

            {/* Floating Reactions Popover Dock */}
            {showReactions && (
              <div className="call-reactions-popover" role="dialog" aria-label="Reactions">
                {['❤️', '👏', '🔥', '😂', '🎉', '✋'].map((em) => (
                  <button
                    key={em}
                    type="button"
                    className="reaction-emoji-btn"
                    onClick={() => handleSendReaction(em)}
                    title={`Send ${em}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}

            {/* Kebab Popover Menu (Secondary Call Options) */}
            {showMoreMenu && (
              <div className="call-more-menu-popover" role="dialog" aria-label="More call options">
                {/* Speaker Mute/Unmute */}
                <button
                  type="button"
                  className={`more-menu-item ${isSpeakerMuted ? 'active-danger' : ''}`}
                  onClick={() => {
                    handleToggleSpeaker();
                    setShowMoreMenu(false);
                  }}
                >
                  <SpeakerIcon muted={isSpeakerMuted} />
                  <span>{isSpeakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}</span>
                </button>

                {/* Screen Sharing (VIDEO ONLY) */}
                {isVideoMode && (
                  <button
                    type="button"
                    className={`more-menu-item ${isScreenSharing ? 'active' : ''}`}
                    onClick={() => {
                      handleToggleScreenShare();
                      setShowMoreMenu(false);
                    }}
                  >
                    <ScreenShareIcon active={isScreenSharing} />
                    <span>{isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}</span>
                  </button>
                )}

                {/* Swap Feeds (VIDEO ONLY) */}
                {isVideoMode && (
                  <button
                    type="button"
                    className={`more-menu-item ${isSwappedView ? 'active' : ''}`}
                    onClick={() => {
                      handleSwapFeeds();
                      setShowMoreMenu(false);
                    }}
                  >
                    <SwapIcon />
                    <span>Swap Feeds</span>
                  </button>
                )}

                {/* Reactions */}
                <button
                  type="button"
                  className="more-menu-item"
                  onClick={() => {
                    setShowReactions((prev) => !prev);
                    setShowMoreMenu(false);
                  }}
                >
                  <ReactionsIcon />
                  <span>Send Reactions</span>
                </button>

                {/* Fullscreen Toggle (VIDEO ONLY) */}
                {isVideoMode && (
                  <button
                    type="button"
                    className={`more-menu-item ${isFullscreen ? 'active' : ''}`}
                    onClick={() => {
                      toggleFullscreen();
                      setShowMoreMenu(false);
                    }}
                  >
                    <FullscreenIcon isFullscreen={isFullscreen} />
                    <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                  </button>
                )}

                {/* Network Diagnostics */}
                <button
                  type="button"
                  className={`more-menu-item ${showDiagnostics ? 'active' : ''}`}
                  onClick={() => {
                    setShowDiagnostics((prev) => !prev);
                    setShowMoreMenu(false);
                  }}
                >
                  <ActivityIcon />
                  <span>Network Diagnostics</span>
                </button>
              </div>
            )}

            {/* Streamlined Glassmorphic Floating Control Dock */}
            <div className={`call-controls-toolbar ${!isVideoMode ? 'audio-toolbar' : ''}`}>
              {/* 1. Mute Microphone */}
              <button
                type="button"
                className={`control-btn ${isAudioMuted ? 'active-danger' : ''}`}
                onClick={handleToggleMute}
                title={isAudioMuted ? 'Unmute Microphone (M)' : 'Mute Microphone (M)'}
                aria-label="Microphone"
              >
                <MicIcon muted={isAudioMuted} />
              </button>

              {/* 2. Turn Camera On / Off (VIDEO ONLY) */}
              {isVideoMode && (
                <button
                  type="button"
                  className={`control-btn ${isVideoMuted ? 'active-danger' : ''}`}
                  onClick={handleToggleVideo}
                  title={isVideoMuted ? 'Turn Camera On (V)' : 'Turn Camera Off (V)'}
                  aria-label="Camera"
                >
                  <VideoCamIcon off={isVideoMuted} />
                </button>
              )}

              {/* 3. Flip Camera (VIDEO ONLY, mobile friendly) */}
              {isVideoMode && !isScreenSharing && (
                <button
                  type="button"
                  className={`control-btn ${isCameraSwitching ? 'spinning' : ''}`}
                  onClick={handleSwitchCamera}
                  disabled={isCameraSwitching}
                  title="Flip Camera (Front/Back)"
                  aria-label="Flip Camera"
                >
                  <FlipCameraIcon />
                </button>
              )}

              {/* 4. More Options Kebab (•••) */}
              <button
                type="button"
                className={`control-btn ${showMoreMenu ? 'active-primary' : ''}`}
                onClick={() => setShowMoreMenu((prev) => !prev)}
                title="More Options"
                aria-label="More Options"
              >
                <MoreOptionsIcon />
              </button>

              {/* 5. End Call Hangup Pill */}
              <button
                type="button"
                className="control-btn btn-end-call"
                onClick={handleEndCall}
                title="Leave Call"
                aria-label="Leave Call"
              >
                <PhoneHangupIcon />
                <span className="btn-end-call-label">Leave</span>
              </button>
            </div>

            {/* Interactive Diagnostics Overlay Panel */}
            {showDiagnostics && (
              <div className="call-diagnostics-panel" role="dialog" aria-label="Call Diagnostics">
                <div className="diag-header">
                  <div className="diag-title">
                    <ActivityIcon />
                    <span>Real-time Network Diagnostics</span>
                  </div>
                  <button
                    type="button"
                    className="diag-close-btn"
                    onClick={() => setShowDiagnostics(false)}
                    aria-label="Close Diagnostics"
                  >
                    ×
                  </button>
                </div>
                <div className="diagnostics-grid">
                  <div className="diag-item">
                    <span className="diag-label">ICE Route</span>
                    <span className={`diag-val ${networkStats?.transportType?.includes('Relay') ? 'val-warning' : 'val-success'}`}>
                      {networkStats?.transportType || 'Probing...'}
                    </span>
                  </div>
                  <div className="diag-item">
                    <span className="diag-label">Round Trip (RTT)</span>
                    <span className="diag-val">{networkStats?.rtt !== undefined ? `${networkStats.rtt} ms` : 'Measuring...'}</span>
                  </div>
                  <div className="diag-item">
                    <span className="diag-label">Packet Loss</span>
                    <span className={`diag-val ${(networkStats?.packetLoss || 0) > 2 ? 'val-danger' : 'val-success'}`}>
                      {networkStats?.packetLoss !== undefined ? `${networkStats.packetLoss}%` : '0%'}
                    </span>
                  </div>
                  <div className="diag-item">
                    <span className="diag-label">Audio Jitter</span>
                    <span className="diag-val">{networkStats?.jitter !== undefined ? `${networkStats.jitter} ms` : '0 ms'}</span>
                  </div>
                  <div className="diag-item">
                    <span className="diag-label">Bitrate (In / Out)</span>
                    <span className="diag-val">{networkStats ? `↓ ${networkStats.inboundBitrate} / ↑ ${networkStats.outboundBitrate} kbps` : 'Calculating...'}</span>
                  </div>
                  <div className="diag-item">
                    <span className="diag-label">Resolution & FPS</span>
                    <span className="diag-val">{networkStats?.resolution || (isVideoMode ? '720p HD' : 'VoIP')} @ {networkStats?.fps || (isVideoMode ? 30 : 0)} fps</span>
                  </div>
                </div>
                <div className="diag-actions">
                  <button
                    type="button"
                    className="diag-restart-btn"
                    onClick={() => webrtcService.restartIce()}
                  >
                    🔄 Force ICE Restart
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Embedded CSS for Call Modal */}
      <style>{`
        .webrtc-call-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(8, 10, 15, 0.85);
          backdrop-filter: blur(16px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          transition: background 0.3s ease;
        }

        .webrtc-call-overlay.fullscreen-overlay {
          padding: 0;
          background: #000000;
        }

        .webrtc-call-card {
          width: 100%;
          max-width: 680px;
          background: #111318;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 24px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05);
          overflow: hidden;
          color: #ffffff;
          position: relative;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .webrtc-call-card.audio-mode {
          max-width: 440px;
          border-radius: 28px;
          background: #0f1117;
          border-color: rgba(99, 102, 241, 0.25);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(99, 102, 241, 0.2);
        }

        .webrtc-call-card.video-mode {
          max-width: 900px;
        }

        .webrtc-call-card.is-fullscreen {
          width: 100vw;
          max-width: 100vw;
          height: 100vh;
          max-height: 100vh;
          border-radius: 0;
          border: none;
          box-shadow: none;
        }

        /* ================================================================ */
        /* Incoming & Outgoing Styles                                       */
        /* ================================================================ */
        .call-incoming-view,
        .call-outgoing-view {
          padding: 50px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          background: radial-gradient(circle at center, #1e2230 0%, #111318 100%);
        }

        .call-avatar-pulse-container {
          position: relative;
          width: 130px;
          height: 130px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .call-avatar-img {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          object-fit: cover;
          border: 3.5px solid #6366f1;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
          z-index: 3;
        }

        .pulse-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid #6366f1;
          animation: pulseWave 2.4s infinite cubic-bezier(0.25, 1, 0.5, 1);
          opacity: 0.6;
        }

        .pulse-ring.ring-2 {
          animation-delay: 0.8s;
        }

        .pulse-ring.ring-3 {
          animation-delay: 1.6s;
        }

        @keyframes pulseWave {
          0% { transform: scale(0.75); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }

        .call-peer-name {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.4px;
          margin: 0 0 4px 0;
        }

        .call-peer-subhandle {
          font-size: 13px;
          font-weight: 600;
          color: #94a3b8;
          margin: 0 0 10px 0;
          display: block;
        }

        .call-status-label {
          color: #94a3b8;
          font-size: 15px;
          font-weight: 500;
          margin: 0 0 36px 0;
          transition: color 0.2s ease;
        }

        .call-status-label.status-ringing {
          color: #10b981;
          font-weight: 600;
        }

        .call-status-label.status-calling,
        .call-status-label.status-connecting {
          color: #60a5fa;
          font-weight: 600;
        }

        .call-status-label.status-declined,
        .call-status-label.status-no_answer,
        .call-status-label.status-unavailable,
        .call-status-label.status-failed {
          color: #ef4444;
          font-weight: 700;
        }

        .call-actions-row {
          display: flex;
          gap: 36px;
        }

        .call-btn {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, filter 0.15s ease;
        }

        .call-btn:hover {
          transform: scale(1.12);
        }

        .call-btn:active {
          transform: scale(0.95);
        }

        .btn-accept {
          background: linear-gradient(135deg, #10b981, #059669);
          color: #ffffff;
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.45);
        }

        .btn-decline {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: #ffffff;
          box-shadow: 0 8px 24px rgba(239, 68, 68, 0.45);
        }

        /* ================================================================ */
        /* Connected Call View                                              */
        /* ================================================================ */
        .call-connected-view {
          position: relative;
          height: 520px;
          display: flex;
          flex-direction: column;
          background: #000000;
          overflow: hidden;
        }

        .call-connected-view.audio-connected-view {
          height: 480px;
          background: radial-gradient(circle at top, #1e1b4b 0%, #0d0f17 65%, #07080c 100%);
        }

        .call-connected-view.video-connected-view {
          height: 560px;
          background: #000000;
        }

        .webrtc-call-card.is-fullscreen .call-connected-view {
          height: 100vh;
        }

        /* Top Header Bar */
        .call-header-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: linear-gradient(180deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 100%);
          z-index: 50;
        }

        .call-header-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .call-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(245, 158, 11, 0.2);
          border: 1px solid rgba(245, 158, 11, 0.4);
          color: #f59e0b;
          font-size: 11px;
          font-weight: 800;
          padding: 3px 9px;
          border-radius: 9999px;
          letter-spacing: 0.5px;
        }

        .call-live-badge.status-connected,
        .call-live-badge.status-completed {
          background: rgba(16, 185, 129, 0.2);
          border-color: rgba(16, 185, 129, 0.4);
          color: #10b981;
        }

        .live-pulsing-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
          animation: dotPulse 1.6s infinite ease-in-out;
        }

        @keyframes dotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }

        .call-peer-title {
          font-weight: 700;
          font-size: 15px;
          color: #ffffff;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
        }

        .call-timer {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 14px;
          font-weight: 600;
          color: #cbd5e1;
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 8px;
          border-radius: 6px;
          backdrop-filter: blur(4px);
        }

        .call-header-badges {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .call-badge-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          backdrop-filter: blur(8px);
        }

        .quality-chip {
          color: #10b981;
          transition: all 0.2s ease;
        }

        .quality-chip.excellent {
          color: #10b981;
          border-color: rgba(16, 185, 129, 0.3);
        }

        .quality-chip.good {
          color: #f59e0b;
          border-color: rgba(245, 158, 11, 0.3);
        }

        .quality-chip.poor {
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.3);
        }

        .signal-bars {
          display: inline-flex;
          align-items: flex-end;
          gap: 2px;
          height: 11px;
        }

        .signal-bars .bar {
          width: 2.5px;
          background: #10b981;
          border-radius: 1px;
          transition: background 0.2s ease;
        }

        .signal-bars .bar-1 { height: 4px; }
        .signal-bars .bar-2 { height: 7px; }
        .signal-bars .bar-3 { height: 11px; }

        .signal-bars .bar.bar-warning { background: #f59e0b; }
        .signal-bars .bar.bar-danger { background: #ef4444; }
        .signal-bars .bar.bar-inactive { background: rgba(255, 255, 255, 0.2); }

        .call-header-icon-btn {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #ffffff;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          backdrop-filter: blur(8px);
        }

        .call-header-icon-btn:hover {
          background: rgba(255, 255, 255, 0.18);
          transform: scale(1.06);
        }

        .call-header-icon-btn.active {
          background: #6366f1;
          border-color: #6366f1;
        }

        /* ================================================================ */
        /* Dedicated Audio Call Stage                                       */
        /* ================================================================ */
        .audio-call-stage {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 24px 90px 24px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .audio-call-hero-container {
          position: relative;
          width: 140px;
          height: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 22px;
        }

        .audio-hero-avatar {
          width: 104px;
          height: 104px;
          border-radius: 50%;
          object-fit: cover;
          border: 3.5px solid #6366f1;
          box-shadow: 0 12px 36px rgba(99, 102, 241, 0.45);
          position: relative;
          z-index: 3;
        }

        .audio-hero-pulse-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(99, 102, 241, 0.5);
          animation: audioPulseWave 3s infinite cubic-bezier(0.25, 1, 0.5, 1);
          pointer-events: none;
          z-index: 1;
        }

        .audio-hero-pulse-ring.ring-1 {
          animation-delay: 0s;
        }

        .audio-hero-pulse-ring.ring-2 {
          animation-delay: 1s;
        }

        .audio-hero-pulse-ring.ring-3 {
          animation-delay: 2s;
        }

        @keyframes audioPulseWave {
          0% {
            transform: scale(0.75);
            opacity: 0.9;
          }
          100% {
            transform: scale(2.0);
            opacity: 0;
          }
        }

        .audio-hero-badge-icon {
          position: absolute;
          bottom: 12px;
          right: 12px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #6366f1;
          border: 2.5px solid #0f1117;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          z-index: 4;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        }

        .audio-call-meta {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          z-index: 2;
        }

        .audio-hero-name {
          font-size: 22px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
          letter-spacing: -0.3px;
        }

        .audio-hero-handle {
          font-size: 14px;
          color: #818cf8;
          font-weight: 600;
        }

        .audio-hero-status {
          margin-top: 10px;
          font-size: 13px;
          color: #94a3b8;
          font-weight: 500;
          background: rgba(255, 255, 255, 0.06);
          padding: 5px 14px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .call-controls-toolbar.audio-toolbar {
          background: rgba(24, 27, 36, 0.94);
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
          gap: 16px;
          padding: 10px 24px;
        }

        /* Remote / Main Video Screen */
        .call-remote-screen {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background: #0b0c10;
          overflow: hidden;
        }

        .remote-video-elem {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transform: translateZ(0);
          backface-visibility: hidden;
        }

        .remote-video-elem.mirrored {
          transform: scaleX(-1);
        }

        .remote-video-elem.hidden {
          opacity: 0;
          position: absolute;
          pointer-events: none;
        }

        .audio-call-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          z-index: 10;
        }

        .audio-avatar-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .audio-call-avatar {
          width: 110px;
          height: 110px;
          border-radius: 50%;
          object-fit: cover;
          border: 3.5px solid #6366f1;
          box-shadow: 0 12px 32px rgba(99, 102, 241, 0.35);
          z-index: 2;
        }

        .audio-voice-wave {
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          border: 2px solid rgba(99, 102, 241, 0.45);
          animation: waveBreathe 2s infinite ease-in-out;
        }

        @keyframes waveBreathe {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.8; }
        }

        .audio-call-placeholder h4 {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
          color: #ffffff;
        }

        .audio-call-status-hint {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }

        /* Floating Reactions Particles */
        @keyframes floatUpFade {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.6);
          }
          15% {
            opacity: 1;
            transform: translateY(0px) scale(1.2);
          }
          80% {
            opacity: 0.9;
          }
          100% {
            opacity: 0;
            transform: translateY(-260px) scale(1.6);
          }
        }

        .floating-reaction-item {
          position: absolute;
          bottom: 120px;
          font-size: 38px;
          pointer-events: none;
          z-index: 95;
          animation: floatUpFade 2.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
        }

        /* Secondary Corner PIP Video */
        .call-local-pip {
          position: absolute;
          bottom: 96px;
          right: 20px;
          width: 140px;
          height: 95px;
          background: #181920;
          border-radius: 14px;
          overflow: hidden;
          border: 2px solid rgba(255, 255, 255, 0.22);
          z-index: 40;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.65);
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .call-local-pip:hover {
          transform: scale(1.06);
          border-color: #6366f1;
          box-shadow: 0 12px 36px rgba(99, 102, 241, 0.4);
        }

        .pip-video-elem {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transform: translateZ(0);
          backface-visibility: hidden;
        }

        .pip-video-elem.mirrored {
          transform: scaleX(-1);
        }

        .pip-video-elem.muted-video {
          opacity: 0.25;
        }

        .call-pip-swap-indicator {
          position: absolute;
          inset: 0;
          background: rgba(15, 23, 42, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #ffffff;
          opacity: 0;
          transition: opacity 0.15s ease;
          backdrop-filter: blur(4px);
        }

        .call-local-pip:hover .call-pip-swap-indicator {
          opacity: 1;
        }

        .pip-video-off-label {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
          background: #111318;
        }

        /* Floating Reactions Popover */
        @keyframes popoverIn {
          0% { opacity: 0; transform: translate(-50%, 10px) scale(0.92); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }

        .call-reactions-popover {
          position: absolute;
          bottom: 86px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: rgba(22, 25, 34, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 9999px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
          animation: popoverIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 101;
        }

        .reaction-emoji-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
          padding: 4px;
          line-height: 1;
        }

        .reaction-emoji-btn:hover {
          transform: scale(1.35) translateY(-3px);
        }

        /* Kebab More Options Popover */
        .call-more-menu-popover {
          position: absolute;
          bottom: 86px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px;
          background: rgba(18, 20, 26, 0.96);
          backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 16px;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.75);
          animation: popoverIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 102;
          min-width: 220px;
        }

        .more-menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: #f1f5f9;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          text-align: left;
          width: 100%;
          box-sizing: border-box;
        }

        .more-menu-item:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        .more-menu-item.active {
          color: #818cf8;
          background: rgba(99, 102, 241, 0.18);
        }

        .more-menu-item.active-danger {
          color: #f87171;
          background: rgba(239, 68, 68, 0.18);
        }

        .more-menu-item svg {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
        }

        /* Bottom Glassmorphic Control Dock */
        .call-controls-toolbar {
          position: absolute;
          bottom: 22px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 18px;
          background: rgba(18, 20, 26, 0.85);
          backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 9999px;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05);
          z-index: 100;
          max-width: 95%;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .call-controls-toolbar::-webkit-scrollbar {
          display: none;
        }

        .control-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          flex-shrink: 0;
          user-select: none;
        }

        .control-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px) scale(1.08);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .control-btn:active {
          transform: translateY(0) scale(0.95);
        }

        .control-btn.active-danger {
          background: #ef4444;
          border-color: #ef4444;
          color: #ffffff;
          box-shadow: 0 4px 16px rgba(239, 68, 68, 0.5);
        }

        .control-btn.active-primary {
          background: #6366f1;
          border-color: #6366f1;
          color: #ffffff;
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.5);
        }

        .control-btn.btn-end-call {
          background: #ef4444;
          border-color: #ef4444;
          color: #ffffff;
          padding: 0 18px;
          border-radius: 9999px;
          width: auto;
          gap: 8px;
          font-weight: 700;
          font-size: 14px;
          box-shadow: 0 4px 18px rgba(239, 68, 68, 0.5);
        }

        .control-btn.btn-end-call:hover {
          background: #dc2626;
          border-color: #dc2626;
          transform: translateY(-2px) scale(1.04);
        }

        .btn-end-call-label {
          letter-spacing: 0.3px;
        }

        .control-btn.spinning svg {
          animation: spinCamera 0.6s ease;
        }

        @keyframes spinCamera {
          from { transform: rotate(0deg); }
          to { transform: rotate(180deg); }
        }

        /* Diagnostics Overlay Panel */
        .call-diagnostics-panel {
          position: absolute;
          top: 60px;
          right: 16px;
          width: 320px;
          max-width: calc(100% - 32px);
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 14px;
          padding: 14px;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);
          z-index: 50;
          color: #e2e8f0;
          font-size: 13px;
          animation: fadeInDiag 0.2s ease;
        }

        @keyframes fadeInDiag {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .diag-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 8px;
          margin-bottom: 10px;
        }

        .diag-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 13px;
          color: #38bdf8;
        }

        .diag-close-btn {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 20px;
          cursor: pointer;
          padding: 0 4px;
          line-height: 1;
        }

        .diag-close-btn:hover {
          color: #ffffff;
        }

        .diagnostics-grid {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .diag-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 3px 0;
        }

        .diag-label {
          color: #94a3b8;
          font-size: 12px;
        }

        .diag-val {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
          font-weight: 600;
          font-size: 12px;
          color: #f8fafc;
        }

        .diag-val.val-success {
          color: #34d399;
        }

        .diag-val.val-warning {
          color: #fbbf24;
        }

        .diag-val.val-danger {
          color: #f87171;
        }

        .diag-actions {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .diag-restart-btn {
          width: 100%;
          padding: 8px 12px;
          border-radius: 8px;
          background: rgba(56, 189, 248, 0.15);
          border: 1px solid rgba(56, 189, 248, 0.35);
          color: #38bdf8;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .diag-restart-btn:hover {
          background: rgba(56, 189, 248, 0.25);
          border-color: #38bdf8;
        }

        /* Mobile responsiveness */
        @media (max-width: 640px) {
          .webrtc-call-card {
            max-width: 100%;
            height: 90vh;
            border-radius: 20px;
          }
          .call-connected-view {
            height: 100%;
          }
          .call-local-pip {
            width: 105px;
            height: 75px;
            bottom: 84px;
            right: 14px;
          }
          .call-controls-toolbar {
            gap: 6px;
            padding: 6px 12px;
            bottom: 16px;
          }
          .control-btn {
            width: 38px;
            height: 38px;
          }
          .control-btn.btn-end-call {
            padding: 0 12px;
          }
          .btn-end-call-label {
            display: none;
          }
          .call-badge-chip {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

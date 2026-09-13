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
 * 5. Call duration timer.
 */

import React, { useState, useEffect, useRef } from 'react';
import socketService from '../services/socketService';
import webrtcService from '../services/webrtcService';
import { useAuth } from '../context/AuthContext';

export default function CallModal() {
  const { user } = useAuth();

  // Call State: null | 'incoming' | 'outgoing' | 'connected'
  const [callState, setCallState] = useState(null);
  const [callData, setCallData] = useState(null);
  const [durationSeconds, setDurationSeconds] = useState(0);

  // In-Call Controls
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Media Stream References
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const audioContextRef = useRef(null);
  const ringToneOscillatorRef = useRef(null);
  const durationTimerRef = useRef(null);

  // ==========================================================================
  // Web Audio Ringtone Generator (Synthetic Dual-Tone Chime)
  // ==========================================================================
  const startRingtone = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(480, ctx.currentTime); // B4

      // Gentle pulsating gain
      gain.gain.setValueAtTime(0.05, ctx.currentTime);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      ringToneOscillatorRef.current = { osc1, osc2, gain, ctx };
    } catch (err) {
      // AudioContext autoplay restrictions may occur before first user gesture
    }
  };

  const stopRingtone = () => {
    try {
      if (ringToneOscillatorRef.current) {
        const { osc1, osc2, ctx } = ringToneOscillatorRef.current;
        osc1.stop();
        osc2.stop();
        ctx.close();
        ringToneOscillatorRef.current = null;
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
      setCallData({
        callId: data.callId,
        peer: data.caller,
        callType: data.callType || 'audio',
        isInitiator: false
      });
      setCallState('incoming');
      startRingtone();
    };

    // 2. Call Accepted by Callee (for caller)
    const handleCallAccepted = async (data) => {
      console.log('✅ [Socket] Call accepted by peer:', data);
      stopRingtone();
      setCallState('connected');

      // Initiator starts WebRTC negotiation
      try {
        await webrtcService.startCallAsInitiator(
          callData.peer.id,
          callData.callId,
          callData.callType
        );
      } catch (err) {
        console.error('Failed to start WebRTC call:', err);
        handleEndCall();
      }
    };

    // 3. Call Rejected / Busy
    const handleCallRejected = (data) => {
      console.log('❌ [Socket] Call rejected by peer:', data);
      stopRingtone();
      webrtcService.endCall();
      setCallState(null);
      setCallData(null);
      alert(`Call was declined (${data.reason || 'declined'}).`);
    };

    // 4. Call Ended
    const handleCallEnded = () => {
      console.log('⏹️ [Socket] Call ended by peer');
      stopRingtone();
      webrtcService.endCall();
      setCallState(null);
      setCallData(null);
    };

    // 5. WebRTC SDP Offer Relay
    const handleSignalOffer = async ({ callerId, sdp, callId }) => {
      console.log('📡 [WebRTC] Signal offer received from caller:', callerId);
      try {
        await webrtcService.handleIncomingOffer(
          callerId,
          sdp,
          callId,
          callData?.callType || 'audio'
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

    // Global custom event for initiating a call from chat or profile
    const handleCustomInitiateCall = (event) => {
      const { targetUser, callType } = event.detail;
      setCallData({
        peer: targetUser,
        callType: callType || 'audio',
        isInitiator: true
      });
      setCallState('outgoing');

      socketService.emit('call:initiate', {
        targetUserId: targetUser.id,
        callType: callType || 'audio'
      }, (res) => {
        if (!res.success) {
          alert(res.error || 'Could not initiate call.');
          setCallState(null);
          setCallData(null);
        } else {
          setCallData((prev) => ({ ...prev, callId: res.callId }));
        }
      });
    };

    window.addEventListener('vibegrid:initiate-call', handleCustomInitiateCall);
    socketService.on('call:incoming', handleIncomingCall);
    socketService.on('call:accepted', handleCallAccepted);
    socketService.on('call:rejected', handleCallRejected);
    socketService.on('call:ended', handleCallEnded);
    socketService.on('signal:offer', handleSignalOffer);
    socketService.on('signal:answer', handleSignalAnswer);
    socketService.on('signal:ice-candidate', handleSignalIce);

    return () => {
      window.removeEventListener('vibegrid:initiate-call', handleCustomInitiateCall);
      socketService.off('call:incoming', handleIncomingCall);
      socketService.off('call:accepted', handleCallAccepted);
      socketService.off('call:rejected', handleCallRejected);
      socketService.off('call:ended', handleCallEnded);
      socketService.off('signal:offer', handleSignalOffer);
      socketService.off('signal:answer', handleSignalAnswer);
      socketService.off('signal:ice-candidate', handleSignalIce);
    };
  }, [user, callData]);

  // ==========================================================================
  // Attach Media Streams to HTML Video Elements
  // ==========================================================================
  useEffect(() => {
    webrtcService.onLocalStream = (stream) => {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    };

    webrtcService.onRemoteStream = (stream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    webrtcService.onConnectionStateChange = (state) => {
      if (state === 'connected') {
        setCallState('connected');
      } else if (state === 'disconnected' || state === 'failed') {
        handleEndCall();
      }
    };

    return () => {
      webrtcService.onLocalStream = null;
      webrtcService.onRemoteStream = null;
    };
  }, []);

  // Duration Timer
  useEffect(() => {
    if (callState === 'connected') {
      setDurationSeconds(0);
      durationTimerRef.current = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    }
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [callState]);

  // Format timer
  const formatDuration = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // ==========================================================================
  // Action Handlers
  // ==========================================================================
  const handleAcceptCall = () => {
    stopRingtone();
    setCallState('connected');
    socketService.emit('call:accept', {
      callId: callData.callId,
      callerId: callData.peer.id
    });
  };

  const handleDeclineCall = () => {
    stopRingtone();
    socketService.emit('call:reject', {
      callId: callData?.callId,
      callerId: callData?.peer?.id,
      reason: 'declined'
    });
    setCallState(null);
    setCallData(null);
  };

  const handleEndCall = () => {
    stopRingtone();
    if (callData?.callId) {
      socketService.emit('call:end', {
        callId: callData.callId,
        targetUserId: callData.peer?.id
      });
    }
    webrtcService.endCall();
    setCallState(null);
    setCallData(null);
    setIsAudioMuted(false);
    setIsVideoMuted(false);
    setIsScreenSharing(false);
  };

  const handleToggleMute = () => {
    const isMutedNow = !isAudioMuted;
    webrtcService.toggleAudio(!isMutedNow);
    setIsAudioMuted(isMutedNow);
  };

  const handleToggleVideo = () => {
    const isVideoOff = !isVideoMuted;
    webrtcService.toggleVideo(!isVideoOff);
    setIsVideoMuted(isVideoOff);
  };

  const handleToggleScreenShare = async () => {
    const active = await webrtcService.toggleScreenShare();
    setIsScreenSharing(active);
  };

  if (!callState || !callData) return null;

  return (
    <div className="webrtc-call-overlay">
      <div className="webrtc-call-card">
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
            </div>

            <h3 className="call-peer-name">@{callData.peer?.username}</h3>
            <p className="call-status-label">
              Incoming {callData.callType === 'video' ? '📹 Video' : '📞 Audio'} Call...
            </p>

            <div className="call-actions-row">
              <button
                type="button"
                className="call-btn btn-decline"
                onClick={handleDeclineCall}
                title="Decline Call"
              >
                ✕
              </button>
              <button
                type="button"
                className="call-btn btn-accept"
                onClick={handleAcceptCall}
                title="Accept Call"
              >
                📞
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
              <span className="pulse-ring ring-1"></span>
            </div>

            <h3 className="call-peer-name">@{callData.peer?.username}</h3>
            <p className="call-status-label">
              Calling {callData.callType === 'video' ? 'with video' : ''}...
            </p>

            <div className="call-actions-row">
              <button
                type="button"
                className="call-btn btn-decline"
                onClick={handleEndCall}
                title="Cancel Call"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* State 3: Active Connected Call                                   */}
        {/* ================================================================ */}
        {callState === 'connected' && (
          <div className="call-connected-view">
            {/* Header / Duration */}
            <div className="call-header-bar">
              <div className="call-header-info">
                <span className="call-live-badge">LIVE</span>
                <span className="call-peer-title">@{callData.peer?.username}</span>
              </div>
              <span className="call-timer">{formatDuration(durationSeconds)}</span>
            </div>

            {/* Remote Screen / Avatar */}
            <div className="call-remote-screen">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`remote-video-elem ${callData.callType === 'video' ? 'visible' : 'hidden'}`}
              />
              {(!callData.callType || callData.callType === 'audio') && (
                <div className="audio-call-placeholder">
                  <img
                    src={callData.peer?.avatar_url || '/uploads/avatars/default-avatar.png'}
                    alt=""
                    className="audio-call-avatar"
                  />
                  <h4>Connected with @{callData.peer?.username}</h4>
                </div>
              )}
            </div>

            {/* Local Video PIP */}
            {callData.callType === 'video' && (
              <div className="call-local-pip">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`local-video-elem ${isVideoMuted ? 'muted-video' : ''}`}
                />
              </div>
            )}

            {/* In-Call Controls Toolbar */}
            <div className="call-controls-toolbar">
              <button
                type="button"
                className={`control-btn ${isAudioMuted ? 'active-mute' : ''}`}
                onClick={handleToggleMute}
                title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isAudioMuted ? '🔇' : '🎤'}
              </button>

              {callData.callType === 'video' && (
                <>
                  <button
                    type="button"
                    className={`control-btn ${isVideoMuted ? 'active-mute' : ''}`}
                    onClick={handleToggleVideo}
                    title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
                  >
                    {isVideoMuted ? '🚫' : '📹'}
                  </button>

                  <button
                    type="button"
                    className={`control-btn ${isScreenSharing ? 'active-action' : ''}`}
                    onClick={handleToggleScreenShare}
                    title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                  >
                    🖥️
                  </button>
                </>
              )}

              <button
                type="button"
                className="control-btn btn-end-call"
                onClick={handleEndCall}
                title="End Call"
              >
                🔴
              </button>
            </div>
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
          background: rgba(0, 0, 0, 0.78);
          backdrop-filter: blur(8px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .webrtc-call-card {
          width: 100%;
          max-width: 520px;
          background: #18191c;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 20px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
          overflow: hidden;
          color: #ffffff;
        }

        /* Incoming & Outgoing Styles */
        .call-incoming-view,
        .call-outgoing-view {
          padding: 40px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .call-avatar-pulse-container {
          position: relative;
          width: 110px;
          height: 110px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .call-avatar-img {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid #6366f1;
          z-index: 2;
        }

        .pulse-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid #6366f1;
          animation: pulseWave 2s infinite ease-out;
          opacity: 0.6;
        }

        .pulse-ring.ring-2 {
          animation-delay: 0.8s;
        }

        @keyframes pulseWave {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.4); opacity: 0; }
        }

        .call-peer-name {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 8px 0;
        }

        .call-status-label {
          color: #9ca3af;
          font-size: 15px;
          margin: 0 0 32px 0;
        }

        .call-actions-row {
          display: flex;
          gap: 32px;
        }

        .call-btn {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          cursor: pointer;
          transition: transform 0.15s ease, filter 0.15s ease;
        }

        .call-btn:hover {
          transform: scale(1.08);
          filter: brightness(1.1);
        }

        .btn-accept {
          background: #10b981;
          color: #ffffff;
        }

        .btn-decline {
          background: #ef4444;
          color: #ffffff;
        }

        /* Connected View */
        .call-connected-view {
          position: relative;
          height: 480px;
          display: flex;
          flex-direction: column;
          background: #0f1012;
        }

        .call-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          background: rgba(0, 0, 0, 0.4);
          z-index: 10;
        }

        .call-live-badge {
          background: #ef4444;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
          margin-right: 8px;
        }

        .call-peer-title {
          font-weight: 600;
          font-size: 15px;
        }

        .call-timer {
          font-family: monospace;
          font-size: 15px;
          color: #9ca3af;
        }

        .call-remote-screen {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background: #000;
          overflow: hidden;
        }

        .remote-video-elem {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .remote-video-elem.hidden {
          display: none;
        }

        .audio-call-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .audio-call-avatar {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid #6366f1;
        }

        .call-local-pip {
          position: absolute;
          bottom: 84px;
          right: 16px;
          width: 120px;
          height: 80px;
          background: #202225;
          border-radius: 10px;
          overflow: hidden;
          border: 2px solid rgba(255, 255, 255, 0.2);
          z-index: 20;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        }

        .local-video-elem {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
        }

        .local-video-elem.muted-video {
          opacity: 0.2;
        }

        .call-controls-toolbar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 16px;
          background: rgba(0, 0, 0, 0.6);
          z-index: 10;
        }

        .control-btn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: #2a2b2f;
          color: #ffffff;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease, transform 0.15s ease;
        }

        .control-btn:hover {
          background: #37393f;
          transform: scale(1.05);
        }

        .control-btn.active-mute {
          background: #ef4444;
          border-color: #ef4444;
        }

        .control-btn.active-action {
          background: #6366f1;
          border-color: #6366f1;
        }

        .control-btn.btn-end-call {
          background: #dc2626;
          border-color: #dc2626;
        }
      `}</style>
    </div>
  );
}

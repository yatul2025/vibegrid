/**
 * client/src/services/webrtcService.js
 * ====================================
 * Production-Grade WebRTC 1-to-1 Audio & Video Calling Engine
 * 
 * Features:
 * 1. Leak-free camera/microphone hardware lifecycle management.
 * 2. Race-free, sequential Offer/Answer handshake (no onnegotiationneeded interference during call setup).
 * 3. Guaranteed trickle ICE queueing and deduplication.
 * 4. Ultra-low-latency Opus audio pipeline (48kHz, mono VoIP, 20ms ptime).
 * 5. HD video encoding constraints with RTCRtpSender.setParameters() (2.5 Mbps).
 * 6. Multi-tier ICE candidates (Direct Host, STUN Reflexive, and TURN Relay).
 * 7. Real-time network health diagnostics and adaptive bitrate loop.
 * 8. Clean front/back camera flipping via sender.replaceTrack().
 * 9. Fail-safe disconnection handling and unconditional track termination.
 */

import socketService from './socketService';
import apiClient from '../api/client';

export const DEFAULT_ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    // OpenRelay community fallback (ensures relay candidates exist even before backend credentials resolve)
    { urls: 'stun:openrelay.metered.ca:80' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
  ],
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};

/**
 * Normalizes input into a valid RTCSessionDescription
 */
function toSessionDescription(input, defaultType) {
  if (!input) return null;
  let type = defaultType;
  let sdpString = '';

  if (typeof input === 'string') {
    sdpString = input;
  } else if (typeof input === 'object') {
    let curr = input;
    while (curr && curr.sdp && typeof curr.sdp === 'object') {
      if (curr.type) type = curr.type;
      curr = curr.sdp;
    }
    type = curr.type || input.type || defaultType;
    if (typeof curr.sdp === 'string') {
      sdpString = curr.sdp;
    } else if (typeof curr === 'string') {
      sdpString = curr;
    }
  }

  if (!sdpString) return null;
  return new RTCSessionDescription({ type, sdp: sdpString });
}

/**
 * Normalizes input into a valid RTCIceCandidate
 */
function toIceCandidate(input) {
  if (!input) return null;
  if (typeof input === 'string') {
    return new RTCIceCandidate({ candidate: input });
  }
  const candidateStr = input.candidate;
  if (!candidateStr || typeof candidateStr !== 'string' || !candidateStr.trim()) {
    return null;
  }
  const init = { candidate: candidateStr };
  if (input.sdpMid !== undefined && input.sdpMid !== null) {
    init.sdpMid = String(input.sdpMid);
  }
  if (input.sdpMLineIndex !== undefined && input.sdpMLineIndex !== null) {
    init.sdpMLineIndex = Number(input.sdpMLineIndex);
  }
  if (input.usernameFragment) {
    init.usernameFragment = input.usernameFragment;
  }
  return new RTCIceCandidate(init);
}

/**
 * Optimizes SDP for low latency audio (Opus VoIP profile)
 */
function optimizeSdpForLowLatency(sdp) {
  if (!sdp || typeof sdp !== 'string') return sdp;

  return sdp.replace(/(a=fmtp:\d+ .*)/g, (match) => {
    if (match.includes('opus')) {
      let enhanced = match;
      if (!enhanced.includes('minptime=')) enhanced += ';minptime=10';
      if (!enhanced.includes('ptime=')) enhanced += ';ptime=20';
      if (!enhanced.includes('useinbandfec=')) enhanced += ';useinbandfec=1';
      if (!enhanced.includes('stereo=')) enhanced += ';stereo=0;sprop-stereo=0';
      return enhanced;
    }
    return match;
  });
}

class WebRTCService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.screenStream = null;

    // Call identifiers
    this.callId = null;
    this.targetUserId = null;
    this.callType = 'audio'; // 'audio' | 'video'
    this.currentFacingMode = 'user'; // 'user' | 'environment'
    this.isInitiator = false;
    this.isHandshakeComplete = false;

    // Candidate Tracking & Deduplication
    this.candidateQueue = [];
    this.seenCandidates = new Set();
    this.iceRestartAttempts = 0;

    // Stats Monitoring
    this.statsTimer = null;
    this.lastStats = null;

    // UI Callbacks
    this.onLocalStream = null;
    this.onRemoteStream = null;
    this.onConnectionStateChange = null;
    this.onNetworkStats = null;
    this.onError = null;
  }

  // ==========================================================================
  // Media Acquisition & Unconditional Cleanup
  // ==========================================================================

  /**
   * Acquires local camera and microphone stream safely.
   * If an active stream already exists matching the requested type, it is reused
   * to avoid opening multiple camera sessions on mobile devices.
   */
  async getLocalMedia(callType = 'audio', facingMode = 'user') {
    this.callType = callType;
    this.currentFacingMode = facingMode;

    // 1. Check if existing localStream is already active with the requested tracks
    if (this.localStream && this.localStream.active) {
      const audioTracks = this.localStream.getAudioTracks().filter((t) => t.readyState === 'live');
      const videoTracks = this.localStream.getVideoTracks().filter((t) => t.readyState === 'live');

      const hasAudio = audioTracks.length > 0;
      const hasVideo = videoTracks.length > 0;

      if (hasAudio && (callType !== 'video' || hasVideo)) {
        console.log('[WebRTC] Reusing active local media stream');
        if (this.onLocalStream) this.onLocalStream(this.localStream);
        return this.localStream;
      }

      // If existing stream does not match requirements, stop it before acquiring new one
      this.stopAllLocalTracks();
    }

    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1
    };

    const videoConstraints = callType === 'video' ? {
      facingMode: facingMode,
      width: { ideal: 1280, max: 1920, min: 480 },
      height: { ideal: 720, max: 1080, min: 360 },
      frameRate: { ideal: 30, max: 30, min: 15 }
    } : false;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: videoConstraints
      });

      if (this.onLocalStream) {
        this.onLocalStream(this.localStream);
      }
      return this.localStream;
    } catch (err) {
      console.warn('[WebRTC] Preferred getUserMedia failed, attempting fallback constraints:', err.message);
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video' ? { facingMode } : false
        });

        if (this.onLocalStream) {
          this.onLocalStream(this.localStream);
        }
        return this.localStream;
      } catch (err2) {
        console.warn('[WebRTC] Fallback failed, attempting audio-only:', err2.message);
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.callType = 'audio';
          if (this.onLocalStream) {
            this.onLocalStream(this.localStream);
          }
          return this.localStream;
        } catch (err3) {
          console.error('[WebRTC] Media acquisition completely failed:', err3);
          if (this.onError) this.onError(err3);
          throw err3;
        }
      }
    }
  }

  /**
   * Unconditionally stops all camera and microphone hardware tracks.
   */
  stopAllLocalTracks() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {}
      });
      this.localStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {}
      });
      this.screenStream = null;
    }
  }

  // ==========================================================================
  // Dynamic ICE & TURN Server Resolution
  // ==========================================================================

  async getIceServers() {
    try {
      const res = await apiClient.get('/calls/turn-credentials');
      if (res.success && Array.isArray(res.data?.iceServers) && res.data.iceServers.length > 0) {
        return {
          iceServers: res.data.iceServers,
          iceTransportPolicy: res.data.iceTransportPolicy || 'all',
          bundlePolicy: res.data.bundlePolicy || 'max-bundle',
          rtcpMuxPolicy: res.data.rtcpMuxPolicy || 'require'
        };
      }
    } catch (err) {
      console.warn('[WebRTC] Backend TURN resolution failed, using redundant fallback relays:', err.message);
    }
    return DEFAULT_ICE_SERVERS;
  }

  // ==========================================================================
  // PeerConnection Setup
  // ==========================================================================

  _initPeerConnection(targetUserId, callId, iceConfig) {
    this.targetUserId = Number(targetUserId);
    this.callId = callId;

    // Reset ICE candidate tracking for this connection session
    this.seenCandidates.clear();
    this.candidateQueue = [];

    // Safely teardown previous peer connection if one exists
    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch {}
      this.peerConnection = null;
    }

    const pc = new RTCPeerConnection(iceConfig);
    this.peerConnection = pc;

    this.remoteStream = new MediaStream();
    if (this.onRemoteStream) {
      this.onRemoteStream(this.remoteStream);
    }

    // Attach local media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, this.localStream);
        } catch (e) {
          console.warn('[WebRTC] Track attach error:', e.message);
        }
      });
    }

    // Configure preferred codecs
    this._configureCodecPreferences(pc);

    // 1. Unified Plan Remote Track Handler
    pc.ontrack = (event) => {
      console.log('📡 [WebRTC] Remote track received:', event.track.kind, event.track.id);

      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
      }

      event.track.onunmute = () => {
        console.log(`[WebRTC] Remote track unmuted:`, event.track.kind);
        if (this.onRemoteStream && this.remoteStream) {
          this.onRemoteStream(this.remoteStream);
        }
      };

      if (this.onRemoteStream && this.remoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange('connected');
      }
    };

    // 2. Trickle ICE Candidate Dispatch
    pc.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate) {
        const candStr = event.candidate.candidate;
        if (this.seenCandidates.has(candStr)) return;
        this.seenCandidates.add(candStr);

        const candidatePayload = event.candidate.toJSON ? event.candidate.toJSON() : {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          usernameFragment: event.candidate.usernameFragment
        };

        socketService.emit('signal:ice-candidate', {
          targetUserId: this.targetUserId,
          candidate: candidatePayload,
          callId: this.callId
        });
      }
    };

    // 3. Connection State Evaluator
    const notifyStateChange = () => {
      const connState = pc.connectionState;
      const iceState = pc.iceConnectionState;
      console.log(`[WebRTC] connState: ${connState} | iceState: ${iceState}`);

      let effectiveState = 'connecting';
      if (connState === 'connected' || iceState === 'connected' || iceState === 'completed') {
        effectiveState = 'connected';
        this.iceRestartAttempts = 0;
        this._applySenderEncodingParameters();
        this._startStatsMonitoring();
      } else if (connState === 'failed' || iceState === 'failed') {
        effectiveState = 'failed';
        if (this.iceRestartAttempts < 2) {
          this.iceRestartAttempts++;
          console.warn(`[WebRTC] ICE failed. Attempting automatic recovery (attempt ${this.iceRestartAttempts}/2)...`);
          this.restartIce();
        } else {
          console.error('[WebRTC] Connection failed permanently.');
          if (this.onConnectionStateChange) this.onConnectionStateChange('failed');
          this.endCall();
          return;
        }
      } else if (connState === 'disconnected' || iceState === 'disconnected') {
        effectiveState = 'disconnected';
        setTimeout(() => {
          if (this.peerConnection && (this.peerConnection.iceConnectionState === 'disconnected' || this.peerConnection.connectionState === 'disconnected')) {
            console.log('[WebRTC] Disconnection persisted, triggering recovery ICE restart...');
            this.restartIce();
          }
        }, 5000);
      } else if (connState === 'closed' || iceState === 'closed') {
        effectiveState = 'closed';
        if (this.onConnectionStateChange) {
          try { this.onConnectionStateChange('closed'); } catch {}
        }
        this.endCall();
        return;
      }

      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(effectiveState);
      }
    };

    pc.onconnectionstatechange = notifyStateChange;
    pc.oniceconnectionstatechange = notifyStateChange;

    return pc;
  }

  // ==========================================================================
  // Signaling Handshake (Deterministic Offer / Answer Lifecycle)
  // ==========================================================================

  /**
   * Called by the CALLER (initiator) once the callee accepts the call.
   */
  async startCallAsInitiator(targetUserId, callId, callType = 'audio') {
    this.isInitiator = true;
    this.isHandshakeComplete = false;

    // 1. Ensure local media is active
    await this.getLocalMedia(callType);

    // 2. Fetch ICE configuration
    const iceConfig = await this.getIceServers();

    // 3. Initialize peer connection
    const pc = this._initPeerConnection(targetUserId, callId, iceConfig);

    // 4. Create and set initial Offer
    const isVideo = callType === 'video';
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: isVideo
    });

    const optimizedSdp = optimizeSdpForLowLatency(offer.sdp);
    await pc.setLocalDescription({ type: offer.type, sdp: optimizedSdp });

    console.log('📡 [WebRTC] Caller created initial offer. Emitting to target:', targetUserId);

    // 5. Emit offer via socket signaling
    socketService.emit('signal:offer', {
      targetUserId: this.targetUserId,
      sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
      callId: this.callId,
      callType: this.callType
    });
  }

  /**
   * Called by the CALLEE upon receiving a signal:offer event.
   */
  async handleIncomingOffer(callerId, sdp, callId, callType = 'audio', isIceRestart = false) {
    console.log('📡 [WebRTC] Callee handling incoming offer from:', callerId);

    // Ensure local media is acquired
    await this.getLocalMedia(callType);

    // Fetch ICE servers
    const iceConfig = await this.getIceServers();

    // If connection doesn't exist yet, initialize it
    if (!this.peerConnection || isIceRestart) {
      this._initPeerConnection(callerId, callId, iceConfig);
    }

    const pc = this.peerConnection;
    const sessionDesc = toSessionDescription(sdp, 'offer');
    if (!sessionDesc) {
      console.error('[WebRTC] Invalid remote offer received');
      return;
    }

    try {
      // Apply remote offer
      await pc.setRemoteDescription(sessionDesc);
      console.log('✅ [WebRTC] Remote Offer applied on Callee');

      // Flush early ICE candidates received while waiting for offer
      await this._drainCandidateQueue();

      // Create Answer
      const answer = await pc.createAnswer();
      const optimizedAnswer = optimizeSdpForLowLatency(answer.sdp);
      await pc.setLocalDescription({ type: answer.type, sdp: optimizedAnswer });

      this.isHandshakeComplete = true;

      // Attach mid-call renegotiation listener now that initial handshake is complete
      this._attachRenegotiationListener(pc);

      console.log('📡 [WebRTC] Callee created answer. Emitting to caller:', callerId);
      socketService.emit('signal:answer', {
        targetUserId: callerId,
        sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
        callId,
        isIceRestart
      });
    } catch (err) {
      console.error('[WebRTC] Error handling incoming offer on Callee:', err);
    }
  }

  /**
   * Called by the CALLER upon receiving a signal:answer event.
   */
  async handleIncomingAnswer(sdp) {
    if (!this.peerConnection) return;
    const pc = this.peerConnection;

    if (pc.signalingState !== 'have-local-offer') {
      console.warn(`[WebRTC] Ignoring unexpected answer in state: ${pc.signalingState}`);
      return;
    }

    const sessionDesc = toSessionDescription(sdp, 'answer');
    if (!sessionDesc) {
      console.error('[WebRTC] Invalid remote answer payload');
      return;
    }

    try {
      await pc.setRemoteDescription(sessionDesc);
      console.log('✅ [WebRTC] Remote Answer applied on Caller! Handshake complete.');

      this.isHandshakeComplete = true;

      // Flush early ICE candidates received while waiting for answer
      await this._drainCandidateQueue();

      // Attach mid-call renegotiation listener now that initial handshake is complete
      this._attachRenegotiationListener(pc);
    } catch (err) {
      console.error('[WebRTC] Error setting remote answer on Caller:', err);
    }
  }

  /**
   * Handles incoming trickle ICE candidate.
   */
  async handleIncomingIceCandidate(candidate) {
    const iceCand = toIceCandidate(candidate);
    if (!iceCand || !iceCand.candidate) return;

    if (this.seenCandidates.has(iceCand.candidate)) return;
    this.seenCandidates.add(iceCand.candidate);

    if (this.peerConnection && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
      try {
        await this.peerConnection.addIceCandidate(iceCand);
      } catch (err) {
        console.warn('[WebRTC] Error adding ICE candidate:', err.message);
      }
    } else {
      // Buffer candidates until setRemoteDescription finishes
      this.candidateQueue.push(candidate);
    }
  }

  async _drainCandidateQueue() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    const queue = [...this.candidateQueue];
    this.candidateQueue = [];

    for (const cand of queue) {
      const iceCand = toIceCandidate(cand);
      if (iceCand) {
        try {
          await this.peerConnection.addIceCandidate(iceCand);
        } catch (err) {
          console.warn('[WebRTC] Error adding buffered ICE candidate:', err.message);
        }
      }
    }
  }

  _attachRenegotiationListener(pc) {
    pc.onnegotiationneeded = async () => {
      // Only perform mid-call renegotiation if handshake already completed and state is stable
      if (!this.isHandshakeComplete || pc.signalingState !== 'stable') return;

      try {
        console.log('🔄 [WebRTC] Mid-call renegotiation needed...');
        const offer = await pc.createOffer();
        const optimizedSdp = optimizeSdpForLowLatency(offer.sdp);
        await pc.setLocalDescription({ type: offer.type, sdp: optimizedSdp });

        socketService.emit('signal:offer', {
          targetUserId: this.targetUserId,
          sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
          callId: this.callId,
          callType: this.callType
        });
      } catch (err) {
        console.warn('[WebRTC] Mid-call renegotiation error:', err.message);
      }
    };
  }

  // ==========================================================================
  // Codec Preferences & Sender Quality Allocation
  // ==========================================================================

  _configureCodecPreferences(pc) {
    if (typeof RTCRtpReceiver.getCapabilities !== 'function') return;

    try {
      const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
      const videoCaps = RTCRtpReceiver.getCapabilities('video');
      if (videoCaps && videoCaps.codecs) {
        const preferredCodecs = videoCaps.codecs.filter((c) =>
          c.mimeType.toLowerCase() === 'video/vp8' ||
          c.mimeType.toLowerCase() === 'video/h264' ||
          c.mimeType.toLowerCase() === 'video/vp9'
        );

        transceivers.forEach((tr) => {
          if (tr.receiver && tr.receiver.track && tr.receiver.track.kind === 'video' && tr.setCodecPreferences) {
            tr.setCodecPreferences(preferredCodecs);
          }
        });
      }
    } catch (e) {
      console.debug('[WebRTC] Codec preferences note:', e.message);
    }
  }

  async _applySenderEncodingParameters(maxBitrate = 2500000, scaleResolutionDownBy = 1.0) {
    if (!this.peerConnection) return;

    try {
      const senders = this.peerConnection.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

      if (videoSender && typeof videoSender.getParameters === 'function' && typeof videoSender.setParameters === 'function') {
        const params = videoSender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }

        params.encodings[0].maxBitrate = maxBitrate;
        params.encodings[0].maxFramerate = 30;
        params.encodings[0].scaleResolutionDownBy = scaleResolutionDownBy;

        if ('degradationPreference' in params) {
          params.degradationPreference = 'balanced';
        }

        await videoSender.setParameters(params);
        console.log(`🚀 [WebRTC HD] Bitrate set: ${Math.round(maxBitrate / 1000)} kbps`);
      }
    } catch (err) {
      console.debug('[WebRTC] Sender encoding adjustment note:', err.message);
    }
  }

  // ==========================================================================
  // True ICE Restart Cycle
  // ==========================================================================

  async restartIce() {
    if (!this.peerConnection || !this.targetUserId) return;
    const pc = this.peerConnection;

    try {
      console.log('🔄 [WebRTC] Executing ICE restart renegotiation...');
      if (typeof pc.restartIce === 'function') {
        pc.restartIce();
      }

      const offer = await pc.createOffer({ iceRestart: true });
      const optimizedSdp = optimizeSdpForLowLatency(offer.sdp);
      await pc.setLocalDescription({ type: offer.type, sdp: optimizedSdp });

      socketService.emit('signal:offer', {
        targetUserId: this.targetUserId,
        sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
        callId: this.callId,
        callType: this.callType,
        isIceRestart: true
      });
    } catch (err) {
      console.error('[WebRTC] ICE restart failed:', err);
    }
  }

  // ==========================================================================
  // Real-Time Stats & Diagnostics Monitoring Loop
  // ==========================================================================

  _startStatsMonitoring() {
    this._stopStatsMonitoring();

    let prevBytesSent = 0;
    let prevBytesReceived = 0;
    let prevTimestamp = Date.now();

    this.statsTimer = setInterval(async () => {
      if (!this.peerConnection) return;

      try {
        const stats = await this.peerConnection.getStats();
        let rtt = 0;
        let packetLossPercent = 0;
        let jitterMs = 0;
        let transportType = 'Direct LAN (Host)';
        let frameWidth = 0;
        let frameHeight = 0;
        let fps = 0;
        let currentBytesSent = 0;
        let currentBytesReceived = 0;

        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && (report.nominated || report.state === 'succeeded')) {
            if (report.currentRoundTripTime) {
              rtt = Math.round(report.currentRoundTripTime * 1000);
            }

            const localCand = stats.get(report.localCandidateId);
            const remoteCand = stats.get(report.remoteCandidateId);

            if (localCand && remoteCand) {
              if (localCand.candidateType === 'relay' || remoteCand.candidateType === 'relay') {
                transportType = 'TURN Relay';
              } else if (localCand.candidateType === 'srflx' || remoteCand.candidateType === 'srflx') {
                transportType = 'STUN Reflexive';
              } else {
                transportType = 'Direct LAN (Host)';
              }
            }
          }

          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            frameWidth = report.frameWidth || frameWidth;
            frameHeight = report.frameHeight || frameHeight;
            fps = report.framesPerSecond || fps;
            currentBytesReceived += report.bytesReceived || 0;

            if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
              const total = report.packetsLost + report.packetsReceived;
              if (total > 0) {
                packetLossPercent = parseFloat(((report.packetsLost / total) * 100).toFixed(1));
              }
            }
            if (report.jitter) {
              jitterMs = Math.round(report.jitter * 1000);
            }
          }

          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            currentBytesSent += report.bytesSent || 0;
          }

          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            if (report.jitter && jitterMs === 0) {
              jitterMs = Math.round(report.jitter * 1000);
            }
          }
        });

        const now = Date.now();
        const durationSec = Math.max(0.5, (now - prevTimestamp) / 1000);
        const inboundBitrateKbps = Math.round(((currentBytesReceived - prevBytesReceived) * 8) / (durationSec * 1000));
        const outboundBitrateKbps = Math.round(((currentBytesSent - prevBytesSent) * 8) / (durationSec * 1000));

        prevBytesSent = currentBytesSent;
        prevBytesReceived = currentBytesReceived;
        prevTimestamp = now;

        // Dynamic Quality Evaluation
        let qualityScore = 'excellent';
        if (rtt > 300 || packetLossPercent > 5) {
          qualityScore = 'poor';
          this._applySenderEncodingParameters(800000, 1.5);
        } else if (rtt > 180 || packetLossPercent > 2) {
          qualityScore = 'good';
          this._applySenderEncodingParameters(1500000, 1.0);
        } else {
          qualityScore = 'excellent';
          this._applySenderEncodingParameters(2500000, 1.0);
        }

        const metrics = {
          transportType,
          rtt,
          packetLoss: packetLossPercent,
          jitter: jitterMs,
          inboundBitrate: Math.max(0, inboundBitrateKbps),
          outboundBitrate: Math.max(0, outboundBitrateKbps),
          resolution: frameWidth && frameHeight ? `${frameWidth}x${frameHeight}` : (this.callType === 'video' ? '720p HD' : 'VoIP Mono'),
          fps: Math.round(fps) || (this.callType === 'video' ? 30 : 0),
          qualityScore
        };

        this.lastStats = metrics;

        if (this.onNetworkStats) {
          this.onNetworkStats(metrics);
        }
      } catch (err) {
        console.debug('[WebRTC Stats Error]:', err.message);
      }
    }, 2500);
  }

  _stopStatsMonitoring() {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  // ==========================================================================
  // Media Controls (Camera Flip, Mute, Screen Share)
  // ==========================================================================

  async switchCamera() {
    if (this.callType !== 'video' || !navigator.mediaDevices?.getUserMedia) return false;

    const newFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: newFacingMode },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        },
        audio: false
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return false;

      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      if (this.localStream) {
        const oldTrack = this.localStream.getVideoTracks()[0];
        if (oldTrack) {
          this.localStream.removeTrack(oldTrack);
          try { oldTrack.stop(); } catch {}
        }
        this.localStream.addTrack(newVideoTrack);
      }

      this.currentFacingMode = newFacingMode;

      if (this.onLocalStream) {
        this.onLocalStream(this.localStream);
      }
      return true;
    } catch (err) {
      console.warn('[WebRTC] Camera flip failed, attempting unconstrained:', err.message);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newFacingMode }
        });
        const newTrack = fallbackStream.getVideoTracks()[0];
        if (newTrack) {
          if (this.peerConnection) {
            const sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
            if (sender) await sender.replaceTrack(newTrack);
          }
          if (this.localStream) {
            const old = this.localStream.getVideoTracks()[0];
            if (old) { this.localStream.removeTrack(old); try { old.stop(); } catch {} }
            this.localStream.addTrack(newTrack);
          }
          this.currentFacingMode = newFacingMode;
          if (this.onLocalStream) this.onLocalStream(this.localStream);
          return true;
        }
      } catch (e2) {
        console.error('[WebRTC] Camera switch failed completely:', e2.message);
      }
      return false;
    }
  }

  toggleAudio(enable) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enable;
      });
    }
  }

  toggleVideo(enable) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enable;
      });
    }
  }

  async toggleScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      this.screenStream = null;

      const camTrack = this.localStream?.getVideoTracks()[0] || null;
      if (this.peerConnection && camTrack) {
        const sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) await sender.replaceTrack(camTrack);
      }
      if (this.onLocalStream) this.onLocalStream(this.localStream);
      return false;
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        this.screenStream = stream;
        const screenTrack = stream.getVideoTracks()[0];

        screenTrack.onended = () => {
          this.toggleScreenShare();
        };

        if (this.peerConnection) {
          let sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (!sender) sender = this.peerConnection.getSenders().find((s) => !s.track);
          if (sender) await sender.replaceTrack(screenTrack);
        }

        if (this.onLocalStream) this.onLocalStream(stream);
        return true;
      } catch (err) {
        console.warn('[WebRTC] Screen share error:', err.message);
        return false;
      }
    }
  }

  // ==========================================================================
  // Clean Teardown (Kills Camera Hardware & Closes PeerConnection)
  // ==========================================================================

  endCall() {
    this._stopStatsMonitoring();

    // 1. Unconditionally stop camera, mic, and screen tracks
    this.stopAllLocalTracks();

    // 2. Stop remote tracks
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
      this.remoteStream = null;
    }

    // 3. Stop senders and close peer connection
    if (this.peerConnection) {
      try {
        this.peerConnection.getSenders().forEach((s) => {
          if (s.track) { try { s.track.stop(); } catch {} }
        });
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }

    // 4. Reset state
    this.candidateQueue = [];
    this.seenCandidates.clear();
    this.callId = null;
    this.targetUserId = null;
    this.isInitiator = false;
    this.isHandshakeComplete = false;
    this.iceRestartAttempts = 0;
    this.lastStats = null;

    try { if (this.onLocalStream) this.onLocalStream(null); } catch {}
    try { if (this.onRemoteStream) this.onRemoteStream(null); } catch {}
    try { if (this.onNetworkStats) this.onNetworkStats(null); } catch {}
  }
}

export const webrtcService = new WebRTCService();
export default webrtcService;

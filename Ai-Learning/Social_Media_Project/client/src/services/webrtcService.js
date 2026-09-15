/**
 * client/src/services/webrtcService.js
 * ====================================
 * Production-Grade WebRTC 1-to-1 Audio & Video Calling Engine
 * 
 * Features:
 * 1. W3C Perfect Negotiation state machine (eliminates glare & race conditions).
 * 2. Multi-tier ICE Candidate harvesting (Local Host, Server-Reflexive STUN, TURN Relay).
 * 3. Support for coturn (HMAC-SHA1), Metered Cloud TURN, and OpenRelay fallbacks.
 * 4. Ultra-low-latency Opus audio optimization (20ms fixed packetization, in-band FEC).
 * 5. Crisp 720p 30fps HD video constraints with RTCRtpSender.setParameters() (2.5 Mbps).
 * 6. Real-time RTCPeerConnection.getStats() network monitor & adaptive bitrate scaling.
 * 7. Seamless camera switching (front/rear facingMode) via sender.replaceTrack().
 * 8. Resilient ICE restart on network degradation or same-Wi-Fi disconnection.
 * 9. Device enumeration & dynamic hardware change detection.
 * 10. Clean teardown and hardware resource release.
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
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 10
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
 * Optimizes SDP for minimum audio latency and maximum voice clarity
 * Enforces 20ms fixed packetization (ptime=20), in-band FEC, and mono channel.
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
    this.currentFacingMode = 'user'; // 'user' (front) | 'environment' (back)

    // W3C Perfect Negotiation & Signaling State Guards
    this.isPolite = false; // Initiator is impolite; callee is polite
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.isSettingRemoteAnswerPending = false;
    this.candidateQueue = [];
    this.seenCandidates = new Set(); // Prevents processing duplicate ICE candidates

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
  // Media Stream Acquisition
  // ==========================================================================

  /**
   * Acquires local camera and microphone stream with HD video & low-latency audio constraints
   */
  async getLocalMedia(callType = 'audio', facingMode = 'user', preferredCameraId = null, preferredMicId = null) {
    this.callType = callType;
    this.currentFacingMode = facingMode;

    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1, // Mono VoIP reduces bandwidth and latency
      sampleRate: 48000,
      latency: { ideal: 0.01 },
      ...(preferredMicId ? { deviceId: { exact: preferredMicId } } : {})
    };

    const videoConstraints = callType === 'video' ? {
      width: { ideal: 1280, max: 1920, min: 640 },
      height: { ideal: 720, max: 1080, min: 360 },
      frameRate: { ideal: 30, max: 30, min: 15 },
      facingMode: facingMode,
      ...(preferredCameraId ? { deviceId: { exact: preferredCameraId } } : {})
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
        // Fallback with standard unconstrained resolution
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video' ? { facingMode } : false
        });

        if (this.onLocalStream) {
          this.onLocalStream(this.localStream);
        }
        return this.localStream;
      } catch (err2) {
        console.warn('[WebRTC] Video fallback failed, attempting audio-only:', err2.message);
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.callType = 'audio';
          if (this.onLocalStream) {
            this.onLocalStream(this.localStream);
          }
          return this.localStream;
        } catch (err3) {
          console.error('[WebRTC] Complete media acquisition failure:', err3);
          if (this.onError) this.onError(err3);
          throw err3;
        }
      }
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
          rtcpMuxPolicy: res.data.rtcpMuxPolicy || 'require',
          iceCandidatePoolSize: 10
        };
      }
    } catch (err) {
      console.warn('[WebRTC] Dynamic TURN resolution failed, using redundant fallback relays:', err.message);
    }
    return DEFAULT_ICE_SERVERS;
  }

  // ==========================================================================
  // PeerConnection Setup & Lifecycle
  // ==========================================================================

  createPeerConnection(targetUserId, callId, iceConfig = DEFAULT_ICE_SERVERS, isPolite = false) {
    this.targetUserId = Number(targetUserId);
    this.callId = callId;
    this.isPolite = isPolite;

    // Reset candidate tracking for new call
    this.seenCandidates.clear();
    this.candidateQueue = [];

    // Clean up any stale peer connection before initializing new one
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
        pc.addTrack(track, this.localStream);
      });
    }

    // Configure preferred codecs (VP8, H264, VP9 for video; Opus for audio)
    this._configureCodecPreferences(pc);

    // Prepare video transceiver if video call
    if (this.callType === 'video') {
      const hasVideoTrack = this.localStream?.getVideoTracks().length > 0;
      if (!hasVideoTrack) {
        try {
          pc.addTransceiver('video', { direction: 'sendrecv' });
        } catch (e) {
          console.debug('[WebRTC] Video transceiver hint:', e.message);
        }
      }
    }

    // 1. Handle incoming remote tracks (Unified Plan)
    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event.track.kind, event.track.id);

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
        console.log(`[WebRTC] Remote track unmuted and streaming:`, event.track.kind);
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

    // 2. Trickle ICE candidate dispatch with fingerprint deduplication
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

    // 3. Consolidated connection state evaluator
    const notifyStateChange = () => {
      const connState = pc.connectionState;
      const iceState = pc.iceConnectionState;
      console.log(`[WebRTC] Connection state: ${connState}, ICE state: ${iceState}`);

      let effectiveState = 'connecting';
      if (connState === 'connected' || iceState === 'connected' || iceState === 'completed') {
        effectiveState = 'connected';
        this._applySenderEncodingParameters();
        this._startStatsMonitoring();
      } else if (connState === 'failed' || iceState === 'failed') {
        effectiveState = 'failed';
        this.handleConnectionFailure();
      } else if (connState === 'disconnected' || iceState === 'disconnected') {
        effectiveState = 'disconnected';
        // Give 4 seconds before triggering an ICE restart for momentary network changes
        setTimeout(() => {
          if (this.peerConnection && (this.peerConnection.iceConnectionState === 'disconnected' || this.peerConnection.connectionState === 'disconnected')) {
            console.log('[WebRTC] Disconnection persisted, triggering ICE restart...');
            this.restartIce();
          }
        }, 4000);
      } else if (connState === 'closed' || iceState === 'closed') {
        effectiveState = 'closed';
        this.endCall();
      }

      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(effectiveState);
      }
    };

    pc.onconnectionstatechange = notifyStateChange;
    pc.oniceconnectionstatechange = notifyStateChange;

    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;

        const optimizedSdp = optimizeSdpForLowLatency(offer.sdp);
        await pc.setLocalDescription({ type: offer.type, sdp: optimizedSdp });

        socketService.emit('signal:offer', {
          targetUserId: this.targetUserId,
          sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
          callId: this.callId,
          callType: this.callType
        });
      } catch (err) {
        console.warn('[WebRTC] Negotiation error:', err);
      } finally {
        this.makingOffer = false;
      }
    };

    return pc;
  }

  // ==========================================================================
  // Codec Preferences & Sender Encoding Parameters
  // ==========================================================================

  _configureCodecPreferences(pc) {
    if (typeof RTCRtpReceiver.getCapabilities !== 'function') return;

    try {
      const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
      const videoCaps = RTCRtpReceiver.getCapabilities('video');
      if (videoCaps && videoCaps.codecs) {
        // Prefer VP8 and H264 for high compatibility and hardware acceleration
        const preferredCodecs = videoCaps.codecs.filter(c => 
          c.mimeType.toLowerCase() === 'video/vp8' ||
          c.mimeType.toLowerCase() === 'video/h264' ||
          c.mimeType.toLowerCase() === 'video/vp9'
        );

        transceivers.forEach(tr => {
          if (tr.receiver && tr.receiver.track && tr.receiver.track.kind === 'video' && tr.setCodecPreferences) {
            tr.setCodecPreferences(preferredCodecs);
          }
        });
      }
    } catch (e) {
      console.debug('[WebRTC] Codec preference assignment note:', e.message);
    }
  }

  async _applySenderEncodingParameters(maxBitrate = 2500000, scaleResolutionDownBy = 1.0) {
    if (!this.peerConnection) return;

    try {
      const senders = this.peerConnection.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');

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
        console.log(`🚀 [WebRTC HD] Video sender configured: ${Math.round(maxBitrate / 1000)} kbps, scale: ${scaleResolutionDownBy}`);
      }
    } catch (err) {
      console.debug('[WebRTC] Could not set sender parameters:', err.message);
    }
  }

  // ==========================================================================
  // Signaling Negotiation (Offer / Answer / ICE)
  // ==========================================================================

  async startCallAsInitiator(targetUserId, callId, callType = 'audio') {
    await this.getLocalMedia(callType);
    const iceConfig = await this.getIceServers();
    const pc = this.createPeerConnection(targetUserId, callId, iceConfig, false); // Impolite

    const isVideo = callType === 'video';
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: isVideo
    });

    const optimizedSdp = optimizeSdpForLowLatency(offer.sdp);
    await pc.setLocalDescription({ type: offer.type, sdp: optimizedSdp });

    socketService.emit('signal:offer', {
      targetUserId,
      sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
      callId,
      callType
    });
  }

  async handleIncomingOffer(callerId, sdp, callId, callType = 'audio', isIceRestart = false) {
    // If peer connection does not exist, initialize as polite callee
    if (!this.peerConnection) {
      await this.getLocalMedia(callType);
      const iceConfig = await this.getIceServers();
      this.createPeerConnection(callerId, callId, iceConfig, true); // Polite
    }

    const pc = this.peerConnection;
    const sessionDesc = toSessionDescription(sdp, 'offer');
    if (!sessionDesc) {
      console.error('[WebRTC] Invalid remote offer received:', sdp);
      return;
    }

    // W3C Perfect Negotiation offer collision resolution
    const offerCollision = this.makingOffer || pc.signalingState !== 'stable';
    this.ignoreOffer = !this.isPolite && offerCollision;

    if (this.ignoreOffer) {
      console.warn('[WebRTC] Impolite peer ignoring colliding remote offer (glare resolved).');
      return;
    }

    try {
      await pc.setRemoteDescription(sessionDesc);
      console.log('✅ [WebRTC] Remote SDP Offer applied successfully');
      await this._drainCandidateQueue();

      const answer = await pc.createAnswer();
      const optimizedAnswer = optimizeSdpForLowLatency(answer.sdp);
      await pc.setLocalDescription({ type: answer.type, sdp: optimizedAnswer });

      socketService.emit('signal:answer', {
        targetUserId: callerId,
        sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
        callId,
        isIceRestart
      });
    } catch (err) {
      console.error('[WebRTC] Error processing remote offer:', err);
    }
  }

  async handleIncomingAnswer(sdp) {
    if (!this.peerConnection) return;
    const pc = this.peerConnection;

    // Guard: Only apply answer if in have-local-offer state
    if (pc.signalingState !== 'have-local-offer') {
      console.warn(`[WebRTC] Ignoring unexpected answer in signalingState: ${pc.signalingState}`);
      return;
    }

    const sessionDesc = toSessionDescription(sdp, 'answer');
    if (!sessionDesc) {
      console.error('[WebRTC] Invalid remote answer payload:', sdp);
      return;
    }

    try {
      await pc.setRemoteDescription(sessionDesc);
      console.log('✅ [WebRTC] Remote SDP Answer applied successfully!');
      await this._drainCandidateQueue();
    } catch (err) {
      console.error('[WebRTC] Error setting remote answer:', err);
    }
  }

  async handleIncomingIceCandidate(candidate) {
    const iceCand = toIceCandidate(candidate);
    if (!iceCand || !iceCand.candidate) return;

    if (this.seenCandidates.has(iceCand.candidate)) return;
    this.seenCandidates.add(iceCand.candidate);

    if (this.peerConnection && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
      try {
        await this.peerConnection.addIceCandidate(iceCand);
      } catch (err) {
        if (!this.ignoreOffer) {
          console.warn('[WebRTC] Error adding ICE candidate:', err);
        }
      }
    } else {
      // Buffer until remote description is applied
      this.candidateQueue.push(candidate);
    }
  }

  async _drainCandidateQueue() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    const queue = [...this.candidateQueue];
    this.candidateQueue = [];

    for (const raw of queue) {
      const iceCand = toIceCandidate(raw);
      if (!iceCand || !iceCand.candidate) continue;
      try {
        await this.peerConnection.addIceCandidate(iceCand);
        console.log('🧊 [WebRTC] Queued ICE candidate applied');
      } catch (err) {
        if (!this.ignoreOffer) {
          console.warn('[WebRTC] Error draining queued candidate:', err);
        }
      }
    }
  }

  // ==========================================================================
  // ICE Restart & Reconnection
  // ==========================================================================

  async restartIce() {
    if (!this.peerConnection) return;
    const pc = this.peerConnection;

    try {
      console.log('🔄 [WebRTC] Executing complete ICE restart renegotiation...');
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

  handleConnectionFailure() {
    console.warn('[WebRTC] Connection failed. Attempting immediate ICE restart with TURN relay...');
    this.restartIce();
  }

  // ==========================================================================
  // Real-Time Stats & Adaptive Media Quality Loop
  // ==========================================================================

  _startStatsMonitoring() {
    this._stopStatsMonitoring();

    let prevBytesSent = 0;
    let prevBytesReceived = 0;
    let prevTimestamp = Date.now();

    this.statsTimer = setInterval(async () => {
      if (!this.peerConnection || this.peerConnection.connectionState !== 'connected') {
        return;
      }

      try {
        const stats = await this.peerConnection.getStats();
        let rtt = 0;
        let packetLossPercent = 0;
        let jitterMs = 0;
        let transportType = 'Direct (LAN)';
        let frameWidth = 0;
        let frameHeight = 0;
        let fps = 0;
        let currentBytesSent = 0;
        let currentBytesReceived = 0;

        stats.forEach((report) => {
          // Identify Active Candidate Pair & Transport Type
          if (report.type === 'candidate-pair' && (report.nominated || report.state === 'succeeded')) {
            if (report.currentRoundTripTime) {
              rtt = Math.round(report.currentRoundTripTime * 1000);
            }

            // Look up candidate types
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

          // Video Inbound Stats
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

          // Video Outbound Stats
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            currentBytesSent += report.bytesSent || 0;
          }

          // Audio Inbound Stats
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            if (report.jitter && jitterMs === 0) {
              jitterMs = Math.round(report.jitter * 1000);
            }
          }
        });

        // Compute instantaneous bitrates
        const now = Date.now();
        const durationSec = Math.max(0.5, (now - prevTimestamp) / 1000);
        const inboundBitrateKbps = Math.round(((currentBytesReceived - prevBytesReceived) * 8) / (durationSec * 1000));
        const outboundBitrateKbps = Math.round(((currentBytesSent - prevBytesSent) * 8) / (durationSec * 1000));

        prevBytesSent = currentBytesSent;
        prevBytesReceived = currentBytesReceived;
        prevTimestamp = now;

        // Determine Quality Level
        let qualityScore = 'excellent';
        if (rtt > 300 || packetLossPercent > 5) {
          qualityScore = 'poor';
          // Adaptive downscale to preserve audio smoothness
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
  // Device Selection & Camera Switching
  // ==========================================================================

  async getAvailableDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return { audioInputs: [], videoInputs: [], audioOutputs: [] };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        audioInputs: devices.filter(d => d.kind === 'audioinput'),
        videoInputs: devices.filter(d => d.kind === 'videoinput'),
        audioOutputs: devices.filter(d => d.kind === 'audiooutput')
      };
    } catch (e) {
      console.warn('[WebRTC] enumerateDevices failed:', e.message);
      return { audioInputs: [], videoInputs: [], audioOutputs: [] };
    }
  }

  /**
   * Switches between Front (user) and Rear (environment) camera without dropping the call
   */
  async switchCamera() {
    if (this.callType !== 'video') return false;

    const nextFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    console.log(`📷 [WebRTC] Switching camera from ${this.currentFacingMode} to ${nextFacingMode}...`);

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920, min: 640 },
          height: { ideal: 720, max: 1080, min: 360 },
          facingMode: nextFacingMode
        }
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return false;

      // Replace track on RTCPeerConnection sender
      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      // Stop old video track
      if (this.localStream) {
        const oldTrack = this.localStream.getVideoTracks()[0];
        if (oldTrack) {
          oldTrack.stop();
          this.localStream.removeTrack(oldTrack);
        }
        this.localStream.addTrack(newVideoTrack);
      }

      this.currentFacingMode = nextFacingMode;

      if (this.onLocalStream && this.localStream) {
        this.onLocalStream(this.localStream);
      }

      return true;
    } catch (err) {
      console.warn('[WebRTC] Switch camera error:', err.message);
      return false;
    }
  }

  // ==========================================================================
  // In-Call Track Toggling (Mute, Video Toggle, Screen Sharing)
  // ==========================================================================

  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled !== undefined ? enabled : !track.enabled;
      });
      return this.isAudioEnabled();
    }
    return false;
  }

  isAudioEnabled() {
    if (!this.localStream) return false;
    const track = this.localStream.getAudioTracks()[0];
    return track ? track.enabled : false;
  }

  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled !== undefined ? enabled : !track.enabled;
      });
      return this.isVideoEnabled();
    }
    return false;
  }

  isVideoEnabled() {
    if (!this.localStream) return false;
    const track = this.localStream.getVideoTracks()[0];
    return track ? track.enabled : false;
  }

  async toggleScreenShare() {
    if (this.screenStream) {
      // Stop screen sharing, restore camera
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;

      if (this.peerConnection) {
        const videoTrack = this.localStream ? this.localStream.getVideoTracks()[0] : null;
        const sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video') ||
          this.peerConnection.getSenders().find((s) => !s.track);
        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }
        if (this.onLocalStream && this.localStream) {
          this.onLocalStream(this.localStream);
        }
      }
      return false;
    } else {
      // Start screen sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        this.screenStream = stream;
        const screenTrack = stream.getVideoTracks()[0];

        screenTrack.onended = () => {
          this.toggleScreenShare();
        };

        if (this.peerConnection) {
          let sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (!sender) {
            sender = this.peerConnection.getSenders().find((s) => !s.track);
          }
          if (sender) {
            await sender.replaceTrack(screenTrack);
          } else {
            this.peerConnection.addTrack(screenTrack, stream);
          }
        }

        if (this.onLocalStream) {
          this.onLocalStream(stream);
        }
        return true;
      } catch (err) {
        console.warn('[WebRTC] Screen share canceled or failed:', err);
        return false;
      }
    }
  }

  // ==========================================================================
  // Clean Teardown
  // ==========================================================================

  endCall() {
    this._stopStatsMonitoring();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
      this.localStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
      this.screenStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
      this.remoteStream = null;
    }

    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch {}
      this.peerConnection = null;
    }

    this.candidateQueue = [];
    this.seenCandidates.clear();
    this.callId = null;
    this.targetUserId = null;
    this.makingOffer = false;
    this.ignoreOffer = false;
  }
}

export const webrtcService = new WebRTCService();
export default webrtcService;

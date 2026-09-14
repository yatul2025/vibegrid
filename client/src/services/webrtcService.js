/**
 * client/src/services/webrtcService.js
 * ====================================
 * WebRTC 1-to-1 Audio & Video Calling Manager
 * 
 * Features:
 * 1. RTCPeerConnection lifecycle with public STUN servers.
 * 2. Media stream acquisition (Microphone, Camera, Screen Sharing).
 * 3. Bidirectional SDP Offer/Answer negotiation & ICE Candidate buffering.
 * 4. In-call track toggling (Mute, Camera on/off, Screen share).
 * 5. Clean teardown and hardware resource release.
 */

import socketService from './socketService';
import apiClient from '../api/client';

const DEFAULT_ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ]
};

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

class WebRTCService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.screenStream = null;
    this.candidateQueue = [];
    this.callId = null;
    this.targetUserId = null;
    this.callType = 'audio'; // 'audio' | 'video'

    // Callbacks for UI components
    this.onLocalStream = null;
    this.onRemoteStream = null;
    this.onConnectionStateChange = null;
    this.onError = null;
  }

  // ==========================================================================
  // Media Stream Initialization
  // ==========================================================================

  async getLocalMedia(callType = 'audio') {
    this.callType = callType;
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: callType === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.onLocalStream) {
        this.onLocalStream(this.localStream);
      }
      return this.localStream;
    } catch (err) {
      console.warn('[WebRTC] Preferred getUserMedia failed, attempting fallback:', err.message);
      try {
        if (callType === 'video') {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
          });
        } else {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        if (this.onLocalStream) {
          this.onLocalStream(this.localStream);
        }
        return this.localStream;
      } catch (err2) {
        console.warn('[WebRTC] Video fallback failed, falling back to audio only:', err2.message);
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
  // Dynamic ICE / TURN Server Resolution
  // ==========================================================================

  async getIceServers() {
    try {
      const res = await apiClient.get('/calls/turn-credentials');
      if (res.success && Array.isArray(res.data?.iceServers) && res.data.iceServers.length > 0) {
        return { iceServers: res.data.iceServers };
      }
    } catch (err) {
      console.warn('[WebRTC] Using default STUN servers:', err.message);
    }
    return DEFAULT_ICE_SERVERS;
  }

  // ==========================================================================
  // PeerConnection Setup
  // ==========================================================================

  createPeerConnection(targetUserId, callId, iceConfig = DEFAULT_ICE_SERVERS) {
    this.targetUserId = Number(targetUserId);
    this.callId = callId;
    // CRITICAL: Do NOT wipe this.candidateQueue here! Early ICE candidates
    // may have already arrived over serverless HTTP before the offer/answer.
    if (!Array.isArray(this.candidateQueue)) {
      this.candidateQueue = [];
    }

    const pc = new RTCPeerConnection(iceConfig);
    this.peerConnection = pc;

    this.remoteStream = new MediaStream();
    if (this.onRemoteStream) {
      this.onRemoteStream(this.remoteStream);
    }

    // Attach local media tracks to peer connection
    let hasLocalVideo = false;
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (track.kind === 'video') hasLocalVideo = true;
        pc.addTrack(track, this.localStream);
      });
    }

    // If audio-only call, prepare video transceiver so screen share / video can be added without renegotiation
    if (!hasLocalVideo) {
      try {
        pc.addTransceiver('video', { direction: 'sendrecv' });
      } catch (e) {
        console.debug('[WebRTC] Video transceiver note:', e.message);
      }
    }

    // Handle incoming remote media tracks (supports both streams array and Unified Plan direct tracks)
    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event.track.kind, event.track.id);

      const incomingStream = (event.streams && event.streams[0]) ? event.streams[0] : null;
      if (incomingStream) {
        this.remoteStream = incomingStream;
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

    // Handle local ICE candidates to relay over Socket.IO / HTTP Serverless
    pc.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate) {
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

    // Monitor connection states with consolidated state evaluation
    const notifyStateChange = () => {
      const connState = pc.connectionState;
      const iceState = pc.iceConnectionState;
      console.log(`[WebRTC] Connection state: ${connState}, ICE state: ${iceState}`);

      let effectiveState = 'connecting';
      if (connState === 'connected' || iceState === 'connected' || iceState === 'completed') {
        effectiveState = 'connected';
      } else if (connState === 'failed' || iceState === 'failed') {
        effectiveState = 'failed';
      } else if (connState === 'disconnected' || iceState === 'disconnected') {
        effectiveState = 'disconnected';
      } else if (connState === 'closed' || iceState === 'closed') {
        effectiveState = 'closed';
      }

      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(effectiveState);
      }
    };

    pc.onconnectionstatechange = () => {
      notifyStateChange();
      if (pc.connectionState === 'failed') {
        console.warn('[WebRTC] Connection failed, attempting ICE restart...');
        try {
          if (typeof pc.restartIce === 'function') pc.restartIce();
        } catch {}
      } else if (pc.connectionState === 'closed') {
        this.endCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      notifyStateChange();
      if (pc.iceConnectionState === 'failed') {
        console.warn('[WebRTC] ICE failed, triggering ICE restart...');
        try {
          if (typeof pc.restartIce === 'function') pc.restartIce();
        } catch {}
      }
    };

    return pc;
  }

  // ==========================================================================
  // Signaling Negotiation (SDP Offer / Answer & ICE)
  // ==========================================================================

  async startCallAsInitiator(targetUserId, callId, callType = 'audio') {
    await this.getLocalMedia(callType);
    const iceConfig = await this.getIceServers();
    const pc = this.createPeerConnection(targetUserId, callId, iceConfig);

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true // Always receive video so screen share or camera upgrade works seamlessly
    });

    await pc.setLocalDescription(offer);

    const offerPayload = offer.toJSON ? offer.toJSON() : {
      type: offer.type,
      sdp: offer.sdp
    };

    socketService.emit('signal:offer', {
      targetUserId,
      sdp: offerPayload,
      callId,
      callType
    });
  }

  async handleIncomingOffer(callerId, sdp, callId, callType = 'audio') {
    await this.getLocalMedia(callType);
    const iceConfig = await this.getIceServers();
    const pc = this.createPeerConnection(callerId, callId, iceConfig);

    const sessionDesc = toSessionDescription(sdp, 'offer');
    if (sessionDesc) {
      await pc.setRemoteDescription(sessionDesc);
      console.log('✅ [WebRTC] Remote SDP Offer accepted and applied successfully');
    } else {
      console.error('[WebRTC] Invalid SDP offer payload:', sdp);
    }

    // Drain queued ICE candidates that arrived before the offer
    await this._drainCandidateQueue();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const answerPayload = answer.toJSON ? answer.toJSON() : {
      type: answer.type,
      sdp: answer.sdp
    };

    socketService.emit('signal:answer', {
      targetUserId: callerId,
      sdp: answerPayload,
      callId
    });
  }

  async handleIncomingAnswer(sdp) {
    if (!this.peerConnection) return;
    const sessionDesc = toSessionDescription(sdp, 'answer');
    if (sessionDesc) {
      await this.peerConnection.setRemoteDescription(sessionDesc);
      console.log('✅ [WebRTC] Remote SDP Answer accepted and applied successfully!');
    } else {
      console.error('[WebRTC] Invalid SDP answer payload:', sdp);
    }
    await this._drainCandidateQueue();
  }

  async handleIncomingIceCandidate(candidate) {
    const iceCand = toIceCandidate(candidate);
    if (!iceCand) return;

    if (this.peerConnection && this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(iceCand);
      } catch (err) {
        console.warn('[WebRTC] Error adding ICE candidate:', err);
      }
    } else {
      // Buffer candidate until remote description is set
      this.candidateQueue.push(candidate);
    }
  }

  async _drainCandidateQueue() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    const queue = [...this.candidateQueue];
    this.candidateQueue = [];

    for (const raw of queue) {
      const iceCand = toIceCandidate(raw);
      if (!iceCand) continue;
      try {
        await this.peerConnection.addIceCandidate(iceCand);
        console.log('🧊 [WebRTC] Queued ICE candidate added successfully');
      } catch (err) {
        console.warn('[WebRTC] Error draining ICE candidate:', err);
      }
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
      // Stop screen sharing, restore camera or blank video
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;

      if (this.peerConnection) {
        const videoTrack = this.localStream ? this.localStream.getVideoTracks()[0] : null;
        const sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video') ||
          this.peerConnection.getSenders().find((s) => !s.track);
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
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
            // Check for sender without track (from pre-negotiated transceiver)
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
    this.callId = null;
    this.targetUserId = null;
  }
}

export const webrtcService = new WebRTCService();
export default webrtcService;

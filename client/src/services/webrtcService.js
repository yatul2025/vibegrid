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
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
};

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
      console.error('[WebRTC] Media device access error:', err);
      if (this.onError) this.onError(err);
      throw err;
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
    this.candidateQueue = [];

    const pc = new RTCPeerConnection(iceConfig);
    this.peerConnection = pc;

    this.remoteStream = new MediaStream();
    if (this.onRemoteStream) {
      this.onRemoteStream(this.remoteStream);
    }

    // Attach local media tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Handle incoming remote media tracks (supports both streams array and Unified Plan direct tracks)
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

      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream);
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

    // Monitor connection states
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state changed to:', pc.connectionState);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(pc.connectionState);
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.endCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', pc.iceConnectionState);
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
      offerToReceiveVideo: callType === 'video'
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

    const sdpObj = (sdp && typeof sdp === 'object' && sdp.sdp) ? sdp : { type: 'offer', sdp };
    await pc.setRemoteDescription(new RTCSessionDescription(sdpObj));

    // Drain queued ICE candidates
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
    const sdpObj = (sdp && typeof sdp === 'object' && sdp.sdp) ? sdp : { type: 'answer', sdp };
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdpObj));
    await this._drainCandidateQueue();
  }

  async handleIncomingIceCandidate(candidate) {
    if (!candidate || !candidate.candidate) return;

    if (this.peerConnection && this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] Error adding ICE candidate:', err);
      }
    } else {
      this.candidateQueue.push(candidate);
    }
  }

  async _drainCandidateQueue() {
    if (!this.peerConnection) return;
    while (this.candidateQueue.length > 0) {
      const candidate = this.candidateQueue.shift();
      if (!candidate || !candidate.candidate) continue;
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
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
      // Stop screen sharing, restore camera
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;

      if (this.localStream && this.peerConnection) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        const sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
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
          const sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
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
        track.stop();
      });
      this.localStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.screenStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.remoteStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.candidateQueue = [];
    this.callId = null;
    this.targetUserId = null;
  }
}

export const webrtcService = new WebRTCService();
export default webrtcService;

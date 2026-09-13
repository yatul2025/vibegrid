# VibeGrid WebRTC SFU Architecture & Multi-Party Calling Blueprint

This document outlines the production architecture for scaling VibeGrid's audio/video calling from 1-to-1 peer-to-peer (P2P) mesh to large multi-party group video calls using a **Selective Forwarding Unit (SFU)**.

---

## 1. Network Topology Comparison

```mermaid
graph TD
    subgraph P2P Mesh (1-to-1 Only)
        Alice[Alice] <-->|Bidirectional Stream| Bob[Bob]
    end

    subgraph Multi-Party SFU Architecture (3+ Users)
        A[User A] -->|1 Upstream Stream| SFU[Selective Forwarding Unit]
        B[User B] -->|1 Upstream Stream| SFU
        C[User C] -->|1 Upstream Stream| SFU
        D[User D] -->|1 Upstream Stream| SFU

        SFU -.->|Downstream Tracks| A
        SFU -.->|Downstream Tracks| B
        SFU -.->|Downstream Tracks| C
        SFU -.->|Downstream Tracks| D
    end
```

### Why Mesh Fails for 3+ Participants:
- In a full mesh network of $N$ participants, each client must send $N - 1$ video streams and receive $N - 1$ video streams.
- For 5 participants, each phone must encode and upload 4 separate video streams ($4 \times 1.5\text{ Mbps} = 6\text{ Mbps}$ uplink), which exhausts mobile battery and saturates cellular networks.

### Why SFU is the Industry Standard:
- **Single Uplink**: Each client encodes and uploads their audio/video stream **once** to the SFU media server.
- **Selective Forwarding**: The SFU duplicates and routes media packets without re-encoding, preserving server CPU and maintaining sub-150ms latency.
- **Simulcast / SVC**: The client sends 3 layers (Low 180p, Medium 360p, High 720p). The SFU forwards lower resolutions to small grid tiles and high resolution to the active speaker.

---

## 2. Recommended Production SFU: LiveKit

We recommend **LiveKit** (Go-based, WebRTC SFU) for VibeGrid due to its native React SDK and automatic simulcast adaptation.

### Docker Deployment (`docker-compose.yml`)

```yaml
version: '3.9'

services:
  livekit:
    image: livekit/livekit-server:latest
    restart: unless-stopped
    command: --config /etc/livekit.yaml
    network_mode: host
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml
    environment:
      - LIVEKIT_KEYS=API_KEY:API_SECRET
```

### LiveKit Configuration (`livekit.yaml`)

```yaml
port: 7880
bind_addresses:
  - "0.0.0.0"
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
  stun_servers:
    - "stun.l.google.com:19302"
turn:
  enabled: true
  domain: "turn.vibegrid.app"
  cert_file: "/etc/certs/fullchain.pem"
  key_file: "/etc/certs/privkey.pem"
```

---

## 3. Node.js Backend Token Generator (`livekit-server-sdk`)

In `server/src/controllers/callController.js`, add the room access token endpoint:

```javascript
const { AccessToken } = require('livekit-server-sdk');

const generateGroupCallToken = (req, res) => {
  const { roomName } = req.body;
  const userId = String(req.user.id);
  const username = req.user.username;

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: userId,
      name: username
    }
  );

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true
  });

  res.status(200).json({
    success: true,
    token: at.toJwt()
  });
};
```

---

## 4. Bandwidth & Resource Sizing

| Metric | 1-to-1 (P2P Mesh) | 4-Person Group (SFU) | 12-Person Group (SFU) |
| :--- | :--- | :--- | :--- |
| **Client Upload** | ~1.5 Mbps | ~1.8 Mbps (Simulcast) | ~1.8 Mbps (Simulcast) |
| **Client Download** | ~1.5 Mbps | ~3.5 Mbps | ~5.0 Mbps |
| **Server CPU Load** | 0% (Direct peer) | ~0.5% core / call | ~1.5% core / call |
| **Encryption** | WebRTC DTLS-SRTP | WebRTC DTLS-SRTP | WebRTC DTLS-SRTP |

# Twitch Streaming Integration Setup Guide

## Current Implementation Status

✅ **Completed:**
- Twitch streaming UI controls
- Stream key management (save/load from Supabase)
- Video capture from Decart restyled output
- MediaRecorder integration for capturing video chunks
- Edge function infrastructure (placeholder)

⚠️ **Production Setup Required:**
- WebRTC to RTMP conversion server
- Actual RTMP streaming to Twitch

---

## How It Works (Current Implementation)

### Frontend Flow:
```
1. User starts Decart video restyling
2. Restyled video stream appears (WebRTC)
3. User enters Twitch stream key
4. User clicks "Start Streaming"
5. MediaRecorder captures restyled video
6. Chunks are sent to edge function every 5 seconds
```

### What's Missing for Production:
The edge function currently receives video chunks but **does not forward them to Twitch RTMP**. This is because:
- Edge functions have execution time limits (25s for Supabase)
- RTMP streaming requires persistent connections
- Video transcoding needs FFmpeg or similar tools
- WebRTC → RTMP conversion is resource-intensive

---

## Production Setup Options

### Option 1: Self-Hosted Media Server (Recommended for Learning)

**Using SRS (Simple Realtime Server) - FREE & Open Source**

#### 1. Install SRS via Docker
```bash
docker run -d \
  --name srs \
  -p 1935:1935 \
  -p 1985:1985 \
  -p 8080:8080 \
  -p 8000:8000/udp \
  ossrs/srs:5
```

#### 2. Configure SRS for WebRTC → RTMP
Create `srs.conf`:
```nginx
listen              1935;
max_connections     1000;
daemon              off;
srs_log_tank        console;

http_server {
    enabled         on;
    listen          8080;
}

http_api {
    enabled         on;
    listen          1985;
}

rtc_server {
    enabled on;
    listen 8000;
    candidate $CANDIDATE;
}

vhost __defaultVhost__ {
    rtc {
        enabled     on;
        rtmp_to_rtc on;
        rtc_to_rtmp on;
    }

    http_remux {
        enabled     on;
    }

    # Forward to Twitch
    forward {
        enabled on;
        destination rtmp://live.twitch.tv/app/YOUR_STREAM_KEY;
    }
}
```

#### 3. Update Frontend Code
Modify `src/lib/twitchStreaming.ts`:

```typescript
async startStreaming(
  videoStream: MediaStream,
  streamKey: string,
  onStatsUpdate?: (stats: StreamStats) => void
): Promise<void> {
  // Instead of MediaRecorder, use WebRTC to SRS
  const pc = new RTCPeerConnection();

  // Add video track
  videoStream.getTracks().forEach(track => {
    pc.addTrack(track, videoStream);
  });

  // Create offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // Send to SRS WebRTC endpoint
  const response = await fetch('http://your-srs-server:1985/rtc/v1/publish/', {
    method: 'POST',
    body: JSON.stringify({
      streamurl: `webrtc://your-srs-server/live/${streamKey}`,
      sdp: offer.sdp,
    }),
  });

  const answer = await response.json();
  await pc.setRemoteDescription(new RTCSessionDescription({
    type: 'answer',
    sdp: answer.sdp,
  }));

  this.peerConnection = pc;
}
```

#### 4. Resources
- SRS Documentation: https://ossrs.io/
- WebRTC Guide: https://ossrs.io/lts/en-us/docs/v5/doc/webrtc
- GitHub: https://github.com/ossrs/srs

---

### Option 2: Cloud Service (Easiest for Production)

**Using AWS IVS (Interactive Video Service)**

#### 1. Create IVS Channel
```bash
aws ivs create-channel \
  --name "live-style-studio" \
  --latency-mode LOW
```

#### 2. Get Ingest Endpoint and Stream Key
```bash
aws ivs get-stream-key --arn <channel-arn>
```

#### 3. Update Environment Variables
```bash
VITE_IVS_INGEST_ENDPOINT=rtmps://xxx.global-contribute.live-video.net:443/app/
VITE_IVS_STREAM_KEY=your_stream_key
```

#### 4. Forward to Twitch
Configure IVS to forward to Twitch RTMP:
- Use AWS Lambda + MediaLive for forwarding
- Or use IVS with multiple destinations

**Pricing:** ~$0.015 per GB ingested + ~$0.005 per GB delivered

**Resources:**
- AWS IVS: https://aws.amazon.com/ivs/
- Multi-destination streaming: https://docs.aws.amazon.com/ivs/

---

### Option 3: Dedicated Streaming Service

**Using Mux Live Streaming API**

#### 1. Sign up for Mux
https://mux.com/

#### 2. Create Live Stream
```bash
curl -X POST https://api.mux.com/video/v1/live-streams \
  -H "Content-Type: application/json" \
  -u ${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET} \
  -d '{
    "playback_policy": ["public"],
    "new_asset_settings": { "playback_policy": ["public"] },
    "reconnect_window": 60,
    "passthrough": "your-stream-id"
  }'
```

#### 3. Get RTMP Credentials
Response includes:
```json
{
  "stream_key": "abc123",
  "url": "rtmp://live.mux.com/app/"
}
```

#### 4. Configure Simultaneous Streaming to Twitch
Use Mux's multi-stream feature to send to both Mux and Twitch.

**Pricing:** ~$0.005 per minute of video processed

**Resources:**
- Mux Docs: https://docs.mux.com/guides/video/stream-live
- WebRTC to Mux: https://docs.mux.com/guides/video/broadcast-live-video-webrtc

---

### Option 4: Ant Media Server (Self-Hosted, Commercial Features)

**Features:**
- WebRTC ingestion
- RTMP output
- Adaptive bitrate
- Recording
- One-to-many streaming

**Installation:**
```bash
wget -O install_ant-media-server.sh \
  https://raw.githubusercontent.com/ant-media/Scripts/master/install_ant-media-server.sh
chmod +x install_ant-media-server.sh
sudo ./install_ant-media-server.sh
```

**Configuration:**
1. Access Web Panel: http://your-server:5080
2. Create WebRTC stream
3. Configure RTMP endpoint to Twitch
4. Use WebRTC SDK in frontend

**Pricing:**
- Community Edition: Free
- Enterprise: $799-$2,999/year

**Resources:**
- Website: https://antmedia.io/
- Documentation: https://github.com/ant-media/Ant-Media-Server/wiki

---

## Recommended Approach for This Project

### For Testing/Development:
**Use SRS (Option 1)**
- Free and open source
- Easy to set up with Docker
- Full control
- Learn how streaming works

### For Production:
**Use AWS IVS or Mux (Options 2 & 3)**
- Managed service (no server maintenance)
- Auto-scaling
- Low latency
- Reliable
- Pay only for what you use

---

## Implementation Checklist

### Phase 1: Current UI (✅ DONE)
- [x] Twitch stream controls UI
- [x] Stream key management
- [x] Video capture with MediaRecorder
- [x] Edge function infrastructure

### Phase 2: Media Server Setup (TODO)
- [ ] Choose media server option (SRS, AWS IVS, Mux, or Ant Media)
- [ ] Deploy/configure media server
- [ ] Update frontend to use WebRTC → Media Server
- [ ] Configure media server → Twitch RTMP forwarding

### Phase 3: Production Features (TODO)
- [ ] Stream health monitoring
- [ ] Reconnection logic
- [ ] Bitrate adaptation
- [ ] Recording/archiving
- [ ] Analytics integration
- [ ] Multi-platform streaming (YouTube, Facebook)

---

## Environment Variables Reference

```bash
# Supabase (Already configured)
VITE_SUPABASE_PROJECT_ID="hwoaizhadbwqaqdlfbic"
VITE_SUPABASE_PUBLISHABLE_KEY="your_anon_key"
VITE_SUPABASE_URL="https://hwoaizhadbwqaqdlfbic.supabase.co"

# Twitch (Already configured)
VITE_TWITCH_RTMP_URL="rtmp://live.twitch.tv/app/"

# Media Server (Choose one)
# Option 1: SRS
VITE_SRS_SERVER_URL="http://your-srs-server:1985"

# Option 2: AWS IVS
VITE_IVS_INGEST_ENDPOINT="rtmps://xxx.global-contribute.live-video.net:443/app/"
VITE_IVS_STREAM_KEY="your_stream_key"

# Option 3: Mux
VITE_MUX_STREAM_URL="rtmp://live.mux.com/app/"
VITE_MUX_TOKEN_ID="your_token_id"
VITE_MUX_TOKEN_SECRET="your_token_secret"
```

---

## Testing the Current Implementation

Even though RTMP streaming isn't fully functional, you can test the UI:

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Start Decart video stream
3. Enter a test Twitch stream key (or any string for testing)
4. Click "Start Streaming"
5. Observe:
   - Stream duration counter
   - Data sent counter
   - Video chunks being captured
   - Console logs in browser dev tools

The edge function will receive the chunks and log them, confirming the capture pipeline works.

---

## Next Steps

1. **Choose your media server** based on your needs:
   - Learning/Development: SRS
   - Production/Scale: AWS IVS or Mux
   - Full control: Ant Media Server

2. **Set up the chosen server** following the guide above

3. **Update the frontend code** to connect to your media server

4. **Test end-to-end** streaming to Twitch

5. **Add production features** like monitoring, analytics, etc.

---

## Support & Resources

- **SRS Discord:** https://discord.gg/yZ4BnPmHAd
- **Twitch Developer:** https://dev.twitch.tv/docs/
- **WebRTC Samples:** https://webrtc.github.io/samples/
- **MDN MediaRecorder:** https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder

---

## Notes

The current implementation provides a **complete UI and video capture pipeline**. The only missing piece is the actual RTMP forwarding, which requires infrastructure outside of edge functions. This separation is by design - it allows you to:

1. Test the UI without a media server
2. Choose the best media server for your needs
3. Swap implementations easily
4. Scale independently

Once you set up a media server, you'll have full Twitch streaming capability!

# Live Streaming Platform Integration Guide

## Project Status

### Backend Connection ✅
The backend is **already connected to Supabase** (not Lovable Cloud):
- Location: `src/integrations/supabase/client.ts`
- Project ID: `xrbtfvnkptlwynnumifx`
- URL: `https://xrbtfvnkptlwynnumifx.supabase.co`
- Status: Ready for development

---

## Streaming Platform Comparison

### 1. Twitch ⭐ RECOMMENDED FOR EASIEST START

#### Overview
- **Difficulty:** Low
- **Setup Time:** 1-2 days
- **Best For:** Quick prototyping, gaming/creative content
- **Official API:** Yes

#### Integration Steps
1. **Get Stream Credentials**
   ```
   Twitch RTMP URL: rtmp://live.twitch.tv/app/
   Stream Key: Obtain from Twitch Dashboard
   ```

2. **Authentication**
   - OAuth 2.0 with simple flow
   - Client ID and Client Secret
   - Scopes: `channel:manage:broadcast`, `user:read:broadcast`

3. **API Endpoints**
   ```javascript
   // Get Stream Key
   GET https://api.twitch.tv/helix/streams/key

   // Update Stream Info
   PATCH https://api.twitch.tv/helix/channels
   ```

4. **Code Example (JavaScript)**
   ```javascript
   // Twitch API Configuration
   const TWITCH_CLIENT_ID = 'your_client_id';
   const TWITCH_CLIENT_SECRET = 'your_client_secret';
   const TWITCH_RTMP_URL = 'rtmp://live.twitch.tv/app/';

   // Get OAuth Token
   async function getTwitchToken() {
     const response = await fetch('https://id.twitch.tv/oauth2/token', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         client_id: TWITCH_CLIENT_ID,
         client_secret: TWITCH_CLIENT_SECRET,
         grant_type: 'client_credentials'
       })
     });
     return response.json();
   }

   // Get Stream Key
   async function getStreamKey(accessToken) {
     const response = await fetch('https://api.twitch.tv/helix/streams/key', {
       headers: {
         'Authorization': `Bearer ${accessToken}`,
         'Client-Id': TWITCH_CLIENT_ID
       }
     });
     return response.json();
   }
   ```

#### Resources
- Documentation: https://dev.twitch.tv/docs/api/
- RTMP Ingest: https://dev.twitch.tv/docs/video-broadcast/reference/
- OAuth Guide: https://dev.twitch.tv/docs/authentication/

---

### 2. YouTube Live Streaming API

#### Overview
- **Difficulty:** Medium
- **Setup Time:** 2-4 days
- **Best For:** Production use, broader audience, professional features
- **Official API:** Yes

#### Integration Steps
1. **Google Cloud Setup**
   - Create project in Google Cloud Console
   - Enable YouTube Data API v3
   - Create OAuth 2.0 credentials

2. **Live Stream Creation Flow**
   ```
   Create Broadcast → Create Stream → Bind Together → Start Streaming
   ```

3. **API Endpoints**
   ```javascript
   // Create Broadcast
   POST https://www.googleapis.com/youtube/v3/liveBroadcasts

   // Create Stream
   POST https://www.googleapis.com/youtube/v3/liveStreams

   // Bind Broadcast to Stream
   POST https://www.googleapis.com/youtube/v3/liveBroadcasts/bind
   ```

4. **Code Example (JavaScript)**
   ```javascript
   // YouTube Live API Configuration
   const YOUTUBE_API_KEY = 'your_api_key';
   const OAUTH_TOKEN = 'user_oauth_token';

   // Create Live Broadcast
   async function createBroadcast(title, description) {
     const response = await fetch(
       'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status',
       {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${OAUTH_TOKEN}`,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({
           snippet: {
             title: title,
             description: description,
             scheduledStartTime: new Date().toISOString()
           },
           status: {
             privacyStatus: 'public'
           }
         })
       }
     );
     return response.json();
   }

   // Create Stream
   async function createStream(title) {
     const response = await fetch(
       'https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn',
       {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${OAUTH_TOKEN}`,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({
           snippet: { title },
           cdn: {
             frameRate: '30fps',
             ingestionType: 'rtmp',
             resolution: '1080p'
           }
         })
       }
     );
     return response.json();
   }
   ```

5. **RTMP Configuration**
   ```
   URL: rtmp://a.rtmp.youtube.com/live2
   Stream Key: Obtained from liveStreams API response
   ```

#### Resources
- Documentation: https://developers.google.com/youtube/v3/live/
- RTMPS Ingestion: https://developers.google.com/youtube/v3/live/guides/rtmps-ingestion
- Code Samples: https://github.com/youtube/api-samples

---

### 3. TikTok Live ❌ NOT RECOMMENDED

#### Overview
- **Difficulty:** High
- **Setup Time:** Unknown
- **Best For:** N/A (no official API)
- **Official API:** **NO**

#### Issues
- No official live streaming API
- Only reverse-engineered solutions exist
- Violates TikTok Terms of Service
- High risk of breaking changes
- Not production-ready

#### Conclusion
**Do NOT use TikTok for this project.** Wait for official API announcement.

---

## Critical Technical Challenge: WebRTC to RTMP Conversion

### The Problem
- Your app uses **WebRTC** (Decart API) for real-time video processing
- YouTube and Twitch require **RTMP** ingestion
- **Cannot convert directly in browser** - different protocols

### Required Architecture
```
┌─────────┐     WebRTC      ┌──────────────┐     RTMP      ┌──────────┐
│ Browser │ ──────────────> │ Media Server │ ───────────> │ Platform │
│ (React) │                 │              │               │(YT/Twitch)│
└─────────┘                 └──────────────┘               └──────────┘
   ↓                              ↓
Decart API              Codec Conversion
(Mirage V2)             (Opus→AAC, H264)
```

### Solution Options

#### Option 1: SRS (Simple Realtime Server) ⭐ RECOMMENDED
**Why:** Open source, actively maintained, built for WebRTC→RTMP

```bash
# Install via Docker
docker run -d \
  -p 1935:1935 \
  -p 1985:1985 \
  -p 8080:8080 \
  -p 8000:8000/udp \
  ossrs/srs:5
```

**Features:**
- WebRTC ingestion
- RTMP egress
- HLS support
- Low latency
- Free and open source

**Implementation:**
```javascript
// Frontend: Publish to SRS via WebRTC
const pc = new RTCPeerConnection();
// ... add your Decart processed stream
await fetch('http://your-srs-server:1985/rtc/v1/publish/', {
  method: 'POST',
  body: JSON.stringify({ sdp: offer })
});

// Backend: SRS forwards to Twitch/YouTube via RTMP
// Configure in srs.conf:
vhost __defaultVhost__ {
    forward {
        enabled on;
        destination rtmp://live.twitch.tv/app/your_stream_key;
    }
}
```

**Resources:**
- GitHub: https://github.com/ossrs/srs
- Docs: https://ossrs.io/
- WebRTC Guide: https://ossrs.io/lts/en-us/docs/v5/doc/webrtc

---

#### Option 2: Ant Media Server
**Why:** Commercial-ready, excellent WebRTC support, easy setup

**Features:**
- One-to-many streaming
- WebRTC ingestion
- RTMP forwarding
- Adaptive bitrate
- Enterprise support available

**Pricing:**
- Community Edition: Free
- Enterprise: Paid

**Installation:**
```bash
# Ubuntu/Debian
wget -O install_ant-media-server.sh https://raw.githubusercontent.com/ant-media/Scripts/master/install_ant-media-server.sh
sudo chmod +x install_ant-media-server.sh
sudo ./install_ant-media-server.sh
```

**Resources:**
- Website: https://antmedia.io/
- Docs: https://github.com/ant-media/Ant-Media-Server/wiki

---

#### Option 3: FFmpeg + Node.js Backend
**Why:** Maximum flexibility, full control

**Pros:**
- Complete control over encoding
- Custom business logic
- No third-party server needed

**Cons:**
- More complex setup
- Requires backend development
- Higher resource usage

**Example (Node.js):**
```javascript
const ffmpeg = require('fluent-ffmpeg');
const WebSocket = require('ws');

// Receive WebRTC stream, convert to RTMP
ffmpeg()
  .input('pipe:0') // Read from WebRTC stream
  .inputFormat('webm')
  .videoCodec('libx264')
  .audioCodec('aac')
  .outputOptions([
    '-preset veryfast',
    '-tune zerolatency',
    '-f flv'
  ])
  .output(`rtmp://live.twitch.tv/app/${STREAM_KEY}`)
  .on('error', console.error)
  .on('end', () => console.log('Stream ended'))
  .run();
```

---

#### Option 4: Cloud Services (Easiest, but paid)

**Mux Live Streaming API**
- Managed WebRTC→RTMP conversion
- Automatic multi-platform delivery
- Built-in recording and analytics
- Pricing: Pay per GB

**AWS IVS (Interactive Video Service)**
- Fully managed live streaming
- Low latency
- Auto-scaling
- Pricing: Pay per hour + bandwidth

**Agora**
- Real-time engagement SDK
- WebRTC native
- RTMP forwarding available
- Pricing: Pay per minute

---

## Recommended Implementation Plan

### Phase 1: Prototype with Twitch + SRS (1-2 weeks)

**Week 1: Set up infrastructure**
1. Deploy SRS server (Docker or cloud VM)
2. Configure WebRTC ingestion
3. Set up RTMP forwarding to Twitch
4. Get Twitch API credentials

**Week 2: Integrate with your app**
1. Capture Decart processed video stream
2. Send to SRS via WebRTC
3. Test RTMP forwarding to Twitch
4. Build UI controls (start/stop stream)

### Phase 2: Add YouTube Support (1 week)
1. Implement YouTube OAuth flow
2. Create broadcast/stream via API
3. Configure SRS to forward to YouTube
4. Add platform selection UI

### Phase 3: Production Features (2-3 weeks)
1. Stream health monitoring
2. Error handling and retry logic
3. Recording and archiving
4. Analytics integration
5. Multi-platform simultaneous streaming

---

## Environment Variables to Add

```bash
# Add to .env file

# Twitch
VITE_TWITCH_CLIENT_ID=your_client_id
VITE_TWITCH_CLIENT_SECRET=your_client_secret
VITE_TWITCH_REDIRECT_URI=http://localhost:5173/auth/callback

# YouTube
VITE_YOUTUBE_CLIENT_ID=your_client_id
VITE_YOUTUBE_CLIENT_SECRET=your_client_secret
VITE_YOUTUBE_API_KEY=your_api_key
VITE_YOUTUBE_REDIRECT_URI=http://localhost:5173/auth/callback

# Media Server (SRS)
VITE_SRS_SERVER_URL=http://your-srs-server:1985
VITE_SRS_RTMP_URL=rtmp://your-srs-server:1935/live
```

---

## Next Steps

### Immediate Actions:
1. **Choose your starting platform:** Twitch (easier) or YouTube (more features)
2. **Set up media server:** Deploy SRS via Docker for local testing
3. **Test WebRTC→RTMP conversion:** Verify your Decart stream can be converted
4. **Get API credentials:** Register your app with chosen platform

### Questions to Consider:
- Do you want to stream to multiple platforms simultaneously?
- What recording/archiving features do you need?
- What's your budget for infrastructure (cloud vs self-hosted)?
- Do you need analytics and viewer metrics?

---

## Resources

### Official Documentation
- **Twitch:** https://dev.twitch.tv/docs/
- **YouTube:** https://developers.google.com/youtube/v3/live/
- **SRS:** https://ossrs.io/

### Libraries & Tools
- **@supabase/supabase-js:** Already installed
- **@decartai/sdk:** Already installed (v0.0.14)
- **Simple RTMP Server (SRS):** https://github.com/ossrs/srs
- **Ant Media Server:** https://antmedia.io/

### Community Support
- Twitch Dev Forums: https://discuss.dev.twitch.com/
- YouTube API Stack Overflow: https://stackoverflow.com/questions/tagged/youtube-api
- SRS Discord: https://discord.gg/yZ4BnPmHAd

---

## Conclusion

**Start with Twitch + SRS** for the fastest path to a working prototype. Once you have the basic flow working, you can:
1. Add YouTube support (similar integration)
2. Implement multi-platform streaming
3. Add production features (monitoring, analytics, recording)
4. Consider migrating to managed services if needed

The key technical challenge is WebRTC→RTMP conversion, which SRS handles elegantly and for free.

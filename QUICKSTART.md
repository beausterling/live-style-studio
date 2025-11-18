# 🚀 Live Style Studio - Quick Start Guide

Get up and running with Twitch streaming in 5 minutes!

---

## Prerequisites

Before you begin, make sure you have:

- ✅ **Docker** installed ([Download Docker](https://www.docker.com/get-started))
- ✅ **Node.js** (v16 or higher) ([Download Node.js](https://nodejs.org/))
- ✅ **Twitch Account** ([Create Account](https://www.twitch.tv/signup))

---

## Step 1: Install Dependencies

```bash
npm install
```

---

## Step 2: Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

The `.env` file is already configured with the correct Supabase and SRS settings!

---

## Step 3: Start SRS Media Server

The SRS server handles WebRTC → RTMP conversion and forwards your stream to Twitch.

```bash
./start-srs.sh
```

You should see:

```
✅ SRS Media Server is running!

📊 Server URLs:
   - HTTP API:  http://localhost:1985
   - Console:   http://localhost:8080
   - RTMP:      rtmp://localhost:1935
   - WebRTC:    udp://localhost:8000
```

**Tip:** Leave this terminal window open. SRS needs to keep running while you stream.

---

## Step 4: Start the App

In a **new terminal window**:

```bash
npm run dev
```

The app will open at: **http://localhost:8080/** (or the port shown in terminal)

---

## Step 5: Get Your Twitch Stream Key

1. Go to: https://dashboard.twitch.tv/settings/stream
2. Click **"Copy"** next to your Primary Stream Key
3. Keep this key private - it's like a password!

---

## Step 6: Start Streaming!

In the Live Style Studio app:

1. **Start Decart Video Stream**
   - Click the "Start" button in the "Connection Status" section
   - Allow camera access when prompted
   - Wait for the video to connect (status shows "Connected")

2. **Enter Your Twitch Stream Key**
   - Scroll down to "Twitch Live Streaming" section
   - Paste your stream key into the input field
   - Click the 💾 save icon to save it

3. **Go Live!**
   - Click "Start Streaming" (purple button)
   - You'll see "LIVE ON TWITCH" status with stats
   - Check your Twitch dashboard - you're live! 🎉

---

## What You'll See

### In the App:
- ✅ Original webcam feed (bottom)
- ✅ AI-restyled video (main display)
- ✅ Live streaming stats (duration, data sent)
- ✅ Twitch streaming controls

### On Twitch:
- Your viewers will see the **AI-restyled video**
- Apply different styles in real-time
- Use presets: Cyberpunk, Studio Ghibli, Oil Painting, etc.

---

## Troubleshooting

### "Decart API key not available"
- Wait a few seconds for the API key to load from the server
- Check browser console for errors

### "Failed to connect to SRS"
- Make sure SRS is running: `docker ps | grep srs`
- Restart SRS: `docker compose down && ./start-srs.sh`
- Check SRS logs: `docker compose logs -f`

### "Stream failed to start"
- Verify Twitch stream key is correct
- Make sure Decart video is connected first
- Check browser console for WebRTC errors

### "No video on Twitch"
- Wait 10-15 seconds for Twitch to process the stream
- Refresh your Twitch dashboard
- Check the stream key is correct

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Your Browser (Live Style Studio)                       │
│                                                          │
│  1. Webcam → Decart API (AI Restyling)                 │
│  2. Restyled Video → WebRTC → SRS Server               │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│  SRS Media Server (Docker Container)                    │
│                                                          │
│  - Receives WebRTC stream                               │
│  - Converts to RTMP format                             │
│  - Forwards to Twitch                                   │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│  Twitch (rtmp://live.twitch.tv/app/YOUR_KEY)           │
│                                                          │
│  - Receives RTMP stream                                 │
│  - Broadcasts to your viewers                           │
└─────────────────────────────────────────────────────────┘
```

---

## Tips for Better Streaming

### Video Quality
- Use good lighting for better AI results
- Try different style prompts for unique effects
- Recommended resolution: 1280x704 (default)

### Stream Settings
- Monitor your upload bandwidth
- SRS forwards at ~2.5 Mbps by default
- Adjust in `srs.conf` if needed

### Style Prompts
Examples that work great:
- "Cyberpunk city, neon lights, futuristic"
- "Studio Ghibli animation style, beautiful watercolor"
- "Van Gogh painting, swirling colors, impressionist"
- "Pixar 3D animation style, colorful, vibrant"

---

## Stopping Everything

### Stop Streaming (in app)
- Click "Stop Streaming" button in Twitch section
- Click "Stop" in Connection Status to end video

### Stop SRS Server
```bash
docker compose down
```

### Stop the App
Press `Ctrl+C` in the terminal running `npm run dev`

---

## Production Deployment

For deploying to production (cloud hosting), see:
- **TWITCH_STREAMING_SETUP.md** - Full production guide
- Options: AWS IVS, Mux, or cloud-hosted SRS

---

## Need Help?

### Check Logs

**App Logs:**
- Open browser DevTools (F12)
- Check Console tab for errors

**SRS Logs:**
```bash
docker compose logs -f
```

**SRS Web Console:**
- Open: http://localhost:8080
- View active streams and stats

### Common Issues

| Issue | Solution |
|-------|----------|
| SRS won't start | Check if port 1985/8080 already in use |
| WebRTC connection fails | Check firewall settings |
| Twitch stream buffering | Reduce video bitrate in srs.conf |
| No audio on stream | Browser doesn't support audio capture |

---

## What's Next?

- **Add overlays** to your stream
- **Try different AI models** (when available)
- **Multi-platform streaming** (YouTube, Facebook)
- **Record streams** for later use
- **Add chat integration**

---

## Resources

- **Twitch Dashboard:** https://dashboard.twitch.tv
- **SRS Documentation:** https://ossrs.io
- **Decart API:** https://platform.decart.ai
- **WebRTC Samples:** https://webrtc.github.io/samples/

---

## 🎉 You're All Set!

Have fun streaming with AI-powered video effects!

If you encounter any issues, check:
1. Browser console (F12)
2. SRS logs (`docker compose logs -f`)
3. TWITCH_STREAMING_SETUP.md for advanced config

Happy streaming! 🎮✨

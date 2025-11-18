#!/bin/bash

# Live Style Studio - SRS Media Server Startup Script
# This script starts the SRS media server for Twitch streaming

set -e

echo "🎬 Live Style Studio - Starting SRS Media Server"
echo "================================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed"
    echo ""
    echo "Please install Docker first:"
    echo "  - macOS: https://docs.docker.com/desktop/install/mac-install/"
    echo "  - Linux: https://docs.docker.com/engine/install/"
    echo "  - Windows: https://docs.docker.com/desktop/install/windows-install/"
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null && ! docker-compose version &> /dev/null; then
    echo "❌ Error: Docker Compose is not available"
    echo ""
    echo "Docker Compose is required. Please install it:"
    echo "  https://docs.docker.com/compose/install/"
    exit 1
fi

# Set candidate IP for WebRTC
# This is the IP address that clients will use to connect
CANDIDATE=${CANDIDATE:-$(hostname -I | awk '{print $1}')}
if [ -z "$CANDIDATE" ]; then
    CANDIDATE="127.0.0.1"
fi

echo "📡 WebRTC Candidate IP: $CANDIDATE"
echo ""

# Export for docker-compose
export SRS_CANDIDATE=$CANDIDATE

# Start SRS
echo "🚀 Starting SRS server..."
echo ""

if docker compose version &> /dev/null; then
    docker compose up -d
else
    docker-compose up -d
fi

# Wait for SRS to be ready
echo ""
echo "⏳ Waiting for SRS to be ready..."
sleep 3

# Check if SRS is running
if docker ps | grep -q live-style-srs; then
    echo ""
    echo "✅ SRS Media Server is running!"
    echo ""
    echo "📊 Server URLs:"
    echo "   - HTTP API:  http://localhost:1985"
    echo "   - Console:   http://localhost:8080"
    echo "   - RTMP:      rtmp://localhost:1935"
    echo "   - WebRTC:    udp://localhost:8000"
    echo ""
    echo "🎥 Your app will connect to: http://localhost:1985"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Start your app: npm run dev"
    echo "   2. Get your Twitch stream key from: https://dashboard.twitch.tv/settings/stream"
    echo "   3. Enter the stream key in the app"
    echo "   4. Click 'Start Streaming' to go live!"
    echo ""
    echo "🛑 To stop SRS: docker compose down"
    echo "📊 To view logs: docker compose logs -f"
else
    echo ""
    echo "❌ Error: SRS failed to start"
    echo ""
    echo "Check logs with: docker compose logs"
    exit 1
fi

import { supabase } from "@/integrations/supabase/client";

export interface TwitchStreamConfig {
  streamKey: string;
  rtmpUrl: string;
}

export interface StreamStats {
  isStreaming: boolean;
  duration: number;
  bytesStreamed: number;
}

export class TwitchStreamingService {
  private peerConnection: RTCPeerConnection | null = null;
  private streamStartTime: number = 0;
  private statsInterval: NodeJS.Timeout | null = null;
  private stats: StreamStats = {
    isStreaming: false,
    duration: 0,
    bytesStreamed: 0,
  };
  private srsUrl: string;

  constructor() {
    // Default to localhost, can be configured via environment
    this.srsUrl = import.meta.env.VITE_SRS_SERVER_URL || 'http://localhost:1985';
  }

  /**
   * Start streaming the video to Twitch via SRS WebRTC
   */
  async startStreaming(
    videoStream: MediaStream,
    streamKey: string,
    onStatsUpdate?: (stats: StreamStats) => void
  ): Promise<void> {
    if (this.peerConnection) {
      throw new Error("Already streaming");
    }

    try {
      console.log('Starting WebRTC stream to SRS...');
      console.log('SRS URL:', this.srsUrl);
      console.log('Stream key:', streamKey.substring(0, 10) + '...');

      // Create RTCPeerConnection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      // Add all tracks from the video stream
      videoStream.getTracks().forEach(track => {
        console.log('Adding track:', track.kind, track.label);
        this.peerConnection!.addTrack(track, videoStream);
      });

      // Monitor connection state
      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
      };

      this.peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', this.peerConnection?.connectionState);
        if (this.peerConnection?.connectionState === 'failed') {
          console.error('WebRTC connection failed');
        }
      };

      // Create offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });

      await this.peerConnection.setLocalDescription(offer);

      console.log('Created offer, sending to SRS...');

      // Send offer to SRS
      const publishUrl = `${this.srsUrl}/rtc/v1/publish/`;
      const response = await fetch(publishUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api: publishUrl,
          streamurl: `webrtc://localhost/live/${streamKey}`,
          sdp: offer.sdp,
        }),
      });

      if (!response.ok) {
        throw new Error(`SRS server returned ${response.status}: ${await response.text()}`);
      }

      const answer = await response.json();
      console.log('Received answer from SRS');

      if (answer.code !== 0) {
        throw new Error(`SRS error: ${answer.msg || 'Unknown error'}`);
      }

      // Set remote description
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({
          type: 'answer',
          sdp: answer.sdp,
        })
      );

      // Initialize stats
      this.streamStartTime = Date.now();
      this.stats = {
        isStreaming: true,
        duration: 0,
        bytesStreamed: 0,
      };

      // Update stats every second
      this.statsInterval = setInterval(async () => {
        this.stats.duration = Math.floor((Date.now() - this.streamStartTime) / 1000);

        // Get WebRTC stats
        if (this.peerConnection) {
          const stats = await this.peerConnection.getStats();
          stats.forEach((report) => {
            if (report.type === 'outbound-rtp' && report.kind === 'video') {
              this.stats.bytesStreamed = report.bytesSent || 0;
            }
          });
        }

        if (onStatsUpdate) {
          onStatsUpdate({ ...this.stats });
        }
      }, 1000);

      console.log('Twitch streaming started via WebRTC → SRS → RTMP');
    } catch (error) {
      console.error('Error starting stream:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop the streaming
   */
  stopStreaming(): void {
    console.log('Stopping Twitch stream...');
    this.cleanup();
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.stats.isStreaming = false;
    console.log('Twitch streaming stopped');
  }

  /**
   * Get current streaming stats
   */
  getStats(): StreamStats {
    return { ...this.stats };
  }

  /**
   * Check if currently streaming
   */
  isStreaming(): boolean {
    return this.stats.isStreaming;
  }

  /**
   * Test connection to SRS server
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.srsUrl}/api/v1/versions`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to connect to SRS:', error);
      return false;
    }
  }
}

/**
 * Save Twitch stream key to Supabase (user preferences)
 */
export async function saveTwitchStreamKey(streamKey: string): Promise<void> {
  try {
    // For now, save to localStorage as fallback
    // The edge function requires authentication which may not be set up yet
    localStorage.setItem('twitch_stream_key', streamKey);

    // Try to save to Supabase if user is authenticated
    try {
      const { error } = await supabase.functions.invoke('user-preferences', {
        body: {
          action: 'save',
          key: 'twitch_stream_key',
          value: streamKey,
        },
      });

      if (error && error.message !== 'Unauthorized') {
        console.warn('Failed to save to Supabase:', error);
      }
    } catch (e) {
      console.warn('Supabase save skipped (no auth)');
    }
  } catch (error) {
    console.error('Failed to save stream key:', error);
    throw new Error('Failed to save stream key');
  }
}

/**
 * Load Twitch stream key from Supabase or localStorage
 */
export async function loadTwitchStreamKey(): Promise<string | null> {
  try {
    // Try Supabase first
    try {
      const { data, error } = await supabase.functions.invoke('user-preferences', {
        body: {
          action: 'load',
          key: 'twitch_stream_key',
        },
      });

      if (!error && data?.value) {
        return data.value;
      }
    } catch (e) {
      console.warn('Supabase load skipped (no auth)');
    }

    // Fallback to localStorage
    return localStorage.getItem('twitch_stream_key');
  } catch (error) {
    console.error('Failed to load stream key:', error);
    return null;
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format duration in seconds to HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

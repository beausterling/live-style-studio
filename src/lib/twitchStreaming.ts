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
  private mediaRecorder: MediaRecorder | null = null;
  private streamStartTime: number = 0;
  private streamChunks: Blob[] = [];
  private uploadInterval: NodeJS.Timeout | null = null;
  private stats: StreamStats = {
    isStreaming: false,
    duration: 0,
    bytesStreamed: 0,
  };

  /**
   * Start streaming the video to Twitch via Supabase edge function
   */
  async startStreaming(
    videoStream: MediaStream,
    streamKey: string,
    onStatsUpdate?: (stats: StreamStats) => void
  ): Promise<void> {
    if (this.mediaRecorder) {
      throw new Error("Already streaming");
    }

    try {
      // Create MediaRecorder to capture the video stream
      const options = {
        mimeType: 'video/webm;codecs=h264',
        videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
      };

      // Fallback to VP8 if H264 not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8,opus';
      }

      this.mediaRecorder = new MediaRecorder(videoStream, options);
      this.streamChunks = [];
      this.streamStartTime = Date.now();
      this.stats = {
        isStreaming: true,
        duration: 0,
        bytesStreamed: 0,
      };

      // Collect data in chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.streamChunks.push(event.data);
          this.stats.bytesStreamed += event.data.size;
        }
      };

      // Send chunks to backend every 5 seconds
      this.uploadInterval = setInterval(async () => {
        if (this.streamChunks.length > 0) {
          await this.uploadChunks(streamKey);

          // Update stats
          this.stats.duration = Math.floor((Date.now() - this.streamStartTime) / 1000);
          if (onStatsUpdate) {
            onStatsUpdate({ ...this.stats });
          }
        }
      }, 5000);

      // Start recording with 1 second timeslices
      this.mediaRecorder.start(1000);

      console.log('Twitch streaming started');
    } catch (error) {
      console.error('Error starting stream:', error);
      throw error;
    }
  }

  /**
   * Upload video chunks to Supabase edge function for RTMP forwarding
   */
  private async uploadChunks(streamKey: string): Promise<void> {
    if (this.streamChunks.length === 0) return;

    const chunks = [...this.streamChunks];
    this.streamChunks = [];

    try {
      // Convert chunks to base64 for transmission
      const blob = new Blob(chunks, { type: 'video/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      const base64Data = btoa(
        String.fromCharCode(...new Uint8Array(arrayBuffer))
      );

      // Send to edge function
      const { error } = await supabase.functions.invoke('twitch-stream', {
        body: {
          action: 'stream',
          streamKey,
          data: base64Data,
          timestamp: Date.now(),
        },
      });

      if (error) {
        console.error('Error uploading stream chunk:', error);
        throw error;
      }
    } catch (error) {
      console.error('Failed to upload chunks:', error);
      // Put chunks back in queue on error
      this.streamChunks.unshift(...chunks);
    }
  }

  /**
   * Stop the streaming
   */
  stopStreaming(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.uploadInterval) {
      clearInterval(this.uploadInterval);
      this.uploadInterval = null;
    }

    this.mediaRecorder = null;
    this.streamChunks = [];
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
}

/**
 * Save Twitch stream key to Supabase (user preferences)
 */
export async function saveTwitchStreamKey(streamKey: string): Promise<void> {
  const { error } = await supabase.functions.invoke('user-preferences', {
    body: {
      action: 'save',
      key: 'twitch_stream_key',
      value: streamKey,
    },
  });

  if (error) {
    throw new Error('Failed to save stream key');
  }
}

/**
 * Load Twitch stream key from Supabase
 */
export async function loadTwitchStreamKey(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('user-preferences', {
    body: {
      action: 'load',
      key: 'twitch_stream_key',
    },
  });

  if (error) {
    console.error('Failed to load stream key:', error);
    return null;
  }

  return data?.value || null;
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

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Radio,
  CircleSlash,
  Settings,
  Eye,
  EyeOff,
  Save,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TwitchStreamingService,
  saveTwitchStreamKey,
  loadTwitchStreamKey,
  formatBytes,
  formatDuration,
  type StreamStats,
} from "@/lib/twitchStreaming";

interface TwitchStreamControlsProps {
  videoStream: MediaStream | null;
  audioStream: MediaStream | null;
  isVideoPlaying: boolean;
}

export function TwitchStreamControls({
  videoStream,
  audioStream,
  isVideoPlaying,
}: TwitchStreamControlsProps) {
  const { toast } = useToast();
  const [streamingService] = useState(() => new TwitchStreamingService());
  const [streamKey, setStreamKey] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showStreamKey, setShowStreamKey] = useState(false);
  const [stats, setStats] = useState<StreamStats>({
    isStreaming: false,
    duration: 0,
    bytesStreamed: 0,
  });

  // Load saved stream key on mount
  useEffect(() => {
    const loadKey = async () => {
      const savedKey = await loadTwitchStreamKey();
      if (savedKey) {
        setStreamKey(savedKey);
      }
    };
    loadKey();
  }, []);

  const handleSaveStreamKey = async () => {
    if (!streamKey.trim()) {
      toast({
        title: "Invalid Stream Key",
        description: "Please enter a valid Twitch stream key.",
        variant: "destructive",
      });
      return;
    }

    try {
      await saveTwitchStreamKey(streamKey);
      toast({
        title: "Stream Key Saved",
        description: "Your Twitch stream key has been saved securely.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save stream key. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleStartStreaming = async () => {
    if (!streamKey.trim()) {
      toast({
        title: "Stream Key Required",
        description: "Please enter your Twitch stream key first.",
        variant: "destructive",
      });
      return;
    }

    if (!videoStream) {
      toast({
        title: "No Video Stream",
        description: "Please start the Decart video stream first.",
        variant: "destructive",
      });
      return;
    }

    if (!isVideoPlaying) {
      toast({
        title: "Video Not Playing",
        description: "Wait for the video stream to connect before streaming to Twitch.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Combine video and audio streams if audio is available
      let combinedStream = videoStream;

      if (audioStream) {
        // Create a new MediaStream with video tracks from videoStream and audio tracks from audioStream
        combinedStream = new MediaStream();

        // Add video tracks
        videoStream.getVideoTracks().forEach(track => {
          combinedStream.addTrack(track);
        });

        // Add audio tracks from the separate microphone stream
        audioStream.getAudioTracks().forEach(track => {
          combinedStream.addTrack(track);
        });
      }

      await streamingService.startStreaming(
        combinedStream,
        streamKey,
        (newStats) => {
          setStats(newStats);
        }
      );
      setIsStreaming(true);
      toast({
        title: "Streaming Started",
        description: audioStream ? "Now live on Twitch with audio!" : "Now live on Twitch (video only)",
      });
    } catch (error: any) {
      console.error("Failed to start streaming:", error);
      toast({
        title: "Streaming Failed",
        description: error.message || "Failed to start Twitch stream.",
        variant: "destructive",
      });
    }
  };

  const handleStopStreaming = () => {
    streamingService.stopStreaming();
    setIsStreaming(false);
    setStats({
      isStreaming: false,
      duration: 0,
      bytesStreamed: 0,
    });
    toast({
      title: "Streaming Stopped",
      description: "Twitch stream has ended.",
    });
  };

  return (
    <Card className="p-4 border-border">
      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Radio className="w-4 h-4 text-purple-500" />
        Twitch Live Streaming
      </h3>

      <div className="space-y-3">
        {/* Stream Key Input */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Stream Key</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showStreamKey ? "text" : "password"}
                value={streamKey}
                onChange={(e) => setStreamKey(e.target.value)}
                placeholder="Enter your Twitch stream key..."
                disabled={isStreaming}
                className="bg-secondary border-border pr-8"
              />
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowStreamKey(!showStreamKey)}
              >
                {showStreamKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={handleSaveStreamKey}
              disabled={isStreaming || !streamKey.trim()}
            >
              <Save className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your stream key from{" "}
            <a
              href="https://dashboard.twitch.tv/settings/stream"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-500 hover:underline"
            >
              Twitch Dashboard
            </a>
          </p>
        </div>

        {/* Streaming Status */}
        {isStreaming && (
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
              <span className="text-sm font-medium text-purple-500">
                LIVE ON TWITCH
              </span>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-mono">{formatDuration(stats.duration)}</span>
              </div>
              <div className="flex justify-between">
                <span>Data Sent:</span>
                <span className="font-mono">{formatBytes(stats.bytesStreamed)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Stream Controls */}
        <div className="flex gap-2">
          {!isStreaming ? (
            <Button
              onClick={handleStartStreaming}
              disabled={!streamKey.trim() || !isVideoPlaying}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              <Radio className="w-4 h-4 mr-2" />
              Start Streaming
            </Button>
          ) : (
            <Button
              onClick={handleStopStreaming}
              variant="destructive"
              className="flex-1"
            >
              <CircleSlash className="w-4 h-4 mr-2" />
              Stop Streaming
            </Button>
          )}
        </div>

        {/* Info */}
        {!isVideoPlaying && (
          <div className="p-2 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              Start the Decart video stream above before streaming to Twitch.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

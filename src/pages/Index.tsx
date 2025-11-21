import { useState, useRef, useEffect } from "react";
import { createDecartClient, models, type DecartSDKError } from "@decartai/sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Video,
  VideoOff,
  Wand2,
  Palette,
  FlipHorizontal,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Camera
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { TwitchStreamControls } from "@/components/TwitchStreamControls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ConnectionState = "idle" | "selecting-camera" | "connecting" | "connected" | "disconnected";

const PRESET_STYLES = [
  { label: "Cyberpunk", prompt: "Cyberpunk city, neon lights, futuristic" },
  { label: "Studio Ghibli", prompt: "Studio Ghibli animation style, beautiful watercolor" },
  { label: "Oil Painting", prompt: "Classical oil painting, renaissance art style" },
  { label: "Sketch", prompt: "Pencil sketch, hand-drawn, artistic" },
  { label: "Anime", prompt: "Japanese anime style, vibrant colors" },
];

const Index = () => {
  const { toast } = useToast();
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [inputPrompt, setInputPrompt] = useState("");
  const [isMirrored, setIsMirrored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const realtimeClientRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Fetch API key from Supabase edge function on mount
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('decart-proxy', {
          body: { action: 'getApiKey' },
        });

        if (error) {
          console.error('Error fetching API key:', error);
          setError('Failed to retrieve API key from server');
          toast({
            title: "Configuration Error",
            description: "Failed to retrieve API key from server.",
            variant: "destructive",
          });
          return;
        }

        if (data?.apiKey) {
          setApiKey(data.apiKey);
        } else {
          setError('No API key returned from server');
        }
      } catch (err: any) {
        console.error('Error fetching API key:', err);
        setError('Failed to connect to server');
      }
    };

    fetchApiKey();
  }, [toast]);

  useEffect(() => {
    return () => {
      handleStop();
    };
  }, []);

  // Enumerate cameras
  const enumerateCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);

      if (videoDevices.length > 0) {
        setSelectedCameraId(videoDevices[0].deviceId);
      }

      return videoDevices;
    } catch (err) {
      console.error('Error enumerating cameras:', err);
      return [];
    }
  };

  const handleOpenCamera = async () => {
    const cameras = await enumerateCameras();

    if (cameras.length === 0) {
      toast({
        title: "No Camera Found",
        description: "Please connect a camera and try again.",
        variant: "destructive",
      });
      return;
    }

    if (cameras.length === 1) {
      // Only one camera, start immediately
      await handleStart(cameras[0].deviceId);
    } else {
      // Multiple cameras, show selector
      setConnectionState("selecting-camera");
    }
  };

  const handleCameraSelected = async () => {
    if (!selectedCameraId) {
      toast({
        title: "No Camera Selected",
        description: "Please select a camera.",
        variant: "destructive",
      });
      return;
    }

    await handleStart(selectedCameraId);
  };

  const handleStart = async (deviceId?: string) => {
    if (!apiKey) {
      const errorMsg = "Decart API key not available";
      setError(errorMsg);
      toast({
        title: "Configuration Error",
        description: "API key is still loading or failed to load. Please try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      setConnectionState("connecting");
      setError(null);

      const model = models.realtime("mirage_v2");

      // Get user's camera stream with model specifications
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          frameRate: model.fps,
          width: model.width,
          height: model.height,
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      localStreamRef.current = stream;

      // Display local preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create client and connect
      const client = createDecartClient({
        apiKey: apiKey
      });

      const realtimeClient = await client.realtime.connect(stream, {
        model,
        onRemoteStream: (transformedStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = transformedStream;
          }
        }
      });

      realtimeClientRef.current = realtimeClient;

      // Set up event handlers
      realtimeClient.on("connectionChange", (...args: any[]) => {
        const state = args[0] as string;
        console.log(`Connection state: ${state}`);
        setConnectionState(state as ConnectionState);

        if (state === "connected") {
          toast({
            title: "Connected",
            description: "Video stream is live!",
          });
        }
      });

      realtimeClient.on("error", (...args: any[]) => {
        const error = args[0] as DecartSDKError;
        console.error("Decart SDK error:", error.code, error.message);
        setError(`SDK Error: ${error.message}`);
        toast({
          title: "Stream Error",
          description: error.message,
          variant: "destructive",
        });
      });

      // Set initial prompt if available
      if (currentPrompt) {
        realtimeClient.setPrompt(currentPrompt);
      }

    } catch (err: any) {
      console.error("Error starting stream:", err);
      const errorMessage = err.message || "Failed to start video stream";
      setError(errorMessage);
      setConnectionState("idle");

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleStop = () => {
    if (realtimeClientRef.current) {
      realtimeClientRef.current.disconnect();
      realtimeClientRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setConnectionState("idle");
    toast({
      title: "Disconnected",
      description: "Video stream stopped.",
    });
  };

  const handleSetPrompt = () => {
    if (!inputPrompt.trim()) return;

    setCurrentPrompt(inputPrompt);

    if (realtimeClientRef.current && connectionState === "connected") {
      realtimeClientRef.current.setPrompt(inputPrompt);
      toast({
        title: "Style Updated",
        description: inputPrompt,
      });
    }
  };

  const handlePresetStyle = (preset: typeof PRESET_STYLES[0]) => {
    setInputPrompt(preset.prompt);
    setCurrentPrompt(preset.prompt);

    if (realtimeClientRef.current && connectionState === "connected") {
      realtimeClientRef.current.setPrompt(preset.prompt);
      toast({
        title: "Style Applied",
        description: preset.label,
      });
    }
  };

  const handleToggleMirror = () => {
    const newMirrorState = !isMirrored;
    setIsMirrored(newMirrorState);

    if (realtimeClientRef.current && connectionState === "connected") {
      realtimeClientRef.current.setMirror(newMirrorState);
    }
  };

  const isStreaming = connectionState === "connected" || connectionState === "connecting";

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Wand2 className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold">Live Style Studio</h1>
          </div>
          <p className="text-muted-foreground">
            Transform your webcam feed in real-time with AI-powered video restyling
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Video Area */}
          <div className="lg:col-span-2 space-y-4">
            {/* Local Camera (Main Display) */}
            <Card className="relative overflow-hidden video-container border-video-border">
              <div className="aspect-video bg-card relative">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "w-full h-full object-contain",
                    isMirrored && "scale-x-[-1]"
                  )}
                />

                {/* Connection Status Overlay */}
                {connectionState === "connecting" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                      <p className="text-lg font-medium">Connecting to stream...</p>
                    </div>
                  </div>
                )}

                {connectionState === "idle" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-card/50 backdrop-blur-sm">
                    <div className="text-center">
                      <Button
                        size="lg"
                        onClick={handleOpenCamera}
                        className="gap-2"
                      >
                        <Camera className="w-5 h-5" />
                        Open Camera
                      </Button>
                      <p className="text-sm text-muted-foreground mt-4">
                        Click to start streaming
                      </p>
                    </div>
                  </div>
                )}

                {connectionState === "selecting-camera" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/95 backdrop-blur-sm">
                    <Card className="p-6 max-w-md w-full mx-4">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Camera className="w-5 h-5" />
                        Select Camera
                      </h3>
                      <div className="space-y-4">
                        <Select
                          value={selectedCameraId}
                          onValueChange={setSelectedCameraId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a camera" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCameras.map((camera) => (
                              <SelectItem key={camera.deviceId} value={camera.deviceId}>
                                {camera.label || `Camera ${camera.deviceId.substring(0, 8)}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleCameraSelected}
                            className="flex-1"
                          >
                            Start
                          </Button>
                          <Button
                            onClick={() => setConnectionState("idle")}
                            variant="outline"
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Live Indicator */}
                {connectionState === "connected" && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-full border border-border">
                    <div className="w-3 h-3 rounded-full bg-primary live-indicator"></div>
                    <span className="text-sm font-medium">Your Camera</span>
                  </div>
                )}
              </div>
            </Card>

            {/* AI Restyled Output (Secondary Display) */}
            <Card className="relative overflow-hidden border-border">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-primary" />
                  AI Restyled Output
                </h3>
              </div>
              <div className="aspect-video bg-muted relative max-h-64">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={cn(
                    "w-full h-full object-contain",
                    isMirrored && "scale-x-[-1]"
                  )}
                />

                {connectionState !== "connected" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                    <div className="text-center text-muted-foreground">
                      <Wand2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Restyled video will appear here</p>
                    </div>
                  </div>
                )}

                {/* Current Prompt Overlay */}
                {currentPrompt && connectionState === "connected" && (
                  <div className="absolute bottom-2 left-2 right-2 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-md border border-border">
                    <div className="flex items-center gap-2">
                      <Palette className="w-3 h-3 text-primary" />
                      <span className="text-xs font-medium truncate">{currentPrompt}</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Controls Panel */}
          <div className="space-y-4">
            {/* Connection Status Card */}
            <Card className="p-4 border-border">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                {connectionState === "connected" ? (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                )}
                Connection Status
              </h3>
              <div className="space-y-3">
                <div className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium text-center",
                  connectionState === "connected" && "bg-primary/10 text-primary border border-primary/20",
                  connectionState === "connecting" && "bg-secondary text-secondary-foreground",
                  (connectionState === "idle" || connectionState === "selecting-camera") && "bg-muted text-muted-foreground"
                )}>
                  {connectionState === "connected" && "Connected"}
                  {connectionState === "connecting" && "Connecting..."}
                  {connectionState === "selecting-camera" && "Selecting Camera"}
                  {connectionState === "idle" && "Not Connected"}
                </div>

                <div className="flex gap-2">
                  {!isStreaming ? (
                    <Button
                      onClick={handleOpenCamera}
                      className="flex-1"
                      disabled={!apiKey}
                    >
                      <Video className="w-4 h-4 mr-2" />
                      Start
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStop}
                      variant="destructive"
                      className="flex-1"
                    >
                      <VideoOff className="w-4 h-4 mr-2" />
                      Stop
                    </Button>
                  )}
                </div>
              </div>

              {error && (
                <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}
            </Card>

            {/* Style Controls */}
            <Card className="p-4 border-border">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Style Prompt
              </h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={inputPrompt}
                    onChange={(e) => setInputPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSetPrompt()}
                    placeholder="Enter a style prompt..."
                    disabled={!isStreaming}
                    className="bg-secondary border-border"
                  />
                  <Button
                    onClick={handleSetPrompt}
                    disabled={!inputPrompt.trim() || !isStreaming}
                    size="icon"
                  >
                    <Wand2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Quick Presets</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESET_STYLES.map((preset) => (
                      <Button
                        key={preset.label}
                        onClick={() => handlePresetStyle(preset)}
                        variant="outline"
                        size="sm"
                        disabled={!isStreaming}
                        className="text-xs"
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Additional Controls */}
            <Card className="p-4 border-border">
              <h3 className="text-sm font-medium mb-3">Camera Settings</h3>
              <div className="space-y-2">
                <Button
                  onClick={handleToggleMirror}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!isStreaming}
                >
                  <FlipHorizontal className="w-4 h-4 mr-2" />
                  {isMirrored ? "Unmirror Camera" : "Mirror Camera"}
                </Button>
              </div>
            </Card>

            {/* Info Card */}
            <Card className="p-4 bg-muted/50 border-border">
              <h3 className="text-sm font-medium mb-2">Model Info</h3>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Model: Mirage V2</p>
                <p>Resolution: 1280x704</p>
                <p>Frame Rate: 25 FPS</p>
              </div>
            </Card>

            {/* Twitch Streaming Controls */}
            <TwitchStreamControls
              videoStream={
                remoteVideoRef.current?.srcObject as MediaStream | null
              }
              isVideoPlaying={connectionState === "connected"}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

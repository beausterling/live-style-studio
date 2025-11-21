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
  Camera,
  Mic,
  MicOff
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

type CameraState = "idle" | "selecting-camera" | "camera-open";
type AIState = "idle" | "connecting" | "connected" | "disconnected";
type MicState = "idle" | "selecting-mic" | "active";

// Waveform Visualization Component
const WaveformVisualizer = ({ analyser }: { analyser: AnalyserNode | null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      const animationId = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgb(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, 'rgb(147, 51, 234)'); // purple-600
        gradient.addColorStop(1, 'rgb(219, 39, 119)'); // pink-600

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (typeof animationId !== 'undefined') {
        cancelAnimationFrame(animationId);
      }
    };
  }, [analyser]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={40}
      className="w-full h-10 rounded"
    />
  );
};

const PRESET_STYLES = [
  {
    label: "Cyberpunk",
    prompt: "Cyberpunk city, neon lights, futuristic",
    description: "Neon-lit cyberpunk aesthetic with futuristic vibes",
    emoji: "🌆"
  },
  {
    label: "Studio Ghibli",
    prompt: "Studio Ghibli animation style, beautiful watercolor",
    description: "Dreamy watercolor animation like Spirited Away",
    emoji: "🎨"
  },
  {
    label: "Oil Painting",
    prompt: "Classical oil painting, renaissance art style",
    description: "Classic renaissance oil painting style",
    emoji: "🖼️"
  },
  {
    label: "Sketch",
    prompt: "Pencil sketch, hand-drawn, artistic",
    description: "Hand-drawn pencil sketch artwork",
    emoji: "✏️"
  },
  {
    label: "Anime",
    prompt: "Japanese anime style, vibrant colors",
    description: "Vibrant Japanese anime character style",
    emoji: "🎭"
  },
];

const Index = () => {
  const { toast } = useToast();
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [aiState, setAIState] = useState<AIState>("idle");
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [inputPrompt, setInputPrompt] = useState("");
  const [isMirrored, setIsMirrored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<typeof PRESET_STYLES[0] | null>(null);
  const [showPresetPreview, setShowPresetPreview] = useState(false);

  // Microphone state
  const [micState, setMicState] = useState<MicState>("idle");
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const realtimeClientRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
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
      handleStopEverything();
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
      // Only one camera, open it immediately
      await openCamera(cameras[0].deviceId);
    } else {
      // Multiple cameras, show selector
      setCameraState("selecting-camera");
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

    await openCamera(selectedCameraId);
  };

  // Open camera without starting AI (video only, no audio)
  const openCamera = async (deviceId?: string) => {
    try {
      setError(null);

      const model = models.realtime("mirage_v2");

      // Get user's camera stream (video only - audio handled separately)
      const constraints: MediaStreamConstraints = {
        audio: false,
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

      setCameraState("camera-open");

      toast({
        title: "Camera Ready",
        description: "Click 'Start AI Restyling' to begin transformation",
      });

    } catch (err: any) {
      console.error("Error opening camera:", err);
      const errorMessage = err.message || "Failed to open camera";
      setError(errorMessage);
      setCameraState("idle");

      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Start AI restyling (uses API credits)
  const handleStartAI = async () => {
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

    if (!localStreamRef.current) {
      toast({
        title: "No Camera",
        description: "Please open your camera first.",
        variant: "destructive",
      });
      return;
    }

    try {
      setAIState("connecting");
      setError(null);

      const model = models.realtime("mirage_v2");

      // Create client and connect to Decart API
      const client = createDecartClient({
        apiKey: apiKey
      });

      const realtimeClient = await client.realtime.connect(localStreamRef.current, {
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
        console.log(`AI Connection state: ${state}`);
        setAIState(state as AIState);

        if (state === "connected") {
          toast({
            title: "AI Restyling Active",
            description: "Real-time transformation is now live!",
          });
        }
      });

      realtimeClient.on("error", (...args: any[]) => {
        const error = args[0] as DecartSDKError;
        console.error("Decart SDK error:", error.code, error.message);
        setError(`SDK Error: ${error.message}`);
        toast({
          title: "AI Error",
          description: error.message,
          variant: "destructive",
        });
      });

      // Set initial prompt if available (from selected preset)
      if (currentPrompt) {
        realtimeClient.setPrompt(currentPrompt);
      } else if (selectedPreset) {
        realtimeClient.setPrompt(selectedPreset.prompt);
        setCurrentPrompt(selectedPreset.prompt);
      }

    } catch (err: any) {
      console.error("Error starting AI:", err);
      const errorMessage = err.message || "Failed to start AI restyling";
      setError(errorMessage);
      setAIState("idle");

      toast({
        title: "AI Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleStopAI = () => {
    if (realtimeClientRef.current) {
      realtimeClientRef.current.disconnect();
      realtimeClientRef.current = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setAIState("idle");
    toast({
      title: "AI Stopped",
      description: "AI restyling stopped. Camera still active.",
    });
  };

  const handleStopCamera = () => {
    // Stop AI first if running
    if (realtimeClientRef.current) {
      realtimeClientRef.current.disconnect();
      realtimeClientRef.current = null;
    }

    // Stop camera
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

    setCameraState("idle");
    setAIState("idle");
    toast({
      title: "Camera Closed",
      description: "Camera and AI stopped.",
    });
  };

  const handleStopEverything = () => {
    handleStopCamera();
    handleStopMic();
  };

  // Enumerate microphones
  const enumerateMics = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      setAvailableMics(audioDevices);

      if (audioDevices.length > 0) {
        setSelectedMicId(audioDevices[0].deviceId);
      }

      return audioDevices;
    } catch (err) {
      console.error('Error enumerating microphones:', err);
      return [];
    }
  };

  const handleToggleMic = async () => {
    if (micState === "active") {
      handleStopMic();
    } else {
      const mics = await enumerateMics();

      if (mics.length === 0) {
        toast({
          title: "No Microphone Found",
          description: "Please connect a microphone and try again.",
          variant: "destructive",
        });
        return;
      }

      if (mics.length === 1) {
        // Only one mic, start it immediately
        await startMic(mics[0].deviceId);
      } else {
        // Multiple mics, show selector
        setMicState("selecting-mic");
      }
    }
  };

  const handleMicSelected = async () => {
    if (!selectedMicId) {
      toast({
        title: "No Microphone Selected",
        description: "Please select a microphone.",
        variant: "destructive",
      });
      return;
    }

    await startMic(selectedMicId);
  };

  const startMic = async (deviceId?: string) => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;

      // Set up audio visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      setMicState("active");

      toast({
        title: "Microphone Active",
        description: "Audio will be included in livestream",
      });

    } catch (err: any) {
      console.error("Error starting microphone:", err);
      const errorMessage = err.message || "Failed to start microphone";
      setMicState("idle");

      toast({
        title: "Microphone Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleStopMic = () => {
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop microphone stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    analyserRef.current = null;
    setMicState("idle");

    toast({
      title: "Microphone Stopped",
      description: "Audio capture stopped",
    });
  };

  const handleSetPrompt = () => {
    if (!inputPrompt.trim()) return;

    setCurrentPrompt(inputPrompt);

    if (realtimeClientRef.current && aiState === "connected") {
      realtimeClientRef.current.setPrompt(inputPrompt);
      toast({
        title: "Style Updated",
        description: inputPrompt,
      });
    }
  };

  const handlePresetClick = (preset: typeof PRESET_STYLES[0]) => {
    setSelectedPreset(preset);
    setInputPrompt(preset.prompt);
    setCurrentPrompt(preset.prompt);
    setShowPresetPreview(true);

    // If AI is already active, apply the style immediately
    if (realtimeClientRef.current && aiState === "connected") {
      realtimeClientRef.current.setPrompt(preset.prompt);
      toast({
        title: "Style Applied",
        description: preset.label,
      });
    } else {
      // Otherwise just show preview
      toast({
        title: "Style Selected",
        description: `${preset.label} - Will apply when AI starts`,
      });
    }
  };

  const handleToggleMirror = () => {
    const newMirrorState = !isMirrored;
    setIsMirrored(newMirrorState);

    if (realtimeClientRef.current && aiState === "connected") {
      realtimeClientRef.current.setMirror(newMirrorState);
    }
  };

  const isCameraOpen = cameraState === "camera-open";
  const isAIActive = aiState === "connected" || aiState === "connecting";

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

                {/* Camera State Overlays */}
                {cameraState === "idle" && (
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
                        Start by opening your camera
                      </p>
                    </div>
                  </div>
                )}

                {cameraState === "selecting-camera" && (
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
                            onClick={() => setCameraState("idle")}
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

                {/* Camera Live Indicator */}
                {isCameraOpen && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-full border border-border">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-sm font-medium">Camera Active</span>
                  </div>
                )}

                {/* Start AI Button Overlay - shows when camera is open but AI is not active */}
                {isCameraOpen && !isAIActive && (
                  <div className="absolute bottom-4 left-4 right-4">
                    <Button
                      size="lg"
                      onClick={handleStartAI}
                      className="w-full gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      <Wand2 className="w-5 h-5" />
                      Start AI Restyling
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {/* AI Restyled Output (Secondary Display) */}
            <Card className="relative overflow-hidden video-container border-video-border">
              <div className="aspect-video bg-muted relative">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "w-full h-full object-contain",
                    isMirrored && "scale-x-[-1]"
                  )}
                />

                {/* AI Connecting State */}
                {aiState === "connecting" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                      <p className="text-lg font-medium">Connecting to AI...</p>
                      <p className="text-sm text-muted-foreground mt-2">Starting transformation</p>
                    </div>
                  </div>
                )}

                {/* AI Idle State */}
                {aiState === "idle" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/50 backdrop-blur-sm">
                    <div className="text-center text-muted-foreground">
                      <Wand2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">AI Restyled Output</p>
                      <p className="text-sm mt-2">Click &quot;Start AI Restyling&quot; to begin</p>
                    </div>
                  </div>
                )}

                {/* Live Indicator for Restyled Output */}
                {aiState === "connected" && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-full border border-border">
                    <div className="w-3 h-3 rounded-full bg-primary live-indicator"></div>
                    <span className="text-sm font-medium">AI Active</span>
                  </div>
                )}

                {/* Current Prompt Overlay */}
                {currentPrompt && aiState === "connected" && (
                  <div className="absolute bottom-4 left-4 right-4 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">{currentPrompt}</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Controls Panel */}
          <div className="space-y-4">
            {/* Status Cards */}
            <Card className="p-4 border-border">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Camera Status
              </h3>
              <div className="space-y-3">
                <div className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium text-center",
                  isCameraOpen && "bg-green-500/10 text-green-600 border border-green-500/20",
                  !isCameraOpen && "bg-muted text-muted-foreground"
                )}>
                  {isCameraOpen ? "Camera Open" : "Camera Closed"}
                </div>

                <div className="flex gap-2">
                  {!isCameraOpen ? (
                    <Button
                      onClick={handleOpenCamera}
                      className="flex-1"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Open Camera
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStopCamera}
                      variant="outline"
                      className="flex-1"
                    >
                      <VideoOff className="w-4 h-4 mr-2" />
                      Close Camera
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-4 border-border">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                {aiState === "connected" ? (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                ) : (
                  <Wand2 className="w-4 h-4 text-muted-foreground" />
                )}
                AI Status
              </h3>
              <div className="space-y-3">
                <div className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium text-center",
                  aiState === "connected" && "bg-primary/10 text-primary border border-primary/20",
                  aiState === "connecting" && "bg-secondary text-secondary-foreground",
                  aiState === "idle" && "bg-muted text-muted-foreground"
                )}>
                  {aiState === "connected" && "AI Active"}
                  {aiState === "connecting" && "Connecting AI..."}
                  {aiState === "idle" && "AI Inactive"}
                </div>

                <div className="flex gap-2">
                  {!isAIActive ? (
                    <Button
                      onClick={handleStartAI}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      disabled={!isCameraOpen || !apiKey}
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      Start AI
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStopAI}
                      variant="destructive"
                      className="flex-1"
                    >
                      <VideoOff className="w-4 h-4 mr-2" />
                      Stop AI
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

            {/* Style Presets - Always Available */}
            <Card className="p-4 border-border">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Choose Style
              </h3>
              <div className="space-y-3">
                {/* Selected Preset Display */}
                {selectedPreset && (
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{selectedPreset.emoji}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{selectedPreset.label}</p>
                        <p className="text-xs text-muted-foreground">{selectedPreset.description}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preset Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_STYLES.map((preset) => (
                    <Button
                      key={preset.label}
                      onClick={() => handlePresetClick(preset)}
                      variant={selectedPreset?.label === preset.label ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "flex flex-col h-auto py-3 gap-1",
                        selectedPreset?.label === preset.label && "border-primary"
                      )}
                    >
                      <span className="text-xl">{preset.emoji}</span>
                      <span className="text-xs font-medium">{preset.label}</span>
                    </Button>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  {aiState === "connected"
                    ? "Style will update in real-time"
                    : "Select a style before starting AI"}
                </p>
              </div>
            </Card>

            {/* Custom Style Prompt - Only when AI is active */}
            {isAIActive && (
              <Card className="p-4 border-border">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Wand2 className="w-4 h-4" />
                  Custom Prompt
                </h3>
                <div className="flex gap-2">
                  <Input
                    value={inputPrompt}
                    onChange={(e) => setInputPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSetPrompt()}
                    placeholder="Enter custom style..."
                    className="bg-secondary border-border"
                  />
                  <Button
                    onClick={handleSetPrompt}
                    disabled={!inputPrompt.trim()}
                    size="icon"
                  >
                    <Wand2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            )}

            {/* Microphone Controls */}
            <Card className="p-4 border-border">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                {micState === "active" ? (
                  <Mic className="w-4 h-4 text-primary" />
                ) : (
                  <MicOff className="w-4 h-4 text-muted-foreground" />
                )}
                Microphone
              </h3>
              <div className="space-y-3">
                <div className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium text-center",
                  micState === "active" && "bg-primary/10 text-primary border border-primary/20",
                  micState === "idle" && "bg-muted text-muted-foreground"
                )}>
                  {micState === "active" ? "Microphone Active" : "Microphone Off"}
                </div>

                {micState === "active" && (
                  <div className="p-2 bg-card border border-border rounded-lg">
                    <WaveformVisualizer analyser={analyserRef.current} />
                  </div>
                )}

                {micState === "selecting-mic" && (
                  <div className="space-y-2">
                    <Select
                      value={selectedMicId}
                      onValueChange={setSelectedMicId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a microphone" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMics.map((mic) => (
                          <SelectItem key={mic.deviceId} value={mic.deviceId}>
                            {mic.label || `Microphone ${mic.deviceId.substring(0, 8)}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleMicSelected}
                        className="flex-1"
                        size="sm"
                      >
                        Start
                      </Button>
                      <Button
                        onClick={() => setMicState("idle")}
                        variant="outline"
                        className="flex-1"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {micState !== "selecting-mic" && (
                  <Button
                    onClick={handleToggleMic}
                    variant={micState === "active" ? "outline" : "default"}
                    className="w-full"
                  >
                    {micState === "active" ? (
                      <>
                        <MicOff className="w-4 h-4 mr-2" />
                        Stop Microphone
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 mr-2" />
                        Start Microphone
                      </>
                    )}
                  </Button>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  {micState === "active"
                    ? "Audio will be included in livestream"
                    : "Enable microphone for livestream audio"}
                </p>
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
                  disabled={!isCameraOpen}
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
              audioStream={micStreamRef.current}
              isVideoPlaying={aiState === "connected"}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

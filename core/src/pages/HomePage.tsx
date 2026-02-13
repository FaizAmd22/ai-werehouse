/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import FullscreenLoading from "../components/FullscreenLoading";
import TypeWritter from "../components/TypeWritter";
import VideoPlayer, { type VideoSegment } from "../components/VideoPlayer";
import { useAudioWebsocket } from "../hooks/useAudioWebsocket";
import { ACTIVITIES } from "../utils/voiceCommands";

const IDLE_SEGMENTS: VideoSegment[] = [
  ACTIVITIES.nguap,
  ACTIVITIES.tengok,
  ACTIVITIES.kacamata,
  ACTIVITIES.jam,
  ACTIVITIES.rambut,
];

const getRandomIdle = () =>
  IDLE_SEGMENTS[Math.floor(Math.random() * IDLE_SEGMENTS.length)];

const HomePage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentSegment, setCurrentSegment] = useState<VideoSegment>(
    getRandomIdle()
  );

  const urlSocket = import.meta.env.VITE_URL_SOCKET;
  const accessKey = import.meta.env.VITE_ACCESS_KEY;

  const {
    audioState,
    isConnected,
    transcript,
    isWakeWordLoaded,
    isWakeWordListening,
    vadPhase,
  } = useAudioWebsocket({
    url: urlSocket,
    wake: {
      accessKey,
      keywordLabel: "Hai Tressa",
      keywordPath: "",
      modelPath: "",
    },
    // ✅ NEW: Simplified VAD config
    vad: {
      enabled: true,
      rmsThreshold: 0.01, // Threshold untuk detect suara
      silenceFrames: 15, // 15 frames silence = stop
      minAudioDuration: 400, // Min 400ms untuk valid
      maxRecordingDuration: 10000, // Max 10 detik
      checkInterval: 150, // Check setiap 150ms
    },
  });

  useEffect(() => {
    if (audioState === "IDLE") {
      setCurrentSegment(getRandomIdle());
      return;
    }

    if (audioState === "WAITING" || audioState === "RECORDING") {
      setCurrentSegment(ACTIVITIES.kedip);
      return;
    }

    if (audioState === "PROCESSING" || audioState === "STREAMING") {
      setCurrentSegment(ACTIVITIES.kedip);
      return;
    }
  }, [audioState]);

  const getVadPhaseDisplay = () => {
    switch (vadPhase) {
      case "WAITING_FOR_SPEECH":
        return "🔇 Silakan bicara...";
      case "SPEAKING":
        return "🎤 Mendengarkan...";
      case "SILENCE_AFTER_SPEECH":
        return "⏸️ Menunggu...";
      default:
        return "🔇 Silakan bicara...";
    }
  };

  return (
    <div className="w-screen h-screen bg-primary relative overflow-hidden">
      {isLoading && <FullscreenLoading />}

      <div className="absolute inset-0 z-0">
        <VideoPlayer
          segment={currentSegment}
          onReady={() => setIsLoading(false)}
          onSegmentEnd={() => {
            if (audioState === "IDLE") {
              setCurrentSegment(getRandomIdle());
            }
          }}
        />
      </div>

      {/* Status badges */}
      <div className="fixed top-6 right-6 z-50">
        <div className="flex flex-col gap-2">
          {/* WebSocket Connection */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full shadow-lg bg-black/50">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="text-white text-sm font-medium">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>

          {/* Wake Word Status */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full shadow-lg bg-black/50">
            <div
              className={`w-3 h-3 rounded-full ${
                isWakeWordListening
                  ? "bg-green-500 animate-pulse"
                  : isWakeWordLoaded
                  ? "bg-yellow-500"
                  : "bg-gray-500"
              }`}
            />
            <span className="text-white text-sm font-medium">
              {!isWakeWordLoaded && "Loading wake word..."}
              {isWakeWordLoaded && !isWakeWordListening && "Wake word loaded"}
              {isWakeWordListening && "Listening for 'Hai Tressa'"}
            </span>
          </div>

          {/* Audio State */}
          <div className="px-4 py-2 rounded-full shadow-lg bg-black/50">
            <span className="text-white text-sm font-medium">
              {audioState === "IDLE" && "⚪ Standby"}
              {audioState === "WAITING" && "🟡 Preparing..."}
              {audioState === "RECORDING" && "🔴 Recording..."}
              {audioState === "PROCESSING" && "🟡 Processing..."}
              {audioState === "STREAMING" && "🟢 Playing response..."}
            </span>
          </div>

          {/* VAD Phase Indicator */}
          {audioState === "RECORDING" && (
            <div
              className={`px-4 py-2 rounded-full shadow-lg ${
                vadPhase === "SPEAKING" ? "bg-green-600/70" : "bg-black/50"
              }`}
            >
              <span className="text-white text-sm font-medium">
                {getVadPhaseDisplay()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Avatar name */}
      {audioState === "IDLE" && (
        <>
          <div className="fixed bottom-32 left-0 w-full z-40 p-6 flex items-center justify-center">
            <TypeWritter text={"Tressa"} textSize="text-2xl" isBold />
          </div>

          <div className="fixed bottom-10 left-0 w-full z-40 p-6 flex items-center justify-center">
            <TypeWritter
              text={'Katakan "Hai Tressa" untuk memulai percakapan.'}
              speed={40}
            />
          </div>
        </>
      )}

      {/* Transcript */}
      {transcript &&
        (audioState === "STREAMING" || audioState === "PROCESSING") && (
          <div className="fixed bottom-10 left-0 w-full z-40 p-6 flex items-center justify-center">
            <TypeWritter key={transcript} text={transcript} speed={40} />
          </div>
        )}

      {/* Recording indicator dengan VAD feedback */}
      {audioState === "RECORDING" && (
        <div className="fixed bottom-10 left-0 w-full z-40 flex flex-col items-center gap-4 px-6">
          {/* Main indicator */}
          <div
            className={`text-white px-5 py-3 rounded-2xl ${
              vadPhase === "SPEAKING"
                ? "bg-green-600/90 animate-pulse"
                : "bg-red-600/90"
            }`}
          >
            <p className="text-base font-medium">
              {vadPhase === "WAITING_FOR_SPEECH" && "🔇 Silakan bicara..."}
              {vadPhase === "SPEAKING" && "🎤 Mendengarkan..."}
              {vadPhase === "SILENCE_AFTER_SPEECH" && "⏸️ Menunggu..."}
            </p>
          </div>

          {/* Hint untuk user */}
          {vadPhase === "WAITING_FOR_SPEECH" && (
            <div className="text-white/70 text-sm text-center">
              <p>Bicara dengan jelas dan volume normal</p>
              <p className="text-xs mt-1">
                Rekaman akan berhenti otomatis setelah 10 detik
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HomePage;

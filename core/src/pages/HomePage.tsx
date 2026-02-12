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
  } = useAudioWebsocket({
    url: urlSocket,
    wake: {
      accessKey,
      keywordLabel: "Hai Tressa",
      keywordPath: "",
      modelPath: "",
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

      <div className="fixed top-6 right-6 z-50">
        <div className="flex flex-col gap-2">
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

          <div className="px-4 py-2 rounded-full shadow-lg bg-black/50">
            <span className="text-white text-sm font-medium">
              {audioState === "IDLE" && "Standby"}
              {audioState === "WAITING" && "Preparing..."}
              {audioState === "RECORDING" && "Recording..."}
              {audioState === "PROCESSING" && "Processing..."}
              {audioState === "STREAMING" && "Playing response..."}
            </span>
          </div>
        </div>
      </div>

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

      {transcript &&
        (audioState === "STREAMING" || audioState === "PROCESSING") && (
          <div className="fixed bottom-10 left-0 w-full z-40 p-6 flex items-center justify-center">
            <TypeWritter key={transcript} text={transcript} speed={40} />
          </div>
        )}

      {audioState === "RECORDING" && (
        <div className="fixed bottom-10 left-0 w-full z-40 flex justify-center px-6">
          <div className="bg-red-600/90 text-white px-5 py-3 rounded-2xl animate-pulse">
            <p className="text-base font-medium">Listening...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;

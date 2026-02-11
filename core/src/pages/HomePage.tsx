/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import FullscreenLoading from "../components/FullscreenLoading";
import TypeWritter from "../components/TypeWritter";
import VideoPlayer, { type VideoSegment } from "../components/VideoPlayer";
import { resolveVoiceCommand } from "../utils/resolveVoiceCommand";
import AudioRecorder from "../components/AudioRecorder";
import { useElectronPorcupine } from "../hooks/useElectronPorcupine";
import { voiceReducer, initialVoiceState } from "../state/voiceMachine";
import { ACTIVITIES } from "../utils/voiceCommands";
import { greetingText, standbyText } from "../state/voiceMachine";

const LISTEN_TIMEOUT = 10_000;

// ✅ Idle pool
const IDLE_SEGMENTS: VideoSegment[] = [
  ACTIVITIES.nguap,
  ACTIVITIES.tengok,
  ACTIVITIES.kacamata,
  ACTIVITIES.jam,
  ACTIVITIES.rambut,
];

const getRandomIdle = () =>
  IDLE_SEGMENTS[Math.floor(Math.random() * IDLE_SEGMENTS.length)];

const resumeAudioContext = async () => {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  if (ctx.state === "suspended") {
    await ctx.resume();
    console.log("🔊 AudioContext resumed");
  }
};

const HomePage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [userTranscript, setUserTranscript] = useState("");
  const [state, dispatch] = useReducer(voiceReducer, initialVoiceState);
  const timeoutRef = useRef<any>(null);

  // 🎬 Video state
  const [currentSegment, setCurrentSegment] = useState<VideoSegment>(
    getRandomIdle()
  );

  const { mode, dialogText, segment, shouldRecord, isProcessing, isRecording } =
    state;

  const shouldShowDialog =
    !!dialogText &&
    !(dialogText === greetingText && isRecording) &&
    (mode === "RESPONDING" ||
      mode === "END_CONVERSATION" ||
      mode === "STANDBY" ||
      (mode === "LISTENING" &&
        dialogText !== greetingText &&
        dialogText !== standbyText));

  // ========================
  // 🎤 Wake word
  // ========================
  const onWakeWordDetected = useCallback(() => {
    console.log("🔔 Wake word detected!");
    dispatch({ type: "WAKE_WORD" });
  }, []);

  const { isListening } = useElectronPorcupine({
    onWakeWordDetected,
  });

  // ========================
  // 🎙️ Recording handlers
  // ========================
  const handleRecordingStart = () => {
    clearTimeoutSafe();
    dispatch({ type: "RECORDING_STARTED" });
  };

  const handleRecordingStop = () => {
    dispatch({ type: "RECORDING_STOPPED" });
  };

  const handleRecordingComplete = () => {
    console.log("✅ Recording complete callback");
  };

  // ========================
  // 🔄 Backend processing handlers
  // ========================
  const handleProcessingStart = () => {
    clearTimeoutSafe();
    dispatch({ type: "BACKEND_PROCESSING_START" });
  };

  const handleProcessingEnd = () => {
    dispatch({ type: "BACKEND_PROCESSING_END" });
  };

  // ========================
  // 🧠 Voice result
  // ========================
  const handleVoiceResult = (text: string) => {
    console.log("🎤 Voice result:", text);

    if (!text || text.trim() === "") {
      dispatch({ type: "VOICE_RESULT", text: "" });
      return;
    }

    clearTimeoutSafe();

    setUserTranscript(text);
    setTimeout(() => setUserTranscript(""), 5000);

    const lower = text.toLowerCase();
    const result = resolveVoiceCommand(lower);

    if (!result || !result.segment) {
      dispatch({ type: "VOICE_RESULT", text });
      return;
    }

    dispatch({
      type: "VOICE_RESULT",
      text,
      segment: result.segment,
      dialogText: result.dialogText || "Baik.",
    });
  };

  // ========================
  // 🎬 VIDEO STATE MACHINE
  // ========================
  useEffect(() => {
    if (mode === "STANDBY") {
      setCurrentSegment(getRandomIdle());
      return;
    }

    if (mode === "LISTENING") {
      setCurrentSegment(ACTIVITIES.kedip);
      return;
    }

    if (mode === "RESPONDING" || mode === "END_CONVERSATION") {
      setCurrentSegment(segment);
      return;
    }
  }, [mode, segment]);

  // ========================
  // 🐛 DEBUG
  // ========================
  useEffect(() => {
    console.log("🔄 State changed:", {
      mode,
      dialogText: dialogText.substring(0, 50) + "...",
      shouldShowDialog,
      segment,
    });
  }, [mode, dialogText, shouldShowDialog]);

  // ========================
  // ⏱️ Timeout Management
  // ========================
  const clearTimeoutSafe = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const startSilenceTimer = () => {
    clearTimeoutSafe();
    console.log("⏱️ Starting 10-second silence timer");
    timeoutRef.current = setTimeout(() => {
      console.log("⏰ 10 seconds elapsed without input → END_CONVERSATION");
      dispatch({ type: "NO_SPEECH_TIMEOUT" });
    }, LISTEN_TIMEOUT);
  };

  useEffect(() => {
    clearTimeoutSafe();

    if (mode !== "LISTENING") return;
    if (isRecording || isProcessing) return;

    startSilenceTimer();
    return clearTimeoutSafe;
  }, [mode, isRecording, isProcessing]);

  // ========================
  // 🚀 AUTO-RESUME AUDIO + AUTO-START PORCUPINE (PRODUCTION)
  // ========================
  useEffect(() => {
    if (window.location.protocol !== "file:") return;

    console.log("🚀 Production detected → preparing audio pipeline");

    const prepare = async () => {
      try {
        await resumeAudioContext();
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("🎤 Mic permission granted");
      } catch (err) {
        console.error("❌ Mic/audio init failed:", err);
      }
    };

    prepare();
  }, []);

  return (
    <div className="w-screen h-screen bg-primary relative overflow-hidden">
      {isLoading && <FullscreenLoading />}

      <div className="absolute inset-0 z-0">
        <VideoPlayer
          segment={currentSegment}
          onReady={() => setIsLoading(false)}
          onSegmentEnd={() => {
            if (mode === "STANDBY") {
              setCurrentSegment(getRandomIdle());
            }
          }}
        />
      </div>

      {/* 🎙️ Audio Recorder */}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50">
        <AudioRecorder
          onResult={handleVoiceResult}
          shouldRecord={shouldRecord}
          onRecordingComplete={handleRecordingComplete}
          isListening={mode === "LISTENING"}
          isProcessing={isProcessing}
          onProcessingStart={handleProcessingStart}
          onProcessingEnd={handleProcessingEnd}
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
        />
      </div>

      {/* 🔊 Status badge */}
      <div className="fixed top-6 right-6 z-50">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full shadow-lg bg-black/50">
            <div
              className={`w-3 h-3 rounded-full ${
                isListening ? "bg-green-500 animate-pulse" : "bg-gray-500"
              }`}
            />
            <span className="text-white text-sm font-medium">
              {isListening ? "🎤 Listening for wake word" : "⏸️ Not listening"}
            </span>
          </div>

          <div className="px-4 py-2 rounded-full shadow-lg bg-black/50">
            <span className="text-white text-sm font-medium">
              {mode === "STANDBY" && "⚪ Standby"}
              {mode === "LISTENING" && (
                <>
                  {isRecording && "🔴 Recording..."}
                  {!isRecording && isProcessing && "🟡 Processing..."}
                  {!isRecording && !isProcessing && "🔵 Listening"}
                </>
              )}
              {mode === "RESPONDING" && "🟢 Responding"}
              {mode === "END_CONVERSATION" && "⚫ Ending"}
            </span>
          </div>
        </div>
      </div>

      {/* 🧑 Avatar name */}
      {dialogText === greetingText && !isRecording && mode === "LISTENING" && (
        <div className="fixed bottom-32 left-0 w-full z-40 p-6 flex items-center justify-center">
          <TypeWritter text={"Tressa"} textSize="text-2xl" isBold />
        </div>
      )}

      {/* 💬 Dialog box */}
      {shouldShowDialog && (
        <div className="fixed bottom-10 left-0 w-full z-40 p-6 flex items-center justify-center">
          <TypeWritter
            key={dialogText}
            text={dialogText}
            speed={40}
            onDone={() => {
              console.log("✅ Typewriter done for mode:", mode);

              if (mode === "RESPONDING") {
                setTimeout(() => {
                  console.log("⏱️ 1 second elapsed → back to LISTENING");
                  dispatch({ type: "RESPONSE_FINISHED" });
                }, 1000);
              }

              if (mode === "END_CONVERSATION") {
                console.log(
                  "📝 END_CONVERSATION typewriter done, waiting 500ms..."
                );
                setTimeout(() => {
                  console.log("⏱️ 500ms elapsed → back to STANDBY");
                  dispatch({ type: "END_MESSAGE_FINISHED" });
                }, 500);
              }
            }}
          />
        </div>
      )}

      {/* 📝 Transcript bubble */}
      {userTranscript && mode === "RESPONDING" && (
        <div className="fixed top-24 left-0 w-full z-40 flex justify-center px-6">
          <div className="bg-blue-600/90 text-white px-5 py-3 rounded-2xl max-w-xl animate-fade-in">
            <p className="text-xs opacity-70 mb-1 font-medium">Anda berkata:</p>
            <p className="text-base font-medium">{userTranscript}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;

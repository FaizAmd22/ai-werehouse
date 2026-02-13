/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import { useWakeWord } from "./useWakeWord";
import { playBase64Audio } from "../libs/playBase64Audio";
import VoiceActivityDetector, { type VADPhase } from "../utils/VoiceActivityDetector";

interface QueueItem {
  audioBase64: string;
  text: string;
}

interface AudioQueueCallbacks {
  onChanged?: (text: string) => void;
  onCompleted?: () => void;
}

class AudioQueue {
  private queue: QueueItem[] = [];
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;
  private callbacks: AudioQueueCallbacks = {};

  setCallbacks(callbacks: AudioQueueCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  enqueue(params: {
    audioBase64: string;
    text: string;
    onChanged?: (text: string) => void;
  }) {
    this.queue.push({
      audioBase64: params.audioBase64,
      text: params.text,
    });

    if (params.onChanged) {
      this.callbacks.onChanged = params.onChanged;
    }

    this.playNext();
  }

  private async playNext() {
    if (this.isPlaying || this.queue.length === 0) {
      if (
        !this.isPlaying &&
        this.queue.length === 0 &&
        this.callbacks.onCompleted
      ) {
        this.callbacks.onCompleted();
        this.callbacks = {};
      }
      return;
    }

    this.isPlaying = true;
    const { audioBase64, text } = this.queue.shift()!;

    if (this.callbacks.onChanged) {
      this.callbacks.onChanged(text);
    }

    const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
    this.currentAudio = audio;

    const handlePlaybackEnd = () => {
      this.cleanup();
      this.playNext();
    };

    this.currentAudio.onended = handlePlaybackEnd;
    this.currentAudio.onerror = handlePlaybackEnd;

    try {
      await this.currentAudio.play();
    } catch (error) {
      console.error("[AudioQueue] Play error:", error);
      handlePlaybackEnd();
    }
  }

  private cleanup() {
    if (this.currentAudio) {
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio = null;
    }
    this.isPlaying = false;
  }

  clear() {
    this.queue = [];
    this.cleanup();
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }

  stop() {
    this.clear();
    this.callbacks = {};
  }
}

type AudioState = "IDLE" | "WAITING" | "RECORDING" | "PROCESSING" | "STREAMING";

type UseWakeWordProps = {
  accessKey: string;
  keywordPath: string;
  modelPath: string;
  keywordLabel: string;
};

// ✅ NEW: Simplified VAD Config (matching VoiceActivityDetector)
export type VADConfig = {
  enabled?: boolean;
  rmsThreshold?: number;           // RMS threshold for speech detection
  silenceFrames?: number;          // Number of silent frames before stop
  minAudioDuration?: number;       // Minimum duration for valid audio (ms)
  maxRecordingDuration?: number;   // Maximum recording duration (ms)
  checkInterval?: number;          // How often to check (ms)
};

export type UseAudioWebsocketProps = {
  url: string;
  wake: UseWakeWordProps;
  vad?: VADConfig;  // ✅ Use new VADConfig type
};

export const useAudioWebsocket = (props: UseAudioWebsocketProps) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioSourceRef = useRef<AudioNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioQueueRef = useRef(new AudioQueue());
  
  // ✅ Initialize VAD with simplified config
  const vadRef = useRef<VoiceActivityDetector>(
    new VoiceActivityDetector({
      enabled: props.vad?.enabled ?? true,
      rmsThreshold: props.vad?.rmsThreshold ?? 0.01,
      silenceFrames: props.vad?.silenceFrames ?? 15,
      minAudioDuration: props.vad?.minAudioDuration ?? 400,
      maxRecordingDuration: props.vad?.maxRecordingDuration ?? 10000,
      checkInterval: props.vad?.checkInterval ?? 150,
    })
  );
  
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const silenceCheckIntervalRef = useRef<number | null>(null);

  const [audioState, setAudioState] = useState<AudioState>("IDLE");
  const [transcript, setTranscript] = useState<string>("");
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [vadPhase, setVadPhase] = useState<VADPhase>("IDLE");

  const isSessionActiveRef = useRef(false);

  const { message, sendBytes, sendEvent, isConnected } = useWebSocket(
    props.url
  );

  const { isLoaded: isWakeWordLoaded, isListening: isWakeWordListening } =
    useWakeWord({
      ...props.wake,
      onDetected: () => {
        if (isSessionActiveRef.current) {
          console.warn("⚠️ [Wake Word] Session already active, ignoring");
          return;
        }

        if (audioState !== "IDLE") {
          console.warn("⚠️ [Wake Word] Not IDLE, ignoring. Current state:", audioState);
          return;
        }

        console.log("🔔 [Wake Word] Detected! Starting session...");
        isSessionActiveRef.current = true;
        vadRef.current.reset();
        setAudioState("WAITING");
        sendEvent("client:trigger");
      },
    });

  const stopRecord = useCallback(() => {
    console.log("🛑 [Record] Stopping...");
    
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }

    if (analyzerRef.current) {
      analyzerRef.current.disconnect();
      analyzerRef.current = null;
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.port.onmessageerror = null;
      workletNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    setIsUserSpeaking(false);
    setVadPhase("IDLE");
  }, []);

  const startRecord = useCallback(async () => {
    if (!isConnected) {
      console.warn("⚠️ [Record] Cannot start: not connected");
      return;
    }

    if (audioState === "PROCESSING" || audioState === "STREAMING") {
      console.warn("⚠️ [Record] Cannot start: already processing/streaming");
      return;
    }

    console.log("🎤 [Record] Starting...");

    try {
      setAudioState("RECORDING");
      sendEvent("client:record");

      // ✅ Tell VAD that recording started
      vadRef.current.startRecording();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      await audioContext.audioWorklet.addModule("/audio-processor.js");

      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, "pcm-processor");

      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 2048;
      analyzerRef.current = analyzer;

      audioContextRef.current = audioContext;
      workletNodeRef.current = workletNode;
      audioSourceRef.current = source;

      source.connect(analyzer);
      source.connect(workletNode);

      workletNode.port.onmessage = (event) => {
        if (event.data) {
          const pcmData = new Uint8Array(event.data);
          sendBytes(pcmData);
        }
      };

      workletNode.port.onmessageerror = (error) => {
        console.error("❌ [Record] Worklet port error:", error);
        stopRecord();
      };

      stream.getAudioTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          console.log("🎤 [Record] Audio track ended");
          stopRecord();
          setAudioState("IDLE");
          isSessionActiveRef.current = false;
        });
      });

      // ✅ VAD monitoring - SIMPLIFIED (like AudioRecorder)
      if (props.vad?.enabled !== false) {
        const bufferLength = analyzer.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);

        silenceCheckIntervalRef.current = window.setInterval(() => {
          if (!workletNodeRef.current) return;

          analyzer.getFloatTimeDomainData(dataArray);
          
          // ✅ Process audio with VAD
          const hasVoice = vadRef.current.processAudio(dataArray);
          const currentPhase = vadRef.current.getCurrentPhase();
          
          setIsUserSpeaking(hasVoice);
          setVadPhase(currentPhase);

          // ✅ Debug log when voice detected
          if (hasVoice) {
            const debugInfo = vadRef.current.getDebugInfo();
            console.log("🔊 [VAD] Audio detected!", debugInfo);
          }

          // ✅ Auto-stop logic
          if (vadRef.current.shouldStop()) {
            // Validate if we have valid speech
            if (!vadRef.current.hasValidSpeech()) {
              console.warn("⚠️ [VAD] No valid speech detected, canceling...");
              stopRecord();
              setAudioState("IDLE");
              isSessionActiveRef.current = false;
              return;
            }

            console.log("✅ [VAD] Valid speech detected, ending recording");
            stopRecord();
            sendEvent("client:record:end");
          }
        }, props.vad?.checkInterval ?? 150); // ✅ Use configurable interval
      }

    } catch (err) {
      console.error("❌ [Record] Error:", err);
      setAudioState("IDLE");
      isSessionActiveRef.current = false;

      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          alert("Microphone access denied. Please allow microphone permissions.");
        } else if (err.name === "NotFoundError") {
          alert("No microphone found. Please connect a microphone.");
        } else {
          alert(`Failed to start recording: ${err.message}`);
        }
      }
    }
  }, [isConnected, audioState, sendBytes, sendEvent, stopRecord, props.vad]);

  useEffect(() => {
    if (!message) return;

    try {
      const msg = JSON.parse(message as string);

      if (!msg.event) return;

      switch (msg.event) {
        case "on:trigger:audio": {
          if (!msg.data?.audio) return;
          
          playBase64Audio(msg.data.audio, () => {
            startRecord();
          });
          break;
        }

        case "on:record:ended": {
          console.log("🛑 [WS] Server ended recording");
          stopRecord();
          setAudioState("IDLE");
          isSessionActiveRef.current = false;
          break;
        }

        case "on:llm:processing": {
          console.log("🤖 [WS] LLM processing...");
          stopRecord();
          setAudioState("PROCESSING");
          break;
        }

        case "on:stream:start": {
          setAudioState("STREAMING");
          setTranscript("");
          
          audioQueueRef.current.setCallbacks({
            onCompleted: () => {
              setAudioState("IDLE");
              isSessionActiveRef.current = false;
              console.log("🔓 [Session] Unlocked");
            },
          });
          break;
        }

        case "on:stream:chunk": {
          if (!msg.data?.text || !msg.data?.audio) return;

          audioQueueRef.current.enqueue({
            audioBase64: msg.data.audio,
            text: msg.data.text,
            onChanged: (newText) => {
              setTranscript((prev) => (prev ? prev + " " : "") + newText);
            },
          });
          break;
        }

        case "on:stream:complete": {
          console.log("✅ [WS] Stream complete");
          break;
        }

        default:
          break;
      }
    } catch (error) {
      console.error("❌ [WS] Parse error:", error);
    }
  }, [message, startRecord, stopRecord]);

  useEffect(() => {
    const audioQueue = audioQueueRef.current;
    const stopRecordFn = stopRecord;

    return () => {
      audioQueue.stop();
      stopRecordFn();
      isSessionActiveRef.current = false;
      
      if (silenceCheckIntervalRef.current) {
        clearInterval(silenceCheckIntervalRef.current);
      }
    };
  }, [stopRecord]);

  return {
    isConnected,
    audioState,
    transcript,
    isWakeWordLoaded,
    isWakeWordListening,
    isUserSpeaking,
    vadPhase,
  };
};
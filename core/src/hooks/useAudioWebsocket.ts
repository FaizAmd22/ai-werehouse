/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import { useWakeWord } from "./useWakeWord";
import { playBase64Audio } from "../libs/playBase64Audio";

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
    console.log("[AudioQueue.enqueue] Adding to queue", {
      queueLength: this.queue.length,
      isPlaying: this.isPlaying,
      textLength: params.text.length,
      audioLength: params.audioBase64.length,
    });

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
    console.log("[AudioQueue.playNext] Called", {
      isPlaying: this.isPlaying,
      queueLength: this.queue.length,
    });

    if (this.isPlaying || this.queue.length === 0) {
      if (
        !this.isPlaying &&
        this.queue.length === 0 &&
        this.callbacks.onCompleted
      ) {
        console.log("[AudioQueue.playNext] Queue complete, calling onCompleted");
        this.callbacks.onCompleted();
        this.callbacks = {};
      }
      return;
    }

    this.isPlaying = true;
    const { audioBase64, text } = this.queue.shift()!;

    console.log("[AudioQueue.playNext] Playing audio", {
      text,
      remainingInQueue: this.queue.length,
    });

    if (this.callbacks.onChanged) {
      this.callbacks.onChanged(text);
    }

    const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
    this.currentAudio = audio;

    const handlePlaybackEnd = () => {
      console.log("[AudioQueue.playNext] Playback ended, continuing queue");
      this.cleanup();
      this.playNext();
    };

    this.currentAudio.onended = handlePlaybackEnd;

    this.currentAudio.onerror = (error) => {
      console.error("[AudioQueue.playNext] Audio playback error:", error);
      handlePlaybackEnd();
    };

    try {
      await this.currentAudio.play();
      console.log("[AudioQueue.playNext] Audio playing started");
    } catch (error) {
      console.error("[AudioQueue.playNext] Audio play() error:", error);
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

export type UseAudioWebsocketProps = {
  url: string;
  wake: UseWakeWordProps;
};

export const useAudioWebsocket = (props: UseAudioWebsocketProps) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioSourceRef = useRef<AudioNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const isAllowTriggeredRef = useRef(true);
  const audioQueueRef = useRef(new AudioQueue());
  const [audioState, setAudioState] = useState<AudioState>("IDLE");
  const [transcript, setTranscript] = useState<string>("");

  const { message, sendBytes, sendEvent, isConnected } = useWebSocket(
    props.url
  );

  const { isLoaded: isWakeWordLoaded, isListening: isWakeWordListening } =
    useWakeWord({
      ...props.wake,
      onDetected: () => {
        if (audioState === "IDLE" && isAllowTriggeredRef.current) {
          console.log("Wake word detected!");
          setAudioState("WAITING");
          sendEvent("client:trigger");
        }
      },
    });

  const stopRecord = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
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
  }, []);

  const startRecord = useCallback(async () => {
    if (!isConnected) {
      console.log("Cannot start recording: not connected");
      return;
    }
    console.log("[START RECORD]");

    try {
      setAudioState("RECORDING");
      sendEvent("client:record");

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

      audioContextRef.current = audioContext;
      workletNodeRef.current = workletNode;
      audioSourceRef.current = source;

      workletNode.port.onmessage = (event) => {
        if (event.data) {
          const pcmData = new Uint8Array(event.data);
          sendBytes(pcmData);
        }
      };

      workletNode.port.onmessageerror = (error) => {
        console.error("Worklet port error:", error);
        stopRecord();
      };

      source.connect(workletNode);

      stream.getAudioTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          console.log("[AUDIO TRACK ENDED]");
          stopRecord();
          setAudioState("IDLE");
        });
      });
    } catch (err) {
      setAudioState("IDLE");

      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          alert(
            "Microphone access denied. Please allow microphone permissions."
          );
        } else if (err.name === "NotFoundError") {
          alert("No microphone found. Please connect a microphone.");
        } else {
          alert(`Failed to start recording: ${err.message}`);
        }
      }
    }
  }, [isConnected, sendBytes, sendEvent, stopRecord]);

  useEffect(() => {
    if (!message) return;

    try {
      const msg = JSON.parse(message as string);
      console.log("[MESSAGE RECEIVED]", msg.event);

      if (!msg.event) {
        console.warn("[INVALID MESSAGE] Missing event field:", msg);
        return;
      }

      switch (msg.event) {
        case "on:trigger:audio": {
          if (!msg.data?.audio) {
            console.error("[on:trigger:audio] Missing audio data");
            return;
          }
          playBase64Audio(msg.data.audio, () => {
            startRecord();
          });
          break;
        }
        case "on:record:ended": {
          setAudioState("IDLE");
          stopRecord();
          isAllowTriggeredRef.current = false;
          break;
        }
        case "on:llm:processing": {
          setAudioState("PROCESSING");
          stopRecord();
          return;
        }
        case "on:stream:start": {
          console.log("[STREAM START]");
          setAudioState("STREAMING");
          setTranscript("");
          audioQueueRef.current.setCallbacks({
            onCompleted: () => {
              console.log("[ALL AUDIO PLAYBACK COMPLETE]");
              setAudioState("RECORDING");
              startRecord();
            },
          });
          return;
        }
        case "on:stream:chunk": {
          console.log("[STREAM CHUNK RECEIVED]");

          if (!msg.data) {
            console.error("[on:stream:chunk] Missing data object");
            return;
          }

          const text = msg.data.text;
          const audio = msg.data.audio;

          if (!text || !audio) {
            console.error("[on:stream:chunk] Invalid chunk data:", {
              hasText: !!text,
              hasAudio: !!audio,
            });
            return;
          }

          console.log("[ENQUEUING CHUNK]", {
            textLength: text.length,
            audioLength: audio.length,
          });

          try {
            audioQueueRef.current.enqueue({
              audioBase64: audio,
              text,
              onChanged: (newText) => {
                console.log("[TRANSCRIPT UPDATE]", newText);
                setTranscript((prev) => (prev ? prev + " " : "") + newText);
              },
            });
            console.log("[CHUNK ENQUEUED SUCCESSFULLY]");
          } catch (error) {
            console.error("[ENQUEUE ERROR]", error);
          }
          return;
        }
        case "on:stream:complete": {
          console.log("[STREAM COMPLETE] All chunks received from server");
          return;
        }
        default:
          console.log("[UNKNOWN EVENT]", msg.event);
          break;
      }
    } catch (error) {
      console.error("[MESSAGE PARSE ERROR]", error, message);
    }
  }, [message, startRecord, stopRecord]);

  useEffect(() => {
    const intv = setInterval(() => {
      if (!isAllowTriggeredRef.current) {
        isAllowTriggeredRef.current = true;
      }
    }, 2000);

    return () => {
      clearInterval(intv);
    };
  }, []);

  useEffect(() => {
    const audioQueue = audioQueueRef.current;
    const stopRecordFn = stopRecord;

    return () => {
      audioQueue.stop();
      stopRecordFn();
    };
  }, [stopRecord]);

  return {
    isConnected,
    audioState,
    transcript,
    isWakeWordLoaded,
    isWakeWordListening,
  };
};
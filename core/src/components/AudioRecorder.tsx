/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import Lottie from "lottie-react";
import { useRef, useState, useEffect } from "react";
import visualiazerImage from "../assets/voice-visualizer.json";

interface AudioRecorderProps {
  onResult: (text: string) => void;
  shouldRecord: boolean;
  onRecordingComplete: () => void;
  isListening?: boolean;
  isProcessing?: boolean;
  onProcessingStart?: () => void;
  onProcessingEnd?: () => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onResult,
  shouldRecord,
  onRecordingComplete,
  isListening,
  isProcessing,
  onProcessingStart,
  onProcessingEnd,
  onRecordingStart,
  onRecordingStop,
}) => {
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const startTime = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceCheckInterval = useRef<any | null>(null);
  const maxDurationTimeout = useRef<any | null>(null);
  const [rms, setRms] = useState(0);
  const hasAudioDetected = useRef<boolean>(false);

  const RMS_THRESHOLD = 0.01;
  const SILENCE_FRAMES = 15;
  const MIN_AUDIO_DURATION = 400;
  const MIN_BLOB_SIZE = 1000;

  const getRms = () => {
    if (!analyser.current) return 0;
    const buffer = new Float32Array(analyser.current.fftSize);
    analyser.current.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  };

  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContext.current && audioContext.current.state !== "closed") {
      audioContext.current.close();
      audioContext.current = null;
    }
    if (silenceCheckInterval.current) {
      clearInterval(silenceCheckInterval.current);
      silenceCheckInterval.current = null;
    }
    if (maxDurationTimeout.current) {
      clearTimeout(maxDurationTimeout.current);
      maxDurationTimeout.current = null;
    }
  };

  const resumeAudio = async () => {
    if (audioContext.current && audioContext.current.state === "suspended") {
      await audioContext.current.resume();
      console.log("🔊 AudioContext resumed");
    }
  };

  const sendToBackend = async (blob: Blob) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12_000);

    try {
      console.log("📤 Sending to backend...");
      onProcessingStart?.();

      const form = new FormData();
      form.append("file", blob, "audio.webm");

      const res = await fetch("http://localhost:3001/api/stt", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error("Backend response not OK");
      }

      const data = await res.json();
      console.log("📨 Backend response:", data);

      const normalizedText = data.text?.trim() || "";
      onResult(normalizedText);
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.error("⏱️ Backend request timeout");
      } else {
        console.error("❌ Backend request failed:", err);
      }
      onResult("");
    } finally {
      clearTimeout(timeoutId);
      onProcessingEnd?.();
      onRecordingComplete();
    }
  };

  const stop = async (reason: "normal" | "silence" | "force" = "normal") => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      console.log("⏹️ Stopping recording...", reason);
      console.log("📊 hasAudioDetected:", hasAudioDetected.current);

      mediaRecorder.current.stop();
      setRecording(false);
      onRecordingStop?.();

      if (silenceCheckInterval.current) {
        clearInterval(silenceCheckInterval.current);
        silenceCheckInterval.current = null;
      }
      if (maxDurationTimeout.current) {
        clearTimeout(maxDurationTimeout.current);
        maxDurationTimeout.current = null;
      }
    }
  };

  const start = async () => {
    try {
      if (isProcessing) {
        console.log("🚫 Start blocked: backend processing");
        return;
      }

      if (mediaRecorder.current?.state === "recording") {
        console.log("🚫 Start blocked: already recording");
        return;
      }

      console.log("🎙️ Starting recording...");
      hasAudioDetected.current = false;

      let stream = streamRef.current;
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 16000,
          },
        });
        streamRef.current = stream;

        audioContext.current = new AudioContext();
        await resumeAudio();

        const source = audioContext.current.createMediaStreamSource(stream);
        analyser.current = audioContext.current.createAnalyser();
        analyser.current.fftSize = 1024;
        analyser.current.smoothingTimeConstant = 0.8;
        source.connect(analyser.current);
      }

      mediaRecorder.current = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : undefined,
      });

      chunks.current = [];
      startTime.current = Date.now();

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.current.push(e.data);
          console.log("📦 Chunk received:", e.data.size, "bytes");
        }
      };

      mediaRecorder.current.onstop = async () => {
        const duration = Date.now() - startTime.current;
        console.log("⏱️ Recording duration:", duration, "ms");
        console.log("📦 Total chunks:", chunks.current.length);
        console.log(
          "🔊 Audio detected during recording:",
          hasAudioDetected.current
        );

        if (duration < MIN_AUDIO_DURATION) {
          console.warn("⚠️ Recording too short");
          onResult("");
          onRecordingComplete();
          return;
        }

        if (chunks.current.length === 0) {
          console.warn("⚠️ No chunks recorded");
          onResult("");
          onRecordingComplete();
          return;
        }

        const blob = new Blob(chunks.current, { type: "audio/webm" });
        console.log("💾 Blob created:", blob.size, "bytes");

        if (blob.size < MIN_BLOB_SIZE) {
          console.warn("⚠️ Blob too small");
          onResult("");
          onRecordingComplete();
          return;
        }

        if (!hasAudioDetected.current) {
          console.warn("⚠️ No significant audio detected during recording");
          onResult("");
          onRecordingComplete();
          return;
        }

        await sendToBackend(blob);
      };

      mediaRecorder.current.onerror = (e) => {
        console.error("❌ MediaRecorder error:", e);
        onResult("");
        onRecordingComplete();
      };

      mediaRecorder.current.start(200);
      setRecording(true);
      onRecordingStart?.();
      console.log("✅ Recording started");

      let silentFrames = 0;

      silenceCheckInterval.current = setInterval(() => {
        if (mediaRecorder.current?.state !== "recording") return;

        const value = getRms();
        setRms(value);

        if (value > RMS_THRESHOLD) {
          hasAudioDetected.current = true;
          silentFrames = 0;
          console.log("🔊 Audio detected! RMS:", value.toFixed(4));
        } else {
          if (hasAudioDetected.current) {
            silentFrames++;
            if (silentFrames >= SILENCE_FRAMES) {
              console.log("🔇 Silence after speech → stop");
              stop("silence");
            }
          }
        }
      }, 150);

      maxDurationTimeout.current = setTimeout(() => {
        if (mediaRecorder.current?.state === "recording") {
          console.log("⏰ Max duration reached → stop");
          stop("normal");
        }
      }, 10_000);
    } catch (err) {
      console.error("❌ Failed to start recording:", err);
      onResult("");
      onRecordingComplete();
    }
  };

  useEffect(() => {
    if (shouldRecord && !recording && !isProcessing) {
      console.log("🎯 shouldRecord = true → start recording");
      start();
    }

    if (!shouldRecord && recording) {
      console.log("🛑 shouldRecord = false → force stop recording");
      stop("force");
    }
  }, [shouldRecord, recording, isProcessing]);

  useEffect(() => {
    return () => {
      console.log("🧹 AudioRecorder unmounting...");
      if (recording) stop("force");
      cleanupStream();
    };
  }, []);

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-24 h-24 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        <div className="text-white text-xs opacity-80">Memproses suara...</div>
      </div>
    );
  }

  if (!recording || !isListening) return null;

  const scale = 1 + Math.min(rms * 10, 1.2);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="w-36 h-36 transition-transform duration-100"
        style={{ transform: `scale(${scale})` }}
      >
        <Lottie animationData={visualiazerImage} loop />
      </div>
      {hasAudioDetected.current && (
        <div className="text-white text-xs bg-green-500/80 px-3 py-1 rounded-full">
          🔊 Audio detected
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;

export type VADPhase = 
  | "IDLE"
  | "WAITING_FOR_SPEECH"
  | "SPEAKING"
  | "SILENCE_AFTER_SPEECH";

interface VADConfig {
  enabled?: boolean;
  rmsThreshold?: number;          // ✅ Simplified: just RMS threshold
  silenceFrames?: number;         // ✅ Frames of silence before stop
  minAudioDuration?: number;      // ✅ Min duration for valid audio
  maxRecordingDuration?: number;  // ✅ Max recording duration
  checkInterval?: number;         // ✅ How often to check (ms)
}

export default class VoiceActivityDetector {
  private config: Required<VADConfig>;
  private phase: VADPhase = "IDLE";
  
  // Speech detection (simplified like AudioRecorder)
  private hasAudioDetected = false;
  private silentFrameCount = 0;
  
  // Recording timing
  private recordingStartTime = 0;
  
  constructor(config: VADConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      rmsThreshold: config.rmsThreshold ?? 0.01,           // Same as AudioRecorder
      silenceFrames: config.silenceFrames ?? 15,           // Same as AudioRecorder (15 frames)
      minAudioDuration: config.minAudioDuration ?? 400,    // Same as AudioRecorder
      maxRecordingDuration: config.maxRecordingDuration ?? 10000, // 10 seconds
      checkInterval: config.checkInterval ?? 150,          // Same as AudioRecorder
    };
  }

  startRecording(): void {
    console.log("🎬 [VAD] Recording started");
    this.recordingStartTime = Date.now();
    this.phase = "WAITING_FOR_SPEECH";
    this.hasAudioDetected = false;
    this.silentFrameCount = 0;
  }

  reset(): void {
    this.hasAudioDetected = false;
    this.silentFrameCount = 0;
    this.phase = "IDLE";
  }

  // ✅ Simplified RMS calculation (same as AudioRecorder)
  private calculateRMS(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  processAudio(audioData: Float32Array): boolean {
    if (!this.config.enabled) return true;

    const rms = this.calculateRMS(audioData);
    const isSpeech = rms > this.config.rmsThreshold;

    // ✅ EXACT same logic as AudioRecorder
    if (isSpeech) {
      this.hasAudioDetected = true;
      this.silentFrameCount = 0;
      
      if (this.phase !== "SPEAKING") {
        this.phase = "SPEAKING";
        console.log(`🗣️ [VAD] Speech started (RMS: ${rms.toFixed(4)})`);
      }
    } else {
      // Only count silence AFTER we've detected audio
      if (this.hasAudioDetected) {
        this.silentFrameCount++;
        
        if (this.phase === "SPEAKING" && this.silentFrameCount >= this.config.silenceFrames) {
          this.phase = "SILENCE_AFTER_SPEECH";
          console.log(`⏸️ [VAD] Silence detected after speech (${this.silentFrameCount} frames)`);
        }
      }
    }

    return this.phase === "SPEAKING";
  }

  shouldStop(): boolean {
    const now = Date.now();
    const recordingDuration = now - this.recordingStartTime;
    
    // ✅ Timeout jika lebih dari max duration
    if (recordingDuration >= this.config.maxRecordingDuration) {
      console.warn(`⏱️ [VAD] Max recording duration reached (${recordingDuration}ms)`);
      return true;
    }

    // ✅ Stop setelah silence (sama seperti AudioRecorder)
    if (this.phase === "SILENCE_AFTER_SPEECH") {
      console.log(`✅ [VAD] Stopping after silence`);
      return true;
    }

    return false;
  }

  hasValidSpeech(): boolean {
    const now = Date.now();
    const recordingDuration = now - this.recordingStartTime;
    
    // ✅ Must have detected audio
    if (!this.hasAudioDetected) {
      console.warn("⚠️ [VAD] No audio detected during recording");
      return false;
    }

    // ✅ Must meet minimum duration
    if (recordingDuration < this.config.minAudioDuration) {
      console.warn(`⚠️ [VAD] Recording too short: ${recordingDuration}ms (min: ${this.config.minAudioDuration}ms)`);
      return false;
    }

    console.log(`✅ [VAD] Valid speech detected: ${recordingDuration}ms`);
    return true;
  }

  getCurrentPhase(): VADPhase {
    return this.phase;
  }

  getDebugInfo() {
    const now = Date.now();
    return {
      phase: this.phase,
      hasAudioDetected: this.hasAudioDetected,
      silentFrameCount: this.silentFrameCount,
      recordingDuration: this.recordingStartTime ? now - this.recordingStartTime : 0,
      rmsThreshold: this.config.rmsThreshold,
    };
  }
}
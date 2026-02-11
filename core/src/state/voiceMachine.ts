/* eslint-disable @typescript-eslint/no-explicit-any */
import { ACTIVITIES } from "../utils/voiceCommands";

export type VoiceMode =
  | "STANDBY"
  | "LISTENING"
  | "RESPONDING"
  | "END_CONVERSATION";

export interface VoiceState {
  mode: VoiceMode;
  dialogText: string;
  segment: any;
  shouldRecord: boolean;
  isProcessing: boolean;
  isRecording: boolean;
}

export type VoiceAction =
  | { type: "WAKE_WORD" }
  | { type: "RECORDING_STARTED" }
  | { type: "RECORDING_STOPPED" }
  | { type: "VOICE_RESULT"; text: string; segment?: any; dialogText?: string }
  | { type: "NO_SPEECH_TIMEOUT" }
  | { type: "RESPONSE_FINISHED" }
  | { type: "END_MESSAGE_FINISHED" }
  | { type: "BACKEND_PROCESSING_START" }
  | { type: "BACKEND_PROCESSING_END" };

export const greetingText =
  "Halo! Perkenalkan saya Tressa, Virtual Assistant Treffix yang siap membantu Anda. Ada yang bisa saya bantu?";

export const fallbackText =
  "Maaf saya tidak memahami perkataan anda, Bisakah kamu ulangi lagi?";

export const standbyText = `Katakan "Hai Tressa" untuk memulai percakapan.`;

export const initialVoiceState: VoiceState = {
  mode: "STANDBY",
  dialogText: standbyText,
  segment: ACTIVITIES.rambut,
  shouldRecord: false,
  isProcessing: false,
  isRecording: false,
};

export function voiceReducer(
  state: VoiceState,
  action: VoiceAction
): VoiceState {
  switch (action.type) {
    // =========================
    // 🟤 WAKE WORD
    // =========================
    case "WAKE_WORD":
      if (state.mode !== "STANDBY") return state;
      return {
        ...state,
        mode: "LISTENING",
        dialogText: greetingText,
        segment: ACTIVITIES.kedip,
        shouldRecord: true,
        isProcessing: false,
        isRecording: false,
      };

    // =========================
    // 🎙️ RECORDING
    // =========================
    case "RECORDING_STARTED":
      return {
        ...state,
        isRecording: true,
      };

    case "RECORDING_STOPPED":
      return {
        ...state,
        isRecording: false,
        shouldRecord: false,
      };

    // =========================
    // 🔄 BACKEND PROCESSING
    // =========================
    case "BACKEND_PROCESSING_START":
      return {
        ...state,
        isProcessing: true,
        shouldRecord: false, // ⛔ HARD STOP
        isRecording: false,
      };

    case "BACKEND_PROCESSING_END":
      return {
        ...state,
        isProcessing: false,
      };

    // =========================
    // 🧠 VOICE RESULT
    // =========================
    case "VOICE_RESULT": {
      const text = action.text.trim();

      // ❌ Tidak ada suara bermakna → tetap di LISTENING, jangan ubah state
      if (!text) {
        console.log("⚠️ Empty voice result, staying in LISTENING");
        return {
          ...state,
          shouldRecord: false,
          isProcessing: false,
          isRecording: false,
        };
      }

      // ❌ Command tidak dikenali → show fallback
      if (!action.segment) {
        return {
          ...state,
          mode: "RESPONDING",
          dialogText: fallbackText,
          segment: ACTIVITIES.bicara,
          shouldRecord: false,
          isProcessing: false,
          isRecording: false,
        };
      }

      // ✅ Command valid → show response
      return {
        ...state,
        mode: "RESPONDING",
        dialogText: action.dialogText || text,
        segment: action.segment,
        shouldRecord: false,
        isProcessing: false,
        isRecording: false,
      };
    }

    // =========================
    // ⏱️ TIMEOUT (10 detik tanpa input)
    // =========================
    case "NO_SPEECH_TIMEOUT":
      if (state.mode !== "LISTENING") return state;
      if (state.isRecording || state.isProcessing) return state;

      return {
        ...state,
        mode: "END_CONVERSATION",
        dialogText:
          "Sepertinya sudah selesai, Jika ada perlu lagi panggil aku yaa!",
        segment: ACTIVITIES.nguap,
        shouldRecord: false,
        isProcessing: false,
        isRecording: false,
      };

    // =========================
    // 🟢 RESPONSE FINISHED (setelah typewriter selesai)
    // =========================
    case "RESPONSE_FINISHED":
      if (state.mode !== "RESPONDING") return state;
      
      // Setelah response selesai ditampilkan → kembali ke LISTENING
      // PENTING: dialogText TETAP sama (tidak berubah)
      return {
        ...state,
        mode: "LISTENING",
        shouldRecord: true,
        isProcessing: false,
        isRecording: false,
        // dialogText TIDAK DIUBAH - tetap response terakhir
      };

    // =========================
    // ⚫ END MESSAGE FINISHED
    // =========================
    case "END_MESSAGE_FINISHED":
      if (state.mode !== "END_CONVERSATION") return state;
      return {
        ...state,
        mode: "STANDBY",
        dialogText: standbyText,
        segment: ACTIVITIES.rambut,
        shouldRecord: false,
        isProcessing: false,
        isRecording: false,
      };

    default:
      return state;
  }
}
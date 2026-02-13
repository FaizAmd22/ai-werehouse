/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================
// VOICE STATE MACHINE
// ============================================

export type VoiceMode = 
  | "STANDBY"      // Menunggu wake word
  | "LISTEN"       // Recording & mengirim ke backend
  | "RESPONSE"     // Menampilkan & memutar response
  | "END_CONVERSATION"; // Goodbye message

export type VoiceEvent = 
  // Wake word detected
  | { type: "WAKE_WORD_DETECTED" }
  
  // Recording events
  | { type: "RECORDING_STARTED" }
  | { type: "RECORDING_STOPPED" }
  | { type: "RECORDING_TIMEOUT" }      // 10 detik tanpa perintah
  | { type: "NO_VALID_SPEECH" }        // Audio detected tapi tidak jelas
  
  // Backend events
  | { type: "BACKEND_PROCESSING_START" }
  | { type: "BACKEND_PROCESSING_END" }
  | { type: "BACKEND_RESPONSE_RECEIVED"; response: BackendResponse }
  
  // Response playback events
  | { type: "RESPONSE_PLAYBACK_STARTED" }
  | { type: "RESPONSE_PLAYBACK_COMPLETE" }
  | { type: "RESPONSE_DISPLAY_COMPLETE" }  // Text selesai ditampilkan + 2 detik
  
  // End conversation
  | { type: "END_MESSAGE_COMPLETE" };

export interface BackendResponse {
  text: string;
  audio: string; // base64
  segment?: any; // video segment
}

export interface VoiceState {
  mode: VoiceMode;
  
  // Recording state
  isRecording: boolean;
  isProcessingBackend: boolean;
  
  // Response state
  currentResponse: BackendResponse | null;
  isPlayingResponse: boolean;
  
  // UI state
  displayText: string;
  shouldShowRecordingIndicator: boolean;
  
  // Session tracking
  conversationActive: boolean;
}

export const initialVoiceState: VoiceState = {
  mode: "STANDBY",
  isRecording: false,
  isProcessingBackend: false,
  currentResponse: null,
  isPlayingResponse: false,
  displayText: 'Katakan "Hai Tressa" untuk memulai percakapan.',
  shouldShowRecordingIndicator: false,
  conversationActive: false,
};

// ============================================
// STATE TRANSITIONS
// ============================================

export function voiceReducer(
  state: VoiceState,
  event: VoiceEvent
): VoiceState {
  console.log(`🔄 [State Machine] ${state.mode} + ${event.type}`);

  switch (state.mode) {
    // ========================================
    // MODE: STANDBY
    // ========================================
    case "STANDBY": {
      if (event.type === "WAKE_WORD_DETECTED") {
        return {
          ...state,
          mode: "LISTEN",
          conversationActive: true,
          displayText: "Sedang mendengarkan...",
        };
      }
      return state;
    }

    // ========================================
    // MODE: LISTEN
    // ========================================
    case "LISTEN": {
      // Recording started
      if (event.type === "RECORDING_STARTED") {
        return {
          ...state,
          isRecording: true,
          shouldShowRecordingIndicator: true,
          displayText: "Silakan bicara dengan jelas...",
        };
      }

      // Recording stopped (by VAD or user)
      if (event.type === "RECORDING_STOPPED") {
        return {
          ...state,
          isRecording: false,
          shouldShowRecordingIndicator: false,
        };
      }

      // Backend processing started
      if (event.type === "BACKEND_PROCESSING_START") {
        return {
          ...state,
          isRecording: false,
          isProcessingBackend: true,
          shouldShowRecordingIndicator: false,
          displayText: "Memproses...",
        };
      }

      // Backend processing ended
      if (event.type === "BACKEND_PROCESSING_END") {
        return {
          ...state,
          isProcessingBackend: false,
        };
      }

      // Backend response received
      if (event.type === "BACKEND_RESPONSE_RECEIVED") {
        return {
          ...state,
          mode: "RESPONSE",
          isProcessingBackend: false,
          currentResponse: event.response,
          displayText: event.response.text,
        };
      }

      // Timeout: 10 detik tanpa perintah
      if (event.type === "RECORDING_TIMEOUT") {
        console.warn("⏱️ [Listen] Timeout - no valid command in 10 seconds");
        return {
          ...state,
          mode: "END_CONVERSATION",
          isRecording: false,
          isProcessingBackend: false,
          shouldShowRecordingIndicator: false,
          displayText: "Sepertinya sudah selesai, Jika ada perlu lagi panggil aku yaa!",
        };
      }

      // No valid speech detected
      if (event.type === "NO_VALID_SPEECH") {
        console.warn("⚠️ [Listen] No valid speech detected");
        return {
          ...state,
          mode: "END_CONVERSATION",
          isRecording: false,
          shouldShowRecordingIndicator: false,
          displayText: "Sepertinya sudah selesai, Jika ada perlu lagi panggil aku yaa!",
        };
      }

      return state;
    }

    // ========================================
    // MODE: RESPONSE
    // ========================================
    case "RESPONSE": {
      // Response playback started
      if (event.type === "RESPONSE_PLAYBACK_STARTED") {
        return {
          ...state,
          isPlayingResponse: true,
        };
      }

      // Response playback complete
      if (event.type === "RESPONSE_PLAYBACK_COMPLETE") {
        return {
          ...state,
          isPlayingResponse: false,
        };
      }

      // Response display complete (text shown + audio played + 2 sec delay)
      if (event.type === "RESPONSE_DISPLAY_COMPLETE") {
        console.log("✅ [Response] Display complete, returning to LISTEN");
        return {
          ...state,
          mode: "LISTEN",
          currentResponse: null,
          displayText: "Silakan bicara dengan jelas...",
        };
      }

      return state;
    }

    // ========================================
    // MODE: END_CONVERSATION
    // ========================================
    case "END_CONVERSATION": {
      // End message complete
      if (event.type === "END_MESSAGE_COMPLETE") {
        console.log("👋 [End] Conversation ended, returning to STANDBY");
        return {
          ...initialVoiceState,
        };
      }

      return state;
    }

    default:
      return state;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function shouldStartRecording(state: VoiceState): boolean {
  return (
    state.mode === "LISTEN" &&
    !state.isRecording &&
    !state.isProcessingBackend
  );
}

export function shouldStopRecording(state: VoiceState): boolean {
  return state.isRecording && state.mode !== "LISTEN";
}

export function canAcceptWakeWord(state: VoiceState): boolean {
  return state.mode === "STANDBY" && !state.conversationActive;
}
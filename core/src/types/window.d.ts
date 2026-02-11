/* eslint-disable @typescript-eslint/no-explicit-any */
// src/types/window.d.ts
export interface WakeWordData {
    keywordIndex: number;
    keyword: string;
    timestamp: number;
  }
  
  export interface PorcupineStatus {
    isListening: boolean;
    version?: string;
  }
  
  export interface PorcupineAPI {
    start: () => Promise<{ success: boolean }>;
    restart: () => Promise<{ success: boolean }>;
    getStatus: () => Promise<PorcupineStatus>;
  
    onWakeWordDetected: (
      callback: (event: any, data: WakeWordData) => void
    ) => void;
    offWakeWordDetected: (
      callback: (event: any, data: WakeWordData) => void
    ) => void;
  
    onStatusChanged: (
      callback: (event: any, data: PorcupineStatus) => void
    ) => void;
    offStatusChanged: (
      callback: (event: any, data: PorcupineStatus) => void
    ) => void;
  }
  
  declare global {
    interface Window {
      porcupine?: PorcupineAPI;
    }
  }
  
  export {};
  
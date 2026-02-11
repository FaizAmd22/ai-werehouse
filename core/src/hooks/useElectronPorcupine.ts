/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";

interface WakeWordData {
  keywordIndex: number;
  keyword: string;
  timestamp: number;
}

interface PorcupineAPI {
  start: () => Promise<{
    isListening: undefined; success: boolean 
}>;
  restart: () => Promise<{ success: boolean }>;
  getStatus: () => Promise<{ isListening: boolean }>;

  onWakeWordDetected: (
    callback: (event: any, data: WakeWordData) => void
  ) => void;
  offWakeWordDetected: (
    callback: (event: any, data: WakeWordData) => void
  ) => void;

  onStatusChanged: (callback: (event: any, data: any) => void) => void;
  offStatusChanged: (callback: (event: any, data: any) => void) => void;
}

interface UseElectronPorcupineProps {
  onWakeWordDetected: () => void;
  enabled?: boolean;
}

// useElectronPorcupine.ts
export const useElectronPorcupine = ({
  onWakeWordDetected,
  enabled = true,
}: UseElectronPorcupineProps) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wakeHandlerRef = useRef<any>(null);
  const statusHandlerRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;

    const porcupine = (window as any).porcupine as PorcupineAPI | undefined;
    if (!porcupine) {
      setError("Porcupine API not found");
      return;
    }

    const wakeHandler = (_: any, data: WakeWordData) => {
      console.log("🎉 Wake word detected (renderer):", data);
      onWakeWordDetected();
    };

    const statusHandler = (_: any, data: any) => {
      console.log("📡 Porcupine status changed:", data);
      setIsListening(data.isListening);
    };

    wakeHandlerRef.current = wakeHandler;
    statusHandlerRef.current = statusHandler;

    // ✅ Register listeners SEBELUM start
    porcupine.onWakeWordDetected(wakeHandler);
    porcupine.onStatusChanged(statusHandler);

    const start = async () => {
      try {
        console.log("🚀 Forcing Porcupine start...");
        const res = await porcupine.start();
        console.log("🎧 Porcupine start response:", res);
    
        // ✅ Gunakan hasil dari start() jika ada
        if (res.isListening !== undefined) {
          setIsListening(res.isListening);
        }

        // ✅ Double-check dengan getStatus setelah delay
        await new Promise(r => setTimeout(r, 500));
        const status = await porcupine.getStatus();
        console.log("📡 Porcupine status after start:", status);
        setIsListening(status.isListening);
      } catch (err) {
        console.error("❌ Porcupine start failed:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };    

    start();

    return () => {
      console.log("🧹 Cleaning Porcupine listeners");
      if (wakeHandlerRef.current) {
        porcupine.offWakeWordDetected(wakeHandlerRef.current);
      }
      if (statusHandlerRef.current) {
        porcupine.offStatusChanged(statusHandlerRef.current);
      }
    };
  }, [enabled, onWakeWordDetected]);

  const restart = async () => {
    const porcupine = (window as any).porcupine as PorcupineAPI | undefined;
    if (!porcupine) {
      setError("Not running in Electron");
      return;
    }

    try {
      console.log("🔄 Restarting Porcupine...");
      await porcupine.restart();
      
      await new Promise(r => setTimeout(r, 500));
      const status = await porcupine.getStatus();
      setIsListening(status.isListening);
      setError(null);
      console.log("✅ Porcupine restarted");
    } catch (err) {
      console.error("❌ Failed to restart:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsListening(false);
    }
  };

  return {
    isListening,
    error,
    restart,
  };
};

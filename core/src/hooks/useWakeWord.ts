import { usePorcupine } from "@picovoice/porcupine-react";
import { useEffect, useRef } from "react";

type UseWakeWordProps = {
  accessKey: string;
  keywordPath: string;
  modelPath: string;
  keywordLabel: string;
  onDetected?: () => void;
};

export const useWakeWord = ({
  accessKey,
  keywordPath,
  modelPath,
  keywordLabel,
  onDetected,
}: UseWakeWordProps) => {
  const accessKeyRef = useRef(accessKey);
  const lastKeywordLabelRef = useRef<string | null>(null);

  const {
    keywordDetection,
    isLoaded,
    isListening,
    error,
    init,
    start,
    release,
  } = usePorcupine();

  useEffect(() => {
    const initEngine = async () => {
      if (accessKeyRef.current.length === 0) {
        return;
      }

      try {
        await init(
          accessKeyRef.current,
          {
            publicPath: keywordPath,
            label: keywordLabel,
          },
          {
            publicPath: modelPath,
          }
        );
      } catch (error) {
        console.error("Porcupine init error:", error);
      }
    };

    initEngine();

    return () => {
      release();
    };
  }, [init, keywordLabel, keywordPath, modelPath, release]);

  useEffect(() => {
    if (isLoaded && !isListening) {
      const ts = setTimeout(() => {
        start();
      }, 1000);
      return () => clearTimeout(ts);
    }
  }, [isLoaded, isListening, start, error]);

  useEffect(() => {
    if (keywordDetection && onDetected) {
      lastKeywordLabelRef.current = keywordLabel;
      onDetected();
    }
  }, [keywordDetection, onDetected, keywordLabel]);

  return { keywordDetection, isLoaded, isListening, error };
};
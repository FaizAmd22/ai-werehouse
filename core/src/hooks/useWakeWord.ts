/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';

type UseWakeWordProps = {
    onDetected?: () => void;
    accessKey?: string;
    keywordPath?: string;
    modelPath?: string;
    keywordLabel?: string;
};

export const useWakeWord = ({ onDetected }: UseWakeWordProps) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const onDetectedRef = useRef(onDetected);

    useEffect(() => {
        onDetectedRef.current = onDetected;
    }, [onDetected]);

    useEffect(() => {
        const win = window as any;
        if (!win.electron) {
            console.warn('Not in Electron, wake word disabled');
            return;
        }

        console.log('Listening via IPC...');

        const removeDetected = win.electron.onWakeWordDetected(() => {
            console.log('Detected!');
            onDetectedRef.current?.();
        });

        const removeStatus = win.electron.onWakeWordStatus((data: any) => {
            console.log('Status:', data);
            setIsLoaded(data.isLoaded);
            setIsListening(data.isListening);
            if (data.error) setError(data.error);
        });

        return () => {
            removeDetected?.();
            removeStatus?.();
        };
    }, []);

    return { isLoaded, isListening, error, initStatus: isLoaded ? 'success' : 'pending' };
};
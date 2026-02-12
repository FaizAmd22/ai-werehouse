/* eslint-disable react-hooks/immutability */
import { useCallback, useEffect, useRef, useState } from "react";

type WSMessage =
  | string
  | Blob
  | ArrayBuffer
  | ArrayBufferView<ArrayBuffer>;

export const useWebSocket = (url: string) => {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState<unknown | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(true);

  const openConnection = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connection established");
      setIsConnected(true);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      socket.close();
    };

    socket.onmessage = (event) => {
      setMessage(event.data);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
      setIsConnected(false);

      if (shouldReconnectRef.current) {
        console.log("Scheduling reconnection in 5 seconds...");
        reconnectTimeoutRef.current = window.setTimeout(() => {
          openConnection();
        }, 5000);
      }
    };
  }, [url]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    openConnection();

    return () => {
      shouldReconnectRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [openConnection]);

  const sendMessage = (message: WSMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
    }
  };  
  
  const sendBytes = (data: Uint8Array) => {
    const safeBuffer =
      data.buffer instanceof ArrayBuffer
        ? data.buffer
        : new Uint8Array(data).buffer;
  
    sendMessage(safeBuffer);
  };  

  const sendJson = (data: unknown) => {
    sendMessage(JSON.stringify(data));
  };

  const sendEvent = (event: string, data: unknown = {}) => {
    sendJson({ event, data });
  };

  return { message, sendMessage, sendBytes, sendJson, sendEvent, isConnected };
};
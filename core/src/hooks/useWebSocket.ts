/* eslint-disable react-hooks/immutability */
import { useCallback, useEffect, useRef, useState } from "react";

export const useWebSocket = (url: string) => {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState<unknown | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(true);

  const openConnection = useCallback(() => {
    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Don't open a new connection if one is already open or connecting
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

      // Schedule reconnection if we should reconnect
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
      // Prevent reconnection on cleanup
      shouldReconnectRef.current = false;

      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close the socket
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [openConnection]);

  const sendMessage = (
    message: string | Blob | ArrayBufferLike | ArrayBufferView
  ) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
    } else {
      console.error("WebSocket is not open. Unable to send message.");
    }
  };

  const sendBytes = (data: Uint8Array) => {
    sendMessage(data.buffer);
  };

  const sendJson = (data: unknown) => {
    sendMessage(JSON.stringify(data));
  };

  const sendEvent = (event: string, data: unknown = {}) => {
    sendJson({ event, data });
  };

  return { message, sendMessage, sendBytes, sendJson, sendEvent, isConnected };
};
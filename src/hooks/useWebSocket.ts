'use client';

import { useEffect, useRef } from 'react';
import { WSClient } from '@/lib/ws/client';
import { setActiveClient } from '@/lib/ws/sender';
import { useTelemetryStore } from '@/lib/store/telemetryStore';

export function useWebSocket(url: string) {
  const clientRef = useRef<WSClient | null>(null);
  const handleMessage = useTelemetryStore((s) => s.handleMessage);
  const setConnectionState = useTelemetryStore((s) => s.setConnectionState);

  useEffect(() => {
    const client = new WSClient(url, handleMessage, setConnectionState);
    clientRef.current = client;
    setActiveClient(client);
    client.connect();

    return () => {
      client.disconnect();
      setActiveClient(null);
      clientRef.current = null;
    };
  }, [url, handleMessage, setConnectionState]);

  return {
    disconnect: () => clientRef.current?.disconnect(),
    retry: () => clientRef.current?.retry(),
  };
}

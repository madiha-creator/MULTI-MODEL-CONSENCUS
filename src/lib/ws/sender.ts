'use client';

import type { ControlAction } from '@/types/telemetry';
import type { WSClient } from './client';
import { validateControl } from './validate';

/**
 * Module-level handle to the live WSClient so components can send control
 * frames without prop-drilling the connection (the client lives in a ref
 * inside useWebSocket). useWebSocket registers/unregisters around mount.
 */
let activeClient: WSClient | null = null;

export function setActiveClient(client: WSClient | null): void {
  activeClient = client;
}

/**
 * Validate-then-send an operator control action. Returns false (nothing sent)
 * when the frame is invalid, no client is mounted, or the socket is not open —
 * callers surface that as "not connected", never a silent no-op.
 */
export function sendControl(action: ControlAction): boolean {
  const frame = validateControl({ type: 'control', payload: action });
  if (!frame) return false;
  if (!activeClient || activeClient.connectionState !== 'connected') return false;
  activeClient.send(frame);
  return true;
}

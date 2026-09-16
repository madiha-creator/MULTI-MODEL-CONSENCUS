'use client';

import { useShallow } from 'zustand/react/shallow';
import { deriveConsensusVerdict, type Verdict } from '@/lib/consensus/status';
import { useTelemetryStore } from '@/lib/store/telemetryStore';

export function useSensors() {
  return useTelemetryStore((s) => s.sensors);
}

export function useConsensus() {
  return useTelemetryStore((s) => s.consensus);
}

export function useRisk() {
  return useTelemetryStore((s) => s.risk);
}

export function useActionGate() {
  return useTelemetryStore((s) => s.actionGate);
}

export function useOutliers() {
  return useTelemetryStore((s) => s.outliers);
}

export function useEvents() {
  return useTelemetryStore((s) => s.events);
}

export function useDisagreements() {
  return useTelemetryStore((s) => s.disagreements);
}

export function useAgents() {
  return useTelemetryStore((s) => s.agents);
}

/** Latest LLM reasoning round from /api/agents/decide (REST, not WS). */
export function useAgentRound() {
  return useTelemetryStore((s) => s.agentRound);
}

/**
 * Derived safety-state verdict (AGREEMENT / DEGRADED / FAILED) shared by the
 * status strip, consensus panels and state mesh. The Verdict object holds
 * primitives only, so useShallow re-renders subscribers only on real change.
 */
export function useConsensusVerdict(): Verdict {
  return useTelemetryStore(
    useShallow((s) =>
      deriveConsensusVerdict({
        consensus: s.consensus,
        risk: s.risk,
        outliers: s.outliers,
        actionGate: s.actionGate,
      })
    )
  );
}

export function useConnectionStatus() {
  return useTelemetryStore(
    useShallow((s) => ({
      connectionState: s.connectionState,
      connected: s.connectionState === 'connected',
      lastHeartbeat: s.lastHeartbeat,
    }))
  );
}

export function useConnectionState() {
  return useTelemetryStore((s) => s.connectionState);
}

export function useActiveAlertCount() {
  return useTelemetryStore((s) => {
    const activeDisagreements = s.disagreements.filter((d) => d.isDisagreeing).length;
    const criticalSensors = s.sensors.filter((s) => s.status === 'critical').length;
    const blocked = s.actionGate?.state === 'BLOCK' ? 1 : 0;
    return activeDisagreements + criticalSensors + blocked;
  });
}

export function useDriftState() {
  return useTelemetryStore((s) => s.driftState);
}

/** Server-authoritative operator overlay (set via control frames, echoed on the wire). */
export function useOverlayState() {
  return useTelemetryStore((s) => s.overlayState);
}

export function useActuatorState() {
  return useTelemetryStore((s) => s.actuatorState);
}

export function useConnectionMetrics() {
  return useTelemetryStore((s) => s.connectionMetrics);
}

/** Inbound frames dropped by validation (schema or JSON parse). */
export function useInvalidFrameCount() {
  return useTelemetryStore((s) => s.invalidFrameCount);
}

/**
 * Transport display bundle — shallow-compared so per-tick wire messages don't
 * re-render consumers (connection identity churn is the old hot spot).
 */
export function useConnectionDisplay() {
  return useTelemetryStore(
    useShallow((s) => ({
      connectionState: s.connectionState,
      lastMessageTime: s.connectionMetrics.lastMessageTime,
      reconnectCount: s.reconnectCount,
    }))
  );
}

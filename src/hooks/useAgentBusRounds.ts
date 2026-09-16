'use client';

/**
 * useAgentBusRounds — the client engine of the LLM reasoning layer.
 *
 * Every ROUND_INTERVAL_MS it takes the current wire state out of the store
 * (via getState(), so this hook itself never re-renders), builds a
 * ConsensusSnapshot, POSTs it to /api/agents/decide, and writes the returned
 * AgentRound back to the store. The dashboard stays the single source of
 * live state; the API stays stateless.
 *
 * Refusals are honored client-side: when the broker verdict is FAILED the
 * trusted state is UNKNOWN, so there is nothing for agents to reason over —
 * we skip the call entirely (zero tokens spent) and leave the round for the
 * panel to present as withheld. Transport loss likewise stops the loop.
 *
 * A round whose fetch failed or is still in flight leaves the previous round
 * in place; consumers render it as STALE past ROUND_STALE_MS, so a provider
 * hiccup degrades gracefully instead of blanking the panel.
 */

import { useEffect } from 'react';
import { deriveConsensusVerdict } from '@/lib/consensus/status';
import { useTelemetryStore } from '@/lib/store/telemetryStore';
import type { ConsensusSnapshot } from '@/types/telemetry';

const ROUND_INTERVAL_MS = 12_000;
/** Older than this, a round renders STALE (plan: 30 s = 2½ missed rounds). */
export const ROUND_STALE_MS = 30_000;
/** Abort a call that outlives two full agent timeouts + slack. */
const FETCH_TIMEOUT_MS = 40_000;

/**
 * React StrictMode (dev) double-mounts effects, which would fire two
 * immediate rounds back-to-back and double the provider spend at boot.
 * The inFlight guard is per-effect-closure so it can't catch this; a
 * module-level stamp dedupes the FIRST round across remounts within a
 * short window. Interval rounds are unaffected.
 */
let lastImmediateKickAt = 0;
const IMMEDIATE_KICK_DEDUPE_MS = 5_000;

function buildSnapshot(): ConsensusSnapshot | null {
  const s = useTelemetryStore.getState();
  const v = s.consensus;
  if (!v) return null;
  return {
    trustedValue: v.trustedValue,
    verdict: deriveVerdictLite(s),
    agreementPct: Math.round(v.agreementRatio * 100),
    contributingCount: v.contributingSensors.length,
    excludedCount: v.excludedSensors.length,
    sensors: s.sensors.map((sensor) => ({
      id: sensor.sensorId,
      name: sensor.sensorName,
      status: sensor.status,
    })),
    gateState: s.actionGate?.state ?? null,
    agents: s.agents.map((a) => ({
      agentId: a.agentId,
      status: a.status,
      consumedValue: a.consumedValue,
    })),
  };
}

/**
 * Same verdict the panels show — imported derivation rather than a guess,
 * built from the live store slices.
 */
function deriveVerdictLite(s: ReturnType<typeof useTelemetryStore.getState>) {
  return deriveConsensusVerdict({
    consensus: s.consensus,
    risk: s.risk,
    outliers: s.outliers,
    actionGate: s.actionGate,
  }).verdict;
}

export function useAgentBusRounds(): void {
  useEffect(() => {
    let inFlight = false;
    let cancelled = false;
    const runRound = async () => {
      if (inFlight) return; // a slow provider skips ticks, never queues up
      const s = useTelemetryStore.getState();
      if (s.connectionState !== 'connected') return;
      const snapshot = buildSnapshot();
      if (!snapshot || snapshot.verdict === 'NO_DATA') return;
      if (snapshot.verdict === 'FAILED') return; // refusal ⇒ nothing to reason over

      inFlight = true;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch('/api/agents/decide', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(snapshot),
          signal: controller.signal,
        });
        if (!res.ok) return; // previous round stays visible, ages to STALE
        const round = await res.json();
        // A round that resolved while the transport dropped is a verdict on
        // PRE-drop data — committing it would paint post-outage panels with
        // reasoning nobody can re-verify. Drop it; the age clock shows STALE.
        if (
          !cancelled &&
          round &&
          Array.isArray(round.decisions) &&
          useTelemetryStore.getState().connectionState === 'connected'
        ) {
          useTelemetryStore.getState().setAgentRound(round);
        }
      } catch {
        // network abort — same graceful no-op; staleness renders it
      } finally {
        clearTimeout(timer);
        inFlight = false;
      }
    };

    // immediate first round once data arrives — deduped across StrictMode
    // double-mounts so dev boot doesn't pay for two identical provider rounds
    const now = Date.now();
    if (now - lastImmediateKickAt > IMMEDIATE_KICK_DEDUPE_MS) {
      lastImmediateKickAt = now;
      runRound();
    }
    const interval = setInterval(runRound, ROUND_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
}

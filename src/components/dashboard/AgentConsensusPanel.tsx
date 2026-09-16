'use client';

/**
 * AgentConsensusPanel — the judges' view into the LLM reasoning layer:
 * three Groq-hosted agents (openai/gpt-oss-20b) deciding, live, whether to
 * act on the broker's trusted state, plus the arbiter's meta-consensus over
 * their decisions.
 *
 * Honesty rules inherited from the dashboard's safety language:
 *  - Broker FAILED ⇒ show WITHHELD and zero decisions — the agents are not
 *    consulted when there is no trusted state (no API call was made; the
 *    client engine in useAgentBusRounds refuses the round).
 *  - A round older than ROUND_STALE_MS (or one that died mid-flight) ages
 *    to STALE rather than being silently dropped.
 *  - An agent whose call FAILED (error non-null) renders its ABSTAIN in a
 *    distinct "no-decision" style — provider trouble never counts as
 *    agreement, matching how the arbiter is instructed to treat it.
 */

import { useEffect, useState } from 'react';
import { useAgentRound, useConsensusVerdict } from '@/hooks/useTelemetry';
import { ROUND_STALE_MS } from '@/hooks/useAgentBusRounds';
import type { AgentDecision, DecisionWord } from '@/types/telemetry';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const DECISION_HEX: Record<DecisionWord, string> = {
  PROCEED: '#22c55e',
  CAUTION: '#f59e0b',
  ABSTAIN: '#64748b',
};

const DECISION_BADGE: Record<DecisionWord, 'success' | 'warning' | 'default'> = {
  PROCEED: 'success',
  CAUTION: 'warning',
  ABSTAIN: 'default',
};

/** Shared by StateMesh's node badges — one source for the join. */
export function decisionHex(word: DecisionWord): string {
  return DECISION_HEX[word];
}

function ageSeconds(finishedAt: number, now: number): number {
  return Math.max(0, Math.round((now - finishedAt) / 1000));
}

function DecisionRow({ d }: { d: AgentDecision }) {
  const failed = d.error !== null;
  return (
    <div className="flex flex-col gap-0.5 border-t border-[var(--color-border)] pt-1.5 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-[var(--color-text-secondary)]">
          {d.roleName}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="font-mono text-[9px] tabular-nums text-[var(--color-text-muted)]">
            {failed ? `${(d.latencyMs / 1000).toFixed(1)}s` : `${(d.confidence * 100).toFixed(0)}%`}
          </span>
          <Badge variant={failed ? 'error' : DECISION_BADGE[d.decision]}>
            {failed ? 'FAILED' : d.decision}
          </Badge>
        </span>
      </div>
      <p className="line-clamp-2 text-[10px] leading-snug text-[var(--color-text-muted)]">
        {d.rationale}
      </p>
    </div>
  );
}

/** 1 Hz clock so a round abandoned by a provider outage still ages to STALE. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function AgentConsensusPanel() {
  const round = useAgentRound();
  const v = useConsensusVerdict();
  const now = useNow();

  // Broker refused ⇒ the client engine skipped the round; present honestly.
  const withheld = v.verdict === 'FAILED';
  const stale = !!round && now - round.finishedAt > ROUND_STALE_MS;
  const unavailable = round !== null && !round.configured;

  const badge = withheld ? (
    <Badge variant="error">WITHHELD</Badge>
  ) : !round ? (
    <Badge variant="default">AWAITING ROUND</Badge>
  ) : stale ? (
    <Badge variant="warning">STALE</Badge>
  ) : unavailable ? (
    <Badge variant="default">NOT CONFIGURED</Badge>
  ) : (
    <Badge variant={round.meta?.arbitrated ? 'info' : 'default'}>
      ROUND #{round.roundId} · {ageSeconds(round.finishedAt, now)}s
    </Badge>
  );

  return (
    <Card title="Agent Consensus — LLM reasoning over trusted state" badge={badge}>
      {withheld || !round ? (
        <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">
          {withheld
            ? 'Consensus FAILED — no trusted state to reason over. Agents holding, API untouched.'
            : 'Awaiting first agent round…'}
        </p>
      ) : unavailable ? (
        <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">
          Reasoning layer not configured — set GROQ_API_KEY in .env.local to activate agents.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Meta-consensus headline */}
          {round.meta && (
            <div className="flex items-center justify-between gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1.5">
              <span
                className="text-[11px] font-bold tracking-wide"
                style={{ color: DECISION_HEX[round.meta.recommendation] }}
              >
                {round.meta.recommendation}
              </span>
              <span className="font-mono text-[9px] tabular-nums text-[var(--color-text-muted)]">
                {round.meta.concurrence} agree · {round.meta.dissent} dissent
                {round.meta.latencyMs !== null && ` · ${(round.meta.latencyMs / 1000).toFixed(1)}s`}
              </span>
            </div>
          )}
          <p className="text-[10px] leading-snug text-[var(--color-text-secondary)]">
            {round.meta?.summary}
            {round.meta && !round.meta.arbitrated && (
              <span className="text-[var(--color-text-muted)]"> (rule-based tally)</span>
            )}
          </p>
          {round.decisions.map((d) => (
            <DecisionRow key={`${d.agentId}-${round.roundId}`} d={d} />
          ))}
        </div>
      )}
    </Card>
  );
}

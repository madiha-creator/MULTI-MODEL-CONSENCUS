'use client';

import { useConsensus, useConsensusVerdict } from '@/hooks/useTelemetry';
import { verdictStyles } from '@/lib/consensus/status';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle2, XCircle } from 'lucide-react';
import clsx from 'clsx';

export function ConsensusPanel() {
  const consensus = useConsensus();
  const v = useConsensusVerdict();

  if (!consensus) {
    return (
      <Card
        title="Consensus"
        badge={<Badge variant={verdictStyles.NO_DATA.badgeVariant}>AWAITING DATA</Badge>}
      >
        <div className="flex items-center justify-center py-6">
          <p className="text-xs text-[var(--color-text-muted)]">
            Awaiting consensus calculation...
          </p>
        </div>
      </Card>
    );
  }

  const styles = verdictStyles[v.verdict];

  return (
    <Card
      title="Consensus"
      badge={<Badge variant={styles.badgeVariant}>{v.label}</Badge>}
    >
      <div className="flex flex-col items-center gap-3">
        {/* Trusted State — dominant number; UNKNOWN on refusal to decide */}
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Trusted State
          </p>
          {v.trustedValue === null ? (
            <p className="animate-pulse font-mono text-5xl font-black text-[var(--color-risk-critical)]">
              UNKNOWN
            </p>
          ) : (
            <p className="font-mono text-5xl font-bold tabular-nums text-[var(--color-accent)]">
              {v.trustedValue.toFixed(2)}
            </p>
          )}
          <p className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">
            {v.trustedValue === null ? 'Consensus refused — no value' : 'Consensus value (unitless demo)'}
          </p>
        </div>

        {v.verdict === 'FAILED' && (
          <p className="rounded border border-[#ef4444]/40 bg-[#ef4444]/10 px-2 py-1.5 text-center text-[11px] text-[var(--color-risk-critical)]">
            System refused to make a trusted decision — physical action blocked.
          </p>
        )}

        {/* Confidence bar */}
        <div className="w-full">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-[var(--color-text-muted)]">Confidence</span>
            <span className="font-mono font-medium text-[var(--color-text-secondary)]">
              {Math.round(consensus.confidence * 100)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${consensus.confidence * 100}%`,
                backgroundColor: styles.cssVar,
              }}
            />
          </div>
        </div>

        {/* Agreement + Contributing / Excluded */}
        <div className="w-full text-[11px]">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[var(--color-text-muted)]">Agreement</span>
            <span className={clsx('font-mono font-medium tabular-nums', styles.textClass)}>
              {v.agreementPct}%
            </span>
          </div>
          <div className="flex w-full gap-2 text-[11px]">
            <div
              className={clsx(
                'flex flex-1 items-center gap-1.5 rounded bg-green-500/10 px-2 py-1.5',
                v.contributingCount === 0 && 'opacity-40'
              )}
            >
              <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-400" />
              <span className="text-green-400">{v.contributingCount} contributing</span>
            </div>
            <div
              className={clsx(
                'flex flex-1 items-center gap-1.5 rounded bg-red-500/10 px-2 py-1.5',
                v.excludedCount === 0 && 'opacity-40'
              )}
            >
              <XCircle className="h-3 w-3 flex-shrink-0 text-red-400" />
              <span className="text-red-400">{v.excludedCount} excluded</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useConsensus, useConsensusVerdict } from '@/hooks/useTelemetry';
import { verdictStyles } from '@/lib/consensus/status';
import clsx from 'clsx';

/**
 * The trusted-state view — the broker's decision, deliberately distinct from
 * the raw sensor readings in the SensorGrid above. On consensus FAILURE the
 * trusted value is not shown at all: a bold red UNKNOWN replaces it, and the
 * contributing sensor set is listed so the refusal is legible, not mysterious.
 */
export function TrustedStatePanel() {
  const consensus = useConsensus();
  const v = useConsensusVerdict();
  const styles = verdictStyles[v.verdict];

  if (!consensus) {
    return (
      <Card
        title="Trusted State"
        badge={<Badge variant={styles.badgeVariant}>{v.label}</Badge>}
      >
        <div className="flex h-16 items-center justify-center text-xs text-[var(--color-text-muted)]">
          Awaiting consensus data
        </div>
      </Card>
    );
  }

  const confidencePct = Math.round(consensus.confidence * 100);

  return (
    <Card title="Trusted State" badge={<Badge variant={styles.badgeVariant}>{v.label}</Badge>}>
      <div className="space-y-3">
        <div className="text-center">
          {v.trustedValue === null ? (
            <span className="animate-pulse font-mono text-4xl font-black text-[var(--color-risk-critical)]">
              UNKNOWN
            </span>
          ) : (
            <span className="font-mono text-4xl font-bold tabular-nums text-[var(--color-text)]">
              {v.trustedValue.toFixed(2)}
            </span>
          )}
          <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
            {v.trustedValue === null ? 'No trusted value' : 'Trusted value (unitless demo)'}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Confidence
            </span>
            <span className="font-mono text-xs tabular-nums text-[var(--color-text)]">
              {confidencePct}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${confidencePct}%`,
                backgroundColor:
                  confidencePct >= 80
                    ? 'var(--color-risk-low)'
                    : confidencePct >= 50
                      ? 'var(--color-risk-medium)'
                      : 'var(--color-risk-high)',
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-2 text-center">
          <div>
            <span className="font-mono text-sm tabular-nums text-[var(--color-risk-low)]">
              {v.contributingCount}
            </span>
            <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Contributing
            </div>
          </div>
          <div>
            <span className="font-mono text-sm tabular-nums text-[var(--color-risk-high)]">
              {v.excludedCount}
            </span>
            <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Excluded
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px]">
          <span className="uppercase tracking-wider text-[var(--color-text-muted)]">Agreement</span>
          <span className={clsx('font-mono tabular-nums', styles.textClass)}>
            {v.agreementPct}%
          </span>
        </div>

        {v.verdict !== 'AGREEMENT' && consensus.contributingSensors.length > 0 && (
          <div className="border-t border-[var(--color-border)] pt-2">
            <div className="mb-1 text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Trusted from
            </div>
            <div className="flex flex-wrap gap-1">
              {consensus.contributingSensors.map((id) => (
                <span
                  key={id}
                  className="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-secondary)]"
                >
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}

        {v.verdict === 'FAILED' && (
          <p className="text-[10px] leading-snug text-[var(--color-risk-critical)]">
            Sensors disagree beyond tolerance — the system refuses to produce a trusted state.
          </p>
        )}
      </div>
    </Card>
  );
}

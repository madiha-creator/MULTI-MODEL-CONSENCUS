'use client';

import { useConsensusVerdict, useRisk, useActionGate, useOutliers } from '@/hooks/useTelemetry';
import { verdictStyles } from '@/lib/consensus/status';
import { Badge } from '@/components/ui/Badge';
import clsx from 'clsx';

/**
 * Full-width safety verdict strip — the one glance a judge needs:
 * verdict word, why, risk, action, and the trusted value (or UNKNOWN).
 * Re-mounts (key = verdict) so the flash-in animation plays once per
 * transition. All content derives from live state; nothing is hardcoded.
 */
export function ConsensusStatusBar() {
  const v = useConsensusVerdict();
  const risk = useRisk();
  const gate = useActionGate();
  const outliers = useOutliers();
  const styles = verdictStyles[v.verdict];

  return (
    <div
      key={v.verdict}
      className={clsx(
        'animate-flash flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border px-4 py-2.5',
        styles.bgClass,
        styles.borderClass
      )}
    >
      <div className="flex items-baseline gap-3">
        <span className={clsx('text-lg font-bold uppercase tracking-wide', styles.textClass)}>
          {v.label}
        </span>
        <span className="text-[11px] text-[var(--color-text-secondary)]">{v.headline}</span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <span className="text-[var(--color-text-muted)]">
          Risk:{' '}
          <span
            className={clsx(
              'font-semibold uppercase',
              risk
                ? { low: 'text-[var(--color-risk-low)]', medium: 'text-[var(--color-risk-medium)]', high: 'text-[var(--color-risk-high)]', critical: 'text-[var(--color-risk-critical)]' }[risk.level]
                : 'text-[var(--color-text-muted)]'
            )}
          >
            {risk ? risk.level : '—'}
          </span>
        </span>
        <span className="text-[var(--color-text-muted)]">
          Action:{' '}
          <span className={clsx('font-semibold', v.verdict === 'FAILED' ? 'text-[var(--color-risk-critical)]' : 'text-[var(--color-text-secondary)]')}>
            {gate ? gate.state : '—'}
          </span>
        </span>
        <span className="text-[var(--color-text-muted)]">
          Trusted value:{' '}
          {v.trustedValue === null ? (
            <span className="font-mono font-black text-[var(--color-risk-critical)]">UNKNOWN</span>
          ) : (
            <span className="font-mono font-semibold tabular-nums text-[var(--color-text-primary)]">
              {v.trustedValue.toFixed(2)}
            </span>
          )}
        </span>
        <span className="text-[var(--color-text-muted)]">
          {v.contributingCount} contributing / {v.excludedCount} excluded
        </span>
        {outliers.length > 0 && (
          <Badge variant="error">{outliers.map((o) => o.sensorName).join(', ')}</Badge>
        )}
      </div>
    </div>
  );
}

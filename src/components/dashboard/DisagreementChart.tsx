'use client';

import { useDisagreements } from '@/hooks/useTelemetry';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { clsx } from 'clsx';

export function DisagreementChart() {
  const disagreements = useDisagreements();
  const activeCount = disagreements.filter((d) => d.isDisagreeing).length;

  return (
    <Card
      title="Disagreements"
      badge={
        <Badge variant={activeCount > 0 ? 'error' : 'success'}>
          {activeCount} active
        </Badge>
      }
    >
      {disagreements.length === 0 ? (
        <div className="flex items-center justify-center py-6">
          <p className="text-xs text-[var(--color-text-muted)]">
            No disagreement data...
          </p>
        </div>
      ) : (
        <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
          {disagreements.map((d, i) => (
            <div
              key={`${d.sensorPair[0]}-${d.sensorPair[1]}-${i}`}
              className="flex items-center justify-between rounded px-2 py-1 text-[11px]"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={clsx(
                    'h-1.5 w-1.5 rounded-full',
                    d.isDisagreeing ? 'bg-red-400' : 'bg-green-400'
                  )}
                />
                <span className="text-[var(--color-text-secondary)]">
                  {d.sensorPair[0]} vs {d.sensorPair[1]}
                </span>
              </div>
              <span
                className={clsx(
                  'font-mono font-medium tabular-nums',
                  d.isDisagreeing ? 'text-red-400' : 'text-green-400'
                )}
              >
                {d.variance.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

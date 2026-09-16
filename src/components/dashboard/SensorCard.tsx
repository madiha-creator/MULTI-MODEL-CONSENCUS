'use client';

import { clsx } from 'clsx';
import type { SensorReading } from '@/types/telemetry';
import { Badge } from '@/components/ui/Badge';

interface SensorCardProps {
  sensor: SensorReading;
  /** Reading was rejected by the consensus engine (in excludedSensors). */
  isExcluded?: boolean;
  /** Sensor was flagged as an outlier but may still be contributing. */
  isOutlier?: boolean;
}

const statusColors: Record<string, string> = {
  normal: 'border-l-green-500',
  warning: 'border-l-yellow-500',
  critical: 'border-l-red-500',
  offline: 'border-l-gray-600',
};

const statusBadge: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  normal: 'success',
  warning: 'warning',
  critical: 'error',
  offline: 'default',
};

const confidenceColor = (c: number) => {
  if (c >= 0.8) return 'bg-green-500';
  if (c >= 0.6) return 'bg-yellow-500';
  return 'bg-red-500';
};

export function SensorCard({ sensor, isExcluded = false, isOutlier = false }: SensorCardProps) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-l-[3px] border-[var(--color-border)] bg-[var(--color-bg-card)] p-2.5 transition-colors',
        statusColors[sensor.status],
        // Consensus-engine verdict overlays the raw-status styling:
        isExcluded
          ? 'ring-1 ring-[var(--color-risk-critical)]'
          : isOutlier && 'ring-1 ring-[var(--color-risk-medium)]'
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-semibold text-[var(--color-text-primary)]">
          {sensor.sensorName}
        </span>
        <div className="flex flex-shrink-0 items-center gap-1">
          {isExcluded && <Badge variant="error">EXCLUDED</Badge>}
          <Badge variant={statusBadge[sensor.status]}>
            {sensor.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Raw reading stays visible (dimmed when rejected) — this is the
          contrast against the trusted state, not a suppression of data. */}
      <div className={clsx('mb-2 flex items-baseline gap-1', isExcluded && 'opacity-50')}>
        <span className="font-mono text-2xl font-bold tabular-nums text-[var(--color-text-primary)]">
          {sensor.value}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)]">{sensor.unit}</span>
      </div>

      <div>
        <div className="mb-0.5 flex items-center justify-between text-[10px]">
          <span className="text-[var(--color-text-muted)]">Confidence</span>
          <span className="font-mono font-medium text-[var(--color-text-secondary)]">
            {Math.round(sensor.confidence * 100)}%
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500',
              confidenceColor(sensor.confidence)
            )}
            style={{ width: `${sensor.confidence * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

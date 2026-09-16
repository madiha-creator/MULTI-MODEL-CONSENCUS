'use client';

import { useMemo } from 'react';
import { useConsensus, useOutliers, useSensors } from '@/hooks/useTelemetry';
import { SensorCard } from './SensorCard';

export function SensorGrid() {
  const sensors = useSensors();
  const consensus = useConsensus();
  const outliers = useOutliers();

  // Which raw readings did the consensus engine reject? Cards mark them so
  // the contrast between raw values and the trusted state is visible.
  const { excludedSet, outlierSet } = useMemo(
    () => ({
      excludedSet: new Set(consensus?.excludedSensors ?? []),
      outlierSet: new Set(outliers.map((o) => o.sensorId)),
    }),
    [consensus, outliers]
  );

  if (sensors.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center">
        <p className="text-xs text-[var(--color-text-muted)]">
          Waiting for telemetry...
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sensors.map((sensor) => (
        <SensorCard
          key={sensor.sensorId}
          sensor={sensor}
          isExcluded={excludedSet.has(sensor.sensorId)}
          isOutlier={outlierSet.has(sensor.sensorId)}
        />
      ))}
    </div>
  );
}

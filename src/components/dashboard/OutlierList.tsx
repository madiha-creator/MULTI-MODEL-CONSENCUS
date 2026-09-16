'use client';

import { useOutliers } from '@/hooks/useTelemetry';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle } from 'lucide-react';

export function OutlierList() {
  const outliers = useOutliers();

  return (
    <Card
      title="Outliers"
      badge={
        <Badge variant={outliers.length > 0 ? 'error' : 'success'}>
          {outliers.length} flagged
        </Badge>
      }
    >
      {outliers.length === 0 ? (
        <div className="flex items-center justify-center gap-1.5 py-6">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          <p className="text-xs text-[var(--color-text-muted)]">No outliers</p>
        </div>
      ) : (
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          {outliers.map((o) => (
            <div
              key={o.sensorId}
              className="flex items-center gap-2 rounded bg-red-500/5 px-2 py-1.5"
            >
              <AlertTriangle className="h-3 w-3 flex-shrink-0 text-red-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-[var(--color-text-primary)]">
                  {o.sensorName}
                </p>
                <p className="text-[10px] text-red-400">{o.reason}</p>
              </div>
              <span className="font-mono text-[11px] tabular-nums text-red-400">
                {Math.round(o.deviation * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

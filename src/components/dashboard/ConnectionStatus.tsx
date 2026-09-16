'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { useConnectionDisplay, useConnectionMetrics, useInvalidFrameCount } from '@/hooks/useTelemetry';

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
      <span className={`font-mono text-xs tabular-nums ${color ?? 'text-[var(--color-text)]'}`}>
        {value}
      </span>
    </div>
  );
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

const STATUS_TEXT = {
  connected: 'Online',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  disconnected: 'Offline',
} as const;

const STATUS_COLORS = {
  connected: 'text-[var(--color-risk-low)]',
  connecting: 'text-[var(--color-risk-medium)]',
  reconnecting: 'text-[var(--color-risk-medium)]',
  disconnected: 'text-[var(--color-risk-high)]',
} as const;

export function ConnectionStatus() {
  // Shallow bundle → this panel re-renders on real transport changes, not on
  // every one of the ~10 wire frames/tick (the old connectionMetrics churn).
  const { connectionState, lastMessageTime, reconnectCount } = useConnectionDisplay();
  const metrics = useConnectionMetrics();
  const invalidFrames = useInvalidFrameCount();

  // When the link drops, the panels behind keep painting the last values.
  // Age that freeze explicitly so stale-but-live-looking data is honest (P8).
  const [frozenSecs, setFrozenSecs] = useState<number | null>(null);
  const down = connectionState !== 'connected';
  useEffect(() => {
    if (!down || lastMessageTime === null) {
      setFrozenSecs(null);
      return;
    }
    const tick = () => setFrozenSecs(Math.floor((Date.now() - lastMessageTime) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [down, lastMessageTime]);

  const latencyColor =
    metrics.latencyMs === null
      ? 'text-[var(--color-text-muted)]'
      : metrics.latencyMs < 100
        ? 'text-[var(--color-risk-low)]'
        : metrics.latencyMs < 500
          ? 'text-[var(--color-risk-medium)]'
          : 'text-[var(--color-risk-high)]';

  return (
    <Card
      title="Connection"
      badge={<LiveIndicator connected={connectionState === 'connected'} />}
    >
      <div className="space-y-1.5">
        <MetricRow
          label="Status"
          value={STATUS_TEXT[connectionState]}
          color={STATUS_COLORS[connectionState]}
        />
        <MetricRow
          label="Latency"
          value={metrics.latencyMs !== null ? `${metrics.latencyMs}ms` : '--'}
          color={latencyColor}
        />
        <MetricRow
          label="Uptime"
          value={formatUptime(metrics.uptimeMs)}
        />
        <MetricRow
          label="Messages"
          value={metrics.messagesReceived.toLocaleString()}
        />
        <MetricRow
          label="Reconnects"
          value={String(reconnectCount)}
          color={reconnectCount > 0 ? 'text-[var(--color-risk-medium)]' : undefined}
        />
        <MetricRow
          label="Invalid frames"
          value={String(invalidFrames)}
          color={invalidFrames > 0 ? 'text-[var(--color-risk-medium)]' : undefined}
        />
        {frozenSecs !== null && (
          <MetricRow
            label="Data frozen"
            value={`${frozenSecs}s`}
            color="text-[var(--color-risk-high)]"
          />
        )}
      </div>
    </Card>
  );
}

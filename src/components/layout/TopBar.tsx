'use client';

import { useConnectionStatus, useActiveAlertCount } from '@/hooks/useTelemetry';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { Badge } from '@/components/ui/Badge';
import { Shield, Activity } from 'lucide-react';

const STATUS_LABELS = {
  connected: 'Live',
  connecting: 'Connecting...',
  reconnecting: 'Reconnecting...',
  disconnected: 'Offline',
} as const;

export function TopBar() {
  const { connectionState } = useConnectionStatus();
  const alertCount = useActiveAlertCount();

  return (
    <header className="flex h-12 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4">
      <div className="flex items-center gap-2.5">
        <Shield className="h-4 w-4 text-[var(--color-accent)]" />
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-text-primary)]">
          Consensus Broker
        </span>
      </div>

      <div className="flex items-center gap-3">
        {alertCount > 0 && (
          <Badge variant="error">
            <Activity className="mr-1 h-3 w-3" />
            {alertCount}
          </Badge>
        )}
        <div className="flex items-center gap-1.5">
          <LiveIndicator connected={connectionState === 'connected'} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {STATUS_LABELS[connectionState]}
          </span>
        </div>
      </div>
    </header>
  );
}

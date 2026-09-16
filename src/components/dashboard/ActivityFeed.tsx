'use client';

import { useEvents } from '@/hooks/useTelemetry';
import { Card } from '@/components/ui/Card';
import { clsx } from 'clsx';
import { AlertCircle, AlertTriangle, Info, Radio } from 'lucide-react';

const severityConfig = {
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/5' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/5' },
  critical: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/5' },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function ActivityFeed() {
  const events = useEvents();

  return (
    <Card title="Activity">
      <div className="max-h-60 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-6">
            <Radio className="h-4 w-4 text-[var(--color-text-muted)]" />
            <p className="text-xs text-[var(--color-text-muted)]">
              Waiting for events...
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {events.slice(0, 50).map((event, i) => {
              const config = severityConfig[event.severity];
              const Icon = config.icon;
              return (
                <div
                  key={event.id}
                  className={clsx(
                    'flex items-start gap-2 rounded px-2 py-1 text-[11px]',
                    config.bg,
                    // Newest row flashes in (its DOM key mounts fresh per event)
                    i === 0 && 'animate-flash'
                  )}
                >
                  <Icon
                    className={clsx('mt-0.5 h-3 w-3 flex-shrink-0', config.color)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[var(--color-text-primary)]">{event.message}</p>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                      <span className="font-mono">{formatTime(event.timestamp)}</span>
                      {event.source && <span className="truncate">from {event.source}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

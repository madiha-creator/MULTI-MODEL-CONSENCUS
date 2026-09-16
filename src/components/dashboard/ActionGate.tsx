'use client';

import { useActionGate } from '@/hooks/useTelemetry';
import { Card } from '@/components/ui/Card';
import { ShieldCheck, ShieldOff, Clock } from 'lucide-react';
import { clsx } from 'clsx';

const gateConfig = {
  ALLOW: {
    icon: ShieldCheck,
    color: 'text-green-400',
    bg: 'bg-green-500/5',
    border: 'border-green-500/40',
    label: 'ACTIONS ALLOWED',
  },
  BLOCK: {
    icon: ShieldOff,
    color: 'text-red-400',
    bg: 'bg-red-500/5',
    border: 'border-red-500/40',
    label: 'ACTIONS BLOCKED',
  },
  HOLD: {
    icon: Clock,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/5',
    border: 'border-yellow-500/40',
    label: 'ACTIONS ON HOLD',
  },
};

export function ActionGate() {
  const gate = useActionGate();

  if (!gate) {
    return (
      <Card title="Action Gate">
        <div className="flex items-center justify-center py-6">
          <p className="text-xs text-[var(--color-text-muted)]">
            Awaiting gate status...
          </p>
        </div>
      </Card>
    );
  }

  const config = gateConfig[gate.state];
  const Icon = config.icon;

  return (
    <Card title="Action Gate">
      <div
        className={clsx(
          'flex flex-col items-center gap-2 rounded-lg border-2 p-4',
          config.bg,
          config.border,
          gate.state === 'BLOCK' && 'animate-pulse-border'
        )}
      >
        <Icon className={clsx('h-8 w-8', config.color)} />
        <span className={clsx('text-sm font-bold uppercase tracking-wider', config.color)}>
          {config.label}
        </span>
        <p className="text-center text-[11px] leading-tight text-[var(--color-text-secondary)]">
          {gate.reason}
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)]">
          triggered: {gate.triggeredBy}
        </p>
      </div>
    </Card>
  );
}

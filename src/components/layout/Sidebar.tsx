'use client';

import { useSensors, useRisk, useActionGate, useConnectionStatus } from '@/hooks/useTelemetry';
import {
  LayoutDashboard,
  Radio,
  ShieldCheck,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: Radio, label: 'Sensors', active: false },
  { icon: ShieldCheck, label: 'Consensus', active: false },
  { icon: AlertTriangle, label: 'Risk', active: false },
  { icon: Activity, label: 'Activity', active: false },
];

const CONNECTION_LABELS = {
  connected: 'Online',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  disconnected: 'Offline',
} as const;

const CONNECTION_COLORS = {
  connected: 'text-green-400',
  connecting: 'text-yellow-400',
  reconnecting: 'text-yellow-400',
  disconnected: 'text-red-400',
} as const;

export function Sidebar() {
  const sensors = useSensors();
  const risk = useRisk();
  const actionGate = useActionGate();
  const { connectionState } = useConnectionStatus();

  const normalCount = sensors.filter((s) => s.status === 'normal').length;
  const warningCount = sensors.filter((s) => s.status === 'warning').length;
  const criticalCount = sensors.filter((s) => s.status === 'critical').length;
  const offlineCount = sensors.filter((s) => s.status === 'offline').length;

  return (
    <aside className="hidden w-52 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2.5 md:flex">
      <nav className="mb-4 flex flex-col gap-0.5">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={clsx(
              'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
              item.active
                ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        {/* System Status */}
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] p-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            System
          </p>
          <div className="flex flex-col gap-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Connection</span>
              <span className={clsx('font-medium', CONNECTION_COLORS[connectionState])}>
                {CONNECTION_LABELS[connectionState]}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Sensors</span>
              <span className="font-mono text-[var(--color-text-secondary)]">{sensors.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Risk</span>
              <span
                className={clsx(
                  'font-medium',
                  risk?.level === 'critical'
                    ? 'text-red-400'
                    : risk?.level === 'high'
                    ? 'text-orange-400'
                    : risk?.level === 'medium'
                    ? 'text-yellow-400'
                    : 'text-green-400'
                )}
              >
                {risk?.level?.toUpperCase() || '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Gate</span>
              <span
                className={clsx(
                  'font-medium',
                  actionGate?.state === 'BLOCK'
                    ? 'text-red-400'
                    : actionGate?.state === 'HOLD'
                    ? 'text-yellow-400'
                    : 'text-green-400'
                )}
              >
                {actionGate?.state || '--'}
              </span>
            </div>
          </div>
        </div>

        {/* Sensor Health */}
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] p-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Health
          </p>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="font-mono text-green-400">{normalCount} OK</span>
            <span className="font-mono text-yellow-400">{warningCount} WARN</span>
            <span className="font-mono text-red-400">{criticalCount} CRIT</span>
            {offlineCount > 0 && <span className="font-mono text-gray-400">{offlineCount} OFFLINE</span>}
          </div>
        </div>
      </div>
    </aside>
  );
}

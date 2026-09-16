'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useActionGate, useActuatorState } from '@/hooks/useTelemetry';
import { Shield, ShieldCheck, ShieldOff, Clock, Settings, AlertTriangle } from 'lucide-react';
import type { GateState } from '@/types/telemetry';

const gateConfig: Record<GateState, { icon: typeof Shield; label: string; variant: 'success' | 'error' | 'warning'; colorClass: string }> = {
  ALLOW: { icon: ShieldCheck, label: 'ALLOW', variant: 'success', colorClass: 'border-[var(--color-risk-low)]' },
  BLOCK: { icon: ShieldOff, label: 'BLOCK', variant: 'error', colorClass: 'border-[var(--color-risk-high)] animate-pulse' },
  HOLD: { icon: Clock, label: 'HOLD', variant: 'warning', colorClass: 'border-[var(--color-risk-medium)]' },
};

function ActuatorIndicator({ label, active, value }: { label: string; active: boolean; value?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {value && (
          <span className="font-mono text-[11px] tabular-nums text-[var(--color-text)]">
            {value}
          </span>
        )}
        <div className={`h-2 w-2 rounded-full ${active ? 'bg-[var(--color-risk-low)]' : 'bg-[var(--color-text-muted)] opacity-40'}`} />
      </div>
    </div>
  );
}

export function PhysicalActionPanel() {
  const gate = useActionGate();
  const actuator = useActuatorState();

  const gateDisplay = gate ? gateConfig[gate.state] : null;

  return (
    <Card
      title="Physical Action"
      badge={
        gate ? <Badge variant={gateDisplay!.variant}>{gateDisplay!.label}</Badge> : undefined
      }
    >
      <div className="space-y-3">
        {/* Gate Section */}
        {gate && gateDisplay && (
          <div className={`rounded border-2 ${gateDisplay.colorClass} p-2.5 flex items-center gap-2.5`}>
            <gateDisplay.icon size={18} className={
              gate.state === 'ALLOW' ? 'text-[var(--color-risk-low)]' :
              gate.state === 'BLOCK' ? 'text-[var(--color-risk-high)]' :
              'text-[var(--color-risk-medium)]'
            } />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-[var(--color-text)]">
                {gateDisplay.label}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] truncate">
                {gate.reason}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">Triggered by</div>
              <div className="text-[10px] text-[var(--color-text)]">{gate.triggeredBy}</div>
            </div>
          </div>
        )}

        {!gate && (
          <div className="flex items-center justify-center h-12 text-[var(--color-text-muted)] text-xs">
            Awaiting gate data
          </div>
        )}

        {/* Actuator Section */}
        {actuator ? (
          <div className="border-t border-[var(--color-border)] pt-2 space-y-0.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Settings size={10} className="text-[var(--color-text-muted)]" />
              <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">
                Actuator Status
              </span>
            </div>
            <ActuatorIndicator
              label="Motor"
              active={actuator.motorEnabled}
              value={actuator.motorEnabled ? `${actuator.motorRpm} rpm` : 'OFF'}
            />
            <ActuatorIndicator
              label="Servo"
              active={!actuator.emergencyStop}
              value={`${actuator.servoAngle}°`}
            />
            <ActuatorIndicator
              label="E-Stop"
              active={actuator.emergencyStop}
              value={actuator.emergencyStop ? 'ACTIVE' : 'INACTIVE'}
            />
            <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
              <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">Last Cmd</span>
              <Badge variant={actuator.lastCommand === 'run' ? 'success' : actuator.lastCommand === 'estop' ? 'error' : 'warning'}>
                {actuator.lastCommand.toUpperCase()}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="border-t border-[var(--color-border)] pt-2">
            <div className="flex items-center justify-center h-10 text-[var(--color-text-muted)] text-[10px]">
              <AlertTriangle size={10} className="mr-1" />
              No actuator data
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

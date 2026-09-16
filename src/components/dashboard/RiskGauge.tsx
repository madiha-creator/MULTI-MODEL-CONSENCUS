'use client';

import { useRisk } from '@/hooks/useTelemetry';
import { Card } from '@/components/ui/Card';
import { Gauge } from '@/components/ui/Gauge';
import { Badge } from '@/components/ui/Badge';
import { RiskBar } from '@/components/ui/RiskBar';

const badgeVariant = (level: string) => {
  if (level === 'critical') return 'error' as const;
  if (level === 'high') return 'error' as const;
  if (level === 'medium') return 'warning' as const;
  return 'success' as const;
};

export function RiskGauge() {
  const risk = useRisk();

  if (!risk) {
    return (
      <Card title="Risk Level">
        <div className="flex items-center justify-center py-6">
          <p className="text-xs text-[var(--color-text-muted)]">
            Awaiting risk assessment...
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Risk Level"
      badge={<Badge variant={badgeVariant(risk.level)}>{risk.level.toUpperCase()}</Badge>}
    >
      <div className="flex flex-col items-center gap-3">
        <Gauge value={risk.score} label="Score" size={110} />
        <RiskBar score={risk.score} level={risk.level} />
        {risk.factors.length > 0 && (
          <div className="w-full">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Factors
            </p>
            <div className="flex flex-col gap-1">
              {risk.factors.map((f, i) => (
                <div
                  key={i}
                  className="rounded bg-red-500/10 px-2 py-1 text-[11px] text-red-400"
                >
                  {f}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

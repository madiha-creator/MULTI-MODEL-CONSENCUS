import { clsx } from 'clsx';
import type { RiskLevel } from '@/types/telemetry';

interface RiskBarProps {
  score: number;
  level: RiskLevel;
  className?: string;
}

const levelColors: Record<RiskLevel, string> = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

const levelTextColors: Record<RiskLevel, string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
};

export function RiskBar({ score, level, className }: RiskBarProps) {
  return (
    <div className={clsx('w-full', className)}>
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-[10px] text-[var(--color-text-muted)]">Risk Score</span>
        <span className={clsx('text-[10px] font-semibold uppercase', levelTextColors[level])}>
          {level}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', levelColors[level])}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}

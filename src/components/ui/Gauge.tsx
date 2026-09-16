'use client';

import { motion } from 'framer-motion';

interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

function getColor(value: number, max: number): string {
  const pct = value / max;
  if (pct < 0.25) return '#22c55e';
  if (pct < 0.5) return '#f59e0b';
  if (pct < 0.75) return '#f97316';
  return '#ef4444';
}

export function Gauge({
  value,
  min = 0,
  max = 100,
  size = 110,
  strokeWidth = 8,
  label,
}: GaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const dashOffset = circumference * (1 - pct * 0.75);
  const color = getColor(value, max);

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-135">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-bg-tertiary)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeLinecap="round"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono text-2xl font-bold tabular-nums"
          style={{ color }}
        >
          {Math.round(value)}
        </span>
        {label && (
          <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

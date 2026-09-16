import { type ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: ReactNode;
  title?: string;
  badge?: ReactNode;
  className?: string;
}

export function Card({ children, title, badge, className }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3',
        className
      )}
    >
      {(title || badge) && (
        <div className="mb-2.5 flex items-center justify-between">
          {title && (
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {title}
            </h3>
          )}
          {badge}
        </div>
      )}
      {children}
    </div>
  );
}

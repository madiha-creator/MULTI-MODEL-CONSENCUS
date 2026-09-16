import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]',
  success: 'bg-green-500/15 text-green-400',
  warning: 'bg-yellow-500/15 text-yellow-400',
  error: 'bg-red-500/15 text-red-400',
  info: 'bg-blue-500/15 text-blue-400',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

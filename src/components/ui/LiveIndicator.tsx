import { clsx } from 'clsx';

interface LiveIndicatorProps {
  connected: boolean;
  className?: string;
}

export function LiveIndicator({ connected, className }: LiveIndicatorProps) {
  return (
    <span className={clsx('relative flex h-2 w-2', className)}>
      <span
        className={clsx(
          'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
          connected ? 'bg-green-400' : 'bg-red-400'
        )}
      />
      <span
        className={clsx(
          'relative inline-flex h-2 w-2 rounded-full',
          connected ? 'bg-green-500' : 'bg-red-500'
        )}
      />
    </span>
  );
}

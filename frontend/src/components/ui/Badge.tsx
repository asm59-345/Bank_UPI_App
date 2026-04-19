// ═══════════════════════════════════════════════════════
//  Badge Component — Transaction Status
// ═══════════════════════════════════════════════════════

'use client';

import { cn } from '@/lib/utils';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'default';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  const variants = {
    success: 'bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400',
    warning: 'bg-warning-50 dark:bg-warning-500/10 text-warning-600 dark:text-warning-400',
    danger: 'bg-danger-50 dark:bg-danger-500/10 text-danger-600 dark:text-danger-400',
    default: 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Map transaction status to badge variant
 */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    COMPLETED: { variant: 'success', label: 'Completed' },
    PENDING: { variant: 'warning', label: 'Pending' },
    FAILED: { variant: 'danger', label: 'Failed' },
    REVERSED: { variant: 'danger', label: 'Reversed' },
  };

  const { variant, label } = map[status] || { variant: 'default', label: status };

  return <Badge variant={variant}>{label}</Badge>;
}

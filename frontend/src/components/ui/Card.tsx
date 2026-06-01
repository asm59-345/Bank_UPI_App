// ═══════════════════════════════════════════════════════
//  Card Component
// ═══════════════════════════════════════════════════════

'use client';

import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'gradient';
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  children,
  className,
  variant = 'default',
  onClick,
  padding = 'md',
}: CardProps) {
  const variants = {
    default: 'bg-white dark:bg-surface-800/60 shadow-sm',
    glass: 'glass-card',
    gradient: 'balance-card text-white',
  };

  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div
      className={cn(
        'rounded-2xl transition-all duration-200',
        variants[variant],
        paddings[padding],
        onClick && 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

interface SubComponentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className }: SubComponentProps) {
  return <div className={cn('p-6 pt-0', className)}>{children}</div>;
}

export function CardHeader({ children, className }: SubComponentProps) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)}>{children}</div>;
}

export function CardTitle({ children, className }: SubComponentProps) {
  return (
    <h3 className={cn('text-lg font-bold leading-none tracking-tight font-display', className)}>
      {children}
    </h3>
  );
}


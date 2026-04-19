// ═══════════════════════════════════════════════════════
//  Loader / Skeleton Components
// ═══════════════════════════════════════════════════════

'use client';

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// ─── Full-screen spinner ───
export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-surface-200 dark:border-surface-700" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-primary-500 animate-spin" />
        </div>
        <p className="text-sm text-surface-500 animate-pulse-soft">Loading...</p>
      </div>
    </div>
  );
}

// ─── Inline spinner ───
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return <Loader2 className={cn(sizes[size], 'animate-spin text-primary-500')} />;
}

// ─── Skeleton Block ───
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} {...props} />;
}

// ─── Balance Card Skeleton ───
export function BalanceSkeleton() {
  return (
    <div className="balance-card animate-pulse">
      <div className="relative z-10 space-y-4">
        <Skeleton className="h-4 w-24 !bg-white/20" />
        <Skeleton className="h-10 w-48 !bg-white/20" />
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-4 w-20 !bg-white/20" />
          <Skeleton className="h-4 w-16 !bg-white/20" />
        </div>
      </div>
    </div>
  );
}

// ─── Transaction Item Skeleton ───
export function TransactionSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-16" />
    </div>
  );
}

// ─── List of Transaction Skeletons ───
export function TransactionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <TransactionSkeleton key={i} />
      ))}
    </div>
  );
}

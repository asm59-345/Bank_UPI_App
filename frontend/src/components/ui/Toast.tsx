// ═══════════════════════════════════════════════════════
//  Toast Component — Global Notification Display
// ═══════════════════════════════════════════════════════

'use client';

import { useToast } from '@/hooks/useToast';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[100] space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto p-4 rounded-2xl shadow-xl animate-slide-down',
            'flex items-center gap-3 backdrop-blur-xl',
            toast.type === 'success' && 'bg-success-50/95 dark:bg-success-900/40 text-success-700 dark:text-success-400',
            toast.type === 'error' && 'bg-danger-50/95 dark:bg-danger-900/40 text-danger-700 dark:text-danger-400',
            toast.type === 'info' && 'bg-primary-50/95 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400',
          )}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
          {toast.type === 'error' && <XCircle className="w-5 h-5 flex-shrink-0" />}
          {toast.type === 'info' && <Info className="w-5 h-5 flex-shrink-0" />}
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

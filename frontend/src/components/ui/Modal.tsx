// ═══════════════════════════════════════════════════════
//  Modal Component
// ═══════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Content — Bottom sheet on mobile, centered on desktop */}
      <div
        className={cn(
          'relative z-10 w-full bg-white dark:bg-surface-900 animate-slide-up',
          'rounded-t-3xl sm:rounded-3xl p-6',
          'max-h-[85vh] overflow-y-auto',
          sizes[size],
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-surface-900 dark:text-white font-display">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              <X className="w-5 h-5 text-surface-500" />
            </button>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

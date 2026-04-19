// ═══════════════════════════════════════════════════════
//  Input Component
// ═══════════════════════════════════════════════════════

'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({
  label,
  error,
  icon,
  type,
  className,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider pl-1">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400">
            {icon}
          </div>
        )}
        <input
          type={isPassword && showPassword ? 'text' : type}
          className={cn(
            'input-field',
            icon && 'pl-12',
            isPassword && 'pr-12',
            error && 'ring-2 ring-danger-500/30',
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-danger-500 pl-1 animate-slide-up">{error}</p>
      )}
    </div>
  );
}

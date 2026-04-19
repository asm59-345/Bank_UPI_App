// ═══════════════════════════════════════════════════════
//  Bottom Navigation Component
// ═══════════════════════════════════════════════════════

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, SendHorizontal, Clock, User, ArrowDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/send', label: 'Send', icon: SendHorizontal },
  { href: '/request', label: 'Request', icon: ArrowDownLeft },
  { href: '/transactions', label: 'History', icon: Clock },
  { href: '/profile', label: 'Profile', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" id="bottom-nav">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200',
                isActive
                  ? 'text-primary-500'
                  : 'text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300',
              )}
            >
              <div className={cn(
                'p-1.5 rounded-xl transition-all duration-200',
                isActive && 'bg-primary-500/10',
              )}>
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={cn(
                'text-[10px] font-semibold tracking-wider',
                isActive && 'text-primary-500',
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/ui/BottomNav';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { PageLoader } from '@/components/ui/Loader';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { hydrate } = useAuthStore();
  const { fetchAccounts } = useAccountStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Hydrate auth state from localStorage (client-side only)
    hydrate();

    const token = localStorage.getItem('payflow_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    // Fetch accounts in background — don't block render
    fetchAccounts().catch(() => {});
    setChecking(false);
  }, [hydrate, fetchAccounts, router]);

  if (checking) {
    return <PageLoader />;
  }

  return (
    <div className="relative min-h-screen bg-surface-50 dark:bg-surface-950">
      <div className="safe-bottom">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}

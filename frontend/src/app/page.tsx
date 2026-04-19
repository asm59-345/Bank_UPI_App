// ═══════════════════════════════════════════════════════
//  Root Page — Redirect to Dashboard or Login
// ═══════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/ui/Loader';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('payflow_token');
    if (token) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return <PageLoader />;
}

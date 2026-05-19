'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Loader2 } from 'lucide-react';

export default function GrowLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, temAcessoGrow } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const ehUpgrade = pathname === '/grow/upgrade';

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (!temAcessoGrow && !ehUpgrade) router.replace('/grow/upgrade');
  }, [loading, user, temAcessoGrow, ehUpgrade, router]);

  if (loading || !user) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-violet-600" />
      </div>
    );
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

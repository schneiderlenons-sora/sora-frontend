'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Loader2 } from 'lucide-react';

export default function GrowLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, perfil, temAcessoGrow } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const ehUpgrade = pathname === '/grow/upgrade';

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    // Aguarda perfil carregar para evaluar temAcessoGrow corretamente.
    // Sem essa guarda, em F5 o effect rodava com perfil=null e mandava
    // o usuário pro /grow/upgrade indevidamente.
    if (perfil === null) return;
    if (!temAcessoGrow && !ehUpgrade) router.replace('/grow/upgrade');
  }, [loading, user, perfil, temAcessoGrow, ehUpgrade, router]);

  // Bloqueia render até a sessão E o perfil terem sido carregados.
  if (loading || !user || perfil === null) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-violet-600" />
      </div>
    );
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

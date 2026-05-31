'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Loader2, RefreshCw } from 'lucide-react';

export default function GrowLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, perfil, temAcessoGrow, recarregar } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const ehUpgrade = pathname === '/grow/upgrade';

  // Rede de segurança: se a sessão existe mas o perfil não carregou em ~6s
  // (corrida rara), evita o loader infinito — mostra opção de recarregar.
  const [timeout6s, setTimeout6s] = useState(false);
  useEffect(() => {
    if (!loading && user && perfil === null) {
      const t = setTimeout(() => setTimeout6s(true), 6000);
      return () => clearTimeout(t);
    }
    setTimeout6s(false);
  }, [loading, user, perfil]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    // Aguarda perfil carregar para avaliar temAcessoGrow corretamente.
    if (perfil === null) return;
    if (!temAcessoGrow && !ehUpgrade) router.replace('/grow/upgrade');
  }, [loading, user, perfil, temAcessoGrow, ehUpgrade, router]);

  // Bloqueia render até a sessão E o perfil terem sido carregados.
  if (loading || !user || perfil === null) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <Loader2 size={28} className="animate-spin text-violet-600" />
        {timeout6s && (
          <>
            <p className="text-sm text-muted-foreground max-w-xs">
              Demorou mais que o normal pra carregar sua conta.
            </p>
            <button
              onClick={() => { setTimeout6s(false); recarregar(); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
            >
              <RefreshCw size={15} /> Recarregar
            </button>
          </>
        )}
      </div>
    );
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

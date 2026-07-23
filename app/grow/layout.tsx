'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageSkeleton from '@/components/ui/PageSkeleton';
import { RefreshCw } from 'lucide-react';

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

  // Enquanto a sessão/perfil carregam, mostra o SHELL (sidebar) + skeleton em
  // vez de um spinner full-screen — o Grow "aparece" na hora, igual Finanças
  // (percepção de app nativo). O gate de acesso continua: assim que o perfil
  // resolve, o useEffect acima redireciona pra /grow/upgrade se não tiver Grow.
  // Nada de conteúdo real é exposto aqui (só skeleton), então não vaza.
  if (loading || !user || perfil === null) {
    return (
      <DashboardLayout>
        <PageSkeleton />
        {timeout6s && (
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted-foreground max-w-xs">
              Demorou mais que o normal pra carregar sua conta.
            </p>
            <button
              onClick={() => { setTimeout6s(false); recarregar(); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-colors"
            >
              <RefreshCw size={15} /> Recarregar
            </button>
          </div>
        )}
      </DashboardLayout>
    );
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

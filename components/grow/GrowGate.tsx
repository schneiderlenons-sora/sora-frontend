'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import type { Feature } from '@/lib/plans';

// Guarda uma aba do Grow atrás de um gate de plano. Básico sem acesso é
// mandado pra /planos (mesmo padrão do layout da Saúde). Enquanto o perfil
// não carregou, renderiza normal (evita flash de bloqueio em quem tem acesso).
export default function GrowGate({ feature, children }: { feature: Feature; children: React.ReactNode }) {
  const { perfil, podeUsar } = useAuth();
  const router = useRouter();
  const liberado = podeUsar(feature);

  useEffect(() => {
    if (perfil && !liberado) router.replace('/planos');
  }, [perfil, liberado, router]);

  if (perfil && !liberado) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }
  return <>{children}</>;
}

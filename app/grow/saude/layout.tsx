'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function SaudeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { perfil, podeUsar } = useAuth();

  // Saúde é Premium+. Básico vê o convite de upgrade.
  const liberado = podeUsar('grow_saude');
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

  // A sub-nav das seções não fica mais aqui (era sticky e "arrastava"). Cada
  // página renderiza <SaudeNav /> logo abaixo do seu card de título, igual Hábitos.
  return <>{children}</>;
}

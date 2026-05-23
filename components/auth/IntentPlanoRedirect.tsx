'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { lerIntencaoPlano, limparIntencaoPlano } from '@/lib/plan-intent';

/**
 * Detecta uma intenção de plano salva no signup (`?plano=X` da landing) e
 * redireciona o usuário pra /planos após o primeiro login.
 *
 * Só dispara se:
 *   1. Há intent válida no localStorage
 *   2. O perfil já carregou e o usuário ainda está `inativo`
 *   3. A página atual NÃO é /planos (evita loop)
 *
 * Após disparar, limpa a intent.
 */
export default function IntentPlanoRedirect() {
  const { perfil, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const ja = useRef(false);

  useEffect(() => {
    if (ja.current) return;                       // só uma vez por sessão
    if (loading) return;                          // espera perfil terminar
    if (!perfil) return;                          // usuário não logado
    if (perfil.plano !== 'inativo') {             // já paga, não interrompe
      limparIntencaoPlano();
      ja.current = true;
      return;
    }
    if (pathname?.startsWith('/planos')) return;  // já está lá
    if (pathname?.startsWith('/api/'))   return;  // não é página

    const intent = lerIntencaoPlano();
    if (!intent) return;

    ja.current = true;
    limparIntencaoPlano();
    router.replace(`/planos?intent=upgrade&plano=${intent}`);
  }, [perfil, loading, pathname, router]);

  return null;
}

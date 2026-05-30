'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Força o usuário a completar o wizard de onboarding antes de acessar
 * qualquer página do app. Rotas excluídas: /onboarding, /login, /signup,
 * /api/*, /vincular-whatsapp, landing (/).
 *
 * Comportamento:
 *   - Perfil carregado e onboarding_completed === false → redirect /onboarding
 *   - Se já completou ou em rota pública → não faz nada
 */
export default function OnboardingRedirect() {
  const { perfil, loading, plano } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const ja = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!perfil) return;
    if (plano === 'inativo') return;        // paywall tem prioridade — paga antes de onboardar
    if (perfil.onboarding_completed) return;

    // Rotas públicas / fora do app — não redireciona
    const rotasPublicas = [
      '/',
      '/login',
      '/signup',
      '/onboarding',
      '/vincular-whatsapp',
    ];
    if (!pathname) return;
    if (rotasPublicas.some((r) => pathname === r || pathname.startsWith(r + '/'))) return;
    if (pathname.startsWith('/api/')) return;

    if (ja.current) return;
    ja.current = true;
    router.replace('/onboarding');
  }, [perfil, loading, plano, pathname, router]);

  return null;
}

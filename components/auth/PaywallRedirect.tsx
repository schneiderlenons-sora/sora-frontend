'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { lerIntencaoPlano, limparIntencaoPlano } from '@/lib/plan-intent';

// Rotas acessíveis SEM plano ativo. Tudo o mais é bloqueado pro inativo.
// /oferta e /checkout-vitalicio precisam ser livres: o usuário acabou de se
// cadastrar (inativo) e vai PAGAR ali — não pode ser jogado pro /planos.
const ROTAS_LIVRES = ['/', '/login', '/signup', '/planos', '/oferta', '/checkout-vitalicio', '/termos', '/privacidade', '/tour'];

/**
 * Paywall do app. Enquanto o plano for `inativo` (nunca pagou / assinatura
 * cancelada), qualquer rota do app redireciona pra /planos — inclusive o
 * onboarding. Só com plano ativo o usuário acessa configurações iniciais e
 * painel.
 *
 * Fluxo: escolhe plano na landing (/signup?plano=X salva a intenção) → cria
 * conta → cai aqui inativo → /planos com o plano pré-selecionado → paga no
 * Stripe → webhook ativa o plano → paywall libera → onboarding → painel.
 *
 * Reavalia a cada navegação (depende de pathname) — se o inativo tentar sair
 * do /planos, volta pra lá.
 */
export default function PaywallRedirect() {
  const { perfil, loading, plano } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || !perfil || !pathname) return;

    // ⚠️ SÓ `inativo` É PAYWALL. `gratis` (migration 156) é o modo manual e
    // navega o app inteiro — quem o limita são os gates de feature, não este
    // guard. Tratar os dois como a mesma coisa aqui devolveria o app pro
    // estado que a mudança veio desfazer: porta fechada antes do primeiro uso.
    // Plano ativo (ou grátis) → libera e descarta a intenção salva.
    if (plano !== 'inativo') {
      limparIntencaoPlano();
      return;
    }

    // Inativo: rotas livres (incl. /planos) não redirecionam.
    if (pathname.startsWith('/api/')) return;
    if (ROTAS_LIVRES.some((r) => pathname === r || pathname.startsWith(r + '/'))) return;

    // Demais rotas → manda pro /planos, pré-selecionando o plano+ciclo da intenção.
    const intent = lerIntencaoPlano();
    const qs = intent
      ? `?intent=upgrade&plano=${intent.plano}&ciclo=${intent.ciclo}`
      : '';
    router.replace(`/planos${qs}`);
  }, [perfil, loading, plano, pathname, router]);

  return null;
}

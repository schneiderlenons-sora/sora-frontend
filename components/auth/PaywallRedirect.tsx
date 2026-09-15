'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { lerIntencaoPlano, limparIntencaoPlano } from '@/lib/plan-intent';
import { detectarOrigem } from '@/lib/origem-app';
import { decidirPaywall, destinoAposGratis } from '@/lib/paywall';

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
 * ⚠️ NO APP ANDROID NÃO HÁ PAYWALL: a conta `inativo` vira `gratis` e segue pro
 * tour. A regra e o porquê estão em `lib/paywall.ts`.
 *
 * Reavalia a cada navegação (depende de pathname) — se o inativo tentar sair
 * do /planos, volta pra lá.
 */
export default function PaywallRedirect() {
  const { perfil, loading, plano, recarregar } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Uma tentativa por carregamento: sem isto, uma falha da rota viraria laço
  // (a /planos também é rota de compra e pediria a conversão de novo).
  const convertendo = useRef(false);
  // Por ref: `recarregar` nasce de novo a cada render do AuthProvider, e como
  // dependência faria este efeito reavaliar (e redirecionar) o tempo todo.
  const recarregarRef = useRef(recarregar);
  recarregarRef.current = recarregar;

  useEffect(() => {
    if (loading || !perfil || !pathname) return;

    // ⚠️ `detectarOrigem()` AQUI DENTRO, não o `useEhAndroid()`. O hook começa em
    // 'web' e só vira 'android' depois de montar — nesse primeiro render o
    // paywall já teria mandado a conta pra /planos.
    const acao = decidirPaywall({ plano, pathname, android: detectarOrigem() === 'android' });

    // Plano ativo (ou grátis) → libera e descarta a intenção salva.
    if (acao === 'plano-ativo') {
      limparIntencaoPlano();
      return;
    }
    if (acao === 'rota-livre') return;

    if (acao === 'converter-gratis') {
      if (convertendo.current) return;
      convertendo.current = true;
      const onboardingCompleto = !!perfil.onboarding_completed;
      const rota = pathname;
      (async () => {
        try {
          const r = await fetch('/api/plano-gratis', { method: 'POST' });
          if (r.ok) {
            await recarregarRef.current();
            const destino = destinoAposGratis({ onboardingCompleto, pathname: rota });
            // Navegação COMPLETA de propósito: com o plano recém-trocado, o
            // `OnboardingRedirect` reage no mesmo instante e disputaria a rota
            // (mandaria pro wizard longo no lugar do tour).
            if (destino) window.location.replace(destino);
            return;
          }
          const d = await r.json().catch(() => ({}));
          console.warn('[paywall] plano grátis no app:', d?.erro || r.status);
        } catch {
          /* sem rede */
        }
        // Falhou: segue a regra antiga, e `convertendo` fica marcado pra não
        // repetir a tentativa em laço nesta mesma carga.
        router.replace('/planos');
      })();
      return;
    }

    // Web: manda pro /planos, pré-selecionando o plano+ciclo da intenção.
    const intent = lerIntencaoPlano();
    const qs = intent
      ? `?intent=upgrade&plano=${intent.plano}&ciclo=${intent.ciclo}`
      : '';
    router.replace(`/planos${qs}`);
  }, [perfil, loading, plano, pathname, router]);

  return null;
}

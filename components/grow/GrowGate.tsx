'use client';

import { useAuth } from '@/contexts/AuthContext';
import AbaBloqueada from '@/components/planos/AbaBloqueada';
import type { Feature } from '@/lib/plans';

/**
 * Guarda uma aba atrás de um gate de plano.
 *
 * ⚠️ O NOME ENGANA: não tem nada de Grow. Ele recebe uma `Feature` e vale pra
 * qualquer aba — Wrapped, Agentes e Drive usam o mesmo. Mantido assim porque
 * renomear tocaria em seis layouts sem mudar comportamento nenhum.
 *
 * ⚠️ ANTES ELE REDIRECIONAVA PRO /planos, e isso era pior do que parecia: a
 * pessoa clicava em "Saúde", a tela sumia e ela caía numa tabela de preços sem
 * nada dizendo qual aba tinha pedido nem o que ela faz. Agora o bloqueio fica
 * NO lugar da aba, com o nome dela e um convite — que é o ponto do paywall.
 *
 * Enquanto o perfil não carregou renderiza os filhos normalmente: um flash de
 * bloqueio em quem TEM acesso é pior que um flash de conteúdo em quem não tem,
 * porque o segundo se corrige sozinho no mesmo instante.
 */
export default function GrowGate({ feature, children }: { feature: Feature; children: React.ReactNode }) {
  const { perfil, podeUsar } = useAuth();

  if (perfil && !podeUsar(feature)) return <AbaBloqueada feature={feature} />;

  return <>{children}</>;
}

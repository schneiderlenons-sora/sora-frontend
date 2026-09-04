'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TourPlayer from '@/components/tour/TourPlayer';
import CardPlanos from '@/components/planos/CardPlanos';
import { useOrigem } from '@/lib/useOrigem';

/**
 * A abertura do app: demonstrações → escolha de plano.
 *
 * ⚠️ FICA FORA DO ROUTE GROUP `(app)`, pelo mesmo motivo do `/wrapped`: é tela
 * cheia e entrar lá GANHARIA uma sidebar por cima.
 *
 * ⚠️ E FICA NUMA ROTA SÓ, com os dois passos em estado local. Trocar de rota no
 * meio custaria um payload RSC e um frame branco bem no momento em que a pessoa
 * acabou de decidir continuar — o contrário do que a tela existe pra fazer.
 */
export default function TourPage() {
  const router = useRouter();
  const origem = useOrigem();
  const [passo, setPasso] = useState<'demo' | 'plano'>('demo');

  if (passo === 'demo') return <TourPlayer onFim={() => setPasso('plano')} />;

  return (
    <CardPlanos
      origem={origem}
      // Escolheu (ou seguiu no modo manual) → configuração mínima e app.
      onEscolher={() => router.replace('/onboarding?modo=curto')}
    />
  );
}

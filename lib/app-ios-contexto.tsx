'use client';

import { createContext } from 'react';

// "Estou no app de iPhone?" decidido NO SERVIDOR (pelo User-Agent da
// requisição) e entregue ao painel desde o 1º render — ver `useEhAppIos`.
//
// ⚠️ Existe pra não PISCAR VENDA: decidido só depois da hidratação, a /planos
// e o "Plano e Cobrança" sairiam com os preços do site por um instante dentro
// do app — o tipo de coisa que um revisor da Apple fotografa.
//
// `null` = sem provider (rotas fora de `app/(app)`): o hook cai na leitura do
// `navigator` depois de montar.
export const AppIosContexto = createContext<boolean | null>(null);

/** "Esta versão do app de iPhone vende pela Apple?" — ver `uaIosVende`. */
export const AppIosVendeContexto = createContext<boolean | null>(null);

export function AppIosProvider({ valor, vende = false, children }: { valor: boolean; vende?: boolean; children: React.ReactNode }) {
  return (
    <AppIosContexto.Provider value={valor}>
      <AppIosVendeContexto.Provider value={valor && vende}>{children}</AppIosVendeContexto.Provider>
    </AppIosContexto.Provider>
  );
}

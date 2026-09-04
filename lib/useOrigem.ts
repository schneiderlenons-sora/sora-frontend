'use client';

import { useEffect, useState } from 'react';
import { detectarOrigem, esquecerOrigem, PARAM_ANDROID, type Origem } from './origem-app';

/**
 * A origem desta sessão, para componentes.
 *
 * ⚠️ COMEÇA SEMPRE EM 'web' E SÓ MUDA DEPOIS DE MONTAR. O servidor não tem
 * `localStorage`, `document.referrer` nem a URL do cliente: chutar 'android' no
 * primeiro render daria hydration mismatch, e o React descartaria a árvore
 * inteira — o preço seria um flash de tela trocada bem no primeiro contato com
 * o app.
 *
 * 'web' como estado inicial é o lado seguro: no pior caso o app Android pisca o
 * layout da web por um frame. O contrário — a web piscando um app sem forma de
 * assinar — seria perder venda.
 */
export function useOrigem(): Origem {
  const [origem, setOrigem] = useState<Origem>('web');

  useEffect(() => {
    // `?fonte=web` desfaz a marca — é como se testa o fluxo da web no mesmo
    // aparelho onde o app já rodou, sem limpar storage na mão.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get(PARAM_ANDROID) === 'web') esquecerOrigem();
    } catch { /* URL malformada */ }

    setOrigem(detectarOrigem());
  }, []);

  return origem;
}

/** `true` só depois de montar e confirmar que a sessão veio do app Android. */
export function useEhAndroid(): boolean {
  return useOrigem() === 'android';
}

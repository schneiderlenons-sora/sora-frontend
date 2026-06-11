'use client';

import useSWR, { type SWRConfiguration, type Key } from 'swr';

/**
 * Wrapper fino do SWR pros endpoints da Sora (lib/api).
 *
 * Ganhos:
 *  - cache em memória compartilhado entre telas → revisitar uma tela é
 *    instantâneo (mostra o último dado e revalida em silêncio);
 *  - não revalida a cada foco (evita rajada de refetch no mobile);
 *  - mantém o dado anterior enquanto revalida → sem "piscar" pra vazio
 *    (acaba com o flash de dados antigos);
 *  - dedupe de requisições idênticas concorrentes.
 *
 * Passe `key=null` pra desabilitar a busca (ex.: enquanto não há phone).
 */
export function useApi<T>(
  key: Key,
  fetcher: () => Promise<T>,
  config?: SWRConfiguration<T>,
) {
  return useSWR<T>(key, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 4000,
    ...config,
  });
}

'use client';

import { useRef } from 'react';
import useSWR, { useSWRConfig, type SWRConfiguration, type Key } from 'swr';
import { useGateRegister } from '@/components/ui/LoadingGate';

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
  const { cache } = useSWRConfig();

  // ── Fim da leitura EM DOBRO do SSR ────────────────────────────────────────
  //
  // As abas com SSR entregam o HTML já pintado e passam o mesmo dado como
  // `fallbackData`. O SWR, ao montar, buscava tudo DE NOVO — então cada visita
  // lia o banco duas vezes: uma pelo Server Component e outra pelo cliente.
  // Medido: ~127 KB por visita viravam ~255 KB, e com 79 usuários ativos isso
  // sozinho explicava o estouro de egress do Supabase (6,5 GB de uma cota de 5).
  //
  // As páginas com SSR são todas `force-dynamic`: o `fallbackData` é gerado
  // NAQUELA requisição. Buscar de novo logo em seguida não traz nada novo.
  //
  // ⚠️ SÓ VALE QUANDO NÃO HÁ CACHE. Se o usuário já visitou a tela nesta
  // sessão, o SWR mostra o valor CACHEADO (o `fallbackData` é ignorado quando
  // existe cache) — e aí pular a revalidação deixaria dado velho na tela. Caso
  // real: lançar uma transação em /transacoes e voltar ao dashboard; a chave do
  // dashboard não foi invalidada e o gasto novo não apareceria. Com cache, a
  // revalidação continua acontecendo exatamente como antes.
  const temSSR = config?.fallbackData !== undefined;
  const semCache = useRef<boolean | null>(null);
  if (semCache.current === null) {
    // Só na PRIMEIRA renderização: depois do 1º fetch o cache passa a existir, e
    // reler isto a cada render faria a flag mudar no meio da vida do componente.
    //
    // ⚠️ Só otimiza quando a chave é STRING. Todas as chaves da Sora são (ver os
    // 23 call sites), mas o SWR aceita array/função — e aí `cache.get` não
    // encontraria nada e a flag daria um falso "sem cache", pulando uma
    // revalidação necessária. Não sendo string, mantém o comportamento de hoje.
    semCache.current = typeof key === 'string' && key.length > 0
      ? cache.get(key) === undefined
      : false;
  }
  const pularMount = temSSR && semCache.current === true;

  const swr = useSWR<T>(key, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 4000,
    ...config,
    // ⚠️ Fica DEPOIS do spread de propósito: se o chamador tiver pedido
    // `revalidateOnMount` explicitamente, a escolha dele vence a nossa.
    revalidateOnMount: config?.revalidateOnMount ?? (pularMount ? false : undefined),
  });
  // 1º carregamento (sem dado em cache) → mostra a baleia cobrindo a tela.
  useGateRegister(swr.isLoading);
  return swr;
}

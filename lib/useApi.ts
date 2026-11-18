'use client';

import { useRef } from 'react';
import useSWR, { useSWRConfig, type SWRConfiguration, type Key } from 'swr';
import { usePathname } from 'next/navigation';
import { useGateRegister } from '@/components/ui/LoadingGate';
import { estadoDoPortao, dadoEhDeOutraChave } from '@/lib/portao';
import { buscarReaproveitando } from '@/lib/prefetch';

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
  configComPortao?: SWRConfiguration<T> & {
    /**
     * `false` = consulta SECUNDÁRIA (não é o conteúdo da tela): nunca acende a
     * baleia. Ex.: os chamados da barra lateral, o resumo do Grow no
     * dashboard — sem isto, eles cobriam a tela inteira na 1ª abertura.
     */
    portao?: boolean;
  },
) {
  const { portao, ...config } = configComPortao || {};
  const { cache } = useSWRConfig();
  const pathname = usePathname();

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

  // ⚠️ 1ª CARGA REAPROVEITA O AQUECIMENTO que já está no ar (nov/2026) — ver
  // `buscaDoAquecimento`. Só sem dado da chave: numa revalidação (tela já com
  // dado, quase sempre depois de uma ação) a busca é sempre nova. Se a do
  // aquecimento falhar, busca por conta própria.
  const buscar = () => {
    const chave = typeof key === 'string' ? key : undefined;
    return buscarReaproveitando(chave, chave ? cache.get(chave)?.data !== undefined : true, fetcher);
  };

  const swr = useSWR<T>(key, buscar, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 4000,
    ...config,
    // ⚠️ Fica DEPOIS do spread de propósito: se o chamador tiver pedido
    // `revalidateOnMount` explicitamente, a escolha dele vence a nossa.
    revalidateOnMount: config?.revalidateOnMount ?? (pularMount ? false : undefined),
  });
  // ── Portão (a baleia) — regra em `lib/portao.ts` ─────────────────────────
  // Antes era `useGateRegister(swr.isLoading)` direto, e o `isLoading` do SWR
  // fica TRUE com conteúdo na tela (troca de mês, aba vinda do servidor ou do
  // cache). Agora a baleia só aparece quando não há nada pra mostrar.
  const chaveStr = typeof key === 'string' ? key : undefined;
  const estado = estadoDoPortao({
    carregando: swr.isLoading,
    temDado: swr.data !== undefined,
    dadoDeOutraChave: dadoEhDeOutraChave({
      dadoNaTela: swr.data,
      dadoNoCacheDaChave: chaveStr ? cache.get(chaveStr)?.data : undefined,
      fallbackData: config?.fallbackData,
    }),
    secundario: portao === false,
    painelNegocios: !!pathname && pathname.startsWith('/negocios'),
  });
  useGateRegister(estado, chaveStr);
  return swr;
}

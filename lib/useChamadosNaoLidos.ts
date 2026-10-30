'use client';

// Quantas respostas do suporte a pessoa ainda não leu.
//
// ⚠️ CHAVE CANÔNICA `d:chamados:<phone>` — a mesma da Sidebar, da mini
// notificação (AvisoChamado) e da lista de chamados. O SWR deduplica, então
// quantos lugares chamarem isto continua sendo UMA requisição a cada 2 min.
//
// ⚠️ `useSWR` direto, não `useApi`: o `useApi` registra no LoadingGate, e a
// baleia cobriria a página por causa de um contador.
//
// Falha silenciosa: sem resposta, o contador é 0 — um selo nunca pode quebrar
// a navegação.

import { useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { api, type ChamadoResumo } from '@/lib/api';

export const chaveChamados = (phone?: string | null) => (phone ? `d:chamados:${phone}` : null);

const semInscricao = () => () => {};

export function useChamadosNaoLidos(): { naoLidas: number; carregado: boolean } {
  const { phone } = useAuth();
  const { data } = useSWR(chaveChamados(phone), () => api.bug.meusChamados(), {
    refreshInterval: 120_000, revalidateOnFocus: true,
  });
  // ⚠️ Zero até montar: o cache do SWR vive no localStorage, e um selo que
  // aparece no 1º render do navegador mas não no HTML do servidor é
  // hydration mismatch.
  const montado = useSyncExternalStore(semInscricao, () => true, () => false);
  if (!montado) return { naoLidas: 0, carregado: false };
  const lista = (data as { chamados?: ChamadoResumo[] } | undefined)?.chamados || [];
  return {
    naoLidas: lista.reduce((s, c) => s + (Number(c.nao_lidas) || 0), 0),
    carregado: data !== undefined,
  };
}

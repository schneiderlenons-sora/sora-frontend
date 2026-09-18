'use client';

// =============================================================================
// A conexão de Open Finance de uma conta/cartão ainda está VIVA?
//
// POR QUE EXISTE (set/2026). Cliente: "a fatura do BTG não bate com o que o
// banco fechou". Não era cálculo: ele DESCONECTOU o BTG em 09/09 e reconectou
// em 12/09, e o consentimento novo trouxe só a conta corrente. O cartão ficou
// preso ao consentimento morto — sem transação desde 05/09, sem a fatura que
// fechou em 15/09 — e a tela seguia mostrando o valor como se fosse de hoje.
//
// A carteira guarda o consentimento de onde veio (`of_consent_id`), e a
// conexão viva mora em `of_conexoes` (`external_id` = o consentimento).
// Desconectar APAGA a linha de lá (vai pro histórico). Então: conta com
// `of_conta_id` cujo consentimento não está na lista = conexão encerrada.
//
// ⚠️ SÓ AFIRMA COM A LISTA EM MÃOS. Se a busca falhar (sem plano de Open
// Finance, rede), nada é marcado — alarme falso de "conexão encerrada" faria o
// cliente reconectar um banco que está funcionando.
// ⚠️ Carteira sem `of_consent_id` (trilho legado) nunca é marcada: não há como
// saber a que conexão ela pertence.
// =============================================================================

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';

type Carteira = { of_conta_id?: unknown; of_consent_id?: string | null } | null | undefined;

export function useConexoesOF(ativo: boolean) {
  const { data, error } = useSWR(
    ativo ? 'of:conexoes' : null,
    () => api.openFinance.conexoes(),
    { revalidateOnFocus: false },
  );
  const mapa = useMemo(() => {
    const m: Record<string, { ultima_sync: string | null; status: string | null }> = {};
    for (const c of data?.conexoes || []) {
      if (c?.external_id) m[String(c.external_id)] = { ultima_sync: c.ultima_sync ?? null, status: c.status ?? null };
    }
    return m;
  }, [data]);
  const pronto = !!data && !error;

  const encerrada = useCallback(
    (w: Carteira) => pronto && !!w?.of_conta_id && !!w?.of_consent_id && !mapa[String(w.of_consent_id)],
    [pronto, mapa],
  );
  const sincronizadoEm = useCallback(
    (w: Carteira) => (w?.of_consent_id ? mapa[String(w.of_consent_id)]?.ultima_sync ?? null : null),
    [mapa],
  );
  return { encerrada, sincronizadoEm };
}

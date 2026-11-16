'use client';

// Categorias próprias da empresa ativa (migration 196).
//
// ⚠️ `useSWR` direto, NÃO `useApi`: o `useApi` registra no LoadingGate e a
// baleia cobriria a tela inteira só porque um modal abriu. Uma chave só pra
// todas as telas (formulário, gerenciador, Fluxo de caixa, regras): quem
// muda chama `recarregar()` e todas veem a mudança.

import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { CategoriaPropria } from '@/lib/categorias-negocio';

export const chaveCategoriasNegocio = (phone: string, empresaId: string) => `neg:categorias:${phone}:${empresaId}`;

export function useCategoriasNegocio(empresaId?: string | null) {
  const { phone } = useAuth();
  const chave = phone && empresaId ? chaveCategoriasNegocio(phone, empresaId) : null;
  const { data, error, isLoading, mutate } = useSWR(
    chave,
    () => api.negocios.categorias.listar(phone!, empresaId!),
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );
  return {
    proprias: (data?.categorias || []) as CategoriaPropria[],
    /** Sem a migration 196: dá pra listar as digitadas, mas não guardar ícone. */
    semMigration: !!data?.semMigration,
    carregando: isLoading,
    erro: error as Error | undefined,
    recarregar: () => mutate(),
  };
}

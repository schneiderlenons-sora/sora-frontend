'use client';

// ─────────────────────────────────────────────────────────────
// Marcas personalizadas do grupo — logo de loja custom, casada por NOME no
// texto da transação (igual às marcas famosas embutidas, só que do usuário).
// Carregado uma vez por grupo e consumido pelo CategoriaIcon como a marca de
// MAIOR prioridade. Sem provider, o hook devolve um matcher no-op (degrada
// pro comportamento antigo).
// ─────────────────────────────────────────────────────────────
import { createContext, useContext, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useAuth } from './AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { temMarcaConhecida } from '@/components/ui/IconeMarca';
import {
  indexarMarcas, indexarRenomes, acharLogo,
  type MarcaCustom as MarcaCustomBase, type RegraRenome,
} from '@/lib/marca-custom';

// Reexporta pra quem já importava daqui — a forma mora em lib/marca-custom.
export type MarcaCustom = MarcaCustomBase;

type Ctx = {
  marcas: MarcaCustom[];
  matchLogo: (nome: string) => string | null;
  recarregar: () => void;
};

const MarcasCustomContext = createContext<Ctx>({ marcas: [], matchLogo: () => null, recarregar: () => {} });

// A regra de casamento mora em `lib/marca-custom.ts` (pura e com eval) — aqui
// só o React em volta dela.

export function MarcasCustomProvider({ children }: { children: React.ReactNode }) {
  const { phone } = useAuth();
  const { data, mutate } = useApi(phone ? `marcas:${phone}` : null, () => api.marcas.listar(phone!));
  const marcas: MarcaCustom[] = (data as MarcaCustom[]) ?? [];

  // Renomes das regras — é o que faz a logo sobreviver a "mude a descrição
  // para X" (ver o cabeçalho de `lib/marca-custom.ts`).
  //
  // ⚠️ SÓ BUSCA QUEM TEM MARCA. Sem marca personalizada não há logo pra
  // resgatar, e este provider embrulha o painel inteiro.
  // ⚠️ `?simples=1` — a rota normal varre TODAS as transações do grupo pra
  // contar o uso de cada regra. Aqui só interessam `termo` e `renomear_para`.
  // ⚠️ `useSWR` direto, NÃO `useApi`: o useApi registra no LoadingGate e a
  // baleia cobriria a tela inteira por causa de uma lista acessória.
  const { data: renomesRaw } = useSWR(
    phone && marcas.length ? `regras-renome:${phone}` : null,
    () => api.regras.renomes(phone!),
    { revalidateOnFocus: false },
  );

  const value = useMemo<Ctx>(() => {
    const idx = indexarMarcas(marcas);
    const renomes = indexarRenomes((renomesRaw as RegraRenome[]) || []);
    return {
      marcas,
      matchLogo: (nome: string) => acharLogo(idx, nome, renomes),
      recarregar: () => mutate(),
    };
  }, [marcas, renomesRaw, mutate]);

  return <MarcasCustomContext.Provider value={value}>{children}</MarcasCustomContext.Provider>;
}

export const useMarcasCustom = () => useContext(MarcasCustomContext);

/**
 * "Este texto tem marca?" — considerando o catálogo embutido **E** as marcas
 * personalizadas do grupo.
 *
 * ⚠️ USE ESTE, NUNCA `temMarcaConhecida` SOZINHO, pra decidir se o ícone de
 * uma linha vem da DESCRIÇÃO ou da categoria.
 *
 * Relato de cliente (26/09/2026): subiu a logo do "SEM PARAR", a marca ficou
 * gravada, as 71 transações têm `observacao` exatamente "SEM PARAR" — e a
 * logo não aparecia. A causa não era o casamento (esse funciona): era a
 * decisão ANTERIOR a ele. As telas faziam
 *
 *     iconeNome = temMarcaConhecida(desc) ? desc : nomeDaCategoria
 *
 * e `temMarcaConhecida` só conhece o catálogo embutido (iFood, Nike, Shopee…).
 * Como "SEM PARAR" é marca do USUÁRIO, a condição dava `false`, o ícone
 * recebia "Pedágio" — e o `matchLogo` do CategoriaIcon nunca chegava a ver a
 * descrição. A marca personalizada era consultada tarde demais.
 */
export function useTemMarca() {
  const { matchLogo } = useMarcasCustom();
  return useCallback(
    (nome: string) => temMarcaConhecida(nome) || !!matchLogo(nome),
    [matchLogo],
  );
}

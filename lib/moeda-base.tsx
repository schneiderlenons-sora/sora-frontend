'use client';

// =============================================================================
// Moeda base do grupo no painel — provider + hooks (Fase 1 da moeda base,
// docs/PLANO-MOEDA-BASE.md; a coluna é `grupos.moeda_base`, migration 168).
//
// ⚠️ A MOEDA VEM DO SERVIDOR, NÃO DO PERFIL NO CLIENTE. `app/(app)/layout.tsx`
// lê a base no `contextoSSR` e passa como valor inicial. Lendo só no cliente
// (perfil do `AuthContext`), o HTML do SSR sairia com "R$" e trocaria pro
// símbolo certo depois da hidratação — o mesmo flash que o cookie de "ocultar
// valores" existe pra evitar. E o perfil ainda passa pelo cache do localStorage,
// que pode estar velho: seria um segundo valor pra discordar do primeiro.
//
// ⚠️ TROCAR A BASE EXIGE RECARREGAR A PÁGINA. O layout do painel não re-renderiza
// em navegação de cliente (é o que deixa a troca de aba instantânea), então o
// valor fica o da carga. É aceitável porque a troca é rara e está TRAVADA depois
// que o grupo tem lançamento (decisão do dono); quem trocar faz `location.reload()`.
// =============================================================================

import { createContext, useContext, useMemo } from 'react';
import { formatarDinheiro, normalizarMoeda, simboloMoeda, type Moeda } from '@/lib/moeda';

// Fora do provider (landing, onboarding, Wrapped) o padrão é BRL — exatamente o
// comportamento de antes da moeda base existir.
const MoedaBaseCtx = createContext<Moeda>('BRL');

export function MoedaBaseProvider({ moeda, children }: { moeda?: string | null; children: React.ReactNode }) {
  return <MoedaBaseCtx.Provider value={normalizarMoeda(moeda)}>{children}</MoedaBaseCtx.Provider>;
}

/** A moeda em que o grupo ativo vive. */
export function useMoedaBase(): Moeda {
  return useContext(MoedaBaseCtx);
}

/** Símbolo da moeda base (R$, US$, kr…) — pra prefixo de campo e eixo compacto. */
export function useSimboloMoeda(): string {
  return simboloMoeda(useMoedaBase());
}

/**
 * Formato COMPACTO de eixo/célula ("R$1,2k") com o símbolo da moeda base.
 *
 * Cada tela tem o seu compacto (k, M, casas diferentes) e ele continua
 * declarado no módulo, agora recebendo o símbolo em vez de cravar "R$". `f`
 * precisa ser estável (do módulo): a função devolvida só muda quando o símbolo
 * muda, e é essa identidade que o `useFmt` memoiza.
 */
export function useComSimbolo(f: (v: number, simbolo: string) => string): (v: number) => string {
  const simbolo = useSimboloMoeda();
  return useMemo(() => (v: number) => f(v, simbolo), [f, simbolo]);
}

/**
 * Como a tela tratava valor inválido ANTES, preservado caso a caso:
 *   - `'cru'`          → `format(v)`: NaN sai "R$ NaN" (padrão)
 *   - `'ouZero'`       → `format(v || 0)`
 *   - `'finitoOuZero'` → `format(Number.isFinite(v) ? v : 0)`
 *
 * ⚠️ Não "melhorar" unificando os três. `ouZero` e `finitoOuZero` divergem em
 * `Infinity`, e trocar `cru` por zerar esconderia um NaN que hoje denuncia dado
 * quebrado. Cada arquivo migrado mantém exatamente o que já fazia.
 */
export type EntradaDinheiro = 'cru' | 'ouZero' | 'finitoOuZero';

/**
 * Formatador de dinheiro na moeda base do grupo.
 *
 * Devolve a MESMA função enquanto moeda e opções não mudam — `useFmt` (valores
 * ocultos) memoiza pela identidade dela, e uma função nova a cada render
 * refaria o memo à toa.
 */
export function useDinheiro(
  // `moeda`: formata numa moeda que NÃO é a do grupo — o cartão em real num
  // grupo em dólar mostra a fatura em real. Ausente (ou vazia), é a base.
  opts: { entrada?: EntradaDinheiro; maximoCasas?: number; moeda?: string | null } = {},
): (v: number) => string {
  const base = useMoedaBase();
  const moeda = opts.moeda ? normalizarMoeda(opts.moeda) : base;
  const { entrada = 'cru', maximoCasas } = opts;
  return useMemo(() => (v: number) => {
    const n = entrada === 'ouZero' ? (v || 0)
      : entrada === 'finitoOuZero' ? (Number.isFinite(v) ? v : 0)
      : v;
    return formatarDinheiro(n, moeda, { maximoCasas });
  }, [moeda, entrada, maximoCasas]);
}

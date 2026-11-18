// =============================================================================
// Portão de carregamento — QUANDO a baleia aparece (nov/2026). Fonte única;
// `lib/useApi.ts` só informa os fatos. Travado em `npm run eval:portao`.
//
// ⚠️ POR QUE EXISTE. A baleia era ligada direto no `isLoading` do SWR, e ele é
// TRUE em casos em que JÁ HÁ conteúdo na tela:
//   • troca de mês/ano (chave nova): o mês anterior segue visível
//     (`keepPreviousData`) — medido: 0,7 a 1,6 s de baleia em TODA troca de mês
//     em Transações, Relatórios e Categorias;
//   • aba que veio pronta do servidor (SSR) ou do cache, revalidando: o SWR
//     monta a tela como `{ isLoading: true, ...cache }` quando o cache não tem o
//     campo `isLoading` (o `mutate` não grava) — medido: Cartões 1,9 s e a volta
//     ao dashboard 1,7 s, com a tela inteira desenhada por baixo.
// Cliente no plano grátis: "frequentemente aparece a tela com a baleia".
//
// A regra:
//   • nada pra mostrar ................................ baleia (como sempre)
//   • mostrando dado de OUTRA chave (mês anterior) .... 'trocando': barra fina
//     no topo + conteúdo apagado, sem bloquear nada — o número antigo não pode
//     passar por número do mês novo
//   • mostrando dado DA PRÓPRIA chave ................. nada: revalida calado
//   • consulta secundária (chamados, resumo do Grow) .. nunca segura a tela
//   • painel Negócios ................................. como era (baleia em
//     qualquer carregamento): lá a chave muda ao trocar de EMPRESA, e mostrar a
//     empresa anterior, mesmo apagada, confunde (decisão do dono)
// =============================================================================

export type EstadoPortao = 'baleia' | 'trocando' | null;

export interface FatosDoCarregamento {
  /** `isLoading` do SWR. */
  carregando: boolean;
  /** Há algum dado na tela (da chave, do servidor ou do mês anterior). */
  temDado: boolean;
  /** O dado na tela é de OUTRA chave (o `keepPreviousData` do SWR). */
  dadoDeOutraChave: boolean;
  /** Consulta que não é o conteúdo principal da tela (`portao: false`). */
  secundario?: boolean;
  /** Dentro do painel Negócios. */
  painelNegocios?: boolean;
}

export function estadoDoPortao(f: FatosDoCarregamento): EstadoPortao {
  if (f.secundario) return null;
  if (!f.carregando) return null;
  if (f.painelNegocios) return 'baleia';
  if (!f.temDado) return 'baleia';
  if (f.dadoDeOutraChave) return 'trocando';
  return null;
}

/**
 * O dado que o SWR devolveu é de OUTRA chave? Só dá pra saber comparando com
 * o cache DESTA chave: o SWR devolve o mês anterior (`keepPreviousData`)
 * quando a chave nova ainda não tem nada. O `fallbackData` do servidor é da
 * própria chave — não conta.
 */
export function dadoEhDeOutraChave(p: {
  dadoNaTela: unknown;
  dadoNoCacheDaChave: unknown;
  fallbackData: unknown;
}): boolean {
  if (p.dadoNaTela === undefined) return false;
  if (p.dadoNoCacheDaChave !== undefined) return false;
  if (p.fallbackData !== undefined && p.dadoNaTela === p.fallbackData) return false;
  return true;
}

// =============================================================================
// Gasto que conta pro limite de uma categoria.
//
// ⚠️ PORTE FIEL de sora-backend/src/services/limites.js (verificarLimite).
// O BACKEND É CANÔNICO: é ele que decide se o alerta do WhatsApp dispara.
// Mexeu num, mexa no outro e rode `npm run eval:limite-categoria` aqui e
// `npm run eval:limites` lá.
//
// POR QUE EXISTE (bug real, ago/2026): a aba Limites somava só o gasto lançado
// com o NOME EXATO da categoria. Como a taxonomia v4 é de dois níveis e quase
// todo gasto cai numa FILHA, os pais mostravam zero. Medido numa conta real:
//
//   Empreendimento    mostrava R$    0,00   real R$ 1.768,39  (Facebook Ads…)
//   Financeiro        mostrava R$    0,00   real R$   615,09
//   Alimentação       mostrava R$    0,00   real R$   244,85
//   Encomendas        mostrava R$    0,00   real R$   215,19  (Mercado Livre)
//   ─────────────────────────────────────────────────────────
//   a aba inteira      R$ 466,77  de  R$ 3.797,48  →  88% invisível
//
// Pior que o número errado: o backend SEMPRE somou as filhas, então o alerta do
// WhatsApp disparava por um total que o painel jurava não existir.
// =============================================================================

/** Só o necessário — o chamador passa as linhas da tabela `categorias`. */
export type CategoriaArvore = { id: string; nome: string; parent_id?: string | null };

/**
 * Normalização para COMPARAR nomes de categoria.
 *
 * ⚠️ `Extended_Pictographic`, nunca `\p{Emoji}`: a classe `Emoji` inclui os
 * DÍGITOS 0-9 (eles têm Emoji=Yes por causa dos teclados numéricos), então
 * `\p{Emoji}` transforma a categoria "99" — o app de corrida — em string vazia,
 * que colide com toda transação sem categoria. Mesma classe usada pelo
 * `limpaCat` do backend.
 */
export function chaveCategoria(nome: string | null | undefined): string {
  return (nome || '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]/gu, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Os nomes que entram na conta do limite de `nome`: ela mesma + as filhas
 * diretas.
 *
 * ⚠️ UM NÍVEL SÓ, igual ao backend — a taxonomia tem dois. Descer recursivo
 * aqui e não lá faria o painel e o alerta divergirem de novo, que é o bug que
 * este arquivo existe pra fechar.
 *
 * ⚠️ Limite numa SUBcategoria soma só ela. Quem põe teto em "Mercado Livre"
 * quer o teto do Mercado Livre, não o de Encomendas inteiro.
 */
export function nomesDoLimite(nome: string, categorias: CategoriaArvore[]): string[] {
  const chave = chaveCategoria(nome);
  const nomes = new Set([chave]);
  const cat = categorias.find((c) => chaveCategoria(c.nome) === chave);
  if (cat) {
    categorias
      .filter((c) => c.parent_id === cat.id)
      .forEach((c) => nomes.add(chaveCategoria(c.nome)));
  }
  return [...nomes];
}

/**
 * Soma o gasto de uma categoria contando as filhas.
 *
 * `gastoPorChave` vem do `por_categoria` do resumo (a mesma fonte da aba
 * Categorias), já indexado por `chaveCategoria`.
 */
export function gastoComFilhas(
  nome: string,
  categorias: CategoriaArvore[],
  gastoPorChave: Map<string, number>,
): number {
  return nomesDoLimite(nome, categorias)
    .reduce((s, n) => s + (gastoPorChave.get(n) || 0), 0);
}

/** Indexa `por_categoria` do resumo por chave normalizada. */
export function indexarGastos(
  porCategoria: { categoria: string; total: number }[] | undefined | null,
): Map<string, number> {
  const m = new Map<string, number>();
  (porCategoria || []).forEach((c) => {
    const k = chaveCategoria(c.categoria);
    // Soma em vez de sobrescrever: duas grafias da mesma categoria ("iFood" e
    // "🛵 iFood") normalizam pra mesma chave e as duas têm de contar.
    m.set(k, (m.get(k) || 0) + (c.total || 0));
  });
  return m;
}

// =============================================================================
// Categoria da dívida (migration 198, nov/2026) — o lado da TELA.
//
// Pedido de cliente: o Seguro Residencial parcelado entrava como "Dívidas" nos
// relatórios. A dívida ganhou categoria opcional, e o pagamento da parcela é
// lançado nela. Quem confere de verdade é o backend
// (`sora-backend/src/services/categoriaDivida.js`): só aceita categoria de
// DESPESA que existe no grupo e grava a grafia oficial.
//
// Aqui mora só o que a tela decide: quais opções mostrar e se um nome escolhido
// em OUTRA tela (o Nova Transação) pode ir junto sem o servidor recusar.
// =============================================================================

export const CATEGORIA_PADRAO_DIVIDA = 'Dívidas';

type Cat = {
  id?: string | null;
  nome?: string | null;
  parent_id?: string | null;
  tipo?: string | null;
  arquivada?: boolean | null;
};

export type OpcaoCategoriaDivida = { nome: string; filhas: string[] };

const porNome = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

/**
 * As categorias que a dívida pode usar, em árvore (pai → subcategorias).
 *
 * ⚠️ Só DESPESA (e "ambos"): pagar parcela é saída de dinheiro, e o servidor
 * recusa categoria de receita. Arquivada fica de fora.
 * ⚠️ Subcategoria cujo pai não entra na lista (pai de receita, arquivado ou que
 * não veio) aparece SOLTA no topo: sumir com ela tiraria uma escolha válida.
 */
export function opcoesCategoriaDivida(cats: Cat[] | null | undefined): OpcaoCategoriaDivida[] {
  const validas = (Array.isArray(cats) ? cats : [])
    .filter((c): c is Cat & { nome: string } =>
      !!c && typeof c.nome === 'string' && !!c.nome.trim() && c.tipo !== 'receita' && !c.arquivada);
  const idsPais = new Set(validas.filter((c) => !c.parent_id).map((c) => c.id).filter(Boolean));

  const opcoes: OpcaoCategoriaDivida[] = validas
    .filter((c) => !c.parent_id)
    .map((p) => ({
      nome: p.nome,
      filhas: validas.filter((f) => f.parent_id && f.parent_id === p.id).map((f) => f.nome).sort(porNome),
    }));
  for (const f of validas) {
    if (f.parent_id && !idsPais.has(f.parent_id)) opcoes.push({ nome: f.nome, filhas: [] });
  }
  return opcoes.sort((a, b) => porNome(a.nome, b.nome));
}

/** O nome está entre as opções (como pai ou subcategoria)? */
export function categoriaNaLista(nome: string | null | undefined, opcoes: OpcaoCategoriaDivida[]): boolean {
  if (!nome) return false;
  return opcoes.some((o) => o.nome === nome || o.filhas.includes(nome));
}

/**
 * O que vai no pedido ao SALVAR o formulário da dívida.
 *
 * ⚠️ Na EDIÇÃO só manda a categoria se a pessoa MUDOU. Uma dívida pode ter uma
 * categoria que depois foi apagada da lista; reenviar o mesmo nome a cada
 * edição faria o servidor recusar e a pessoa não conseguiria mudar nem o
 * título. Na criação, manda só quando escolheu (vazio = padrão "Dívidas").
 */
export function categoriaNoPedido(atual: string, inicial: string | null | undefined, editando: boolean):
  { categoria?: string | null } {
  const a = (atual || '').trim();
  const i = (inicial || '').trim();
  if (editando) return a === i ? {} : { categoria: a || null };
  return a ? { categoria: a } : {};
}

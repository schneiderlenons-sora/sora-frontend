// =============================================================================
// EVAL: lib/categoria-divida.ts — as opções e o pedido da categoria da dívida.
// Rodar: npm run eval:categoria-divida
// =============================================================================
const { opcoesCategoriaDivida, categoriaNaLista, categoriaNoPedido, CATEGORIA_PADRAO_DIVIDA } = await import('./categoria-divida.ts');

const falhas = [];
let casos = 0;
const eq = (a, b, m) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     esperado ${JSON.stringify(b)}\n     veio     ${JSON.stringify(a)}`); };

// Formato REAL de GET /api/categorias (id, nome, parent_id, icone, cor, tipo, arquivada, parent).
const CATS = [
  { id: 'm', nome: 'Moradia', parent_id: null, tipo: 'despesa', arquivada: false },
  { id: 'm1', nome: 'Aluguel', parent_id: 'm', tipo: 'despesa', arquivada: false },
  { id: 'm2', nome: 'Água', parent_id: 'm', tipo: 'despesa', arquivada: false },
  { id: 's', nome: 'Seguros', parent_id: null, tipo: 'despesa', arquivada: false },
  { id: 'p', nome: 'Presente', parent_id: null, tipo: 'ambos', arquivada: null },
  { id: 'r', nome: 'Trabalho', parent_id: null, tipo: 'receita', arquivada: false },
  { id: 'r1', nome: 'Salário', parent_id: 'r', tipo: 'receita', arquivada: false },
  { id: 'a', nome: 'Velha', parent_id: null, tipo: 'despesa', arquivada: true },
  { id: 'a1', nome: 'Filha da velha', parent_id: 'a', tipo: 'despesa', arquivada: false },
  { id: 'x', nome: '', parent_id: null, tipo: 'despesa' },
];

// §1. Opções
const op = opcoesCategoriaDivida(CATS);
eq(op.map((o) => o.nome), ['Filha da velha', 'Moradia', 'Presente', 'Seguros'], '§1 só despesa/ambos, sem arquivada, ordem alfabética pt-BR');
eq(op.find((o) => o.nome === 'Moradia').filhas, ['Água', 'Aluguel'], '§1 subcategorias sob o pai, em ordem');
eq(op.some((o) => o.nome === 'Trabalho' || o.filhas.includes('Salário')), false, '§1 receita (e suas filhas) fica de fora');
eq(op.find((o) => o.nome === 'Filha da velha')?.filhas, [], '§1 subcategoria de pai arquivado aparece solta, não some');
eq(opcoesCategoriaDivida(null), [], '§1 sem dado: lista vazia (não quebra)');
eq(opcoesCategoriaDivida({}), [], '§1 formato inesperado: lista vazia');

// §2. Está na lista?
eq(categoriaNaLista('Seguros', op), true, '§2 pai na lista');
eq(categoriaNaLista('Aluguel', op), true, '§2 subcategoria na lista');
eq(categoriaNaLista('Salário', op), false, '§2 receita não está');
eq(categoriaNaLista('', op), false, '§2 vazio não está');
eq(categoriaNaLista('Fallback inventado', op), false, '§2 nome fora da lista do grupo não vai pro servidor');

// §3. O que vai no pedido
eq(categoriaNoPedido('Seguros', null, false), { categoria: 'Seguros' }, '§3 criar com categoria');
eq(categoriaNoPedido('', null, false), {}, '§3 criar sem categoria: não manda (padrão Dívidas)');
eq(categoriaNoPedido('Seguros', 'Seguros', true), {}, '§3 editar sem mudar: NÃO reenvia (categoria apagada não trava a edição)');
eq(categoriaNoPedido('Moradia', 'Seguros', true), { categoria: 'Moradia' }, '§3 editar trocando: manda a nova');
eq(categoriaNoPedido('', 'Seguros', true), { categoria: null }, '§3 editar voltando ao padrão: manda null');
eq(categoriaNoPedido('Seguros', null, true), { categoria: 'Seguros' }, '§3 editar dívida antiga (sem categoria) escolhendo uma');
eq(CATEGORIA_PADRAO_DIVIDA, 'Dívidas', '§3 o padrão é o mesmo nome do backend');

if (falhas.length) {
  console.log(`✗ ${falhas.length} de ${casos} falharam:\n - ` + falhas.join('\n - '));
  process.exit(1);
}
console.log(`✓ categoria da dívida (tela): ${casos} verificações ok`);

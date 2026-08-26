// =============================================================================
// EVAL do porte TS da regra de limite por categoria — compara com o backend
// CANÔNICO (sora-backend/src/services/limites.js), função a função.
//
// Se os dois divergirem, o painel mostra um número e o alerta do WhatsApp
// dispara por outro — que é exatamente o bug que originou este arquivo:
// a aba Limites somava só o nome exato da categoria, o backend sempre somou as
// filhas, e 88% do gasto do mês ficava invisível na tela.
//
// Rodar:   npx tsx lib/limite-categoria.eval.mjs
//   (ou:   npm run eval:limite-categoria)
// Sai com código != 0 se algo divergir.
// =============================================================================

import { chaveCategoria, nomesDoLimite, gastoComFilhas, indexarGastos } from './limite-categoria.ts';

const req = (await import('node:module')).createRequire(import.meta.url);

// `limites.js` abre o cliente do Supabase no topo do módulo, e este eval só
// quer as duas funções PURAS. Stub no require.cache (mesmo padrão do
// evals/lembreteFila.eval.js do backend) evita exigir credencial pra rodar o
// eval — e garante que ele não toca no banco de ninguém.
const dbPath = req.resolve('../../sora-backend/src/db/supabase.js');
req.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {} };

const B = req('../../sora-backend/src/services/limites.js');

const falhas = [];
const ok = (c, m) => { if (!c) falhas.push(m); };
const eq = (a, b, m) => ok(a === b, `${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`);
const eqSet = (a, b, m) =>
  ok(JSON.stringify([...a].sort()) === JSON.stringify([...b].sort()),
     `${m} (esperado ${JSON.stringify([...b].sort())}, veio ${JSON.stringify([...a].sort())})`);

// ── 1. Normalização: idêntica ao limpaCat do backend ───────────────────────
console.log('── 1. chaveCategoria == limpaCat ──');
{
  const casos = [
    '🛵 iFood', 'iFood', 'Alimentação', '  CASA e Decoração ', '🔧 Ajuste',
    'Mercado Livre', 'Encomendas', '13º salário', 'Pix enviado', null, '', '   ',
    '↩️ Reembolso', '💳 Fatura', 'Saúde',
  ];
  for (const c of casos) eq(chaveCategoria(c), B.limpaCat(c), `limpaCat("${c}")`);

  // ⚠️ O caso que motivou trocar \p{Emoji} por Extended_Pictographic: "99" é o
  // app de corrida, e \p{Emoji} come os DÍGITOS (eles têm Emoji=Yes). Com a
  // classe errada a categoria vira string vazia e passa a casar com toda
  // transação sem categoria.
  eq(chaveCategoria('99'), '99', '"99" sobrevive');
  eq(chaveCategoria('🚕 99'), '99', '"🚕 99" vira "99"');
  ok(chaveCategoria('99') !== chaveCategoria(null), '"99" NÃO colide com sem-categoria');
}
console.log('  ok');

// ── 2. Rollup: mesmos nomes que o backend ──────────────────────────────────
// Árvore com a forma real da taxonomia v4 (dois níveis).
const CATS = [
  { id: 'p1', nome: '📦 Encomendas',    parent_id: null },
  { id: 'f1', nome: 'Mercado Livre',    parent_id: 'p1' },
  { id: 'f2', nome: 'Shein',            parent_id: 'p1' },
  { id: 'p2', nome: '🍔 Alimentação',   parent_id: null },
  { id: 'f3', nome: 'Restaurante',      parent_id: 'p2' },
  { id: 'f4', nome: 'Lanches',          parent_id: 'p2' },
  { id: 'p3', nome: '🛵 Delivery',      parent_id: null },
  { id: 'f5', nome: 'iFood',            parent_id: 'p3' },
  { id: 'p4', nome: '💼 Empreendimento', parent_id: null },
  { id: 'f6', nome: 'Facebook Ads',     parent_id: 'p4' },
  { id: 'f7', nome: 'Hospedagem',       parent_id: 'p4' },
];

console.log('── 2. nomesDoLimite == backend ──');
{
  for (const alvo of ['Encomendas', '📦 Encomendas', 'Alimentação', 'Delivery',
                      'Empreendimento', 'Mercado Livre', 'iFood', 'Categoria que não existe']) {
    eqSet(nomesDoLimite(alvo, CATS), B.nomesDoLimite(alvo, CATS), `nomesDoLimite("${alvo}")`);
  }
}
console.log('  ok');

// ── 3. O caso do cliente, com os números medidos ───────────────────────────
console.log('── 3. os números que geraram o bug ──');
{
  // `por_categoria` do resumo daquele mês, como a API devolve.
  const resumo = [
    { categoria: 'Facebook Ads',  total: 1606.46 },
    { categoria: 'Hospedagem',    total: 161.93 },
    { categoria: 'Mercado Livre', total: 215.19 },
    { categoria: 'Restaurante',   total: 94.11 },
    { categoria: 'Lanches',       total: 109.67 },
    { categoria: 'iFood',         total: 160.78 },
  ];
  const idx = indexarGastos(resumo);

  eq(gastoComFilhas('Encomendas', CATS, idx), 215.19,
     'Encomendas soma o Mercado Livre (era R$ 0,00 na tela)');
  eq(Number(gastoComFilhas('Empreendimento', CATS, idx).toFixed(2)), 1768.39,
     'Empreendimento soma Facebook Ads + Hospedagem');
  eq(Number(gastoComFilhas('Alimentação', CATS, idx).toFixed(2)), 203.78,
     'Alimentação soma Restaurante + Lanches');
  eq(gastoComFilhas('Delivery', CATS, idx), 160.78, 'Delivery soma o iFood');

  // ⚠️ Limite numa SUBcategoria conta só ela — não pode virar o total do pai.
  eq(gastoComFilhas('Mercado Livre', CATS, idx), 215.19, 'sub soma só ela mesma');
  eq(gastoComFilhas('iFood', CATS, idx), 160.78, 'sub soma só ela mesma (2)');

  // Categoria sem gasto não pode virar NaN nem undefined.
  eq(gastoComFilhas('Shein', CATS, idx), 0, 'sem gasto = 0');
  eq(gastoComFilhas('Não existe', CATS, idx), 0, 'fora do catálogo = 0');
}
console.log('  ok');

// ── 4. Duas grafias da mesma categoria somam ───────────────────────────────
// O histórico tem "iFood" (do categorizador) e "🛵 iFood" (digitado no painel).
// Sobrescrever em vez de somar perderia uma das duas.
console.log('── 4. grafias diferentes somam ──');
{
  const idx = indexarGastos([
    { categoria: 'iFood',    total: 100 },
    { categoria: '🛵 iFood', total: 60.78 },
  ]);
  eq(idx.get('ifood'), 160.78, 'as duas grafias entram na mesma chave');
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`❌ ${falhas.length} divergência(s):`);
  falhas.forEach((f) => console.error('   · ' + f));
  process.exit(1);
}
console.log('✅ Limite por categoria: porte TS bate com o backend em todos os casos.');

// =============================================================================
// EVAL: QUANDO a baleia aparece (lib/portao.ts). Rodar: npm run eval:portao
//
// Cada caso é um cenário MEDIDO em produção (nov/2026) — ver o cabeçalho de
// lib/portao.ts — mais o que NÃO pode mudar: sem nada na tela ainda é baleia,
// e no painel Negócios tudo segue como era.
// =============================================================================
import { estadoDoPortao, dadoEhDeOutraChave } from './portao.ts';

const falhas = [];
let total = 0;
const eq = (a, b, m) => { total++; if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     esperado ${JSON.stringify(b)}\n     veio     ${JSON.stringify(a)}`); };
const e = (f) => estadoDoPortao({ carregando: true, temDado: false, dadoDeOutraChave: false, ...f });

console.log('── 1. O QUE CONTINUA IGUAL ──');
eq(e({}), 'baleia', '§1 1ª visita sem nada pra mostrar: baleia (sem flash de zeros)');
eq(e({ carregando: false }), null, '§1 sem carregamento: nada');
eq(e({ carregando: false, temDado: true }), null, '§1 dado pronto: nada');
eq(e({ painelNegocios: true, temDado: true, dadoDeOutraChave: true }), 'baleia', '⚠️ §1 Negócios: troca de chave (empresa) segue com baleia');
eq(e({ painelNegocios: true, temDado: true }), 'baleia', '§1 Negócios: qualquer carregamento segue como era');
eq(e({ painelNegocios: true, carregando: false }), null, '§1 Negócios sem carregar: nada');
console.log('  ok');

console.log('── 2. O QUE MUDA (medido) ──');
eq(e({ temDado: true, dadoDeOutraChave: true }), 'trocando', '⚠️ §2 troca de mês: barra + apagado, NÃO baleia');
eq(e({ temDado: true }), null, '⚠️ §2 aba com dado do servidor/cache revalidando: nada (era baleia de até 1,9 s)');
eq(e({ secundario: true }), null, '⚠️ §2 consulta secundária (chamados, resumo do Grow): nunca segura a tela');
eq(e({ secundario: true, painelNegocios: true }), null, '§2 secundária vale também no Negócios (é selo da barra)');
console.log('  ok');

console.log('── 3. DE QUEM É O DADO NA TELA ──');
const doServidor = { linhas: 1 };
eq(dadoEhDeOutraChave({ dadoNaTela: undefined, dadoNoCacheDaChave: undefined, fallbackData: undefined }), false, '§3 sem dado: não é de outra chave');
eq(dadoEhDeOutraChave({ dadoNaTela: [1], dadoNoCacheDaChave: [1], fallbackData: undefined }), false, '§3 dado no cache DESTA chave: é dela');
eq(dadoEhDeOutraChave({ dadoNaTela: doServidor, dadoNoCacheDaChave: undefined, fallbackData: doServidor }), false, '⚠️ §3 dado do SERVIDOR (fallback) é desta chave');
eq(dadoEhDeOutraChave({ dadoNaTela: [9], dadoNoCacheDaChave: undefined, fallbackData: undefined }), true, '⚠️ §3 cache desta chave vazio e dado na tela: é o mês ANTERIOR');
eq(dadoEhDeOutraChave({ dadoNaTela: [9], dadoNoCacheDaChave: undefined, fallbackData: doServidor }), true, '§3 com fallback, mas o dado na tela é outro: mês anterior');
console.log('  ok');

console.log('── 4. PONTA A PONTA (fatos → estado) ──');
// Troca de mês em Transações: o SSR é da lista NORMAL do mês inicial; a chave
// nova (mês anterior) não tem cache; o SWR devolve o mês que estava na tela.
const mesNovembro = { mes: '2026-11' };
const fatosTroca = {
  carregando: true, temDado: true,
  dadoDeOutraChave: dadoEhDeOutraChave({ dadoNaTela: mesNovembro, dadoNoCacheDaChave: undefined, fallbackData: undefined }),
};
eq(estadoDoPortao(fatosTroca), 'trocando', '§4 Transações → mês anterior: trocando');
// Cartões aberto pelo servidor; o SWR revalida (cache sem `isLoading`).
const ssr = { cartoes: 2 };
const fatosCartoes = {
  carregando: true, temDado: true,
  dadoDeOutraChave: dadoEhDeOutraChave({ dadoNaTela: ssr, dadoNoCacheDaChave: undefined, fallbackData: ssr }),
};
eq(estadoDoPortao(fatosCartoes), null, '§4 Cartões com dado do servidor revalidando: nada');
console.log('  ok');

console.log(`\n${total - falhas.length}/${total} ok`);
if (falhas.length) { console.log('\nFALHAS:\n - ' + falhas.join('\n - ')); process.exit(1); }

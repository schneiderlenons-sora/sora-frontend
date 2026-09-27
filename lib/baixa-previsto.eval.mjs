// =============================================================================
// EVAL — quem pode dar baixa numa conta fixa (Previstos).
//
// Relato de cliente (Vander, 26/09/2026): "tem coisas que já paguei (setembro)
// mas não consigo flegar como pago (…) Acredito que esta funcionalidade de
// previsão, da forma que está, não é útil e terei de fazer esta tratativa
// sempre como lançamentos futuros."
//
// ⚠️ O CENÁRIO ABAIXO É A CONTA REAL DELE — as 9 contas fixas ativas, com o
// modo e o dia que estavam no banco em 26/09/2026 (hoje = dia 26). É o que
// transforma "ele não entendeu" em número: com a regra ANTIGA, **0 de 9**
// ofereciam o botão.
//
// Rodar:  npm run eval:baixa-previsto
// =============================================================================
import { podeDarBaixa, baixaPrecisaVincular } from './baixa-previsto.ts';

const falhas = [];
const eq = (a, b, m) => { if (a !== b) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };

// As 9 contas ATIVAS da conta dele, como estavam no banco.
const DELE = [
  { nome: 'Condomínio',        dia_vencimento: 15, modo_lancamento: 'nao_lancar', valor_variavel: true,  valor: 550 },
  { nome: 'Luz',               dia_vencimento: 12, modo_lancamento: 'prever',     valor_variavel: false, valor: 217.71 },
  { nome: 'TIM',               dia_vencimento: 20, modo_lancamento: 'prever',     valor_variavel: false, valor: 300 },
  { nome: 'DAS',               dia_vencimento: 20, modo_lancamento: 'prever',     valor_variavel: false, valor: 745.5 },
  { nome: 'Emp. Funerária',    dia_vencimento: 15, modo_lancamento: 'prever',     valor_variavel: false, valor: 85.41 },
  { nome: 'Internet',          dia_vencimento: 20, modo_lancamento: 'prever',     valor_variavel: false, valor: 169.9 },
  { nome: 'INSS',              dia_vencimento: 20, modo_lancamento: 'lancar',     valor_variavel: false, valor: 249.7 },
  { nome: 'Plano de Saúde',    dia_vencimento: 6,  modo_lancamento: 'prever',     valor_variavel: false, valor: 1962.78 },
  { nome: 'Prestação do Apto', dia_vencimento: 24, modo_lancamento: 'nao_lancar', valor_variavel: true,  valor: 1200 },
];

const HOJE = 26;
// A regra ANTIGA, pra medir a diferença — não é enfeite: é ela que prova que
// o cliente não estava "usando errado".
const regraAntiga = (i) =>
  Number(i.dia_vencimento) >= HOJE
  && (i.modo_lancamento || 'lancar') === 'lancar'
  && (i.frequencia || 'mensal') !== 'semanal'
  && !i.valor_variavel && Number(i.valor) > 0;

console.log('── 1. a conta REAL do cliente: antes × depois ──');
{
  const antes = DELE.filter(regraAntiga).length;
  eq(antes, 0, '⚠️ com a regra ANTIGA, ZERO das 9 contas dele ofereciam baixa — era o relato dele, medido');

  const agora = DELE.filter((i) => podeDarBaixa(i, { ocorrenciasNoMes: 1 }));
  // Só as 2 de valor variável ficam de fora (o Extrato Futuro é o lugar delas).
  eq(agora.length, 7, '⚠️ agora 7 das 9 oferecem — as 2 de fora são as de valor VARIÁVEL, por decisão');
  eq(agora.map((i) => i.nome).join(', '),
    'Luz, TIM, DAS, Emp. Funerária, Internet, INSS, Plano de Saúde',
    'e são exatamente as de valor fixo');
}
console.log('  ok');

console.log('── 2. o vencimento NÃO esconde mais o botão ──');
{
  const venceuOntem = { dia_vencimento: 1, modo_lancamento: 'lancar', valor: 100 };
  eq(podeDarBaixa(venceuOntem, { ocorrenciasNoMes: 1 }), true,
    '⚠️ é o caso COMUM: a conta venceu, a pessoa pagou, quer marcar');
  eq(regraAntiga(venceuOntem), false, 'a regra antiga escondia justamente esse');
}
console.log('  ok');

console.log('── 3. o que CONTINUA de fora ──');
{
  const base = { dia_vencimento: 28, modo_lancamento: 'lancar', valor: 100 };
  eq(podeDarBaixa(base, { paga: true, ocorrenciasNoMes: 1 }), false, 'já paga: não há o que marcar');
  eq(podeDarBaixa(base, { pulada: true, ocorrenciasNoMes: 1 }), false, 'pulada: idem');
  eq(podeDarBaixa({ ...base, frequencia: 'semanal' }, { ocorrenciasNoMes: 4 }), false,
    '⚠️ semanal: a baixa é por MÊS e esconderia as outras semanas');
  eq(podeDarBaixa({ ...base, valor_variavel: true }, { ocorrenciasNoMes: 1 }), false,
    '⚠️ valor variável: o real difere da estimativa — é do Extrato Futuro, que pergunta o valor');
  eq(podeDarBaixa({ ...base, valor: 0 }, { ocorrenciasNoMes: 1 }), false, 'sem valor');
  eq(podeDarBaixa(base, { ocorrenciasNoMes: 0 }), false, 'não cai neste mês (ex.: anual)');
}
console.log('  ok');

console.log('── 4. AMARRAR × CRIAR — o que impede a duplicata ──');
{
  eq(baixaPrecisaVincular({ modo_lancamento: 'lancar' }), false,
    'em `lancar` a SORA é a fonte do lançamento: criar está certo');
  eq(baixaPrecisaVincular({ modo_lancamento: 'prever' }), true,
    '⚠️ em `prever` quem traz a cobrança é o BANCO — criar aqui seria duplicata');
  eq(baixaPrecisaVincular({ modo_lancamento: 'nao_lancar' }), true, 'idem em `nao_lancar`');
  eq(baixaPrecisaVincular({}), false, 'sem modo, o padrão é `lancar` (comportamento histórico)');

  // O ponto da fase: as 6 contas dele em prever/nao_lancar agora têm baixa, e
  // TODAS por vínculo — nenhuma cria transação.
  const porVinculo = DELE.filter((i) => podeDarBaixa(i, { ocorrenciasNoMes: 1 }) && baixaPrecisaVincular(i));
  eq(porVinculo.length, 6, '⚠️ 6 das 7 dele dão baixa AMARRANDO, não criando');
  const criam = DELE.filter((i) => podeDarBaixa(i, { ocorrenciasNoMes: 1 }) && !baixaPrecisaVincular(i));
  eq(criam.map((i) => i.nome).join(','), 'INSS', 'só a única em `lancar` cria transação');
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('✓ baixa de previsto: todos os casos passaram');

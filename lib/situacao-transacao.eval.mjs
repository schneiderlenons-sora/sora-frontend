// =============================================================================
// EVAL: lib/situacao-transacao.ts — parcela de cartão não é "pendente".
// Rodar: npm run eval:situacao-transacao
// =============================================================================
const { situacaoDaTransacao, competenciaDaData, rotuloNaFatura, mapaDeCartoes, cartaoDaTransacao } = await import('./situacao-transacao.ts');
const { cicloPorCompetencia, dentroDoCiclo } = await import('./ciclo-fatura.ts');

const falhas = [];
let casos = 0;
const eq = (a, b, m) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     esperado ${JSON.stringify(b)}\n     veio     ${JSON.stringify(a)}`); };

const HOJE = '2026-11-22';
const CARTAO = { nome: 'Nubank', tipo: 'Crédito', dia_fechamento: 15, dia_vencimento: 22 };

// Como o painel grava a compra parcelada (POST /transacoes/parcelado): meio-dia
// do servidor (UTC), parcela i = 1ª + (i-1) meses.
const parcela = (i, extra = {}) => ({
  tipo: 'Gasto', transferencia: false, parcela_num: i, parcela_total: 5,
  pago: i === 1, data: new Date(Date.UTC(2026, 10 + (i - 1), 22, 12)).toISOString(), ...extra,
});

// ── 1. O relato: 1.000 em 5x, compra hoje (22/11/2026), cartão fecha 15 / vence 22.
eq(situacaoDaTransacao(parcela(1), CARTAO, HOJE), { tipo: 'pago' }, '1. a 1ª parcela continua paga');
// 22/12 > fechamento 15/12 → ciclo que fecha 15/01, vence 22/01.
eq(situacaoDaTransacao(parcela(2), CARTAO, HOJE), { tipo: 'na_fatura', competencia: '2027-01' }, '1. a 2ª vai pra fatura de jan/27');
eq(situacaoDaTransacao(parcela(3), CARTAO, HOJE), { tipo: 'na_fatura', competencia: '2027-02' }, '1. a 3ª vai pra fatura de fev/27');
eq(situacaoDaTransacao(parcela(5), CARTAO, HOJE), { tipo: 'na_fatura', competencia: '2027-04' }, '1. a 5ª vai pra fatura de abr/27');
// Nenhuma das 5 é "pendente".
eq([1, 2, 3, 4, 5].filter((i) => situacaoDaTransacao(parcela(i), CARTAO, HOJE).tipo === 'pendente').length, 0, '1. nenhuma parcela aparece como pendente');

// ── 2. O dia chegou: a parcela foi cobrada — aparece como a 1ª (paga).
eq(situacaoDaTransacao(parcela(2), CARTAO, '2026-12-22'), { tipo: 'pago' }, '2. no dia dela vira paga');
eq(situacaoDaTransacao(parcela(2), CARTAO, '2026-12-21'), { tipo: 'na_fatura', competencia: '2027-01' }, '2. na véspera ainda está na fatura futura');
eq(situacaoDaTransacao(parcela(2), CARTAO, '2027-03-01'), { tipo: 'pago' }, '2. meses depois segue paga (nunca volta a pendente)');

// ── 3. Antecipada (paga com data futura) segue paga.
eq(situacaoDaTransacao(parcela(4, { pago: true }), CARTAO, HOJE), { tipo: 'pago' }, '3. antecipada = paga');

// ── 4. O que NÃO é parcela de cartão fica EXATAMENTE como antes.
eq(situacaoDaTransacao(parcela(2, { parcela_total: 1 }), CARTAO, HOJE), { tipo: 'pendente' }, '4. compra de cartão sem parcela (1/1) continua pendente');
eq(situacaoDaTransacao({ tipo: 'Gasto', pago: false, data: '2026-12-10', parcela_total: null }, CARTAO, HOJE), { tipo: 'pendente' }, '4. previsão de conta fixa no cartão continua pendente');
eq(situacaoDaTransacao(parcela(2), null, HOJE), { tipo: 'pendente' }, '4. parcela fora de cartão (conta) continua pendente');
eq(situacaoDaTransacao(parcela(2), false, HOJE), { tipo: 'pendente' }, '4. cartão = false é "não é cartão"');
eq(situacaoDaTransacao(parcela(2, { transferencia: true }), CARTAO, HOJE), { tipo: 'pendente' }, '4. transferência no cartão não muda');
eq(situacaoDaTransacao(parcela(2, { tipo: 'Recebimento' }), CARTAO, HOJE), { tipo: 'pendente' }, '4. recebimento no cartão não muda');
eq(situacaoDaTransacao(parcela(2, { data: null }), CARTAO, HOJE), { tipo: 'pendente' }, '4. sem data não afirma nada');
eq(situacaoDaTransacao({ tipo: 'Recebimento', pago: true }, null, HOJE), { tipo: 'pago' }, '4. recebido continua pago');
eq(situacaoDaTransacao(null, null, HOJE), { tipo: 'pendente' }, '4. linha nula não quebra');

// Regressão em massa: fora de parcela de cartão, o resultado é a regra antiga
// (`pago ? pago : pendente`) em todas as combinações.
let sorte = 7;
const rnd = (n) => { sorte = (sorte * 1103515245 + 12345) % 2147483648; return sorte % n; };
const escolha = (lista) => lista[rnd(lista.length)];
let comparados = 0;
for (let k = 0; k < 4000; k++) {
  const t = {
    tipo: escolha(['Gasto', 'Recebimento', null]),
    pago: escolha([true, false, null]),
    transferencia: escolha([true, false, null]),
    parcela_total: escolha([null, 0, 1, 2, 12]),
    parcela_num: escolha([null, 1, 2]),
    data: escolha(['2026-11-01', '2026-11-22T12:00:00.000Z', '2027-02-10T12:00:00.000Z', null]),
  };
  const cartao = escolha([CARTAO, null, false, { dia_fechamento: null, dia_vencimento: 10 }]);
  const ehParcelaDeCartao = !!cartao && t.tipo === 'Gasto' && !t.transferencia && Number(t.parcela_total) > 1;
  if (ehParcelaDeCartao) continue;
  comparados++;
  const antigo = t.pago ? 'pago' : 'pendente';
  const novo = situacaoDaTransacao(t, cartao, HOJE).tipo;
  if (novo !== antigo) { eq(novo, antigo, `4. regressão: ${JSON.stringify({ t, cartao })}`); break; }
}
eq(comparados > 2000, true, '4. a regressão comparou casos suficientes');

// ── 5. Fuso: o "dia" é o de São Paulo (mesma regra de lib/data-br).
// 01:00 UTC de 23/11 = 22:00 de 22/11 em SP → já é hoje → cobrada.
eq(situacaoDaTransacao(parcela(2, { data: '2026-11-23T01:00:00.000Z' }), CARTAO, HOJE), { tipo: 'pago' }, '5. instante às 22h de SP conta no dia de SP');
// Data pura (meia-noite UTC) é o próprio dia, não o anterior.
eq(situacaoDaTransacao(parcela(2, { data: '2026-11-23T00:00:00+00:00' }), CARTAO, HOJE).tipo, 'na_fatura', '5. data pura de amanhã ainda é futura');

// ── 6. Cartão sem dia de fechamento: mês-calendário (o legado).
eq(situacaoDaTransacao(parcela(2), { dia_fechamento: null, dia_vencimento: 10 }, HOJE), { tipo: 'na_fatura', competencia: '2026-12' }, '6. sem fechamento: mês da parcela');

// ── 7. competenciaDaData é a competência do ciclo que CONTÉM o dia — o
// gabarito é achado varrendo os ciclos canônicos (cicloPorFechamento) ao redor
// do dia, em milhares de cartões e dias, inclusive fechamento 29/30/31 e
// fevereiro.
// ⚠️ Não dá pra usar `cicloPorCompetencia(comp)` como gabarito: em cartão que
// fecha 28 e vence 29–31 (ou fecha 30 e vence 31), num mês curto dois ciclos
// seguidos ganham a MESMA competência (o vencimento "pula" pro mês seguinte), e
// ela devolve o outro. Caso de borda do cálculo canônico, anterior a isto.
const { cicloPorFechamento, cicloMesCalendario } = await import('./ciclo-fatura.ts');
const cicloQueContem = (cartao, dia) => {
  if (!cartao.dia_fechamento) return cicloMesCalendario(dia.slice(0, 7), cartao.dia_vencimento);
  const [Y, M] = dia.split('-').map(Number);
  for (const off of [-1, 0, 1, 2]) {
    const c = cicloPorFechamento(Y, M - 1 + off, cartao.dia_fechamento, cartao.dia_vencimento);
    if (dentroDoCiclo(dia, c)) return c;
  }
  return null;
};
let divergiu = 0;
for (let k = 0; k < 6000; k++) {
  const cartao = { dia_fechamento: escolha([null, 1, 5, 10, 15, 24, 28, 29, 30, 31]), dia_vencimento: 1 + rnd(31) };
  const Y = 2026 + rnd(3), M = 1 + rnd(12), D = 1 + rnd(28 + (M === 2 ? 0 : 3));
  const dia = `${Y}-${String(M).padStart(2, '0')}-${String(Math.min(D, new Date(Date.UTC(Y, M, 0)).getUTCDate())).padStart(2, '0')}`;
  const comp = competenciaDaData(cartao, dia);
  const certo = cicloQueContem(cartao, dia)?.competencia;
  if (comp !== certo) { divergiu++; if (divergiu < 4) eq(comp, certo, `7. ${JSON.stringify(cartao)} ${dia}`); }
}
eq(divergiu, 0, '7. a competência é sempre a do ciclo que contém o dia');
// Nos cartões comuns (sem a borda acima), as funções canônicas concordam.
eq(dentroDoCiclo('2027-01-10', cicloPorCompetencia(CARTAO, competenciaDaData(CARTAO, '2027-01-10'))), true, '7. concorda com cicloPorCompetencia no cartão comum');
eq(competenciaDaData(CARTAO, '2026-12-15'), '2026-12', '7. no dia do fechamento ainda é a fatura que fecha nele');
eq(competenciaDaData(CARTAO, '2026-12-16'), '2027-01', '7. no dia seguinte já é a próxima');

// ── 8. Rótulo.
eq(rotuloNaFatura('2026-12', HOJE), 'Fatura de dez', '8. mesmo ano: só o mês');
eq(rotuloNaFatura('2027-01', HOJE), 'Fatura de jan/27', '8. outro ano: mês/ano');
eq(rotuloNaFatura('2027-03', '2027-02-01'), 'Fatura de mar', '8. o ano é o de hoje, não fixo');

// ── 9. Achar o cartão da transação.
const mapa = mapaDeCartoes([
  { nome: 'Nubank', tipo: 'Crédito', dia_fechamento: 15 },
  { nome: 'Nubank Conta', tipo: 'Corrente' },
  { nome: ' Inter Black ', tipo: 'Crédito' },
]);
eq(cartaoDaTransacao(mapa, { carteira_nome: 'nubank' })?.dia_fechamento, 15, '9. nome sem caixa');
eq(cartaoDaTransacao(mapa, { wallet_nome: 'Inter Black' })?.nome, ' Inter Black ', '9. wallet_nome e espaços');
eq(cartaoDaTransacao(mapa, { carteira_nome: 'Nubank Conta' }), null, '9. conta corrente não é cartão');
eq(cartaoDaTransacao(mapa, null), null, '9. nulo');

if (falhas.length) {
  console.error(`\n❌ ${falhas.length} de ${casos} falharam:`);
  for (const f of falhas) console.error('  ·', f);
  process.exit(1);
}
console.log(`✅ situação da transação: ${casos} verificações ok (${comparados} casos de regressão)`);

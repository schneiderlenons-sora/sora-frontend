// =============================================================================
// EVAL do porte TS do ciclo da fatura — compara a saída do frontend
// (lib/ciclo-fatura.ts) com a do backend CANÔNICO
// (sora-backend/src/services/cicloFatura.js), campo a campo.
//
// Se os dois divergirem, o painel e o WhatsApp mostram valores diferentes pra
// mesma fatura (bug real: "fatura zerada no zap × R$ 146,89 no painel").
//
// Rodar:   npx tsx lib/ciclo-fatura.eval.mjs
//   (ou:   npm run eval:ciclo)
// Sai com código != 0 se algo divergir.
// =============================================================================

import {
  cicloPorFechamento, cicloPorCompetencia, competenciaAtual, competenciaVizinha,
  cicloMesCalendario, dentroDoCiclo, pertenceAFatura, criterioDaFatura,
} from './ciclo-fatura.ts';

const req = (await import('node:module')).createRequire(import.meta.url);
const B = req('../../sora-backend/src/services/cicloFatura.js');

const falhas = [];
const CAMPOS = ['ini', 'fim', 'fimExcl', 'venc', 'competencia', 'label', 'porCiclo'];

function comparaCiclo(rotulo, ts, js) {
  for (const k of CAMPOS) {
    if (ts[k] !== js[k]) falhas.push(`${rotulo} · campo ${k}: TS "${ts[k]}" ≠ JS "${js[k]}"`);
  }
}

// ── 1. cicloPorFechamento em toda combinação, 24 meses ──────────────────────
let n = 0;
for (const fech of [1, 3, 5, 17, 24, 28, 29, 30, 31]) {
  for (const venc of [5, 10, 15, 20, 28]) {
    for (let m = 0; m < 24; m++) {
      comparaCiclo(`cicloPorFechamento(2026,${m},${fech},${venc})`,
        cicloPorFechamento(2026, m, fech, venc),
        B.cicloPorFechamento(2026, m, fech, venc));
      n++;
    }
  }
}
console.log(`  cicloPorFechamento: ${n} ciclos comparados`);

// ── 2. Anos de borda (bissexto, virada) ─────────────────────────────────────
n = 0;
for (const Y of [2024, 2027, 2028]) {
  for (const fech of [28, 29, 30, 31]) {
    for (let m = 0; m < 12; m++) {
      comparaCiclo(`cicloPorFechamento(${Y},${m},${fech},10)`,
        cicloPorFechamento(Y, m, fech, 10),
        B.cicloPorFechamento(Y, m, fech, 10));
      n++;
    }
  }
}
console.log(`  bordas (bissexto/virada): ${n} ciclos comparados`);

// ── 3. cicloPorCompetencia (inclui cartão SEM fechamento) ───────────────────
n = 0;
for (const cartao of [
  { dia_fechamento: 5,  dia_vencimento: 15 },
  { dia_fechamento: 24, dia_vencimento: 5 },
  { dia_fechamento: 31, dia_vencimento: 10 },
  { dia_vencimento: 10 },   // sem fechamento → mês-calendário
  {},                       // sem nada
]) {
  for (const comp of ['2026-01', '2026-02', '2026-07', '2026-12', '2027-01']) {
    comparaCiclo(`cicloPorCompetencia(${JSON.stringify(cartao)},${comp})`,
      cicloPorCompetencia(cartao, comp),
      B.cicloPorCompetencia(cartao, comp));
    n++;
  }
}
console.log(`  cicloPorCompetencia: ${n} casos comparados`);

// ── 4. competenciaAtual em datas sensíveis ──────────────────────────────────
n = 0;
for (const cartao of [
  { dia_fechamento: 21, dia_vencimento: 28 },
  { dia_fechamento: 24, dia_vencimento: 5 },
  { dia_fechamento: 31, dia_vencimento: 1 },
  { dia_vencimento: 10 },
]) {
  for (const hoje of ['2026-01-01', '2026-02-28', '2026-07-26', '2026-07-28',
                      '2026-07-29', '2026-12-31', '2028-02-29']) {
    const ts = competenciaAtual(cartao, hoje);
    const js = B.competenciaAtual(cartao, hoje);
    if (ts !== js) falhas.push(`competenciaAtual(${JSON.stringify(cartao)},${hoje}): TS "${ts}" ≠ JS "${js}"`);
    n++;
  }
}
console.log(`  competenciaAtual: ${n} casos comparados`);

// ── 5. competenciaVizinha (navegação, ida e volta) ──────────────────────────
n = 0;
for (const cartao of [{ dia_fechamento: 24, dia_vencimento: 5 }, { dia_fechamento: 5, dia_vencimento: 15 }, {}]) {
  for (const comp of ['2026-01', '2026-07', '2026-12']) {
    for (const delta of [-2, -1, 1, 2]) {
      const ts = competenciaVizinha(cartao, comp, delta);
      const js = B.competenciaVizinha(cartao, comp, delta);
      if (ts !== js) falhas.push(`competenciaVizinha(${JSON.stringify(cartao)},${comp},${delta}): TS "${ts}" ≠ JS "${js}"`);
      n++;
    }
  }
}
console.log(`  competenciaVizinha: ${n} casos comparados`);

// ── 6. Sanidade local do TS (helpers que só existem no front) ──────────────
const cc = cicloPorCompetencia({ dia_fechamento: 5, dia_vencimento: 15 }, '2026-08');
if (!(dentroDoCiclo('2026-07-30', cc) && dentroDoCiclo('2026-08-01T12:00:00.000Z', cc)))
  falhas.push('dentroDoCiclo: caso do cliente (30/07 + 01/08 na mesma fatura) falhou');
if (dentroDoCiclo('2026-08-06', cc)) falhas.push('dentroDoCiclo: 06/08 NÃO deveria estar no ciclo 06/07–05/08');
if (dentroDoCiclo(null, cc)) falhas.push('dentroDoCiclo(null) deveria ser false');
if (cicloMesCalendario('2026-02').fim !== '2026-02-28') falhas.push('cicloMesCalendario fev errado');
console.log('  helpers locais do TS: ok');

// ── 7. pertenceAFatura: parcelamento do Open Finance ──────────────────────
// Caso real (Mercado Pago, jul/2026): compra de 20/06 em 3×. O banco manda as
// TRÊS parcelas com a data da COMPRA — por data, as 3 caíam na fatura de junho;
// no cartão real elas se espalham por julho, agosto e setembro. Quem desempata
// é o `of_bill_id` do emissor (migration 101).
{
  const cartao = { dia_fechamento: 12, dia_vencimento: 17, of_bill_atual: 'bill-ago' };
  const ago = cicloPorCompetencia(cartao, '2026-08');
  const jul = cicloPorCompetencia(cartao, '2026-07');
  const parcela = (bill, v) => ({ data: '2026-06-20', valor: v, of_bill_id: bill, tipo: 'Gasto' });

  // Todas as parcelas vieram vinculadas → o critério da fatura é o vínculo.
  const txsVinculadas = [parcela('bill-jul', 56.66), parcela('bill-ago', 56.66), parcela('bill-set', 56.67)];
  const cBill = criterioDaFatura(txsVinculadas, cartao, true);
  const casos = [
    [cBill === 'bill', 'com tudo vinculado, o critério é o vínculo do emissor'],
    [!pertenceAFatura(parcela('bill-jul', 56.66), cartao, ago, true, cBill), 'parcela 1/3 (julho) não pode entrar na fatura de agosto'],
    [pertenceAFatura(parcela('bill-ago', 56.66), cartao, ago, true, cBill), 'parcela 2/3 tem de entrar, mesmo com data de 20/06'],
    [!pertenceAFatura(parcela('bill-set', 56.67), cartao, ago, true, cBill), 'parcela 3/3 (setembro) não pode entrar'],
    [pertenceAFatura(parcela('bill-jul', 56.66), cartao, jul, false, criterioDaFatura(txsVinculadas, cartao, false)),
      'fatura anterior (sem vínculo conhecido) volta pro ciclo'],
    [criterioDaFatura(txsVinculadas, { dia_fechamento: 12, dia_vencimento: 17 }, true) === 'ciclo',
      'cartão MANUAL ignora of_bill_id e usa só o ciclo'],
  ];

  // ⚠️ REGRESSÃO DO BUG REAL (Nubank, ago/2026): parte das transações vinculada
  // à fatura ANTERIOR e parte do ciclo novo ainda SEM vínculo. Decidindo por
  // transação, a fatura somava as duas coisas: R$ 3.143,75 (julho, já pago) +
  // R$ 1.870,24 (agosto) = R$ 5.013,99, onde o banco mostrava R$ 3.423,57.
  {
    const cartaoReal = { dia_fechamento: 7, dia_vencimento: 14, of_bill_atual: null };
    const cicloAgo = cicloPorCompetencia(cartaoReal, '2026-08');
    const misturadas = [
      { data: '2026-06-14', valor: 3143.75, of_bill_id: 'bill-jul', tipo: 'Gasto' }, // fatura fechada
      { data: '2026-07-29', valor: 1870.24, tipo: 'Gasto' },                          // ciclo aberto
    ];
    const crit = criterioDaFatura(misturadas, cartaoReal, true);
    const soma = misturadas
      .filter((t) => pertenceAFatura(t, cartaoReal, cicloAgo, true, crit))
      .reduce((s, t) => s + t.valor, 0);
    casos.push(
      [crit === 'ciclo', 'sem fatura aberta publicada, o critério é o ciclo'],
      [Math.abs(soma - 1870.24) < 0.01, `fatura não pode somar as duas (deu ${soma.toFixed(2)}, esperado 1870.24)`],
      [Math.abs(soma - 5013.99) > 0.01, 'nunca mais pode dar 5.013,99'],
    );
  }

  // E quando o emissor publica a fatura aberta e vincula tudo, o vínculo manda
  // e as compras soltas do ciclo NÃO entram junto.
  {
    const cartaoPub = { dia_fechamento: 7, dia_vencimento: 14, of_bill_atual: 'bill-ago' };
    const cicloAgo = cicloPorCompetencia(cartaoPub, '2026-08');
    const txs = [
      { data: '2026-06-14', valor: 100, of_bill_id: 'bill-ago', tipo: 'Gasto' },
      { data: '2026-06-14', valor: 999, of_bill_id: 'bill-jul', tipo: 'Gasto' },
      { data: '2026-07-29', valor: 50, tipo: 'Gasto' },
    ];
    const crit = criterioDaFatura(txs, cartaoPub, true);
    const soma = txs.filter((t) => pertenceAFatura(t, cartaoPub, cicloAgo, true, crit))
      .reduce((s, t) => s + t.valor, 0);
    casos.push(
      [crit === 'bill', 'com a fatura publicada e vinculada, o critério é o vínculo'],
      [Math.abs(soma - 100) < 0.01, `só a parcela vinculada entra (deu ${soma})`],
    );
  }

  for (const [ok, msg] of casos) if (!ok) falhas.push(`pertenceAFatura: ${msg}`);
  console.log(`  pertenceAFatura (parcelamento OF + regressão do 5.013,99): ${casos.length} casos`);
}

console.log(`\n${falhas.length ? `${falhas.length} DIVERGÊNCIA(S) TS × JS ❌` : 'TS e JS idênticos ✅'}`);
if (falhas.length) {
  console.log('\n── Divergências ──');
  falhas.slice(0, 40).forEach((f) => console.log(`  ${f}`));
  if (falhas.length > 40) console.log(`  … e mais ${falhas.length - 40}`);
  process.exit(1);
}

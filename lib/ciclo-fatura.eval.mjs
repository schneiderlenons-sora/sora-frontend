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
  cicloMesCalendario, dentroDoCiclo,
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

console.log(`\n${falhas.length ? `${falhas.length} DIVERGÊNCIA(S) TS × JS ❌` : 'TS e JS idênticos ✅'}`);
if (falhas.length) {
  console.log('\n── Divergências ──');
  falhas.slice(0, 40).forEach((f) => console.log(`  ${f}`));
  if (falhas.length > 40) console.log(`  … e mais ${falhas.length - 40}`);
  process.exit(1);
}

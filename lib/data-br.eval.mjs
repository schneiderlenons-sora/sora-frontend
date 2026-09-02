// =============================================================================
// eval:data-br — trava a regra do DIA da transação.
//
// Roda com TZ=America/Sao_Paulo de propósito: o bug só aparece num fuso
// NEGATIVO, e o CI/dev costuma rodar em UTC, onde tudo passa por acidente.
//
// O caso 1 é o bug relatado por um cliente em 01/09/2026: lançamento feito no
// dia 01/09 listado como "31 de ago.".
// =============================================================================
process.env.TZ = 'America/Sao_Paulo';
const { diaDe, fmtDataBR, diaDoMes } = await import('./data-br.ts');

const CASOS = [
  // [entrada, dia esperado, por quê]
  ['2026-09-01T00:00:00+00:00',     '2026-09-01', 'DATA PURA — o bug relatado; antes saía 31/08'],
  ['2026-09-01T00:00:00.000+00:00', '2026-09-01', 'data pura com milissegundos'],
  ['2026-09-01T00:00:00Z',          '2026-09-01', 'data pura com sufixo Z'],
  ['2026-09-01',                    '2026-09-01', 'string de data crua'],
  ['2026-09-01T16:59:40.963+00:00', '2026-09-01', 'instante real no meio do dia'],
  ['2026-02-04T00:05:13+00:00',     '2026-02-03', 'instante real 00:05 UTC = 03/02 em SP'],
  ['2026-01-19T02:17:08+00:00',     '2026-01-18', 'instante real 02:17 UTC = 18/01 em SP'],
  ['2026-09-01T02:59:59+00:00',     '2026-08-31', 'borda: 02:59 UTC ainda é 31/08 em SP'],
  ['2026-09-01T03:00:00+00:00',     '2026-09-01', 'borda: 03:00 UTC já é 01/09 em SP'],
  ['2026-12-31T00:00:00+00:00',     '2026-12-31', 'data pura na virada do ANO — não pode cair em 2025'],
  ['2026-03-01T00:00:00+00:00',     '2026-03-01', 'data pura no 1º do mês — não pode cair no mês anterior'],
];

let falhas = 0;
for (const [ent, esp, por] of CASOS) {
  const got = diaDe(ent);
  const ok = got === esp;
  if (!ok) falhas++;
  console.log(`${ok ? '  ok ' : '  XX '}${String(ent).padEnd(30)} → ${got}${ok ? '' : `  (esperado ${esp})`}   · ${por}`);
}

// A regressão que originou tudo: nunca voltar a converter uma data pura.
const ANTIGO = new Date('2026-09-01T00:00:00+00:00')
  .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
const NOVO = fmtDataBR('2026-09-01T00:00:00+00:00');
console.log(`\n  regressão: new Date(...) dá "${ANTIGO}" · fmtDataBR dá "${NOVO}"`);
if (ANTIGO === NOVO) { console.log('  XX o fuso não está sendo respeitado'); falhas++; }

// `diaDoMes` alimenta o agrupamento dos gráficos — errar aqui move o gasto de dia.
if (diaDoMes('2026-09-01T00:00:00+00:00') !== 1) { console.log('  XX diaDoMes'); falhas++; }
if (diaDoMes('2026-02-04T00:05:13+00:00') !== 3) { console.log('  XX diaDoMes (instante)'); falhas++; }

console.log(falhas ? `\n${falhas} FALHA(S)` : `\n${CASOS.length + 3} verificações OK`);
process.exit(falhas ? 1 : 0);

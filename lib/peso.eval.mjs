// =============================================================================
// EVAL: histórico de PESO na tela (Saúde do Grow).
//
// O que trava:
//   1. a lista sai do mais recente pro mais antigo;
//   2. a variação de cada pesagem é contra a ANTERIOR NO TEMPO — mesmo que o
//      servidor devolva fora de ordem ou que um peso antigo seja lançado depois;
//   3. peso que chega como texto ("80.50") vira número;
//   4. variação do período e formatos (vírgula, "sem mudança");
//   5. "hoje" em São Paulo, não UTC.
//
// Rodar:  npm run eval:peso
// =============================================================================
import { linhasDoHistorico, variacaoDoPeriodo, fmtKg, fmtDelta, hojeSP } from './peso.ts';

const falhas = [];
let total = 0;
const eq = (a, b, m) => { total++; if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     esperado ${JSON.stringify(b)}\n     veio     ${JSON.stringify(a)}`); };

// Fora de ordem e com um peso ANTIGO lançado por último (o caso do pedido).
const regs = [
  { id: 'c', data: '2026-11-15', peso_kg: '79.40' },
  { id: 'a', data: '2026-11-01', peso_kg: 81 },
  { id: 'b', data: '2026-11-08T00:00:00+00:00', peso_kg: '80,2' },
  { id: 'x', data: '2026-10-20', peso_kg: 82.5, observacao: 'em jejum' },
];

console.log('── 1/2. ordem e variação ──');
const l = linhasDoHistorico(regs);
eq(l.map((r) => r.id), ['c', 'b', 'a', 'x'], 'mais recente primeiro');
eq(l.map((r) => r.data), ['2026-11-15', '2026-11-08', '2026-11-01', '2026-10-20'], 'data vira o dia');
eq(l.map((r) => r.kg), [79.4, 80.2, 81, 82.5], 'texto e vírgula viram número');
eq(l.map((r) => r.delta), [-0.8, -0.8, -1.5, null], 'variação contra a anterior no tempo; a primeira não tem');
eq(l.map((r) => r.diasDesde), [7, 7, 12, null], 'dias desde a anterior');
eq(l[3].observacao, 'em jejum', 'observação preservada');
eq(linhasDoHistorico([]), [], 'vazio');
eq(linhasDoHistorico([{ id: 'q', data: '2026-11-01', peso_kg: 'abc' }]), [], 'peso inválido fora');

console.log('── 4. período e formatos ──');
eq(variacaoDoPeriodo(regs), { delta: -3.1, dias: 26 }, 'do mais antigo ao mais recente');
eq(variacaoDoPeriodo([regs[0]]), null, 'com 1 pesagem não há variação');
eq(fmtKg(72.5), '72,5', 'vírgula');
eq(fmtKg(80), '80', 'sem casas à toa');
eq(fmtKg(80.25), '80,25', 'duas casas');
eq(fmtDelta(-0.8), '−0,8 kg', 'perdeu');
eq(fmtDelta(1.25), '+1,25 kg', 'ganhou');
eq(fmtDelta(0.02), 'sem mudança', 'diferença desprezível');

console.log('── 5. hoje em SP ──');
eq(hojeSP(new Date('2026-11-17T02:30:00Z')), '2026-11-16', '23h30 em SP ainda é dia 16');

console.log(`\n${total - falhas.length}/${total} ok`);
if (falhas.length) { console.log('\nFALHAS:\n - ' + falhas.join('\n - ')); process.exit(1); }

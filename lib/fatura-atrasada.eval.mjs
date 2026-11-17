// EVAL: textos da fatura atrasada na tela. Rodar: npm run eval:fatura-atrasada
import { nomeDoMesFatura, mesSeguinteFatura, ddmmFatura, textoDiasAtraso } from './fatura-atrasada.ts';

const falhas = [];
let total = 0;
const eq = (a, b, m) => { total++; if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}: esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };

eq(nomeDoMesFatura('2026-11'), 'novembro', 'mês da fatura');
eq(nomeDoMesFatura('2026-01'), 'janeiro', 'janeiro');
eq(nomeDoMesFatura('2026-12'), 'dezembro', 'dezembro');
eq(mesSeguinteFatura('2026-11'), '2026-12', 'próximo mês');
eq(mesSeguinteFatura('2026-12'), '2027-01', 'virada do ano');
eq(nomeDoMesFatura(mesSeguinteFatura('2026-12')), 'janeiro', 'destino da fatura de dezembro');
eq(ddmmFatura('2026-11-15'), '15/11', 'dia/mês');
eq(textoDiasAtraso(1), 'há 1 dia', 'singular');
eq(textoDiasAtraso(12), 'há 12 dias', 'plural');
eq(textoDiasAtraso(0), '', 'zero');
eq(textoDiasAtraso(null), '', 'sem dado');

console.log(`${total - falhas.length}/${total} ok`);
if (falhas.length) { console.log(falhas.join('\n')); process.exit(1); }

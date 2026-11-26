// =============================================================================
// EVAL: compromisso de vários dias — lado da tela (lib/agenda-periodo.ts).
// Compara o "até" com a regra canônica do backend, caso a caso.
// Rodar:  npm run eval:agenda-periodo
// =============================================================================
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  MAX_DIAS, validarPeriodo, moverFim, duracaoEmDias, chaveDoEvento, umPorEvento, rotuloDoDia, rotuloCurto, somarDias,
} from './agenda-periodo.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const back = require(path.join(aqui, '..', '..', 'sora-backend', 'src', 'services', 'compromissoPeriodo.js'));

const falhas = [];
let total = 0;
const eq = (a, b, m) => {
  total++;
  if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     esperado ${JSON.stringify(b)}\n     veio     ${JSON.stringify(a)}`);
};

// 1. o "até" é a MESMA regra do servidor (senão a tela deixa salvar e o servidor recusa, ou o contrário)
eq(MAX_DIAS, back.MAX_DIAS, 'MAX_DIAS igual ao backend');
const inicios = ['2026-01-01', '2026-02-27', '2026-11-27', '2026-12-30', '2028-02-28', 'lixo', ''];
const deltas = [null, '', -1, 0, 1, 2, 28, 58, 59, 60, 61, 400];
let comparados = 0;
for (const ini of inicios) {
  for (const d of deltas) {
    const fim = d == null || d === '' ? d : (/^\d{4}/.test(ini) ? somarDias(ini, d) : '2026-11-28');
    eq(validarPeriodo(ini, fim), back.validarPeriodo(ini, fim), `validarPeriodo(${ini}, ${fim}) = backend`);
    comparados++;
  }
}
for (const fim of ['2026-11-31', '2026-02-30', '27/11/2026', '2026-1-5']) {
  eq(validarPeriodo('2026-11-01', fim), back.validarPeriodo('2026-11-01', fim), `fim torto ${fim} = backend`);
  comparados++;
}

// 2. mover o início leva o fim junto
eq(moverFim('2026-11-27', '2026-12-04', '2026-11-28'), '2026-12-05', 'mantém os 2 dias');
eq(moverFim('2026-11-27', '2026-11-20', '2026-11-29'), '2026-11-22', 'pra trás também');
eq(moverFim('2026-11-27', '2026-12-04', ''), '', 'sem fim segue sem fim');
eq(moverFim('', '2026-12-04', '2026-11-28'), '2026-11-28', 'início vazio: não mexe');
eq(duracaoEmDias('2026-11-27', '2026-11-28'), 2, 'duração conta os dois dias');

// 3. um por evento
const ev = (id, dia, total, raw = 'k') => ({ id, raw: { id: raw }, ...(total > 1 ? { periodo: { dia, total, inicio: '2026-11-27', fim: '2026-11-28' } } : {}) });
const lista = [ev('comp-k-2026-11-27', 1, 2), ev('comp-k-2026-11-28', 2, 2), ev('comp-a', 1, 1, 'a'), ev('comp-b', 1, 1, 'b')];
eq(umPorEvento(lista).map((e) => e.id), ['comp-k-2026-11-27', 'comp-a', 'comp-b'], 'vários dias contam uma vez; o resto intacto');
eq(chaveDoEvento(ev('comp-k-2026-11-28', 2, 2)), 'comp-k', 'chave do evento inteiro');
eq(chaveDoEvento({ id: 'rec-1-2026-11-27' }), 'rec-1-2026-11-27', 'evento sem período: a própria chave');

// 4. rótulos
eq(rotuloDoDia({ dia: 2, total: 3, inicio: '2026-11-27', fim: '2026-11-29' }), 'Dia 2 de 3', 'rótulo do card');
eq(rotuloDoDia(undefined), null, 'sem período, sem rótulo');
eq(rotuloCurto({ dia: 1, total: 2, inicio: '2026-11-27', fim: '2026-11-28' }), 'até 28/11', 'resumo: 1º dia diz até quando');
eq(rotuloCurto({ dia: 2, total: 2, inicio: '2026-11-27', fim: '2026-11-28' }), 'dia 2 de 2', 'resumo: dia em andamento');

console.log(`${total} verificações (${comparados} comparadas com o backend) · ${falhas.length ? `${falhas.length} FALHAS` : 'todas ok'}`);
if (falhas.length) { for (const f of falhas) console.log('  ✘ ' + f); process.exit(1); }

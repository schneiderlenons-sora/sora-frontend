// EVAL — busca e horário das tarefas.  Rodar:  npm run eval:tarefas
import { casaBusca, compararHora, comHora, normalizarBusca } from './tarefas.ts';

const falhas = []; let total = 0;
const eq = (a, b, m) => { total++; if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m} — esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };

const t = { titulo: 'Reunião com o Contador', descricao: 'levar as NOTAS', categoria: 'Trabalho', tags: ['imposto', 'urgente'], projetos: { nome: 'Empresa Nova' } };
eq(normalizarBusca('  Ré  UNIÃO '), 're uniao', 'normaliza');
for (const q of ['', '   ', 'reuniao', 'REUNIÃO', 'contador', 'reun', 'notas', 'trabalho', 'imposto', 'empresa nova', 'contador reunião', 'notas imposto']) eq(casaBusca(t, q), true, `acha "${q}"`);
for (const q of ['mercado', 'reuniao mercado', 'contadora', 'urgentes']) eq(casaBusca(t, q), false, `não acha "${q}"`);
eq(casaBusca({ titulo: 'Só título' }, 'titulo'), true, 'tarefa sem os outros campos');
eq(casaBusca({ titulo: null, tags: null, projetos: null }, 'x'), false, 'campos nulos não quebram');
eq(casaBusca({ titulo: null }, ''), true, 'sem busca entra tudo');
eq([{ n: 'sem', hora: null }, { n: 'tarde', hora: '18:00' }, { n: 'cedo', hora: '08:00' }, { n: 'sem2' }].sort(compararHora).map((x) => x.n), ['cedo', 'tarde', 'sem', 'sem2'], 'ordem do relógio');
eq(compararHora({ hora: null }, { hora: null }), 0, 'empate sem horário');
eq([comHora('vence hoje', '15:00'), comHora('amanhã', null), comHora('amanhã', '')], ['vence hoje às 15:00', 'amanhã', 'amanhã'], 'rótulo');

console.log(`${total} verificações · ${falhas.length ? `${falhas.length} FALHAS` : 'todas ok'}`);
if (falhas.length) { for (const f of falhas) console.log('  ✘ ' + f); process.exit(1); }

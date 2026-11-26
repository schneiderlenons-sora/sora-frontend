// =============================================================================
// EVAL: aniversários — lado da tela (lib/aniversarios.ts) comparado com a
// regra canônica do backend (services/aniversarios.js), caso a caso.
// Rodar:  npm run eval:aniversarios
// =============================================================================
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { dataNoAno, proximaData, rotuloAnos, quandoFalta, ordenarPorProxima, maxDiaDoMes, diasEntre } from './aniversarios.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const back = require(path.join(aqui, '..', '..', 'sora-backend', 'src', 'services', 'aniversarios.js'));

const falhas = [];
let total = 0;
const eq = (a, b, m) => {
  total++;
  if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     esperado ${JSON.stringify(b)}\n     veio     ${JSON.stringify(a)}`);
};

// 1. mesma data, mesma próxima ocorrência, mesma idade que o backend
let comparados = 0;
const hojes = ['2026-01-01', '2026-02-28', '2026-11-26', '2026-12-31', '2027-02-27', '2027-02-28', '2028-02-28', '2028-02-29', '2028-03-01'];
const datas = [];
for (const [dia, mes] of [[1, 1], [28, 2], [29, 2], [1, 3], [5, 12], [31, 12], [26, 11], [30, 4]]) {
  for (const ano of [null, 1996, 2000, 2025, 2026, 2027]) {
    if (dia === 29 && mes === 2 && ano && !((ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0)) continue;
    for (const tipo of ['aniversario', 'casamento', 'data']) datas.push({ dia, mes, ano, tipo });
  }
}
for (const hoje of hojes) {
  for (const a of datas) {
    // Só o que dá pra cadastrar: o ano não pode ser futuro (formulário e servidor recusam).
    if (a.ano && `${a.ano}-${String(a.mes).padStart(2, '0')}-${String(a.dia).padStart(2, '0')}` > hoje) continue;
    const prox = proximaData(a, hoje);
    eq(prox, back.proximaOcorrencia(a, hoje), `próxima ${a.dia}/${a.mes} (ano ${a.ano}) a partir de ${hoje}`);
    eq(rotuloAnos(a, prox), back.rotuloAnos(a, prox), `idade ${a.tipo} ${a.dia}/${a.mes}/${a.ano} em ${prox}`);
    comparados += 2;
  }
}
for (let y = 2024; y <= 2030; y++) {
  eq(dataNoAno(29, 2, y), back.dataNoAno(29, 2, y), `29/02 em ${y}`); comparados++;
}

// 2. o que só a tela tem
eq([quandoFalta(0), quandoFalta(1), quandoFalta(9)], ['Hoje', 'Amanhã', 'Em 9 dias'], 'quanto falta');
eq([maxDiaDoMes(2), maxDiaDoMes(4), maxDiaDoMes(12)], [29, 30, 31], 'dias do mês no formulário (29/02 aceito)');
const ord = ordenarPorProxima([
  { id: 'a', nome: 'Bia', tipo: 'aniversario', dia: 1, mes: 1, ano: null, lembrete_semana: true, lembrete_dia: true, observacao: null },
  { id: 'b', nome: 'Ana', tipo: 'aniversario', dia: 26, mes: 11, ano: null, lembrete_semana: true, lembrete_dia: true, observacao: null },
  { id: 'c', nome: 'Caio', tipo: 'aniversario', dia: 5, mes: 12, ano: null, lembrete_semana: true, lembrete_dia: true, observacao: null },
  { id: 'd', nome: 'Abel', tipo: 'aniversario', dia: 1, mes: 1, ano: null, lembrete_semana: true, lembrete_dia: true, observacao: null },
], '2026-11-26');
eq(ord.map((x) => [x.a.nome, x.dias]), [['Ana', 0], ['Caio', 9], ['Abel', 36], ['Bia', 36]], 'ordem: quem vem primeiro (hoje no topo); empate por nome');
eq(diasEntre('2026-12-31', '2027-01-01'), 1, 'virada de ano');

console.log(`${total} verificações (${comparados} comparadas com o backend) · ${falhas.length ? `${falhas.length} FALHAS` : 'todas ok'}`);
if (falhas.length) { for (const f of falhas.slice(0, 20)) console.log('  ✘ ' + f); process.exit(1); }

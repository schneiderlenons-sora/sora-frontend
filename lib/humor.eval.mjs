// =============================================================================
// EVAL: humor com data — lado da tela (lib/humor.ts), comparando a validação
// da data com a regra do backend (services/humorRegistro.js).
// Rodar:  npm run eval:humor
// =============================================================================
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { dataLocal, somarDias, alvoPadrao, rotuloDia, erroDaData, recentesPrimeiro, DIAS_PRA_TRAS } from './humor.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const back = require(path.join(aqui, '..', '..', 'sora-backend', 'src', 'services', 'humorRegistro.js'));

const falhas = [];
let total = 0;
const eq = (a, b, m) => {
  total++;
  if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     esperado ${JSON.stringify(b)}\n     veio     ${JSON.stringify(a)}`);
};

// 1. a data do aparelho, não a de Londres
eq(dataLocal(new Date(2026, 10, 26, 22, 30)), '2026-11-26', '⚠️ 22h30 ainda é dia 26 (toISOString daria 27 no Brasil)');
eq(dataLocal(new Date(2026, 10, 27, 0, 30)), '2026-11-27', '00h30 já é dia 27');

// 2. madrugada sugere ontem
const horas = Array.from({ length: 24 }, (_, h) => alvoPadrao(new Date(2026, 10, 27, h, 15)));
eq(horas.map((a, h) => `${h}:${a}`).filter((x) => x.endsWith('ontem')), ['0:ontem', '1:ontem', '2:ontem', '3:ontem', '4:ontem'], 'até as 5h: ontem; depois: hoje');

// 3. rótulos
eq([rotuloDia('2026-11-27', '2026-11-27'), rotuloDia('2026-11-26', '2026-11-27'), rotuloDia('2026-11-25', '2026-11-27')], ['Hoje', 'Ontem', 'qua, 25/11'], 'rótulo do dia');
eq(rotuloDia('2026-12-31', '2027-01-01'), 'Ontem', 'ontem na virada do ano');

// 4. a validação da data é a MESMA do servidor
let comparados = 0;
const HOJE = '2026-11-27';
for (const d of [HOJE, '2026-11-26', '2026-11-28', '2099-01-01', somarDias(HOJE, -DIAS_PRA_TRAS), somarDias(HOJE, -DIAS_PRA_TRAS - 1), '2026-02-29', '2028-02-29', '2026-13-01', '27/11/2026', '']) {
  const front = d === '' ? null : erroDaData(d, HOJE);
  const b = back.validarData(d, HOJE);
  eq(front === null, b.ok, `data ${JSON.stringify(d)}: ok igual ao servidor`);
  if (front && !b.ok) eq(front, b.erro, `data ${d}: mesma mensagem`);
  comparados++;
}

// 5. ordem
eq(recentesPrimeiro([{ data: '2026-11-20' }, { data: '2026-11-27' }, { data: '2026-11-25' }]).map((x) => x.data), ['2026-11-27', '2026-11-25', '2026-11-20'], 'mais recentes primeiro');

console.log(`${total} verificações (${comparados} datas comparadas com o backend) · ${falhas.length ? `${falhas.length} FALHAS` : 'todas ok'}`);
if (falhas.length) { for (const f of falhas) console.log('  ✘ ' + f); process.exit(1); }

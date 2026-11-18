// =============================================================================
// EVAL: lib/vencimento-divida.ts é PORTE FIEL de
// sora-backend/src/services/vencimentoDivida.js (o canônico)?
//
// O backend GRAVA o status da dívida; o card calcula com a cópia daqui pra
// mostrar o atraso na hora. Se as duas divergirem, o selo e o texto do card
// discordam do que o WhatsApp e o lembrete dizem. Este eval roda as DUAS sobre
// a mesma grade e exige resultado idêntico, campo a campo.
//
// Rodar:  npm run eval:vencimento-divida
// =============================================================================
import { createRequire } from 'module';
const req = createRequire(import.meta.url);
const BACK = req('../../sora-backend/src/services/vencimentoDivida.js');
const FRONT = await import('./vencimento-divida.ts');

const falhas = [];
let casos = 0;
const comparar = (nome, a, b, ctx) => {
  casos++;
  if (JSON.stringify(a) !== JSON.stringify(b) && falhas.length < 10) {
    falhas.push(`${nome} ${JSON.stringify(ctx)}\n     backend ${JSON.stringify(a)}\n     painel  ${JSON.stringify(b)}`);
  }
};

const dias = [1, 5, 10, 15, 18, 28, 29, 30, 31];
const pagamentos = [null, '2025-12-20', '2026-03-09', '2026-06-01', '2026-06-30', '2026-09-12', '2026-10-28'];
const inicios = [null, '2025-11-15', '2026-05-20'];
const extras = [
  {},
  { parcelas_total: 10, parcelas_pagas: 9 },
  { parcelas_total: 4, parcelas_pagas: 4 },
  { proximo_vencimento: '2026-12-10' },
  { status: 'quitada' },
  { status: 'em_atraso' },
];
let comAtraso = 0;
for (let t = Date.UTC(2026, 0, 1); t <= Date.UTC(2027, 0, 31); t += 3 * 86400000) {
  const hoje = new Date(t).toISOString().slice(0, 10);
  for (const dia of dias) for (const ultimo_pagamento of pagamentos) for (const data_inicio of inicios) for (const ex of extras) {
    if (ultimo_pagamento && ultimo_pagamento > hoje) continue;
    const d = { dia_vencimento: dia, status: 'ativa', ultimo_pagamento, data_inicio, ...ex };
    const ctx = { ...d, hoje };
    comparar('proximoVencimento', BACK.proximoVencimento(d, hoje), FRONT.proximoVencimento(d, hoje), ctx);
    comparar('vencidaNoMes', BACK.vencidaNoMes(d, hoje), FRONT.vencidaNoMes(d, hoje), ctx);
    const a = BACK.parcelasEmAtraso(d, hoje);
    comparar('parcelasEmAtraso', a, FRONT.parcelasEmAtraso(d, hoje), ctx);
    comparar('statusDeAtraso', BACK.statusDeAtraso(d, hoje), FRONT.statusDeAtraso(d, hoje), ctx);
    if (a) comAtraso++;
  }
}
comparar('MAX_PARCELAS_ATRASO', BACK.MAX_PARCELAS_ATRASO, FRONT.MAX_PARCELAS_ATRASO, {});
// Número vindo como TEXTO do payload (input numérico) — as duas leem igual.
const texto = { dia_vencimento: '10', ultimo_pagamento: '2026-09-09', parcelas_total: '10', parcelas_pagas: '3', status: 'ativa' };
comparar('texto', BACK.parcelasEmAtraso(texto, '2026-11-18'), FRONT.parcelasEmAtraso(texto, '2026-11-18'), texto);

if (comAtraso === 0) falhas.push('a grade não exercitou nenhum atraso');
if (falhas.length) {
  console.log(`✗ ${falhas.length} divergência(s) em ${casos} comparações:\n - ` + falhas.join('\n - '));
  process.exit(1);
}
console.log(`✓ vencimento de dívida: painel = backend em ${casos} comparações (${comAtraso} com atraso)`);

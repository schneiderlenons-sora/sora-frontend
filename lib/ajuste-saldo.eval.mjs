// =============================================================================
// EVAL: `ehAjusteSaldo` do painel = o do backend, caso a caso.
//
// O backend tira o ajuste de saldo do /resumo; o painel tira dos cards de
// Transações, do gráfico diário e do SSR. Se os dois discordarem de UMA
// categoria, o número "pula" quando o cliente revalida e o card diverge do
// dashboard — a classe de bug mais cara desta base.
//
// Rodar:  npm run eval:ajuste-saldo
// =============================================================================
import { ehAjusteSaldo } from './categorizar.ts';

const req = (await import('node:module')).createRequire(import.meta.url);
const B = req('../../sora-backend/src/services/categorizar.js');

const falhas = [];
const CASOS = [
  '🔧 Ajuste', '🔧 Ajuste recebido', '🏦 Ajuste', 'Ajuste', 'ajuste', 'AJUSTE RECEBIDO',
  '  Ajuste  ', 'Ajuste  recebido', 'Ájuste', '🔧Ajuste', 'Ajuste recebido 🔧',
  'Ajuste de roupa', 'Reajuste', 'Ajustes', 'Ajuste pago', 'Ajuste recebidos',
  'Outros', 'Fatura', 'Transferências', '🛒 Mercado', '', null, undefined, 0, 'ajuste 2',
];
for (const c of CASOS) {
  if (ehAjusteSaldo(c) !== B.ehAjusteSaldo(c)) falhas.push(`divergem em ${JSON.stringify(c)}: painel ${ehAjusteSaldo(c)} × backend ${B.ehAjusteSaldo(c)}`);
}
const esperado = { '🔧 Ajuste': true, '🔧 Ajuste recebido': true, '🏦 Ajuste': true, 'Ajuste de roupa': false, 'Reajuste': false, 'ajuste 2': false };
for (const [c, v] of Object.entries(esperado)) {
  if (ehAjusteSaldo(c) !== v) falhas.push(`"${c}" deveria ser ${v}`);
}

console.log(`${CASOS.length} casos comparados`);
console.log(`\n${falhas.length ? `${falhas.length} FALHA(S) ❌` : 'tudo passou ✅'}`);
if (falhas.length) { falhas.forEach((f) => console.log('  · ' + f)); process.exit(1); }

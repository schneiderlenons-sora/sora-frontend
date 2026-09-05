// =============================================================================
// EVAL do porte de frequência — compara ESTE arquivo com o BACKEND, campo a
// campo, em 2.700 combinações.
//
// ⚠️ O BACKEND É CANÔNICO (`src/services/frequenciaRecorrencia.js` e o
// `npm run eval:frequencia` de lá, que conta os disparos reais). Este eval não
// julga a regra — ele julga se a CÓPIA da tela ficou igual. Divergir aqui faz
// o formulário prometer "termina em março" e o banco gravar abril, que é pior
// do que não mostrar data nenhuma.
//
// Rodar:  npm run eval:frequencia
// =============================================================================
import { createRequire } from 'node:module';
import { calcularDataFim, primeiraOcorrencia, descreveQuando, descreveFim } from './frequencia-recorrencia.ts';

const require = createRequire(import.meta.url);
const back = require('../../sora-backend/src/services/frequenciaRecorrencia');

const falhas = [];
const eq = (a, b, m) => {
  if (a === b) return;
  falhas.push(`${m}\n      backend: ${JSON.stringify(b)}\n      front:   ${JSON.stringify(a)}`);
};

// ── 1. `calcularDataFim` idêntico ao backend ────────────────────────────────
console.log('── 1. calcularDataFim × backend ──');
{
  let n = 0;
  let divergentes = 0;
  for (const frequencia of ['semanal', 'mensal', 'anual']) {
    for (const repeticoes of [1, 3, 6, 12, 24]) {
      for (const diaVencimento of [1, 5, 15, 28, 31]) {
        for (const dataInicio of ['2026-01-15', '2026-02-20', '2026-09-04', '2026-12-20']) {
          for (const diaSemana of [0, 3, 6]) {
            for (const mesVencimento of [1, 3, 12]) {
              const c = { frequencia, repeticoes, dataInicio, diaVencimento, diaSemana, mesVencimento };
              const a = calcularDataFim(c);
              const b = back.calcularDataFim(c);
              n += 1;
              if (a !== b) {
                divergentes += 1;
                if (divergentes <= 3) falhas.push(`divergiu em ${JSON.stringify(c)}: back=${b} front=${a}`);
              }
            }
          }
        }
      }
    }
  }
  eq(divergentes, 0, `${n} combinações comparadas`);
  console.log(`  ${n} combinações · ${divergentes} divergências`);
}
console.log('  ok');

// ── 2. `primeiraOcorrencia` idêntica ────────────────────────────────────────
console.log('── 2. primeiraOcorrencia × backend ──');
{
  let n = 0;
  let divergentes = 0;
  for (const frequencia of ['semanal', 'mensal', 'anual']) {
    for (const dataInicio of ['2026-01-31', '2026-02-01', '2026-09-04', '2026-09-05', '2026-12-20']) {
      for (const diaVencimento of [1, 5, 29, 31]) {
        for (const diaSemana of [0, 1, 5, 6]) {
          for (const mesVencimento of [1, 2, 9, 12]) {
            const c = { frequencia, dataInicio, diaVencimento, diaSemana, mesVencimento };
            const a = primeiraOcorrencia(c);
            const b = back.primeiraOcorrencia(c);
            n += 1;
            if (a !== b) {
              divergentes += 1;
              if (divergentes <= 3) falhas.push(`divergiu em ${JSON.stringify(c)}: back=${b} front=${a}`);
            }
          }
        }
      }
    }
  }
  eq(divergentes, 0, `${n} combinações comparadas`);
  console.log(`  ${n} combinações · ${divergentes} divergências`);
}
console.log('  ok');

// ── 3. Ausência de campo cai no comportamento antigo ────────────────────────
// (é o que garante que recorrência já existente no banco não muda de rumo)
console.log('── 3. sem os campos novos, nada muda ──');
{
  eq(calcularDataFim({ dataInicio: '2026-09-10' }), null, 'sem repetições é pra sempre');
  eq(calcularDataFim({ repeticoes: 0, dataInicio: '2026-09-10' }), null, '0 é pra sempre');
  eq(calcularDataFim({ repeticoes: 12, dataInicio: 'lixo' }), null, 'data inválida não inventa fim');
}
console.log('  ok');

// ── 4. Frases da lista ──────────────────────────────────────────────────────
console.log('── 4. descrição na lista ──');
{
  eq(descreveQuando({ dia_vencimento: 5 }), 'todo dia 5', 'sem frequência é mensal');
  eq(descreveQuando({ frequencia: 'semanal', dia_semana: 1 }), 'toda segunda', 'semanal');
  eq(descreveQuando({ frequencia: 'anual', dia_vencimento: 10, mes_vencimento: 3 }),
    'todo dia 10 de março', 'anual');
  eq(descreveFim(null), '', 'pra sempre não escreve nada');
  eq(descreveFim('2027-03-10'), 'até março/27', 'com fim, escreve o mês');
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.slice(0, 10).forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('✓ porte de frequência: idêntico ao backend');

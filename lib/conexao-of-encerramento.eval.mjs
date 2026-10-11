// =============================================================================
// EVAL: o que fica gravado quando a assinatura de conexão de OF é cancelada.
//
// ⚠️ BUG REAL (gilbertojun 09/2026, davidson 10/2026): pagou conexão ANUAL
// (pré-pago 12 meses), tentou subir a quantidade, a proration FALHOU, o Stripe
// cancelou a assinatura e o webhook ZEROU `of_conexoes_pagas` — levando junto a
// conexão que já tinha sido paga. Esta regra mantém o ANUAL pré-pago até o fim
// do período; o mensal cancelado zera (não há período futuro pago).
//
// Rodar:  npm run eval:conexao-encerramento
// =============================================================================
import { decidirEncerramentoConexao } from './conexao-of-encerramento.ts';

const falhas = [];
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };

const AGORA = Date.parse('2026-10-11T00:00:00Z');
const ANO_QUE_VEM = Date.parse('2027-09-19T00:00:00Z');
const ANO_PASSADO = Date.parse('2026-01-01T00:00:00Z');

// 1. O caso do Davidson: anual, 1 conexão paga até 2027-09-19 → MANTÉM.
eq(decidirEncerramentoConexao({ intervalo: 'anual', pagoAteMs: ANO_QUE_VEM, quantidadePaga: 1, agoraMs: AGORA }),
   { of_conexoes_pagas: 1, of_conexoes_pagas_ate: new Date(ANO_QUE_VEM).toISOString() },
   '1 anual pré-pago mantém a quantidade até o fim do período');

// 2. Anual com 2 pagas → mantém 2.
eq(decidirEncerramentoConexao({ intervalo: 'anual', pagoAteMs: ANO_QUE_VEM, quantidadePaga: 2, agoraMs: AGORA }),
   { of_conexoes_pagas: 2, of_conexoes_pagas_ate: new Date(ANO_QUE_VEM).toISOString() },
   '2 anual mantém quantidade 2');

// 3. ⚠️ MENSAL cancelado → ZERA (não tem período futuro pago).
eq(decidirEncerramentoConexao({ intervalo: 'mensal', pagoAteMs: ANO_QUE_VEM, quantidadePaga: 2, agoraMs: AGORA }),
   { of_conexoes_pagas: 0, of_conexoes_pagas_ate: null },
   '3 mensal cancelado zera mesmo com período no futuro');

// 4. ⚠️ Anual cujo período JÁ PASSOU → zera (não vira cortesia vitalícia).
eq(decidirEncerramentoConexao({ intervalo: 'anual', pagoAteMs: ANO_PASSADO, quantidadePaga: 1, agoraMs: AGORA }),
   { of_conexoes_pagas: 0, of_conexoes_pagas_ate: null },
   '4 anual com período no passado zera');

// 5. ⚠️ SEM DADO não se afirma nada → zera (lado seguro).
eq(decidirEncerramentoConexao({ intervalo: 'anual', pagoAteMs: null, quantidadePaga: 1, agoraMs: AGORA }),
   { of_conexoes_pagas: 0, of_conexoes_pagas_ate: null }, '5 sem prazo pago zera');
eq(decidirEncerramentoConexao({ intervalo: 'anual', pagoAteMs: ANO_QUE_VEM, quantidadePaga: 0, agoraMs: AGORA }),
   { of_conexoes_pagas: 0, of_conexoes_pagas_ate: null }, '5 quantidade paga 0 zera');
eq(decidirEncerramentoConexao({ intervalo: 'anual', pagoAteMs: NaN, quantidadePaga: 1, agoraMs: AGORA }),
   { of_conexoes_pagas: 0, of_conexoes_pagas_ate: null }, '5 prazo ilegível zera');

// 6. Intervalo ausente/estranho → zera.
eq(decidirEncerramentoConexao({ intervalo: null, pagoAteMs: ANO_QUE_VEM, quantidadePaga: 1, agoraMs: AGORA }),
   { of_conexoes_pagas: 0, of_conexoes_pagas_ate: null }, '6 intervalo null zera');

// 7. Quantidade fracionária (não deveria ocorrer) → floor, nunca arredonda pra cima.
eq(decidirEncerramentoConexao({ intervalo: 'anual', pagoAteMs: ANO_QUE_VEM, quantidadePaga: 1.9, agoraMs: AGORA }),
   { of_conexoes_pagas: 1, of_conexoes_pagas_ate: new Date(ANO_QUE_VEM).toISOString() }, '7 floor da quantidade');

console.log(`\n${falhas.length ? `${falhas.length} FALHA(S) ❌` : 'tudo passou ✅'}`);
if (falhas.length) { falhas.forEach((f) => console.log('  · ' + f)); process.exit(1); }

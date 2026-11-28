// EVAL — o que o card do cartão diz da fatura.  Rodar:  npm run eval:selo-cartao
import fs from 'fs';
import { seloDoCartao, anteriorPaga } from './selo-cartao.ts';

const falhas = []; let total = 0;
const eq = (a, b, m) => { total++; if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m} — esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };
const selo = (manual, status, extra = {}) => seloDoCartao({ manual, status, temAtrasada: false, marcadaPaga: false, ...extra });
const st = (fatura, pago, restante, extra = {}) => ({ competencia: '2026-11', fatura, pago, restante, quitada: false, ...extra });

// §1 O relato: fatura paga pelo banco e cartão à mão vazio.
eq(selo(false, st(5322.81, 5322.81, 0, { quitada: true })), 'paga', 'banco: paga pelo servidor');
eq(selo(true, st(0, 0, 0, { situacao: 'paga' })), 'vazia', 'manual vazio não é "paga"');
eq(selo(false, st(4556.09, 0, 4556.09)), 'aberta', 'banco: em curso segue aberta');

// §2 Cartão do banco
eq(selo(false, st(0, 0, 0)), 'aberta', 'banco sem valor não afirma nada novo');
eq(selo(false, st(100, 0, 100), { marcadaPaga: true }), 'paga', 'marcação à mão continua valendo');
eq(selo(false, st(100, 100, 0)), 'aberta', 'banco: quem decide é quitada (abatimento não encerra)');
eq(selo(false, null), 'aberta', 'banco sem resposta');
eq(selo(false, null, { marcadaPaga: true }), 'paga', 'sem resposta usa a marcação');
eq(selo(false, st(100, 0, 100, { situacao: 'atrasada' })), 'aberta', 'banco nunca "atrasada" pela situação');
eq(selo(false, st(100, 0, 100, { situacao: 'rolada' })), 'aberta', 'banco nunca "rolada"');

// §3 Cartão à mão (o que já valia)
eq(selo(true, st(100, 100, 0)), 'paga', 'manual paga');
eq(selo(true, st(100, 99.995, 0.005)), 'paga', 'manual sobra de centavo');
eq(selo(true, st(100, 40, 60)), 'aberta', 'manual parcial');
eq(selo(true, st(100, 0, 0)), 'paga', 'tem valor e nada falta: como antes, paga');
eq(selo(true, st(0, 50, 0)), 'paga', 'pagou e o total zerou (estorno): paga');
eq(selo(true, st(100, 0, 100, { situacao: 'atrasada' })), 'atrasada', 'manual atrasada');
eq(selo(true, st(100, 0, 0, { situacao: 'rolada' })), 'rolada', 'manual rolada');
eq(selo(true, st(0, 0, 0), { temAtrasada: true }), 'atrasada', 'atrasada anterior manda');
eq(selo(false, st(100, 100, 0, { quitada: true }), { temAtrasada: true }), 'atrasada', 'atrasada manda');
eq(selo(true, null), 'aberta', 'manual sem resposta');

// §4 Fatura anterior paga
const ant = st(5322.81, 5322.81, 0, { quitada: true, competencia: '2026-11' });
eq(anteriorPaga(ant, '2026-11'), { competencia: '2026-11', pago: 5322.81 }, 'avisa');
eq(anteriorPaga(ant, '2026-10'), null, 'outra competência');
eq(anteriorPaga({ ...ant, quitada: false }, '2026-11'), null, 'não quitada');
eq(anteriorPaga({ ...ant, pago: 0 }, '2026-11'), null, 'sem pagamento não afirma "paga"');
eq(anteriorPaga({ ...ant, restante: 10 }, '2026-11'), null, 'com saldo');
eq(anteriorPaga(null, '2026-11'), null, 'sem item');
eq(anteriorPaga(undefined, '2026-11'), null, 'sem resposta');

// §5 A tela usa a regra e o cartão do banco consulta o servidor.
const tela = fs.readFileSync(new URL('../app/(app)/cartao-de-credito/CartaoClient.tsx', import.meta.url), 'utf8');
for (const [trecho, m] of [
  ['seloDoCartao({', 'card usa a regra'],
  ['(servidor ?? doPedido)', 'banco usa o servidor'],
  ['ehManual || servidor === null', 'pergunta o que a lista não trouxe'],
  ['api.wallets.faturas(phone, -1)', 'busca a anterior'],
  ['anteriorPaga(', 'avisa a anterior'],
  ['mFP(), mFA()', 'pagar recarrega as três'],
]) eq(tela.includes(trecho), true, m);
eq(/if \(!phone \|\| !ehManual\)/.test(tela), false, 'cartão do banco não é mais pulado');
eq(/sora-fatura-\$\{cartao\.id\}-\$\{mesRef\}/.test(tela), false, 'marcação por fatura, não por mês do calendário');

console.log(`${total} verificações · ${falhas.length ? `${falhas.length} FALHAS` : 'todas ok'}`);
if (falhas.length) { for (const f of falhas) console.log('  ✘ ' + f); process.exit(1); }

// =============================================================================
// EVAL: parser de PDF (texto → lançamentos). Só a parte PURA; a extração pelo
// pdf.js é IO e não entra aqui.
// Rodar: npm run eval:importar-pdf
// =============================================================================
import { parsePdfLinhas, motivoPdfSemLancamentos, pdfEhFatura } from './importar-pdf.ts';

const falhas = [];
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };
const ok = (c, m) => { if (!c) falhas.push(m); };

const HOJE = '2026-10-15';
const LINHAS = [
  'Fatura Bradesco · Vencimento 20/10/2026',          // cabeçalho (tem data, sem valor) → ignora
  'Total da fatura R$ 2.345,67',                       // KW_IGNORAR
  'Limite de crédito R$ 5.000,00',                     // KW_IGNORAR
  'Pagamento mínimo R$ 234,56',                        // KW_IGNORAR (não é transação)
  'SALDO ANTERIOR 1.000,00',                           // KW_IGNORAR + sem data
  '14/09 POSTO MIMIM 33 - JOINVILLE 150,00',           // Gasto
  '22/09 DROGARIA FARMACENTER 1.234,56',               // Gasto milhar
  '25/09 PAGAMENTO EFETUADO -1.836,45',                // Recebimento (pagamento + negativo)
  '06/10 MERCADOLIVRE R$ 230,45',                      // Gasto com R$
  '10/10 ESTORNO COMPRA 40,00 C',                      // Recebimento (estorno + sufixo C)
  '15/12 SPOTIFY 40,90',                               // sem ano, dezembro → futuro → ano anterior
  '03/10 COMPRA PARCELADA 03/12 99,90',                // parcela no meio; data = a 1ª (03/10)
  '05/10 UBER VIAGEM',                                 // data sem valor → ignora
  'TARIFA MENSALIDADE R$ 9,90',                        // valor sem data → ignora
];

const r = parsePdfLinhas(LINHAS, HOJE);
const byDesc = (t) => r.find((x) => x.observacao.includes(t));

console.log('-- 1. só as 7 transações de verdade --');
eq(r.length, 7, '1 conta das transações (ignora cabeçalho/total/limite/mínimo/saldo/sem-valor/sem-data)');

console.log('-- 2. compras (Gasto) com data e valor certos --');
eq(byDesc('POSTO MIMIM'), { data: '2026-09-14', observacao: 'POSTO MIMIM 33 - JOINVILLE', valor: 150, tipo: 'Gasto' }, '2 posto');
eq(byDesc('DROGARIA')?.valor, 1234.56, '2 milhar 1.234,56 → 1234.56');
eq(byDesc('DROGARIA')?.data, '2026-09-22', '2 data drogaria');
eq(byDesc('MERCADOLIVRE')?.valor, 230.45, '2 valor com R$');
eq(byDesc('MERCADOLIVRE')?.tipo, 'Gasto', '2 mercadolivre é gasto');

console.log('-- 3. crédito/estorno/pagamento viram Recebimento (não contam como gasto) --');
eq(byDesc('PAGAMENTO EFETUADO')?.tipo, 'Recebimento', '3 pagamento negativo → Recebimento');
eq(byDesc('PAGAMENTO EFETUADO')?.valor, 1836.45, '3 valor do pagamento (positivo)');
eq(byDesc('ESTORNO')?.tipo, 'Recebimento', '3 estorno com sufixo C → Recebimento');

console.log('-- 4. data sem ano: se cai no futuro, volta um ano --');
eq(byDesc('SPOTIFY')?.data, '2025-12-15', '4 15/12 sem ano, futuro vs hoje → 2025');

console.log('-- 5. parcela no meio não vira a data; a 1ª data manda --');
eq(byDesc('COMPRA PARCELADA')?.data, '2026-10-03', '5 usa a 1ª data (03/10), não o 03/12');
eq(byDesc('COMPRA PARCELADA')?.valor, 99.90, '5 valor da parcela');

console.log('-- 6. linhas que NÃO são transação não entram --');
ok(!byDesc('UBER'), '6 data sem valor fora');
ok(!byDesc('TARIFA'), '6 valor sem data fora');
ok(!r.some((x) => /total|limite|saldo|m[ií]nimo|vencimento/i.test(x.observacao)), '6 cabeçalho/resumo fora');

console.log('-- 7. lista vazia / lixo não quebra --');
eq(parsePdfLinhas([], HOJE), [], '7 vazio');
eq(parsePdfLinhas(['', '   ', 'página 1 de 3'], HOJE), [], '7 só lixo');

console.log('-- 8. MÊS ESCRITO ("14 OUT"), como na fatura do Nubank (relato de nov/2026) --');
{
  const NU = [
    'FATURA 20 NOV 2026',                                    // cabeçalho: data, sem valor
    'Cartão de crédito · Vencimento 20 NOV 2026',
    '14 OUT •••• 1234 Ifood *Ifoodbr R$ 45,90',             // final do cartão sai da descrição
    '15 OUT Uber *Trip R$ 23,50',
    '16 out. Amazon Marketplace R$ 129,90',
    '20 OUT Loja 2 Marias R$ 30,00',                         // "2 MARIAS" não é data
    '3 de outubro de 2026 Farmácia São João R$ 12,00',
    '10 NOV Pagamento em 10 NOV −R$ 1.000,00',              // sinal tipográfico
    'COMPRA LOJA 2 MARIAS 25,00',                            // sem data → fora (não é 2 de março)
  ];
  const n = parsePdfLinhas(NU, '2026-11-19');
  const d = (t) => n.find((x) => x.observacao.includes(t));
  eq(n.length, 6, '8 seis lançamentos (cabeçalhos e linha sem data fora)');
  eq(d('Ifood'), { data: '2026-10-14', observacao: 'Ifood *Ifoodbr', valor: 45.9, tipo: 'Gasto' }, '8 "14 OUT" + final do cartão removido');
  eq(d('Amazon')?.data, '2026-10-16', '8 "16 out." com ponto');
  eq([d('Loja 2 Marias')?.data, d('Loja 2 Marias')?.observacao], ['2026-10-20', 'Loja 2 Marias'], '8 "2 Marias" fica na descrição, a data é 20 OUT');
  eq(d('Farmácia')?.data, '2026-10-03', '8 "3 de outubro de 2026"');
  eq([d('Pagamento')?.tipo, d('Pagamento')?.valor], ['Recebimento', 1000], '8 "−R$ 1.000,00" (menos tipográfico) é crédito');
  ok(!n.some((x) => /MARIAS/.test(x.observacao) && x.data.endsWith('-03-02')), '8 nada vira 2 de março');
  // A antiga só lia DD/MM: estas linhas davam ZERO lançamentos.
  eq(parsePdfLinhas(['14/10 Mercado R$ 10,00'], '2026-11-19').length, 1, '8 DD/MM continua funcionando');
}

console.log('-- 9. por que não leu: imagem × formato --');
eq(motivoPdfSemLancamentos([]), 'sem_texto', '9 sem texto nenhum = escaneado/imagem');
eq(motivoPdfSemLancamentos(['', ' ', '1']), 'sem_texto', '9 só lixo = escaneado/imagem');
eq(motivoPdfSemLancamentos(['Resumo da fatura do cartão', 'Pagamento mínimo R$ 120,00', 'Total da fatura R$ 1.200,00']), 'formato', '9 tem texto = não é imagem');
eq([pdfEhFatura(['FATURA 20 NOV 2026', 'Vencimento 20/11']), pdfEhFatura(['Extrato de conta corrente', 'Saldo anterior'])], [true, false], '9 fatura × extrato');

console.log(`\n${falhas.length ? `${falhas.length} FALHA(S) ❌` : 'tudo passou ✅'}`);
if (falhas.length) { falhas.forEach((f) => console.log('  · ' + f)); process.exit(1); }

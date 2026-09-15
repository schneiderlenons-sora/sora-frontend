// =============================================================================
// EVAL: SALDO ATUAL E PREVISTO DA CONTA FILTRADA (Transações × Extrato).
//
// Caso real (set/2026): filtro na conta Inter PJ. O card seguia somando todas
// as contas e o rodapé chamava de "Saldo" o resultado da lista (R$ 20.570,36).
// O cliente apontou o Extrato como a referência: parte de R$ 5.217,71, vai a
// R$ 17.117,71 com a receita pendente e desce a R$ 15.568,01 no dia 20.
//
// O que este eval trava:
//   1. Com os dados reais da conta, o previsto do fim do mês é R$ 15.568,01.
//   2. ⚠️ IGUALDADE COM O EXTRATO: pra todo dia do mês, o previsto é o saldo
//      que o Extrato (janela de 60 dias, como a aba monta) mostra no último dia
//      do mês. Duas telas, um número.
//   3. Outra conta não mexe; cartão não é conta; conta sumida vale 0.
//   4. Bordas: último dia do mês, mês sem movimento, fevereiro bissexto,
//      moeda estrangeira, conta variável marcada como estimativa.
//
// Rodar:  npm run eval:saldo-conta
// =============================================================================
import { saldoPrevistoDaConta, saldoInicialDaConta, contaDebitoDoFiltro, ultimoDiaDoMes } from './saldo-conta.ts';
import { montarExtrato } from './extrato-futuro.ts';

const falhas = [];
const eq = (a, b, m) => { if (a !== b) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };

// ── Fixture: a conta real, como veio do banco em 15/09/2026 ─────────────────
const WALLETS = [
  { nome: 'Inter PJ', tipo: 'Corrente', saldo: 5217.71, moeda: 'BRL' },
  { nome: 'BTG Banking (OF)', tipo: 'Corrente', saldo: 1076.44, moeda: 'BRL' },
  { nome: 'Banco Inter Crédito', tipo: 'Crédito', saldo: -3955.97, moeda: 'BRL' },
];
const TX = [
  { id: 't1', data: '2026-09-04T00:00:00+00:00', tipo: 'Recebimento', valor: 2796, observacao: 'Crewhu', carteira_nome: 'Inter PJ', pago: true, transferencia: false },
  { id: 't2', data: '2026-09-06T00:00:00+00:00', tipo: 'Gasto', valor: 2610.82, observacao: '[Previsto] Plano de Saúde', carteira_nome: 'Inter PJ', pago: true, transferencia: false },
  { id: 't3', data: '2026-09-08T00:00:00+00:00', tipo: 'Recebimento', valor: 5700, observacao: 'Neomind', carteira_nome: 'Inter PJ', pago: true, transferencia: false },
  { id: 't4', data: '2026-09-09T00:00:00+00:00', tipo: 'Gasto', valor: 2500, observacao: 'Transferido para BTG', carteira_nome: 'Inter PJ', pago: true, transferencia: false },
  { id: 't5', data: '2026-09-12T00:00:00+00:00', tipo: 'Recebimento', valor: 1800, observacao: 'Doquia', carteira_nome: 'Inter PJ', pago: true, transferencia: false },
  { id: 't6', data: '2026-09-14T00:00:00+00:00', tipo: 'Recebimento', valor: 3485.18, observacao: 'Ajuste de saldo (Inter PJ)', carteira_nome: 'Inter PJ', pago: true, transferencia: false },
  { id: 't7', data: '2026-09-15T00:00:00+00:00', tipo: 'Recebimento', valor: 11900, observacao: 'Opus', carteira_nome: 'Inter PJ', pago: false, transferencia: false },
  { id: 't8', data: '2026-09-12T00:00:00+00:00', tipo: 'Recebimento', valor: 400, observacao: 'Pix', carteira_nome: 'BTG Banking (OF)', pago: true, transferencia: false },
  { id: 't9', data: '2026-09-25T00:00:00+00:00', tipo: 'Gasto', valor: 999, observacao: 'Outra conta', carteira_nome: 'BTG Banking (OF)', pago: false, transferencia: false },
];
const TX_OUT = [
  { id: 'o1', data: '2026-10-06T00:00:00+00:00', tipo: 'Gasto', valor: 1700, observacao: 'Plano de Saúde', carteira_nome: 'Inter PJ', pago: false, transferencia: false, recorrencia_id: 'r-saude' },
];
const RECS = [
  { id: 'r-cond', tipo: 'Gasto', valor: 550, dia_vencimento: 15, valor_variavel: true, carteira: 'Banco Inter PF', descricao: 'Condomínio' },
  { id: 'r-luz', tipo: 'Gasto', valor: 217.71, dia_vencimento: 12, carteira: 'BTG Banking (OF)', descricao: 'Luz' },
  { id: 'r-tim', tipo: 'Gasto', valor: 300, dia_vencimento: 20, carteira: 'Inter PJ', descricao: 'TIM' },
  { id: 'r-das', tipo: 'Gasto', valor: 1000, dia_vencimento: 20, carteira: 'Inter PJ', descricao: 'DAS' },
  { id: 'r-inss', tipo: 'Gasto', valor: 249.7, dia_vencimento: 20, carteira: 'Inter PJ', descricao: 'INSS' },
  { id: 'r-saude', tipo: 'Gasto', valor: 2610.82, dia_vencimento: 6, carteira: 'Inter PJ', descricao: 'Plano de Saúde' },
  { id: 'r-internet', tipo: 'Gasto', valor: 169.9, dia_vencimento: 20, carteira: 'BTG Banking (OF)', descricao: 'Internet' },
];
const QUIT = [
  { recorrenciaId: 'r-saude', competencia: '2026-10' },
  { recorrenciaId: 'r-saude', competencia: '2026-11' },
];

// A MESMA montagem do PrevistosClient: janela de 60 dias, transações do mês
// corrente + seguinte, conta filtrada.
function extratoDaAba(hoje, conta, extra = {}) {
  const [a, m, d] = hoje.split('-').map(Number);
  const f = new Date(a, m - 1, d + 60);
  const ate = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  return montarExtrato({
    de: hoje, ate, saldoInicial: saldoInicialDaConta(extra.wallets || WALLETS, conta),
    transacoes: [...(extra.tx || TX), ...(extra.txOut || TX_OUT)],
    recorrencias: extra.recs || RECS, dividas: [], faturas: [],
    quitacoes: extra.quit || QUIT, ajustes: extra.ajustes || [], carteiras: [conta],
  });
}
function saldoNoDia(ex, dia) {
  let s = ex.saldoInicial;
  for (const d of ex.dias) if (d.data <= dia) s = d.saldo;
  return s;
}

console.log('── 1. a conta real: R$ 5.217,71 hoje, R$ 15.568,01 no fim do mês ──');
{
  const r = saldoPrevistoDaConta({ hoje: '2026-09-15', conta: 'Inter PJ', wallets: WALLETS, transacoes: TX, recorrencias: RECS, quitacoes: QUIT });
  eq(r.saldoAtual, 5217.71, 'saldo atual é o da conta, não o total (6.294,15)');
  eq(r.saldoPrevisto, 15568.01, '⚠️ previsto = 5.217,71 + 11.900 (Opus) − 1.549,70 (DAS, TIM, INSS)');
  eq(r.ate, '2026-09-30', 'até o último dia do mês');
  eq(r.temEstimativa, false, 'nada variável na Inter PJ');
  const ex = extratoDaAba('2026-09-15', 'Inter PJ');
  eq(ex.dias[0].saldo, 17117.71, 'o Extrato mostra 17.117,71 no dia 15 (como o cliente descreveu)');
}
console.log('  ok');

console.log('── 2. ⚠️ igual ao Extrato em TODO dia do mês ──');
{
  for (let dia = 1; dia <= 30; dia++) {
    const hoje = `2026-09-${String(dia).padStart(2, '0')}`;
    for (const conta of ['Inter PJ', 'BTG Banking (OF)']) {
      const r = saldoPrevistoDaConta({ hoje, conta, wallets: WALLETS, transacoes: TX, recorrencias: RECS, quitacoes: QUIT });
      eq(r.saldoPrevisto, saldoNoDia(extratoDaAba(hoje, conta), ultimoDiaDoMes(hoje)), `${conta} em ${hoje}`);
    }
  }
  // Com ajuste (adiar/pular) e conta variável, que mudam o caminho do motor.
  const ajustes = [
    { recorrenciaId: 'r-das', competencia: '2026-09', status: 'movido', novaData: '2026-10-02' },
    { recorrenciaId: 'r-tim', competencia: '2026-09', status: 'pulado' },
  ];
  const recs = [...RECS, { id: 'r-var', tipo: 'Recebimento', valor: 800, dia_vencimento: 28, valor_variavel: true, carteira: 'Inter PJ', descricao: 'Bico' }];
  for (const hoje of ['2026-09-01', '2026-09-19', '2026-09-20', '2026-09-28', '2026-09-30']) {
    const r = saldoPrevistoDaConta({ hoje, conta: 'Inter PJ', wallets: WALLETS, transacoes: TX, recorrencias: recs, quitacoes: QUIT, ajustes });
    eq(r.saldoPrevisto, saldoNoDia(extratoDaAba(hoje, 'Inter PJ', { recs, ajustes }), ultimoDiaDoMes(hoje)), `com adiar/pular/variável em ${hoje}`);
  }
}
console.log('  ok');

console.log('── 3. o que conta e o que não conta ──');
{
  const btg = saldoPrevistoDaConta({ hoje: '2026-09-15', conta: 'BTG Banking (OF)', wallets: WALLETS, transacoes: TX, recorrencias: RECS, quitacoes: QUIT });
  eq(btg.saldoAtual, 1076.44, 'BTG parte do saldo do BTG');
  eq(btg.saldoPrevisto, -92.46, 'só as linhas do BTG: 1.076,44 − 999 (pendente do dia 25) − 169,90 (internet do dia 20)');
  eq(contaDebitoDoFiltro('todas', WALLETS), null, 'sem filtro de conta → sem saldo da conta');
  eq(contaDebitoDoFiltro('Banco Inter Crédito', WALLETS), null, 'cartão não é conta de débito');
  eq(contaDebitoDoFiltro('Conta Apagada', WALLETS), null, 'conta que não existe');
  eq(contaDebitoDoFiltro('Inter PJ', WALLETS)?.nome, 'Inter PJ', 'conta de débito');
  eq(saldoInicialDaConta(WALLETS, 'Conta Apagada'), 0, 'conta sumida vale 0, nunca o total');
  const pendVencida = saldoPrevistoDaConta({
    hoje: '2026-09-16', conta: 'Inter PJ', wallets: WALLETS, transacoes: TX, recorrencias: [], quitacoes: QUIT,
  });
  eq(pendVencida.saldoPrevisto, 5217.71, 'pendente de ONTEM não entra (o Extrato também não projeta)');
}
console.log('  ok');

console.log('── 4. bordas ──');
{
  eq(ultimoDiaDoMes('2026-09-15'), '2026-09-30', 'setembro');
  eq(ultimoDiaDoMes('2028-02-10'), '2028-02-29', 'fevereiro bissexto');
  eq(ultimoDiaDoMes('2026-02-28'), '2026-02-28', 'fevereiro comum, último dia');
  eq(ultimoDiaDoMes('2026-12-31'), '2026-12-31', 'dezembro não vira janeiro');
  const ultimo = saldoPrevistoDaConta({ hoje: '2026-09-30', conta: 'Inter PJ', wallets: WALLETS, transacoes: TX, recorrencias: RECS, quitacoes: QUIT });
  eq(ultimo.saldoPrevisto, 5217.71, 'no último dia sem nada vencendo, previsto = atual');
  const vazio = saldoPrevistoDaConta({ hoje: '2026-09-15', conta: 'Inter PJ', wallets: WALLETS, transacoes: [], recorrencias: [] });
  eq(vazio.saldoPrevisto, 5217.71, 'mês sem movimento: previsto = atual');
  const pagoHoje = saldoPrevistoDaConta({
    hoje: '2026-09-15', conta: 'Inter PJ', wallets: WALLETS, recorrencias: [],
    transacoes: [{ id: 'x', data: '2026-09-15', tipo: 'Gasto', valor: 100, observacao: 'Café', carteira_nome: 'Inter PJ', pago: true }],
  });
  eq(pagoHoje.saldoPrevisto, 5217.71, 'pago hoje já está no saldo — não desconta de novo');
  const nok = [{ nome: 'Conta NOK', tipo: 'Corrente', saldo: 4090, saldo_brl: 2200.5, moeda: 'NOK' }];
  eq(saldoInicialDaConta(nok, 'Conta NOK'), 2200.5, 'moeda estrangeira parte do saldo em reais');
  eq(saldoInicialDaConta([{ nome: 'Conta NOK', tipo: 'Corrente', saldo: 4090, saldo_brl: null, moeda: 'NOK' }], 'Conta NOK'), 0, 'câmbio que falhou não vira R$ 4.090');
  const variavel = saldoPrevistoDaConta({
    hoje: '2026-09-15', conta: 'Inter PJ', wallets: WALLETS, transacoes: [],
    recorrencias: [{ id: 'v', tipo: 'Gasto', valor: 243, dia_vencimento: 22, valor_variavel: true, carteira: 'Inter PJ', descricao: 'Luz' }],
  });
  eq(variavel.temEstimativa, true, 'conta variável no mês marca o previsto como aproximado');
  eq(variavel.saldoPrevisto, 4974.71, 'e desconta o valor estimado');
}
console.log('  ok');

console.log(`\n${falhas.length ? `${falhas.length} FALHA(S) ❌` : 'tudo passou ✅'}`);
if (falhas.length) { falhas.forEach((f) => console.log('  · ' + f)); process.exit(1); }

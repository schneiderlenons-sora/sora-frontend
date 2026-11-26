// =============================================================================
// EVAL: contas a pagar e a receber do mês (lib/contas-do-mes.ts).
// Rodar:  npm run eval:contas-do-mes
// =============================================================================
import { montarContasDoMes, filtrarContas, totaisContas } from './contas-do-mes.ts';

const falhas = [];
let total = 0;
const eq = (a, b, m) => {
  total++;
  if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     esperado ${JSON.stringify(b)}\n     veio     ${JSON.stringify(a)}`);
};
const ok = (c, m) => eq(!!c, true, m);

const HOJE = '2026-11-26';
const rec = (id, extra) => ({ id, tipo: 'Gasto', valor: 100, dia_vencimento: 10, carteira: 'Itaú', ...extra });
const recorrencias = [
  rec('luz', { descricao: 'Luz', valor: 150, dia_vencimento: 10 }),
  rec('net', { descricao: 'Internet', valor: 100, dia_vencimento: 25 }),
  rec('alu', { descricao: 'Aluguel', valor: 1500, dia_vencimento: 26 }),
  rec('sal', { descricao: 'Salário', tipo: 'Recebimento', valor: 5000, dia_vencimento: 30 }),
  rec('netf', { descricao: 'Netflix', valor: 40, dia_vencimento: 12 }),
  rec('agua', { descricao: 'Água', valor: 80, dia_vencimento: 20 }),
  rec('cond', { descricao: 'Condomínio', valor: 600, dia_vencimento: 15, modo_lancamento: 'prever' }),
];
const quitacoes = [
  { recorrenciaId: 'net', competencia: '2026-11', transacaoId: 'tnet', data: '2026-11-24', valor: 100, pago: true },
  { recorrenciaId: 'cond', competencia: '2026-11', transacaoId: 'tcond', data: '2026-11-15', valor: 600, pago: false },
];
const ajustes = [
  { recorrenciaId: 'netf', competencia: '2026-11', status: 'pulado' },
  { recorrenciaId: 'agua', competencia: '2026-11', status: 'movido', novaData: '2026-11-29' },
];
const transacoes = [
  { id: 'tnet', data: '2026-11-24', tipo: 'Gasto', valor: 100, observacao: 'Internet', carteira_nome: 'Itaú', pago: true, recorrencia_id: 'net', competencia: '2026-11' },
  { id: 'tcond', data: '2026-11-15', tipo: 'Gasto', valor: 600, observacao: 'Condomínio', carteira_nome: 'Itaú', pago: false, recorrencia_id: 'cond', competencia: '2026-11' },
  { id: 'iptu', data: '2026-11-28', tipo: 'Gasto', valor: 300, observacao: 'IPTU', carteira_nome: 'Itaú', pago: false },
  { id: 'freela', data: '2026-11-27', tipo: 'Recebimento', valor: 900, observacao: 'Freela', carteira_nome: 'Itaú', pago: false },
  { id: 'parcCartao', data: '2026-11-28', tipo: 'Gasto', valor: 99, observacao: 'TV 3/10', carteira_nome: 'Nubank Crédito', pago: false },
  { id: 'transf', data: '2026-11-27', tipo: 'Gasto', valor: 500, observacao: 'Pra poupança', carteira_nome: 'Itaú', pago: false, transferencia: true },
  { id: 'ajuste', data: '2026-11-27', tipo: 'Gasto', valor: 10, observacao: 'Ajuste', carteira_nome: 'Itaú', pago: false, categoria: 'Ajuste' },
  { id: 'naocons', data: '2026-11-27', tipo: 'Gasto', valor: 70, observacao: 'Fora', carteira_nome: 'Itaú', pago: false, ignorar_em: 'manual' },
  { id: 'mercado', data: '2026-11-05', tipo: 'Gasto', valor: 230, observacao: 'Mercado', carteira_nome: 'Itaú', pago: true },
  { id: 'cron', data: '2026-11-10', tipo: 'Gasto', valor: 150, observacao: '[Previsto] Luz', carteira_nome: 'Itaú', pago: false },
];
const dividas = [
  { id: 'emp', titulo: 'Empréstimo', valor_parcela: 500, dia_vencimento: 20, parcelas_total: 10, parcelas_pagas: 3, status: 'ativa', ultimo_pagamento: '2026-10-19' },
  { id: 'carro', titulo: 'Carro', valor_parcela: 800, dia_vencimento: 5, parcelas_total: 48, parcelas_pagas: 10, status: 'ativa', ultimo_pagamento: '2026-11-04' },
  { id: 'loja', titulo: 'Loja', valor_parcela: 100, dia_vencimento: 10, parcelas_total: 12, parcelas_pagas: 2, status: 'ativa', ultimo_pagamento: '2026-08-09' },
  { id: 'fora', titulo: 'Fora dos previstos', valor_parcela: 50, dia_vencimento: 28, parcelas_total: 5, parcelas_pagas: 1, status: 'ativa', nos_previstos: false, ultimo_pagamento: '2026-10-27' },
];
const faturas = [
  { cartao_id: 'nu', nome: 'Nubank', competencia: '2026-11', venc: '2026-11-30', restante: 900, pago: 0, fatura: 900 },
  { cartao_id: 'c6', nome: 'C6', competencia: '2026-11', venc: '2026-11-05', restante: 0, pago: 1200, fatura: 1200, quitada: true },
  { cartao_id: 'in', nome: 'Inter', competencia: '2026-12', venc: '2026-12-07', restante: 400, pago: 0 },
];
const anteriores = {
  fixas: [{ recorrenciaId: 'luz', competencia: '2026-10', descricao: 'Luz', valor: 150, tipo: 'Gasto', carteira: 'Itaú', estimado: false, mesesAtras: 1 }],
  faturas: [{ cartao_id: 'bb', nome: 'BB', competencia: '2026-10', venc: '2026-10-15', restante: 300 }],
};

const itens = montarContasDoMes({ mes: '2026-11', hoje: HOJE, transacoes, recorrencias, dividas, quitacoes, ajustes, faturas, cartoes: ['Nubank Crédito'], anteriores });
const por = (desc, status) => itens.filter((i) => i.descricao === desc && (!status || i.status === status));
const resumo = (i) => [i.descricao, i.status, i.data, i.valor];

// 1. contas fixas
eq(por('Luz').map(resumo), [['Luz', 'atrasada', '2026-10-10', 150], ['Luz', 'atrasada', '2026-11-10', 150]], 'Luz: a de outubro (mês anterior) e a de novembro, ambas atrasadas');
eq(por('Luz').map((i) => !!i.deMesAnterior), [true, false], '…a de outubro marcada como de mês anterior');
eq(por('Luz', 'atrasada')[1].diasAtraso, 16, 'dias de atraso');
eq(por('Internet').map(resumo), [['Internet', 'paga', '2026-11-24', 100]], '⚠️ paga antes do vencimento: só em Pagas (nunca "a vencer")');
eq(por('Aluguel').map(resumo), [['Aluguel', 'hoje', '2026-11-26', 1500]], 'vence hoje');
eq(por('Salário').map((i) => [i.tipo, i.status, i.data]), [['receber', 'a_vencer', '2026-11-30']], 'receita fixa: a receber');
eq(por('Netflix').length, 0, 'pulada: some');
eq(por('Água').map((i) => [i.status, i.data, i.adiada]), [['a_vencer', '2026-11-29', true]], 'adiada: na data nova, marcada');
eq(por('Condomínio').map((i) => [i.status, i.origem, i.transacaoId]), [['atrasada', 'fixa', 'tcond']], '⚠️ conta fixa lançada como pendente: UMA linha só (a do lançamento)');

// 2. lançamentos
eq(por('IPTU').map((i) => [i.origem, i.status]), [['avulsa', 'a_vencer']], 'lançamento pendente avulso: a pagar');
eq(por('Freela').map((i) => [i.tipo, i.origem]), [['receber', 'avulsa']], 'entrada pendente: a receber');
for (const fora of ['TV 3/10', 'Pra poupança', 'Ajuste', 'Fora', 'Mercado']) eq(por(fora).length, 0, `⚠️ fica fora: ${fora}`);
eq(itens.filter((i) => /Previsto/.test(i.descricao)).length, 0, '"[Previsto]" do cron não duplica a conta fixa');

// 3. dívidas
eq(por('Empréstimo').map((i) => [i.status, i.data, i.detalhe]), [['atrasada', '2026-11-20', 'parcela 4/10']], 'parcela do mês não paga: atrasada');
eq(por('Carro').map((i) => [i.status, i.data]), [['paga', '2026-11-04']], 'parcela paga adiantada: só em Pagas');
eq(por('Loja').map((i) => [i.status, i.data, i.valor, i.detalhe, !!i.deMesAnterior]),
  [['atrasada', '2026-09-10', 200, '2 parcelas atrasadas', true], ['atrasada', '2026-11-10', 100, 'parcela 3/12', false]],
  '⚠️ parcelas de meses anteriores numa linha só, SEM a do mês (que vem separada)');
eq(por('Fora dos previstos').map((i) => i.status), ['a_vencer'], 'dívida "fora dos previstos" continua sendo conta a pagar');

// 4. faturas
eq(por('Fatura Nubank').map((i) => [i.status, i.valor]), [['a_vencer', 900]], 'fatura aberta do mês');
eq(por('Fatura C6').map((i) => [i.status, i.valor]), [['paga', 1200]], 'fatura paga: em Pagas');
eq(por('Fatura Inter').length, 0, 'fatura de dezembro não entra em novembro');
eq(por('Fatura BB').map((i) => [i.status, i.deMesAnterior]), [['atrasada', true]], 'fatura atrasada de mês anterior');

// 5. nada duplicado, ordem
eq(new Set(itens.map((i) => i.chave)).size, itens.length, 'sem chave repetida');
eq(itens.slice(0, 3).map((i) => i.data), ['2026-09-10', '2026-10-10', '2026-10-15'], 'atrasadas primeiro, da mais antiga');

// 6. filtros e totais
const pagar = filtrarContas(itens, { aba: 'pagar' });
ok(pagar.every((i) => i.tipo === 'pagar' && i.status !== 'paga'), 'aba A pagar: só abertas de pagar');
eq(filtrarContas(itens, { aba: 'pagar', status: 'hoje' }).map((i) => i.descricao), ['Aluguel'], 'filtro Hoje');
eq(filtrarContas(itens, { aba: 'receber' }).map((i) => i.descricao).sort(), ['Freela', 'Salário'], 'aba A receber');
eq(filtrarContas(itens, { aba: 'pagas' }).map((i) => i.descricao).sort(), ['Carro', 'Fatura C6', 'Internet'], 'aba Pagas');
eq(filtrarContas(itens, { aba: 'pagar', busca: 'EMPRESTIMO' }).map((i) => i.descricao), ['Empréstimo'], 'busca sem acento');
eq(filtrarContas(itens, { aba: 'pagar', busca: 'empréstimo' }).map((i) => i.descricao), ['Empréstimo'], 'busca digitada com acento');
// A mesma conta paga em duas vezes (duas baixas na mesma competência): UMA linha paga.
const duasBaixas = montarContasDoMes({ mes: '2026-11', hoje: HOJE, transacoes: [], recorrencias, dividas: [], quitacoes: [
  { recorrenciaId: 'alu', competencia: '2026-11', transacaoId: 'a1', data: '2026-11-05', valor: 700, pago: true },
  { recorrenciaId: 'alu', competencia: '2026-11', transacaoId: 'a2', data: '2026-11-06', valor: 800, pago: true },
], ajustes: [], faturas: [], cartoes: [] });
eq(duasBaixas.filter((i) => i.descricao === 'Aluguel').map((i) => i.status), ['paga'], '⚠️ duas baixas da mesma conta no mês: uma linha paga só');
eq(filtrarContas(itens, { aba: 'pagar', ocultarFaturas: true }).some((i) => i.origem === 'fatura'), false, 'esconder faturas');
const t = totaisContas(itens);
eq(t.aPagar, 150 + 150 + 1500 + 80 + 600 + 300 + 500 + 200 + 100 + 50 + 900 + 300, 'total a pagar (tudo aberto, inclusive atrasadas de antes)');
eq(t.aReceber, 5000 + 900, 'total a receber');
eq(totaisContas(itens, true).aPagar, t.aPagar - 900 - 300, 'esconder faturas tira do total');
eq([t.pago, t.nAtrasadas], [100 + 800 + 1200, 7], 'pago no mês e quantas atrasadas (Luz×2, BB, Loja×2, Condomínio, Empréstimo)');

// 7. mês futuro: sem as de antes; só o que vence nele
const dez = montarContasDoMes({ mes: '2026-12', hoje: HOJE, transacoes: [], recorrencias, dividas, quitacoes: [], ajustes: [], faturas, cartoes: [], anteriores });
eq(dez.some((i) => i.deMesAnterior), false, 'mês futuro não traz as de meses anteriores');
eq(dez.filter((i) => i.descricao === 'Luz').map((i) => [i.status, i.data]), [['a_vencer', '2026-12-10']], 'mês futuro: a conta do mês, a vencer');
eq(dez.filter((i) => i.descricao === 'Fatura Inter').map((i) => i.status), ['a_vencer'], 'fatura do mês futuro, se já existe');
eq(dez.filter((i) => i.descricao === 'Netflix').length, 1, 'o pulo de novembro não vale pra dezembro');

console.log(`${total} verificações · ${falhas.length ? `${falhas.length} FALHAS` : 'todas ok'}`);
if (falhas.length) { for (const f of falhas) console.log('  ✘ ' + f); process.exit(1); }

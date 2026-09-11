// =============================================================================
// EVAL do EXTRATO FUTURO.
//
// A asserção mais importante daqui é a §1: a soma das ocorrências DATADAS de um
// mês tem de bater, no centavo, com o total que `linhasDoMes` devolve pro mesmo
// mês.
//
// POR QUE ELA É A MAIS IMPORTANTE: este projeto já teve CINCO regras de período
// de fatura coexistindo e CINCO cópias do vencimento de dívida. O sintoma nunca
// é um erro na tela — é duas telas mostrando números diferentes pro mesmo dado,
// sem o usuário ter como saber qual está certa. O extrato é uma leitura NOVA
// dos mesmos fatos; no instante em que ele divergir da aba Projeção, a aba
// inteira perde a credibilidade.
//
// Rodar:  npm run eval:extrato-futuro
// =============================================================================
import { montarExtrato } from './extrato-futuro.ts';
import { linhasDoMes } from './previstos.ts';

const falhas = [];
const eq = (a, b, m) => { if (a !== b) falhas.push(`${m} (esperado ${b}, veio ${a})`); };
const perto = (a, b, m, tol = 0.005) => {
  if (Math.abs(a - b) > tol) falhas.push(`${m} (esperado ${b}, veio ${a})`);
};

// ── Cenário base ────────────────────────────────────────────────────────────
const RECS = [
  { id: 'r1', descricao: 'Plano de saúde', tipo: 'Gasto', valor: 1700, dia_vencimento: 10, carteira: 'Inter' },
  { id: 'r2', descricao: 'Salário',        tipo: 'Recebimento', valor: 6200, dia_vencimento: 5, carteira: 'Inter' },
  { id: 'r3', descricao: 'Luz',            tipo: 'Gasto', valor: 200, dia_vencimento: 12, valor_variavel: true, carteira: 'Inter' },
];
const DIVIDAS = [
  { id: 'd1', titulo: 'Carro', valor_parcela: 1836.45, dia_vencimento: 16, parcelas_total: 60, parcelas_pagas: 12, carteira: 'Inter' },
];
const FATURAS = [
  { nome: 'BTG', restante: 1225.55, venc: '2026-09-16', carteira: 'Inter' },
];

const base = {
  de: '2026-09-01', ate: '2026-09-30', saldoInicial: 5000,
  transacoes: [], recorrencias: RECS, dividas: DIVIDAS, faturas: FATURAS,
};

// ── 1. NÃO DIVERGE DE `linhasDoMes` ─────────────────────────────────────────
console.log('── 1. o extrato bate com a aba Projeção ──');
{
  const ex = montarExtrato(base);
  let gasto = 0, receb = 0;
  for (const d of ex.dias) for (const l of d.linhas) {
    if (l.origem === 'transacao') continue;          // §1 compara só as REGRAS
    if (l.tipo === 'Gasto') gasto += l.valor; else receb += l.valor;
  }
  const linhas = linhasDoMes({ ym: '2026-09', k: 0, recorrencias: RECS, dividas: DIVIDAS, faturas: FATURAS });
  const gastoRef = linhas.filter((l) => l.tipo === 'Gasto').reduce((s, l) => s + l.valor, 0);
  const recebRef = linhas.filter((l) => l.tipo === 'Recebimento').reduce((s, l) => s + l.valor, 0);
  perto(gasto, gastoRef, 'total de GASTOS do mês bate com linhasDoMes');
  perto(receb, recebRef, 'total de RECEBIMENTOS do mês bate com linhasDoMes');
}
console.log('  ok');

// ── 2. Saldo acumulado: anterior + entradas − saídas ────────────────────────
console.log('── 2. a aritmética do saldo ──');
{
  const ex = montarExtrato(base);
  let esperado = 5000;
  for (const d of ex.dias) {
    esperado = Math.round((esperado + d.entradas - d.saidas) * 100) / 100;
    perto(d.saldo, esperado, `saldo acumulado em ${d.data}`);
  }
  eq(ex.saldoInicial, 5000, 'saldo inicial preservado');
}
console.log('  ok');

// ── 3. O PIOR DIA é o menor saldo, não o primeiro negativo ──────────────────
//
// ⚠️ Quem tem folga nunca fica negativo e mesmo assim precisa saber onde o
// caixa mais aperta. Um eval que só olhasse "primeiro negativo" deixaria essa
// conta inteira sem resposta.
console.log('── 3. o pior dia ──');
{
  const ex = montarExtrato({ ...base, saldoInicial: 50000 });   // sempre positivo
  const menor = Math.min(...ex.dias.map((d) => d.saldo));
  perto(ex.pior.saldo, menor, 'pior dia é o MENOR saldo mesmo sem ficar negativo');
}
console.log('  ok');

// ── 4. QUITAR cancela a previsão — o caso do cliente ────────────────────────
//
// "Antecipei o plano de saúde e passei a ter valores duplicados."
console.log('── 4. quitação por competência (pagamento adiantado) ──');
{
  const pago = {
    id: 't1', data: '2026-09-08', tipo: 'Gasto', valor: 1700,
    observacao: 'Plano de saúde', carteira_nome: 'Inter', pago: true,
    recorrencia_id: 'r1',
  };
  const ex = montarExtrato({
    ...base,
    transacoes: [pago],
    quitacoes: [{ recorrenciaId: 'r1', competencia: '2026-09' }],
  });
  const todas = ex.dias.flatMap((d) => d.linhas);
  const doPlano = todas.filter((l) => /plano de sa/i.test(l.descricao));
  eq(doPlano.length, 1, 'plano de saúde aparece UMA vez (a real), não duas');
  eq(doPlano[0].estado, 'realizado', 'e a que sobra é a realizada');
  eq(doPlano[0].data, '2026-09-08', 'na data em que foi PAGA, não na do vencimento');
}
console.log('  ok');

// ── 5. Pular e adiar UMA ocorrência, sem matar a regra ──────────────────────
console.log('── 5. pular e adiar ──');
{
  const pulado = montarExtrato({ ...base, ajustes: [{ recorrenciaId: 'r1', competencia: '2026-09', status: 'pulado' }] });
  eq(pulado.dias.flatMap((d) => d.linhas).filter((l) => /plano de sa/i.test(l.descricao)).length, 0,
    'ocorrência pulada some do mês');

  const movido = montarExtrato({
    ...base,
    ajustes: [{ recorrenciaId: 'r1', competencia: '2026-09', status: 'movido', novaData: '2026-09-20', novoValor: 1750 }],
  });
  const l = movido.dias.flatMap((d) => d.linhas).find((x) => /plano de sa/i.test(x.descricao));
  eq(l.data, '2026-09-20', 'ocorrência adiada muda de dia');
  perto(l.valor, 1750, 'e aceita valor diferente');
  eq(l.adiada, true, 'fica marcada como adiada');
}
console.log('  ok');

// ── 6. "[Previsto]" do cron NÃO conta em dobro ──────────────────────────────
//
// ⚠️ Esta é a duplicata de origem. O cron grava a ocorrência como transação
// `pago:false` com o prefixo; nós geramos a MESMA ocorrência a partir da regra.
console.log('── 6. o [Previsto] legado não duplica ──');
{
  const ex = montarExtrato({
    ...base,
    transacoes: [{
      id: 't9', data: '2026-09-10', tipo: 'Gasto', valor: 1700,
      observacao: '[Previsto] Plano de saúde', carteira_nome: 'Inter', pago: false,
    }],
  });
  const doPlano = ex.dias.flatMap((d) => d.linhas).filter((l) => /plano de sa/i.test(l.descricao));
  eq(doPlano.length, 1, 'aparece UMA vez (a gerada pela regra)');
  eq(doPlano[0].origem, 'recorrencia', 'e é a da regra que sobrevive');
}
console.log('  ok');

// ── 7. Transação futura avulsa É previsão (base da Fase 4) ──────────────────
console.log('── 7. previsto avulso ──');
{
  const ex = montarExtrato({
    ...base,
    transacoes: [{
      id: 't5', data: '2026-09-25', tipo: 'Gasto', valor: 900,
      observacao: 'IPVA', carteira_nome: 'Inter', pago: false,
    }],
  });
  const l = ex.dias.flatMap((d) => d.linhas).find((x) => x.descricao === 'IPVA');
  eq(!!l, true, 'transação futura não paga aparece');
  eq(l.estado, 'previsto', 'e como PREVISTO, não realizado');
}
console.log('  ok');

// ── 8. Transferência não entra ──────────────────────────────────────────────
//
// ⚠️ Ela move dinheiro entre contas próprias; somá-la faria o saldo subir ou
// cair sozinho. Mesma regra do `resumoTransacoes` do backend.
console.log('── 8. transferência fora ──');
{
  const ex = montarExtrato({
    ...base,
    transacoes: [{ id: 't6', data: '2026-09-03', tipo: 'Gasto', valor: 3000, observacao: 'Transf', pago: true, transferencia: true, carteira_nome: 'Inter' }],
  });
  eq(ex.dias.flatMap((d) => d.linhas).some((l) => l.descricao === 'Transf'), false, 'transferência não entra no extrato');
}
console.log('  ok');

// ── 9. Dívida ACABA — a projeção não é linha reta ───────────────────────────
console.log('── 9. a parcela termina ──');
{
  const quase = [{ ...DIVIDAS[0], parcelas_total: 13, parcelas_pagas: 12 }];  // resta 1
  const ex = montarExtrato({ ...base, de: '2026-09-01', ate: '2026-12-31', dividas: quase });
  const parcelas = ex.dias.flatMap((d) => d.linhas).filter((l) => l.origem === 'divida');
  eq(parcelas.length, 1, 'só a parcela que resta entra, não uma por mês pra sempre');
}
console.log('  ok');

// ── 10. Saída ANTES de entrada no mesmo dia ─────────────────────────────────
//
// ⚠️ Se a conta vence no mesmo dia do salário, o banco pode cobrar antes de o
// crédito compensar. Ordenar a favor do usuário esconderia o dia do aperto.
console.log('── 10. pior caso no mesmo dia ──');
{
  const ex = montarExtrato({
    ...base,
    recorrencias: [
      { id: 'a', descricao: 'Conta', tipo: 'Gasto', valor: 500, dia_vencimento: 5, carteira: 'Inter' },
      { id: 'b', descricao: 'Salário', tipo: 'Recebimento', valor: 6200, dia_vencimento: 5, carteira: 'Inter' },
    ],
    dividas: [], faturas: [],
  });
  const dia5 = ex.dias.find((d) => d.data === '2026-09-05');
  eq(dia5.linhas[0].tipo, 'Gasto', 'a saída aparece antes da entrada no mesmo dia');
}
console.log('  ok');

// ── 11. Filtro por carteira ─────────────────────────────────────────────────
console.log('── 11. filtro por conta ──');
{
  const ex = montarExtrato({ ...base, carteiras: ['Nubank'] });
  eq(ex.dias.length, 0, 'filtrando por conta sem movimento, o extrato fica vazio');
  const tudo = montarExtrato({ ...base, carteiras: ['Inter'] });
  eq(tudo.dias.length > 0, true, 'e volta a ter linhas na conta certa');
}
console.log('  ok');

// ── 12. Transação JÁ PAGA aparece mas NÃO move o saldo ──────────────────────
//
// ⚠️ ESTA É A DUPLA CONTAGEM SILENCIOSA. `saldoInicial` é o saldo atual das
// contas, que por definição já reflete tudo que foi pago. Somar de novo uma
// transação paga inflaria o extrato inteiro — e o erro não apareceria em
// lugar nenhum, só deixaria todos os números maiores.
//
// Esconder a linha também seria errado: quem acabou de tocar em "Paguei"
// veria a linha sumir sem explicação. Ela fica visível e neutra.
console.log('── 12. transação paga não conta em dobro ──');
{
  const semPaga = montarExtrato({ ...base, recorrencias: [], dividas: [], faturas: [] });
  const comPaga = montarExtrato({
    ...base, recorrencias: [], dividas: [], faturas: [],
    transacoes: [{ id: 'tp', data: '2026-09-04', tipo: 'Gasto', valor: 1225.55, observacao: 'Prestação', carteira_nome: 'Inter', pago: true }],
  });
  const ultimoSem = semPaga.dias.length ? semPaga.dias[semPaga.dias.length - 1].saldo : 5000;
  const ultimoCom = comPaga.dias.length ? comPaga.dias[comPaga.dias.length - 1].saldo : 5000;
  perto(ultimoCom, ultimoSem, 'transação PAGA não altera o saldo projetado');
  const l = comPaga.dias.flatMap((d) => d.linhas).find((x) => x.descricao === 'Prestação');
  eq(!!l, true, 'mas ela CONTINUA visível na lista');
  eq(l.jaNoSaldo, true, 'marcada como já dentro do saldo');

  // E o contraste: a MESMA linha não paga move o saldo.
  const naoPaga = montarExtrato({
    ...base, recorrencias: [], dividas: [], faturas: [],
    transacoes: [{ id: 'tn', data: '2026-09-04', tipo: 'Gasto', valor: 1225.55, observacao: 'Prestação', carteira_nome: 'Inter', pago: false }],
  });
  perto(naoPaga.dias[0].saldo, 5000 - 1225.55, 'a mesma linha NÃO paga move o saldo');
}
console.log('  ok');

// ── 13. O CRON já materializou: não pode contar em dobro ───────────────────
//
// ⚠️ BUG REAL, ACHADO DEPOIS DE IR PRO AR. No modo `lancar` o cron cria a
// transação no dia do vencimento como "[Recorrente] X", JÁ PAGA e SEM
// recorrencia_id (ele é anterior à migration 165). O extrato gerava a previsão
// da mesma ocorrência por cima: medido, R$ 1.700 saíam DUAS vezes do saldo
// projetado no dia do vencimento.
console.log('── 13. a ocorrência que o cron já lançou ──');
{
  const doCron = {
    id: 'tc', data: '2026-09-10', tipo: 'Gasto', valor: 1700,
    observacao: '[Recorrente] Plano de saúde', carteira_nome: 'Inter', pago: true,
  };
  const ex = montarExtrato({ ...base, dividas: [], faturas: [], transacoes: [doCron] });
  const doPlano = ex.dias.flatMap((d) => d.linhas).filter((l) => /plano de sa/i.test(l.descricao));
  eq(doPlano.length, 1, 'aparece UMA vez');
  eq(doPlano[0].origem, 'transacao', 'e é a linha REAL que sobrevive');
  const dia = ex.dias.find((d) => d.data === '2026-09-10');
  perto(dia.saidas, 0, 'não sai nada do saldo — o débito já está no saldo inicial');

  // O mesmo vale pro "[Previsto]" que foi CONFIRMADO: o confirmar REMOVE o
  // prefixo, então sobra só a descrição — aí o valor é que prova.
  const confirmado = { ...doCron, id: 'tk', observacao: 'Plano de saúde' };
  const ex2 = montarExtrato({ ...base, dividas: [], faturas: [], transacoes: [confirmado] });
  eq(ex2.dias.flatMap((d) => d.linhas).filter((l) => /plano de sa/i.test(l.descricao)).length, 1,
    '[Previsto] confirmado (sem prefixo) também não duplica');

  // ⚠️ E o contrário: gasto HOMÔNIMO de outro valor NÃO pode engolir a previsão.
  const homonimo = { ...doCron, id: 'th', observacao: 'Plano de saúde', valor: 35 };
  const ex3 = montarExtrato({ ...base, dividas: [], faturas: [], transacoes: [homonimo] });
  eq(ex3.dias.flatMap((d) => d.linhas).filter((l) => /plano de sa/i.test(l.descricao)).length, 2,
    'gasto de mesmo nome mas OUTRO valor não cancela a previsão');
}
console.log('  ok');

// ── 14. A linha JÁ PAGA fica corrigível ────────────────────────────────────
//
// ⚠️ Sem a anotação, a tela não sabe a qual conta fixa aquele lançamento
// pertence — e "paguei em outro dia" / "ainda não paguei" não teriam o que
// editar. A linha precisa CARREGAR a ocorrência que resolve.
console.log('── 14. a linha paga carrega a ocorrência ──');
{
  // (a) linha do cron, SEM vínculo (o caso das transações anteriores à Fase B)
  const semVinculo = {
    id: 'tv', data: '2026-09-10', tipo: 'Gasto', valor: 1700,
    observacao: '[Recorrente] Plano de saúde', carteira_nome: 'Inter', pago: true,
  };
  const ex = montarExtrato({ ...base, dividas: [], faturas: [], transacoes: [semVinculo] });
  const l = ex.dias.flatMap((d) => d.linhas).find((x) => x.transacaoId === 'tv');
  eq(l.recorrenciaId, 'r1', 'a linha do cron sem vínculo é anotada com a conta fixa');
  eq(l.competencia, '2026-09', 'e com a competência que ela resolve');

  // (b) linha JÁ vinculada: o vínculo real manda, não o texto
  const comVinculo = { ...semVinculo, id: 'tw', observacao: 'qualquer coisa', recorrencia_id: 'rZ' };
  const ex2 = montarExtrato({ ...base, dividas: [], faturas: [], transacoes: [comVinculo] });
  eq(ex2.dias.flatMap((d) => d.linhas).find((x) => x.transacaoId === 'tw').recorrenciaId, 'rZ',
    'o vínculo gravado vence o casamento por texto');

  // (c) ⚠️ gasto AVULSO não pode ser anotado — senão a tela ofereceria
  //     "ainda não paguei" pra algo que não é conta fixa nenhuma.
  const avulso = { id: 'tx', data: '2026-09-10', tipo: 'Gasto', valor: 90,
                   observacao: 'Padaria', carteira_nome: 'Inter', pago: true };
  const ex3 = montarExtrato({ ...base, dividas: [], faturas: [], transacoes: [avulso] });
  eq(!!ex3.dias.flatMap((d) => d.linhas).find((x) => x.transacaoId === 'tx').recorrenciaId, false,
    'gasto avulso NÃO é anotado');

  // (d) ⚠️ homônimo de OUTRO valor também não — mesma prova da §13.
  const homonimo = { id: 'ty', data: '2026-09-10', tipo: 'Gasto', valor: 35,
                     observacao: 'Plano de saúde', carteira_nome: 'Inter', pago: true };
  const ex4 = montarExtrato({ ...base, dividas: [], faturas: [], transacoes: [homonimo] });
  eq(!!ex4.dias.flatMap((d) => d.linhas).find((x) => x.transacaoId === 'ty').recorrenciaId, false,
    'mesmo nome mas outro valor NÃO é anotado');
}
console.log('  ok');

// ── Resultado ───────────────────────────────────────────────────────────────
if (falhas.length) {
  console.error(`\n❌ ${falhas.length} falha(s):`);
  for (const f of falhas) console.error('  - ' + f);
  process.exit(1);
}
console.log('\n✅ todos os casos passaram');

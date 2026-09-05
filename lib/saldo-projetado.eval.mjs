// =============================================================================
// EVAL do SALDO PROJETADO.
//
// É dinheiro na tela do cliente: errar aqui não estoura em lugar nenhum, só
// mostra um número plausível e errado que ele usa pra decidir se pode gastar.
//
// Os dois erros fáceis, ambos travados abaixo:
//   · contar DUAS VEZES o que já saiu (a conta do dia 5, quando hoje é 14, já
//     está dentro do saldo da carteira);
//   · somar o saldo do CARTÃO ao caixa (o saldo de crédito é a fatura, não
//     dinheiro disponível).
//
// Rodar:  npm run eval:saldo-projetado
// =============================================================================
import {
  calcularSaldoProjetado, diaHojeSP, itemPrevistoDe, vezesQueAindaVem,
} from './saldo-projetado.ts';

const falhas = [];
const ok = (c, m) => { if (!c) falhas.push(m); };
const eq = (a, b, m) => ok(a === b, `${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`);

// Data fixa pra o eval não mudar de resultado conforme o dia em que roda.
// 14/08/2026, meio-dia UTC → dia 14 em São Paulo.
const DIA14 = new Date('2026-08-14T12:00:00Z');

const g = (valor, dia, extra = {}) => ({ tipo: 'Gasto', valor, dia_vencimento: dia, ...extra });
const r = (valor, dia, extra = {}) => ({ tipo: 'Recebimento', valor, dia_vencimento: dia, ...extra });

// ── 1. A fórmula do cliente ─────────────────────────────────────────────
console.log('── 1. saldo + a receber − a pagar ──');
{
  const res = calcularSaldoProjetado(
    [{ tipo: 'Corrente', saldo: 1000 }],
    [r(3000, 20), g(1200, 25)],
    [], DIA14,
  );
  eq(res.saldoHoje, 1000, 'saldo de hoje');
  eq(res.aReceber, 3000, 'a receber');
  eq(res.aPagar, 1200, 'a pagar');
  eq(res.projetado, 2800, '1000 + 3000 − 1200');
  eq(res.aproximado, false, 'sem variável → número exato');
}
console.log('  ok');

// ── 2. ⚠️ O que já venceu NÃO conta de novo ─────────────────────────────
// A conta do dia 5, com hoje sendo 14, já foi lançada e já saiu da carteira.
console.log('── 2. não conta duas vezes ──');
{
  const res = calcularSaldoProjetado(
    [{ tipo: 'Corrente', saldo: 1000 }],
    [g(500, 5), g(300, 20)],   // dia 5 já passou · dia 20 ainda vem
    [], DIA14,
  );
  eq(res.aPagar, 300, 'só a despesa que ainda não venceu');
  eq(res.projetado, 700, '1000 − 300 (a de 500 já está no saldo)');
  eq(res.itens, 1, 'só 1 item entrou na projeção');

  // Vencimento HOJE ainda conta — o dia não acabou.
  const hoje = calcularSaldoProjetado([{ tipo: 'Corrente', saldo: 100 }], [g(40, 14)], [], DIA14);
  eq(hoje.aPagar, 40, 'vencimento no dia de hoje ainda entra');
}
console.log('  ok');

// ── 3. ⚠️ Cartão de crédito fica FORA do saldo de hoje ──────────────────
console.log('── 3. cartão não é caixa ──');
{
  const res = calcularSaldoProjetado(
    [
      { tipo: 'Corrente', saldo: 2000 },
      { tipo: 'Crédito',  saldo: -1500 },   // fatura, não dinheiro
      { tipo: 'Poupança', saldo: 500 },
    ],
    [], [], DIA14,
  );
  eq(res.saldoHoje, 2500, 'corrente + poupança, sem o cartão');
  ok(res.saldoHoje !== 1000, 'o −1500 do cartão NÃO pode ser somado ao caixa');
}
console.log('  ok');

// ── 4. Dívidas entram como despesa ──────────────────────────────────────
console.log('── 4. parcela de dívida ──');
{
  const res = calcularSaldoProjetado(
    [{ tipo: 'Corrente', saldo: 1000 }],
    [g(200, 20)],
    [g(629.51, 22)],   // parcela do mês de uma dívida
    DIA14,
  );
  eq(res.aPagar, 829.51, 'recorrência + parcela');
  eq(res.projetado, 170.49, '1000 − 829,51');
}
console.log('  ok');

// ── 5. Variável marca o total como aproximado ───────────────────────────
console.log('── 5. conta de valor variável ──');
{
  const res = calcularSaldoProjetado(
    [{ tipo: 'Corrente', saldo: 500 }],
    [g(0, 25, { valor_variavel: true })],   // luz, sem valor definido ainda
    [], DIA14,
  );
  eq(res.aproximado, true, 'variável → o número é estimativa');
  eq(res.aPagar, 0, 'sem valor conhecido soma 0, não inventa');
}
console.log('  ok');

// ── 6. Bordas ───────────────────────────────────────────────────────────
console.log('── 6. bordas ──');
{
  const vazio = calcularSaldoProjetado([], [], [], DIA14);
  eq(vazio.projetado, 0, 'sem nada = 0');
  eq(vazio.itens, 0, 'nenhum item');

  // Saldo negativo continua negativo — não zera nem esconde.
  const neg = calcularSaldoProjetado([{ tipo: 'Corrente', saldo: -200 }], [g(100, 20)], [], DIA14);
  eq(neg.projetado, -300, 'projeção pode ficar negativa (é o aviso que importa)');

  // Sem dia de vencimento → conta como "ainda vem" (lado conservador).
  const semDia = calcularSaldoProjetado(
    [{ tipo: 'Corrente', saldo: 100 }],
    [{ tipo: 'Gasto', valor: 30, dia_vencimento: 0 }], [], DIA14);
  eq(semDia.aPagar, 30, 'sem dia definido, assume que ainda vai sair');

  // Centavos não podem acumular erro de ponto flutuante.
  const cent = calcularSaldoProjetado(
    [{ tipo: 'Corrente', saldo: 0.1 }],
    [r(0.2, 20)], [], DIA14);
  eq(cent.projetado, 0.3, '0.1 + 0.2 = 0.3 (não 0.30000000000000004)');

  eq(typeof diaHojeSP(DIA14), 'number', 'diaHojeSP devolve número');
  eq(diaHojeSP(DIA14), 14, 'dia de SP a partir de um instante UTC');
  // 14/08 às 02:00 UTC = 13/08 às 23:00 em SP — o fuso tem de mandar.
  eq(diaHojeSP(new Date('2026-08-14T02:00:00Z')), 13, '⚠️ madrugada UTC ainda é o dia anterior em SP');
}
console.log('  ok');

// ── Resultado ───────────────────────────────────────────────────────────
console.log('');
// ── 7. VENCIMENTO COM MÊS (fatura do cartão) ────────────────────────────
//
// ⚠️ Recorrência é mensal e o DIA basta: "dia 20" é sempre 20 deste mês. A
// fatura não — o ciclo cruza meses e ela pode vencer no mês que vem. Reduzida
// ao dia, uma fatura que vence 13/09 virava "13" e, com hoje = 19, era lida
// como JÁ VENCIDA: sumia do "ainda sai" e da projeção estando a 25 dias de ser
// paga. Foi o relato: "não deveria estar somando a fatura junto? Pois ainda
// terei que pagar ela".
console.log('── 7. vencimento com mês (fatura) ──');
{
  const AGORA = new Date('2026-08-19T12:00:00Z');
  const contas = [{ tipo: 'Corrente', saldo: 2000 }];

  // A fatura do caso real: R$ 1.596,17 vencendo 13/09.
  const futura = calcularSaldoProjetado(contas,
    [{ tipo: 'Gasto', valor: 1596.17, dia_vencimento: 13, venc: '2026-09-13' }], [], AGORA);
  eq(futura.aPagar, 1596.17, 'fatura que vence 13/09 AINDA SAI (hoje é 19/08)');
  eq(futura.projetado, 403.83, 'e entra na sobra do mês');

  // A mesma fatura, mas vencendo dia 13 DESTE mês: aí já passou mesmo.
  const passada = calcularSaldoProjetado(contas,
    [{ tipo: 'Gasto', valor: 1596.17, dia_vencimento: 13, venc: '2026-08-13' }], [], AGORA);
  eq(passada.aPagar, 0, 'a mesma fatura vencida em 13/08 não conta de novo');
  eq(passada.projetado, 2000, 'ela já está dentro do saldo de hoje');

  // Vencendo HOJE ainda conta (o dinheiro não saiu).
  const hoje = calcularSaldoProjetado(contas,
    [{ tipo: 'Gasto', valor: 100, dia_vencimento: 19, venc: '2026-08-19' }], [], AGORA);
  eq(hoje.aPagar, 100, 'vence hoje ainda sai');

  // Sem `venc`, o dia solto continua mandando — recorrência não regride.
  const rec = calcularSaldoProjetado(contas,
    [{ tipo: 'Gasto', valor: 550, dia_vencimento: 24 }], [], AGORA);
  eq(rec.aPagar, 550, 'recorrência sem venc segue pela regra do dia');
  const recPassada = calcularSaldoProjetado(contas,
    [{ tipo: 'Gasto', valor: 550, dia_vencimento: 5 }], [], AGORA);
  eq(recPassada.aPagar, 0, 'e a que já passou continua fora');
}
console.log('  ok');

// ── 8. FREQUÊNCIA (migration 157) ──────────────────────────────────────────
//
// ⚠️ "Ainda vem?" deixou de ser sim/não. A conta ANUAL pode não cair neste
// mês nenhuma vez (e antes era cobrada em todos), e a SEMANAL cai várias
// vezes até o fim dele (e antes contava uma). Os dois erros são silenciosos.
console.log('── 8. frequência ──');
{
  // Terça, 15 de setembro de 2026.
  const AGORA = new Date('2026-09-15T12:00:00-03:00');
  const contas = [{ tipo: 'Conta', saldo: 1000 }];

  // ANUAL em março: não sai nada em setembro.
  const anual = calcularSaldoProjetado(contas, [{
    tipo: 'Gasto', valor: 1200, dia_vencimento: 10, frequencia: 'anual', mes_vencimento: 3,
  }], [], AGORA);
  eq(anual.aPagar, 0, 'conta anual de março não entra no setembro');

  // ANUAL neste mês, dia ainda por vir.
  const anualAgora = calcularSaldoProjetado(contas, [{
    tipo: 'Gasto', valor: 1200, dia_vencimento: 20, frequencia: 'anual', mes_vencimento: 9,
  }], [], AGORA);
  eq(anualAgora.aPagar, 1200, 'e entra UMA vez no mês dela');

  // SEMANAL às terças: de 15/09 (terça, hoje) até o fim do mês são 15, 22 e 29.
  const semanal = calcularSaldoProjetado(contas, [{
    tipo: 'Gasto', valor: 100, dia_vencimento: 0, frequencia: 'semanal', dia_semana: 2,
  }], [], AGORA);
  eq(semanal.aPagar, 300, 'semanal conta as 3 terças que faltam, não 1');

  // DURAÇÃO: acabada, some.
  const acabou = calcularSaldoProjetado(contas, [{
    tipo: 'Gasto', valor: 100, dia_vencimento: 0, frequencia: 'semanal', dia_semana: 2,
    data_fim: '2026-09-16',
  }], [], AGORA);
  eq(acabou.aPagar, 100, 'com data_fim em 16/09, só a terça de hoje conta');

  // ⚠️ REGRESSÃO ZERO: sem os campos novos, tudo como antes.
  const legado = calcularSaldoProjetado(contas, [
    { tipo: 'Gasto', valor: 550, dia_vencimento: 20 },
    { tipo: 'Gasto', valor: 300, dia_vencimento: 5 },
  ], [], AGORA);
  eq(legado.aPagar, 550, 'sem frequência: a do dia 20 vem, a do dia 5 já passou');

  // ⚠️ `frequencia: mensal` EXPLÍCITO tem de dar o mesmo — é o que o backend
  //    passa a devolver pra TODA recorrência que já existe.
  const mensalExplicito = calcularSaldoProjetado(contas, [
    { tipo: 'Gasto', valor: 550, dia_vencimento: 20, frequencia: 'mensal' },
    { tipo: 'Gasto', valor: 300, dia_vencimento: 5, frequencia: 'mensal' },
  ], [], AGORA);
  eq(mensalExplicito.aPagar, 550, 'mensal explícito = mesmo resultado');

  // O mapper não pode perder campo pelo caminho.
  const item = itemPrevistoDe({
    tipo: 'Gasto', valor: 100, dia_vencimento: 0, frequencia: 'semanal', dia_semana: 2,
  });
  eq(item.frequencia, 'semanal', 'itemPrevistoDe preserva a frequência');
  eq(item.dia_semana, 2, 'e o dia da semana');
  eq(vezesQueAindaVem(item, AGORA), 3, 'e a contagem bate com a soma');
}
console.log('  ok');

if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('✓ saldo projetado: todos os casos passaram');

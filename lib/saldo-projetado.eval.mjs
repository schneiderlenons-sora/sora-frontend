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
import { calcularSaldoProjetado, diaHojeSP } from './saldo-projetado.ts';

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
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('✓ saldo projetado: todos os casos passaram');

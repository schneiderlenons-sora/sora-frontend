// =============================================================================
// EVAL da projeção de meses (aba Previstos).
//
// Isto decide número de dinheiro numa tela que a pessoa usa pra responder
// "posso assumir esse gasto?". Erro aqui não estoura: vira número plausível e
// errado.
//
// Rodar:  npm run eval:previstos
// =============================================================================
import {
  projetarMeses, somarMeses, distanciaMeses, primeiroMesNoVermelho,
} from './previstos.ts';

const falhas = [];
const eq = (a, b, msg) => {
  if (a === b) return;
  falhas.push(`${msg}\n      esperado: ${JSON.stringify(b)}\n      recebido: ${JSON.stringify(a)}`);
};

// ── 1. Aritmética de mês ─────────────────────────────────────────────────────
console.log('── 1. soma e distância de meses ──');
eq(somarMeses('2026-09', 1), '2026-10', 'setembro + 1');
eq(somarMeses('2026-12', 1), '2027-01', 'vira o ano');
eq(somarMeses('2026-01', -1), '2025-12', 'volta o ano');
eq(somarMeses('2026-09', 6), '2027-03', 'seis meses à frente');
eq(distanciaMeses('2026-09', '2027-03'), 6, 'distância atravessa o ano');
eq(distanciaMeses('2026-09', '2026-08'), -1, 'distância negativa');
console.log('  ok');

// ── 2. A DÍVIDA ACABA — o caso que faz a projeção não ser uma linha reta ─────
//
// ⚠️ É o motivo de a aba existir. Uma projeção que repete o mesmo mês seis
// vezes não informa nada; o que muda decisão é "em dezembro a parcela acaba".
console.log('── 2. parcela que acaba ──');
{
  const meses = projetarMeses({
    inicio: '2026-09',
    quantidade: 6,
    saldoInicial: 1000,
    recorrencias: [{ tipo: 'Recebimento', valor: 3000 }, { tipo: 'Gasto', valor: 500 }],
    // 3 parcelas restantes: entra em set, out, nov — e some em dezembro.
    dividas: [{ titulo: 'Sofá', valor_parcela: 200, parcelas_total: 10, parcelas_pagas: 7 }],
    faturas: [],
  });

  eq(meses[0].despesaFirme, 700, 'set: 500 fixo + 200 de parcela');
  eq(meses[2].despesaFirme, 700, 'nov: última parcela ainda entra');
  eq(meses[3].despesaFirme, 500, 'dez: a parcela ACABOU');
  eq(meses[3].eventos.length, 1, 'dez ganha o evento do fim da parcela');
  eq(meses[3].eventos[0].efeito, 200, 'e ele diz quanto sobra a mais');
  eq(meses[3].eventos[0].texto, 'Sofá acaba', 'com o nome da dívida');
  eq(meses[4].eventos.length, 0, 'o evento aparece UMA vez, não todo mês');
}
console.log('  ok');

// ── 3. Comprometido × estimado nunca se misturam ────────────────────────────
//
// ⚠️ Somar os dois transformaria "a luz costuma vir uns R$ 200" em "você VAI
// pagar R$ 200" — e é sobre esse número que a pessoa decide uma compra.
console.log('── 3. firme × estimado ──');
{
  const [m] = projetarMeses({
    inicio: '2026-09',
    quantidade: 1,
    saldoInicial: 0,
    recorrencias: [
      { tipo: 'Gasto', valor: 100 },                          // aluguel: firme
      { tipo: 'Gasto', valor: 200, valor_variavel: true },     // luz: estimado
      { tipo: 'Recebimento', valor: 3000 },
      { tipo: 'Recebimento', valor: 500, valor_variavel: true },
    ],
    dividas: [], faturas: [],
  });
  eq(m.despesaFirme, 100, 'só o fixo é firme');
  eq(m.despesaEstimada, 200, 'o variável fica separado');
  eq(m.receitaFirme, 3000, 'receita fixa é firme');
  eq(m.receitaEstimada, 500, 'receita variável é estimada');
  eq(m.aproximado, true, 'e o mês inteiro é marcado como aproximado');
  eq(m.resultado, 3200, 'o resultado soma os quatro');
}
console.log('  ok');

// ── 4. `nao_lancar` CONTA na projeção ───────────────────────────────────────
//
// ⚠️ O modo diz se a SORA cria a transação, não se o dinheiro sai. Quem usa
// Open Finance põe quase tudo em "não lançar" (o banco traz a cobrança real):
// ignorá-los aqui esvaziaria a projeção justamente de quem mais tem dado.
console.log('── 4. modo de lançamento não filtra ──');
{
  const [m] = projetarMeses({
    inicio: '2026-09', quantidade: 1, saldoInicial: 0,
    recorrencias: [
      { tipo: 'Gasto', valor: 113.5, modo_lancamento: 'nao_lancar' },
      { tipo: 'Gasto', valor: 27.49, modo_lancamento: 'prever' },
      { tipo: 'Gasto', valor: 70, modo_lancamento: 'lancar' },
    ],
    dividas: [], faturas: [],
  });
  eq(m.despesaFirme, 210.99, 'os três modos contam igual');
}
console.log('  ok');

// ── 5. Mês 0 usa o REALIZADO, não a projeção ────────────────────────────────
console.log('── 5. mês corrente é realidade ──');
{
  const meses = projetarMeses({
    inicio: '2026-09', quantidade: 2, saldoInicial: 500,
    recorrencias: [{ tipo: 'Gasto', valor: 100 }, { tipo: 'Recebimento', valor: 1000 }],
    dividas: [], faturas: [],
    realizado: { receitas: 0, gastos: 23.8 },
  });
  eq(meses[0].receitaFirme, 0, 'mês 0: nada entrou ainda, e é isso que aparece');
  eq(meses[0].despesaFirme, 23.8, 'mês 0: só o que saiu de fato');
  eq(meses[1].receitaFirme, 1000, 'mês 1 já é projeção normal');
  eq(meses[1].despesaFirme, 100, 'idem despesa');
}
console.log('  ok');

// ── 6. Fatura entra SÓ no mês dela ──────────────────────────────────────────
//
// ⚠️ Projetar fatura pra frente seria inventar: ela depende de compras que
// ainda não aconteceram.
console.log('── 6. fatura não se repete ──');
{
  const meses = projetarMeses({
    inicio: '2026-09', quantidade: 3, saldoInicial: 0,
    recorrencias: [], dividas: [],
    faturas: [{ nome: 'Nubank', restante: 908.31, venc: '2026-09-13' }],
  });
  eq(meses[0].despesaFirme, 908.31, 'setembro tem a fatura');
  eq(meses[1].despesaFirme, 0, 'outubro NÃO repete');
  eq(meses[2].despesaFirme, 0, 'novembro também não');
  eq(meses[0].eventos[0].tipo, 'fatura', 'e o mês da fatura ganha o evento');
}
console.log('  ok');

// ── 7. Saldo acumulado e o alerta de vermelho ───────────────────────────────
console.log('── 7. saldo acumulado ──');
{
  const meses = projetarMeses({
    inicio: '2026-09', quantidade: 4, saldoInicial: 300,
    recorrencias: [{ tipo: 'Gasto', valor: 200 }],
    dividas: [], faturas: [],
  });
  eq(meses[0].saldoAcumulado, 100, '300 − 200');
  eq(meses[1].saldoAcumulado, -100, 'e fura no segundo mês');
  const vermelho = primeiroMesNoVermelho(meses);
  eq(vermelho?.ym, '2026-10', 'o alerta aponta o PRIMEIRO mês negativo');
}
{
  const meses = projetarMeses({
    inicio: '2026-09', quantidade: 4, saldoInicial: 5000,
    recorrencias: [{ tipo: 'Recebimento', valor: 100 }],
    dividas: [], faturas: [],
  });
  eq(primeiroMesNoVermelho(meses), null, 'sem furo, sem alerta — não avisa sempre');
}
console.log('  ok');

// ── 8. Dívida sem número de parcelas é infinita ─────────────────────────────
//
// Financiamento sem `parcelas_total` não pode "acabar" por adivinhação.
console.log('── 8. parcela sem total ──');
{
  const meses = projetarMeses({
    inicio: '2026-09', quantidade: 6, saldoInicial: 0,
    recorrencias: [], faturas: [],
    dividas: [{ titulo: 'Financiamento', valor_parcela: 900 }],
  });
  eq(meses[5].despesaFirme, 900, 'segue nos 6 meses');
  eq(meses.some((m) => m.eventos.length > 0), false, 'e nunca inventa um fim');
}
console.log('  ok');

// ── 9. `nos_previstos: false` e dívida quitada ficam de fora ────────────────
console.log('── 9. exclusões respeitadas ──');
{
  const [m] = projetarMeses({
    inicio: '2026-09', quantidade: 1, saldoInicial: 0,
    recorrencias: [], faturas: [{ restante: 500, venc: '2026-09-10', nos_previstos: false }],
    dividas: [
      { valor_parcela: 100, nos_previstos: false },
      { valor_parcela: 200, status: 'quitada' },
      { valor_parcela: 50 },
    ],
  });
  eq(m.despesaFirme, 50, 'só a dívida que não foi excluída nem quitada');
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('✓ projeção de previstos: todos os casos passaram');

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
  projetarMeses, somarMeses, distanciaMeses, primeiroMesNoVermelho, linhasDoMes,
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

// ── 10. FREQUÊNCIA E DURAÇÃO (migration 157) ───────────────────────────────
//
// ⚠️ Até a 157 toda recorrência era mensal e a projeção multiplicava por 1
// sem dizer que multiplicava. Com semanal e anual no ar, esse 1 implícito
// mente NOS DOIS SENTIDOS: o IPVA seria cobrado em todo mês da janela e a
// diarista uma vez em vez de quatro. Nenhum dos dois estoura — viram um
// número plausível e errado no card que a pessoa usa pra decidir.
console.log('── 10. frequência e duração ──');
{
  // ANUAL: só no mês dele.
  const anual = projetarMeses({
    inicio: '2026-09',
    quantidade: 6,
    saldoInicial: 0,
    recorrencias: [{
      tipo: 'Gasto', valor: 1200, frequencia: 'anual', mes_vencimento: 1, dia_vencimento: 10,
    }],
    dividas: [], faturas: [],
  });
  eq(anual[0].despesaFirme, 0, 'set: o IPVA de janeiro NÃO entra');
  eq(anual[3].despesaFirme, 0, 'dez: também não');
  eq(anual[4].despesaFirme, 1200, 'jan: entra, uma vez');
  eq(anual[5].despesaFirme, 0, 'fev: já passou');

  // SEMANAL: uma vez por semana. Setembro de 2026 tem 4 terças (1, 8, 15, 22,
  // 29) — cinco, na verdade, e é justo esse mês de 5 ocorrências que um
  // multiplicador fixo de 4 erraria.
  const semanal = projetarMeses({
    inicio: '2026-09',
    quantidade: 2,
    saldoInicial: 0,
    recorrencias: [{ tipo: 'Gasto', valor: 100, frequencia: 'semanal', dia_semana: 2 }],
    dividas: [], faturas: [],
  });
  eq(semanal[0].despesaFirme, 500, 'setembro/26 tem 5 terças');
  eq(semanal[1].despesaFirme, 400, 'outubro/26 tem 4');

  // DURAÇÃO: `data_fim` corta, e o mês seguinte ganha o aviso.
  const comFim = projetarMeses({
    inicio: '2026-09',
    quantidade: 5,
    saldoInicial: 0,
    recorrencias: [{
      tipo: 'Gasto', valor: 300, dia_vencimento: 10, descricao: 'Curso',
      data_inicio: '2026-09-01', data_fim: '2026-11-10',
    }],
    dividas: [], faturas: [],
  });
  eq(comFim[0].despesaFirme, 300, 'set entra');
  eq(comFim[2].despesaFirme, 300, 'nov é o último');
  eq(comFim[3].despesaFirme, 0,   'dez: acabou');
  eq(comFim[3].eventos.length, 1, 'e dez avisa que acabou');
  eq(comFim[3].eventos[0].efeito, 300, 'dizendo quanto sobra a mais');
  eq(comFim[4].eventos.length, 0, 'o aviso sai UMA vez, não todo mês');

  // ⚠️ REGRESSÃO ZERO: sem nenhum campo da 157, a projeção é a de sempre.
  const legado = projetarMeses({
    inicio: '2026-09',
    quantidade: 3,
    saldoInicial: 0,
    recorrencias: [{ tipo: 'Gasto', valor: 250 }, { tipo: 'Recebimento', valor: 4000 }],
    dividas: [], faturas: [],
  });
  eq(legado[1].despesaFirme, 250, 'recorrência sem frequência conta 1x por mês');
  eq(legado[1].receitaFirme, 4000, 'idem receita');
  // ⚠️ E com `dia_vencimento` mas sem `frequencia` também — é o formato exato
  //    das 324 linhas que já existem no banco.
  const legado2 = projetarMeses({
    inicio: '2026-09',
    quantidade: 3,
    saldoInicial: 0,
    recorrencias: [{ tipo: 'Gasto', valor: 250, dia_vencimento: 31 }],
    dividas: [], faturas: [],
  });
  eq(legado2[0].despesaFirme, 250, 'dia 31 conta 1x em setembro (que tem 30)');
  eq(legado2[1].despesaFirme, 250, 'e 1x em outubro');
}
console.log('  ok');

// ── 11. O CARD E O GRÁFICO SOMAM O MESMO ────────────────────────────────────
//
// ⚠️ ESTE É O TESTE QUE IMPEDE O PIOR DEFEITO DESTA ABA: a tela listar linha a
// linha o que compõe um mês e a barra do gráfico ser desenhada em outro valor.
// Quem lê não tem como saber qual dos dois está certo. `projetarMeses` soma de
// `linhasDoMes`; a tela agrupa de `linhasDoMes`. O eval prova que a soma das
// linhas é EXATAMENTE o total do mês, em cenários com as quatro origens juntas.
console.log('── 11. linhas × totais do mês ──');
{
  const recorrencias = [
    { tipo: 'Gasto', valor: 1200, dia_vencimento: 5, descricao: 'Aluguel' },
    { tipo: 'Gasto', valor: 180, dia_vencimento: 12, descricao: 'Luz', valor_variavel: true },
    { tipo: 'Gasto', valor: 100, frequencia: 'semanal', dia_semana: 2, descricao: 'Diarista' },
    { tipo: 'Gasto', valor: 1400, frequencia: 'anual', mes_vencimento: 1, dia_vencimento: 10, descricao: 'IPVA' },
    { tipo: 'Gasto', valor: 90, dia_vencimento: 20, descricao: 'Curso', data_inicio: '2026-09-01', data_fim: '2026-11-20' },
    { tipo: 'Recebimento', valor: 4200, dia_vencimento: 5, descricao: 'Salário' },
    { tipo: 'Recebimento', valor: 600, dia_vencimento: 25, descricao: 'Freela', valor_variavel: true },
  ];
  const dividas = [
    { titulo: 'Sofá', valor_parcela: 200, parcelas_total: 10, parcelas_pagas: 7 },
    { titulo: 'Carro', valor_parcela: 890, parcelas_total: 48, parcelas_pagas: 3 },
    { titulo: 'Fora', valor_parcela: 50, parcelas_total: 5, parcelas_pagas: 0, nos_previstos: false },
  ];
  const faturas = [
    { cartao_id: 'c1', nome: 'Nubank', restante: 970.13, venc: '2026-09-10' },
    { cartao_id: 'c2', nome: 'Inter', restante: 300, venc: '2026-11-15' },
    { cartao_id: 'c3', nome: 'Fora', restante: 800, venc: '2026-09-20', nos_previstos: false },
  ];

  const meses = projetarMeses({
    inicio: '2026-09', quantidade: 6, saldoInicial: 0,
    recorrencias, dividas, faturas,
  });

  let conferidos = 0;
  meses.forEach((m, k) => {
    const linhas = linhasDoMes({ ym: m.ym, k, recorrencias, dividas, faturas });
    const soma = (f) => Math.round(linhas.filter(f).reduce((s, l) => s + l.valor, 0) * 100) / 100;

    eq(soma((l) => l.tipo === 'Gasto'), Math.round((m.despesaFirme + m.despesaEstimada) * 100) / 100,
      `${m.ym}: a soma das linhas de saída é o total de despesas do mês`);
    eq(soma((l) => l.tipo === 'Recebimento'), Math.round((m.receitaFirme + m.receitaEstimada) * 100) / 100,
      `${m.ym}: idem entradas`);

    // E o detalhe por origem tem de fechar com as linhas daquela origem —
    // é ele que a tela abre embaixo de "Despesas".
    eq(soma((l) => l.origem === 'recorrencia' && l.tipo === 'Gasto'), m.detalhe.contasFixas,
      `${m.ym}: detalhe.contasFixas`);
    eq(soma((l) => l.origem === 'divida'), m.detalhe.parcelas, `${m.ym}: detalhe.parcelas`);
    eq(soma((l) => l.origem === 'fatura'), m.detalhe.faturas, `${m.ym}: detalhe.faturas`);
    eq(soma((l) => l.origem === 'recorrencia' && l.tipo === 'Recebimento'), m.detalhe.receitasFixas,
      `${m.ym}: detalhe.receitasFixas`);
    conferidos += 1;
  });
  eq(conferidos, 6, 'seis meses conferidos');

  // ⚠️ As exclusões valem nas linhas também — senão a tela LISTA o que a
  // projeção não conta, e o card fica maior que o gráfico.
  const l0 = linhasDoMes({ ym: '2026-09', k: 0, recorrencias, dividas, faturas });
  eq(l0.some((l) => l.ref.titulo === 'Fora'), false, 'dívida fora da previsão não vira linha');
  eq(l0.some((l) => l.ref.nome === 'Fora'), false, 'cartão fora da previsão não vira linha');
  // Fatura só no mês dela.
  eq(l0.filter((l) => l.origem === 'fatura').length, 1, 'só a fatura que vence em setembro');
  eq(linhasDoMes({ ym: '2026-11', k: 2, recorrencias, dividas, faturas })
    .filter((l) => l.origem === 'fatura').length, 1, 'e a de novembro no mês dela');
  // A parcela do sofá acaba: 3 restantes → entra em k 0,1,2 e some em k 3.
  eq(linhasDoMes({ ym: '2026-12', k: 3, recorrencias, dividas, faturas })
    .some((l) => l.ref.titulo === 'Sofá'), false, 'parcela acabada não vira linha');
  // O curso tem data_fim em novembro.
  eq(linhasDoMes({ ym: '2026-12', k: 3, recorrencias, dividas, faturas })
    .some((l) => l.ref.descricao === 'Curso'), false, 'recorrência encerrada não vira linha');
  // Semanal cai várias vezes; a linha carrega quantas.
  const diarista = l0.find((l) => l.ref.descricao === 'Diarista');
  eq(diarista.vezes, 5, 'setembro/26 tem 5 terças');
  eq(diarista.valor, 500, 'e a linha já vem multiplicada');
}
console.log('  ok');

// ── 12. O MÊS 0 NÃO CONTA O REALIZADO DUAS VEZES ────────────────────────────
//
// ⚠️ BUG REAL, medido na conta de um usuário: a manchete dizia que o mês fecha
// em R$ 52,85 e a projeção do MESMO mês, dois cards abaixo, dizia R$ 154,02.
// Causa: o `saldoInicial` que se passa é o saldo de HOJE — que já reflete o que
// entrou e saiu no mês — e o mês 0 somava o realizado por cima dele.
console.log('── 12. mês 0 não conta o realizado 2× ──');
{
  const saldoHoje = 1280.89;
  const realizado = { receitas: 218.42, gastos: 1345.29 };
  const restante = { receitas: 328, gastos: 1556.04 };

  const meses = projetarMeses({
    inicio: '2026-09', quantidade: 3, saldoInicial: saldoHoje,
    recorrencias: [
      { tipo: 'Recebimento', valor: 328, dia_vencimento: 25 },
      { tipo: 'Gasto', valor: 1556.04, dia_vencimento: 25 },
    ],
    dividas: [], faturas: [], realizado, restante,
  });

  // O fecho do mês 0 tem de ser EXATAMENTE saldo de hoje + o que ainda vem —
  // que é a conta que a manchete faz.
  const manchete = Math.round((saldoHoje + restante.receitas - restante.gastos) * 100) / 100;
  eq(meses[0].saldoAcumulado, manchete, 'o mês 0 fecha no mesmo número da manchete');

  // E o mês se lê inteiro: começou com o fechamento do mês anterior…
  eq(meses[0].saldoInicial, Math.round((saldoHoje - realizado.receitas + realizado.gastos) * 100) / 100,
    'o saldo inicial é o fechamento do mês passado, não o de hoje');
  // …e o movimento do mês é o realizado MAIS o que falta.
  eq(meses[0].receitaFirme + meses[0].receitaEstimada,
    Math.round((realizado.receitas + restante.receitas) * 100) / 100, 'receitas = já entrou + ainda entra');
  eq(meses[0].despesaFirme + meses[0].despesaEstimada,
    Math.round((realizado.gastos + restante.gastos) * 100) / 100, 'despesas = já saiu + ainda sai');
  // A conta fecha sozinha.
  eq(Math.round((meses[0].saldoInicial + meses[0].resultado) * 100) / 100, meses[0].saldoAcumulado,
    'inicial + resultado = projetado');

  // ⚠️ E os meses SEGUINTES herdam o saldo certo — o erro do mês 0 deslocava a
  //    projeção inteira, e com ela o alerta de "caixa negativo em…".
  eq(meses[1].saldoInicial, meses[0].saldoAcumulado, 'o mês 1 começa onde o 0 terminou');

  // Sem `restante` (quem ainda não passa o parâmetro) nada muda além do
  // saldo inicial — é a compatibilidade que impede regressão silenciosa.
  const semRestante = projetarMeses({
    inicio: '2026-09', quantidade: 2, saldoInicial: saldoHoje,
    recorrencias: [{ tipo: 'Gasto', valor: 100, dia_vencimento: 5 }],
    dividas: [], faturas: [], realizado,
  });
  eq(semRestante[0].despesaFirme, realizado.gastos, 'sem restante, o mês 0 mostra só o realizado');
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('✓ projeção de previstos: todos os casos passaram');

// =============================================================================
// EVAL — "o que ainda vem no mês" (lib/ainda-vem-mes.ts), a fonte única do
// "vai sobrar" das abas Transações, Previstos e Relatórios.
//
// Trava:
//   1. conta fixa paga/pulada no mês (resolvida_no_mes) SAI — era contada 2×;
//   2. modo de lançamento: "lançar"/"só prever" só antes do dia; "não lançar"
//      até o próprio dia;
//   3. parcela de dívida paga ADIANTADA sai (proximoVencimento) — era contada 2×;
//   4. fatura: em aberto entra (inclusive a que vence no mês seguinte), paga ou
//      tirada da previsão sai;
//   5. pendentes: só os que mexem no caixa (sem cartão, sem transferência);
//   6. ⚠️ REGRESSÃO ZERO nas contas fixas contra a cópia congelada da regra
//      que os Relatórios usavam (milhares de casos).
//
// Rodar:  npm run eval:ainda-vem-mes
// =============================================================================
import { previstosRestantesDoMes, pendentesDoCaixa, nomesDeCartao, itensDoSaldoProjetado } from './ainda-vem-mes.ts';
import { aindaVemNoMes, diaHojeSP, itemPrevistoDe, vezesQueAindaVem, calcularSaldoProjetado } from './saldo-projetado.ts';

const falhas = [];
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };
// 15/10/2026 ao meio-dia em São Paulo
const AGORA = new Date('2026-10-15T15:00:00Z');
const chaves = (l) => l.map((x) => x.chave);

console.log('── 1. conta fixa já paga/pulada no mês sai ──');
{
  const recs = [
    { id: 'luz', tipo: 'Gasto', valor: 180, dia_vencimento: 25, resolvida_no_mes: true },
    { id: 'net', tipo: 'Gasto', valor: 120, dia_vencimento: 26 },
  ];
  eq(chaves(previstosRestantesDoMes({ recorrencias: recs, agora: AGORA })), ['rec:net'], '⚠️ a luz paga dia 10 (vence 25) NÃO conta de novo');
}
console.log('  ok');

console.log('── 2. modo de lançamento e dia ──');
{
  const recs = [
    { id: 'hoje-lancar', tipo: 'Gasto', valor: 10, dia_vencimento: 15, modo_lancamento: 'lancar' },
    { id: 'hoje-prever', tipo: 'Gasto', valor: 10, dia_vencimento: 15, modo_lancamento: 'prever' },
    { id: 'hoje-naolanc', tipo: 'Gasto', valor: 10, dia_vencimento: 15, modo_lancamento: 'nao_lancar' },
    { id: 'passou', tipo: 'Gasto', valor: 10, dia_vencimento: 3 },
    { id: 'vem', tipo: 'Recebimento', valor: 10, dia_vencimento: 20 },
    { id: 'inativa', tipo: 'Gasto', valor: 10, dia_vencimento: 20, ativa: false },
    { id: 'zero', tipo: 'Gasto', valor: 0, dia_vencimento: 20 },
  ];
  eq(chaves(previstosRestantesDoMes({ recorrencias: recs, agora: AGORA })).sort(), ['rec:hoje-naolanc', 'rec:vem'].sort(),
    'no dia: lançar/prever já viraram transação; "não lançar" ainda vem; passou sai; inativa e zero saem');
}
console.log('  ok');

console.log('── 3. ⚠️ parcela de dívida paga adiantada ──');
{
  const divs = [
    { id: 'pago-antes', valor_parcela: 500, dia_vencimento: 20, ultimo_pagamento: '2026-10-12' },
    { id: 'aberta', valor_parcela: 300, dia_vencimento: 20, ultimo_pagamento: '2026-09-19' },
    { id: 'venceu', valor_parcela: 200, dia_vencimento: 5 },
    { id: 'fora', valor_parcela: 100, dia_vencimento: 22, nos_previstos: false },
    { id: 'quitada', valor_parcela: 100, dia_vencimento: 22, status: 'quitada' },
    { id: 'banco', valor_parcela: 90, dia_vencimento: 22, proximo_vencimento: '2026-11-22' },
  ];
  eq(chaves(previstosRestantesDoMes({ dividas: divs, agora: AGORA })), ['div:aberta'],
    '⚠️ só a parcela em aberto deste mês entra (paga adiantada, vencida, fora, quitada e a que o banco diz ser de novembro saem)');
}
console.log('  ok');

console.log('── 4. faturas ──');
{
  const fats = [
    { cartao_id: 'a', restante: 900, venc: '2026-10-20' },
    { cartao_id: 'b', restante: 500, venc: '2026-11-05' },
    { cartao_id: 'c', restante: 0, venc: '2026-10-20' },
    { cartao_id: 'd', restante: 400, venc: '2026-10-20', nos_previstos: false },
    { cartao_id: 'e', restante: 400, venc: '2026-10-10' },
  ];
  eq(chaves(previstosRestantesDoMes({ faturas: fats, agora: AGORA })).sort(), ['fat:a', 'fat:b'],
    'aberta entra (inclusive a que vence no mês seguinte); paga, tirada da previsão e vencida saem');
}
console.log('  ok');

console.log('── 5. pendentes que mexem no caixa ──');
{
  const wallets = [{ nome: 'Nubank Crédito', tipo: 'Crédito' }, { nome: 'Inter', tipo: 'Conta' }];
  const txs = [
    { tipo: 'Gasto', valor: 50, pago: false, carteira_nome: 'Inter' },
    { tipo: 'Gasto', valor: 60, pago: true, carteira_nome: 'Inter' },
    { tipo: 'Gasto', valor: 70, pago: false, carteira_nome: 'nubank crédito ' },
    { tipo: 'Gasto', valor: 80, pago: false, carteira_nome: 'Inter', transferencia: true },
    { tipo: 'Recebimento', valor: 90, pago: false, carteira_nome: null },
  ];
  const p = pendentesDoCaixa(txs, nomesDeCartao(wallets));
  eq(p.map((t) => t.valor), [50, 90], 'pendente de conta e sem conta entram; pago, cartão e transferência saem');
  const proj = calcularSaldoProjetado([{ tipo: 'Conta', saldo: 1000 }],
    itensDoSaldoProjetado(previstosRestantesDoMes({ recorrencias: [{ id: 'x', tipo: 'Gasto', valor: 100, dia_vencimento: 20 }], agora: AGORA }), p),
    [], AGORA);
  eq([proj.aPagar, proj.aReceber, proj.projetado], [150, 90, 940], 'o saldo projetado soma restantes + pendentes (pendente atrasado incluso)');
}
console.log('  ok');

console.log('── 6. ⚠️ regressão zero nas contas fixas (cópia congelada dos Relatórios) ──');
{
  // Cópia CONGELADA de `previstosFixos` de RelatoriosClient.tsx (antes desta mudança).
  const antiga = (lista, agora) => {
    const diaHoje = diaHojeSP(agora);
    return lista.filter((r) => !r.resolvida_no_mes).map((r) => {
      const item = itemPrevistoDe(r);
      const naoMensal = !!r.frequencia && r.frequencia !== 'mensal';
      const vezes = naoMensal ? vezesQueAindaVem(item, agora)
        : ((r.modo_lancamento || 'lancar') === 'nao_lancar' ? (aindaVemNoMes(item, agora) ? 1 : 0) : (Number(r.dia_vencimento) > diaHoje ? 1 : 0));
      return { r, vezes };
    }).filter((x) => x.vezes > 0).map(({ r, vezes }) => ({ chave: `rec:${r.id}`, valor: (Number(r.valor) || 0) * vezes }));
  };
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  let n = 0;
  for (let caso = 0; caso < 3000; caso++) {
    const dia = 1 + Math.floor(rnd() * 28);
    const agora = new Date(Date.UTC(2026, Math.floor(rnd() * 12), dia, 15));
    const r = {
      id: 'r' + caso, tipo: pick(['Gasto', 'Recebimento']), valor: 1 + Math.floor(rnd() * 500),
      dia_vencimento: 1 + Math.floor(rnd() * 31), modo_lancamento: pick([null, 'lancar', 'prever', 'nao_lancar']),
      frequencia: pick([null, 'mensal', 'mensal', 'semanal', 'anual']), dia_semana: Math.floor(rnd() * 7),
      mes_vencimento: 1 + Math.floor(rnd() * 12), resolvida_no_mes: rnd() < 0.2,
    };
    const a = antiga([r], agora).map((x) => [x.chave, x.valor]);
    const b = previstosRestantesDoMes({ recorrencias: [r], agora }).map((x) => [x.chave, x.valor]);
    if (JSON.stringify(a) !== JSON.stringify(b)) { falhas.push(`§6 divergiu: ${JSON.stringify(r)} @ ${agora.toISOString()} → antiga ${JSON.stringify(a)} × nova ${JSON.stringify(b)}`); if (++n > 5) break; }
  }
}
console.log('  ok');

console.log(`\n${falhas.length ? `${falhas.length} FALHA(S) ❌` : 'tudo passou ✅'}`);
if (falhas.length) { falhas.slice(0, 20).forEach((f) => console.log('  · ' + f)); process.exit(1); }

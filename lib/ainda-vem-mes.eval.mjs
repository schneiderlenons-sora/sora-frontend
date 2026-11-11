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
import { previstosRestantesDoMes, pendentesDoCaixa, nomesDeCartao, itensDoSaldoProjetado, vezesAindaNaLista, parcelaAindaNoMes } from './ainda-vem-mes.ts';
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

console.log('── 7. as LISTAS do mês concordam com a manchete (nov/2026) ──');
{
  // Relato do dono: marcou contas como pagas e a Projeção seguia listando-as
  // em "ainda sai"; e Receitas/Despesas decidiam só pela data.
  eq(vezesAindaNaLista({ tipo: 'Gasto', valor: 100, dia_vencimento: 25, resolvida_no_mes: true }, AGORA), 0,
    '⚠️ paga antes do vencimento: a lista não a mostra como "ainda sai"');
  eq(vezesAindaNaLista({ tipo: 'Gasto', valor: 100, dia_vencimento: 25 }, AGORA), 1, 'não paga e vence depois: ainda');
  eq(vezesAindaNaLista({ tipo: 'Gasto', valor: 100, dia_vencimento: 10 }, AGORA), 0, 'venceu e não está resolvida: a data decide (como antes)');
  eq(vezesAindaNaLista({ tipo: 'Gasto', valor: 50, dia_vencimento: 1, frequencia: 'semanal', dia_semana: 1 }, AGORA),
    vezesQueAindaVem(itemPrevistoDe({ tipo: 'Gasto', valor: 50, dia_vencimento: 1, frequencia: 'semanal', dia_semana: 1 }), AGORA),
    'semanal sem resolução: a contagem de sempre');
  eq(parcelaAindaNoMes({ valor_parcela: 500, dia_vencimento: 20, ultimo_pagamento: '2026-10-12' }, AGORA), false, '⚠️ parcela paga ADIANTADA não é "ainda sai"');
  eq(parcelaAindaNoMes({ valor_parcela: 300, dia_vencimento: 20, ultimo_pagamento: '2026-09-19' }, AGORA), true, 'parcela do mês em aberto: ainda');
  eq(parcelaAindaNoMes({ valor_parcela: 300, dia_vencimento: 10, ultimo_pagamento: '2026-09-09' }, AGORA), false, 'parcela que venceu dia 10 sem pagamento: fora do "ainda sai", IGUAL à manchete (o próximo vencimento já é novembro)');

  // Cada linha leva o objeto de origem e quantas vezes cai — a tela desenha a
  // linha a partir dele e a soma NÃO pode mudar.
  const recs = [
    { id: 'a', tipo: 'Gasto', valor: 40, dia_vencimento: 1, frequencia: 'semanal', dia_semana: 3 },
    { id: 'b', tipo: 'Gasto', valor: 99, dia_vencimento: 28 },
  ];
  for (const r of previstosRestantesDoMes({ recorrencias: recs, agora: AGORA })) {
    eq(r.valor, Number(r.ref.valor) * r.vezes, `linha ${r.chave}: valor = ref.valor × vezes`);
  }

  // ⚠️ A LISTA DO MÊS CORRENTE FECHA COM O "AINDA SAI": restantes + pendentes
  // (o que a Projeção lista) somam o MESMO aPagar/aReceber da manchete.
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  for (let caso = 0; caso < 1500; caso += 1) {
    const recorrencias = Array.from({ length: 1 + Math.floor(rnd() * 5) }, (_, i) => ({
      id: 'r' + i, tipo: pick(['Gasto', 'Recebimento']), valor: 1 + Math.floor(rnd() * 500),
      dia_vencimento: 1 + Math.floor(rnd() * 31), modo_lancamento: pick([null, 'lancar', 'prever', 'nao_lancar']),
      frequencia: pick([null, 'mensal', 'semanal', 'anual']), dia_semana: Math.floor(rnd() * 7),
      mes_vencimento: 1 + Math.floor(rnd() * 12), resolvida_no_mes: rnd() < 0.25, valor_variavel: rnd() < 0.2,
    }));
    const dividas = Array.from({ length: Math.floor(rnd() * 3) }, (_, i) => ({
      id: 'd' + i, valor_parcela: 10 + Math.floor(rnd() * 400), dia_vencimento: 1 + Math.floor(rnd() * 28),
      ultimo_pagamento: pick([null, '2026-10-02', '2026-09-20']),
    }));
    const faturas = Array.from({ length: Math.floor(rnd() * 2) }, (_, i) => ({
      cartao_id: 'c' + i, restante: Math.floor(rnd() * 900), venc: pick(['2026-10-20', '2026-10-05', '2026-11-08']),
    }));
    const txs = Array.from({ length: Math.floor(rnd() * 4) }, (_, i) => ({
      id: 't' + i, tipo: pick(['Gasto', 'Recebimento']), valor: 1 + Math.floor(rnd() * 300), pago: rnd() < 0.5, carteira_nome: 'Conta',
    }));
    const restantes = previstosRestantesDoMes({ recorrencias, dividas, faturas, agora: AGORA });
    const pend = pendentesDoCaixa(txs, new Set());
    const proj = calcularSaldoProjetado([], itensDoSaldoProjetado(restantes, pend), [], AGORA);
    const soma = (tipo) => Math.round(([...restantes, ...pend].filter((x) => x.tipo === tipo).reduce((t, x) => t + Number(x.valor), 0)) * 100) / 100;
    if (soma('Gasto') !== proj.aPagar || soma('Recebimento') !== proj.aReceber) {
      falhas.push(`§7 lista ≠ manchete no caso ${caso}: gasto ${soma('Gasto')} × ${proj.aPagar}, receita ${soma('Recebimento')} × ${proj.aReceber}`);
      break;
    }
  }
}
console.log('  ok');

console.log(`\n${falhas.length ? `${falhas.length} FALHA(S) ❌` : 'tudo passou ✅'}`);
if (falhas.length) { falhas.slice(0, 20).forEach((f) => console.log('  · ' + f)); process.exit(1); }

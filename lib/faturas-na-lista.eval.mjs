// =============================================================================
// EVAL: Transações → "Cartões: Faturas" (lib/faturas-na-lista.ts).
// Rodar:  npm run eval:faturas-na-lista
// =============================================================================
import {
  faturasDoMes, cartaoDoPagamento, linhaPassa, montarListaComFaturas,
  totaisDasFaturas, deslocamentosDoMes,
} from './faturas-na-lista.ts';

const falhas = [];
let total = 0;
const eq = (a, b, m) => {
  total++;
  if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     esperado ${JSON.stringify(b)}\n     veio     ${JSON.stringify(a)}`);
};

const HOJE = '2026-11-26';
const MES = '2026-11';
const f = (id, nome, competencia, extra = {}) => ({ cartao_id: id, nome, competencia, venc: `${competencia}-10`, fatura: 100, pago: 0, restante: 100, ...extra });

// ── 1. faturasDoMes ───────────────────────────────────────────────────────────
// A fatura "atual" do Platinum vence em novembro (offset 0); a do Dividido já
// vence em dezembro — a de novembro dele está no offset −1.
const off0 = [
  f('plat', 'Itaú Platinum', '2026-11', { venc: '2026-11-30', fatura: 1200, restante: 1200 }),
  f('div', 'Itaú Dividido', '2026-12', { venc: '2026-12-05', fatura: 5461, restante: 5461 }),
  f('zero', 'Cartão parado', '2026-11', { fatura: 0, restante: 0 }),
];
const offM1 = [
  f('plat', 'Itaú Platinum', '2026-10', { venc: '2026-10-30', fatura: 900, pago: 900, restante: 0, quitada: true }),
  f('div', 'Itaú Dividido', '2026-11', { venc: '2026-11-05', fatura: 3000, pago: 3000, restante: 0 }),
];
const r = faturasDoMes({ mes: MES, hoje: HOJE, respostas: [offM1, off0] });
eq(r.linhas.map((l) => [l.cartaoNome, l.competencia, l.venc, l.valor, l.status]),
  [['Itaú Dividido', '2026-11', '2026-11-05', 3000, 'paga'], ['Itaú Platinum', '2026-11', '2026-11-30', 1200, 'em_aberto']],
  'a fatura que VENCE no mês, de cada cartão, venha do deslocamento que vier');
eq(r.linhas.some((l) => l.cartaoId === 'zero'), false, 'fatura zerada não vira linha');

const st = (extra, hoje = HOJE) => faturasDoMes({ mes: MES, hoje, respostas: [[f('c', 'C', MES, extra)]] }).linhas[0]?.status;
eq(st({ venc: '2026-11-20', restante: 100 }), 'atrasada', 'venceu e não foi paga: atrasada');
eq(st({ venc: '2026-11-20', pago: 40, restante: 60 }), 'atrasada', 'venceu com parte paga: continua atrasada');
eq(st({ venc: '2026-11-28', pago: 40, restante: 60 }), 'parcial', 'paga em parte e ainda no prazo: parcial');
eq(st({ venc: '2026-11-26' }), 'vence_hoje', 'vence hoje');
eq(st({ venc: '2026-11-28' }), 'em_aberto', 'a vencer');
eq(st({ venc: '2026-11-20', pago: 100, restante: 0 }), 'paga', 'restante zero: paga');
eq(st({ venc: '2026-11-20', pago: 99.995, restante: 0.005, quitada: true }), 'paga', 'quitada pelo servidor: paga mesmo com resto de arredondamento');

const semVenc = faturasDoMes({ mes: MES, hoje: HOJE, respostas: [[f('c', 'C', MES, { venc: null })]] }).linhas[0];
eq(semVenc.venc, '2026-11-30', 'sem vencimento: último dia do mês (a linha não some)');
const vencOutroMes = faturasDoMes({ mes: '2027-02', hoje: HOJE, respostas: [[f('c', 'C', '2027-02', { venc: '2027-03-01' })]] }).linhas[0];
eq(vencOutroMes.venc, '2027-02-28', 'vencimento fora do mês: fica no último dia do mês da fatura');

const dolar = faturasDoMes({
  mes: MES, hoje: HOJE, moedaBase: 'BRL',
  respostas: [[
    f('usd', 'Amex', MES, { moeda: 'USD', taxa_base: 5, moeda_base: 'BRL', fatura: 10, restante: 10 }),
    f('eur', 'Euro', MES, { moeda: 'EUR', fatura: 10, restante: 10 }),
  ]],
});
eq(dolar.linhas.map((l) => [l.cartaoNome, l.valor]), [['Amex', 50]], 'cartão em outra moeda entra convertido pra moeda do grupo');
eq([...dolar.semCambio], ['eur'], 'sem cotação: o cartão vai pra semCambio (as compras dele ficam na lista)');

// ── 2. cartaoDoPagamento ─────────────────────────────────────────────────────
const cartoes = [{ id: 'plat', nome: 'Itaú Platinum' }, { id: 'itau', nome: 'Itaú' }, { id: 'nu', nome: 'Nubank' }];
const nomes = new Set(cartoes.map((c) => c.nome));
const pg = (extra) => cartaoDoPagamento({ tipo: 'Gasto', categoria: 'Fatura', carteira_nome: 'Conta Itaú', ...extra }, cartoes, nomes);
eq(pg({ observacao: 'Fatura Itaú Platinum' }), 'plat', 'texto da Sora reconhece o cartão');
eq(pg({ observacao: 'Fatura Itaú' }), 'itau', 'nomes parecidos: cada um o seu');
eq(pg({ observacao: 'Fatura Itaú Platinum · Esposa (externo)', carteira_nome: null }), 'plat', 'parte paga por fora (sem conta) também é reconhecida');
eq(pg({ observacao: 'Fatura Nubank (anterior)' }), 'nu', '"(anterior)" do WhatsApp');
eq(pg({ observacao: 'fatura itau platinum', categoria: '💳 Fatura' }), 'plat', 'categoria com emoji e texto sem acento/caixa');
const invertidos = [{ id: 'itau', nome: 'Itaú' }, { id: 'plat', nome: 'Itaú Platinum' }];
eq(cartaoDoPagamento({ tipo: 'Gasto', categoria: 'Fatura', carteira_nome: 'Conta', observacao: 'Fatura Itaú Platinum' }, invertidos, new Set(['Itaú', 'Itaú Platinum'])),
  'plat', 'nome mais longo vence mesmo com o curto listado antes');
eq(pg({ observacao: 'PAGAMENTO FATURA CARTAO' }), null, '⚠️ texto do banco não diz o cartão: não reconhece');
eq(pg({ observacao: 'Fatura Itaúcard' }), null, 'nome que só COMEÇA igual não casa');
eq(pg({ observacao: 'Fatura Itaú Platinum', carteira_nome: 'Itaú Platinum' }), null, 'linha do lado do cartão não é pagamento da conta');
eq(pg({ observacao: 'Fatura Itaú Platinum', tipo: 'Recebimento' }), null, 'entrada não é pagamento');
eq(pg({ observacao: 'Fatura Itaú Platinum', categoria: 'Mercado' }), null, 'categoria que não é Fatura não é pagamento');

// ── 3. linhaPassa (filtros da lista) ─────────────────────────────────────────
const L = r.linhas.find((l) => l.cartaoId === 'plat');
const P = r.linhas.find((l) => l.cartaoId === 'div');
eq(linhaPassa(L, {}), true, 'sem filtro: aparece');
eq(linhaPassa(L, { tipo: 'Recebimento' }), false, 'filtro de receitas: fatura some');
eq(linhaPassa(L, { tipo: 'Gasto' }), true, 'filtro de despesas: fatura fica');
eq([linhaPassa(L, { status: 'pago' }), linhaPassa(P, { status: 'pago' })], [false, true], 'status "pagos": só a paga');
eq([linhaPassa(L, { status: 'pendente' }), linhaPassa(P, { status: 'pendente' })], [true, false], 'status "pendentes": só a em aberto');
eq([linhaPassa(L, { categoria: 'Mercado' }), linhaPassa(L, { categoria: '💳 Fatura' })], [false, true], 'categoria: só "Fatura" mantém');
eq([linhaPassa(L, { conta: 'so_contas' }), linhaPassa(L, { conta: 'so_cartoes' }), linhaPassa(L, { conta: 'Itaú Platinum' }), linhaPassa(L, { conta: 'Itaú Dividido' }), linhaPassa(L, { conta: 'Conta Itaú' })],
  [false, true, true, false, false], 'conta: só contas tira; só cartões e o próprio cartão mantêm');
eq([linhaPassa(L, { busca: 'platinum' }), linhaPassa(L, { busca: 'FATURA ITAU' }), linhaPassa(L, { busca: 'mercado' })], [true, true, false], 'busca pelo nome, sem acento');
eq(linhaPassa(L, { outroFiltro: true }), false, 'filtro de membro/cartão virtual: fatura some');

// ── 4. montarListaComFaturas ─────────────────────────────────────────────────
const tx = (id, data, extra = {}) => ({ id, data, tipo: 'Gasto', valor: 10, categoria: 'Mercado', carteira_nome: 'Conta Itaú', ...extra });
const txs = [
  tx('mercado', '2026-11-29T15:00:00Z'),
  tx('compraPlat', '2026-11-28T00:00:00+00:00', { carteira_nome: 'Itaú Platinum' }),
  tx('pagDiv', '2026-11-05T00:00:00+00:00', { categoria: 'Fatura', observacao: 'Fatura Itaú Dividido', valor: 3000 }),
  tx('pagNu', '2026-11-04T00:00:00+00:00', { categoria: 'Fatura', observacao: 'Fatura Nubank', valor: 50 }),
  tx('pagBanco', '2026-11-03T00:00:00+00:00', { categoria: 'Fatura', observacao: 'PAGAMENTO FATURA CARTAO', valor: 70 }),
  tx('compraEuro', '2026-11-02T00:00:00+00:00', { carteira_nome: 'Euro' }),
  tx('padaria', '2026-11-01T00:00:00+00:00'),
];
const cart2 = [{ id: 'plat', nome: 'Itaú Platinum' }, { id: 'div', nome: 'Itaú Dividido' }, { id: 'nu', nome: 'Nubank' }, { id: 'eur', nome: 'Euro' }];
const m = montarListaComFaturas({ txs, linhas: r.linhas, cartoes: cart2, semCambio: new Set(['eur']) });
eq(m.itens.map((i) => (i.tipo === 'tx' ? i.tx.id : `F:${i.linha.cartaoId}`)),
  ['F:plat', 'mercado', 'F:div', 'pagNu', 'pagBanco', 'compraEuro', 'padaria'],
  'compras do cartão saem, faturas entram na data do vencimento, a ordem das transações é mantida');
eq(m.txs.some((t) => t.id === 'compraPlat'), false, 'compra do cartão sai da lista');
eq(m.txs.some((t) => t.id === 'compraEuro'), true, 'cartão sem cotação: as compras FICAM (sumiriam sem nada no lugar)');
eq(m.linhas.find((l) => l.cartaoId === 'div').pagamentos, [{ id: 'pagDiv', data: '2026-11-05', valor: 3000, conta: 'Conta Itaú' }],
  'pagamento reconhecido sai da lista e vai pra dentro da linha da fatura');
eq(m.txs.some((t) => t.id === 'pagNu'), true, 'pagamento de cartão SEM linha no mês continua na lista');
eq(m.txs.some((t) => t.id === 'pagBanco'), true, '⚠️ pagamento que o banco mandou (sem nome do cartão) continua na lista');
eq(r.linhas.find((l) => l.cartaoId === 'div').pagamentos, [], 'não mexe nas linhas recebidas');
const mesmoDia = montarListaComFaturas({ txs: [tx('noVenc', '2026-11-30T12:00:00Z'), tx('antes', '2026-11-29T12:00:00Z')], linhas: r.linhas, cartoes: cart2 });
eq(mesmoDia.itens.map((i) => (i.tipo === 'tx' ? i.tx.id : `F:${i.linha.cartaoId}`)), ['F:plat', 'noVenc', 'antes', 'F:div'],
  'transação no dia do vencimento: a fatura vem antes dela');
const vazia = montarListaComFaturas({ txs: [], linhas: r.linhas, cartoes: cart2 });
eq(vazia.itens.map((i) => i.linha.cartaoId), ['plat', 'div'], 'sem transações: só as faturas, mais recente primeiro');

// ── 5. totais e deslocamentos ────────────────────────────────────────────────
eq(totaisDasFaturas(m.linhas), { valor: 4200, aPagar: 1200, abertas: 1 }, 'total das faturas e o que está em aberto');
eq(deslocamentosDoMes('2026-11', '2026-11'), [-1, 0], 'mês atual: deslocamentos −1 e 0');
eq(deslocamentosDoMes('2026-11', '2027-01'), [1, 2], 'dois meses à frente: 1 e 2');
eq(deslocamentosDoMes('2026-11', '2026-09'), [-3, -2], 'dois meses atrás: −3 e −2');

console.log(`${total} verificações · ${falhas.length ? `${falhas.length} FALHAS` : 'todas ok'}`);
if (falhas.length) { for (const x of falhas) console.log('  ✘ ' + x); process.exit(1); }

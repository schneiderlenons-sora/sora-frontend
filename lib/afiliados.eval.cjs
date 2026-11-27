// =============================================================================
// EVAL — afiliados de ponta a ponta (lib/afiliados.ts) com banco, Stripe e
// Mercado Pago FALSOS. Rodar:  npm run eval:afiliados-fluxo
// =============================================================================
const Module = require('module');

// ── Banco falso ──────────────────────────────────────────────────────────────
let T, seq, quebradas;
function from(tabela) {
  let op = 'select', dado = null, opcoes = {}, unica = false, contar = false;
  const filtros = [];
  const casa = (r) => filtros.every((f) => f(r));
  const q = {
    select(_c, o) { if (o?.count) contar = true; return q; },
    eq(c, v) { filtros.push((r) => r[c] === v); return q; },
    neq(c, v) { filtros.push((r) => r[c] !== v); return q; },
    in(c, v) { filtros.push((r) => v.includes(r[c])); return q; },
    order() { return q; }, limit() { return q; },
    maybeSingle() { unica = true; return q; },
    insert(d) { op = 'insert'; dado = d; return q; },
    update(d) { op = 'update'; dado = d; return q; },
    upsert(d, o) { op = 'upsert'; dado = d; opcoes = o || {}; return q; },
    then(ok, ruim) {
      return Promise.resolve().then(() => {
        if (quebradas.has(tabela) || quebradas.has(`${tabela}:${op}`)) return { data: null, error: { message: 'falhou' }, count: null };
        const rs = (T[tabela] ||= []);
        if (op === 'select') {
          const achou = rs.filter(casa).map((r) => ({ ...r }));
          return { data: unica ? achou[0] || null : achou, error: null, count: contar ? achou.length : null };
        }
        if (op === 'update') { rs.filter(casa).forEach((r) => Object.assign(r, dado)); return { data: null, error: null }; }
        for (const n of Array.isArray(dado) ? dado : [dado]) {
          const chaves = (opcoes.onConflict || '').split(',').filter(Boolean);
          const ja = chaves.length && rs.find((r) => chaves.every((k) => r[k] === n[k]));
          if (ja) { if (!opcoes.ignoreDuplicates) Object.assign(ja, n); }
          else rs.push({ id: `id${++seq}`, ...n });
        }
        return { data: null, error: null };
      }).then(ok, ruim);
    },
  };
  return q;
}

// ── Stripe e Mercado Pago falsos ─────────────────────────────────────────────
let faturas, cobrancas, sessao, mp, stripeFora, mpFora;
const lista = (arr) => ({ async *[Symbol.asyncIterator]() { if (stripeFora) throw new Error('stripe fora'); yield* arr(); } });
const stripe = {
  invoices: { list: ({ customer }) => lista(() => faturas.filter((f) => f.customer === customer)) },
  charges: { list: ({ customer }) => lista(() => cobrancas.filter((c) => c.customer === customer)) },
  checkout: { sessions: { retrieve: async () => sessao } },
};
const PLANOS = { price_premium: 'premium' };
const falsos = {
  '@/lib/supabase-admin': { supabaseAdmin: { from } },
  '@/lib/stripe': { stripe, priceIdToPlano: (id) => PLANOS[id] || null, PRICE_IDS: { premium: { mensal: 'price_premium' } } },
  '@/lib/mercadopago': {
    mpBuscarPagamentos: async (ref) => { if (mpFora) throw new Error('mp fora'); return mp.filter((p) => p.external_reference === ref); },
    mpGetPayment: async (id) => mp.find((p) => String(p.id) === String(id)),
  },
};
const carregar = Module._load;
Module._load = function (pedido, ...resto) {
  if (falsos[pedido]) return falsos[pedido];
  return carregar.call(this, pedido, ...resto);
};
const A = require('./afiliados.ts');

const falhas = []; let total = 0;
const eq = (a, b, m) => { total++; if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n      esperado ${JSON.stringify(b)}\n      veio     ${JSON.stringify(a)}`); };

const DIA = 86400000;
const agora = Date.now();
const seg = (ms) => Math.floor(ms / 1000);
function fatura(id, diasAtras, { valor = 2990, taxa = 158, devolvido = 0, preco = 'price_premium', cliente = 'cus_c', contestada = false } = {}) {
  faturas.push({ id, customer: cliente, created: seg(agora - diasAtras * DIA), status_transitions: { paid_at: seg(agora - diasAtras * DIA) },
    lines: { data: [{ pricing: { price_details: { price: preco } } }] },
    payments: { data: [{ status: 'paid', payment: { payment_intent: `pi_${id}` } }] } });
  cobrancas.push({ customer: cliente, paid: true, payment_intent: `pi_${id}`, amount_captured: valor, amount_refunded: devolvido, disputed: contestada, balance_transaction: { net: valor - taxa } });
}
function zerar() {
  seq = 0; quebradas = new Set(); faturas = []; cobrancas = []; mp = []; stripeFora = false; mpFora = false;
  T = {
    users: [
      { id: 'dono', email: 'tati@x.com', plano: 'premium', vitalicio: true, stripe_subscription_id: null },
      { id: 'c', email: 'c@x.com', plano: 'inativo', vitalicio: false, stripe_subscription_id: null, stripe_customer_id: 'cus_c' },
      { id: 'velho', email: 'v@x.com', plano: 'premium', vitalicio: false, stripe_subscription_id: 'sub_v' },
    ],
    afiliados: [{ id: 'af1', user_id: 'dono', codigo: 'TATI', desconto_pct: 10, ativo: true, stripe_promo_id: 'promo_1', sincronizado_em: null },
      { id: 'af2', user_id: 'outro', codigo: 'JOAO', desconto_pct: 5, ativo: true, stripe_promo_id: 'promo_2' }],
    afiliado_indicados: [], afiliado_comissoes: [],
  };
}
const indicar = (diasAtras = 100) => T.afiliado_indicados.push({ user_id: 'c', afiliado_id: 'af1', origem: 'link', criado_em: new Date(agora - diasAtras * DIA).toISOString() });
const com = () => T.afiliado_comissoes.map((l) => [l.referencia, l.ajuste_n, l.tipo, l.valor_centavos, l.status]);

(async () => {
  // ── §1 Atribuição ──────────────────────────────────────────────────────
  zerar();
  eq(await A.atribuir('c', 'tati', 'link'), true, '§1 cliente novo é atribuído (código em minúscula)');
  eq(T.afiliado_indicados.map((i) => [i.user_id, i.afiliado_id, i.origem]), [['c', 'af1', 'link']], '§1 gravado');
  eq(await A.atribuir('c', 'TATI', 'codigo'), true, '§1 repetir é ok');
  eq(T.afiliado_indicados.length, 1, '§1 sem duplicar');
  await A.atribuir('c', 'JOAO', 'codigo');
  eq(T.afiliado_indicados.map((i) => i.afiliado_id), ['af2'], '§1 antes da 1ª compra vale o último');
  T.afiliado_comissoes.push({ id: 'x', cliente_id: 'c', afiliado_id: 'af2' });
  eq(await A.atribuir('c', 'TATI', 'codigo'), false, '§1 depois de render comissão não troca');
  zerar();
  eq([await A.atribuir('dono', 'TATI', 'link'), await A.atribuir('velho', 'TATI', 'link'), await A.atribuir('c', 'NAOEXISTE', 'link'), await A.atribuir('c', '', 'link')], [false, false, false, false], '§1 ele mesmo, assinante antigo e código inexistente');
  eq(T.afiliado_indicados.length, 0, '§1 nada gravado');
  T.afiliados[0].ativo = false;
  eq(await A.atribuir('c', 'TATI', 'link'), false, '§1 código pausado');
  eq(await A.afiliadoPorCodigo('TATI'), null, '§1 código pausado não dá desconto a quem consulta');
  for (const tab of ['afiliados', 'users', 'afiliado_comissoes', 'afiliado_indicados']) {
    zerar(); quebradas.add(tab);
    eq(await A.atribuir('c', 'TATI', 'link'), false, `§1 ${tab} fora do ar: não atribui e não lança erro`);
  }

  // ── §2 Código digitado no Stripe ───────────────────────────────────────
  zerar();
  T.users[1].stripe_subscription_id = 'sub_nova';
  sessao = { total_details: { breakdown: { discounts: [{ discount: { promotion_code: 'promo_1' } }] } } };
  await A.atribuirPeloCupomDaSessao({ id: 'cs', total_details: { amount_discount: 299 } }, 'c');
  eq(T.afiliado_indicados.map((i) => [i.afiliado_id, i.origem]), [['af1', 'codigo']], '§2 código digitado atribui, mesmo com a assinatura recém-criada');
  zerar(); sessao = { total_details: { breakdown: { discounts: [{ discount: { promotion_code: 'promo_da_casa' } }] } } };
  await A.atribuirPeloCupomDaSessao({ id: 'cs', total_details: { amount_discount: 299 } }, 'c');
  eq(T.afiliado_indicados.length, 0, '§2 cupom da casa não atribui');
  await A.atribuirPeloCupomDaSessao({ id: 'cs', total_details: { amount_discount: 0 } }, 'c');
  sessao = null;
  await A.atribuirPeloCupomDaSessao({ id: 'cs', total_details: { amount_discount: 5 } }, 'c');
  eq(T.afiliado_indicados.length, 0, '§2 sem desconto / resposta ruim: não lança');

  // ── §3 Sincronização ───────────────────────────────────────────────────
  zerar(); indicar();
  fatura('in_antes', 200);
  fatura('in_1', 70);
  fatura('in_2', 40);
  fatura('in_3', 5);
  fatura('in_of', 5, { preco: 'price_conexao' });
  fatura('in_outro', 5, { cliente: 'cus_outro' });
  mp.push({ id: 7, external_reference: 'c', status: 'approved', metadata: { vitalicio: true }, transaction_amount: 87.3, transaction_details: { net_received_amount: 83 }, date_approved: new Date(agora - 45 * DIA).toISOString() });
  mp.push({ id: 8, external_reference: 'c', status: 'rejected', metadata: { vitalicio: true }, transaction_amount: 97 });
  mp.push({ id: 9, external_reference: 'c', status: 'approved', metadata: {}, transaction_amount: 50, date_approved: new Date().toISOString() });
  eq((await A.sincronizarAfiliado('af1')).erros, [], '§3 sem erros');
  eq(com().sort(), [['in_1', 0, 'primeira', 850, 'pendente'], ['in_2', 0, 'renovacao', 425, 'pendente'], ['in_3', 0, 'renovacao', 425, 'pendente'], ['mp_7', 0, 'vitalicio', 2490, 'pendente']], '§3 30% / 15% / vitalício 30%; fora: antiga, conexão avulsa, outro cliente, recusado e pagamento que não é vitalício');
  eq(!!T.afiliados[0].sincronizado_em, true, '§3 marca quando releu');
  await A.sincronizarAfiliado('af1');
  eq(T.afiliado_comissoes.length, 4, '§3 rodar de novo não duplica');
  let p = await A.painelDoAfiliado('af1');
  eq([p.clientes, p.resumo], [1, { aReceber: 850 + 425 + 2490, emCarencia: 425, recebido: 0 }], '§3 carência de 30 dias');

  const antesDuplo = T.afiliado_comissoes.splice(0);
  await Promise.all([A.sincronizarAfiliado('af1'), A.sincronizarAfiliado('af1')]);
  eq([T.afiliado_comissoes.length, antesDuplo.length], [4, 4], '§3 duas leituras ao mesmo tempo não contam em dobro');

  // ── §4 Repasse ─────────────────────────────────────────────────────────
  let r = await A.registrarRepasse('af1', 1);
  eq([r.ok, T.afiliado_comissoes.filter((l) => l.status === 'paga').length], [false, 0], '§4 valor diferente do visto: nada marcado');
  stripeFora = true;
  r = await A.registrarRepasse('af1', 3765);
  eq([r.ok, T.afiliado_comissoes.filter((l) => l.status === 'paga').length], [false, 0], '§4 sem conferir as cobranças não marca');
  stripeFora = false;
  r = await A.registrarRepasse('af1', 3765);
  eq([r.ok, r.total], [true, 3765], '§4 marca o liberado');
  eq(T.afiliado_comissoes.filter((l) => l.status === 'paga' && l.repassada_em).map((l) => l.referencia).sort(), ['in_1', 'in_2', 'mp_7'], '§4 a que está em carência fica');
  eq((await A.registrarRepasse('af1', 3765)).ok, false, '§4 duas vezes não paga de novo');
  eq((await A.registrarRepasse('af1', 0)).ok, false, '§4 nada a pagar');

  // ── §5 Reembolso depois do repasse ─────────────────────────────────────
  cobrancas.find((c) => c.payment_intent === 'pi_in_1').amount_refunded = 2990;
  cobrancas.find((c) => c.payment_intent === 'pi_in_3').amount_refunded = 2990;
  mp[0].status = 'refunded';
  await A.sincronizarAfiliado('af1');
  eq(com().sort(), [['in_1', 0, 'primeira', 850, 'paga'], ['in_1', 1, 'primeira', -850, 'pendente'], ['in_2', 0, 'renovacao', 425, 'paga'], ['in_3', 0, 'renovacao', 425, 'cancelada'], ['mp_7', 0, 'vitalicio', 2490, 'paga'], ['mp_7', 1, 'vitalicio', -2490, 'pendente']], '§5 pago vira desconto; o não pago é cancelado');
  p = await A.painelDoAfiliado('af1');
  eq(p.resumo, { aReceber: -3340, emCarencia: 0, recebido: 3765 }, '§5 saldo a descontar');
  await A.sincronizarAfiliado('af1');
  eq(T.afiliado_comissoes.length, 6, '§5 o desconto não se repete');
  eq((await A.registrarRepasse('af1', -3340)).ok, false, '§5 saldo negativo não "paga"');
  fatura('in_4', 35, { valor: 49900, taxa: 2000 });
  await A.sincronizarAfiliado('af1');
  p = await A.painelDoAfiliado('af1');
  r = await A.registrarRepasse('af1', p.resumo.aReceber);
  eq([p.resumo.aReceber, r.ok], [7185 - 3340, true], '§5 o próximo repasse já desconta');

  // ── §6 Falhas de leitura não cancelam nada ─────────────────────────────
  zerar(); indicar(); fatura('in_1', 70);
  mp.push({ id: 7, external_reference: 'c', status: 'approved', metadata: { vitalicio: true }, transaction_amount: 97, fee_details: [{ amount: 4 }], date_approved: new Date(agora - 45 * DIA).toISOString() });
  await A.sincronizarAfiliado('af1');
  eq(com().sort(), [['in_1', 0, 'primeira', 850, 'pendente'], ['mp_7', 0, 'vitalicio', 2790, 'pendente']], '§6 sem o líquido do MP: desconta as taxas');
  const antes = JSON.stringify(com().sort());
  T.afiliados[0].sincronizado_em = null;
  stripeFora = true;
  eq((await A.sincronizarAfiliado('af1')).erros.length, 1, '§6 Stripe fora é reportado');
  eq([JSON.stringify(com().sort()) === antes, T.afiliados[0].sincronizado_em], [true, null], '§6 Stripe fora: nada muda e não conta como relido');
  stripeFora = false; mpFora = true;
  fatura('in_2', 10);
  await A.sincronizarAfiliado('af1');
  eq(com().sort(), [['in_1', 0, 'primeira', 850, 'pendente'], ['in_2', 0, 'renovacao', 425, 'pendente'], ['mp_7', 0, 'vitalicio', 2790, 'pendente']], '§6 MP fora: Stripe segue e o vitalício fica');
  mpFora = false;
  cobrancas.find((c) => c.payment_intent === 'pi_in_2').disputed = true;
  await A.sincronizarAfiliado('af1');
  eq(T.afiliado_comissoes.find((l) => l.referencia === 'in_2').status, 'cancelada', '§6 contestação cancela');
  zerar(); indicar(); fatura('in_1', 70); quebradas.add('afiliado_comissoes:select');
  eq([(await A.sincronizarAfiliado('af1')).erros.length, T.afiliado_comissoes.length], [1, 0], '§6 sem ler o que existe, não grava');

  console.log(`${total} verificações · ${falhas.length ? `${falhas.length} FALHAS` : 'todas ok'}`);
  if (falhas.length) { for (const f of falhas) console.log('  ✘ ' + f); process.exit(1); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

// =============================================================================
// EVAL — programa de afiliados (lib/afiliados-regras.ts).
// Rodar:  npm run eval:afiliados
// =============================================================================
import * as R from './afiliados-regras.ts';

const falhas = [];
let total = 0;
const eq = (a, b, m) => { total++; if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n      esperado ${JSON.stringify(b)}\n      veio     ${JSON.stringify(a)}`); };

const DIA = 86400000;
const T0 = Date.UTC(2026, 0, 15, 12);
const pg = (ref, meses, extra = {}) => ({
  referencia: ref, origem: 'stripe', tipo: 'assinatura', pagoEm: R.somarMeses(T0, meses),
  valorPago: 2990, reembolsado: 0, liquido: 2832, ...extra,
});

// ── §1 Código ───────────────────────────────────────────────────────────────
eq(R.normalizarCodigoAfiliado(' tati-ane 10 '), 'TATIANE10', '§1 normaliza');
eq(R.normalizarCodigoAfiliado('Íris'), 'IRIS', '§1 tira acento');
eq(R.sugerirCodigo('Tatiane Souza'), 'TATIANE', '§1 sugestão pelo primeiro nome');
eq([R.sugerirCodigo(''), R.sugerirCodigo('Jô'), R.sugerirCodigo('Sora Lima')], ['PARCEIRO', 'PARCEIRO', 'PARCEIRO'], '§1 sem nome utilizável');
eq(R.motivoCodigoInvalido('TATIANE'), null, '§1 válido');
for (const c of ['AB', '1TATI', 'A'.repeat(21), 'tati', '', 'SORA10', 'SORAIA']) eq(!!R.motivoCodigoInvalido(c), true, `§1 recusa ${c}`);
eq(!!R.motivoCodigoInvalido('CONVIDADO50', ['CONVIDADO50']), true, '§1 cupom da casa é reservado');
eq([R.comDesconto(97, 10), R.comDesconto(47, 15), R.comDesconto(50, 0)], [87.3, 39.95, 50], '§1 preço com desconto');

// ── §2 Quem conta ───────────────────────────────────────────────────────────
const dono = { user_id: 'a', email: 'Tati@x.com', ativo: true };
const cli = (x = {}) => ({ id: 'c', email: 'c@x.com', plano: 'inativo', vitalicio: false, stripe_subscription_id: null, ...x });
eq(R.motivoNaoAtribuir(cli(), dono), null, '§2 cliente novo');
eq(R.motivoNaoAtribuir(cli({ plano: 'gratis' }), dono), null, '§2 modo grátis é novo');
eq(R.motivoNaoAtribuir(cli({ plano: null }), dono), null, '§2 sem plano é novo');
eq(R.motivoNaoAtribuir(cli({ id: 'a' }), dono), 'proprio', '§2 ele mesmo');
eq(R.motivoNaoAtribuir(cli({ email: ' tati@x.com ' }), dono), 'proprio', '§2 mesmo e-mail');
eq(R.motivoNaoAtribuir(cli({ email: null }), { ...dono, email: null }), null, '§2 e-mails vazios não são o mesmo');
eq(R.motivoNaoAtribuir(cli({ vitalicio: true }), dono), 'ja_cliente', '§2 vitalício');
eq(R.motivoNaoAtribuir(cli({ stripe_subscription_id: 'sub' }), dono), 'ja_cliente', '§2 assinante');
eq(R.motivoNaoAtribuir(cli({ plano: 'kit' }), dono), 'ja_cliente', '§2 dono do Kit');
eq(R.motivoNaoAtribuir(cli(), dono, { temComissao: true }), 'ja_cliente', '§2 já rendeu comissão');
eq(R.motivoNaoAtribuir(cli({ stripe_subscription_id: 'sub', plano: 'premium' }), dono, { noCheckout: true }), null, '§2 código usado no checkout: a assinatura é a que acabou de nascer');
eq(R.motivoNaoAtribuir(cli({ vitalicio: true }), dono, { noCheckout: true }), 'ja_cliente', '§2 vitalício nem no checkout');
eq(R.motivoNaoAtribuir(cli({ id: 'a' }), dono, { noCheckout: true }), 'proprio', '§2 ele mesmo nem no checkout');
eq(R.motivoNaoAtribuir(cli(), { ...dono, ativo: false }), 'inativo', '§2 afiliado desativado');
eq(R.motivoNaoAtribuir(null, dono), 'inativo', '§2 sem cliente');

// ── §3 Base ─────────────────────────────────────────────────────────────────
eq(R.baseDaComissao(pg('i', 0)), 2832, '§3 líquido inteiro');
eq(R.baseDaComissao(pg('i', 0, { reembolsado: 1495 })), 1416, '§3 reembolso de metade');
eq(R.baseDaComissao(pg('i', 0, { reembolsado: 2990 })), 0, '§3 reembolso total');
eq(R.baseDaComissao(pg('i', 0, { reembolsado: 9999 })), 0, '§3 reembolso maior não fica negativo');
eq(R.baseDaComissao(pg('i', 0, { contestado: true })), 0, '§3 contestação zera');
eq(R.baseDaComissao(pg('i', 0, { valorPago: 0 })), 0, '§3 cobrança zerada');
eq([R.valorDaComissao(2832, 30), R.valorDaComissao(2832, 15), R.valorDaComissao(8300, 30)], [850, 425, 2490], '§3 30% e 15%');

// ── §4 Primeira, renovações e 24 meses ──────────────────────────────────────
const meses = Array.from({ length: 27 }, (_, i) => pg(`in_${String(i).padStart(2, '0')}`, i));
let c = R.comissoesDoCliente(meses, { atribuidoEm: T0 });
eq([c[0].tipo, c[0].pct, c[0].valor], ['primeira', 30, 850], '§4 primeira 30%');
eq([c[1].tipo, c[1].pct, c[1].valor], ['renovacao', 15, 425], '§4 renovação 15%');
eq(c.length, 24, '§4 só 24 meses (a do mês 24 em diante fica fora)');
eq(c[c.length - 1].referencia, 'in_23', '§4 a última é a do mês 23');
eq(c.filter((x) => x.tipo === 'primeira').length, 1, '§4 uma única primeira');
c = R.comissoesDoCliente([...meses].reverse(), { atribuidoEm: T0 });
eq(c[0].referencia, 'in_00', '§4 a ordem de chegada não importa');
const anual = [pg('a0', 0, { valorPago: 28704, liquido: 27500 }), pg('a1', 12, { valorPago: 28704, liquido: 27500 }), pg('a2', 24, { valorPago: 28704, liquido: 27500 })];
eq(R.comissoesDoCliente(anual, { atribuidoEm: T0 }).map((x) => [x.referencia, x.valor]), [['a0', 8250], ['a1', 4125]], '§4 anual: 2 anos');
eq(R.comissoesDoCliente([pg('velha', -3), pg('nova', 0)], { atribuidoEm: T0 }).map((x) => [x.referencia, x.tipo]), [['nova', 'primeira']], '§4 cobrança de antes da atribuição não conta');
eq(R.comissoesDoCliente([pg('ja', 0, { pagoEm: T0 - 3600000 })], { atribuidoEm: T0 }).length, 1, '§4 mesma hora do checkout conta');
eq(R.comissoesDoCliente([pg('z', 0, { valorPago: 0, liquido: 0 }), pg('p', 1)], { atribuidoEm: T0 }).map((x) => x.tipo), ['primeira'], '§4 cobrança zerada não gasta a primeira');
c = R.comissoesDoCliente([pg('est', 0, { reembolsado: 2990 }), pg('boa', 1)], { atribuidoEm: T0 });
eq(c.map((x) => [x.referencia, x.tipo, x.valor]), [['est', 'primeira', 0], ['boa', 'primeira', 850]], '§4 primeira devolvida: a próxima real é a primeira');
const grav = new Map([['est', { tipo: 'primeira', pct: 30 }], ['boa', { tipo: 'renovacao', pct: 15 }]]);
c = R.comissoesDoCliente([pg('est', 0, { reembolsado: 2990 }), pg('boa', 1)], { atribuidoEm: T0, gravadas: grav });
eq(c.map((x) => [x.tipo, x.pct]), [['primeira', 30], ['renovacao', 15]], '§4 o que já foi contado não muda de percentual');
const vit = pg('mp_1', 2, { origem: 'mercadopago', tipo: 'vitalicio', valorPago: 8730, liquido: 8300 });
c = R.comissoesDoCliente([pg('m0', 0), vit, pg('m1', 1)], { atribuidoEm: T0 });
eq(c.map((x) => [x.referencia, x.tipo, x.pct]), [['m0', 'primeira', 30], ['m1', 'renovacao', 15], ['mp_1', 'vitalicio', 30]], '§4 vitalício 30%, mesmo depois da mensalidade');
c = R.comissoesDoCliente([vit, pg('m3', 3)], { atribuidoEm: T0 });
eq(c.map((x) => x.tipo), ['vitalicio', 'primeira'], '§4 vitalício não gasta a primeira da assinatura');
eq(R.comissoesDoCliente([pg('t', 40, { tipo: 'vitalicio' })], { atribuidoEm: T0 }).length, 1, '§4 vitalício não tem prazo');
eq(R.somarMeses(Date.UTC(2026, 0, 31), 1), Date.UTC(2026, 1, 28), '§4 fim de mês');

// ── §5 Do esperado pro banco ────────────────────────────────────────────────
const esp = R.comissoesDoCliente([pg('x', 0)], { atribuidoEm: T0 });
let p = R.planejarAtualizacao(esp, [], T0);
eq([p.inserir.length, p.atualizar.length], [1, 0], '§5 nova');
eq([p.inserir[0].valor_centavos, p.inserir[0].status, p.inserir[0].ajuste_n], [850, 'pendente', 0], '§5 campos');
eq(new Date(p.inserir[0].liberada_em).getTime() - new Date(p.inserir[0].pago_em).getTime(), 30 * DIA, '§5 libera em 30 dias');
const linha = (x = {}) => ({ id: 'L', referencia: 'x', ajuste_n: 0, tipo: 'primeira', pct: 30, base_centavos: 2832, valor_centavos: 850, status: 'pendente', pago_em: new Date(T0).toISOString(), liberada_em: new Date(T0 + 30 * DIA).toISOString(), ...x });
p = R.planejarAtualizacao(esp, [linha()], T0);
eq([p.inserir.length, p.atualizar.length], [0, 0], '§5 rodar de novo não muda nada');
const zerada = R.comissoesDoCliente([pg('x', 0, { reembolsado: 2990 })], { atribuidoEm: T0 });
eq(R.planejarAtualizacao(zerada, [], T0).inserir.length, 0, '§5 nascida devolvida não entra');
eq(R.planejarAtualizacao(zerada, [linha()], T0).atualizar, [{ id: 'L', campos: { status: 'cancelada' } }], '§5 estorno antes do repasse cancela');
eq(R.planejarAtualizacao(zerada, [linha({ status: 'cancelada' })], T0).atualizar, [], '§5 cancelada fica');
eq(R.planejarAtualizacao(esp, [linha({ status: 'cancelada' })], T0).atualizar, [{ id: 'L', campos: { base_centavos: 2832, valor_centavos: 850, status: 'pendente' } }], '§5 volta se o pagamento voltou a valer');
const meia = R.comissoesDoCliente([pg('x', 0, { reembolsado: 1495 })], { atribuidoEm: T0 });
eq(R.planejarAtualizacao(meia, [linha()], T0).atualizar, [{ id: 'L', campos: { base_centavos: 1416, valor_centavos: 425, status: 'pendente' } }], '§5 estorno parcial reduz');
p = R.planejarAtualizacao(zerada, [linha({ status: 'paga' })], T0 + 40 * DIA);
eq([p.atualizar.length, p.inserir.length, p.inserir[0].valor_centavos, p.inserir[0].ajuste_n], [0, 1, -850, 1], '§5 estorno DEPOIS do repasse vira desconto');
eq(new Date(p.inserir[0].liberada_em).getTime(), T0 + 40 * DIA, '§5 o desconto vale na hora');
const ajuste = linha({ id: 'A', ajuste_n: 1, valor_centavos: -850 });
p = R.planejarAtualizacao(zerada, [linha({ status: 'paga' }), ajuste], T0);
eq([p.atualizar.length, p.inserir.length], [0, 0], '§5 desconto não se repete');
p = R.planejarAtualizacao(esp, [linha({ status: 'paga' }), { ...ajuste, status: 'cancelada' }], T0);
eq([p.atualizar.length, p.inserir.length], [0, 0], '§5 ajuste cancelado não entra na soma');
p = R.planejarAtualizacao(esp, [linha({ status: 'paga' }), ajuste], T0);
eq(p.atualizar, [{ id: 'A', campos: { status: 'cancelada' } }], '§5 desconto pendente some se o valor voltou');
p = R.planejarAtualizacao(zerada, [linha({ status: 'paga' }), linha({ id: 'A', ajuste_n: 1, valor_centavos: -425 })], T0);
eq(p.atualizar, [{ id: 'A', campos: { valor_centavos: -850 } }], '§5 desconto aberto é corrigido');
p = R.planejarAtualizacao(zerada, [linha({ status: 'paga' }), linha({ id: 'A', ajuste_n: 1, valor_centavos: -425, status: 'paga' })], T0);
eq([p.inserir[0].valor_centavos, p.inserir[0].ajuste_n], [-425, 2], '§5 segundo ajuste numera adiante');
p = R.planejarAtualizacao(esp, [linha({ referencia: 'sumiu', id: 'S' })], T0);
eq(p.atualizar, [], '§5 referência que não veio na leitura não é cancelada');
eq(R.planejarAtualizacao([], [linha()], T0), { inserir: [], atualizar: [] }, '§5 leitura vazia não mexe em nada');

// ── §6 Totais ───────────────────────────────────────────────────────────────
const L = [
  linha({ id: '1', liberada_em: new Date(T0 - DIA).toISOString() }),
  linha({ id: '2', valor_centavos: 425, liberada_em: new Date(T0 + DIA).toISOString() }),
  linha({ id: '3', valor_centavos: 100, status: 'paga' }),
  linha({ id: '4', valor_centavos: 999, status: 'cancelada', liberada_em: new Date(T0 - DIA).toISOString() }),
  linha({ id: '5', valor_centavos: -300, ajuste_n: 1, liberada_em: new Date(T0 + DIA).toISOString() }),
];
eq(R.resumirComissoes(L, T0), { aReceber: 550, emCarencia: 425, recebido: 100 }, '§6 totais');
eq(L.filter((l) => R.podePagar(l, T0)).map((l) => l.id), ['1', '5'], '§6 o que entra no repasse');
eq(R.podePagar(linha({ liberada_em: new Date(T0).toISOString() }), T0), true, '§6 libera no instante exato');

console.log(`${total} verificações · ${falhas.length ? `${falhas.length} FALHAS` : 'todas ok'}`);
if (falhas.length) { for (const f of falhas) console.log('  ✘ ' + f); process.exit(1); }

// =============================================================================
// EVAL: ASSINATURA PELA GOOGLE PLAY — quando vale, que plano dá, quem rebaixa.
//
// O que este eval trava:
//   1. leitura do payload real da API (subscriptionsv2) e produto desconhecido;
//   2. quem tem direito: ativa, cancelada no prazo, carência, suspensa, expirada;
//   3. várias assinaturas da mesma pessoa (troca de plano) → o maior plano;
//   4. ⚠️ só rebaixa quem ganhou o plano PELA PLAY (vitalício/Stripe/cortesia intocados);
//   5. modo de troca: subir cobra a diferença, descer fica pra renovação.
//
// Rodar:  npm run eval:play-billing
// =============================================================================
import {
  lerAssinatura, linhaComDireito, planoDasAssinaturas, decidirPatchUsuario,
  modoDeTroca, produtoPlay, PRODUTOS_PLAY, FOLGA_VALIDADE_MS,
} from './play-billing.ts';

const falhas = [];
const eq = (a, b, m) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) falhas.push(`${m}\n     esperado ${B}\n     veio     ${A}`);
};

const AGORA = Date.parse('2026-10-19T12:00:00Z');
const DIA = 24 * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();
const linha = (plano, estado, expiraMs, intervalo = 'mensal') =>
  ({ plano, intervalo, estado, expira_em: expiraMs == null ? null : iso(expiraMs) });

console.log('── 1. lendo o que a API do Google devolve ──');
{
  const e = lerAssinatura({
    subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    latestOrderId: 'GPA.1234-5678',
    acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
    lineItems: [{ productId: 'sora_premium_anual', expiryTime: '2027-10-19T12:00:00.123Z', autoRenewingPlan: { autoRenewEnabled: true } }],
  });
  eq([e.plano, e.intervalo, e.autoRenova, e.reconhecida, e.pedido, e.teste], ['premium', 'anual', true, false, 'GPA.1234-5678', false], 'premium anual ativo lido certo');
  eq(e.expiraEm, '2027-10-19T12:00:00.123Z', 'vencimento preservado');

  const x = lerAssinatura({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', lineItems: [{ productId: 'sora_gold_mensal', expiryTime: '2027-01-01T00:00:00Z' }] });
  eq([x.produto, x.plano], ['sora_gold_mensal', null], '⚠️ produto fora do catálogo NÃO vira plano');
  eq(linhaComDireito({ plano: x.plano, intervalo: x.intervalo, estado: x.estado, expira_em: x.expiraEm }, AGORA), false, '⚠️ ...e não dá direito');

  const vazio = lerAssinatura({});
  eq([vazio.plano, vazio.expiraEm, vazio.estado], [null, null, 'SUBSCRIPTION_STATE_UNSPECIFIED'], 'payload vazio não quebra');

  eq(lerAssinatura({ testPurchase: {}, lineItems: [] }).teste, true, 'compra de teste (licença de teste) é marcada');

  // Os 6 produtos do Play Console batem com o gerador de IDs.
  for (const plano of ['basico', 'premium', 'platinum']) for (const ciclo of ['mensal', 'anual']) {
    eq(PRODUTOS_PLAY[produtoPlay(plano, ciclo)], { plano, intervalo: ciclo }, `catálogo tem ${plano} ${ciclo}`);
  }
  eq(Object.keys(PRODUTOS_PLAY).length, 6, 'são exatamente 6 produtos');
}
console.log('  ok');

console.log('── 2. quem tem direito ao plano agora ──');
eq(linhaComDireito(linha('basico', 'SUBSCRIPTION_STATE_ACTIVE', AGORA + 10 * DIA), AGORA), true, 'ativa no prazo');
eq(linhaComDireito(linha('basico', 'SUBSCRIPTION_STATE_ACTIVE', AGORA - 1000), AGORA), false, 'ativa mas vencida (aviso atrasado) não vale');
eq(linhaComDireito(linha('basico', 'SUBSCRIPTION_STATE_CANCELED', AGORA + 3 * DIA), AGORA), true, 'cancelou: vale até o fim do que pagou');
eq(linhaComDireito(linha('basico', 'SUBSCRIPTION_STATE_CANCELED', AGORA - DIA), AGORA), false, 'cancelada e vencida não vale');
eq(linhaComDireito(linha('basico', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', AGORA - 2 * DIA), AGORA), true, '⚠️ carência vale mesmo com a data vencida');
eq(linhaComDireito(linha('basico', 'SUBSCRIPTION_STATE_ON_HOLD', AGORA + DIA), AGORA), false, 'suspensa (pagamento falhou de vez) não vale');
eq(linhaComDireito(linha('basico', 'SUBSCRIPTION_STATE_PAUSED', AGORA + DIA), AGORA), false, 'pausada não vale');
eq(linhaComDireito(linha('basico', 'SUBSCRIPTION_STATE_EXPIRED', AGORA + DIA), AGORA), false, 'expirada (inclusive reembolso) não vale');
eq(linhaComDireito(linha('basico', 'SUBSCRIPTION_STATE_PENDING', AGORA + DIA), AGORA), false, 'pagamento pendente (boleto/Pix) ainda não vale');
eq(linhaComDireito(linha('basico', 'SUBSCRIPTION_STATE_ACTIVE', null), AGORA), false, 'sem data de vencimento não vale');
eq(linhaComDireito(linha('kit', 'SUBSCRIPTION_STATE_ACTIVE', AGORA + DIA), AGORA), false, 'plano que a Play não vende não vale');
console.log('  ok');

console.log('── 3. várias assinaturas da mesma pessoa ──');
eq(planoDasAssinaturas([], AGORA), null, 'sem assinatura → nada');
eq(planoDasAssinaturas([linha('premium', 'SUBSCRIPTION_STATE_EXPIRED', AGORA - DIA)], AGORA), null, 'só expirada → nada');
{
  const r = planoDasAssinaturas([linha('basico', 'SUBSCRIPTION_STATE_ACTIVE', AGORA + 20 * DIA)], AGORA);
  eq(r, { plano: 'basico', intervalo: 'mensal', validoAte: iso(AGORA + 20 * DIA + FOLGA_VALIDADE_MS) }, 'validade = vencimento + 1 dia de folga');
}
{
  // Subiu de Básico pra Premium: a antiga expira, a nova vale.
  const r = planoDasAssinaturas([
    linha('basico', 'SUBSCRIPTION_STATE_EXPIRED', AGORA - 1000),
    linha('premium', 'SUBSCRIPTION_STATE_ACTIVE', AGORA + 30 * DIA),
  ], AGORA);
  eq(r?.plano, 'premium', 'upgrade: vale a nova');
}
{
  // ⚠️ Desceu de Premium pra Básico (troca ADIADA): as duas convivem até a
  // renovação, e quem pagou o Premium continua nele até lá.
  const r = planoDasAssinaturas([
    linha('premium', 'SUBSCRIPTION_STATE_CANCELED', AGORA + 5 * DIA),
    linha('basico', 'SUBSCRIPTION_STATE_ACTIVE', AGORA + 35 * DIA),
  ], AGORA);
  eq([r?.plano, r?.validoAte], ['premium', iso(AGORA + 5 * DIA + FOLGA_VALIDADE_MS)], '⚠️ downgrade adiado: mantém o maior até ele vencer');
  const depois = planoDasAssinaturas([
    linha('premium', 'SUBSCRIPTION_STATE_CANCELED', AGORA + 5 * DIA),
    linha('basico', 'SUBSCRIPTION_STATE_ACTIVE', AGORA + 35 * DIA),
  ], AGORA + 6 * DIA);
  eq(depois?.plano, 'basico', '...e passa pro menor quando o maior vence');
}
{
  // Mesmo plano em dois ciclos: vale a que vai mais longe.
  const r = planoDasAssinaturas([
    linha('premium', 'SUBSCRIPTION_STATE_ACTIVE', AGORA + 10 * DIA, 'mensal'),
    linha('premium', 'SUBSCRIPTION_STATE_ACTIVE', AGORA + 300 * DIA, 'anual'),
  ], AGORA);
  eq([r?.intervalo, r?.validoAte], ['anual', iso(AGORA + 300 * DIA + FOLGA_VALIDADE_MS)], 'empate de plano → maior validade');
}
{
  const r = planoDasAssinaturas([linha('basico', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', AGORA - 3 * DIA)], AGORA);
  eq(r?.validoAte, iso(AGORA + FOLGA_VALIDADE_MS), 'carência com data vencida segura 1 dia à frente (não grava data no passado)');
}
console.log('  ok');

console.log('── 4. ⚠️ quem pode ser rebaixado ──');
const PLAY = { plano: 'premium', intervalo: 'anual', validoAte: '2027-10-20T12:00:00.000Z' };
eq(decidirPatchUsuario({ plano: 'gratis' }, PLAY),
  { plano: 'premium', plano_intervalo: 'anual', plano_valido_ate: '2027-10-20T12:00:00.000Z', plano_fonte: 'play' }, 'comprou na Play → ganha o plano, marcado como da Play');
eq(decidirPatchUsuario({ plano: 'premium', plano_fonte: 'play' }, null),
  { plano: 'gratis', plano_intervalo: null, plano_valido_ate: null, plano_fonte: null }, 'assinatura Play acabou → volta pro grátis (nunca inativo)');
eq(decidirPatchUsuario({ plano: 'premium', vitalicio: true, plano_fonte: null }, null), null, '⚠️ vitalício nunca é rebaixado por aviso da Play');
eq(decidirPatchUsuario({ plano: 'basico', stripe_subscription_id: 'sub_1', plano_fonte: null }, null), null, '⚠️ assinante do Stripe nunca é rebaixado');
eq(decidirPatchUsuario({ plano: 'premium', plano_fonte: null }, null), null, '⚠️ cortesia do admin (sem fonte) intocada');
eq(decidirPatchUsuario({ plano: 'premium', plano_fonte: 'play', stripe_subscription_id: 'sub_2' }, null), { plano_fonte: null },
  'veio da Play mas hoje tem Stripe: só limpa a marca, não tira o plano');
eq(decidirPatchUsuario({ plano: 'gratis', plano_fonte: null }, null), null, 'grátis sem assinatura: nada a fazer');
console.log('  ok');

console.log('── 5. modo de troca ──');
eq(modoDeTroca('basico', 'premium'), 'chargeProratedPrice', 'subir: libera na hora e cobra a diferença');
eq(modoDeTroca('premium', 'platinum'), 'chargeProratedPrice', 'subir de novo');
eq(modoDeTroca('platinum', 'basico'), 'deferred', 'descer: na próxima renovação');
eq(modoDeTroca('premium', 'premium'), 'deferred', 'só trocar de ciclo: na próxima renovação');
console.log('  ok');

if (falhas.length) {
  console.log(`\n❌ ${falhas.length} falha(s):\n  - ` + falhas.join('\n  - '));
  process.exit(1);
}
console.log('\ntudo passou ✅');

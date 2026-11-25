// =============================================================================
// EVAL: ASSINATURA PELA APPLE — quando vale, que plano dá, quem rebaixa.
//
// O que este eval trava:
//   1. leitura do que a App Store devolve (status + transação + renovação);
//   2. quem tem direito: ativa, carência, tentando cobrar, expirada, revogada;
//   3. várias assinaturas da mesma pessoa → o maior plano;
//   4. ⚠️ a Apple só manda no plano de quem não tem plano por outro caminho;
//   5. ⚠️ só rebaixa quem ganhou o plano PELA APPLE.
//
// Rodar:  npm run eval:apple-billing
// =============================================================================
import {
  lerAssinaturaApple, linhaComDireitoApple, planoDasAssinaturasApple,
  appleMandaNoPlano, decidirPatchUsuarioApple, estadoDoStatus, produtoApple,
} from './apple-billing.ts';
import { FOLGA_VALIDADE_MS } from './play-billing.ts';

const falhas = [];
let total = 0;
const eq = (a, b, m) => {
  total++;
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) falhas.push(`${m}\n     esperado ${B}\n     veio     ${A}`);
};

const AGORA = Date.parse('2026-11-25T12:00:00Z');
const DIA = 24 * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();
const linha = (plano, estado, expiraMs, intervalo = 'mensal') =>
  ({ plano, intervalo, estado, expira_em: expiraMs == null ? null : iso(expiraMs) });
const CONTA = 'ba503ab7-4a21-41aa-b314-3ba19b544771';

console.log('── 1. lendo o que a App Store devolve ──');
{
  const tx = {
    productId: 'sora_premium_mensal', originalTransactionId: '2000000111', transactionId: '2000000222',
    expiresDate: AGORA + 20 * DIA, appAccountToken: CONTA.toUpperCase(), environment: 'Sandbox',
  };
  const l = lerAssinaturaApple(1, tx, { autoRenewStatus: 1, autoRenewProductId: 'sora_premium_mensal' });
  eq(l.plano, 'premium', 'produto do catálogo → plano');
  eq(l.intervalo, 'mensal', 'produto do catálogo → ciclo');
  eq(l.estado, 'ativa', 'status 1 = ativa');
  eq(l.expiraEm, iso(AGORA + 20 * DIA), 'vencimento vem do expiresDate');
  eq(l.autoRenova, true, 'renovação automática ligada');
  eq(l.conta, CONTA, 'appAccountToken normalizado em minúsculas');
  eq(l.ambiente, 'Sandbox', 'ambiente guardado (sandbox = teste)');
  eq(l.proximoProduto, null, 'renova no mesmo produto → sem troca agendada');

  const desce = lerAssinaturaApple(1, { ...tx, productId: 'sora_platinum_anual' }, { autoRenewStatus: 1, autoRenewProductId: 'sora_basico_anual' });
  eq(desce.proximoProduto, 'sora_basico_anual', 'troca pra baixo agendada aparece');

  const desconhecido = lerAssinaturaApple(1, { ...tx, productId: 'sora_ouro_mensal' });
  eq([desconhecido.plano, desconhecido.intervalo], [null, null], '⚠️ produto fora do catálogo NÃO vira plano');

  const lixo = lerAssinaturaApple(1, { ...tx, appAccountToken: 'nao-e-uuid' });
  eq(lixo.conta, null, 'appAccountToken que não é UUID é ignorado');

  const carencia = lerAssinaturaApple(4, { ...tx, expiresDate: AGORA - DIA }, { gracePeriodExpiresDate: AGORA + 10 * DIA });
  eq(carencia.estado, 'carencia', 'status 4 = carência');
  eq(carencia.expiraEm, iso(AGORA + 10 * DIA), '⚠️ na carência vale a data da carência, não a do vencimento');

  const reembolso = lerAssinaturaApple(1, { ...tx, revocationDate: AGORA - DIA });
  eq(reembolso.estado, 'revogada', '⚠️ revocationDate na transação = revogada, mesmo com status 1');
  eq(lerAssinaturaApple(1, tx, { autoRenewStatus: 0 }).autoRenova, false, 'cancelou a renovação');

  eq([1, 2, 3, 4, 5, 9, undefined].map(estadoDoStatus),
    ['ativa', 'expirada', 'tentando_cobrar', 'carencia', 'revogada', 'desconhecido', 'desconhecido'], 'tabela de status');
  eq(produtoApple('platinum', 'anual'), 'sora_platinum_anual', 'ID igual ao da Play');
}

console.log('── 2. quem tem direito ──');
{
  eq(linhaComDireitoApple(linha('premium', 'ativa', AGORA + DIA), AGORA), true, 'ativa no prazo');
  eq(linhaComDireitoApple(linha('premium', 'ativa', AGORA - 1), AGORA), false, 'ativa com data vencida (aviso atrasado) = sem direito');
  eq(linhaComDireitoApple(linha('premium', 'carencia', AGORA + DIA), AGORA), true, 'carência no prazo');
  eq(linhaComDireitoApple(linha('premium', 'carencia', null), AGORA), true, 'carência sem data = direito (a Apple garante)');
  eq(linhaComDireitoApple(linha('premium', 'tentando_cobrar', AGORA + DIA), AGORA), false, '⚠️ tentando cobrar SEM carência = sem direito');
  eq(linhaComDireitoApple(linha('premium', 'expirada', AGORA + DIA), AGORA), false, 'expirada');
  eq(linhaComDireitoApple(linha('premium', 'revogada', AGORA + DIA), AGORA), false, 'revogada (reembolso)');
  eq(linhaComDireitoApple(linha(null, 'ativa', AGORA + DIA), AGORA), false, 'produto desconhecido nunca dá direito');
  eq(linhaComDireitoApple(linha('ouro', 'ativa', AGORA + DIA), AGORA), false, 'plano fora da ordem nunca dá direito');
}

console.log('── 3. várias assinaturas → o maior plano ──');
{
  const r = planoDasAssinaturasApple([
    linha('basico', 'ativa', AGORA + 300 * DIA, 'anual'),
    linha('platinum', 'ativa', AGORA + 10 * DIA),
    linha('premium', 'expirada', AGORA + 50 * DIA),
  ], AGORA);
  eq(r, { plano: 'platinum', intervalo: 'mensal', validoAte: iso(AGORA + 10 * DIA + FOLGA_VALIDADE_MS) }, 'maior plano com direito, + 1 dia de folga');
  eq(planoDasAssinaturasApple([linha('premium', 'expirada', AGORA + DIA)], AGORA), null, 'nenhuma com direito → null');
  const mesmo = planoDasAssinaturasApple([
    linha('premium', 'ativa', AGORA + 5 * DIA), linha('premium', 'ativa', AGORA + 30 * DIA, 'anual'),
  ], AGORA);
  eq(mesmo?.intervalo, 'anual', 'mesmo plano: vale o que vence mais longe');
  const car = planoDasAssinaturasApple([linha('premium', 'carencia', null)], AGORA);
  eq(car?.validoAte, iso(AGORA + FOLGA_VALIDADE_MS), 'carência sem data segura um dia à frente');
}

console.log('── 4. quando a Apple manda no plano ──');
{
  eq(appleMandaNoPlano({ plano: 'gratis' }), true, 'grátis compra → vale');
  eq(appleMandaNoPlano({ plano: 'inativo' }), true, 'inativo compra → vale');
  eq(appleMandaNoPlano({ plano: null }), true, 'sem plano → vale');
  eq(appleMandaNoPlano({ plano: 'premium', plano_fonte: 'apple' }), true, 'já é da Apple (troca de plano) → vale');
  eq(appleMandaNoPlano({ plano: 'premium', vitalicio: true }), false, '⚠️ vitalício → a Apple não mexe');
  eq(appleMandaNoPlano({ plano: 'kit', vitalicio: true }), false, '⚠️ Kit → a Apple não mexe');
  // Caso real (Cesar, nov/2026): vitalício que ficou 'inativo' por erro de
  // sincronização. A compra da Apple não pode "adotar" a conta — o vitalício
  // tem de ser consertado, não substituído por uma assinatura.
  eq(appleMandaNoPlano({ plano: 'inativo', vitalicio: true }), false, '⚠️ vitalício que ficou inativo por erro → a Apple não mexe');
  eq(appleMandaNoPlano({ plano: 'premium', stripe_subscription_id: 'sub_1' }), false, '⚠️ assinante do site → a Apple não mexe');
  eq(appleMandaNoPlano({ plano: 'basico', plano_fonte: 'play' }), false, '⚠️ assinante da Play → a Apple não mexe');
  eq(appleMandaNoPlano({ plano: 'premium' }), false, '⚠️ cortesia do admin → a Apple não mexe');
}

console.log('── 5. o que gravar em users ──');
{
  const apple = { plano: 'premium', intervalo: 'anual', validoAte: iso(AGORA + 30 * DIA) };
  eq(decidirPatchUsuarioApple({ plano: 'gratis' }, apple),
    { plano: 'premium', plano_intervalo: 'anual', plano_valido_ate: iso(AGORA + 30 * DIA), plano_fonte: 'apple' }, 'compra vale → plano + fonte apple');
  eq(decidirPatchUsuarioApple({ plano: 'premium', stripe_subscription_id: 'sub_1' }, apple), null, '⚠️ assinante do site comprou na Apple → plano intocado');
  eq(decidirPatchUsuarioApple({ plano: 'premium', vitalicio: true }, apple), null, '⚠️ vitalício comprou na Apple → plano intocado');
  eq(decidirPatchUsuarioApple({ plano: 'premium', plano_fonte: 'apple' }, null),
    { plano: 'gratis', plano_intervalo: null, plano_valido_ate: null, plano_fonte: null }, 'Apple acabou → grátis (nunca inativo)');
  eq(decidirPatchUsuarioApple({ plano: 'premium', plano_fonte: 'play' }, null), null, '⚠️ fonte Play → aviso da Apple não rebaixa');
  eq(decidirPatchUsuarioApple({ plano: 'premium', plano_fonte: null }, null), null, '⚠️ fonte desconhecida (site/cortesia) → não rebaixa');
  eq(decidirPatchUsuarioApple({ plano: 'premium', plano_fonte: 'apple', vitalicio: true }, null), { plano_fonte: null },
    'vitalício que também teve Apple → só solta a fonte, mantém o plano');
  eq(decidirPatchUsuarioApple({ plano: 'premium', plano_fonte: 'apple', stripe_subscription_id: 'sub_1' }, null), { plano_fonte: null },
    'assinante do site que também teve Apple → só solta a fonte');
}

console.log(`\n${total - falhas.length}/${total} verificações passaram`);
if (falhas.length) {
  console.error('\n✗ FALHAS:\n  ' + falhas.join('\n  '));
  process.exit(1);
}
console.log('✓ eval:apple-billing ok');

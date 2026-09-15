// =============================================================================
// EVAL: NO APP ANDROID A SORA É GRÁTIS — inclusive pra conta criada no site.
//
// Caso real: conta criada no site em 13/09, foi até o checkout, não pagou
// (`inativo`), instalou o app em 14/09 e caía na /planos com preço do Stripe —
// que além de travar a pessoa é o que a política do Google proíbe no app.
//
// O que este eval trava:
//   1. no app, `inativo` fora de rota livre → converter pro grátis (nunca /planos);
//   2. na WEB nada mudou: `inativo` → /planos, e as rotas de compra seguem livres;
//   3. quem já tem plano (pago ou grátis) nunca é tocado, em lugar nenhum;
//   4. o destino depois de liberar: tour pra quem não fez onboarding.
//
// Rodar:  npm run eval:paywall
// =============================================================================
import { decidirPaywall, destinoAposGratis } from './paywall.ts';

const falhas = [];
const eq = (a, b, m) => { if (a !== b) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };

console.log('── 1. o caso do relato: inativo abrindo o app ──');
eq(decidirPaywall({ plano: 'inativo', pathname: '/dashboard', android: true }), 'converter-gratis', 'start_url do app (/dashboard) libera o grátis');
eq(decidirPaywall({ plano: 'inativo', pathname: '/transacoes', android: true }), 'converter-gratis', 'qualquer aba do app libera');
// ⚠️ A /planos NO APP também converte: é tela de preço, e o app pode reabrir nela.
eq(decidirPaywall({ plano: 'inativo', pathname: '/planos', android: true }), 'converter-gratis', '/planos no app não fica parada mostrando preço');
eq(decidirPaywall({ plano: 'inativo', pathname: '/checkout-vitalicio', android: true }), 'converter-gratis', 'checkout no app também');
// Rotas livres não disparam (o próprio /tour é o destino; o /signup tem o seu fluxo).
eq(decidirPaywall({ plano: 'inativo', pathname: '/tour', android: true }), 'rota-livre', '/tour não reconverte (evita laço)');
eq(decidirPaywall({ plano: 'inativo', pathname: '/signup', android: true }), 'rota-livre', 'cadastro no app segue o fluxo dele');
eq(decidirPaywall({ plano: 'inativo', pathname: '/api/me', android: true }), 'rota-livre', 'rota de API nunca');
console.log('  ok');

console.log('── 2. ⚠️ na WEB nada muda ──');
eq(decidirPaywall({ plano: 'inativo', pathname: '/dashboard', android: false }), 'planos', 'inativo no site → /planos');
eq(decidirPaywall({ plano: 'inativo', pathname: '/onboarding', android: false }), 'planos', 'onboarding no site ainda exige plano');
eq(decidirPaywall({ plano: 'inativo', pathname: '/planos', android: false }), 'rota-livre', '/planos livre no site (é onde paga)');
eq(decidirPaywall({ plano: 'inativo', pathname: '/oferta', android: false }), 'rota-livre', '/oferta livre no site');
eq(decidirPaywall({ plano: 'inativo', pathname: '/checkout-vitalicio', android: false }), 'rota-livre', 'checkout livre no site');
eq(decidirPaywall({ plano: 'inativo', pathname: '/', android: false }), 'rota-livre', 'landing livre');
console.log('  ok');

console.log('── 3. quem já tem plano nunca é tocado ──');
for (const plano of ['gratis', 'basico', 'kit', 'premium', 'platinum']) {
  for (const android of [true, false]) {
    eq(decidirPaywall({ plano, pathname: '/dashboard', android }), 'plano-ativo', `${plano} (${android ? 'app' : 'site'}) segue livre`);
    eq(decidirPaywall({ plano, pathname: '/planos', android }), 'plano-ativo', `${plano} na /planos (${android ? 'app' : 'site'}) não converte`);
  }
}
console.log('  ok');

console.log('── 4. para onde vai depois de liberar ──');
eq(destinoAposGratis({ onboardingCompleto: false, pathname: '/dashboard' }), '/tour', 'sem onboarding → tour (mesma entrada do cadastro no app)');
eq(destinoAposGratis({ onboardingCompleto: false, pathname: '/planos' }), '/tour', 'sem onboarding, vindo da /planos → tour');
eq(destinoAposGratis({ onboardingCompleto: true, pathname: '/planos' }), '/dashboard', 'com onboarding, numa tela de preço → painel');
eq(destinoAposGratis({ onboardingCompleto: true, pathname: '/transacoes' }), null, 'com onboarding, já no app → fica onde está');
console.log('  ok');

console.log(`\n${falhas.length ? `${falhas.length} FALHA(S) ❌` : 'tudo passou ✅'}`);
if (falhas.length) { falhas.forEach((f) => console.log('  · ' + f)); process.exit(1); }

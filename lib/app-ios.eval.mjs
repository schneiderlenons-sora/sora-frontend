// =============================================================================
// EVAL: NO APP DE IPHONE NADA SE VENDE — e fora dele nada muda.
//
// A marca vem no User-Agent (`SoraApp-iOS`, do capacitor.config.json em
// `ios-app/`). O que este eval trava:
//   1. reconhecer o app pelo User-Agent REAL do WKWebView, e nunca o Safari,
//      o Chrome do iPhone ou o app do Android;
//   2. quais páginas o middleware tira do app (landing com preço, funis,
//      checkout) — e que o PAINEL, o login e a /planos continuam abrindo;
//   3. prefixo não casa por acidente (`/kitchen` não é `/kit`, `/esportes`
//      não é `/es`), e a raiz casa só exata.
//
// Rodar:  npm run eval:app-ios
// =============================================================================
import { uaEhAppIos, rotaDeVendaNoAppIos, MARCA_APP_IOS } from './app-ios.ts';

const falhas = [];
const eq = (a, b, m) => { if (a !== b) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };

// User-Agents reais (o do app = WKWebView + `appendUserAgent`).
const UA_APP_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SoraApp-iOS';
const UA_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const UA_CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1';
const UA_TWA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';
const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

console.log('── 1. quem é o app de iPhone ──');
eq(MARCA_APP_IOS, 'SoraApp-iOS', 'a marca é a mesma do capacitor.config.json');
eq(uaEhAppIos(UA_APP_IOS), true, 'WKWebView do app');
eq(uaEhAppIos(UA_SAFARI), false, 'Safari do iPhone NÃO é o app (lá a venda segue)');
eq(uaEhAppIos(UA_CHROME_IOS), false, 'Chrome do iPhone NÃO é o app');
eq(uaEhAppIos(UA_TWA_ANDROID), false, 'app do Android NÃO é o de iPhone (lá vende pela Play)');
eq(uaEhAppIos(UA_DESKTOP), false, 'computador');
eq(uaEhAppIos(null), false, 'sem User-Agent');
eq(uaEhAppIos(undefined), false, 'User-Agent indefinido');
eq(uaEhAppIos(''), false, 'User-Agent vazio');
console.log('  ok');

console.log('── 2. páginas de venda saem do app ──');
for (const r of ['/', '/oferta', '/kit', '/checkout-vitalicio', '/checkout-vitalicio/sucesso', '/financas', '/chat', '/quiz', '/es', '/es/precios']) {
  eq(rotaDeVendaNoAppIos(r), true, `${r} é página de venda`);
}
console.log('  ok');

console.log('── 3. ⚠️ o painel continua abrindo ──');
for (const r of ['/login', '/signup', '/dashboard', '/planos', '/configuracoes', '/open-finance', '/tour', '/onboarding',
                 '/transacoes', '/privacidade', '/termos', '/excluir-conta', '/convite/ABC123', '/negocios', '/redefinir-senha']) {
  eq(rotaDeVendaNoAppIos(r), false, `${r} NÃO é página de venda`);
}
console.log('  ok');

console.log('── 4. prefixo não casa por acidente ──');
eq(rotaDeVendaNoAppIos('/kitchen'), false, '/kitchen não é /kit');
eq(rotaDeVendaNoAppIos('/esportes'), false, '/esportes não é /es');
eq(rotaDeVendaNoAppIos('/chats'), false, '/chats não é /chat');
eq(rotaDeVendaNoAppIos('/ofertas-do-mes'), false, '/ofertas-do-mes não é /oferta');
console.log('  ok');

console.log(`\n${falhas.length ? `${falhas.length} FALHA(S) ❌` : 'tudo passou ✅'}`);
if (falhas.length) { falhas.forEach((f) => console.log('  · ' + f)); process.exit(1); }

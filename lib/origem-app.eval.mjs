// =============================================================================
// EVAL: SÓ O APP DA SORA CONTA COMO "DENTRO DO APP".
//
// POR QUE EXISTE: a regra era `referrer.startsWith('android-app://')`, que casa
// com QUALQUER app Android. O Chrome marca todo link aberto a partir de um app
// como `android-app://<pacote>/` — então um link da Sora tocado no WhatsApp
// fazia a sessão do navegador virar "app Android" para sempre (a marca fica em
// localStorage).
//
// O que isso escondia de quem só usava o navegador: itens da barra lateral, a
// aba Saúde, o fluxo normal de cadastro e o convite da Play Store — este
// último justamente de quem ainda não tinha instalado. Foi o convite que
// denunciou o problema: a barra "não aparecia" e a conta estava marcada como
// quem já abriu o app.
//
// Rodar:  npm run eval:origem-app
// =============================================================================
import { referrerEhDoApp } from './origem-app.ts';

const falhas = [];
const ok = (cond, msg) => { if (!cond) falhas.push(msg); };

console.log('── 1. o app da Sora é reconhecido ──');
ok(referrerEhDoApp('android-app://com.forsora.app/'), 'referrer do TWA com barra final');
ok(referrerEhDoApp('android-app://com.forsora.app'), 'referrer do TWA sem barra final');
console.log('  ok');

console.log('── 2. OUTROS APPS NÃO SÃO O APP DA SORA (o bug) ──');
ok(!referrerEhDoApp('android-app://com.whatsapp/'), 'link aberto pelo WhatsApp');
ok(!referrerEhDoApp('android-app://com.google.android.gm/'), 'link aberto pelo Gmail');
ok(!referrerEhDoApp('android-app://com.instagram.android/'), 'link aberto pelo Instagram');
ok(!referrerEhDoApp('android-app://com.google.android.googlequicksearchbox/'), 'app do Google');
console.log('  ok');

console.log('── 3. nada de casar por prefixo ──');
// Sem o `(/|$)` isto passaria: o nome do nosso pacote é prefixo do outro.
ok(!referrerEhDoApp('android-app://com.forsora.app.falso/'), 'pacote que COMEÇA igual não é o nosso');
ok(!referrerEhDoApp('android-app://com.forsora.apple/'), 'pacote parecido não é o nosso');
// O ponto do nome do pacote é literal, não "qualquer caractere".
ok(!referrerEhDoApp('android-app://comXforsoraXapp/'), 'ponto do pacote é literal');
console.log('  ok');

console.log('── 4. vazio e web ──');
ok(!referrerEhDoApp(''), 'sem referrer');
ok(!referrerEhDoApp(null), 'null');
ok(!referrerEhDoApp(undefined), 'undefined');
ok(!referrerEhDoApp('https://www.forsora.com/dashboard'), 'navegação interna');
ok(!referrerEhDoApp('https://l.facebook.com/'), 'link vindo de site');
console.log('  ok');

console.log(`\n${falhas.length ? `${falhas.length} FALHA(S) ❌` : 'tudo passou ✅'}`);
if (falhas.length) {
  falhas.forEach((f) => console.log(`  · ${f}`));
  process.exit(1);
}

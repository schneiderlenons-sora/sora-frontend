// =============================================================================
// EVAL — validação do emoji digitado pelo usuário.
//
// Pedido de cliente (Sebastião, 26/09/2026): "acrescentar emojis com relação a
// obras e reformas, ou colocar a opção de nós mesmo carregar o emoji".
//
// O campo livre é o que atende o pedido de vez, mas `categorias.icone` é
// renderizado cru em dezenas de telas. Texto solto ali não dá erro — entorta
// as telas em silêncio. Este eval trava o que entra.
//
// Rodar:  npm run eval:emoji
// =============================================================================
import { ehEmoji, primeiroEmoji } from './emoji-valido.ts';

const falhas = [];
const eq = (a, b, m) => { if (a !== b) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };

console.log('── 1. emojis de OBRAS E REFORMAS (o pedido do cliente) ──');
for (const e of ['🧱', '🔨', '🪚', '🪛', '🔧', '🪜', '👷', '🏗️', '🚧', '🪵', '⛏️', '⚒️', '🛠️', '🧰', '🪞', '🚪']) {
  eq(ehEmoji(e), true, `"${e}" tem de ser aceito`);
}
console.log('  ok');

console.log('── 2. emojis compostos continuam valendo ──');
{
  eq(ehEmoji('👷‍♀️'), true, 'ZWJ com símbolo de gênero');
  eq(ehEmoji('👨‍👩‍👧‍👦'), true, 'família (3 ZWJ)');
  eq(ehEmoji('🧑‍🔧'), true, 'profissão via ZWJ');
  eq(ehEmoji('👍🏽'), true, 'tom de pele');
  eq(ehEmoji('❤️'), true, 'com seletor de variação');
  eq(ehEmoji('🇧🇷'), true, 'bandeira (indicadores regionais)');
  eq(ehEmoji('1️⃣'), true, 'tecla');
}
console.log('  ok');

console.log('── 3. ⚠️ O QUE NÃO PODE ENTRAR ──');
{
  // É este o estrago que o campo livre abriria: `icone` vai cru pra lista,
  // dashboard, gráficos, extrato e WhatsApp.
  eq(ehEmoji('casa'), false, '⚠️ palavra NÃO é emoji');
  eq(ehEmoji('a'), false, 'letra solta');
  eq(ehEmoji('123'), false, 'número');
  eq(ehEmoji(''), false, 'vazio');
  eq(ehEmoji('   '), false, 'só espaço');
  eq(ehEmoji('Reforma da casa 🔨'), false, 'frase com emoji no fim');
  eq(ehEmoji('🔨 reforma'), false, 'emoji seguido de texto');
  eq(ehEmoji('🙂🙂'), false, '⚠️ DOIS emojis colados não passam como um');
  eq(ehEmoji('🧱🔨🪚'), false, 'três emojis');
  eq(ehEmoji('<script>'), false, 'texto com símbolo');
  eq(ehEmoji('.'), false, 'pontuação');
  eq(ehEmoji('x'.repeat(500)), false, '⚠️ texto colado por engano');
}
console.log('  ok');

console.log('── 4. primeiroEmoji: aproveita em vez de recusar ──');
{
  eq(primeiroEmoji('🧱'), '🧱', 'emoji único volta igual');
  eq(primeiroEmoji('  🔨  '), '🔨', 'espaços em volta são aparados');
  // ⚠️ Colar dois é engano comum — fica com o primeiro em vez de dar erro.
  eq(primeiroEmoji('🧱🔨'), '🧱', '⚠️ dois colados: fica com o primeiro');
  eq(primeiroEmoji('👷‍♀️🔨'), '👷‍♀️', 'composto + outro: preserva o composto inteiro');
  eq(primeiroEmoji('🇧🇷🇺🇸'), '🇧🇷', 'duas bandeiras: fica com a primeira');
  // ⚠️ Mas texto continua sendo recusado — "aproveitar" nunca vira "aceitar".
  eq(primeiroEmoji('casa'), null, '⚠️ palavra segue recusada');
  eq(primeiroEmoji('reforma 🔨'), null, '⚠️ emoji NO FIM de texto não é aproveitado');
  eq(primeiroEmoji(''), null, 'vazio');
  eq(primeiroEmoji('x'.repeat(500)), null, 'texto gigante');
}
console.log('  ok');

console.log('── 5. os emojis que JÁ estão no catálogo continuam válidos ──');
{
  // Amostra do que o modal já oferece: se algum deixasse de passar, o campo
  // livre recusaria um ícone que o próprio seletor entrega.
  for (const e of ['🛒', '🚗', '🍔', '🏠', '💊', '📦', '🏗️', '🛠️', '🧑‍💼', '❤️‍🩹', '🛏️', '⚙️']) {
    eq(ehEmoji(e), true, `catálogo: "${e}"`);
  }
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('✓ emoji-valido: todos os casos passaram');

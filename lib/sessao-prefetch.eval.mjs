// =============================================================================
// EVAL da regra de sessão do middleware: UM PALPITE DO ROTEADOR PODE RENOVAR A
// SESSÃO, NUNCA ENCERRÁ-LA.
//
// POR QUE EXISTE: terceiro relato do mesmo cliente — "no mobile, clico no menu,
// a sidebar abre por 1 segundo e vai pro login". Ele navegava normalmente entre
// as abas; só o MENU derrubava. E estava com VPN.
//
// O mecanismo:
//   1. no mobile a sidebar fica montada FORA da tela e o menu só a desloca;
//   2. ao abrir, todos os `<Link>` dela entram no viewport de uma vez e o Next
//      prefetcha cada um — uma RAJADA de requisições no mesmo instante;
//   3. todas chegam com o MESMO refresh token vencido; o Supabase ROTACIONA, a
//      primeira consome o token e as demais chegam com um token já morto;
//   4. a que falha volta sem usuário, o middleware escreve os cookies de sessão
//      VAZIOS e redireciona pro login — matando a sessão que a primeira acabou
//      de renovar. Com VPN a rajada se espalha e passa da janela de reuso do
//      refresh token, que é o que normalmente segura esse empate.
//
// Por isso navegar ia bem (uma requisição por vez, sem corrida) e o menu não.
//
// Este arquivo testa a DECISÃO, sem rede: dado (é palpite?, tem usuário?, rota
// pública?), o middleware redireciona? apaga cookie?
//
// Rodar:  npm run eval:sessao-prefetch
// =============================================================================
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');
const falhas = [];
const ok = (c, m) => { if (!c) falhas.push(m); };
const eq = (a, b, m) => ok(a === b, `${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`);

// ── 1. O middleware reconhece o cabeçalho do prefetch ───────────────────────
//
// ⚠️ O nome vem do Next (`app-router-headers`: 'next-router-prefetch'). Errar a
// string não quebra nada visivelmente — só devolve o bug inteiro, calado.
console.log('── 1. o cabeçalho certo ──');
{
  ok(src.includes("request.headers.get('next-router-prefetch')"),
    'lê o cabeçalho `next-router-prefetch`');
  ok(/const ehPalpite\s*=/.test(src), 'guarda a resposta em `ehPalpite`');
}
console.log('  ok');

// ── 2. As DUAS travas existem ───────────────────────────────────────────────
//
// ⚠️ Não redirecionar NÃO BASTA. Quando a renovação falha, o `setAll` do
// Supabase já escreveu os cookies de sessão VAZIOS no `response`; devolvê-los
// encerra a sessão no navegador do mesmo jeito — só que sem sair da tela, o que
// é pior de diagnosticar. As duas travas são necessárias, e é fácil "corrigir"
// só a primeira e achar que resolveu.
console.log('── 2. não redireciona E não apaga cookie ──');
{
  ok(/if \(!user && !isPublica && !ehPalpite\)/.test(src),
    'o redirect pro login exclui o palpite');
  ok(/if \(ehPalpite && !user\)\s*\{[\s\S]{0,200}NextResponse\.next/.test(src),
    'palpite sem usuário devolve resposta LIMPA, sem os cookies apagados');
}
console.log('  ok');

// ── 3. O palpite BEM-SUCEDIDO continua persistindo a renovação ─────────────
//
// ⚠️ A tentação é ignorar auth em prefetch. Seria pior: o `getUser()` renova e
// o Supabase rotaciona ANTES de qualquer decisão nossa — jogar fora os cookies
// novos deixaria o navegador com o token que acabou de morrer. Por isso a saída
// limpa é só no ramo SEM usuário.
console.log('── 3. renovação bem-sucedida segue valendo ──');
{
  const trecho = src.slice(src.indexOf('if (ehPalpite && !user)'));
  ok(trecho.includes('return NextResponse.next'), 'a saída limpa existe');
  ok(!/if \(ehPalpite\)\s*\{[\s\S]{0,80}return/.test(src),
    'NÃO existe saída antecipada pra palpite COM usuário (perderia o par renovado)');
  ok(src.indexOf('supabase.auth.getUser()') < src.indexOf('if (ehPalpite && !user)'),
    'o getUser roda ANTES da decisão — é ele que renova');
}
console.log('  ok');

// ── 4. O redirect real continua levando destino e motivo ───────────────────
console.log('── 4. o redirect de verdade não mudou ──');
{
  ok(src.includes("destino.searchParams.set('next'"), 'leva o destino');
  ok(src.includes("destino.searchParams.set('motivo', 'sessao')"), 'e diz o motivo');
  ok(src.includes('comCookies(NextResponse.redirect(destino))'),
    'e sai por comCookies — sem isso o redirect desloga de verdade');
}
console.log('  ok');

// ── 5. A sidebar não pode voltar a prefetchar em rajada ────────────────────
//
// ⚠️ Esta é a CAUSA; as travas acima são a rede de proteção. `<Link>` sem
// `prefetch={false}` numa barra que aparece inteira de uma vez dispara a rajada
// de novo — e a regra já estava no CLAUDE.md, violada em 7 dos 9 links.
console.log('── 5. todo <Link> da sidebar é prefetch={false} ──');
{
  const sb = fs.readFileSync(new URL('../components/layout/Sidebar.tsx', import.meta.url), 'utf8');
  const links = (sb.match(/<Link/g) || []).length;
  const nao = (sb.match(/prefetch=\{false\}/g) || []).length;
  eq(nao, links, `${links} <Link> na sidebar, ${nao} com prefetch={false}`);
  ok(links > 0, 'e a contagem não é zero por engano');
}
console.log('  ok');

// ── 6. O cookie do Server Component não pode estourar ──────────────────────
//
// ⚠️ Segundo caminho pro MESMO estrago: em Server Component `cookieStore.set`
// LANÇA, e nessa hora a rotação já aconteceu no servidor. Sem o try/catch o par
// novo nunca chega ao navegador.
console.log('── 6. setAll do servidor é tolerante ──');
{
  const ss = fs.readFileSync(new URL('../lib/supabase-server.ts', import.meta.url), 'utf8');
  ok(/setAll\(cookiesToSet\)\s*\{[\s\S]*?try\s*\{[\s\S]*?cookieStore\.set[\s\S]*?\}\s*catch/.test(ss),
    'o set dos cookies está dentro de try/catch');
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('✓ sessão × prefetch: todas as travas no lugar');

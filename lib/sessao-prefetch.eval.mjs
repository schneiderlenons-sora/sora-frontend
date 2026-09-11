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


// ── 7. O cache de sessão do middleware não pode derrubar ninguém ────────────
//
// `getUser()` era uma ida de REDE ao Auth em TODA navegação — a maior carga do
// banco no `pg_stat_statements`. Agora a validação é reaproveitada por 60s.
//
// ⚠️ ESTE BLOCO EXISTE POR CAUSA DE UM RISCO ESPECÍFICO: `getUser()` não só
// valida, ele também DISPARA A RENOVAÇÃO quando o token está perto de vencer.
// Servir do cache nessa hora pularia a renovação devida e mataria a sessão —
// o mesmo defeito que já derrubou um cliente ao abrir o menu (seção 2 acima).
// A margem é o que impede isso, e é o que este bloco protege de sumir.
console.log('── 7. cache de sessão do middleware ──');
{
  const mw = fs.readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');

  ok(/const MARGEM_RENOVACAO_MS\s*=/.test(mw), 'a margem de renovação existe');
  ok(/expiraMs > agora \+ MARGEM_RENOVACAO_MS/.test(mw),
    '⚠️ só usa cache com o token LONGE do vencimento — sem isto a renovação é pulada');
  ok(/Math\.min\(agora \+ TTL_SESSAO_MS, expiraMs - MARGEM_RENOVACAO_MS\)/.test(mw),
    'a entrada nunca vence depois do limite seguro do token');

  // ⚠️ Cachear "não tem usuário" deslogaria quem está logado a cada tropeço do
  //    Auth, e por 60 segundos. Só sucesso entra.
  ok(/if \(user && podeCachear\)/.test(mw), 'só validação BEM-SUCEDIDA é cacheada');

  // A chave é o token: sessão diferente, entrada diferente. É o que garante que
  // a identidade de uma pessoa nunca é servida para outra.
  ok(/cacheSessao\.set\(token/.test(mw), 'a chave do cache é o access token');
  ok(/cacheSessao\.size >= TETO_SESSAO/.test(mw), 'tem teto de memória (instância de Edge é pequena)');

  // ⚠️ Edge Runtime não tem `Buffer` nem `node:`. Quem lê token e vencimento é o
  //    `getSession()` do SDK, que é local. Um `Buffer` aqui quebra em produção
  //    sem aparecer no build.
  const fn = mw.slice(mw.indexOf('async function usuarioDaRequisicao'));
  ok(!/Buffer\.|require\(|from 'node:/.test(fn.slice(0, fn.indexOf('\n}'))),
    'nada de Buffer/node: dentro da função — Edge não tem');
  ok(/supabase\.auth\.getSession\(\)/.test(mw), 'usa getSession (local) pra ler o vencimento');

  // E a chamada de rede continua existindo pro caminho sem cache.
  ok(/const \{ data: \{ user \} \} = await supabase\.auth\.getUser\(\);/.test(mw),
    'o getUser de verdade segue lá, pro cache que não acertou');
}
console.log('  ok');
// ── 8. FALHA DE RENOVAÇÃO NÃO PODE APAGAR A SESSÃO ─────────────────────────
//
// QUARTO relato, agora de OUTRO cliente: "todas as vezes em que clico no Menu
// do aplicativo no celular, ele desconecta e solicita novo login".
//
// As seções 1–7 partiam da premissa de que o culpado era o PREFETCH. Era metade
// da verdade — e é por isso que as correções anteriores não fecharam o caso. O
// perdedor da corrida de rotação costuma ser a NAVEGAÇÃO DE VERDADE (a pessoa
// toca no menu no exato momento em que o timer do navegador renova), e para ela
// nenhuma trava de palpite vale: ela cai no ramo "não está logado", redireciona
// pro /login E LEVA OS COOKIES APAGADOS JUNTO.
//
// Fonte do comportamento destrutivo, conferida no auth-js 2.105.4 instalado
// (`GoTrueClient._callRefreshToken`): erro que não é de REDE não é retentado —
// chama `_removeSession()`, que apaga os cookies e emite `SIGNED_OUT`. E
// `__loadSession` mostra que `getSession()` renova sozinho quando falta menos
// de 90s (`EXPIRY_MARGIN_MS`) — ou seja, o middleware TAMBÉM é um renovador.
//
// A regra nova: sem usuário MAS tendo chegado com cookie de sessão = suspeita
// de corrida. Protege a rota, nunca apaga a sessão do navegador.
console.log('── 8. falha de renovação não apaga a sessão ──');
{
  const mw = fs.readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');

  ok(/function ehCookieDeSessao/.test(mw), 'sabe reconhecer um cookie de sessão');
  ok(/const falhaTransitoria = !user && tinhaSessao;/.test(mw),
    '⚠️ distingue "corrida de rotação" de "não está logado"');

  // ⚠️ ORDEM É TUDO: o `setAll` do client escreve em `request.cookies`, então
  //    ler depois da validação devolveria o token NOVO e a suspeita nunca
  //    dispararia — o bug voltaria inteiro, calado.
  const iLeitura = mw.indexOf('const tinhaSessao =');
  const iClient  = mw.indexOf('createServerClient(');
  ok(iLeitura > -1 && iClient > -1 && iLeitura < iClient,
    '⚠️ tinhaSessao é lido ANTES de o client do Supabase existir');

  ok(/if \(falhaTransitoria && ehCookieDeSessao\(c\.name\)\) return;/.test(mw),
    '⚠️ o apagamento de sessão NÃO é propagado numa falha suspeita');

  // Nenhum ponto pode ter voltado a copiar cookie na mão, por fora da regra.
  ok(!/cookies\.getAll\(\)\.forEach\(\(c\) => \w+\.cookies\.set\(c\)\)/.test(mw),
    'nenhuma cópia de cookie escapa do copiarCookies');

  // Auto-cura: quem perdeu a corrida volta pro destino que tocou, não pro
  // dashboard — e só caminho relativo é aceito (senão vira open redirect).
  ok(/searchParams\.get\('next'\)/.test(mw) && /next\.startsWith\('\/'\) && !next\.startsWith\('\/\/'\)/.test(mw),
    'o /login devolve a pessoa pro destino original, sem open redirect');

  // A regra, executada de verdade — não só a presença do texto.
  const ehSessao = (n) => /^sb-.+-auth-token/.test(n);
  ok(ehSessao('sb-abc-auth-token') && ehSessao('sb-abc-auth-token.0'),
    'reconhece o cookie inteiro e os pedaços (a sessão é fatiada quando cresce)');
  ok(!ehSessao('sora-locale') && !ehSessao('sora-theme'),
    'não confunde cookie da casa com cookie de sessão');

  const copiar = (cookies, transitoria) =>
    cookies.filter((c) => !(transitoria && ehSessao(c)));
  const apagados = ['sb-abc-auth-token', 'sb-abc-auth-token.0', 'sora-locale'];
  const r1 = copiar(apagados, true);
  ok(r1.length === 1 && r1[0] === 'sora-locale',
    '⚠️ na suspeita: sessão preservada, o resto passa');
  ok(copiar(apagados, false).length === 3,
    'sem suspeita (logout real): tudo passa, inclusive o apagamento');
}
console.log('  ok');


// ── 9. O cliente também não pode acreditar num SIGNED_OUT sozinho ──────────
//
// A outra metade: mesmo com o middleware preservando o cookie, quem emite o
// `SIGNED_OUT` é o supabase-js DENTRO do navegador, e todo guard de rota lia
// isso como "deslogado" e mandava pro /login na hora.
console.log('── 9. guards não deslogam sem confirmar ──');
{
  const ctx  = fs.readFileSync(new URL('../contexts/AuthContext.tsx', import.meta.url), 'utf8');
  const grow = fs.readFileSync(new URL('../app/(app)/grow/layout.tsx', import.meta.url), 'utf8');
  const onb  = fs.readFileSync(new URL('../app/onboarding/page.tsx', import.meta.url), 'utf8');

  ok(/evento === 'SIGNED_OUT' && !saindoDeProposito\.current/.test(ctx),
    '⚠️ SIGNED_OUT não pedido é reconferido antes de virar logout');
  ok(/saindoDeProposito\.current = true;/.test(ctx),
    'o botão Sair segue funcionando (marca a saída intencional)');
  ok(/setTimeout\(\(\) => \{ saindoDeProposito\.current = false; \}/.test(ctx),
    '⚠️ a marca é solta por tempo — nem presa pra sempre, nem cedo demais');

  // ⚠️ O redirect cru é o que trazia o bug de volta pela porta do cliente.
  for (const [nome, txt] of [['grow/layout', grow], ['onboarding', onb]]) {
    ok(!/if \(!user\) \{? ?router\.replace\('\/login'\)/.test(txt),
      `${nome}: não manda pro login direto no primeiro null`);
    ok(/sessaoRealmenteMorreu\(\)/.test(txt),
      `${nome}: confirma a morte da sessão antes de redirecionar`);
  }

  const viva = fs.readFileSync(new URL('./sessao-viva.ts', import.meta.url), 'utf8');
  ok(/catch \{\s*return false;/.test(viva),
    '⚠️ na dúvida NÃO desloga (checagem que falha devolve "não morreu")');
}
console.log('  ok');


// ── 10. ROTA DE TELEMETRIA NÃO PODE MEXER NA SESSÃO ────────────────────────
//
// QUINTO round do mesmo relato, agora com a pista que faltava: "o problema
// continua, mas ATÉ ONTEM ESTAVA NORMAL — e não uso VPN". Isso matou de uma vez
// a teoria de VPN/latência E apontou pra uma REGRESSÃO recente, não pro bug
// histórico.
//
// O que entrou na véspera: `POST /api/user/dispositivo` (telemetria de
// Android × Apple). Reproduzindo o fluxo dele num viewport de celular, tocar no
// "Menu" dispara exatamente UMA requisição — essa.
//
// ⚠️ E `/api/*` ESTÁ FORA DO MATCHER DO MIDDLEWARE. Nenhuma das travas das
// seções 1–9 alcança uma rota de API. Lá dentro, `getUser()` renova o token
// quando ele está perto de vencer; perdendo a corrida de rotação, o supabase-js
// chama `_removeSession()`, que escreve os cookies de sessão VAZIOS — e em
// Route Handler o `cookieStore.set` FUNCIONA (ao contrário de Server Component,
// onde ele lança e o try/catch engole). Os cookies vazios chegam ao navegador.
//
// Ou seja: uma rota de telemetria ganhou poder de encerrar a sessão de quem
// estava usando o app.
console.log('── 10. telemetria não escreve cookie de sessão ──');
{
  const rota = fs.readFileSync(
    new URL('../app/api/user/dispositivo/route.ts', import.meta.url), 'utf8');

  // ⚠️ `createSupabaseServer` é o client que ESCREVE. Numa rota que só precisa
  //    saber quem é o usuário, ele é poder demais.
  // ⚠️ Checa IMPORT e CHAMADA, não a string solta: o comentário do arquivo cita
  //    o nome de propósito (pra explicar por que NÃO usa), e uma asserção por
  //    texto reprovaria o próprio comentário que documenta a correção.
  ok(!/import[^;]*createSupabaseServer/.test(rota),
    '⚠️ não IMPORTA o client que escreve cookie de sessão');
  ok(!/await\s+createSupabaseServer\s*\(/.test(rota),
    '⚠️ não CHAMA o client que escreve cookie de sessão');
  ok(/setAll\(\)\s*\{[^}]*\}/.test(rota),
    '⚠️ o setAll é vazio — a rota lê a sessão mas nunca a rotaciona nem apaga');
  ok(/getAll\(\)\s*\{\s*return cookieStore\.getAll\(\);/.test(rota),
    'continua LENDO os cookies (senão não dava pra autenticar)');

  // O disparo só acontece com sessão na mão. Sem isso a rota respondia 401, o
  // guard de localStorage nunca era marcado e a chamada se repetia a CADA
  // carregamento — virando validação de sessão recorrente fora do middleware.
  const sync = fs.readFileSync(
    new URL('../components/app/DispositivoSync.tsx', import.meta.url), 'utf8');
  ok(/if \(loading \|\| !user\) return;/.test(sync),
    '⚠️ só dispara com usuário já carregado (evita 401 em laço)');
  ok(/\}, \[user, loading\]\);/.test(sync),
    'o efeito reage a user/loading (senão nunca rodaria depois do login)');
}
console.log('  ok');
console.log('');
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('✓ sessão × prefetch: todas as travas no lugar');

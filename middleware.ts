import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ── QUEM PRECISA DE LOGIN ─────────────────────────────────────────────────
//
// ⚠️ A LISTA É DE ROTAS PÚBLICAS, E O RESTO É PROTEGIDO — ao contrário do que
// era. Antes existia uma lista de PROTEGIDAS com 10 nomes, e ela envelheceu:
// o app tem 68 telas de painel e 58 delas não estavam ali. `/transacoes`,
// `/metas`, `/dividas`, `/previstos`, as 24 do Grow e as 16 de Negócios
// passavam pelo middleware sem nenhuma checagem — só o guard do cliente as
// segurava, e guard de cliente roda DEPOIS de a página ser servida.
//
// Invertido, o padrão é seguro: aba nova nasce protegida sem ninguém lembrar
// de editar este arquivo. Esquecer de somar a pública dá um redirect visível
// no primeiro teste; esquecer de somar a protegida dava um furo silencioso.
//
// ⚠️ `/redefinir-senha` e `/recuperar-senha` TÊM de ser públicas: quem chega
// ali está justamente sem conseguir entrar.
const ROTAS_PUBLICAS = [
  '/', '/login', '/signup', '/recuperar-senha', '/redefinir-senha',
  // Vendas e funis — visitante sem conta é o público delas.
  '/oferta', '/kit', '/checkout-vitalicio', '/financas', '/chat', '/quiz', '/tour',
  '/termos', '/privacidade',
  // Redirects de rota antiga. Públicas de propósito: elas só apontam pra
  // outra tela, e é a de destino que decide se pede login.
  '/central-sora', '/planejamento', '/avisos',
];

/** Pública? `/es` e tudo abaixo dele é a landing em espanhol. */
function ehPublica(pathname: string): boolean {
  if (pathname === '/es' || pathname.startsWith('/es/')) return true;
  return ROTAS_PUBLICAS.includes(pathname);
}

// ── FALHA TRANSITÓRIA DE RENOVAÇÃO × SESSÃO REALMENTE MORTA ───────────────
//
// ⚠️ ERA ISTO QUE DERRUBAVA O CLIENTE AO TOCAR NO MENU — e estava AQUI DENTRO,
// não no prefetch, que foi onde eu procurei nas três tentativas anteriores.
//
// O refresh token do Supabase é de USO ÚNICO: quem o usa recebe um novo e o
// antigo morre no mesmo instante. E DOIS lados renovam a MESMA sessão:
//   · o navegador — o timer de auto-refresh do supabase-js, que também dispara
//     quando a aba volta ao foco (o próprio AuthContext já documenta isso);
//   · este middleware — a cada navegação, porque `getSession()` NÃO só lê:
//     conferido no auth-js 2.105.4 instalado (`GoTrueClient.__loadSession`),
//     ele chama `_callRefreshToken` sozinho quando falta menos de 90s
//     (`EXPIRY_MARGIN_MS`) pro token vencer.
//
// Quando os dois disparam juntos, um vence e o outro recebe **400 "Invalid
// Refresh Token: Already Used"**. E aí vem a parte destrutiva, também conferida
// na fonte (`GoTrueClient._callRefreshToken`): erro que NÃO é de rede não é
// retentado — ele chama `_removeSession()`, que **apaga os cookies de sessão**
// e faz a validação devolver `user = null`.
//
// Lá embaixo, `user = null` caía no ramo "não está logado": redirect pro /login
// **levando junto os cookies apagados** (via `comCookies`). Ou seja: uma disputa
// de milissegundos destruía no navegador uma sessão que o lado VENCEDOR tinha
// acabado de renovar com sucesso — e o estrago era permanente, exigindo login
// de novo. É exatamente o relato: "clico no menu, ele desconecta e pede login".
//
// A distinção que faltava é simples: **a requisição CHEGOU com cookie de
// sessão?** Se chegou e a validação falhou, isso é SUSPEITA DE CORRIDA, não
// prova de logout. Nesse caso o middleware continua protegendo a rota (segue
// mandando pro /login), mas NUNCA propaga o apagamento — o navegador fica com o
// que tem, e se o par novo já chegou lá pela resposta vencedora, o /login
// devolve a pessoa pro destino original sem ela ver formulário nenhum.
//
// ⚠️ COM VPN ISSO FICA MUITO MAIS PROVÁVEL, e é o que ligava os dois relatos: o
// Supabase tolera o reuso do mesmo refresh token por alguns segundos (a janela
// de reuso) devolvendo a MESMA sessão em vez de erro. Com latência alta as duas
// tentativas se espalham além dessa janela e viram erro de verdade.
function ehCookieDeSessao(nome: string): boolean {
  return /^sb-.+-auth-token/.test(nome);
}

// ── INSTRUMENTAÇÃO DO "DESLOGA AO CLICAR NO MENU" ─────────────────────────
//
// ⚠️ ISTO NÃO CORRIGE NADA — E É DE PROPÓSITO. O relato já teve CINCO rodadas
// de correção (dutra.tim e weslley.jean1), cada uma partindo de uma teoria
// plausível, e as duas principais foram DERRUBADAS por medição depois:
//
//   · "é a VPN / latência"  → o cliente respondeu que não usa VPN;
//   · "a corrida de rotação do refresh token revoga a sessão" → TESTADO contra
//     o Auth deste projeto: renovar duas vezes com o MESMO refresh token, 15s
//     depois (fora da janela de reuso de 10s), devolveu HTTP 200 nas duas, o
//     mesmo token rotacionado, e a sessão do vencedor seguiu válida. Este
//     projeto NÃO revoga sessão por reuso.
//
// A causa raiz segue desconhecida e o bug nunca foi reproduzido aqui — tudo que
// se sabe veio de duas frases de e-mail. Continuar corrigindo no escuro é o que
// produziu as cinco rodadas. Isto troca teoria por fato: grava o instante exato
// em que alguém é deslogado sem ter pedido.
//
// ⚠️ NUNCA PODE ATRAPALHAR A RESPOSTA. Só dispara no caminho da anomalia (que é
// raro), tem teto de 1,5s, e qualquer falha dele é engolida — instrumentação que
// derruba o que está medindo não serve.
//
// ⚠️ NÃO GUARDA TOKEN. O e-mail/id saem do próprio cookie só pra saber de QUEM
// é o incidente. Nada de access token, refresh token ou o cookie em si.
const INCIDENTE_TTL_MS = 60_000;
const TETO_INCIDENTES = 100;
const incidentesRecentes = new Map<string, number>();

/** Quem era, lido do cookie de sessão. Best-effort, SEM verificar assinatura —
 *  é só rótulo de log, então token forjado no máximo suja uma linha.
 *  ⚠️ Recebe os cookies DA ENTRADA, não o request: depois da validação eles
 *  podem ter sido reescritos (ou esvaziados) e a identidade se perderia. */
function donoDoCookie(
  cookies: { name: string; value: string }[],
): { id?: string; email?: string } {
  try {
    // Sessão acima de ~4 KB vem FATIADA (`...auth-token.0`, `.1`): junta na
    // ordem antes de decodificar, senão o JSON não fecha.
    const partes = [...cookies].sort((a, b) => a.name.localeCompare(b.name));
    let bruto = partes.map((c) => c.value).join('');
    if (!bruto) return {};
    if (bruto.startsWith('base64-')) bruto = atob(bruto.slice(7));
    const j = JSON.parse(bruto);
    return { id: j?.user?.id, email: j?.user?.email };
  } catch { return {}; }
}

async function registrarIncidente(
  request: NextRequest, pathname: string, ehPalpite: boolean, cookies: number,
  dono: { id?: string; email?: string },
) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) return;

    const { id, email } = dono;

    // ⚠️ Trava de repetição: se o app entrar em laço de redirect, sem isto a
    // tabela vira um flood e o custo deixa de ser desprezível. Uma linha por
    // pessoa por minuto já conta a história.
    const agora = Date.now();
    const chave = `${email || id || 'anon'}`;
    const visto = incidentesRecentes.get(chave);
    if (visto && agora - visto < INCIDENTE_TTL_MS) return;
    if (incidentesRecentes.size >= TETO_INCIDENTES) incidentesRecentes.clear();
    incidentesRecentes.set(chave, agora);

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    await fetch(`${url}/rest/v1/auth_incidentes`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: id || null,
        email: email || null,
        rota: pathname,
        palpite: ehPalpite,
        user_agent: (request.headers.get('user-agent') || '').slice(0, 400),
        cookies,
      }),
      signal: ctrl.signal,
    }).catch(() => {});
    clearTimeout(t);
  } catch { /* instrumentação nunca derruba o que está medindo */ }
}

// ── i18n ──────────────────────────────────────────────────────────────────
// Locale mora na URL: /es/* = espanhol, resto = português (raiz sem prefixo).
// O locale resolvido é injetado no header de REQUEST `x-sora-locale`, lido pelo
// i18n/request.ts (via headers()) pra carregar o catálogo certo. NÃO usamos o
// middleware de locale-routing do next-intl porque PT precisa ficar sem prefixo
// ── Cache curto da VALIDAÇÃO da sessão ────────────────────────────────────
//
// `supabase.auth.getUser()` é uma ida de REDE ao Auth do Supabase, e ela roda
// em TODA navegação — a página nova só começa a renderizar depois que ela
// volta. Medido no `pg_stat_statements`: as 4 consultas que o Auth dispara por
// validação eram a maior carga do banco, acima de qualquer consulta da Sora.
//
// ⚠️ AQUI É EDGE, NÃO É O BACKEND. O Render é um processo só, de pé o tempo
// todo, então lá o cache acerta de forma previsível. A Vercel distribui o
// middleware em várias instâncias e recicla quando quer: este Map pode
// simplesmente não existir na requisição seguinte. Por isso o desenho é
// "acelera quando dá, nunca atrapalha quando não dá" — o pior caso é o
// comportamento de hoje, sem nenhuma regressão.
//
// ⚠️ NADA DE `Buffer` NEM `node:` — Edge Runtime não tem. Quem lê o token e o
// vencimento é o `getSession()` do próprio SDK, que é LOCAL (lê o cookie, sem
// rede — o mesmo motivo pelo qual `lib/ssr.ts` já o usa).
const TTL_SESSAO_MS = 60_000;

// ⚠️ A MARGEM É O QUE IMPEDE DE DERRUBAR A SESSÃO, e é o ponto mais delicado
// deste arquivo. `getUser()` não só valida: quando o token está perto de
// vencer, é ELE quem dispara a renovação e a rotação do cookie. Servir do
// cache nessa hora PULARIA a renovação devida — e o refresh token morreria
// sem substituto, que é exatamente o defeito que derrubava o cliente no menu.
// Com margem de 2 minutos, uma entrada nunca é servida com o token perto do
// fim: a renovação sempre acontece pela via normal.
const MARGEM_RENOVACAO_MS = 120_000;

// Teto de memória: instância de Edge é pequena. Cheiou, esvazia — custa
// revalidar por um ciclo, e é mais simples de acertar que manter ordem de uso.
const TETO_SESSAO = 200;
const cacheSessao = new Map<string, { user: { id: string }; ate: number }>();

/**
 * O usuário desta requisição, reaproveitando a validação recente quando dá.
 *
 * ⚠️ A CHAVE É O ACCESS TOKEN, e isso não é detalhe: token diferente é sessão
 * diferente, então nunca há como servir a identidade de uma pessoa para outra.
 * E quando o SDK renova, o token MUDA — a entrada velha deixa de ser
 * encontrada sozinha, sem precisar de invalidação explícita.
 *
 * ⚠️ SÓ SUCESSO É CACHEADO. Guardar um "não tem usuário" faria uma falha
 * momentânea do Auth deslogar quem estava logado, e por 60 segundos.
 */
async function usuarioDaRequisicao(
  supabase: ReturnType<typeof createServerClient>,
  // ⚠️ Tipo de retorno EXPLÍCITO: sem ele o TS não fecha a inferência (o cache
  //    referencia o próprio valor que a função devolve). E `{ id }` é tudo que
  //    o middleware usa daqui — conferido nos 4 pontos de uso abaixo.
): Promise<{ id: string } | null> {
  let token: string | undefined;
  let expiraMs = 0;
  try {
    // Local: lê o cookie e, se o token já venceu, renova por conta própria
    // (a mesma renovação que o getUser faria — nada é pulado).
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
    expiraMs = data.session?.expires_at ? data.session.expires_at * 1000 : 0;
  } catch { /* sem sessão legível: cai no caminho normal abaixo */ }

  const agora = Date.now();
  // Só vale usar cache com token válido e LONGE do vencimento (ver a margem).
  const podeCachear = !!token && expiraMs > agora + MARGEM_RENOVACAO_MS;

  if (podeCachear) {
    const hit = cacheSessao.get(token!);
    if (hit && hit.ate > agora) return hit.user;
    if (hit) cacheSessao.delete(token!);
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (user && podeCachear) {
    if (cacheSessao.size >= TETO_SESSAO) cacheSessao.clear();
    cacheSessao.set(token!, {
      user,
      // Nunca além da margem: o vencimento da entrada respeita o do token.
      ate: Math.min(agora + TTL_SESSAO_MS, expiraMs - MARGEM_RENOVACAO_MS),
    });
  }
  return user ?? null;
}

// e este middleware de auth não pode ser substituído.
const LOCALE_COOKIE = 'sora-locale';

function localeDoPath(pathname: string): 'pt' | 'es' {
  return pathname === '/es' || pathname.startsWith('/es/') ? 'es' : 'pt';
}

// Detecta preferência por espanhol via Accept-Language (só na 1ª visita da
// landing, quando não há cookie travando a escolha).
function prefereEspanhol(request: NextRequest): boolean {
  const al = request.headers.get('accept-language') ?? '';
  // Ex.: "es-MX,es;q=0.9,en;q=0.8" → primeira tag de idioma
  const primeira = al.split(',')[0]?.trim().toLowerCase() ?? '';
  return primeira.startsWith('es');
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const locale = localeDoPath(pathname);

  // ── ESTA REQUISIÇÃO É UM PALPITE DO ROTEADOR? ───────────────────────────
  //
  // O Next dispara `next-router-prefetch` sozinho, pra rotas que ele ACHA que
  // a pessoa vai abrir — não é ação de ninguém. E ele dispara em RAJADA: a
  // sidebar do mobile fica montada fora da tela e, quando o menu abre, todos
  // os links dela entram no viewport de uma vez.
  //
  // ⚠️ ISSO PODE DESLOGAR DE VERDADE. Cada requisição da rajada chega com o
  // MESMO refresh token vencido e cada uma tenta renovar; o Supabase
  // ROTACIONA, então a primeira consome o token e as outras chegam com um
  // token já morto. A que falha volta com `user` null, e o caminho de baixo
  // APAGA os cookies de sessão e manda pro login — matando a sessão que a
  // primeira acabou de renovar. Com VPN (latência alta) a rajada se espalha
  // e passa da janela de reuso do refresh token, que é o que normalmente
  // segura esse empate.
  //
  // A REGRA: um palpite PODE renovar a sessão, NUNCA encerrá-la. Ele segue
  // renovando e persistindo o par novo (é isso que mantém a sessão viva);
  // o que ele não faz é apagar cookie nem redirecionar. Quem descobre que a
  // sessão morreu de verdade é a navegação REAL logo em seguida.
  const ehPalpite = request.headers.get('next-router-prefetch') === '1';

  // ⚠️ LIDO AQUI, ANTES DE QUALQUER COISA TOCAR NA SESSÃO. O `setAll` do client
  // do Supabase escreve em `request.cookies` também (é assim que ele deixa o
  // token novo visível pro resto desta requisição), então depois da validação
  // não dá mais pra saber com o que a pessoa CHEGOU — que é justamente o dado
  // que separa "corrida de renovação" de "não está logado".
  const cookiesDeSessao = request.cookies.getAll().filter((c) => ehCookieDeSessao(c.name));
  const tinhaSessao = cookiesDeSessao.length > 0;

  // ⚠️ A IDENTIDADE TAMBÉM SAI DAQUI, pelo MESMO motivo — e este detalhe decide
  // se a instrumentação serve pra alguma coisa. Se a validação falhar por
  // `_removeSession`, o cookie já estará VAZIO quando o incidente for gravado,
  // e a linha sairia sem saber de quem é — justo o campo que a investigação
  // precisa. Lido antes, sobrevive.
  const donoNaEntrada = donoDoCookie(cookiesDeSessao);

  // Auto-detect: visitante da landing raiz, sem cookie de idioma, que prefere
  // espanhol (ou vem do México) → manda pro /es. Só a landing pública — nunca
  // rotas do app, pra não interferir no fluxo PT logado.
  if (pathname === '/' && !request.cookies.get(LOCALE_COOKIE)) {
    const geoMx = (request as unknown as { geo?: { country?: string } }).geo?.country === 'MX';
    if (prefereEspanhol(request) || geoMx) {
      // ⚠️ ESTE redirect pode sair sem copiar cookie porque acontece ANTES de o
      // client do Supabase existir — nada foi renovado ainda. Se um dia ele for
      // movido pra baixo do `getUser()`, tem de passar por `comCookies`.
      return NextResponse.redirect(new URL('/es', request.url));
    }
  }

  // Injeta o locale nos headers de request repassados aos Server Components.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-sora-locale', locale);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const user = await usuarioDaRequisicao(supabase);

  // Chegou com sessão e mesmo assim não validou → SUSPEITA de corrida de
  // rotação, não prova de logout (ver o bloco no topo). A partir daqui, nenhum
  // caminho pode propagar o apagamento dos cookies de sessão.
  const falhaTransitoria = !user && tinhaSessao;

  // ⚠️ ESTE É O INSTANTE DO BUG — a requisição trouxe cookie de sessão e a
  // validação voltou vazia. Até agora isso passava silencioso, e era por isso
  // que as cinco rodadas anteriores só tinham teoria. Grava e segue (ver o
  // bloco de instrumentação no topo: não decide nada, não bloqueia nada).
  if (falhaTransitoria) {
    await registrarIncidente(
      request, pathname, ehPalpite, cookiesDeSessao.length, donoNaEntrada,
    );
  }

  /**
   * Copia os cookies de uma resposta pra outra, PRESERVANDO a sessão do
   * navegador quando a falha pode ser transitória.
   *
   * ⚠️ É a linha que impede o estrago permanente. Quando a renovação perde a
   * corrida, o `setAll` já gravou os cookies de sessão VAZIOS na resposta;
   * repassá-los encerra no navegador uma sessão que provavelmente está viva.
   */
  const copiarCookies = (de: NextResponse, para: NextResponse) => {
    de.cookies.getAll().forEach((c) => {
      if (falhaTransitoria && ehCookieDeSessao(c.name)) return;
      para.cookies.set(c);
    });
  };

  // ⚠️ REPASSA O USUÁRIO JÁ VERIFICADO PRO SERVER COMPONENT.
  //
  // O middleware acabou de validar o JWT com `getUser()` — que é uma ida de
  // REDE ao Supabase Auth. Sem este repasse, `contextoSSR()` (lib/ssr.ts)
  // chamava `getUser()` DE NOVO na mesma requisição, pagando a segunda ida pra
  // descobrir exatamente o que já se sabia aqui.
  //
  // Mesmo mecanismo do `x-sora-locale` logo acima: header de REQUEST, lido no
  // servidor via `headers()`. Nunca chega ao navegador.
  //
  // ⚠️ SEMPRE ESCREVE OU APAGA — nunca deixa passar o que veio de fora. Um
  // cliente pode mandar `x-sora-user-id` na requisição dele; como
  // `requestHeaders` nasce de uma cópia dos headers recebidos, deixar o valor
  // do cliente aqui seria falsificar identidade. O `delete` no ramo sem
  // usuário é a metade que fecha isso.
  if (user?.id) requestHeaders.set('x-sora-user-id', user.id);
  else requestHeaders.delete('x-sora-user-id');

  // A resposta foi criada ANTES do getUser (e pode ter sido recriada pelo
  // `setAll` ao renovar o token), então precisa ser refeita pra carregar o
  // header novo — preservando os cookies que a renovação escreveu.
  {
    const anterior = response;
    response = NextResponse.next({ request: { headers: requestHeaders } });
    copiarCookies(anterior, response);
  }

  /**
   * Devolve `resposta` carregando os cookies que a renovação de sessão
   * escreveu nesta requisição.
   *
   * ⚠️ ESQUECER ISSO NUM REDIRECT DESLOGA A PESSOA DE VERDADE, e o estrago é
   * permanente até ela entrar de novo. O access token dura 1 hora; quando
   * vence, o `getUser()` acima RENOVA e o Supabase ROTACIONA o refresh token —
   * o antigo é consumido e morre no servidor naquele instante. O par novo vai
   * pro `response` via `setAll`. Se o caminho terminar num
   * `NextResponse.redirect(...)` recém-criado, esse par novo NÃO VAI JUNTO: o
   * navegador fica com o refresh token que acabou de ser invalidado, e daí em
   * diante toda requisição falha a renovação, `user` vem null e o app manda
   * pro login — inclusive na próxima vez que ela abrir o app.
   *
   * E se auto-alimenta: o ramo que mais roda é justamente o redirect de
   * `/login` → `/dashboard` de quem já está logado, que é por onde o app abre.
   *
   * Foi o relato de um cliente com vitalício ativo: "consigo entrar, mas
   * depois de um tempo volta pro login". Medido na conta dele — dois logins
   * em pouco mais de quatro horas no mesmo dia.
   */
  const comCookies = (resposta: NextResponse) => {
    copiarCookies(response, resposta);
    return resposta;
  };

  // ⚠️ E O PALPITE TAMBÉM NÃO PODE APAGAR COOKIE. Não basta não redirecionar:
  //    quando a renovação FALHA, o `setAll` acima já escreveu os cookies de
  //    sessão VAZIOS no `response`, e devolvê-los encerra a sessão no
  //    navegador do mesmo jeito — só que sem sair da tela, o que é pior de
  //    diagnosticar. Numa rajada, é a requisição perdedora da corrida de
  //    rotação que faz isso, apagando a sessão que a vencedora renovou.
  //
  //    Sem usuário num palpite, a resposta sai LIMPA: nenhum cookie tocado. O
  //    navegador segue com o que tinha, e a navegação real logo em seguida
  //    decide de verdade — inclusive mandando pro login, se for o caso.
  if (ehPalpite && !user) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const isPublica = ehPublica(pathname);

  // Sem login tentando acessar rota protegida → vai para login.
  // ⚠️ `!ehPalpite`: ver a nota lá em cima. Redirecionar um prefetch não leva
  //    ninguém a lugar nenhum (o usuário não pediu navegação) e ainda carrega
  //    os cookies apagados pro navegador, encerrando a sessão de verdade.
  if (!user && !isPublica && !ehPalpite) {
    // ⚠️ LEVA O DESTINO JUNTO (`?next=`) E DIZ POR QUÊ (`?motivo=sessao`).
    //
    // Sem isso o redirect é mudo: a pessoa toca em "Abrir Sora", cai num
    // formulário de login sem explicação e, depois de entrar, aterrissa no
    // dashboard em vez de onde ia. Foi exatamente o relato — "clico no menu e
    // abre a tela de login, por quê?" — de quem tinha sessão VÁLIDA no
    // navegador e inválida no servidor (trocar a senha derruba as sessões
    // antigas, e o cliente não sabe disso até tentar navegar).
    const destino = new URL('/login', request.url);
    destino.searchParams.set('next', pathname + request.nextUrl.search);
    destino.searchParams.set('motivo', 'sessao');
    return comCookies(NextResponse.redirect(destino));
  }

  // Com login tentando acessar login/signup → vai para dashboard.
  //
  // ⚠️ E É AQUI QUE A CORRIDA SE CURA SOZINHA. Quem perdeu a rotação foi
  // mandado pro /login SEM ter os cookies apagados; se o lado vencedor já
  // entregou o par novo ao navegador, esta passagem encontra a sessão viva e
  // devolve a pessoa PRO DESTINO QUE ELA TOCOU (`?next=`), não pro dashboard.
  // O que era "fui deslogado no meio do menu" vira, no pior caso, um piscar.
  //
  // ⚠️ Só caminho relativo é aceito. `next` vem da URL, então mandar o
  // redirect pra onde ele apontar sem checar seria um open redirect — `//host`
  // é URL absoluta pro navegador, por isso a segunda condição.
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const next = request.nextUrl.searchParams.get('next');
    const destino = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
    return comCookies(NextResponse.redirect(new URL(destino, request.url)));
  }

  return response;
}

export const config = {
  // ⚠️ `api` FICA DE FORA, e a exclusão vale um round-trip por chamada.
  //
  // O middleware roda `supabase.auth.getUser()` — ida de REDE ao Supabase Auth
  // — em tudo que intercepta. As 26 rotas de `/api` caíam aqui e pagavam esse
  // custo à toa: nenhuma está em ROTAS_PROTEGIDAS (o middleware não bloqueia
  // nada nelas), nenhuma lê `x-sora-locale` nem `x-sora-user-id`, e 23 das 26
  // já autenticam por conta própria (createSupabaseServer, checkAdmin, ou a
  // assinatura do Stripe). As outras 3 são públicas de propósito: os dois
  // bridges de analytics e o webhook do Mercado Pago, chamado pelos servidores
  // deles, que não pode exigir sessão.
  //
  // Como toda revalidação do SWR passa por `/api`, isto tirava uma ida ao
  // Supabase de cada atualização de dado do painel.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};

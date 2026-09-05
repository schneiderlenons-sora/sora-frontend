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

// ── i18n ──────────────────────────────────────────────────────────────────
// Locale mora na URL: /es/* = espanhol, resto = português (raiz sem prefixo).
// O locale resolvido é injetado no header de REQUEST `x-sora-locale`, lido pelo
// i18n/request.ts (via headers()) pra carregar o catálogo certo. NÃO usamos o
// middleware de locale-routing do next-intl porque PT precisa ficar sem prefixo
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

  // Auto-detect: visitante da landing raiz, sem cookie de idioma, que prefere
  // espanhol (ou vem do México) → manda pro /es. Só a landing pública — nunca
  // rotas do app, pra não interferir no fluxo PT logado.
  if (pathname === '/' && !request.cookies.get(LOCALE_COOKIE)) {
    const geoMx = (request as unknown as { geo?: { country?: string } }).geo?.country === 'MX';
    if (prefereEspanhol(request) || geoMx) {
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

  const { data: { user } } = await supabase.auth.getUser();

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
    anterior.cookies.getAll().forEach((c) => response.cookies.set(c));
  }
  const isPublica = ehPublica(pathname);

  // Sem login tentando acessar rota protegida → vai para login.
  if (!user && !isPublica) {
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
    return NextResponse.redirect(destino);
  }

  // Com login tentando acessar login/signup → vai para dashboard
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
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

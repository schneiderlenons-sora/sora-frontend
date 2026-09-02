import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rotas que não precisam de login.
// ⚠️ `/redefinir-senha` é onde o link do e-mail cai. Ela NÃO pode virar rota
// protegida: quem chega ali está justamente sem conseguir entrar.
const ROTAS_PUBLICAS = ['/', '/login', '/signup', '/recuperar-senha', '/redefinir-senha'];

// Rotas protegidas (precisam de login)
const ROTAS_PROTEGIDAS = [
  '/dashboard', '/relatorios', '/contas-bancarias', '/cartao-de-credito',
  '/categorias', '/limites-de-gastos', '/investimentos',
  '/comunidade', '/configuracoes', '/vincular-whatsapp',
];

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
  const isProtegida = ROTAS_PROTEGIDAS.some(r => pathname.startsWith(r));
  const isPublica   = ROTAS_PUBLICAS.includes(pathname);

  // Sem login tentando acessar rota protegida → vai para login
  if (!user && isProtegida) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Com login tentando acessar login/signup → vai para dashboard
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};

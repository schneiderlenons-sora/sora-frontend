import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rotas que não precisam de login
const ROTAS_PUBLICAS = ['/', '/login', '/signup', '/recuperar-senha'];

// Rotas protegidas (precisam de login)
const ROTAS_PROTEGIDAS = [
  '/dashboard', '/relatorios', '/contas-bancarias', '/cartao-de-credito',
  '/categorias', '/limites-de-gastos', '/investimentos',
  '/comunidade', '/configuracoes', '/vincular-whatsapp',
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
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
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
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
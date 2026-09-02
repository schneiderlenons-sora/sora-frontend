import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { headers } from 'next/headers';

// Helper de SSR das abas: resolve a sessão no servidor (cookie → JWT + phone) e
// busca no backend com o token do usuário. Best-effort: qualquer falha → null/
// undefined e a página cai no fetch do cliente (comportamento atual preservado).

const BASE = process.env.NEXT_PUBLIC_API_URL || '';

export type CtxSSR = { phone: string; token: string; grupoId: string | null; userId: string };

export async function contextoSSR(): Promise<CtxSSR | null> {
  try {
    if (!BASE) return null;
    const supabase = await createSupabaseServer();

    // ⚠️ O MIDDLEWARE JÁ VALIDOU O JWT NESTA MESMA REQUISIÇÃO e repassou o id
    // no header `x-sora-user-id` (ele sempre escreve ou apaga esse header, então
    // o valor não pode vir do cliente). Chamar `getUser()` aqui repetiria a ida
    // de REDE ao Supabase Auth pra chegar na mesma resposta — era a duplicata
    // mais cara do caminho de navegação.
    //
    // `getSession()` sozinho lê o cookie, sem rede, e é de onde sai o token que
    // o backend vai verificar por conta própria.
    //
    // Sem o header (rota fora do matcher do middleware, ou middleware que não
    // rodou), cai no comportamento de antes: valida aqui mesmo.
    const idDoMiddleware = (await headers()).get('x-sora-user-id');

    let userId: string | undefined;
    let token: string | undefined;

    if (idDoMiddleware) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = idDoMiddleware;
      token = session?.access_token;
    } else {
      const [{ data: { user } }, { data: { session } }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);
      userId = user?.id;
      token = session?.access_token;
    }

    if (!userId || !token) return null;
    // Traz o grupo_ativo junto (mesma query) → permite ler direto do Supabase
    // no SSR (lib/ssr-data.ts), sem o hop lento do Render pro primeiro paint.
    const { data: perfil } = await supabaseAdmin
      .from('users').select('phone, grupo_ativo').eq('id', userId).maybeSingle();
    return {
      phone: perfil?.phone || userId,
      token,
      grupoId: (perfil?.grupo_ativo as string) || null,
      userId,
    };
  } catch {
    return null;
  }
}

export async function backendGet<T = any>(ctx: CtxSSR, path: string): Promise<T | undefined> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
      cache: 'no-store',
    });
    if (!res.ok) return undefined;
    return (await res.json()) as T;
  } catch {
    return undefined;
  }
}

// Mês YYYY-MM no fuso SP — bate com o mesRef local das páginas (usuários BR).
export function mesRefSSR(offset = 0): string {
  const sp = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const d = new Date(sp.getFullYear(), sp.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

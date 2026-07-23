import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Helper de SSR das abas: resolve a sessão no servidor (cookie → JWT + phone) e
// busca no backend com o token do usuário. Best-effort: qualquer falha → null/
// undefined e a página cai no fetch do cliente (comportamento atual preservado).

const BASE = process.env.NEXT_PUBLIC_API_URL || '';

export type CtxSSR = { phone: string; token: string; grupoId: string | null; userId: string };

export async function contextoSSR(): Promise<CtxSSR | null> {
  try {
    if (!BASE) return null;
    const supabase = await createSupabaseServer();
    const [{ data: { user } }, { data: { session } }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);
    const token = session?.access_token;
    if (!user || !token) return null;
    // Traz o grupo_ativo junto (mesma query) → permite ler direto do Supabase
    // no SSR (lib/ssr-data.ts), sem o hop lento do Render pro primeiro paint.
    const { data: perfil } = await supabaseAdmin
      .from('users').select('phone, grupo_ativo').eq('id', user.id).maybeSingle();
    return {
      phone: perfil?.phone || user.id,
      token,
      grupoId: (perfil?.grupo_ativo as string) || null,
      userId: user.id,
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

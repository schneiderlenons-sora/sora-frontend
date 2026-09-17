import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { headers } from 'next/headers';
import { normalizarMoeda, type Moeda } from '@/lib/moeda';

// Helper de SSR das abas: resolve a sessão no servidor (cookie → JWT + phone) e
// busca no backend com o token do usuário. Best-effort: qualquer falha → null/
// undefined e a página cai no fetch do cliente (comportamento atual preservado).

const BASE = process.env.NEXT_PUBLIC_API_URL || '';

export type CtxSSR = {
  phone: string; token: string; grupoId: string | null; userId: string;
  /** Moeda em que o grupo vive (migration 168). 'BRL' enquanto ela não rodar. */
  moedaBase: Moeda;
};

// ── Moeda base do grupo (migration 168) ─────────────────────────────────────
//
// ⚠️ COLUNA NOVA NO CAMINHO CRÍTICO. `contextoSSR` roda em 11 abas e `/api/me`
// em todo carregamento do painel; pedir `moeda_base` antes de a migration
// rodar derrubaria as duas leituras inteiras (a lição registrada no CLAUDE.md:
// "Usuário não encontrado" por coluna inexistente). A leitura tenta com a
// coluna e, se o erro for dela, refaz sem.
//
// ⚠️ O "a coluna não existe" EXPIRA EM 10 MINUTOS. Uma flag permanente faria a
// instância que já estava no ar quando a migration rodou ignorar a moeda do
// cliente até o próximo deploy. Mesma regra do `services/moeda.js` do backend.
// É estado de ESQUEMA, não de usuário: compartilhar entre requisições é seguro.
const RETENTAR_BASE_MS = 10 * 60 * 1000;
let baseAusenteAte = 0;

export function baseDisponivelSSR(): boolean { return Date.now() >= baseAusenteAte; }
export function marcarBaseIndisponivelSSR(): void { baseAusenteAte = Date.now() + RETENTAR_BASE_MS; }
/** O PostgREST responde `column grupos_1.moeda_base does not exist` (medido). */
export function ehErroDaColunaBase(e: { message?: string } | null | undefined): boolean {
  return /moeda_base/i.test(e?.message || '');
}

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
    //
    // A moeda base vem na MESMA ida, embutida pelo FK. ⚠️ O alias é `grupo`, e
    // não `grupo_ativo`: com o mesmo nome o embed substituiria o uuid pelo
    // objeto, e `grupoId` abaixo — que 11 abas usam — viraria [object Object].
    type LinhaUser = {
      phone: string | null;
      grupo_ativo: string | null;
      grupo?: { moeda_base?: string | null } | null;
    };
    let perfil: LinhaUser | null = null;
    let lido = false;
    if (baseDisponivelSSR()) {
      const { data, error } = await supabaseAdmin.from('users')
        .select('phone, grupo_ativo, grupo:grupos!fk_users_grupo_ativo(moeda_base)')
        .eq('id', userId).maybeSingle();
      if (!error) { perfil = data as LinhaUser | null; lido = true; }
      else if (ehErroDaColunaBase(error)) marcarBaseIndisponivelSSR();
    }
    if (!lido) {
      // Sem a migration 168 (ou erro na tentativa acima): a leitura de sempre.
      const { data } = await supabaseAdmin
        .from('users').select('phone, grupo_ativo').eq('id', userId).maybeSingle();
      perfil = data as LinhaUser | null;
    }
    return {
      phone: perfil?.phone || userId,
      token,
      grupoId: perfil?.grupo_ativo || null,
      userId,
      moedaBase: normalizarMoeda(perfil?.grupo?.moeda_base),
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

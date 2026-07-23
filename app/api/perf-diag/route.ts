import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { dashboardDireto } from '@/lib/ssr-data';

// Diagnóstico de performance do caminho de SSR. Abra LOGADO em
// /api/perf-diag e cole o JSON de volta pro Claude. Mede, em ms:
//  - validar sessão (getUser/getSession → Supabase Auth)
//  - lookup do usuário (supabaseAdmin → Supabase DB)
//  - ping simples no Supabase (latência Vercel↔Supabase pura)
//  - query DIRETA equivalente a um read do dashboard (wallets) = "seria o #2"
//  - hop do Render (dashboard consolidado) rodado 2× → 1º pode vir COLD
// + a região da Vercel onde a função rodou. Sem código de produção — só medição.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function timed(fn: () => Promise<unknown>) {
  const t = Date.now();
  try {
    const info = await fn();
    return { ms: Date.now() - t, ok: true, info };
  } catch (e) {
    return { ms: Date.now() - t, ok: false, info: (e as Error)?.message };
  }
}

export async function GET() {
  const out: Record<string, unknown> = {
    regiao_vercel: process.env.VERCEL_REGION || 'local/desconhecida',
    backend_host: BASE ? new URL(BASE).host : '(NEXT_PUBLIC_API_URL vazio)',
    etapas_ms: {} as Record<string, unknown>,
  };
  const etapas = out.etapas_ms as Record<string, unknown>;
  const tTotal = Date.now();

  if (!BASE) return NextResponse.json({ ...out, erro: 'NEXT_PUBLIC_API_URL não definida' }, { status: 500 });

  const supabase = await createSupabaseServer();

  // 1. Validar sessão
  const tAuth = Date.now();
  const [{ data: { user } }, { data: { session } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  etapas.auth_validar_sessao = Date.now() - tAuth;
  const userId = user?.id ?? null;
  const token = session?.access_token ?? null;
  if (!userId || !token) {
    return NextResponse.json({ ...out, erro: 'não autenticado — abra esta URL logado no app' }, { status: 401 });
  }

  // 2. Lookup do usuário (phone + grupo_ativo) — igual ao contextoSSR
  const tUser = Date.now();
  const { data: urow } = await supabaseAdmin
    .from('users').select('phone, grupo_ativo').eq('id', userId).maybeSingle();
  etapas.users_lookup = Date.now() - tUser;
  const grupoId = (urow?.grupo_ativo as string) || null;
  out.tem_phone = urow?.phone ? 'sim' : 'não';
  out.tem_grupo = !!grupoId;

  // 3. Ping simples no Supabase (latência pura Vercel↔Supabase)
  const tPing = Date.now();
  try { await supabaseAdmin.from('users').select('id').eq('id', userId).maybeSingle(); } catch { /* noop */ }
  etapas.supabase_ping = Date.now() - tPing;

  // 4. Query DIRETA equivalente a um read do dashboard (wallets por grupo) — "o #2"
  if (grupoId) {
    const tW = Date.now();
    const { data: w } = await supabaseAdmin.from('wallets').select('*').eq('grupo_id', grupoId).order('nome');
    etapas.direto_supabase_wallets = Date.now() - tW;
    out.wallets_count = (w || []).length;

    // 4b. Dashboard consolidado DIRETO no Supabase (as 6 queries) — é o que o
    //     SSR passa a usar. Compare com render_dashboard_2a_chamada.
    const mesAtual = new Date().toISOString().slice(0, 7);
    const mesAnt = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 7);
    const dd = await timed(() => dashboardDireto(grupoId, mesAtual, mesAnt));
    etapas.direto_supabase_dashboard_completo = dd.ms;
    out.direto_dashboard_ok = dd.ok;
  }

  // 5. Hop do Render (dashboard consolidado). O backend ignora o :phone (usa
  //    JWT), então qualquer placeholder serve. 2 chamadas: a 1ª pode incluir
  //    cold start / warmup de conexão; a 2ª é o custo quente.
  const mes = new Date().toISOString().slice(0, 7);
  const chamarRender = () =>
    fetch(`${BASE}/api/dashboard/x?mes=${mes}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).then((r) => `HTTP ${r.status}`);

  const r1 = await timed(chamarRender);
  etapas.render_dashboard_1a_chamada = r1.ms;
  out.render_status_1 = r1.info;
  const r2 = await timed(chamarRender);
  etapas.render_dashboard_2a_chamada = r2.ms;
  out.render_status_2 = r2.info;

  etapas.total = Date.now() - tTotal;

  // Leitura rápida pro humano
  const dashDireto = etapas.direto_supabase_dashboard_completo as number | undefined;
  out.diagnostico = {
    render_dashboard_ms: r2.ms,
    supabase_direto_dashboard_ms: dashDireto ?? null,
    ganho_estimado_ssr: dashDireto && r2.ms ? `${Math.round((1 - dashDireto / r2.ms) * 100)}% mais rápido` : null,
    cold_start_suspeito: r1.ms - r2.ms > 3000,
    nota: 'direto_supabase_dashboard_completo é o que o SSR passa a usar (#2 aplicado no dashboard). Compare com render_dashboard_2a_chamada (o hop antigo).',
  };

  return NextResponse.json(out);
}

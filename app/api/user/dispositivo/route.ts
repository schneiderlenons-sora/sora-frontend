import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const VALIDAS = ['android_app', 'android_web', 'ios_pwa', 'ios_web', 'desktop', 'outro'];

/**
 * Grava `users.plataforma` — só pra o /admin enxergar Android × Apple.
 *
 * ⚠️ Chamado UMA VEZ POR NAVEGADOR (o guard é `components/app/DispositivoSync.tsx`,
 * via localStorage) — não é rota de alta frequência, então o `getUser()` (ida de
 * rede ao Supabase Auth) aqui não pesa como pesaria num caminho quente.
 *
 * Sem sessão → 401 e o cliente NÃO marca como enviado (tenta de novo na
 * próxima carga, já logado). Silencioso de propósito: é telemetria, nunca pode
 * atrapalhar quem está usando o app.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const plataforma = String(body?.plataforma || '');
  if (!VALIDAS.includes(plataforma)) {
    return NextResponse.json({ erro: 'Plataforma inválida' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('users').update({ plataforma }).eq('id', user.id);
  // Coluna nova (migration 161) — se ainda não rodou, falha calado: é
  // telemetria opcional, não pode gerar erro visível pro usuário comum.
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 200 });

  return NextResponse.json({ ok: true });
}

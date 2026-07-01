import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Diagnóstico temporário: estado do plano de um usuário por e-mail.
// /api/debug-plano?key=sora-debug&email=...
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'sora-debug') {
    return NextResponse.json({ erro: 'forbidden' }, { status: 403 });
  }
  const email = req.nextUrl.searchParams.get('email');
  const cols = 'id, email, name, plano, vitalicio, vitalicio_em, plano_valido_ate, phone, grupo_ativo, created_at';
  try {
    // ?test_kit=<userId> → tenta setar plano='kit' e devolve o erro (confirma
    // se existe CHECK constraint bloqueando o valor 'kit').
    const testKit = req.nextUrl.searchParams.get('test_kit');
    if (testKit) {
      const { error: e1 } = await supabaseAdmin.from('users').update({ plano: 'kit' }).eq('id', testKit);
      return NextResponse.json({ tentou: 'plano=kit', erro: e1?.message || null, ok: !e1 });
    }
    if (!email) {
      // Sem e-mail → lista os 8 usuários mais recentes (achar a conta de teste).
      const { data, error } = await supabaseAdmin
        .from('users')
        .select(cols)
        .order('created_at', { ascending: false })
        .limit(8);
      return NextResponse.json({ recentes: data, error: error?.message || null });
    }
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(cols)
      .eq('email', email)
      .maybeSingle();
    return NextResponse.json({ user: data, error: error?.message || null });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : 'falhou' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Registra a intenção do vitalício (tier) do usuário logado — usado pela
// recuperação pra levar de volta pro checkout do vitalício certo (em vez do
// /login genérico). Chamado pelo /checkout-vitalicio ao montar. Fire-and-forget.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tier = ['kit', 'completa', 'upgrade'].includes(body?.tier) ? body.tier : 'completa';

    // Tolerante: se a coluna não existir (migration 064), só não grava.
    try { await supabaseAdmin.from('users').update({ vitalicio_intent: tier }).eq('id', user.id); } catch { /* migration 064 pendente */ }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 }); // nunca quebra a página
  }
}

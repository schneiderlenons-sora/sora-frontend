import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;
  const tipo = new URL(req.url).searchParams.get('tipo'); // 'problema' | 'melhoria' | null

  const base = () => supabaseAdmin.from('bug_reports').select('*').order('created_at', { ascending: false }).limit(200);
  let { data, error } = tipo ? await base().eq('tipo', tipo) : await base();
  // Coluna `tipo` pode não existir ainda (pré-migration 053) → cai sem filtro.
  if (error && tipo) ({ data, error } = await base());
  if (error) return NextResponse.json({ bugs: [], erro: error.message });
  return NextResponse.json({ bugs: data || [] });
}

export async function PATCH(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;
  const { id, status } = await req.json().catch(() => ({}));
  if (!id || !['aberto', 'em_andamento', 'resolvido'].includes(status)) {
    return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from('bug_reports').update({ status }).eq('id', id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

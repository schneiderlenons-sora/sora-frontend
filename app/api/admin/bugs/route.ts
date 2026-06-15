import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;
  const { data, error } = await supabaseAdmin
    .from('bug_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
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

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').replace(/[,()*%]/g, '').trim(); // sanitiza p/ o .or
  const filter = searchParams.get('filter') || 'todos';

  let query = supabaseAdmin
    .from('users')
    .select('id,name,email,phone,plano,plano_intervalo,plano_valido_ate,vitalicio,vitalicio_em,stripe_customer_id,onboarding_completed,welcomed_at,created_at')
    .order('created_at', { ascending: false })
    .limit(300);

  if (filter === 'ativos')        query = query.neq('plano', 'inativo');
  else if (filter === 'inativos') query = query.eq('plano', 'inativo');
  else if (filter === 'pagou_inativo') query = query.eq('plano', 'inativo').not('stripe_customer_id', 'is', null);

  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ users: data || [] });
}

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

  const BASE = 'id,name,email,phone,plano,plano_intervalo,plano_valido_ate,vitalicio,vitalicio_em,stripe_customer_id,onboarding_completed,welcomed_at,created_at,recuperacao_signup_em,recuperacao_enviada_em';
  // Colunas da migration 074 (exclusão do MRR) — só somam se já existirem.
  const COM_MRR = `${BASE},mrr_excluir,assinatura_cancelada`;

  const build = (cols: string) => {
    let query = supabaseAdmin.from('users').select(cols)
      .order('created_at', { ascending: false }).limit(300);
    if (filter === 'ativos')        query = query.neq('plano', 'inativo');
    else if (filter === 'inativos') query = query.eq('plano', 'inativo');
    else if (filter === 'pagou_inativo') query = query.eq('plano', 'inativo').not('stripe_customer_id', 'is', null);
    // Novos: cancelou (teve assinatura) x não concluiu (nunca assinou) x recuperados.
    else if (filter === 'cancelados')    query = query.eq('plano', 'inativo').not('plano_intervalo', 'is', null);
    else if (filter === 'nao_concluido') query = query.eq('plano', 'inativo').is('plano_intervalo', null);
    else if (filter === 'recuperados')   query = query.neq('plano', 'inativo')
      .or('recuperacao_signup_em.not.is.null,recuperacao_enviada_em.not.is.null');
    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    return query;
  };

  // Tenta com as colunas novas; se a 074 não rodou, cai na versão base.
  let { data, error } = await build(COM_MRR);
  if (error) ({ data, error } = await build(BASE));
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ users: data || [] });
}

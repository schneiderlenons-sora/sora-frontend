import { NextRequest, NextResponse } from 'next/server';
import { stripe, priceIdToPlano, priceIdToIntervalo } from '@/lib/stripe';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Sincroniza o plano direto da assinatura no Stripe — fallback pro caso do
// webhook atrasar/falhar. Chamado pela tela /planos após o checkout.
export async function POST(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ plano: null, motivo: 'sem_customer' });
    }

    const subs = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id as string,
      status: 'all',
      limit: 10,
    });
    const sub = subs.data.find((s) => s.status === 'active' || s.status === 'trialing');

    if (!sub) {
      return NextResponse.json({ plano: 'inativo', motivo: 'sem_assinatura_ativa' });
    }

    const priceId   = sub.items.data[0]?.price.id;
    const plano     = priceId ? priceIdToPlano(priceId) : null;
    const intervalo = priceId ? priceIdToIntervalo(priceId) : null;
    const periodEnd = (sub.items.data[0] as { current_period_end?: number })?.current_period_end;
    const valido_ate = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

    if (plano) {
      await supabaseAdmin.from('users').update({
        plano,
        plano_intervalo:        intervalo,
        plano_valido_ate:       valido_ate,
        stripe_subscription_id: sub.id,
      }).eq('id', user.id);
    }

    return NextResponse.json({ plano });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

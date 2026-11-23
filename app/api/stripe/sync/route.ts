import { NextRequest, NextResponse } from 'next/server';
import { priceIdToPlano, priceIdToIntervalo } from '@/lib/stripe';
import { assinaturaDoPlano, assinaturaDefineOPlano } from '@/lib/assinatura-vitalicio';
import { assinaturasDoCliente } from '@/lib/assinatura-vitalicio-stripe';
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
      .select('stripe_customer_id, vitalicio, vitalicio_em')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ plano: null, motivo: 'sem_customer' });
    }

    // ⚠️ Só assinatura de PLANO — a da conexão de Open Finance (add-on) não
    // define plano nenhum, e pegá-la por ser a mais nova deixava quem acabou
    // de assinar sem ativar.
    const resumida = assinaturaDoPlano(await assinaturasDoCliente(profile.stripe_customer_id as string));
    const sub = resumida?.sub;

    if (!sub) {
      return NextResponse.json({ plano: 'inativo', motivo: 'sem_assinatura_ativa' });
    }

    // ⚠️ VITALÍCIO: só uma assinatura feita DEPOIS do vitalício (a troca
    // deliberada, pela /planos) manda no plano. A de antes é a que sobrou de
    // quando a pessoa era assinante: regravar o plano com a validade dela fazia
    // a conta virar `inativo` quando a data passava (caso real, nov/2026).
    if (!assinaturaDefineOPlano(profile, resumida)) {
      return NextResponse.json({ plano: null, motivo: 'vitalicio' });
    }

    const priceId   = sub.items.data[0]?.price.id;
    // Deriva pelo price map; se não bater (ex.: price ID novo fora do mapa),
    // cai no metadata.plano que o checkout/embedded gravou na assinatura.
    const plano     = (priceId ? priceIdToPlano(priceId) : null)
                      || (sub.metadata?.plano as string | undefined)
                      || null;
    const intervalo = (priceId ? priceIdToIntervalo(priceId) : null)
                      || (sub.metadata?.intervalo as string | undefined)
                      || null;
    const periodEnd = (sub.items.data[0] as { current_period_end?: number })?.current_period_end;
    const valido_ate = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

    if (plano) {
      await supabaseAdmin.from('users').update({
        plano,
        plano_intervalo:        intervalo,
        plano_valido_ate:       valido_ate,
        stripe_subscription_id: sub.id,
        // Vitalício que assinou depois do vitalício está TROCANDO um pelo
        // outro — o mesmo que o webhook faz em checkout.session.completed. Sem
        // isto, se o sync chegasse antes do webhook (e o webhook falhasse), a
        // conta ficava com o plano novo e a marca de vitalício ao mesmo tempo.
        ...(profile.vitalicio ? { vitalicio: false } : {}),
      }).eq('id', user.id);
    }

    return NextResponse.json({ plano });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

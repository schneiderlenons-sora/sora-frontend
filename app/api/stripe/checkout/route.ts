import { NextRequest, NextResponse } from 'next/server';
import { stripe, PRICE_IDS, VITALICIO, type PlanoId, type Intervalo } from '@/lib/stripe';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { plano, intervalo, vitalicio } = (await req.json()) as {
      plano: PlanoId;
      intervalo: Intervalo;
      vitalicio?: boolean;
    };

    // Modo VITALÍCIO: pagamento único (mode:payment) com o price one-time.
    let priceId: string;
    const modo: 'subscription' | 'payment' = vitalicio ? 'payment' : 'subscription';
    if (vitalicio) {
      if (!VITALICIO.priceId) {
        return NextResponse.json({ erro: 'Vitalício não configurado (STRIPE_PRICE_VITALICIO)' }, { status: 400 });
      }
      priceId = VITALICIO.priceId;
    } else {
      if (!PRICE_IDS[plano]?.[intervalo]) {
        return NextResponse.json({ erro: 'Plano ou intervalo inválido' }, { status: 400 });
      }
      priceId = PRICE_IDS[plano][intervalo];
    }

    // Autentica o usuário via cookie de sessão
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
    }

    // Busca ou cria customer no Stripe
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id, email, name')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Domínio canônico é o www (apex faz 307→www). Forçar o www no retorno
    // garante que a tela de sucesso carregue COM o cookie de sessão — senão
    // o sync pós-pagamento dá 401 e o plano só ativa quando o webhook chega.
    const origin = (
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://www.forsora.com'
    ).replace('://forsora.com', '://www.forsora.com');

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: modo,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/planos?success=1${vitalicio ? '&vitalicio=1' : ''}`,
      cancel_url:  `${origin}/planos?canceled=1`,
      allow_promotion_codes: true,
      metadata: vitalicio
        ? { supabase_user_id: user.id, vitalicio: 'true', plano: 'black' }
        : { supabase_user_id: user.id, plano, intervalo },
      // No vitalício (mode:payment) habilita PARCELAMENTO de cartão BR (até 12x).
      ...(vitalicio
        ? { payment_method_options: { card: { installments: { enabled: true } } } }
        : { subscription_data: { metadata: { supabase_user_id: user.id, plano, intervalo } } }),
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

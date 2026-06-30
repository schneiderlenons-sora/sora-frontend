import { NextRequest, NextResponse } from 'next/server';
import { stripe, PRICE_IDS, type PlanoId, type Intervalo } from '@/lib/stripe';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Checkout de ASSINATURA (planos mensais/anuais). O vitalício é pago via
// Mercado Pago (checkout transparente) — ver app/api/mercadopago/*.
export async function POST(req: NextRequest) {
  try {
    const { plano, intervalo } = (await req.json()) as {
      plano: PlanoId;
      intervalo: Intervalo;
    };

    if (!PRICE_IDS[plano]?.[intervalo]) {
      return NextResponse.json({ erro: 'Plano ou intervalo inválido' }, { status: 400 });
    }
    const priceId = PRICE_IDS[plano][intervalo];

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
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/planos?success=1`,
      cancel_url:  `${origin}/planos?canceled=1`,
      allow_promotion_codes: true,
      metadata: { supabase_user_id: user.id, plano, intervalo },
      subscription_data: { metadata: { supabase_user_id: user.id, plano, intervalo } },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

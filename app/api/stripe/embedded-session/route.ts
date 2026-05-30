import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe, PRICE_IDS, type PlanoId, type Intervalo } from '@/lib/stripe';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Cria uma Checkout Session no modo EMBEDDED (formulário dentro da própria
// página, sem redirect). Retorna o client_secret pro <EmbeddedCheckout/>.
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

    // Usuário autenticado (logado logo após o cadastro)
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

    // ui_mode/redirect_on_completion existem na API mas não nos tipos desta
    // versão do SDK — cast localizado pra usar o checkout embarcado.
    const params = {
      ui_mode: 'embedded',
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // Não redireciona ao concluir — tratamos no cliente (onComplete) e
      // seguimos pro onboarding depois que o webhook ativa o plano.
      redirect_on_completion: 'never',
      allow_promotion_codes: true,
      metadata: { supabase_user_id: user.id, plano, intervalo },
      subscription_data: {
        metadata: { supabase_user_id: user.id, plano, intervalo },
      },
    } as unknown as Stripe.Checkout.SessionCreateParams;

    const session = await stripe.checkout.sessions.create(params);

    return NextResponse.json({ client_secret: (session as { client_secret?: string }).client_secret });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe, priceIdToPlano, priceIdToIntervalo } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendCAPIEvent } from '@/lib/facebook-capi';

// Necessário para ler o raw body e verificar a assinatura Stripe
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ erro: 'Sem assinatura Stripe' }, { status: 400 });
  }

  let event: Stripe.Event;
  const body = await req.text();
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Assinatura inválida';
    console.error('[stripe/webhook] construção falhou:', msg);
    return NextResponse.json({ erro: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription') {
          await handleCheckoutCompleted(session);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(sub);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
        break;
      }
      // invoice.payment_failed — Stripe já retenta automaticamente por padrão.
      // O plano só é desativado quando a assinatura é cancelada (evento acima).
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro processando evento';
    console.error('[stripe/webhook] erro:', event.type, msg);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId  = session.metadata?.supabase_user_id;
  const plano   = session.metadata?.plano;
  const intervalo = session.metadata?.intervalo;
  if (!userId || !plano) return;

  // 1) ATIVA O PLANO JÁ a partir do metadata — NÃO depende de buscar a
  //    assinatura. Antes, se o subscriptions.retrieve falhasse, o plano nunca
  //    era setado e o cliente ficava "inativo" mesmo tendo pago (e re-pagava).
  await supabaseAdmin.from('users').update({
    plano,
    plano_intervalo:    intervalo ?? null,
    stripe_customer_id: (session.customer as string) ?? null,
  }).eq('id', userId);

  // 2) Enriquece com validade + id da assinatura (best-effort — se falhar, o
  //    plano já está ativo; o /api/stripe/sync completa depois).
  try {
    const sub = typeof session.subscription === 'string'
      ? await stripe.subscriptions.retrieve(session.subscription)
      : (session.subscription as Stripe.Subscription | null);
    if (sub) {
      const periodEnd = sub.items.data[0]?.current_period_end;
      await supabaseAdmin.from('users').update({
        plano_valido_ate:       periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        stripe_subscription_id: sub.id,
      }).eq('id', userId);
    }
  } catch (e) {
    console.error('[stripe/webhook] enrich pós-ativação falhou (plano já ativo):', e instanceof Error ? e.message : e);
  }

  // CAPI: Purchase server-side (mais confiável que o pixel client-side)
  const amount = session.amount_total ? session.amount_total / 100 : 0;
  sendCAPIEvent({
    event_name: 'Purchase',
    event_source_url: `https://forsora.com/planos?success=1`,
    user_data: {
      em: session.customer_details?.email || undefined,
    },
    custom_data: {
      value: amount,
      currency: session.currency?.toUpperCase() || 'BRL',
      content_name: `Plano ${plano} ${intervalo}`,
    },
  }).catch(() => {}); // non-blocking
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  // Tenta pelo metadata da subscription (mais confiável)
  const userId = sub.metadata?.supabase_user_id;
  if (userId) {
    await updateUserFromSub(userId, sub);
    return;
  }
  // Fallback: busca por stripe_customer_id
  const { data } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('stripe_customer_id', sub.customer as string)
    .single();
  if (data) await updateUserFromSub(data.id, sub);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = sub.metadata?.supabase_user_id;
  const update = {
    plano: 'inativo' as const,
    stripe_subscription_id: null,
    plano_valido_ate: null,
  };

  if (userId) {
    await supabaseAdmin.from('users').update(update).eq('id', userId);
    return;
  }
  const { data } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('stripe_customer_id', sub.customer as string)
    .single();
  if (data) await supabaseAdmin.from('users').update(update).eq('id', data.id);
}

async function updateUserFromSub(userId: string, sub: Stripe.Subscription) {
  const priceId   = sub.items.data[0]?.price.id;
  const plano     = priceId ? priceIdToPlano(priceId) : null;
  const intervalo = priceId ? priceIdToIntervalo(priceId) : null;
  const periodEnd2 = sub.items.data[0]?.current_period_end;
  const valido_ate = periodEnd2 ? new Date(periodEnd2 * 1000).toISOString() : null;
  const isActive  = sub.status === 'active' || sub.status === 'trialing';

  await supabaseAdmin.from('users').update({
    plano:                   isActive && plano ? plano : 'inativo',
    plano_intervalo:         intervalo,
    plano_valido_ate:        valido_ate,
    stripe_subscription_id:  sub.id,
  }).eq('id', userId);
}

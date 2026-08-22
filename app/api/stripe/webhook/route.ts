import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe, priceIdToPlano, priceIdToIntervalo, ehPriceConexaoOf } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendCAPIEvent } from '@/lib/facebook-capi';
import { sendTikTokEvent } from '@/lib/tiktok-events-api';
import { slugify } from '@/lib/analytics';

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
      // Pagamento recusado (ex.: assinatura nova que falhou por falta de fundos).
      // Marca o lead pra recuperação (o cron do backend manda o WhatsApp).
      // Renovação de assinatura ATIVA também cai aqui, mas o handler só age se o
      // usuário ainda estiver `inativo` — então não afeta quem já é cliente.
      case 'invoice.payment_failed':
      case 'payment_intent.payment_failed': {
        const obj = event.data.object as { customer?: string | null };
        await handlePagamentoFalhou(obj.customer ?? null);
        break;
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro processando evento';
    console.error('[stripe/webhook] erro:', event.type, msg);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ─── Handlers ────────────────────────────────────────────────────────────────

// ── Add-on de conexão do Open Finance ───────────────────────────────────────
//
// ⚠️ É uma assinatura SEPARADA da do plano. Sem esta distinção, o handler do
// plano leria a assinatura de R$6 e rebaixaria o cliente pra 'inativo' (o price
// da conexão não mapeia pra plano nenhum). Por isso todo handler de assinatura
// checa isto ANTES de qualquer coisa.
function ehAddonConexao(sub: Stripe.Subscription): boolean {
  if (sub.metadata?.tipo === 'conexao_of') return true;
  return sub.items.data.some((i) => ehPriceConexaoOf(i.price?.id));
}

async function gravarConexoesPagas(userId: string, sub: Stripe.Subscription) {
  const item = sub.items.data.find((i) => ehPriceConexaoOf(i.price?.id)) || sub.items.data[0];
  // Só assinatura EM DIA libera conexão. 'past_due'/'unpaid' zera o acesso —
  // é custo mensal nosso no agregador; manter ligado sem pagamento é prejuízo.
  const ativa = sub.status === 'active' || sub.status === 'trialing';
  const qtd = ativa ? (item?.quantity ?? 0) : 0;
  const intervalo = item?.price?.recurring?.interval === 'year' ? 'anual' : 'mensal';

  try {
    await supabaseAdmin.from('users').update({
      of_conexoes_pagas: qtd,
      of_assinatura_id: sub.id,
      of_assinatura_intervalo: intervalo,
    }).eq('id', userId);
  } catch (e) {
    // Migration 111 pendente: não pode derrubar o webhook inteiro.
    console.error('[stripe/webhook] conexão OF (migration 111?):', e instanceof Error ? e.message : e);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId  = session.metadata?.supabase_user_id;
  const plano   = session.metadata?.plano;
  const intervalo = session.metadata?.intervalo;

  // Add-on de conexão: não mexe em plano nenhum, só grava a quantidade.
  if (userId && session.metadata?.tipo === 'conexao_of') {
    try {
      const sub = typeof session.subscription === 'string'
        ? await stripe.subscriptions.retrieve(session.subscription)
        : (session.subscription as Stripe.Subscription | null);
      if (sub) await gravarConexoesPagas(userId, sub);
    } catch (e) {
      console.error('[stripe/webhook] add-on conexão:', e instanceof Error ? e.message : e);
    }
    return;
  }

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
  //
  // ⚠️ `amount_total` pode vir 0 (cupom de 100%) ou nulo. Antes isso virava
  // `value: 0`, e o Meta trata zero como VALOR AUSENTE — foi o que fez ele
  // acusar 20% dos Purchase como de baixa qualidade e parar de calcular ROAS.
  // O plano é ativado do mesmo jeito; o que não acontece é o evento de venda,
  // porque venda de R$ 0 não gera receita pra atribuir. A guarda em
  // `sendCAPIEvent` barra de qualquer forma — aqui é só pra não montar o
  // evento à toa e pra o log dizer o motivo.
  const amount = session.amount_total ? session.amount_total / 100 : 0;
  if (amount <= 0) {
    console.warn(`[stripe/webhook] Purchase não enviado: amount_total=${session.amount_total} `
      + `(cupom de 100%?). Plano ativado normalmente. session=${session.id}`);
  }
  const nomePlano = `Plano ${plano} ${intervalo}`;
  // content_id — sem ele o TikTok acusa "Crítica: ID do conteúdo ausente" em
  // 100% dos eventos (a Sora vende plano, não SKU de catálogo; um slug
  // estável do nome do plano funciona igual a um SKU pros dois pixels).
  const contentId = slugify(nomePlano);
  sendCAPIEvent({
    event_name: 'Purchase',
    // ⚠️ event_id DETERMINÍSTICO. Sem ele o Meta não tem como desduplicar:
    // se a Stripe reenviar o webhook (ela reenvia em falha), a mesma venda
    // conta duas vezes e o ROAS sai inflado. `session.id` é único por compra
    // e igual em toda retentativa — mesma ideia do `mp_${paymentId}` que o
    // webhook do Mercado Pago já usa.
    event_id: `stripe_${session.id}`,
    event_source_url: `https://forsora.com/planos?success=1`,
    user_data: {
      em: session.customer_details?.email || undefined,
      // Cookies do navegador do comprador, guardados no metadata lá no
      // checkout — é o que liga a venda ao clique do anúncio. Só o e-mail
      // deixava a qualidade da correspondência baixa.
      fbp: session.metadata?.fbp || undefined,
      fbc: session.metadata?.fbc || undefined,
      client_ip_address: session.metadata?.fb_ip || undefined,
      client_user_agent: session.metadata?.fb_ua || undefined,
      external_id: session.metadata?.supabase_user_id || undefined,
    },
    custom_data: {
      value: amount,
      currency: session.currency?.toUpperCase() || 'BRL',
      content_name: nomePlano,
      content_ids: [contentId],
    },
  }).catch(() => {}); // non-blocking

  // Events API do TikTok: mesmo Purchase server-side, espelhando o CAPI acima
  // (sem ttclid/_ttp aqui — o webhook não tem acesso ao cookie do navegador;
  // o match fica só por e-mail, igual o CAPI do Meta nesse mesmo ponto).
  sendTikTokEvent({
    event: 'CompletePayment',
    event_source_url: `https://forsora.com/planos?success=1`,
    user_data: {
      email: session.customer_details?.email || undefined,
    },
    custom_data: {
      value: amount,
      currency: session.currency?.toUpperCase() || 'BRL',
      content_name: nomePlano,
      content_id: contentId,
      content_type: 'product',
    },
  }).catch(() => {}); // non-blocking
}

// Vitalício não pode ser rebaixado por evento de assinatura antiga. Tolerante:
// se a coluna não existir (pré-migration 060), retorna false (não bloqueia).
async function ehVitalicio(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users').select('vitalicio').eq('id', userId).maybeSingle();
    if (error) return false;
    return !!data?.vitalicio;
  } catch { return false; }
}

// Pagamento recusado → marca o usuário pra recuperação (cron do backend envia
// o WhatsApp). Só age em conta ainda `inativo` que nunca recebeu recuperação.
// Tolerante: se a migration 047 não rodou, só loga (não derruba o webhook).
async function handlePagamentoFalhou(customerId: string | null) {
  if (!customerId) return;
  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, plano, phone, recuperacao_enviada_em')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    // Recupera só lead que ainda não pagou, tem WhatsApp e nunca foi recuperado.
    if (!user || user.plano !== 'inativo' || !user.phone || user.recuperacao_enviada_em) return;

    await supabaseAdmin
      .from('users')
      .update({ recuperacao_pendente_em: new Date().toISOString() })
      .eq('id', user.id);
  } catch (e) {
    console.error('[stripe/webhook] recuperação (migration 047?):', e instanceof Error ? e.message : e);
  }
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  // Tenta pelo metadata da subscription (mais confiável)
  const userId = sub.metadata?.supabase_user_id;
  if (userId) {
    if (ehAddonConexao(sub)) { await gravarConexoesPagas(userId, sub); return; }
    await updateUserFromSub(userId, sub);
    return;
  }
  // Fallback: busca por stripe_customer_id
  const { data } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('stripe_customer_id', sub.customer as string)
    .single();
  if (!data) return;
  if (ehAddonConexao(sub)) { await gravarConexoesPagas(data.id, sub); return; }
  await updateUserFromSub(data.id, sub);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  // Resolve o usuário (metadata da sub ou customer).
  let targetId = sub.metadata?.supabase_user_id || null;
  if (!targetId) {
    const { data } = await supabaseAdmin
      .from('users').select('id').eq('stripe_customer_id', sub.customer as string).single();
    targetId = data?.id ?? null;
  }
  if (!targetId) return;

  // Add-on cancelado: zera as conexões pagas e NÃO toca no plano — cancelar a
  // conexão de R$6 não pode rebaixar quem paga Premium.
  if (ehAddonConexao(sub)) {
    try {
      await supabaseAdmin.from('users').update({
        of_conexoes_pagas: 0, of_assinatura_id: null, of_assinatura_intervalo: null,
      }).eq('id', targetId);
    } catch { /* migration 111 pendente */ }
    return;
  }

  // BLINDAGEM: vitalício nunca é rebaixado — só desvincula a assinatura antiga.
  if (await ehVitalicio(targetId)) {
    await supabaseAdmin.from('users').update({ stripe_subscription_id: null }).eq('id', targetId);
    return;
  }

  await supabaseAdmin.from('users').update({
    plano: 'inativo' as const,
    stripe_subscription_id: null,
    plano_valido_ate: null,
  }).eq('id', targetId);
}

async function updateUserFromSub(userId: string, sub: Stripe.Subscription) {
  // BLINDAGEM: vitalício mantém Black; só registra o id da assinatura.
  if (await ehVitalicio(userId)) {
    await supabaseAdmin.from('users').update({ stripe_subscription_id: sub.id }).eq('id', userId);
    return;
  }
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

  // Sinal de cancelamento (cancel_at_period_end): a pessoa segue com acesso até o
  // fim do período pago, mas NÃO renova → sai do MRR. Update SEPARADO e tolerante:
  // se a migration 074 não rodou, a coluna não existe — não pode derrubar a
  // ativação do plano acima. Reativou? cancel_at_period_end volta a false aqui.
  try {
    await supabaseAdmin.from('users')
      .update({ assinatura_cancelada: !!sub.cancel_at_period_end })
      .eq('id', userId);
  } catch { /* coluna pode não existir ainda (migration 074) */ }
}

// =============================================================================
// Ponte entre o Stripe e as regras puras de lib/assinatura-vitalicio.ts.
// (A regra mora lá, com eval; aqui só se busca e se aplica.)
// =============================================================================
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { ehAddonConexao } from '@/lib/conexao-of-stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { assinaturasAEncerrarNoVitalicio, type AssinaturaResumo, type Encerramento } from '@/lib/assinatura-vitalicio';

export function resumoDaAssinatura(sub: Stripe.Subscription): AssinaturaResumo & { sub: Stripe.Subscription } {
  return {
    id: sub.id,
    status: sub.status,
    criadaEm: sub.created,
    addon: ehAddonConexao(sub),
    cancelaNoFim: sub.cancel_at_period_end,
    sub,
  };
}

/** Assinaturas do cliente no Stripe, já resumidas (mais nova primeiro). */
export async function assinaturasDoCliente(customerId: string) {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
  return subs.data.map(resumoDaAssinatura);
}

/**
 * A conta virou vitalícia: para as assinaturas de PLANO que ainda cobram.
 * Best-effort — o vitalício já foi pago e ativado; falha aqui só é registrada
 * (e a próxima ativação, ex. o webhook do Mercado Pago, tenta de novo).
 */
export async function encerrarAssinaturasDoPlano(userId: string): Promise<{ encerradas: Encerramento[]; erro?: string }> {
  try {
    const { data: u } = await supabaseAdmin.from('users').select('stripe_customer_id').eq('id', userId).maybeSingle();
    const customerId = u?.stripe_customer_id as string | undefined;
    if (!customerId) return { encerradas: [] };
    const plano = assinaturasAEncerrarNoVitalicio(await assinaturasDoCliente(customerId));
    for (const e of plano) {
      if (e.como === 'agora') {
        await stripe.subscriptions.cancel(e.id);
      } else {
        await stripe.subscriptions.update(e.id, {
          cancel_at_period_end: true,
          metadata: { encerrada_por: 'vitalicio' },
        });
      }
      console.log(`[vitalicio] assinatura de plano ${e.id} encerrada (${e.como}) — conta ${userId} virou vitalícia`);
    }
    return { encerradas: plano };
  } catch (e: unknown) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error(`[vitalicio] NÃO consegui encerrar a assinatura de plano da conta ${userId} — ela pode seguir cobrando:`, erro);
    return { encerradas: [], erro };
  }
}

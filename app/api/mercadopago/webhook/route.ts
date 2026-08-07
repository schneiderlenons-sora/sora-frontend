import { NextRequest, NextResponse } from 'next/server';
import { mpGetPayment } from '@/lib/mercadopago';
import { ativarVitalicio } from '@/lib/vitalicio';
import { sendCAPIEvent } from '@/lib/facebook-capi';
import { sendTikTokEvent } from '@/lib/tiktok-events-api';

export const dynamic = 'force-dynamic';

// Webhook do Mercado Pago. Não confiamos no corpo: pegamos o id e BUSCAMOS o
// pagamento na API do MP (fonte da verdade). Se aprovado → ativa o vitalício
// pro usuário em external_reference (supabase_user_id).
export async function POST(req: NextRequest) {
  try {
    let body: { type?: string; data?: { id?: string } } = {};
    try { body = await req.json(); } catch { /* MP às vezes manda só query */ }

    const url = req.nextUrl;
    const type = body.type || url.searchParams.get('type') || url.searchParams.get('topic');
    const paymentId = body.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');

    // Só tratamos notificação de pagamento (ignora merchant_order etc.).
    if (type !== 'payment' || !paymentId) return NextResponse.json({ ok: true });

    const payment = await mpGetPayment(String(paymentId));
    if (payment.status === 'approved' && payment.external_reference) {
      const plano = payment.metadata?.plano === 'kit' ? 'kit' : 'premium';
      await ativarVitalicio(payment.external_reference, plano, payment.transaction_amount);
      console.log(`💎 [mp/webhook] vitalício ativado p/ ${payment.external_reference} (pagamento ${paymentId})`);

      // Dados de match capturados no /process (o webhook do MP não vê os cookies/IP
      // do comprador). event_id determinístico → dedup se o MP reenviar o webhook.
      const md = (payment.metadata || {}) as Record<string, string | undefined>;
      const nomePlano = plano === 'kit' ? 'Kit Vitalício' : 'Premium Vitalício';
      const contentId = `vitalicio-${plano}`; // estável — não usa slugify pra não puxar lib/analytics num arquivo tão pequeno
      sendCAPIEvent({
        event_name: 'Purchase',
        event_id: `mp_${paymentId}`,
        event_source_url: 'https://www.forsora.com/oferta',
        user_data: {
          em: md.fb_em,
          external_id: payment.external_reference,
          fbp: md.fbp,
          fbc: md.fbc,
          client_ip_address: md.fb_ip,
          client_user_agent: md.fb_ua,
        },
        custom_data: {
          value: payment.transaction_amount || 97,
          currency: 'BRL',
          content_name: nomePlano,
          content_ids: [contentId],
        },
      }).catch(() => {});

      // ⚠️ Vitalício é vendido pelo Mercado Pago, não pelo Stripe — este
      // disparo NUNCA existiu pro TikTok antes (só ia pro Meta). Como boa
      // parte das vendas da Sora passa por /oferta, /kit, /chat e /quiz
      // (todas vitalício), o TikTok nunca via NENHUM "Compras" de verdade —
      // é bem provável que seja a causa real do "Eventos ausentes: Compras"
      // continuar aparecendo mesmo depois do funil ViewContent/AddToCart ter
      // sido corrigido. content_id também vai junto (era o outro alerta:
      // "Crítica: ID do conteúdo ausente").
      sendTikTokEvent({
        event: 'CompletePayment',
        event_id: `mp_${paymentId}`,
        event_source_url: 'https://www.forsora.com/oferta',
        user_data: {
          email: md.fb_em,
          external_id: payment.external_reference,
          ttp: md.ttp,
          ttclid: md.ttclid,
        },
        custom_data: {
          value: payment.transaction_amount || 97,
          currency: 'BRL',
          content_name: nomePlano,
          content_id: contentId,
          content_type: 'product',
        },
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    // Retorna 200 mesmo em erro pra evitar retries infinitos; loga pra debug.
    console.error('[mp/webhook] erro:', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: true });
  }
}

// MP também valida o endpoint com GET às vezes.
export async function GET() {
  return NextResponse.json({ ok: true });
}

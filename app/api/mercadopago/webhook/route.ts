import { NextRequest, NextResponse } from 'next/server';
import { mpGetPayment } from '@/lib/mercadopago';
import { ativarVitalicio } from '@/lib/vitalicio';
import { sendCAPIEvent } from '@/lib/facebook-capi';

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
          content_name: plano === 'kit' ? 'Kit Vitalício' : 'Premium Vitalício',
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

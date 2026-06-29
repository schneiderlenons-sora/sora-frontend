import { NextRequest, NextResponse } from 'next/server';
import { stripe, VITALICIO } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

// Diagnóstico (read-only) da config do preço vitalício no Stripe — confirma
// moeda (precisa ser BRL p/ parcelamento), valor e se é one-time. Temporário.
// Uso: /api/stripe/debug-vitalicio?key=sora-debug
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'sora-debug') {
    return NextResponse.json({ erro: 'forbidden' }, { status: 403 });
  }
  if (!VITALICIO.priceId) {
    return NextResponse.json({ erro: 'STRIPE_PRICE_VITALICIO não setado' }, { status: 400 });
  }
  try {
    const price = await stripe.prices.retrieve(VITALICIO.priceId, { expand: ['product'] });
    const prod = price.product as { id: string; name?: string } | string;
    return NextResponse.json({
      priceId: price.id,
      currency: price.currency,                 // precisa ser "brl"
      unit_amount: price.unit_amount,           // 9700
      type: price.type,                         // "one_time"
      recurring: price.recurring,               // null
      product: typeof prod === 'string' ? prod : { id: prod.id, name: prod.name },
      parcelamento_ok: price.currency === 'brl' && price.type === 'one_time',
    });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : 'falhou' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { mpCreatePreference, mpIsTest, VITALICIO_MP } from '@/lib/mercadopago';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Cria a preferência de checkout do VITALÍCIO no Mercado Pago e devolve a URL
// pra redirecionar (parcelamento até 12x + Pix + boleto). Identifica o usuário
// por external_reference (supabase_user_id) — o webhook usa isso pra ativar.
export async function POST(req: NextRequest) {
  try {
    if (!process.env.MP_ACCESS_TOKEN) {
      return NextResponse.json({ erro: 'Mercado Pago não configurado (MP_ACCESS_TOKEN)' }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from('users').select('email, name').eq('id', user.id).single();

    const origin = (
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://www.forsora.com'
    ).replace('://forsora.com', '://www.forsora.com');

    const pref = await mpCreatePreference({
      items: [{
        id: 'vitalicio',
        title: VITALICIO_MP.titulo,
        quantity: 1,
        unit_price: VITALICIO_MP.preco,
        currency_id: 'BRL',
      }],
      payer: { email: profile?.email || user.email, name: profile?.name || undefined },
      external_reference: user.id,                       // supabase_user_id
      metadata: { supabase_user_id: user.id, vitalicio: true },
      back_urls: {
        success: `${origin}/planos?success=1&vitalicio=1`,
        pending: `${origin}/planos?pending=1&vitalicio=1`,
        failure: `${origin}/planos?canceled=1`,
      },
      auto_return: 'approved',
      notification_url: `${origin}/api/mercadopago/webhook`,
      statement_descriptor: 'SORA',
      payment_methods: {
        installments: VITALICIO_MP.maxParcelas,           // até 12x
        excluded_payment_types: [{ id: 'atm' }],
      },
    });

    // Credencial de teste → sandbox; produção → init_point.
    const url = mpIsTest() ? (pref.sandbox_init_point || pref.init_point) : pref.init_point;
    return NextResponse.json({ url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { mpCreatePayment, VITALICIO_MP } from '@/lib/mercadopago';
import { createSupabaseServer } from '@/lib/supabase-server';
import { ativarVitalicio } from '@/lib/vitalicio';

export const dynamic = 'force-dynamic';

// Checkout Transparente: recebe o formData do Payment Brick e cria o pagamento
// no Mercado Pago. Se aprovado (cartão), ativa o vitalício na hora. Pix volta
// 'pending' com o QR pra exibir (o webhook confirma quando pago).
export async function POST(req: NextRequest) {
  try {
    if (!process.env.MP_ACCESS_TOKEN) {
      return NextResponse.json({ erro: 'Mercado Pago não configurado (MP_ACCESS_TOKEN)' }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

    const form = await req.json() as {
      token?: string;
      issuer_id?: string;
      payment_method_id?: string;
      installments?: number;
      payer?: { email?: string; identification?: { type?: string; number?: string } };
    };

    const origin = (
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://www.forsora.com'
    ).replace('://forsora.com', '://www.forsora.com');

    const payment = await mpCreatePayment({
      transaction_amount: VITALICIO_MP.preco,
      description: VITALICIO_MP.titulo,
      token: form.token,
      installments: form.installments || 1,
      payment_method_id: form.payment_method_id,
      issuer_id: form.issuer_id,
      payer: { email: form.payer?.email || user.email, identification: form.payer?.identification },
      external_reference: user.id,
      metadata: { supabase_user_id: user.id, vitalicio: true },
      notification_url: `${origin}/api/mercadopago/webhook`,
      statement_descriptor: 'SORA',
    });

    // Cartão aprovado na hora → ativa já (o webhook é rede de segurança).
    if (payment.status === 'approved') {
      await ativarVitalicio(user.id);
    }

    const td = payment.point_of_interaction?.transaction_data;
    return NextResponse.json({
      status: payment.status,                 // approved | pending | rejected | in_process
      status_detail: payment.status_detail,
      id: payment.id,
      pix: td?.qr_code ? { qr_code: td.qr_code, qr_code_base64: td.qr_code_base64, ticket_url: td.ticket_url } : null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

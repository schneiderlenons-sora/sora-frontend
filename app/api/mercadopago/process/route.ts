import { NextRequest, NextResponse } from 'next/server';
import { mpCreatePayment, tierConfig } from '@/lib/mercadopago';
import { aplicarCupomVitalicio } from '@/lib/cupons';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
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
      tier?: string;
      cupom?: string;
    };

    // Valor + plano SEMPRE pelo tier no servidor (nunca confiar no cliente).
    let cfg = tierConfig(form.tier);
    // Upgrade (+R$50) só vale pra quem JÁ tem o Kit; senão cobra a Completa cheia.
    if (form.tier === 'upgrade') {
      const { data: u } = await supabaseAdmin.from('users').select('plano').eq('id', user.id).maybeSingle();
      if (u?.plano !== 'kit') cfg = tierConfig('completa');
    }

    // Cupom (opcional) — desconto SEMPRE recalculado aqui (nunca confiar no
    // cliente). Código inválido → 0% (cobra cheio, fluxo normal).
    const { valor, pct, codigo } = aplicarCupomVitalicio(cfg.amount, form.cupom);

    // 100% OFF (SORA100) → acesso grátis, sem passar pelo Mercado Pago. Sem
    // webhook de rede de segurança aqui: só responde 'approved' se ATIVOU mesmo.
    if (pct >= 100) {
      const ativado = await ativarVitalicio(user.id, cfg.plano);
      if (!ativado) {
        return NextResponse.json({ erro: 'Não consegui ativar seu acesso agora. Tente de novo em instantes.' }, { status: 500 });
      }
      return NextResponse.json({ status: 'approved', ativado: true, gratis: true, cupom: codigo });
    }

    const origin = (
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://www.forsora.com'
    ).replace('://forsora.com', '://www.forsora.com');

    // Dados de match do Facebook — capturados AQUI (roda no navegador do comprador),
    // guardados no metadata pra o webhook do MP mandar no Purchase (CAPI). Sem isso
    // o Facebook não atribui a venda ao clique do anúncio → não conta no Ads.
    const fbMeta = {
      fbp:   req.cookies.get('_fbp')?.value || undefined,
      fbc:   req.cookies.get('_fbc')?.value || undefined,
      fb_ip: (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || undefined,
      fb_ua: (req.headers.get('user-agent') || '').slice(0, 256) || undefined,
      fb_em: user.email || undefined,
    };

    const payment = await mpCreatePayment({
      transaction_amount: valor,
      description: cfg.titulo,
      token: form.token,
      installments: form.installments || 1,
      payment_method_id: form.payment_method_id,
      issuer_id: form.issuer_id,
      payer: { email: form.payer?.email || user.email, identification: form.payer?.identification },
      external_reference: user.id,
      metadata: { supabase_user_id: user.id, vitalicio: true, plano: cfg.plano, cupom: codigo, desconto_pct: pct, ...fbMeta },
      notification_url: `${origin}/api/mercadopago/webhook`,
      statement_descriptor: 'SORA',
    });

    // Registra a intenção do vitalício (pra recuperação levar de volta pra oferta
    // certa). Tolerante: se a coluna não existir (migration 064), só não grava.
    const intentTier = ['kit', 'completa', 'upgrade'].includes(form.tier || '') ? form.tier : 'completa';
    try {
      await supabaseAdmin.from('users').update({ vitalicio_intent: intentTier }).eq('id', user.id);
    } catch { /* migration 064 pendente */ }

    // Cartão aprovado na hora → ativa já (o webhook é rede de segurança).
    let ativado = false;
    if (payment.status === 'approved') {
      ativado = await ativarVitalicio(user.id, cfg.plano);
      // Limpa flag de recuperação (caso tenha falhado antes e agora deu certo).
      try { await supabaseAdmin.from('users').update({ recuperacao_pendente_em: null }).eq('id', user.id); } catch {}
    } else if (payment.status === 'rejected') {
      // #1 — pagamento recusado: marca pra recuperação (o cron manda o WhatsApp de
      // "cartão recusado" pra quem tem telefone). Só p/ lead inativo. Tolerante.
      try {
        await supabaseAdmin.from('users')
          .update({ recuperacao_pendente_em: new Date().toISOString() })
          .eq('id', user.id).eq('plano', 'inativo');
      } catch { /* migration 047 pendente */ }
    }

    const td = payment.point_of_interaction?.transaction_data;
    return NextResponse.json({
      status: payment.status,                 // approved | pending | rejected | in_process
      status_detail: payment.status_detail,
      id: payment.id,
      ativado,                                 // false = pagou mas NÃO liberou (o webhook tenta de novo)
      pix: td?.qr_code ? { qr_code: td.qr_code, qr_code_base64: td.qr_code_base64, ticket_url: td.ticket_url } : null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

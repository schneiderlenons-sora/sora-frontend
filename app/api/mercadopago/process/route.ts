import { NextRequest, NextResponse } from 'next/server';
import { mpCreatePayment, tierConfig } from '@/lib/mercadopago';
import { aplicarCupomVitalicio } from '@/lib/cupons';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ativarVitalicio } from '@/lib/vitalicio';

export const dynamic = 'force-dynamic';

// Status do MP que significam venda perdida. `pending`/`in_process` NÃO entram:
// é o Pix aguardando pagamento, que ainda pode ser aprovado pelo webhook.
const FALHOU = new Set(['rejected', 'cancelled', 'charged_back', 'refunded']);

/**
 * Marca que a venda do vitalício falhou, pra ela aparecer no painel admin
 * ("Pagamento falhou") e no cron de recuperação.
 *
 * ⚠️ NÃO filtrar por `plano='inativo'` — era o que fazia sumir justamente a
 * venda mais valiosa: assinante do Básico comprando o vitalício Completo teve a
 * marcação descartada em silêncio (update com filtro que não casa não dá erro).
 * O único que não faz sentido marcar é quem JÁ tem o vitalício.
 *
 * Tolerante de propósito: falha de registro nunca pode derrubar o checkout.
 */
async function marcarPagamentoFalho(userId: string, motivo?: string | null) {
  const patch: Record<string, unknown> = { recuperacao_pendente_em: new Date().toISOString() };
  if (motivo) patch.recuperacao_motivo = String(motivo).slice(0, 120);
  try {
    const { error } = await supabaseAdmin.from('users')
      .update(patch).eq('id', userId).not('vitalicio', 'is', true);
    // `recuperacao_motivo` é da migration 102: sem ela, grava ao menos a data.
    if (error) {
      await supabaseAdmin.from('users')
        .update({ recuperacao_pendente_em: patch.recuperacao_pendente_em })
        .eq('id', userId).not('vitalicio', 'is', true);
    }
  } catch { /* migration 047 pendente */ }
}

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
      deviceId?: string;   // window.MP_DEVICE_SESSION_ID (fingerprint p/ o antifraude)
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
      const ativado = await ativarVitalicio(user.id, cfg.plano, valor); // valor = 0 (100% off)
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

    // Nome do pagador ajuda o antifraude do MP a pontuar melhor (junto do device
    // id e do CPF). Best-effort: vem do metadata do auth; se não tiver, omite.
    const nomeCompleto = String((user.user_metadata as Record<string, unknown>)?.name || (user.user_metadata as Record<string, unknown>)?.full_name || '').trim();
    const [firstName, ...resto] = nomeCompleto.split(/\s+/);
    const payerNome = firstName ? { first_name: firstName, last_name: resto.join(' ') || firstName } : {};

    // `additional_info` (itens + dados do pagador) é usado PESADO pelo antifraude
    // do MP pra pontuar o risco. Quanto mais completo, maior a chance de aprovar.
    const telefone = String((user.user_metadata as Record<string, unknown>)?.phone || user.phone || '').replace(/\D/g, '');
    const additional_info: Record<string, unknown> = {
      items: [{
        id: cfg.plano,
        title: cfg.titulo,
        description: cfg.titulo,
        category_id: 'services',
        quantity: 1,
        unit_price: valor,
      }],
      payer: {
        ...payerNome,
        ...(telefone ? { phone: { number: telefone } } : {}),
      },
    };

    // ⚠️ O MP nem sempre recusa com `status: rejected`: quando barra no controle
    // de segurança/antifraude, costuma responder ERRO HTTP — e aí a exceção
    // pulava direto pro catch lá embaixo, sem registrar nada. A tentativa
    // desaparecia do painel como se nunca tivesse existido.
    let payment;
    try {
      payment = await mpCreatePayment({
        transaction_amount: valor,
        description: cfg.titulo,
        token: form.token,
        installments: form.installments || 1,
        payment_method_id: form.payment_method_id,
        issuer_id: form.issuer_id,
        payer: { email: form.payer?.email || user.email, identification: form.payer?.identification, ...payerNome },
        additional_info,
        external_reference: user.id,
        metadata: { supabase_user_id: user.id, vitalicio: true, plano: cfg.plano, cupom: codigo, desconto_pct: pct, ...fbMeta },
        notification_url: `${origin}/api/mercadopago/webhook`,
        statement_descriptor: 'SORA',
      }, form.deviceId);
    } catch (e: unknown) {
      const motivo = e instanceof Error ? e.message : 'erro_ao_criar_pagamento';
      console.log(`[mp/process] ERRO | user=${user.id} | tier=${cfg.plano} | valor=${valor} | ${motivo}`);
      // Registra a intenção + a falha ANTES de propagar, senão a venda some.
      try {
        const intent = ['kit', 'completa', 'upgrade'].includes(form.tier || '') ? form.tier : 'completa';
        await supabaseAdmin.from('users').update({ vitalicio_intent: intent }).eq('id', user.id);
      } catch { /* migration 064 pendente */ }
      await marcarPagamentoFalho(user.id, motivo);
      throw e;
    }

    // Log do resultado (o status_detail diz POR QUE o MP recusou —
    // cc_rejected_high_risk, insufficient_amount, etc. — e antes era descartado).
    if (payment.status !== 'approved') {
      console.log(`[mp/process] ${payment.status}/${payment.status_detail} | user=${user.id} | tier=${cfg.plano} | valor=${valor} | pm=${form.payment_method_id} | device=${form.deviceId ? 'sim' : 'NÃO'}`);
    }

    // Registra a intenção do vitalício (pra recuperação levar de volta pra oferta
    // certa). Tolerante: se a coluna não existir (migration 064), só não grava.
    const intentTier = ['kit', 'completa', 'upgrade'].includes(form.tier || '') ? form.tier : 'completa';
    try {
      await supabaseAdmin.from('users').update({ vitalicio_intent: intentTier }).eq('id', user.id);
    } catch { /* migration 064 pendente */ }

    // Cartão aprovado na hora → ativa já (o webhook é rede de segurança).
    let ativado = false;
    if (payment.status === 'approved') {
      ativado = await ativarVitalicio(user.id, cfg.plano, valor);
      // Limpa flag de recuperação (caso tenha falhado antes e agora deu certo).
      try {
        await supabaseAdmin.from('users')
          .update({ recuperacao_pendente_em: null, recuperacao_motivo: null }).eq('id', user.id);
      } catch {
        try { await supabaseAdmin.from('users').update({ recuperacao_pendente_em: null }).eq('id', user.id); } catch {}
      }
    } else if (FALHOU.has(payment.status)) {
      // Venda perdida → entra na lista de recuperação do painel (e no cron, que
      // manda o WhatsApp de "cartão recusado" pra quem tem telefone).
      // `pending`/`in_process` ficam de fora: é o Pix esperando pagamento.
      await marcarPagamentoFalho(user.id, payment.status_detail || payment.status);
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

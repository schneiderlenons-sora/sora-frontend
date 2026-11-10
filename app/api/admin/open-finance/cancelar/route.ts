import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';
import { ehAddonConexao, gravarConexoesPagas, encerrarConexaoCancelada } from '@/lib/conexao-of-stripe';

export const dynamic = 'force-dynamic';

// =============================================================================
// Assinatura da CONEXÃO de Open Finance (R$6/mês) de um usuário, direto do
// painel — sem abrir o Stripe.
//
//   POST { userId, acao }
//     'cancelar'     → no FIM do período (padrão). O cliente pagou o mês;
//                      cortar no meio tiraria um banco que ele já pagou.
//     'cancelar_agora' → encerra hoje, sem reembolso automático.
//     'reativar'     → desfaz o cancelamento agendado.
//     'sincronizar'  → relê a assinatura e regrava as colunas com a MESMA regra
//                      do webhook (lib/conexao-of-stripe). Pra quando o evento
//                      se perdeu: medido em 10/11/2026, 2 assinaturas já
//                      canceladas no Stripe seguiam com "1 conexão paga" aqui.
//
// ⚠️ NO 'cancelar' NÃO GRAVA `of_conexoes_pagas = 0`. Quem faz isso é o webhook
// quando o período acabar. Zerar agora derrubaria o acesso na hora.
//
// ⚠️ SÓ TOCA NO ADD-ON. `ehAddonConexao` (a mesma função do webhook) impede o
// pior erro possível aqui: cancelar a assinatura do PLANO, que vive no mesmo
// customer do Stripe.
// =============================================================================

type Acao = 'cancelar' | 'cancelar_agora' | 'reativar' | 'sincronizar';

function fimDoPeriodo(sub: Stripe.Subscription): string | null {
  // ⚠️ Na API atual o fim do período mora no ITEM (no topo vem undefined).
  const s = sub.items?.data?.[0]?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  return s ? new Date(s * 1000).toISOString() : null;
}

export async function POST(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  let body: { userId?: string; acao?: Acao };
  try { body = await req.json(); } catch { return NextResponse.json({ erro: 'Corpo inválido.' }, { status: 400 }); }
  const userId = String(body?.userId || '').trim();
  const acao: Acao = body?.acao || 'cancelar';
  if (!userId) return NextResponse.json({ erro: 'Falta userId.' }, { status: 400 });
  if (!['cancelar', 'cancelar_agora', 'reativar', 'sincronizar'].includes(acao)) {
    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from('users').select('id, email, of_assinatura_id').eq('id', userId).maybeSingle();
  if (!user) return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 });
  if (!user.of_assinatura_id) {
    return NextResponse.json({ erro: 'Esse usuário não tem assinatura de conexão no Stripe.' }, { status: 400 });
  }

  try {
    const sub = await stripe.subscriptions.retrieve(user.of_assinatura_id as string);

    // ⚠️ TRAVA DE SEGURANÇA: confirma que é MESMO o add-on antes de mexer.
    if (!ehAddonConexao(sub)) {
      return NextResponse.json({
        erro: 'Essa assinatura não é a de conexão. Bloqueado por segurança.', assinatura: sub.id,
      }, { status: 409 });
    }

    const encerrada = sub.status === 'canceled' || sub.status === 'incomplete_expired';

    if (acao === 'sincronizar') {
      if (encerrada) await encerrarConexaoCancelada(userId, sub);
      else await gravarConexoesPagas(userId, sub);
      return NextResponse.json({ ok: true, status: sub.status, mensagem: encerrada
        ? 'A assinatura já tinha acabado no Stripe. Corrigido aqui também.'
        : 'Conferido: a Sora está igual ao Stripe.' });
    }

    if (encerrada) {
      // Já acabou lá: aproveita e acerta as colunas daqui (era o caso do evento perdido).
      await encerrarConexaoCancelada(userId, sub);
      return NextResponse.json({ ok: true, jaCancelada: true, status: sub.status,
        mensagem: 'A assinatura já estava encerrada no Stripe. Corrigido aqui também.' });
    }

    if (acao === 'cancelar_agora') {
      const fechada = await stripe.subscriptions.cancel(sub.id, { prorate: false });
      // Não espera o webhook pra tela refletir: mesma regra que ele aplicará.
      await encerrarConexaoCancelada(userId, fechada);
      return NextResponse.json({ ok: true, status: fechada.status,
        mensagem: 'Cancelada agora. Não há reembolso automático: se for o caso, estorne no Stripe.' });
    }

    const atualizada = await stripe.subscriptions.update(sub.id, {
      cancel_at_period_end: acao === 'cancelar',
    });
    // Grava a data do fim (aviso de 3 dias) e a quantidade, como o webhook faria.
    await gravarConexoesPagas(userId, atualizada);
    const ate = fimDoPeriodo(atualizada);
    return NextResponse.json({
      ok: true, status: atualizada.status, cancelaEm: acao === 'cancelar' ? ate : null,
      mensagem: acao === 'cancelar'
        ? 'Cancelada no fim do período já pago. O banco segue conectado até lá.'
        : 'Cancelamento desfeito: a assinatura volta a renovar.',
    });
  } catch (e: unknown) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : 'Erro no Stripe' }, { status: 500 });
  }
}

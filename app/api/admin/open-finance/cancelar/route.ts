import { NextRequest, NextResponse } from 'next/server';
import { stripe, ehPriceConexaoOf } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

// =============================================================================
// Cancela a assinatura da CONEXÃO de Open Finance (R$6/mês) de um usuário,
// direto do painel — sem abrir o Stripe.
//
// ⚠️ CANCELA NO FIM DO PERÍODO (`cancel_at_period_end`), NUNCA na hora. O
// cliente pagou o mês inteiro; cortar no meio tiraria um banco que ele já
// pagou pra usar. É também o que a tela dele promete ("o banco fica conectado
// até o fim do período que você já pagou").
//
// ⚠️ NÃO GRAVA `of_conexoes_pagas = 0` AQUI. Quem faz isso é o webhook
// `customer.subscription.deleted`, quando o período de fato acabar. Zerar agora
// derrubaria o acesso na hora — exatamente o que o cancelamento no fim do
// período existe pra evitar.
//
// ⚠️ SÓ TOCA NO ADD-ON. A trava `ehAddonConexao` conferindo os metadados +
// o price impede o pior erro possível aqui: cancelar por engano a assinatura do
// PLANO do cliente, que vive no mesmo customer do Stripe.
// =============================================================================

// `ehPriceConexaoOf` vem de lib/stripe — a MESMA função que o webhook usa pra
// não confundir add-on com plano. Reescrevê-la aqui criaria uma segunda
// verdade: bastaria alguém trocar um price id num lugar e não no outro pra esta
// trava passar a liberar o cancelamento da assinatura errada.

export async function POST(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  let body: { userId?: string; agora?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Corpo inválido.' }, { status: 400 });
  }
  const userId = String(body?.userId || '').trim();
  if (!userId) return NextResponse.json({ erro: 'Falta userId.' }, { status: 400 });

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, of_assinatura_id, of_conexoes_pagas')
    .eq('id', userId)
    .maybeSingle();

  if (!user) return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 });
  if (!user.of_assinatura_id) {
    return NextResponse.json(
      { erro: 'Esse usuário não tem assinatura de conexão pra cancelar.' }, { status: 400 });
  }

  try {
    const sub = await stripe.subscriptions.retrieve(user.of_assinatura_id as string);

    // ⚠️ TRAVA DE SEGURANÇA. Confirma que é MESMO o add-on antes de cancelar:
    // o customer do Stripe é o mesmo do plano, e um id trocado no banco faria
    // este endpoint derrubar a assinatura principal de um cliente pagante.
    const ehAddon = sub.metadata?.tipo === 'conexao_of'
      || sub.items.data.some((i) => ehPriceConexaoOf(i.price?.id));
    if (!ehAddon) {
      return NextResponse.json({
        erro: 'Essa assinatura não é do add-on de conexão. Cancelamento bloqueado por segurança.',
        assinatura: sub.id,
      }, { status: 409 });
    }

    if (sub.status === 'canceled') {
      return NextResponse.json({ ok: true, jaCancelada: true, status: sub.status });
    }

    const atualizada = await stripe.subscriptions.update(sub.id, {
      cancel_at_period_end: true,
    });

    const fim = (atualizada as unknown as { current_period_end?: number }).current_period_end;

    return NextResponse.json({
      ok: true,
      email: user.email,
      assinatura: atualizada.id,
      cancelaEm: fim ? new Date(fim * 1000).toISOString() : null,
      // Deixa explícito pra UI não mentir: o acesso continua até lá.
      mensagem: 'Cancelada no fim do período já pago. O banco segue conectado até lá.',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro no Stripe';
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

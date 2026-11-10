import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

// =============================================================================
// Open Finance de UM cliente, pro painel lateral do admin.
//
// Duas coisas independentes, e a tela as mantém separadas:
//   · CONEXÕES (o que a Polp cobra de nós) — por `user_id`, a mesma unidade
//     da franquia. Conexão que outro membro fez no grupo dele não é dele.
//   · ASSINATURA de conexão no Stripe (o que ele paga) — lida AO VIVO, porque
//     o que interessa aqui é justamente quando a Sora e o Stripe discordam.
//
// ⚠️ Falha do Stripe não derruba as conexões: vem `assinatura.erro` e o resto
// da tela funciona. Desconectar banco não depende do Stripe.
// =============================================================================
export async function GET(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;
  const userId = new URL(req.url).searchParams.get('userId') || '';
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return NextResponse.json({ erro: 'userId inválido.' }, { status: 400 });

  const { data: u } = await supabaseAdmin.from('users')
    .select('id, of_conexoes_pagas, of_assinatura_id, of_assinatura_intervalo')
    .eq('id', userId).maybeSingle();
  if (!u) return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 });

  let { data: cx, error }: { data: any[] | null; error: any } = await supabaseAdmin.from('of_conexoes')
    .select('id, instituicao, status, ultima_sync, created_at, empresarial, grupo_id')
    .eq('user_id', userId).order('created_at', { ascending: true });
  if (error) {
    ({ data: cx, error } = await supabaseAdmin.from('of_conexoes')
      .select('id, instituicao, status, ultima_sync, created_at, grupo_id')
      .eq('user_id', userId).order('created_at', { ascending: true }));
  }
  // ⚠️ Leitura que falhou NÃO é "sem banco": a tela mostraria "nenhum banco
  // conectado" e o admin cancelaria a cobrança de quem usa.
  if (error) return NextResponse.json({ erro: `of_conexoes: ${error.message}` }, { status: 500 });

  let assinatura: Record<string, unknown> | null = null;
  if (u.of_assinatura_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(u.of_assinatura_id as string);
      const item = sub.items.data[0];
      const fim = item?.current_period_end
        ?? (sub as unknown as { current_period_end?: number }).current_period_end;
      assinatura = {
        id: sub.id,
        status: sub.status,
        cancelaNoFim: !!sub.cancel_at_period_end,
        fimPeriodo: fim ? new Date(fim * 1000).toISOString() : null,
        quantidade: item?.quantity ?? null,
        intervalo: item?.price?.recurring?.interval === 'year' ? 'anual' : 'mensal',
        valorUnitario: item?.price?.unit_amount != null ? item.price.unit_amount / 100 : null,
      };
    } catch (e: unknown) {
      assinatura = { erro: e instanceof Error ? e.message : 'Stripe não respondeu' };
    }
  }

  const pagasNaSora = Number(u.of_conexoes_pagas) || 0;
  const st = assinatura && !('erro' in assinatura) ? String(assinatura.status) : null;
  // Divergência que pede o botão "Conferir com o Stripe".
  const divergencia =
    st && ['canceled', 'incomplete_expired'].includes(st) && pagasNaSora > 0
      ? 'A assinatura já acabou no Stripe, mas aqui ainda conta como paga.'
      : st === 'past_due'
        ? 'Pagamento atrasado no Stripe: a última cobrança não passou.'
        : st === 'active' && assinatura?.quantidade != null && Number(assinatura.quantidade) !== pagasNaSora
          ? `O Stripe cobra ${assinatura.quantidade} e a Sora conta ${pagasNaSora}.`
          : null;

  return NextResponse.json({
    conexoes: (cx || []).map((c: any) => ({
      id: c.id, instituicao: c.instituicao || 'Banco', status: c.status || '?',
      ultimaSync: c.ultima_sync, criadaEm: c.created_at, empresarial: !!c.empresarial,
    })),
    pagasNaSora,
    intervalo: u.of_assinatura_intervalo || null,
    assinatura,
    divergencia,
  });
}

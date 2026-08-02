import { NextRequest, NextResponse } from 'next/server';
import { stripe, PRICE_CONEXAO_OF, type Intervalo } from '@/lib/stripe';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// =============================================================================
// Assinatura da CONEXÃO de Open Finance (add-on, R$ 6/mês ou R$ 60/ano cada).
//
// Cada banco conectado custa mensalidade nossa no agregador. O plano dá uma
// franquia (Básico 1, Premium 3); o VITALÍCIO não dá nenhuma — quem pagou uma
// vez não sustenta um custo que se repete todo mês. Então quem quiser conectar
// paga por conexão, e é isto aqui.
//
// ⚠️ É uma assinatura SEPARADA da do plano, guardada em `of_assinatura_id`.
// Juntar as duas na mesma coluna faria cancelar uma derrubar a outra — e o
// vitalício nem tem assinatura de plano pra pendurar o item.
//
// POST   → cria/atualiza a assinatura (quantidade = nº de conexões pagas)
// DELETE → cancela (o acesso cai no fim do período já pago)
// =============================================================================

export const dynamic = 'force-dynamic';

const MAX_CONEXOES = 10; // teto de sanidade: ninguém tem 10 bancos

async function usuarioLogado() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: NextRequest) {
  try {
    const { quantidade, intervalo = 'mensal' } = (await req.json().catch(() => ({}))) as {
      quantidade?: number;
      intervalo?: Intervalo;
    };

    const qtd = Math.min(Math.max(1, Math.round(Number(quantidade) || 1)), MAX_CONEXOES);
    const priceId = PRICE_CONEXAO_OF[intervalo];
    if (!priceId) {
      return NextResponse.json(
        { erro: 'Preço da conexão não configurado (falta STRIPE_PRICE_CONEXAO_OF_MENSAL/ANUAL na Vercel).' },
        { status: 503 },
      );
    }

    const user = await usuarioLogado();
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

    const { data: perfil } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id, email, name, of_assinatura_id, of_conexoes_pagas')
      .eq('id', user.id)
      .single();

    // ── Já assina? Então é só mudar a quantidade — sem novo checkout. ────────
    // `always_invoice` cobra a diferença NA HORA e proporcional ao que resta do
    // período. Sem isso, quem conecta o 2º banco no dia 20 usaria de graça até
    // a renovação.
    if (perfil?.of_assinatura_id) {
      const sub = await stripe.subscriptions.retrieve(perfil.of_assinatura_id);
      const item = sub.items.data[0];
      if (item) {
        await stripe.subscriptionItems.update(item.id, {
          quantity: qtd,
          proration_behavior: 'always_invoice',
        });
        // O webhook grava o valor definitivo; isto é só pra tela não esperar.
        await supabaseAdmin.from('users')
          .update({ of_conexoes_pagas: qtd }).eq('id', user.id);
        return NextResponse.json({ ok: true, atualizado: true, quantidade: qtd });
      }
    }

    // ── Primeira contratação: precisa de checkout (cartão). ─────────────────
    let customerId = perfil?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: perfil?.name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin.from('users')
        .update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    // Domínio canônico é o www (o apex redireciona 307). Voltar no www garante
    // que a tela de sucesso carregue COM o cookie de sessão.
    const origin = (
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://www.forsora.com'
    ).replace('://forsora.com', '://www.forsora.com');

    const meta = { supabase_user_id: user.id, tipo: 'conexao_of', intervalo };
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: qtd }],
      success_url: `${origin}/open-finance?conexao=1`,
      cancel_url:  `${origin}/open-finance?cancelado=1`,
      // ⚠️ metadata da SESSÃO e da SUBSCRIPTION: o webhook precisa reconhecer o
      // add-on nos dois eventos, e `checkout.session.completed` não enxerga o
      // metadata da subscription.
      metadata: meta,
      subscription_data: { metadata: meta },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[stripe/conexao-of] POST:', msg);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

// Cancela o add-on. Não corta na hora: o usuário já pagou o período, então
// `cancel_at_period_end` mantém o banco conectado até o fim dele.
export async function DELETE() {
  try {
    const user = await usuarioLogado();
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

    const { data: perfil } = await supabaseAdmin
      .from('users').select('of_assinatura_id').eq('id', user.id).single();
    if (!perfil?.of_assinatura_id) {
      return NextResponse.json({ ok: true, nada: true });
    }

    const sub = await stripe.subscriptions.update(perfil.of_assinatura_id, {
      cancel_at_period_end: true,
    });
    const fim = sub.items.data[0]?.current_period_end;
    return NextResponse.json({
      ok: true,
      ate: fim ? new Date(fim * 1000).toISOString() : null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[stripe/conexao-of] DELETE:', msg);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

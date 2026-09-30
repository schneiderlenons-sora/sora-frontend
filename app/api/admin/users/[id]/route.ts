import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { stripe, priceIdToPlano } from '@/lib/stripe';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

// Tabelas do Grow escopadas por user_id (FKs sem cascade) — limpar antes de apagar o usuário.
const TABELAS_GROW = [
  'registros_habito', 'habitos', 'tarefas', 'projetos', 'compromissos',
  'itens_lista_compras', 'despensa_itens', 'receitas', 'manutencoes',
  'viagens', 'bucket_list', 'midia', 'leituras', 'grupo_membros',
];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  // ── Trocar/ativar plano ──────────────────────────────────────────
  if (action === 'set_plano') {
    const plano = body.plano as string;
    // ⚠️ Lista à mão, e não `PLANOS` de lib/plans — o Record de lá é tipado
    // por `Plano`, e aqui chega uma string crua do corpo do request. Plano
    // novo TEM de ser adicionado aqui também, senão o admin não consegue
    // atribuí-lo e o 400 não diz por quê.
    if (!['basico', 'premium', 'platinum', 'kit', 'gratis', 'inativo'].includes(plano)) {
      return NextResponse.json({ erro: 'Plano inválido' }, { status: 400 });
    }
    const dias = Number(body.dias) > 0 ? Number(body.dias) : 30;
    // ⚠️ `gratis` ENTRA NO RAMO SEM VALIDADE, junto do `inativo`.
    //
    // O modo manual não vence — e `plano_valido_ate` preenchido nele seria
    // uma bomba-relógio: `exigirPlano` expira QUALQUER plano != inativo com
    // data vencida, então o usuário grátis viraria `inativo` sozinho e
    // apareceria no paywall sem nunca ter cancelado nada.
    const semValidade = plano === "inativo" || plano === "gratis";
    const patch: Record<string, unknown> = semValidade
      ? { plano, plano_valido_ate: null }
      : { plano, plano_valido_ate: new Date(Date.now() + dias * 864e5).toISOString() };
    const { error } = await supabaseAdmin.from('users').update(patch).eq('id', id);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Cancelar o VITALÍCIO (reembolso) e deixar no grátis ──────────
  //
  // Antes disso a única saída pra um vitalício reembolsado era APAGAR a conta:
  // o `PlanoEditor` troca `users.plano`, mas a flag `vitalicio` continuava de
  // pé — e ela não é enfeite, é lida em três lugares que passariam a mentir:
  //
  //   1. `lib/ofertas-plano.ts` → `if (p.vitalicio) return NADA`. A pessoa
  //      ficaria no grátis SEM NENHUMA oferta na tela, sem como voltar a
  //      comprar. É o pior dos efeitos: parece bloqueio, não cancelamento.
  //   2. `/admin` → badge "Vitalício", filtro de vitalícios e a contagem.
  //   3. `overview` → receita vitalícia, que somaria um dinheiro devolvido.
  //
  // ⚠️ `vitalicio_valor` SAI JUNTO. A ação existe pro caso de reembolso: o
  // valor voltou pro cliente, então mantê-lo inflaria a receita do painel com
  // venda que deixou de existir.
  // ⚠️ NÃO mexe em assinatura do Stripe — vitalício é pagamento único (Mercado
  // Pago). Quem tiver assinatura recorrente se resolve em `stripe_sync`.
  if (action === 'cancelar_vitalicio') {
    const limpeza = {
      plano: 'gratis',
      vitalicio: false,
      vitalicio_em: null,
      vitalicio_valor: null,
      plano_intervalo: null,
      plano_valido_ate: null,
    };
    const { error } = await supabaseAdmin.from('users').update(limpeza).eq('id', id);
    if (error) {
      // Fallback: `vitalicio_valor` vem da migration 065 e pode não existir.
      // Sem ele o cancelamento ainda vale — mesmo desenho do `ativarVitalicio`.
      const { vitalicio_valor: _ignorado, ...minimo } = limpeza;
      const { error: e2 } = await supabaseAdmin.from('users').update(minimo).eq('id', id);
      // ⚠️ O erro é LIDO e devolvido. Responder 200 aqui deixaria o painel
      // dizendo "feito" com o cliente ainda vitalício no banco — a família de
      // bug das migrations 121/147.
      if (e2) return NextResponse.json({ erro: e2.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, plano: 'gratis' });
  }

  // ── Excluir/incluir no MRR (cortesia, acesso grátis, conta do dono) ──
  if (action === 'set_mrr_excluir') {
    const excluir = !!body.excluir;
    const { error } = await supabaseAdmin.from('users').update({ mrr_excluir: excluir }).eq('id', id);
    if (error) return NextResponse.json({ erro: 'Rode a migration 074 (mrr_excluir).' }, { status: 500 });
    return NextResponse.json({ ok: true, mrr_excluir: excluir });
  }

  // ── Liberar o número (desvincula o WhatsApp) ─────────────────────
  if (action === 'liberar_numero') {
    const { error } = await supabaseAdmin.from('users').update({ phone: null, welcomed_at: null }).eq('id', id);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Definir um número manualmente ────────────────────────────────
  if (action === 'set_phone') {
    const phone = String(body.phone || '').replace(/\D/g, '');
    if (phone.length < 12) return NextResponse.json({ erro: 'Número inválido (E.164 sem +, ex.: 5532999167475).' }, { status: 400 });
    const { error } = await supabaseAdmin.from('users').update({ phone }).eq('id', id).select('id');
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ erro: 'Esse número já está em outra conta.' }, { status: 409 });
      }
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── Reenviar boas-vindas na próxima carga (reseta welcomed_at) ────
  if (action === 'reset_welcome') {
    await supabaseAdmin.from('users').update({ welcomed_at: null }).eq('id', id);
    return NextResponse.json({ ok: true });
  }

  // ── Sincronizar plano direto do Stripe ───────────────────────────
  if (action === 'stripe_sync') {
    const { data: u } = await supabaseAdmin.from('users').select('stripe_customer_id').eq('id', id).maybeSingle();
    if (!u?.stripe_customer_id) return NextResponse.json({ ok: true, plano: null, motivo: 'sem_customer' });
    const subs = await stripe.subscriptions.list({ customer: u.stripe_customer_id as string, status: 'all', limit: 10 });
    const sub = subs.data.find((s) => s.status === 'active' || s.status === 'trialing');
    if (!sub) {
      await supabaseAdmin.from('users').update({ plano: 'inativo' }).eq('id', id);
      return NextResponse.json({ ok: true, plano: 'inativo', motivo: 'sem_assinatura_ativa' });
    }
    const priceId = sub.items.data[0]?.price.id;
    const plano = (priceId ? priceIdToPlano(priceId) : null) || (sub.metadata?.plano as string | undefined) || null;
    const periodEnd = (sub.items.data[0] as { current_period_end?: number })?.current_period_end;
    if (plano) {
      await supabaseAdmin.from('users').update({
        plano,
        plano_valido_ate: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        stripe_subscription_id: sub.id,
      }).eq('id', id);
    }
    return NextResponse.json({ ok: true, plano });
  }

  return NextResponse.json({ erro: 'Ação inválida' }, { status: 400 });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;
  const { id } = await ctx.params;

  if (id === gate.user.id) {
    return NextResponse.json({ erro: 'Você não pode apagar a própria conta admin.' }, { status: 400 });
  }

  for (const t of TABELAS_GROW) {
    try { await supabaseAdmin.from(t).delete().eq('user_id', id); } catch { /* tabela pode não ter user_id */ }
  }
  try { await supabaseAdmin.from('grupos').delete().eq('dono_id', id); } catch { /* noop */ }
  try { await supabaseAdmin.from('bug_reports').update({ user_id: null }).eq('user_id', id); } catch { /* noop */ }

  const { error } = await supabaseAdmin.from('users').delete().eq('id', id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  try { await supabaseAdmin.auth.admin.deleteUser(id); } catch { /* já pode ter ido */ }

  return NextResponse.json({ ok: true });
}

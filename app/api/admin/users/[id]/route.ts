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
    if (!['basico', 'premium', 'black', 'inativo'].includes(plano)) {
      return NextResponse.json({ erro: 'Plano inválido' }, { status: 400 });
    }
    const dias = Number(body.dias) > 0 ? Number(body.dias) : 30;
    const patch: Record<string, unknown> =
      plano === 'inativo'
        ? { plano, plano_valido_ate: null }
        : { plano, plano_valido_ate: new Date(Date.now() + dias * 864e5).toISOString() };
    const { error } = await supabaseAdmin.from('users').update(patch).eq('id', id);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
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

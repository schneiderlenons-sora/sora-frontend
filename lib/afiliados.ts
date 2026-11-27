import type Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { stripe, priceIdToPlano, PRICE_IDS } from '@/lib/stripe';
import { mpBuscarPagamentos, mpGetPayment } from '@/lib/mercadopago';
import {
  normalizarCodigoAfiliado, motivoNaoAtribuir, comissoesDoCliente, planejarAtualizacao,
  resumirComissoes, podePagar, type Pagamento, type Linha, type Tipo,
} from '@/lib/afiliados-regras';

// =============================================================================
// PROGRAMA DE AFILIADOS — banco, Stripe e Mercado Pago. As regras de dinheiro
// moram em lib/afiliados-regras.ts.
//
// ⚠️ AS COMISSÕES SÃO PUXADAS, NÃO EMPURRADAS. Em vez de contar no webhook
// (um evento perdido viraria comissão perdida, ou paga sobre reembolso), a
// sincronização relê as cobranças de cada cliente trazido direto no Stripe e
// no Mercado Pago. Rodar duas vezes não muda nada.
//
// ⚠️ NADA DAQUI PODE DERRUBAR UM CHECKOUT: quem chama no caminho do pagamento
// trata qualquer falha como "sem afiliado" (inclusive a migration 209 ausente).
// =============================================================================

export type Afiliado = {
  id: string; user_id: string; codigo: string; desconto_pct: number; ativo: boolean;
  stripe_cupom_id: string | null; stripe_promo_id: string | null;
  sincronizado_em: string | null; criado_em: string;
};

export async function afiliadoPorCodigo(codigo?: string | null): Promise<Afiliado | null> {
  const c = normalizarCodigoAfiliado(codigo);
  if (c.length < 3) return null;
  const { data, error } = await supabaseAdmin
    .from('afiliados').select('*').eq('codigo', c).eq('ativo', true).maybeSingle();
  return error ? null : (data as Afiliado | null);
}

/** O afiliado do código, SE este cliente puder contar pra ele. */
export async function afiliadoElegivel(
  userId: string, codigo?: string | null, { noCheckout = false } = {},
): Promise<Afiliado | null> {
  try {
    const af = await afiliadoPorCodigo(codigo);
    if (!af) return null;
    const [cli, dono, com] = await Promise.all([
      supabaseAdmin.from('users').select('id, email, plano, vitalicio, stripe_subscription_id').eq('id', userId).maybeSingle(),
      supabaseAdmin.from('users').select('email').eq('id', af.user_id).maybeSingle(),
      supabaseAdmin.from('afiliado_comissoes').select('id', { count: 'exact', head: true }).eq('cliente_id', userId),
    ]);
    // Leitura que falhou não vira "pode": comissão é dinheiro.
    if (cli.error || dono.error || com.error) return null;
    const motivo = motivoNaoAtribuir(
      cli.data, { user_id: af.user_id, email: dono.data?.email, ativo: af.ativo },
      { temComissao: (com.count || 0) > 0, noCheckout },
    );
    return motivo ? null : af;
  } catch { return null; }
}

/** Grava "este cliente veio deste afiliado". Vale o último código ANTES da 1ª compra. */
export async function atribuir(
  userId: string, codigo: string | null | undefined, origem: 'link' | 'codigo', opts: { noCheckout?: boolean } = {},
): Promise<boolean> {
  try {
    const af = await afiliadoElegivel(userId, codigo, opts);
    if (!af) return false;
    const { data: ja, error: eJa } = await supabaseAdmin
      .from('afiliado_indicados').select('afiliado_id').eq('user_id', userId).maybeSingle();
    if (eJa) return false;
    if (ja?.afiliado_id === af.id) return true;
    const { error } = await supabaseAdmin.from('afiliado_indicados').upsert(
      { user_id: userId, afiliado_id: af.id, origem, criado_em: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    if (error) console.error('[afiliados] atribuição não gravada:', error.message);
    return !error;
  } catch (e) {
    console.error('[afiliados] atribuir:', e instanceof Error ? e.message : e);
    return false;
  }
}

/** Código digitado no checkout do Stripe (promotion code do afiliado). */
export async function atribuirPeloCupomDaSessao(session: Stripe.Checkout.Session, userId: string): Promise<void> {
  try {
    if (!session.total_details?.amount_discount) return;
    const cheia = await stripe.checkout.sessions.retrieve(session.id, { expand: ['total_details.breakdown'] });
    for (const d of cheia.total_details?.breakdown?.discounts || []) {
      // O tipo do SDK aponta pro item da própria lista; em execução é o Discount.
      const p = (d.discount as unknown as Stripe.Discount | undefined)?.promotion_code;
      const promoId = typeof p === 'string' ? p : p?.id;
      if (!promoId) continue;
      const { data: af } = await supabaseAdmin.from('afiliados').select('codigo').eq('stripe_promo_id', promoId).maybeSingle();
      // Código usado no próprio checkout: o Stripe só o aceita na 1ª compra.
      if (af) await atribuir(userId, af.codigo, 'codigo', { noCheckout: true });
    }
  } catch (e) {
    console.error('[afiliados] cupom da sessão:', e instanceof Error ? e.message : e);
  }
}

// ── Cupom no Stripe ──────────────────────────────────────────────────────────

/** Cupom (1ª cobrança, só planos da Sora) + o código que o cliente digita. */
export async function criarCupomStripe(codigo: string, pct: number) {
  // A conta do Stripe tem outros produtos: o cupom é preso aos planos da Sora.
  const precos = Object.values(PRICE_IDS).flatMap((i) => Object.values(i)).filter(Boolean);
  const achados = await Promise.all(precos.map((id) => stripe.prices.retrieve(id).catch(() => null)));
  const products = [...new Set(achados.map((p) => (p ? (typeof p.product === 'string' ? p.product : p.product.id) : '')).filter(Boolean))];
  if (!products.length) throw new Error('Não encontrei os produtos dos planos no Stripe.');
  const cupom = await stripe.coupons.create({
    percent_off: pct, duration: 'once', name: `Afiliado ${codigo}`,
    applies_to: { products }, metadata: { afiliado: codigo },
  });
  const promo = await stripe.promotionCodes.create({
    promotion: { type: 'coupon', coupon: cupom.id }, code: codigo,
    restrictions: { first_time_transaction: true }, metadata: { afiliado: codigo },
  });
  return { cupomId: cupom.id, promoId: promo.id };
}

// ── As cobranças de um cliente ───────────────────────────────────────────────

/** Só faturas de PLANO da Sora (a conexão avulsa e outros produtos ficam fora). */
async function pagamentosStripe(customerId: string): Promise<Pagamento[]> {
  const faturas: Stripe.Invoice[] = [];
  for await (const f of stripe.invoices.list({ customer: customerId, status: 'paid', limit: 100, expand: ['data.payments'] })) {
    const doPlano = f.lines.data.some((l) => {
      const p = l.pricing?.price_details?.price;
      const id = typeof p === 'string' ? p : p?.id;
      return !!id && !!priceIdToPlano(id);
    });
    if (doPlano) faturas.push(f);
  }
  if (!faturas.length) return [];
  const cobrancas = new Map<string, Stripe.Charge>();
  for await (const c of stripe.charges.list({ customer: customerId, limit: 100, expand: ['data.balance_transaction'] })) {
    const pi = typeof c.payment_intent === 'string' ? c.payment_intent : c.payment_intent?.id;
    if (c.paid && pi) cobrancas.set(pi, c);
  }
  const saida: Pagamento[] = [];
  for (const f of faturas) {
    let valorPago = 0, reembolsado = 0, liquido = 0, contestado = false, achou = false;
    for (const p of f.payments?.data || []) {
      if (p.status !== 'paid') continue;
      const ref = p.payment?.payment_intent;
      const c = cobrancas.get(typeof ref === 'string' ? ref : ref?.id || '');
      const bt = c?.balance_transaction;
      if (!c || !bt || typeof bt === 'string') continue;
      achou = true;
      valorPago += c.amount_captured; reembolsado += c.amount_refunded; liquido += bt.net;
      contestado = contestado || c.disputed;
    }
    if (!achou) continue;
    saida.push({
      referencia: String(f.id), origem: 'stripe', tipo: 'assinatura',
      pagoEm: (f.status_transitions?.paid_at || f.created) * 1000,
      valorPago, reembolsado, liquido, contestado,
    });
  }
  return saida;
}

const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);

/** Pagamentos do vitalício (Mercado Pago, `external_reference` = usuário). */
async function pagamentosMP(userId: string): Promise<Pagamento[]> {
  const achados = await mpBuscarPagamentos(userId);
  const valem = ['approved', 'refunded', 'charged_back', 'in_mediation'];
  const saida: Pagamento[] = [];
  for (const a of achados) {
    if (!valem.includes(a.status) || !a.metadata?.vitalicio) continue;
    const p = await mpGetPayment(String(a.id));   // a busca não traz o líquido
    const taxas = (p.fee_details || []).reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const liquido = p.transaction_details?.net_received_amount ?? ((p.transaction_amount || 0) - taxas);
    saida.push({
      referencia: `mp_${p.id}`, origem: 'mercadopago', tipo: 'vitalicio',
      pagoEm: new Date(p.date_approved || p.date_created || Date.now()).getTime(),
      valorPago: centavos(p.transaction_amount),
      reembolsado: p.status === 'refunded' ? centavos(p.transaction_amount) : centavos(p.transaction_amount_refunded),
      liquido: centavos(liquido),
      contestado: p.status === 'charged_back' || p.status === 'in_mediation',
    });
  }
  return saida;
}

// ── Sincronização e leitura ──────────────────────────────────────────────────

/** Relê as cobranças de quem o afiliado trouxe e atualiza as comissões. */
export async function sincronizarAfiliado(afiliadoId: string): Promise<{ erros: string[] }> {
  const erros: string[] = [];
  const { data: indicados, error } = await supabaseAdmin
    .from('afiliado_indicados').select('user_id, criado_em').eq('afiliado_id', afiliadoId);
  if (error) return { erros: [error.message] };
  for (const ind of indicados || []) {
    try {
      const { data: u, error: eU } = await supabaseAdmin
        .from('users').select('stripe_customer_id').eq('id', ind.user_id).maybeSingle();
      if (eU) throw new Error(eU.message);
      const pagamentos: Pagamento[] = [];
      // Cada fonte à parte: uma fora do ar não impede a outra — e o que não
      // veio fica como está (a regra não cancela por falta de leitura).
      if (u?.stripe_customer_id) {
        try { pagamentos.push(...await pagamentosStripe(u.stripe_customer_id)); }
        catch (e) { erros.push(`Stripe: ${e instanceof Error ? e.message : e}`); }
      }
      try { pagamentos.push(...await pagamentosMP(ind.user_id)); }
      catch (e) { erros.push(`Mercado Pago: ${e instanceof Error ? e.message : e}`); }
      if (!pagamentos.length) continue;

      const { data: linhas, error: eL } = await supabaseAdmin
        .from('afiliado_comissoes').select('*').eq('afiliado_id', afiliadoId).eq('cliente_id', ind.user_id);
      if (eL) throw new Error(eL.message);
      const atuais = (linhas || []) as Linha[];
      const gravadas = new Map<string, { tipo: Tipo; pct: number }>(
        atuais.filter((l) => l.ajuste_n === 0).map((l) => [l.referencia, { tipo: l.tipo, pct: l.pct }]),
      );
      const esperadas = comissoesDoCliente(pagamentos, { atribuidoEm: new Date(ind.criado_em).getTime(), gravadas });
      const plano = planejarAtualizacao(esperadas, atuais);
      if (plano.inserir.length) {
        const { error: eI } = await supabaseAdmin.from('afiliado_comissoes').upsert(
          plano.inserir.map((n) => ({ ...n, afiliado_id: afiliadoId, cliente_id: ind.user_id })),
          { onConflict: 'referencia,ajuste_n', ignoreDuplicates: true },
        );
        if (eI) throw new Error(eI.message);
      }
      for (const m of plano.atualizar) {
        // O que já foi repassado nunca é reescrito.
        const { error: eM } = await supabaseAdmin
          .from('afiliado_comissoes').update(m.campos).eq('id', m.id).neq('status', 'paga');
        if (eM) throw new Error(eM.message);
      }
    } catch (e) {
      erros.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (!erros.length) {
    await supabaseAdmin.from('afiliados').update({ sincronizado_em: new Date().toISOString() }).eq('id', afiliadoId);
  } else {
    console.error('[afiliados] sincronização', afiliadoId, erros.join(' | '));
  }
  return { erros };
}

/** Linhas (sem identificar o cliente), totais e quantos clientes. */
export async function painelDoAfiliado(afiliadoId: string) {
  const [com, cli] = await Promise.all([
    supabaseAdmin.from('afiliado_comissoes')
      .select('id, referencia, ajuste_n, tipo, pct, base_centavos, valor_centavos, status, pago_em, liberada_em, repassada_em')
      .eq('afiliado_id', afiliadoId).order('pago_em', { ascending: false }).limit(1000),
    supabaseAdmin.from('afiliado_indicados').select('user_id', { count: 'exact', head: true }).eq('afiliado_id', afiliadoId),
  ]);
  if (com.error) throw new Error(com.error.message);
  const linhas = com.data || [];
  return { linhas, clientes: cli.count || 0, resumo: resumirComissoes(linhas) };
}

/**
 * Marca o que está liberado como repassado. `totalEsperado` é o valor que o
 * admin viu na tela e pagou por Pix: se mudou, nada é marcado.
 */
export async function registrarRepasse(afiliadoId: string, totalEsperado: number) {
  const { erros } = await sincronizarAfiliado(afiliadoId);
  if (erros.length) return { ok: false as const, erro: 'Não consegui conferir as cobranças agora. Tente de novo antes de marcar como pago.' };
  const { linhas } = await painelDoAfiliado(afiliadoId);
  const agora = Date.now();
  const devidas = linhas.filter((l) => podePagar(l, agora));
  const total = devidas.reduce((s, l) => s + l.valor_centavos, 0);
  if (total !== totalEsperado) return { ok: false as const, erro: 'O valor a pagar mudou. Confira a tela atualizada.', mudou: true };
  if (total <= 0) return { ok: false as const, erro: 'Não há valor a pagar.' };
  const { error } = await supabaseAdmin.from('afiliado_comissoes')
    .update({ status: 'paga', repassada_em: new Date(agora).toISOString() })
    .in('id', devidas.map((l) => l.id)).eq('status', 'pendente');
  if (error) return { ok: false as const, erro: 'Não consegui registrar o pagamento.' };
  return { ok: true as const, total };
}

// =============================================================================
// Assinatura da CONEXÃO de Open Finance (add-on de R$6) → colunas do usuário.
//
// Morava dentro do webhook do Stripe. Saiu pra cá quando o painel admin passou
// a precisar da MESMA regra ("Conferir com o Stripe" no cliente): duas cópias
// de "quantas conexões ele pagou e até quando" divergiriam na primeira mudança
// e o admin corrigiria o cliente com uma regra que o webhook desfaria depois.
// O código foi MOVIDO, não reescrito.
// =============================================================================
import Stripe from 'stripe';
import { stripe, ehPriceConexaoOf } from '@/lib/stripe';
import { decidirEncerramentoConexao } from '@/lib/conexao-of-encerramento';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ── Add-on de conexão do Open Finance ───────────────────────────────────────
//
// ⚠️ É uma assinatura SEPARADA da do plano. Sem esta distinção, o handler do
// plano leria a assinatura de R$6 e rebaixaria o cliente pra 'inativo' (o price
// da conexão não mapeia pra plano nenhum). Por isso todo handler de assinatura
// checa isto ANTES de qualquer coisa.
export function ehAddonConexao(sub: Stripe.Subscription): boolean {
  if (sub.metadata?.tipo === 'conexao_of') return true;
  return sub.items.data.some((i) => ehPriceConexaoOf(i.price?.id));
}

/**
 * Até quando (e quantas) conexões o cliente PAGOU de verdade.
 *
 * ⚠️ SÓ as invoices PAGAS de `subscription_create`/`subscription_cycle`. Nunca a
 * quantidade atual do item nem proration de `subscription_update`: no bug que
 * originou isto (davidson/gilberto) era exatamente a MUDANÇA de quantidade cuja
 * cobrança falhou. Creditar só o que foi pago erra pro lado seguro.
 */
export async function periodoPagoDaConexao(sub: Stripe.Subscription): Promise<{ pagoAteMs: number | null; quantidadePaga: number }> {
  try {
    const invs = await stripe.invoices.list({ subscription: sub.id, status: 'paid', limit: 12 });
    let ate = 0, qtd = 0;
    for (const inv of invs.data) {
      const reason = inv.billing_reason || '';
      if (reason !== 'subscription_create' && reason !== 'subscription_cycle') continue;
      for (const ln of inv.lines?.data || []) {
        const fim = (ln.period?.end ?? 0) * 1000;
        if (fim > ate) { ate = fim; qtd = ln.quantity ?? qtd; }
      }
    }
    return { pagoAteMs: ate || null, quantidadePaga: qtd };
  } catch {
    return { pagoAteMs: null, quantidadePaga: 0 };
  }
}

export async function gravarConexoesPagas(userId: string, sub: Stripe.Subscription) {
  const item = sub.items.data.find((i) => ehPriceConexaoOf(i.price?.id)) || sub.items.data[0];
  const ativa = sub.status === 'active' || sub.status === 'trialing';
  const intervalo = item?.price?.recurring?.interval === 'year' ? 'anual' : 'mensal';

  // EM DIA: libera a quantidade atual e tira qualquer prazo (null = sem fim).
  // NÃO ATIVA: zera — MENOS o ANUAL pré-pago, que mantém o que já foi pago até o
  // fim do período (ver lib/conexao-of-encerramento). Era o bug que cancelava o
  // ano pago por causa de uma proration que falhou.
  let qtd: number, ate: string | null;
  if (ativa) {
    qtd = item?.quantity ?? 0; ate = null;
  } else {
    const { pagoAteMs, quantidadePaga } = await periodoPagoDaConexao(sub);
    ({ of_conexoes_pagas: qtd, of_conexoes_pagas_ate: ate } =
      decidirEncerramentoConexao({ intervalo, pagoAteMs, quantidadePaga, agoraMs: Date.now() }));
  }

  try {
    await supabaseAdmin.from('users').update({
      of_conexoes_pagas: qtd,
      of_assinatura_id: sub.id,
      of_assinatura_intervalo: intervalo,
    }).eq('id', userId);
  } catch (e) {
    // Migration 111 pendente: não pode derrubar o webhook inteiro.
    console.error('[stripe/webhook] conexão OF (migration 111?):', e instanceof Error ? e.message : e);
  }

  // ⚠️ VALIDADE (migration 180) em update SEPARADO e tolerante: se a coluna não
  // existir, só este bloco falha e a quantidade acima continua gravada.
  try {
    await supabaseAdmin.from('users').update({ of_conexoes_pagas_ate: ate }).eq('id', userId);
  } catch { /* migration 180 pendente */ }

  // ── QUANDO ESSA ASSINATURA ACABA (migration 183) ──────────────────────────
  //
  // ⚠️ É O ÚNICO MOMENTO EM QUE DÁ PRA AVISAR ANTES. Quando a pessoa cancela,
  // o Stripe marca `cancel_at_period_end` e o período ainda corre — e manda
  // isso neste evento. Guardando a data, o cron consegue dizer "sua conexão
  // com o banco termina em 3 dias" ENQUANTO ela ainda pode reativar sem
  // perder nada. Depois que o período acaba, qualquer aviso já é tarde.
  //
  // ⚠️ GRAVAÇÃO SEPARADA E TOLERANTE: sem a 183 este bloco falha sozinho e o
  // resto do webhook (que concede o acesso) segue intacto.
  try {
    // ⚠️ NA API ATUAL (2026-04-22.dahlia) O FIM DO PERÍODO MORA NO ITEM: no topo
    // da assinatura vem `undefined` (medido em 10/11/2026 nas 26 assinaturas de
    // conexão). Lendo só o topo, `of_assinatura_fim` nunca era gravado e o aviso
    // "sua conexão termina em 3 dias" não saía pra ninguém. O topo fica como
    // segunda opção pra evento de endpoint em versão antiga da API.
    const fim = sub.items?.data?.[0]?.current_period_end
      ?? (sub as unknown as { current_period_end?: number }).current_period_end;
    await supabaseAdmin.from('users').update({
      // Só há fim conhecido quando ela JÁ cancelou. Reativando, volta a null e
      // o aviso some junto — senão avisaríamos quem voltou a pagar.
      of_assinatura_fim: sub.cancel_at_period_end && fim
        ? new Date(fim * 1000).toISOString() : null,
      of_fim_avisado_em: null,
    }).eq('id', userId);
  } catch { /* migration 183 pendente — segue sem aviso prévio */ }
}

/**
 * Assinatura de conexão ENCERRADA (`customer.subscription.deleted`): grava o que
 * sobra do período pago e desvincula a assinatura. Não toca no plano.
 */
export async function encerrarConexaoCancelada(targetId: string, sub: Stripe.Subscription) {
  const item = sub.items.data.find((i) => ehPriceConexaoOf(i.price?.id)) || sub.items.data[0];
  const intervalo = item?.price?.recurring?.interval === 'year' ? 'anual' : 'mensal';
  const { pagoAteMs, quantidadePaga } = await periodoPagoDaConexao(sub);
  const { of_conexoes_pagas, of_conexoes_pagas_ate } =
    decidirEncerramentoConexao({ intervalo, pagoAteMs, quantidadePaga, agoraMs: Date.now() });
  try {
    await supabaseAdmin.from('users').update({
      of_conexoes_pagas, of_assinatura_id: null, of_assinatura_intervalo: null,
    }).eq('id', targetId);
  } catch { /* migration 111 pendente */ }
  // Validade (migration 180) separada e tolerante.
  try {
    await supabaseAdmin.from('users').update({ of_conexoes_pagas_ate }).eq('id', targetId);
  } catch { /* migration 180 pendente */ }
}

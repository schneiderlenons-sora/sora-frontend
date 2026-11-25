// ─────────────────────────────────────────────────────────────────────────────
// ASSINATURA PELA APPLE (app de iPhone) — regras puras (sem rede), travadas em
// `npm run eval:apple-billing`. Irmã de `lib/play-billing.ts`.
//
// Dentro do app de iPhone a assinatura só pode ser vendida pela cobrança da
// Apple (3.1.1). O site segue no Stripe e o Android na Google Play. Este
// arquivo decide, a partir do que a App Store devolve, se a assinatura VALE,
// qual plano ela dá e até quando.
//
// ⚠️ OS IDs DOS PRODUTOS SÃO OS MESMOS DA PLAY (`sora_<plano>_<ciclo>`), num
// único grupo de assinaturas no App Store Connect. No mesmo grupo a Apple trata
// sozinha a troca de plano: subir vale na hora (devolve a sobra do período),
// descer vale na próxima renovação. Nenhum "modo de troca" a escolher aqui.
//
// ⚠️ DIFERENÇA QUE MUDA A REGRA: na Play, compra não confirmada em 3 dias é
// reembolsada pelo Google — então recusar = devolver. Na APPLE NÃO HÁ ISSO.
// Compra que a Sora não aplica fica paga. Por isso a tela nunca oferece a
// assinatura da Apple a quem já tem plano por outro caminho (vitalício, site,
// Play), e se mesmo assim acontecer a compra é GRAVADA (aparece no admin) e a
// pessoa é orientada a pedir o reembolso à Apple.
//
// ⚠️ PRODUTO DESCONHECIDO NUNCA LIBERA PLANO (mesma regra da Play).
// ─────────────────────────────────────────────────────────────────────────────

import { PRODUTOS_PLAY, ORDEM_PLAY, FOLGA_VALIDADE_MS, produtoPlay, type PlanoPlay, type IntervaloPlay } from './play-billing';

export type PlanoApple = PlanoPlay;
export type IntervaloApple = IntervaloPlay;

/** Mesmos IDs nas duas lojas. */
export const PRODUTOS_APPLE = PRODUTOS_PLAY;
export const ORDEM_APPLE = ORDEM_PLAY;
export const produtoApple = produtoPlay;

/**
 * Estado da assinatura, a partir do `status` do App Store Server API
 * (getAllSubscriptionStatuses): 1 ativa · 2 expirada · 3 tentando cobrar ·
 * 4 período de carência · 5 revogada (reembolso, ou saiu do Compartilhamento
 * Familiar).
 */
export type EstadoApple = 'ativa' | 'expirada' | 'tentando_cobrar' | 'carencia' | 'revogada' | 'desconhecido';

export function estadoDoStatus(status: number | null | undefined): EstadoApple {
  switch (status) {
    case 1: return 'ativa';
    case 2: return 'expirada';
    case 3: return 'tentando_cobrar';
    case 4: return 'carencia';
    case 5: return 'revogada';
    default: return 'desconhecido';
  }
}

/** O que usamos de uma transação decodificada (JWSTransactionDecodedPayload). */
export type TransacaoApple = {
  productId?: string;
  originalTransactionId?: string;
  transactionId?: string;
  expiresDate?: number;
  appAccountToken?: string;
  environment?: string;
  revocationDate?: number;
};

/** O que usamos da renovação decodificada (JWSRenewalInfoDecodedPayload). */
export type RenovacaoApple = {
  autoRenewStatus?: number;
  autoRenewProductId?: string;
  gracePeriodExpiresDate?: number;
};

export type LeituraApple = {
  original: string | null;
  transacao: string | null;
  produto: string | null;
  plano: PlanoApple | null;
  intervalo: IntervaloApple | null;
  estado: EstadoApple;
  expiraEm: string | null;
  autoRenova: boolean;
  /** `appAccountToken` = id da conta Sora que comprou (UUID), quando veio. */
  conta: string | null;
  ambiente: string | null;
  /** Produto da PRÓXIMA renovação (troca pra baixo agendada). */
  proximoProduto: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function lerAssinaturaApple(status: number | null | undefined, tx: TransacaoApple, renov?: RenovacaoApple | null): LeituraApple {
  const produto = tx.productId ?? null;
  const cat = produto ? PRODUTOS_APPLE[produto] : undefined;
  // Na carência a Apple garante o acesso até `gracePeriodExpiresDate`, que vem
  // DEPOIS do vencimento da transação — é essa a data que vale.
  const exp = estadoDoStatus(status) === 'carencia' && renov?.gracePeriodExpiresDate
    ? renov.gracePeriodExpiresDate
    : tx.expiresDate;
  const conta = tx.appAccountToken && UUID.test(tx.appAccountToken) ? tx.appAccountToken.toLowerCase() : null;
  return {
    original: tx.originalTransactionId ?? null,
    transacao: tx.transactionId ?? null,
    produto,
    plano: cat?.plano ?? null,
    intervalo: cat?.intervalo ?? null,
    // Revogação pode chegar no status ou só na transação (reembolso).
    estado: tx.revocationDate ? 'revogada' : estadoDoStatus(status),
    expiraEm: typeof exp === 'number' && Number.isFinite(exp) ? new Date(exp).toISOString() : null,
    autoRenova: renov?.autoRenewStatus === 1,
    conta,
    ambiente: tx.environment ?? null,
    proximoProduto: renov?.autoRenewProductId && renov.autoRenewProductId !== produto ? renov.autoRenewProductId : null,
  };
}

/** Linha como fica gravada em `apple_assinaturas`. */
export type LinhaApple = { plano: string | null; intervalo: string | null; estado: string; expira_em: string | null };

/**
 * A assinatura dá direito ao plano AGORA?
 *
 * Só "ativa" (até o vencimento) e "carência" (a Apple ainda tentando cobrar,
 * com acesso garantido por ela). "Tentando cobrar" SEM carência NÃO dá direito:
 * é a Apple dizendo que a pessoa está sem acesso até o cartão passar.
 */
export function linhaComDireitoApple(l: LinhaApple, agoraMs: number): boolean {
  if (!l.plano || !(l.plano in ORDEM_APPLE)) return false;
  if (l.estado !== 'ativa' && l.estado !== 'carencia') return false;
  const ms = l.expira_em ? Date.parse(l.expira_em) : NaN;
  if (l.estado === 'carencia' && !Number.isFinite(ms)) return true;
  return Number.isFinite(ms) && ms > agoraMs;
}

/**
 * O plano que as assinaturas Apple da pessoa dão, somadas — o maior, com a
 * data mais longe (mesma regra da Play: olhar o conjunto, não o último aviso).
 */
export function planoDasAssinaturasApple(linhas: LinhaApple[], agoraMs: number):
  { plano: PlanoApple; intervalo: IntervaloApple; validoAte: string } | null {
  let melhor: { plano: PlanoApple; intervalo: IntervaloApple; ms: number } | null = null;
  for (const l of linhas) {
    if (!linhaComDireitoApple(l, agoraMs)) continue;
    const plano = l.plano as PlanoApple;
    const intervalo: IntervaloApple = l.intervalo === 'anual' ? 'anual' : 'mensal';
    const exp = l.expira_em ? Date.parse(l.expira_em) : NaN;
    const ms = Number.isFinite(exp) && exp > agoraMs ? exp : agoraMs;
    if (!melhor
      || ORDEM_APPLE[plano] > ORDEM_APPLE[melhor.plano]
      || (ORDEM_APPLE[plano] === ORDEM_APPLE[melhor.plano] && ms > melhor.ms)) {
      melhor = { plano, intervalo, ms };
    }
  }
  if (!melhor) return null;
  return { plano: melhor.plano, intervalo: melhor.intervalo, validoAte: new Date(melhor.ms + FOLGA_VALIDADE_MS).toISOString() };
}

/** Recorte de `users` que a decisão precisa. */
export type UsuarioPlanoApple = {
  plano: string | null;
  plano_fonte?: string | null;
  vitalicio?: boolean | null;
  stripe_subscription_id?: string | null;
};

/**
 * A assinatura da Apple pode MANDAR no plano desta conta?
 *
 * Sim quando o plano já veio da Apple, ou quando a conta não tem plano pago
 * nenhum. Não quando ela é vitalícia, assina pelo site ou pela Play: aí a
 * compra da Apple é gravada mas não mexe no plano (a tela nem a oferece).
 */
export function appleMandaNoPlano(u: UsuarioPlanoApple): boolean {
  if (u.plano_fonte === 'apple') return true;
  if (u.vitalicio) return false;
  return !u.plano || u.plano === 'gratis' || u.plano === 'inativo';
}

/**
 * O que gravar em `users` depois de reler as assinaturas Apple. `null` = nada.
 *
 * ⚠️ SÓ REBAIXA QUEM GANHOU O PLANO PELA APPLE (`plano_fonte = 'apple'`) — a
 * mesma trava da Play: o vencimento de uma assinatura da Apple nunca derruba
 * vitalício, assinante do site ou cortesia. Quem perde volta pro `gratis`.
 */
export function decidirPatchUsuarioApple(u: UsuarioPlanoApple, apple: ReturnType<typeof planoDasAssinaturasApple>):
  Record<string, string | null> | null {
  if (apple) {
    if (!appleMandaNoPlano(u)) return null;
    return { plano: apple.plano, plano_intervalo: apple.intervalo, plano_valido_ate: apple.validoAte, plano_fonte: 'apple' };
  }
  if (u.plano_fonte !== 'apple') return null;
  if (u.vitalicio || u.stripe_subscription_id) return { plano_fonte: null };
  return { plano: 'gratis', plano_intervalo: null, plano_valido_ate: null, plano_fonte: null };
}

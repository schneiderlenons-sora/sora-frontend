// ─────────────────────────────────────────────────────────────────────────────
// ASSINATURA PELA GOOGLE PLAY — regras puras (sem rede), travadas em
// `npm run eval:play-billing`.
//
// Dentro do app Android a Sora só pode vender pela cobrança do Google (política
// de pagamentos do Play; o Brasil não tem billing alternativo). O site segue no
// Stripe. Este arquivo decide, a partir do que a API do Google devolve, se a
// assinatura VALE, qual plano ela dá e até quando.
//
// ⚠️ UM PRODUTO POR PLANO+CICLO, nunca um produto com vários "base plans". A
// ponte da TWA (androidbrowserhelper billing 1.2.0, conferida no .aar) compra
// SEMPRE a primeira oferta do produto — com mensal e anual no mesmo produto o
// anual nunca seria comprável. Os IDs abaixo têm de existir IGUAIS no Play
// Console (Monetizar → Assinaturas), cada um com um único base plan.
//
// ⚠️ PRODUTO DESCONHECIDO NUNCA LIBERA PLANO. Se alguém criar um produto novo no
// Play Console sem entrar aqui, a compra é gravada mas não dá acesso — o erro
// fica visível (cliente reclama) em vez de silencioso (plano errado).
// ─────────────────────────────────────────────────────────────────────────────

export type PlanoPlay = 'basico' | 'premium' | 'platinum';
export type IntervaloPlay = 'mensal' | 'anual';

export const PRODUTOS_PLAY: Record<string, { plano: PlanoPlay; intervalo: IntervaloPlay }> = {
  sora_basico_mensal:   { plano: 'basico',   intervalo: 'mensal' },
  sora_basico_anual:    { plano: 'basico',   intervalo: 'anual' },
  sora_premium_mensal:  { plano: 'premium',  intervalo: 'mensal' },
  sora_premium_anual:   { plano: 'premium',  intervalo: 'anual' },
  sora_platinum_mensal: { plano: 'platinum', intervalo: 'mensal' },
  sora_platinum_anual:  { plano: 'platinum', intervalo: 'anual' },
};

export const ORDEM_PLAY: Record<PlanoPlay, number> = { basico: 1, premium: 2, platinum: 3 };

export function produtoPlay(plano: PlanoPlay, intervalo: IntervaloPlay): string {
  return `sora_${plano}_${intervalo}`;
}

/**
 * Folga somada ao vencimento antes de gravar em `users.plano_valido_ate`.
 *
 * ⚠️ `exigirPlano` (backend) EXPIRA o plano sozinho quando essa data passa, e o
 * aviso de renovação do Google (RTDN) pode chegar minutos ou horas depois da
 * virada. Sem folga, todo assinante perderia o acesso por um instante a cada
 * renovação. Um dia a mais pra quem cancelou é o preço aceito.
 */
export const FOLGA_VALIDADE_MS = 24 * 60 * 60 * 1000;

/** Estados em que a pessoa ainda tem direito ao plano (até o `expiryTime`). */
const ESTADOS_COM_DIREITO = new Set([
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',  // cartão recusado, Google ainda tentando
  'SUBSCRIPTION_STATE_CANCELED',         // cancelou: vale até o fim do período pago
]);

/** O que a API `purchases.subscriptionsv2.get` devolve (só o que usamos). */
export type AssinaturaV2 = {
  subscriptionState?: string;
  linkedPurchaseToken?: string;
  latestOrderId?: string;
  acknowledgementState?: string;
  testPurchase?: unknown;
  lineItems?: {
    productId?: string;
    expiryTime?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
  }[];
};

export type EstadoPlay = {
  produto: string | null;
  plano: PlanoPlay | null;
  intervalo: IntervaloPlay | null;
  estado: string;
  expiraEm: string | null;
  autoRenova: boolean;
  reconhecida: boolean;
  vinculada: string | null;
  pedido: string | null;
  teste: boolean;
};

export function lerAssinatura(sub: AssinaturaV2): EstadoPlay {
  const li = sub.lineItems?.[0];
  const produto = li?.productId ?? null;
  const cat = produto ? PRODUTOS_PLAY[produto] : undefined;
  const ms = li?.expiryTime ? Date.parse(li.expiryTime) : NaN;
  return {
    produto,
    plano: cat?.plano ?? null,
    intervalo: cat?.intervalo ?? null,
    estado: sub.subscriptionState || 'SUBSCRIPTION_STATE_UNSPECIFIED',
    expiraEm: Number.isFinite(ms) ? new Date(ms).toISOString() : null,
    autoRenova: !!li?.autoRenewingPlan?.autoRenewEnabled,
    reconhecida: sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
    vinculada: sub.linkedPurchaseToken || null,
    pedido: sub.latestOrderId || null,
    teste: sub.testPurchase != null,
  };
}

/** Linha como fica gravada em `play_assinaturas`. */
export type LinhaPlay = { plano: string | null; intervalo: string | null; estado: string; expira_em: string | null };

/**
 * A assinatura dá direito ao plano AGORA?
 *
 * ⚠️ PERÍODO DE CARÊNCIA VALE MESMO COM A DATA VENCIDA: é o Google tentando
 * cobrar de novo, e cortar ali puniria quem só teve o cartão recusado uma vez.
 */
export function linhaComDireito(l: LinhaPlay, agoraMs: number): boolean {
  if (!l.plano || !(l.plano in ORDEM_PLAY)) return false;
  if (!ESTADOS_COM_DIREITO.has(l.estado)) return false;
  if (l.estado === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') return true;
  const ms = l.expira_em ? Date.parse(l.expira_em) : NaN;
  return Number.isFinite(ms) && ms > agoraMs;
}

/**
 * O plano que as assinaturas Play da pessoa dão, somadas.
 *
 * ⚠️ OLHA TODAS, NÃO A ÚLTIMA QUE MUDOU. Na troca de plano o Google cria uma
 * compra NOVA (com `linkedPurchaseToken` apontando pra antiga) e os avisos de
 * cada uma chegam em ordem qualquer. Decidir pela última notificação deixaria o
 * plano oscilar; decidir pelo conjunto dá sempre o mesmo resultado. Na troca
 * adiada (downgrade), as duas convivem até a renovação — e o maior plano vale.
 */
export function planoDasAssinaturas(linhas: LinhaPlay[], agoraMs: number):
  { plano: PlanoPlay; intervalo: IntervaloPlay; validoAte: string } | null {
  let melhor: { plano: PlanoPlay; intervalo: IntervaloPlay; ms: number } | null = null;
  for (const l of linhas) {
    if (!linhaComDireito(l, agoraMs)) continue;
    const plano = l.plano as PlanoPlay;
    const intervalo: IntervaloPlay = l.intervalo === 'anual' ? 'anual' : 'mensal';
    const exp = l.expira_em ? Date.parse(l.expira_em) : NaN;
    // Carência com data já vencida: segura um dia à frente; o próximo aviso
    // do Google (recuperou ou suspendeu) decide de verdade.
    const ms = Number.isFinite(exp) && exp > agoraMs ? exp : agoraMs;
    if (!melhor
      || ORDEM_PLAY[plano] > ORDEM_PLAY[melhor.plano]
      || (ORDEM_PLAY[plano] === ORDEM_PLAY[melhor.plano] && ms > melhor.ms)) {
      melhor = { plano, intervalo, ms };
    }
  }
  if (!melhor) return null;
  return { plano: melhor.plano, intervalo: melhor.intervalo, validoAte: new Date(melhor.ms + FOLGA_VALIDADE_MS).toISOString() };
}

/** Recorte de `users` que a decisão precisa. */
export type UsuarioPlano = {
  plano: string | null;
  plano_fonte?: string | null;
  vitalicio?: boolean | null;
  stripe_subscription_id?: string | null;
};

/**
 * O que gravar em `users` depois de reler as assinaturas Play. `null` = nada.
 *
 * ⚠️ SÓ REBAIXA QUEM GANHOU O PLANO PELA PLAY (`plano_fonte = 'play'`). Sem
 * isso, o aviso de expiração de uma assinatura Play antiga derrubaria um
 * vitalício, um assinante do Stripe ou uma cortesia dada pelo admin. Na dúvida,
 * não mexe: plano a mais por engano é corrigível; plano tirado de quem pagou
 * vira reclamação.
 *
 * Quem perde a assinatura Play volta pro `gratis` (o modo manual de quem veio
 * do app), nunca pro `inativo` — que no site é paywall.
 */
export function decidirPatchUsuario(u: UsuarioPlano, play: ReturnType<typeof planoDasAssinaturas>):
  Record<string, string | null> | null {
  if (play) {
    return { plano: play.plano, plano_intervalo: play.intervalo, plano_valido_ate: play.validoAte, plano_fonte: 'play' };
  }
  if (u.plano_fonte !== 'play') return null;
  if (u.vitalicio || u.stripe_subscription_id) return { plano_fonte: null };
  return { plano: 'gratis', plano_intervalo: null, plano_valido_ate: null, plano_fonte: null };
}

/**
 * Como trocar de uma assinatura Play pra outra (campo `replacementMode` da
 * ponte da TWA).
 *
 * - Plano MAIOR → `chargeProratedPrice`: libera na hora e cobra só a diferença
 *   do período que falta.
 * - Plano menor ou só troca de ciclo → `deferred`: vale na próxima renovação,
 *   então ninguém perde o que já pagou nem é cobrado duas vezes no mesmo mês.
 */
export function modoDeTroca(de: PlanoPlay, para: PlanoPlay): 'chargeProratedPrice' | 'deferred' {
  return ORDEM_PLAY[para] > ORDEM_PLAY[de] ? 'chargeProratedPrice' : 'deferred';
}

// =============================================================================
// Helpers de analytics — disparam eventos no Meta Pixel + Conversions API
// (via /api/analytics) E no TikTok Pixel + Events API (via
// /api/analytics/tiktok), TUDO NA MESMA CHAMADA. Cada canal tem seu próprio
// event_id, sem nenhum canal saber do outro — se um provider não tiver
// pixel configurado (ttq/fbq ausente), o disparo pra ele só falha em
// silêncio, os outros seguem normal.
//
// Deduplicação por canal: o event_id do Meta vai igual pro fbq() e pra CAPI;
// o event_id do TikTok vai igual pro ttq.track() e pro Events API. Cada
// provider ignora a própria duplicata.
//
// Uso:
//   import { trackSignUp } from '@/lib/analytics';
//   trackSignUp({ email: user.email });
// =============================================================================

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, data?: Record<string, unknown>) => void };
  }
}

// Gera UUID v4 simples pra dedup
function uuid(): string {
  return crypto.randomUUID?.() ||
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

// Lê cookies _fbc e _fbp (Facebook click/browser ID)
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m?.[1];
}

// Dispara no pixel client-side (Meta)
function fbq(...args: unknown[]) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq(...args);
  }
}

// Dispara no pixel client-side (TikTok)
function ttqTrack(event: string, data?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.ttq) {
    window.ttq.track(event, data);
  }
}

// Envia pro /api/analytics (CAPI server-side). Non-blocking.
function sendToCAPI(payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true, // garante envio mesmo se o user sair da página
  }).catch(() => {}); // silencioso
}

// Envia pro /api/analytics/tiktok (Events API server-side). Non-blocking.
function sendToTikTokAPI(payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  fetch('/api/analytics/tiktok', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {}); // silencioso
}

type UserInfo = {
  email?: string;
  phone?: string;
  name?: string;
};

// Monta user_data com cookies FB pra melhor match rate
function buildUserData(info?: UserInfo) {
  return {
    em: info?.email,
    ph: info?.phone,
    fn: info?.name,
    fbc: getCookie('_fbc'),
    fbp: getCookie('_fbp'),
  };
}

// Monta user_data com cookies TikTok (_ttp = browser id automático do
// ttq.load; ttclid = capturado na mão em TikTokPixel.tsx, ver o porquê lá)
function buildTikTokUserData(info?: UserInfo) {
  return {
    email: info?.email,
    phone: info?.phone,
    ttp: getCookie('_ttp'),
    ttclid: getCookie('ttclid'),
  };
}

// Nome do evento no TikTok, quando é diferente do nome-padrão do Meta usado
// nesse arquivo — https://ads.tiktok.com/marketing_api/docs?id=1701890979375106
const TIKTOK_EVENT: Record<string, string> = {
  Lead: 'SubmitForm',
  Purchase: 'CompletePayment',
  // CompleteRegistration e InitiateCheckout têm o MESMO nome nos dois.
};

// ─── Eventos públicos ────────────────────────────────────────────────────────
// Cada função dispara nos DOIS canais (Meta + TikTok), client E server-side,
// cada um com seu próprio event_id pra dedup. Sem `if (fbq)`/`if (ttq)`
// espalhado: os helpers (fbq/ttqTrack/sendToCAPI/sendToTikTokAPI) já
// verificam sozinhos se o provider está configurado.

export function trackPageView() {
  fbq('track', 'PageView');
  // ttq.page() já dispara sozinho no load do TikTokPixel — nada a fazer aqui.
}

export function trackSignUp(info?: UserInfo) {
  const eventId = uuid();
  fbq('track', 'CompleteRegistration', {}, { eventID: eventId });
  sendToCAPI({
    event_name: 'CompleteRegistration',
    event_id: eventId,
    event_source_url: window.location.href,
    user_data: buildUserData(info),
  });

  const ttEventId = uuid();
  ttqTrack('CompleteRegistration', { event_id: ttEventId });
  sendToTikTokAPI({
    event: 'CompleteRegistration',
    event_id: ttEventId,
    event_source_url: window.location.href,
    user_data: buildTikTokUserData(info),
  });
}

export function trackLead(info?: UserInfo) {
  const eventId = uuid();
  fbq('track', 'Lead', {}, { eventID: eventId });
  sendToCAPI({
    event_name: 'Lead',
    event_id: eventId,
    event_source_url: window.location.href,
    user_data: buildUserData(info),
  });

  const ttEventId = uuid();
  ttqTrack(TIKTOK_EVENT.Lead, { event_id: ttEventId });
  sendToTikTokAPI({
    event: TIKTOK_EVENT.Lead,
    event_id: ttEventId,
    event_source_url: window.location.href,
    user_data: buildTikTokUserData(info),
  });
}

// ViewContent e AddToCart existem com o MESMO nome no Meta e no TikTok — sem
// precisar de TIKTOK_EVENT. São os dois degraus que faltavam no funil (o
// TikTok reclama "eventos ausentes: ViewContent/AddToCart" quando só chegam
// InitiateCheckout+Purchase — o modelo de otimização deles quer o funil
// inteiro, mesmo pra quem não vende produto físico).
export function trackViewContent(params?: { name?: string; value?: number; currency?: string }, info?: UserInfo) {
  const eventId = uuid();
  const customData = { content_name: params?.name, value: params?.value, currency: params?.currency || 'BRL' };
  fbq('track', 'ViewContent', customData, { eventID: eventId });
  sendToCAPI({
    event_name: 'ViewContent',
    event_id: eventId,
    event_source_url: window.location.href,
    user_data: buildUserData(info),
    custom_data: customData,
  });

  const ttEventId = uuid();
  ttqTrack('ViewContent', { ...customData, event_id: ttEventId });
  sendToTikTokAPI({
    event: 'ViewContent',
    event_id: ttEventId,
    event_source_url: window.location.href,
    user_data: buildTikTokUserData(info),
    custom_data: customData,
  });
}

// "Carrinho" da Sora = escolher um plano (não existe carrinho de verdade).
// Disparado sempre JUNTO com trackInitiateCheckout, no mesmo clique — dois
// eventos de funil por uma ação só, sem mudar UX nenhuma.
export function trackAddToCart(params?: { name?: string; value?: number; currency?: string }, info?: UserInfo) {
  const eventId = uuid();
  const customData = { content_name: params?.name, value: params?.value, currency: params?.currency || 'BRL' };
  fbq('track', 'AddToCart', customData, { eventID: eventId });
  sendToCAPI({
    event_name: 'AddToCart',
    event_id: eventId,
    event_source_url: window.location.href,
    user_data: buildUserData(info),
    custom_data: customData,
  });

  const ttEventId = uuid();
  ttqTrack('AddToCart', { ...customData, event_id: ttEventId });
  sendToTikTokAPI({
    event: 'AddToCart',
    event_id: ttEventId,
    event_source_url: window.location.href,
    user_data: buildTikTokUserData(info),
    custom_data: customData,
  });
}

export function trackInitiateCheckout(params?: { value?: number; currency?: string }, info?: UserInfo) {
  const eventId = uuid();
  const customData = { value: params?.value, currency: params?.currency || 'BRL' };
  fbq('track', 'InitiateCheckout', customData, { eventID: eventId });
  sendToCAPI({
    event_name: 'InitiateCheckout',
    event_id: eventId,
    event_source_url: window.location.href,
    user_data: buildUserData(info),
    custom_data: customData,
  });

  const ttEventId = uuid();
  ttqTrack('InitiateCheckout', { ...customData, event_id: ttEventId });
  sendToTikTokAPI({
    event: 'InitiateCheckout',
    event_id: ttEventId,
    event_source_url: window.location.href,
    user_data: buildTikTokUserData(info),
    custom_data: customData,
  });
}

export function trackPurchase(params: { value: number; currency?: string }, info?: UserInfo) {
  const eventId = uuid();
  const customData = { value: params.value, currency: params.currency || 'BRL' };
  fbq('track', 'Purchase', customData, { eventID: eventId });
  sendToCAPI({
    event_name: 'Purchase',
    event_id: eventId,
    event_source_url: window.location.href,
    user_data: buildUserData(info),
    custom_data: customData,
  });

  const ttEventId = uuid();
  ttqTrack(TIKTOK_EVENT.Purchase, { ...customData, event_id: ttEventId });
  sendToTikTokAPI({
    event: TIKTOK_EVENT.Purchase,
    event_id: ttEventId,
    event_source_url: window.location.href,
    user_data: buildTikTokUserData(info),
    custom_data: customData,
  });
}

export function trackCustom(event: string, data?: Record<string, unknown>, info?: UserInfo) {
  const eventId = uuid();
  fbq('trackCustom', event, data, { eventID: eventId });
  sendToCAPI({
    event_name: event,
    event_id: eventId,
    event_source_url: typeof window !== 'undefined' ? window.location.href : undefined,
    user_data: buildUserData(info),
    custom_data: data,
  });

  const ttEventId = uuid();
  const ttEvent = TIKTOK_EVENT[event] || event;
  ttqTrack(ttEvent, { ...data, event_id: ttEventId });
  sendToTikTokAPI({
    event: ttEvent,
    event_id: ttEventId,
    event_source_url: typeof window !== 'undefined' ? window.location.href : undefined,
    user_data: buildTikTokUserData(info),
    custom_data: data,
  });
}

// =============================================================================
// Helpers de analytics — disparam eventos no Meta Pixel (client-side) E
// na Conversions API (server-side via /api/analytics).
//
// Deduplicação: cada evento gera um event_id único que é enviado em
// ambos os canais. O Facebook ignora a duplicata automaticamente.
//
// Uso:
//   import { trackSignUp } from '@/lib/analytics';
//   trackSignUp({ email: user.email });
// =============================================================================

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
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

// Dispara no pixel client-side
function fbq(...args: unknown[]) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq(...args);
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

// ─── Eventos públicos ────────────────────────────────────────────────────────

export function trackPageView() {
  fbq('track', 'PageView');
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
}

// =============================================================================
// Facebook Conversions API (server-side).
// Envia eventos direto pro Facebook sem depender do navegador do usuário.
// Não é bloqueado por ad blockers → dados mais precisos pra otimização.
//
// Usado em 2 pontos:
//   1. Route handler /api/analytics (ponte do frontend pra CAPI)
//   2. Webhook Stripe (Purchase server-side puro, sem navegador)
//
// Deduplicação: cada evento leva um event_id único. O pixel client-side
// envia o mesmo event_id → Facebook ignora duplicata automaticamente.
//
// Env vars (server-side only, NÃO públicas):
//   FB_ACCESS_TOKEN        — token de longa duração do Meta Business
//   NEXT_PUBLIC_FB_PIXEL_ID — pixel ID (compartilhado com o client)
// =============================================================================

import crypto from 'crypto';

const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const API_VERSION = 'v21.0';

// Hash SHA-256 normalizado (Facebook exige hashed user data)
function sha256(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return crypto
    .createHash('sha256')
    .update(value.trim().toLowerCase())
    .digest('hex');
}

export type CAPIEvent = {
  event_name: 'PageView' | 'Lead' | 'CompleteRegistration' | 'InitiateCheckout' | 'Purchase' | string;
  event_id?: string;
  event_time?: number;
  event_source_url?: string;
  action_source?: 'website' | 'app' | 'other';
  user_data?: {
    em?: string;       // email (plain — será hasheado)
    ph?: string;       // phone (plain — será hasheado)
    fn?: string;       // first name (plain)
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string;      // Facebook click ID (do cookie _fbc)
    fbp?: string;      // Facebook browser ID (do cookie _fbp)
  };
  custom_data?: {
    value?: number;
    currency?: string;
    content_name?: string;
    content_category?: string;
    [key: string]: unknown;
  };
};

/**
 * Envia um ou mais eventos pra Facebook Conversions API.
 * Silencioso em caso de erro (não quebra o fluxo da aplicação).
 */
export async function sendCAPIEvents(events: CAPIEvent[]): Promise<{ success: boolean; error?: string }> {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return { success: false, error: 'FB_ACCESS_TOKEN ou NEXT_PUBLIC_FB_PIXEL_ID ausente' };
  }

  const payload = {
    data: events.map((evt) => ({
      event_name:       evt.event_name,
      event_id:         evt.event_id || crypto.randomUUID(),
      event_time:       evt.event_time || Math.floor(Date.now() / 1000),
      event_source_url: evt.event_source_url,
      action_source:    evt.action_source || 'website',
      user_data: evt.user_data ? {
        em: evt.user_data.em ? [sha256(evt.user_data.em)] : undefined,
        ph: evt.user_data.ph ? [sha256(evt.user_data.ph)] : undefined,
        fn: evt.user_data.fn ? [sha256(evt.user_data.fn)] : undefined,
        client_ip_address: evt.user_data.client_ip_address,
        client_user_agent: evt.user_data.client_user_agent,
        fbc: evt.user_data.fbc,
        fbp: evt.user_data.fbp,
      } : undefined,
      custom_data: evt.custom_data,
    })),
  };

  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[CAPI] erro:', res.status, body);
      return { success: false, error: body };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[CAPI] fetch falhou:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Atalho pra enviar 1 evento.
 */
export async function sendCAPIEvent(event: CAPIEvent) {
  return sendCAPIEvents([event]);
}

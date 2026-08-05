// =============================================================================
// TikTok Events API (server-side). Espelha lib/facebook-capi.ts.
// Envia eventos direto pro TikTok sem depender do navegador do usuário —
// não é bloqueado por ad blocker, dado mais preciso pra otimizar o anúncio.
//
// Usado em 2 pontos (iguais ao Meta):
//   1. Route handler /api/analytics/tiktok (ponte do frontend)
//   2. Webhook Stripe (Purchase server-side puro, sem navegador)
//
// Deduplicação: cada evento leva um event_id único. O pixel client-side
// (ttq.track) envia o MESMO event_id → o TikTok ignora a duplicata.
//
// Env vars (server-side only, NÃO públicas):
//   TIKTOK_ACCESS_TOKEN       — token gerado em Events Manager → API de eventos
//   NEXT_PUBLIC_TIKTOK_PIXEL_ID — pixel code (compartilhado com o client)
// =============================================================================

import crypto from 'crypto';

const PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
const ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;
const API_VERSION = 'v1.3';

// Hash SHA-256 normalizado (o TikTok também exige dado hasheado, igual o Meta)
function sha256(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export type TikTokEvent = {
  // Nomes padrão do TikTok — https://ads.tiktok.com/marketing_api/docs?id=1701890979375106
  event: 'CompleteRegistration' | 'InitiateCheckout' | 'CompletePayment' | 'SubmitForm' | string;
  event_id?: string;
  event_time?: number; // unix seconds
  event_source_url?: string;
  user_data?: {
    email?: string;       // plain — será hasheado
    phone?: string;       // plain — será hasheado
    external_id?: string; // plain — será hasheado
    ttp?: string;         // cookie _ttp (browser id, gerado pelo próprio pixel)
    ttclid?: string;      // TikTok click ID (equivalente ao fbclid)
    client_ip_address?: string;
    client_user_agent?: string;
  };
  custom_data?: {
    value?: number;
    currency?: string;
    [key: string]: unknown;
  };
};

/**
 * Envia um ou mais eventos pra TikTok Events API.
 * Silencioso em caso de erro (não quebra o fluxo da aplicação) — mesmo
 * contrato do sendCAPIEvents (Meta).
 */
export async function sendTikTokEvents(events: TikTokEvent[]): Promise<{ success: boolean; error?: string }> {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return { success: false, error: 'TIKTOK_ACCESS_TOKEN ou NEXT_PUBLIC_TIKTOK_PIXEL_ID ausente' };
  }

  const payload = {
    event_source: 'web',
    event_source_id: PIXEL_ID,
    data: events.map((evt) => ({
      event:      evt.event,
      event_id:   evt.event_id || crypto.randomUUID(),
      event_time: evt.event_time || Math.floor(Date.now() / 1000),
      user: evt.user_data ? {
        email:       evt.user_data.email ? sha256(evt.user_data.email) : undefined,
        phone:       evt.user_data.phone ? sha256(evt.user_data.phone) : undefined,
        external_id: evt.user_data.external_id ? sha256(evt.user_data.external_id) : undefined,
        ttp:         evt.user_data.ttp,
        ttclid:      evt.user_data.ttclid,
        ip:          evt.user_data.client_ip_address,
        user_agent:  evt.user_data.client_user_agent,
      } : undefined,
      page: evt.event_source_url ? { url: evt.event_source_url } : undefined,
      properties: evt.custom_data,
    })),
  };

  try {
    const url = `https://business-api.tiktok.com/open_api/${API_VERSION}/event/track/`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': ACCESS_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.code !== 0) {
      console.error('[TikTok Events API] erro:', res.status, JSON.stringify(body));
      return { success: false, error: JSON.stringify(body) };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[TikTok Events API] fetch falhou:', msg);
    return { success: false, error: msg };
  }
}

/** Atalho pra enviar 1 evento. */
export async function sendTikTokEvent(event: TikTokEvent) {
  return sendTikTokEvents([event]);
}

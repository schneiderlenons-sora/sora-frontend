import { createSign } from 'crypto';
import type { AssinaturaV2 } from './play-billing';

// ─────────────────────────────────────────────────────────────────────────────
// Cliente mínimo da Google Play Developer API (androidpublisher v3).
//
// Sem SDK de propósito: são três chamadas, e o `googleapis` puxaria dezenas de
// MB pro bundle do servidor. A autenticação é a de CONTA DE SERVIÇO: um JWT
// assinado com a chave privada vira um access token de 1h.
//
// Env (Vercel):
//   GOOGLE_PLAY_SERVICE_ACCOUNT  o JSON INTEIRO da chave da conta de serviço
//   GOOGLE_PLAY_PACKAGE          opcional, padrão com.forsora.app
//
// ⚠️ A conta de serviço precisa ser CONVIDADA no Play Console (Usuários e
// permissões) com "Ver dados financeiros" e "Gerenciar pedidos e assinaturas".
// Sem o convite a API responde 401/403 mesmo com a chave certa — e esse é o
// erro mais comum de configuração, não bug.
// ─────────────────────────────────────────────────────────────────────────────

export const PACOTE_ANDROID = process.env.GOOGLE_PLAY_PACKAGE || 'com.forsora.app';
const BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

export class ErroPlay extends Error {
  constructor(msg: string, public status: number) { super(msg); }
  /** Token inexistente/inválido: resposta definitiva, não adianta tentar de novo. */
  get definitivo() { return this.status === 400 || this.status === 404 || this.status === 410; }
}

export function playConfigurado(): boolean {
  return !!process.env.GOOGLE_PLAY_SERVICE_ACCOUNT;
}

let cache: { token: string; ate: number } | null = null;

const b64url = (s: string | Buffer) =>
  Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function accessToken(): Promise<string> {
  if (cache && cache.ate > Date.now() + 60_000) return cache.token;
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT;
  if (!raw) throw new ErroPlay('GOOGLE_PLAY_SERVICE_ACCOUNT não configurado na Vercel.', 503);
  let sa: { client_email?: string; private_key?: string };
  try { sa = JSON.parse(raw); } catch { throw new ErroPlay('GOOGLE_PLAY_SERVICE_ACCOUNT não é um JSON válido.', 503); }
  if (!sa.client_email || !sa.private_key) throw new ErroPlay('Chave da conta de serviço sem client_email/private_key.', 503);
  // Colar o JSON numa variável de ambiente às vezes transforma as quebras de
  // linha da chave em "\n" literal — a assinatura falharia sem dizer por quê.
  const chave = sa.private_key.replace(/\\n/g, '\n');

  const agora = Math.floor(Date.now() / 1000);
  const cabeca = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 3600,
  }));
  const assinatura = b64url(createSign('RSA-SHA256').update(`${cabeca}.${corpo}`).sign(chave));

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabeca}.${corpo}.${assinatura}`,
    }),
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!r.ok || !j.access_token) throw new ErroPlay(`Login no Google falhou: ${j.error_description || r.status}`, 503);
  cache = { token: j.access_token, ate: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const r = await fetch(`${BASE}/${PACOTE_ANDROID}${caminho}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init.headers },
    cache: 'no-store',
  });
  const texto = await r.text();
  if (!r.ok) {
    let msg = texto.slice(0, 300);
    try { msg = JSON.parse(texto)?.error?.message || msg; } catch { /* não era JSON */ }
    throw new ErroPlay(`Google Play ${r.status}: ${msg}`, r.status);
  }
  return (texto ? JSON.parse(texto) : {}) as T;
}

const enc = encodeURIComponent;

/** Estado atual de uma assinatura, pela fonte da verdade (o Google). */
export function buscarAssinatura(purchaseToken: string): Promise<AssinaturaV2> {
  return chamar<AssinaturaV2>(`/purchases/subscriptionsv2/tokens/${enc(purchaseToken)}`);
}

/**
 * Confirma a compra pro Google.
 *
 * ⚠️ OBRIGATÓRIO EM ATÉ 3 DIAS: compra não confirmada é REEMBOLSADA
 * automaticamente pelo Google e o acesso some. Por isso a confirmação roda
 * tanto na compra quanto em todo aviso que chega depois (idempotente).
 */
export async function reconhecerAssinatura(productId: string, purchaseToken: string): Promise<void> {
  await chamar(`/purchases/subscriptions/${enc(productId)}/tokens/${enc(purchaseToken)}:acknowledge`, {
    method: 'POST', body: '{}',
  });
}

/** Cancela a renovação (a pessoa mantém o que já pagou até o fim do período). */
export async function cancelarAssinatura(productId: string, purchaseToken: string): Promise<void> {
  await chamar(`/purchases/subscriptions/${enc(productId)}/tokens/${enc(purchaseToken)}:cancel`, {
    method: 'POST', body: '{}',
  });
}

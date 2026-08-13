// Cliente Mercado Pago via **SDK OFICIAL** (`mercadopago`, Node). Usado pro
// checkout do vitalício (parcelamento até 12x + Pix + boleto nativos, aceita CPF).
// Credencial: MP_ACCESS_TOKEN (Mercado Pago → Desenvolvedores → sua aplicação).
//
// ⚠️ ERA REST CRU (fetch direto na api.mercadopago.com) e isso custava pontos na
// "Qualidade da integração" do painel do MP — o item **SDK do backend** só é
// reconhecido quando as chamadas saem com a assinatura do SDK oficial
// (User-Agent/tracking próprios). Trocar o fetch pelo SDK não muda nenhum campo
// do payload: as MESMAS funções, com as MESMAS assinaturas, continuam expostas.
//
// De brinde o SDK traz retry com backoff (429/5xx) protegido por idempotency key
// — antes, um 500 do MP virava venda perdida na hora.
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

export const VITALICIO_MP = { titulo: 'Sora Premium Vitalício', preco: 97.0, maxParcelas: 12 };

// Tiers do vitalício (valor + plano definidos SEMPRE no servidor pelo tier —
// nunca confiar no valor vindo do cliente).
export const VITALICIO_TIERS: Record<string, { amount: number; plano: string; titulo: string }> = {
  kit:      { amount: 47, plano: 'kit',   titulo: 'Kit Organização Financeira (vitalício)' },
  completa: { amount: 97, plano: 'premium', titulo: 'Sora Completa (vitalício)' },
  // Upgrade kit → completa: só a diferença. Validado no servidor (só quem tem
  // o Kit paga R$50; qualquer outro cai pra Completa cheia).
  upgrade:  { amount: 50, plano: 'premium', titulo: 'Upgrade pra Sora Completa (vitalício)' },
};
export function tierConfig(tier?: string) {
  return VITALICIO_TIERS[tier || 'completa'] || VITALICIO_TIERS.completa;
}

function token(): string {
  return process.env.MP_ACCESS_TOKEN || '';
}

// Credencial de TESTE começa com "TEST-" → usamos o sandbox_init_point.
export function mpIsTest(): boolean {
  return token().startsWith('TEST-');
}

// Config criada SOB DEMANDA (não no import): no build da Vercel a env var pode
// não existir, e instanciar no topo do módulo quebraria o build inteiro.
// ⚠️ `idempotencyKey` NÃO entra aqui — global significaria a MESMA chave em toda
// requisição, e o MP recusaria a 2ª tentativa do cliente como duplicada. Ela vai
// por chamada, no `requestOptions`.
function config(): MercadoPagoConfig {
  return new MercadoPagoConfig({
    accessToken: token(),
    options: { timeout: 15000 },
  });
}

const novaChave = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

// O MP devolve o motivo real da recusa dentro de `causes[]` — e era justamente
// isso que se perdia quando só líamos `message` ("Bad Request" puro não diz nada
// no log nem na tela de recuperação de venda).
function mensagemErro(e: unknown, fallback: string): string {
  if (!e || typeof e !== 'object') return fallback;
  const err = e as { message?: string; error?: string; causes?: unknown[] };
  const detalhe = (Array.isArray(err.causes) ? err.causes : [])
    .map((c) => {
      if (typeof c === 'string') return c;
      const o = c as { description?: string; message?: string; code?: string | number };
      return o?.description || o?.message || (o?.code != null ? String(o.code) : '');
    })
    .filter(Boolean)
    .join('; ');
  const base = err.message || err.error || fallback;
  return detalhe ? `${base} — ${detalhe}` : base;
}

export async function mpCreatePreference(body: Record<string, unknown>) {
  try {
    const pref = await new Preference(config()).create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: body as any,
      requestOptions: { idempotencyKey: novaChave() },
    });
    return pref as unknown as { id: string; init_point: string; sandbox_init_point: string };
  } catch (e) {
    throw new Error(mensagemErro(e, 'Erro ao criar preferência no Mercado Pago'));
  }
}

// Cria um pagamento (Checkout Transparente / Bricks). `body` vem do Payment
// Brick (token, installments, payment_method_id, payer…) + nossos campos.
// `deviceId` = fingerprint do dispositivo (window.MP_DEVICE_SESSION_ID). O
// antifraude do MP pesa MUITO esse sinal: sem ele, recusa como "não passou nos
// controles de segurança" (cc_rejected_high_risk). O SDK manda no header
// X-Meli-Session-Id via `meliSessionId` (antes era header na mão).
export async function mpCreatePayment(body: Record<string, unknown>, deviceId?: string) {
  try {
    const pagamento = await new Payment(config()).create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: body as any,
      requestOptions: {
        idempotencyKey: novaChave(),
        ...(deviceId ? { meliSessionId: deviceId } : {}),
      },
    });
    return pagamento as unknown as {
      id: number;
      status: string;
      status_detail: string;
      point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
    };
  } catch (e) {
    throw new Error(mensagemErro(e, 'Erro ao criar pagamento no Mercado Pago'));
  }
}

export async function mpGetPayment(id: string) {
  try {
    const pagamento = await new Payment(config()).get({ id });
    return pagamento as unknown as {
      id: number;
      status: string;                 // 'approved' | 'pending' | 'rejected' ...
      external_reference?: string;     // supabase_user_id
      transaction_amount?: number;
      metadata?: Record<string, unknown>;
    };
  } catch (e) {
    throw new Error(mensagemErro(e, 'Erro ao buscar pagamento no Mercado Pago'));
  }
}

// Cliente Mercado Pago (REST direto, sem SDK). Usado pro checkout do vitalício
// (parcelamento até 12x + Pix + boleto nativos, aceita CPF).
// Credencial: MP_ACCESS_TOKEN (Mercado Pago → Desenvolvedores → sua aplicação).
const MP_API = 'https://api.mercadopago.com';

export const VITALICIO_MP = { titulo: 'Sora Black Vitalício', preco: 97.0, maxParcelas: 12 };

// Tiers do vitalício (valor + plano definidos SEMPRE no servidor pelo tier —
// nunca confiar no valor vindo do cliente).
export const VITALICIO_TIERS: Record<string, { amount: number; plano: string; titulo: string }> = {
  kit:      { amount: 47, plano: 'kit',   titulo: 'Kit Organização Financeira (vitalício)' },
  completa: { amount: 97, plano: 'black', titulo: 'Sora Completa (vitalício)' },
};
export function tierConfig(tier?: string) {
  return VITALICIO_TIERS[tier === 'kit' ? 'kit' : 'completa'];
}

function token(): string {
  return process.env.MP_ACCESS_TOKEN || '';
}

// Credencial de TESTE começa com "TEST-" → usamos o sandbox_init_point.
export function mpIsTest(): boolean {
  return token().startsWith('TEST-');
}

export async function mpCreatePreference(body: Record<string, unknown>) {
  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Erro ao criar preferência no Mercado Pago');
  return data as { id: string; init_point: string; sandbox_init_point: string };
}

// Cria um pagamento (Checkout Transparente / Bricks). `body` vem do Payment
// Brick (token, installments, payment_method_id, payer…) + nossos campos.
export async function mpCreatePayment(body: Record<string, unknown>) {
  const res = await fetch(`${MP_API}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || data?.error || 'Erro ao criar pagamento no Mercado Pago');
  return data as {
    id: number;
    status: string;
    status_detail: string;
    point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
  };
}

export async function mpGetPayment(id: string) {
  const res = await fetch(`${MP_API}/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Erro ao buscar pagamento no Mercado Pago');
  return data as {
    id: number;
    status: string;                 // 'approved' | 'pending' | 'rejected' ...
    external_reference?: string;     // supabase_user_id
    transaction_amount?: number;
    metadata?: Record<string, unknown>;
  };
}

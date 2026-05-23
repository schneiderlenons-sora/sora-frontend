import Stripe from 'stripe';
import type { Plano } from '@/lib/plans';

// Inicialização lazy via Proxy: a instância só é criada na primeira chamada
// (ex.: stripe.checkout.sessions.create). Isso permite que o build do
// Next.js importe o módulo mesmo sem STRIPE_SECRET_KEY definida — só falha
// se uma rota for de fato executada sem a env var.
let _stripeInstance: Stripe | null = null;

function getStripeInstance(): Stripe {
  if (_stripeInstance) return _stripeInstance;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY ausente — defina nas variáveis de ambiente (Vercel → Settings → Environment Variables).'
    );
  }
  _stripeInstance = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
  return _stripeInstance;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const real = getStripeInstance() as unknown as Record<string | symbol, unknown>;
    const value = real[prop as string];
    // Métodos precisam ficar bindados à instância real para `this` funcionar
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

export type PlanoId = Exclude<Plano, 'inativo'>;
export type Intervalo = 'mensal' | 'anual';

// Price IDs criados no Stripe Dashboard — configurar no .env.local
// Preencher com os IDs reais: Settings → Products → Prices
export const PRICE_IDS: Record<PlanoId, Record<Intervalo, string>> = {
  basico:  {
    mensal: process.env.STRIPE_PRICE_BASICO_MENSAL!,
    anual:  process.env.STRIPE_PRICE_BASICO_ANUAL!,
  },
  premium: {
    mensal: process.env.STRIPE_PRICE_PREMIUM_MENSAL!,
    anual:  process.env.STRIPE_PRICE_PREMIUM_ANUAL!,
  },
  black:   {
    mensal: process.env.STRIPE_PRICE_BLACK_MENSAL!,
    anual:  process.env.STRIPE_PRICE_BLACK_ANUAL!,
  },
};

// Mapeamento inverso: price ID → plano
export function priceIdToPlano(priceId: string): PlanoId | null {
  for (const [plano, intervals] of Object.entries(PRICE_IDS)) {
    if (Object.values(intervals).includes(priceId)) return plano as PlanoId;
  }
  return null;
}

export function priceIdToIntervalo(priceId: string): Intervalo | null {
  for (const [, intervals] of Object.entries(PRICE_IDS)) {
    for (const [intervalo, id] of Object.entries(intervals)) {
      if (id === priceId) return intervalo as Intervalo;
    }
  }
  return null;
}

// Preços de exibição (client-side, sem price IDs)
export const PLANOS_INFO: Record<PlanoId, { mensal: number; anual: number; descAnual: number }> = {
  basico:  { mensal: 19.90, anual: 17.51, descAnual: 12 },
  premium: { mensal: 29.90, anual: 23.92, descAnual: 20 },
  black:   { mensal: 79.90, anual: 47.94, descAnual: 40 },
};

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

// 'kit' e 'inativo' não são planos de assinatura Stripe (kit é vitalício via MP).
export type PlanoId = Exclude<Plano, 'inativo' | 'kit'>;
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
  // ⚠️ Os Price IDs do Platinum vêm CRAVADOS como padrão, ao contrário dos
  // outros. Os planos antigos já tinham env var na Vercel; este nasceu
  // agora, e sem o fallback o checkout responderia 400 ("plano inválido")
  // no minuto seguinte ao deploy, até alguém lembrar de cadastrar a env.
  // A env continua vencendo, pra trocar de preço sem deploy.
  platinum: {
    mensal: process.env.STRIPE_PRICE_PLATINUM_MENSAL || 'price_1U93pyQlbb8xkB6tzMS3cVqo',
    anual:  process.env.STRIPE_PRICE_PLATINUM_ANUAL  || 'price_1U93pyQlbb8xkB6t91qNeNTq',
  },
};

// ── Conexão de Open Finance (add-on, cobrada por unidade) ───────────────────
//
// Preço COM QUANTIDADE (licensed, não metered): R$ 6/mês ou R$ 60/ano por banco
// conectado. A quantidade é o número de conexões PAGAS — a franquia do plano
// (Básico 1, Premium 3, vitalício 0) fica no nosso código, nunca no preço do
// Stripe: ela muda por plano, e embutir isso aqui exigiria um preço por plano.
export const PRICE_CONEXAO_OF: Record<Intervalo, string> = {
  mensal: process.env.STRIPE_PRICE_CONEXAO_OF_MENSAL!,
  anual:  process.env.STRIPE_PRICE_CONEXAO_OF_ANUAL!,
};

/** O price é do add-on de conexão? (o webhook usa pra não confundir com plano) */
export function ehPriceConexaoOf(priceId?: string | null): boolean {
  if (!priceId) return false;
  return Object.values(PRICE_CONEXAO_OF).filter(Boolean).includes(priceId);
}

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
  platinum: { mensal: 49.90, anual: 39.92, descAnual: 20 }, // R$479/ano ÷ 12
};

// ── VITALÍCIO (pagamento único) ──────────────────────────────────────────────
// O pagamento é via Mercado Pago (app/api/mercadopago/*). Aqui ficam só os
// dados de exibição/escassez usados pelo /api/vitalicio/count.
export const VITALICIO = {
  plano:   'premium' as PlanoId, // o que libera
  preco:   97.00,                // exibição
  // "Vagas de fundador" — gatilho de escassez. Total de 300 vagas, partindo de
  // uma base de 259 já ocupadas → exibe "Restam 41 de 300" no lançamento (barra
  // quase cheia). A contagem real de vendidos (do banco) soma a essa base.
  vagas:           300,
  vagasOcupadasBase: 259,
};

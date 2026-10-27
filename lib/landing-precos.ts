// Preços de EXIBIÇÃO da landing por locale. Semente do futuro lib/i18n.ts
// (formatador central de moeda). PT usa os valores em BRL do lib/stripe.ts;
// ES-MX usa os valores em MXN definidos pra o lançamento no México.
//
// ⚠️ No /es o checkout MXN ainda NÃO existe — estes preços são só vitrine
// (o CTA vira lista de espera). Quando a fase de pagamento criar os Price IDs
// em MXN no Stripe, ligar o checkout de verdade.

export type PlanoLandingId = 'basico' | 'premium' | 'platinum';

export interface PlanoPreco {
  mensal: number;
  anual: number;      // valor POR MÊS quando pago anualmente
  // TOTAL cobrado no ano — o número do Price do Stripe, NÃO anual × 12:
  // o Platinum custa R$ 479,00 e 12 × 39,92 daria 479,04 (conferido na API
  // LIVE do Stripe em 27/10/2026: 210,12 · 287,04 · 479,00).
  totalAnual: number;
  descAnual: number;  // % de desconto no anual
}

export interface PrecoLocale {
  currency: string;   // ISO 4217
  simbolo: string;    // símbolo exibido
  separadorDecimal: ',' | '.';
  planos: Record<PlanoLandingId, PlanoPreco>;
}

export const PRECOS_LANDING: Record<'pt' | 'es', PrecoLocale> = {
  pt: {
    currency: 'BRL',
    simbolo: 'R$',
    separadorDecimal: ',',
    planos: {
      basico:   { mensal: 19.90, anual: 17.51, totalAnual: 210.12, descAnual: 12 },
      premium:  { mensal: 29.90, anual: 23.92, totalAnual: 287.04, descAnual: 20 },
      // R$479/ano ÷ 12 = 39,92 (20% off sobre 12×49,90 = 598,80).
      platinum: { mensal: 49.90, anual: 39.92, totalAnual: 479.00, descAnual: 20 },
    },
  },
  es: {
    currency: 'MXN',
    simbolo: '$',
    separadorDecimal: '.',
    planos: {
      basico:   { mensal: 99,  anual: 84,  totalAnual: 1008, descAnual: 15 },
      premium:  { mensal: 149, anual: 112, totalAnual: 1344, descAnual: 25 },
      // Mesma proporção dos outros (×~5 sobre o BRL). ⚠ Vitrine: o checkout MXN
      // ainda não existe, o CTA no /es é lista de espera.
      platinum: { mensal: 249, anual: 187, totalAnual: 2244, descAnual: 25 },
    },
  },
};

export function precosDoLocale(locale: string): PrecoLocale {
  return locale === 'es' ? PRECOS_LANDING.es : PRECOS_LANDING.pt;
}

// Divide um valor em parte inteira e decimal, respeitando o separador do locale.
// Decimais só aparecem se forem diferentes de zero (BRL 19,90 → "90"; MXN 99 → '').
export function partesPreco(valor: number, sep: ',' | '.'): { inteiro: string; decimal: string } {
  const inteiro = Math.floor(valor).toString();
  const cents = Math.round((valor % 1) * 100);
  const decimal = cents === 0 ? '' : `${sep}${cents.toString().padStart(2, '0')}`;
  return { inteiro, decimal };
}

// Valor cheio com símbolo, no formato do locale (R$ 287,04 · $1,344).
export function precoCheio(valor: number, p: PrecoLocale): string {
  const n = new Intl.NumberFormat(p.separadorDecimal === ',' ? 'pt-BR' : 'es-MX', {
    minimumFractionDigits: p.separadorDecimal === ',' ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(valor);
  return p.separadorDecimal === ',' ? `${p.simbolo} ${n}` : `${p.simbolo}${n}`;
}

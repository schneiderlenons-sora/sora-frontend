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
      basico:   { mensal: 19.90, anual: 17.51, descAnual: 12 },
      premium:  { mensal: 29.90, anual: 23.92, descAnual: 20 },
      // R$479/ano ÷ 12 = 39,92 (20% off sobre 12×49,90 = 598,80).
      platinum: { mensal: 49.90, anual: 39.92, descAnual: 20 },
    },
  },
  es: {
    currency: 'MXN',
    simbolo: '$',
    separadorDecimal: '.',
    planos: {
      basico:   { mensal: 99,  anual: 84,  descAnual: 15 },
      premium:  { mensal: 149, anual: 112, descAnual: 25 },
      // Mesma proporção dos outros (×~5 sobre o BRL). ⚠ Vitrine: o checkout MXN
      // ainda não existe, o CTA no /es é lista de espera.
      platinum: { mensal: 249, anual: 187, descAnual: 25 },
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

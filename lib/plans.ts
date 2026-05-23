// ─────────────────────────────────────────────────────────────────────────────
// Catálogo central de planos × features.
// Fonte única da verdade pros gates de acesso no app.
// Quando o Stripe entrar, o webhook só atualiza `users.plano` no Supabase —
// nada aqui precisa mudar.
// ─────────────────────────────────────────────────────────────────────────────

export type Plano = 'inativo' | 'basico' | 'premium' | 'black';

// Features que podem ser gated. Todas explicitamente nomeadas pra evitar
// strings mágicas espalhadas pelo código.
export type Feature =
  | 'contas_ilimitadas'      // Premium+: contas/cartões sem limite
  | 'cartoes_ilimitados'
  | 'investimentos'          // Premium+: aba Investimentos (era Black-only)
  | 'negocios'               // Black: aba Negócios (DRE, vendas, etc.)
  | 'sora_grow'              // Premium+: acesso direto ao Sora Grow
  | 'sora_grow_trial'        // Básico: pode ativar 7 dias grátis
  | 'compartilhamento'       // Premium+: grupos casal/família
  | 'import_ofx'             // Premium+: importação de extrato OFX
  | 'import_csv'             // Premium+: importação CSV
  | 'export_dados'           // Premium+: exportar transações em CSV
  | 'ocr_imagem'             // Premium+: enviar foto de comprovante
  // Features disponíveis em todos os planos pagos (e inativo p/ onboarding):
  | 'metas'
  | 'dividas'
  | 'limites'
  | 'subcategorias'
  | 'lembretes';

// Quais planos têm acesso a cada feature.
// "inativo" entra explicitamente quando faz sentido (ex.: onboarding antes de
// pagar). Para features pagas, manter inativo fora.
const FEATURES: Record<Feature, ReadonlyArray<Plano>> = {
  contas_ilimitadas:  ['premium', 'black'],
  cartoes_ilimitados: ['premium', 'black'],
  investimentos:      ['premium', 'black'],
  negocios:           ['black'],
  sora_grow:          ['premium', 'black'],
  sora_grow_trial:    ['basico', 'inativo'],
  compartilhamento:   ['premium', 'black'],
  import_ofx:         ['premium', 'black'],
  import_csv:         ['premium', 'black'],
  export_dados:       ['premium', 'black'],
  ocr_imagem:         ['premium', 'black'],
  metas:              ['inativo', 'basico', 'premium', 'black'],
  dividas:            ['inativo', 'basico', 'premium', 'black'],
  limites:            ['inativo', 'basico', 'premium', 'black'],
  subcategorias:      ['inativo', 'basico', 'premium', 'black'],
  lembretes:          ['inativo', 'basico', 'premium', 'black'],
};

// Limites quantitativos por plano (use Number.POSITIVE_INFINITY pra "ilimitado").
export const LIMITES = {
  contas:  { inativo: 3, basico: 3, premium: Infinity, black: Infinity },
  cartoes: { inativo: 3, basico: 3, premium: Infinity, black: Infinity },
} as const satisfies Record<string, Record<Plano, number>>;

export type Recurso = keyof typeof LIMITES;

// ─── Helpers ────────────────────────────────────────────────────────────────

export function podeUsar(plano: Plano | null | undefined, feature: Feature): boolean {
  if (!plano) return false;
  return FEATURES[feature].includes(plano);
}

export function limiteDe(plano: Plano | null | undefined, recurso: Recurso): number {
  return LIMITES[recurso][plano || 'inativo'];
}

// Plano mínimo recomendado pra uma feature — usado nos paywalls pra orientar
// o upgrade certo (ex.: "Disponível no plano Premium").
export function planoMinimo(feature: Feature): Plano {
  const planos = FEATURES[feature];
  if (planos.includes('basico')) return 'basico';
  if (planos.includes('premium')) return 'premium';
  return 'black';
}

export const PLANO_LABEL: Record<Plano, string> = {
  inativo: 'Inativo',
  basico:  'Básico',
  premium: 'Premium',
  black:   'Black',
};

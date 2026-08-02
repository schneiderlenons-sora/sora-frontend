// ─────────────────────────────────────────────────────────────────────────────
// Catálogo central de planos × features.
// Fonte única da verdade pros gates de acesso no app.
// Quando o Stripe entrar, o webhook só atualiza `users.plano` no Supabase —
// nada aqui precisa mudar.
// ─────────────────────────────────────────────────────────────────────────────

// 'kit' = Kit de Organização Financeira (vitalício R$47): finanças + calculadoras,
// SEM WhatsApp, Grow, Negócios, Open Finance, OCR e painel do casal.
export type Plano = 'inativo' | 'basico' | 'kit' | 'premium' | 'black';

// Features que podem ser gated. Todas explicitamente nomeadas pra evitar
// strings mágicas espalhadas pelo código.
export type Feature =
  | 'contas_ilimitadas'      // Premium+: contas/cartões sem limite
  | 'cartoes_ilimitados'
  | 'investimentos'          // Premium+: aba Investimentos (era Black-only)
  | 'negocios'               // Premium+: aba Negócios (DRE, vendas, etc.) — antes Black-only
  | 'sora_grow'              // Todos os planos: acesso base ao Sora Grow
                             // (hábitos, tarefas, bem-estar, agenda)
  | 'grow_saude'             // Premium+: aba Saúde do Grow
  | 'grow_estudos'           // Premium+: aba Estudos do Grow
  | 'grow_casa'              // Premium+: aba Casa inteira (compras, despensa, receitas, manutenções)
  | 'grow_colecoes'          // Premium+: Coleções (Viagens, Filmes & Séries, Leituras)
  | 'grow_despensa'          // Premium+: Casa avançada (despensa, receitas, manutenções)
  | 'sora_grow_trial'        // (legado) Básico: trial — descontinuado, todos já têm Grow
  | 'compartilhamento'       // Premium+: grupos casal/família
  | 'open_finance'           // Premium+: conexão automática com bancos (Pluggy)
  | 'import_ofx'             // Premium+: importação de extrato OFX
  | 'import_csv'             // Premium+: importação CSV
  | 'export_dados'           // Premium+: exportar transações em CSV
  | 'ocr_imagem'             // Premium+: enviar foto de comprovante
  | 'drive'                  // Premium+: Drive — guardar/buscar arquivos pelo WhatsApp
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
  contas_ilimitadas:  ['kit', 'premium', 'black'],
  cartoes_ilimitados: ['kit', 'premium', 'black'],
  investimentos:      ['kit', 'premium', 'black'], // Kit inclui as calculadoras de investimento/reserva
  negocios:           ['premium', 'black'], // Negócios agora entra no Premium (Black descontinuado)
  sora_grow:          ['basico', 'premium', 'black'], // Grow NÃO entra no kit
  grow_saude:         ['premium', 'black'],
  grow_estudos:       ['premium', 'black'],
  grow_casa:          ['premium', 'black'],
  grow_colecoes:      ['premium', 'black'],
  grow_despensa:      ['premium', 'black'],
  sora_grow_trial:    [], // descontinuado
  compartilhamento:   ['premium', 'black'],   // painel do casal — só na Completa
  // Open Finance entra no Básico também, mas com 1 conexão só (ver LIMITES).
  // ⚠️ Ter a feature não basta: é só pra assinatura RECORRENTE — o vitalício
  // ficou de fora porque cada conexão tem custo MENSAL do agregador e o
  // vitalício não gera receita recorrente. Quem decide é `temOpenFinance()`.
  open_finance:       ['basico', 'premium', 'black'],
  import_ofx:         ['kit', 'premium', 'black'],
  import_csv:         ['kit', 'premium', 'black'],
  export_dados:       ['kit', 'premium', 'black'],
  ocr_imagem:         ['premium', 'black'],    // foto de nota — só na Completa
  drive:              ['premium', 'black'],    // Drive por WhatsApp — só na Completa
  metas:              ['inativo', 'basico', 'kit', 'premium', 'black'],
  dividas:            ['inativo', 'basico', 'kit', 'premium', 'black'],
  limites:            ['inativo', 'basico', 'kit', 'premium', 'black'],
  subcategorias:      ['inativo', 'basico', 'kit', 'premium', 'black'],
  lembretes:          ['inativo', 'basico', 'kit', 'premium', 'black'],
};

// Limites quantitativos por plano (use Number.POSITIVE_INFINITY pra "ilimitado").
export const LIMITES = {
  contas:  { inativo: 3, basico: 3, kit: Infinity, premium: Infinity, black: Infinity },
  cartoes: { inativo: 3, basico: 3, kit: Infinity, premium: Infinity, black: Infinity },
  // ⚠️ CONEXÃO de banco (Open Finance) ≠ CONTA. Conta criada à mão continua
  // ilimitada no Premium; o que é limitado é o vínculo automático com o banco,
  // porque cada um custa mensalidade nossa no agregador.
  // Acima do limite: +R$5/mês por conexão extra — a COBRANÇA ainda não existe,
  // então hoje o painel apenas bloqueia e oferece o upgrade.
  conexoes_of: { inativo: 0, basico: 1, kit: 0, premium: 3, black: 3 },
} as const satisfies Record<string, Record<Plano, number>>;

/** Preço da conexão de Open Finance além do limite do plano (ainda não cobrado). */
export const PRECO_CONEXAO_EXTRA = 5;

export type Recurso = keyof typeof LIMITES;

// ─── Helpers ────────────────────────────────────────────────────────────────

export function podeUsar(plano: Plano | null | undefined, feature: Feature): boolean {
  if (!plano) return false;
  return FEATURES[feature].includes(plano);
}

export function limiteDe(plano: Plano | null | undefined, recurso: Recurso): number {
  return LIMITES[recurso][plano || 'inativo'];
}

/**
 * Open Finance liberado? Só pra assinatura RECORRENTE.
 *
 * Ter o plano na feature não basta: o vitalício pagou uma vez e cada conexão de
 * banco nos custa mensalidade no agregador, então ele fica de fora por ora
 * (mesmo com `plano='premium'`, que é o caso de 29 contas da base).
 *
 * Fonte única — front (aba, avisos) e back (rotas) decidem por aqui, senão a
 * tela libera algo que a API recusa.
 */
export function temOpenFinance(
  plano: Plano | null | undefined,
  opts?: { vitalicio?: boolean | null; conexoesPagas?: number | null },
): boolean {
  // Conexão avulsa (R$6/mês) libera o recurso pra QUALQUER caso — inclusive o
  // vitalício, que não tem franquia. É o que ele está pagando.
  if ((opts?.conexoesPagas || 0) > 0) return true;
  if (opts?.vitalicio) return false;
  return podeUsar(plano, 'open_finance');
}

/**
 * Quantas conexões este usuário pode ter: franquia do plano + as que ele paga.
 * Vitalício não tem franquia — só o que contratar.
 * Espelha `acessoOpenFinance` do backend (config/openFinanceAccess.js).
 */
export function limiteConexoesOf(
  plano: Plano | null | undefined,
  opts?: { vitalicio?: boolean | null; conexoesPagas?: number | null },
): number {
  const pagas = Math.max(0, opts?.conexoesPagas || 0);
  if (opts?.vitalicio) return pagas;
  return limiteDe(plano, 'conexoes_of') + pagas;
}

// Plano mínimo recomendado pra uma feature — usado nos paywalls pra orientar
// o upgrade certo (ex.: "Disponível no plano Premium").
export function planoMinimo(feature: Feature): Plano {
  const planos = FEATURES[feature];
  if (planos.includes('basico')) return 'basico';
  return 'premium';
}

export const PLANO_LABEL: Record<Plano, string> = {
  inativo: 'Inativo',
  basico:  'Básico',
  kit:     'Kit',
  premium: 'Premium',
  black:   'Black',
};

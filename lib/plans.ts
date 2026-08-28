// ─────────────────────────────────────────────────────────────────────────────
// Catálogo central de planos × features.
// Fonte única da verdade pros gates de acesso no app.
// O webhook do Stripe só atualiza `users.plano` no Supabase — nada aqui muda.
// ─────────────────────────────────────────────────────────────────────────────

// 'kit'      = Kit de Organização Financeira (vitalício R$47): finanças +
//              calculadoras, SEM WhatsApp, Grow, Negócios, Open Finance e OCR.
// 'platinum' = tudo do Premium + aba Negócios + 5 conexões de Open Finance
//              + suporte prioritário (R$49,90/mês · R$479/ano).
//
// ⚠️ 'black' NÃO EXISTE MAIS (migration 142). Era idêntico ao Premium desde
// 2026 e sobrevivia só como string espalhada pelo código. As linhas da base
// foram convertidas; `normalizarPlano` abaixo cobre qualquer resquício.
export type Plano = 'inativo' | 'basico' | 'kit' | 'premium' | 'platinum';

// Features que podem ser gated. Todas explicitamente nomeadas pra evitar
// strings mágicas espalhadas pelo código.
export type Feature =
  | 'contas_ilimitadas'      // Premium+: contas/cartões sem limite
  | 'cartoes_ilimitados'
  | 'investimentos'          // Premium+: aba Investimentos
  | 'negocios'               // ⚠️ PLATINUM: aba Negócios (DRE, vendas, estoque).
                             // Não use `podeUsar(plano,'negocios')` direto —
                             // use `temNegocios()`, que respeita quem já tinha.
  | 'sora_grow'              // Todos os planos: acesso base ao Sora Grow
                             // (hábitos, tarefas, bem-estar, agenda)
  | 'grow_saude'             // Premium+: aba Saúde do Grow
  | 'grow_estudos'           // Premium+: aba Estudos do Grow
  | 'grow_casa'              // Premium+: aba Casa inteira (compras, despensa, receitas, manutenções)
  | 'grow_colecoes'          // Premium+: Coleções (Viagens, Filmes & Séries, Leituras)
  | 'grow_despensa'          // Premium+: Casa avançada (despensa, receitas, manutenções)
  | 'sora_grow_trial'        // (legado) Básico: trial — descontinuado, todos já têm Grow
  | 'compartilhamento'       // Premium+: grupos casal/família
  | 'open_finance'           // Premium+: conexão automática com bancos
  | 'import_ofx'             // Premium+: importação de extrato OFX
  | 'import_csv'             // Premium+: importação CSV
  | 'export_dados'           // Premium+: exportar transações em CSV
  | 'ocr_imagem'             // Premium+: enviar foto de comprovante
  | 'drive'                  // Premium+: Drive — guardar/buscar arquivos pelo WhatsApp
  | 'suporte_prioritario'    // Platinum: fila de atendimento própria
  // Features disponíveis em todos os planos pagos (e inativo p/ onboarding):
  | 'metas'
  | 'dividas'
  | 'limites'
  | 'subcategorias'
  | 'lembretes';

// Quais planos têm acesso a cada feature.
// "inativo" entra explicitamente quando faz sentido (ex.: onboarding antes de
// pagar). Para features pagas, manter inativo fora.
//
// ⚠️ Platinum é SUPERCONJUNTO do Premium: toda linha que tem 'premium' tem de
// ter 'platinum' junto. A única exceção proposital é `negocios`, que subiu.
const FEATURES: Record<Feature, ReadonlyArray<Plano>> = {
  contas_ilimitadas:  ['kit', 'premium', 'platinum'],
  cartoes_ilimitados: ['kit', 'premium', 'platinum'],
  investimentos:      ['kit', 'premium', 'platinum'], // Kit inclui as calculadoras de investimento/reserva
  negocios:           ['platinum'],                   // ⚠️ saiu do Premium — ver temNegocios()
  sora_grow:          ['basico', 'premium', 'platinum'], // Grow NÃO entra no kit
  grow_saude:         ['premium', 'platinum'],
  grow_estudos:       ['premium', 'platinum'],
  grow_casa:          ['premium', 'platinum'],
  grow_colecoes:      ['premium', 'platinum'],
  grow_despensa:      ['premium', 'platinum'],
  sora_grow_trial:    [], // descontinuado
  compartilhamento:   ['premium', 'platinum'],   // painel do casal
  // Open Finance entra no Básico também, mas com 1 conexão só (ver LIMITES).
  // ⚠️ Ter a feature não basta: é só pra assinatura RECORRENTE — o vitalício
  // ficou de fora porque cada conexão tem custo MENSAL do agregador e o
  // vitalício não gera receita recorrente. Quem decide é `temOpenFinance()`.
  open_finance:       ['basico', 'premium', 'platinum'],
  import_ofx:         ['kit', 'premium', 'platinum'],
  import_csv:         ['kit', 'premium', 'platinum'],
  export_dados:       ['kit', 'premium', 'platinum'],
  ocr_imagem:         ['premium', 'platinum'],   // foto de nota
  drive:              ['premium', 'platinum'],   // Drive por WhatsApp
  suporte_prioritario: ['platinum'],
  metas:              ['inativo', 'basico', 'kit', 'premium', 'platinum'],
  dividas:            ['inativo', 'basico', 'kit', 'premium', 'platinum'],
  limites:            ['inativo', 'basico', 'kit', 'premium', 'platinum'],
  subcategorias:      ['inativo', 'basico', 'kit', 'premium', 'platinum'],
  lembretes:          ['inativo', 'basico', 'kit', 'premium', 'platinum'],
};

// Limites quantitativos por plano (use Number.POSITIVE_INFINITY pra "ilimitado").
export const LIMITES = {
  contas:  { inativo: 3, basico: 3, kit: Infinity, premium: Infinity, platinum: Infinity },
  cartoes: { inativo: 3, basico: 3, kit: Infinity, premium: Infinity, platinum: Infinity },
  // ⚠️ CONEXÃO de banco (Open Finance) ≠ CONTA. Conta criada à mão continua
  // ilimitada no Premium; o que é limitado é o vínculo automático com o banco,
  // porque cada um custa mensalidade nossa no agregador.
  // Acima do limite: +R$6/mês por conexão extra (add-on real no Stripe).
  conexoes_of: { inativo: 0, basico: 1, kit: 0, premium: 3, platinum: 5 },
} as const satisfies Record<string, Record<Plano, number>>;

// Preço da conexão extra de Open Finance: R$6/mês ou R$60/ano, cobrado de
// verdade via Stripe (add-on separado do plano — `/api/stripe/conexao-of`).
// O valor mora só no texto de `ContratarConexao` (app/open-finance/page.tsx);
// não há constante aqui pra não ter dois lugares pra desalinhar o preço.

export type Recurso = keyof typeof LIMITES;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normaliza o plano lido do banco.
 *
 * ⚠️ REDE DE SEGURANÇA DO BLACK. A migration 142 converteu as linhas, mas se
 * uma escapar (restore de backup, escrita manual no Supabase, webhook antigo)
 * o valor cairia fora do `Plano` e TODO `podeUsar` devolveria false — o
 * usuário abriria o painel sem nada. Black sempre foi equivalente ao Premium,
 * então é pra lá que ele volta.
 */
export function normalizarPlano(plano: string | null | undefined): Plano {
  if (plano === 'black') return 'premium';
  const validos: Plano[] = ['inativo', 'basico', 'kit', 'premium', 'platinum'];
  return validos.includes(plano as Plano) ? (plano as Plano) : 'inativo';
}

export function podeUsar(plano: Plano | null | undefined, feature: Feature): boolean {
  if (!plano) return false;
  return FEATURES[feature].includes(normalizarPlano(plano));
}

export function limiteDe(plano: Plano | null | undefined, recurso: Recurso): number {
  return LIMITES[recurso][normalizarPlano(plano)];
}

/**
 * Aba Negócios liberada?
 *
 * ⚠️ FONTE ÚNICA — front e back decidem por aqui (o backend espelha em
 * `src/config/planos.js`). Nunca chame `podeUsar(plano, 'negocios')` direto:
 * ele responde só pelo plano e ignoraria as duas exceções abaixo, tirando a
 * aba de quem já a usa.
 *
 * Três portas de entrada:
 *  1. `negocios_liberado` — quem JÁ TINHA acesso quando a aba saiu do Premium
 *     (migration 142). Direito adquirido, nunca revogado.
 *  2. Vitalício da COMPLETA — decisão do dono: quem compra o vitalício leva
 *     Negócios junto "por enquanto". Vale pra compras NOVAS também, por isso é
 *     regra e não backfill.
 *     ⚠️ O KIT (R$47) FICA DE FORA. Ele também é vitalício, mas é o tier
 *     reduzido — sem WhatsApp, Grow, Open Finance e OCR — e Negócios é
 *     justamente o que o Platinum vende. Sem esta ressalva, 2 compradores de
 *     Kit ganhariam a aba de graça (medido antes de escrever a regra).
 *  3. Plano Platinum.
 */
export function temNegocios(
  plano: Plano | null | undefined,
  opts?: { vitalicio?: boolean | null; negociosLiberado?: boolean | null },
): boolean {
  if (opts?.negociosLiberado) return true;
  if (opts?.vitalicio && normalizarPlano(plano) !== 'kit') return true;
  return podeUsar(plano, 'negocios');
}

/**
 * Open Finance liberado? Só pra assinatura RECORRENTE.
 *
 * Ter o plano na feature não basta: o vitalício pagou uma vez e cada conexão de
 * banco nos custa mensalidade no agregador, então ele fica de fora por ora.
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
  if (planos.includes('premium')) return 'premium';
  return 'platinum';
}

export const PLANO_LABEL: Record<Plano, string> = {
  inativo:  'Inativo',
  basico:   'Básico',
  kit:      'Kit',
  premium:  'Premium',
  platinum: 'Platinum',
};

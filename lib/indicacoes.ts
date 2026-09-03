import { supabaseAdmin } from '@/lib/supabase-admin';
import { stripe, PLANOS_INFO, type PlanoId } from '@/lib/stripe';

// =============================================================================
// INDIQUE E GANHE — as regras de dinheiro.
//
// Cada indicação válida vale UM MÊS de assinatura pro indicador. Por isso tudo
// que decide se uma indicação vale mora aqui e no banco (migration 153), nunca
// só na tela: validação de frontend está a um pedido HTTP de virar mês grátis
// infinito.
//
// ⚠️ O MÊS GRÁTIS É UM CRÉDITO NO STRIPE, NÃO UM CAMPO NO BANCO.
//
// A tentação é estender `users.plano_valido_ate`. Não funciona, e falha do pior
// jeito possível — em silêncio:
//   · essa coluna é ESPELHO do Stripe. O webhook a reescreve com o
//     `current_period_end` a cada `customer.subscription.updated`, então a
//     extensão sumiria sozinha em dias;
//   · e ela não conversa com a cobrança. O Stripe cobraria igual, e o usuário
//     veria "1 mês grátis" na tela E a fatura no cartão.
//
// Crédito no saldo do cliente (`customer.balance` negativo) resolve os dois: o
// Stripe abate sozinho da próxima fatura, vale pra mensal e pra anual, aparece
// no histórico do cliente e dá pra estornar.
// =============================================================================

/** Teto de indicações que geram crédito, por indicador. */
export const MAX_INDICACOES = 3;

/** Janela pra o convidado colar o código depois de criar a conta. */
export const DIAS_PARA_USAR = 7;

// ── Código ───────────────────────────────────────────────────────────────────

// Sem I, O, 0 e 1: o código é lido em voz alta e digitado à mão, e esses quatro
// são os que as pessoas erram.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function sufixoAleatorio(n = 4) {
  let s = '';
  for (let i = 0; i < n; i++) s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return s;
}

/** "Schneider Lenon" → "SCHN". Sem nome utilizável, cai em "SORA". */
function prefixoDoNome(nome?: string | null) {
  const limpo = String(nome || '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toUpperCase().replace(/[^A-Z]/g, '');
  return limpo.slice(0, 4).padEnd(4, 'X') || 'SORA';
}

export function normalizarCodigo(codigo: string) {
  return String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Formata pra exibição: "SCHNTVN6" → "SCHN-TVN6". */
export function formatarCodigo(codigo: string) {
  const c = normalizarCodigo(codigo);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/**
 * Devolve o código do usuário, criando na primeira vez.
 *
 * ⚠️ Tenta de novo em colisão. O sufixo é aleatório e o índice é único, então
 * duas pessoas com o mesmo prefixo PODEM colidir — raro, mas com 32^4 sufixos e
 * milhares de usuários é questão de tempo. Sem o retry, a aba abriria com erro.
 */
export async function obterOuCriarCodigo(userId: string, nome?: string | null): Promise<string | null> {
  const { data: u } = await supabaseAdmin
    .from('users').select('codigo_indicacao, name').eq('id', userId).maybeSingle();
  if (u?.codigo_indicacao) return u.codigo_indicacao;

  const prefixo = prefixoDoNome(nome ?? u?.name);
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const codigo = prefixo + sufixoAleatorio();
    const { error } = await supabaseAdmin
      .from('users').update({ codigo_indicacao: codigo }).eq('id', userId);
    if (!error) return codigo;
    // 23505 = unique_violation → sufixo novo. Outro erro é problema de verdade.
    if (!String(error.code || '').includes('23505')) {
      console.error('[indicacoes] não consegui gravar o código:', error.message);
      return null;
    }
  }
  return null;
}

// ── Elegibilidade ────────────────────────────────────────────────────────────

export type Perfil = {
  id: string;
  plano?: string | null;
  vitalicio?: boolean | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  plano_intervalo?: string | null;
  email?: string | null;
  created_at?: string | null;
};

/**
 * Quem pode INDICAR e receber o mês.
 *
 * ⚠️ Vitalício fica de fora POR DECISÃO (03/09/2026), e a tela diz isso na cara
 * em vez de esconder o botão: ele não tem mensalidade pra descontar, então um
 * "mês grátis" não teria onde ser aplicado. Prometer e não entregar é pior do
 * que dizer que não se aplica — e ele é justamente quem mais indica, então a
 * aba oferece o programa de Afiliado no lugar, onde ele ganha dinheiro.
 */
export function motivoNaoPodeIndicar(p: Perfil | null): string | null {
  if (!p) return 'Não consegui carregar sua conta.';
  if (p.vitalicio) return 'vitalicio';
  if (!p.stripe_subscription_id) return 'sem_assinatura';
  return null;
}

/**
 * Quem pode USAR um código (o amigo convidado).
 *
 * ⚠️ Ele precisa TER ASSINADO — é o que a regra do programa promete ("o mês
 * nasce quando ele assina, não no cadastro"). Sem isso, bastaria criar contas
 * grátis pra gerar meses.
 */
export function motivoNaoPodeUsar(p: Perfil | null): string | null {
  if (!p) return 'Não consegui carregar sua conta.';
  if (!p.stripe_subscription_id && !p.vitalicio) {
    return 'Você precisa ter uma assinatura ativa pra usar um código de convite.';
  }
  // ⚠️ E-mail com "+" é o truque clássico de criar N contas na mesma caixa.
  // Está escrito nas regras da tela, então bloquear aqui não surpreende ninguém.
  if (String(p.email || '').split('@')[0].includes('+')) {
    return 'Use seu e-mail principal — endereços com "+" não valem no programa.';
  }
  if (p.created_at) {
    const dias = (Date.now() - new Date(p.created_at).getTime()) / 86400000;
    if (dias > DIAS_PARA_USAR) {
      return `O código vale até ${DIAS_PARA_USAR} dias depois de criar a conta, e a sua tem mais que isso.`;
    }
  }
  return null;
}

// ── O crédito ────────────────────────────────────────────────────────────────

/** Quanto vale um mês pro plano/intervalo de quem indicou (em reais). */
export function valorDoMes(plano?: string | null, intervalo?: string | null): number {
  const p = (plano === 'black' ? 'premium' : plano) as PlanoId;
  const info = PLANOS_INFO[p] || PLANOS_INFO.premium;
  // No anual o "mês" é o preço mensal equivalente — creditar a mensalidade
  // cheia daria mais do que um mês da assinatura que ele realmente paga.
  return intervalo === 'anual' ? info.anual : info.mensal;
}

/**
 * Lança o crédito de 1 mês no saldo do cliente no Stripe.
 *
 * Devolve `{ ok, id, valor }`. Quem chama DEVE checar `ok`: se o crédito não
 * entrou, a indicação não pode ser marcada como creditada — senão o mês some
 * sem ninguém notar (é a família de bug do `await` sem ler o erro que já
 * apareceu duas vezes neste projeto).
 */
export async function creditarMes(p: Perfil): Promise<{ ok: boolean; id?: string; valor?: number; erro?: string }> {
  if (!p.stripe_customer_id) return { ok: false, erro: 'Usuário sem cliente no Stripe.' };
  const valor = valorDoMes(p.plano, p.plano_intervalo);
  try {
    // ⚠️ Valor NEGATIVO e em CENTAVOS. No Stripe, saldo negativo é crédito a
    // favor do cliente; positivo seria DÍVIDA — o sinal trocado cobraria um mês
    // a mais em vez de dar um de graça.
    const tx = await stripe.customers.createBalanceTransaction(p.stripe_customer_id, {
      amount: -Math.round(valor * 100),
      currency: 'brl',
      description: 'Indique e ganhe — 1 mês por amigo que assinou',
    });
    return { ok: true, id: tx.id, valor };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[indicacoes] crédito no Stripe falhou:', msg);
    return { ok: false, erro: msg };
  }
}

// =============================================================================
// VITALÍCIO × ASSINATURA DO STRIPE — quem manda no plano da conta.
//
// Caso real (nov/2026): assinante Premium mensal comprou o vitalício (Mercado
// Pago) em 20/08. Nada cancelou a assinatura no Stripe, que seguiu cobrando
// R$ 29,90 todo mês. Depois disso o `/api/stripe/sync` regravou o plano a
// partir dessa assinatura ANTIGA, com "válido até" = fim do período dela; quando
// a data passou, o `exigirPlano` do backend expirou a conta para `inativo`. O
// cliente pagava o vitalício E a mensalidade, e estava sem acesso.
//
// Duas regras, aqui como funções puras (`eval:assinatura-vitalicio`):
//
// 1. Uma assinatura só define o plano de uma conta vitalícia se nasceu DEPOIS
//    do vitalício — é a pessoa trocando o vitalício pela assinatura, de
//    propósito (o caminho da /planos, com confirmação). Assinatura de ANTES do
//    vitalício é a que sobrou da compra: não manda no plano. Sem a data do
//    vitalício, na dúvida, protege o vitalício.
//
// 2. Quando a conta vira vitalícia, as assinaturas de PLANO que ainda cobram
//    param: ativa → cancela no fim do período já pago (nada é cobrado de novo);
//    com pagamento pendente → cancela já (senão o Stripe seguiria tentando
//    cobrar). A da CONEXÃO de Open Finance (add-on de R$ 6) NÃO para: é como o
//    vitalício paga conexão de banco.
// =============================================================================

export type AssinaturaResumo = {
  id: string;
  status: string;
  /** Unix, em segundos (o `created` do Stripe). */
  criadaEm: number;
  /** Assinatura da conexão de Open Finance (add-on), não de plano. */
  addon: boolean;
  /** Já marcada pra cancelar no fim do período. */
  cancelaNoFim?: boolean | null;
};

export type ContaVitalicio = { vitalicio?: boolean | null; vitalicio_em?: string | null };

/** Status em que a assinatura dá direito ao plano. */
const DA_DIREITO = new Set(['active', 'trialing']);
/** Status em que o Stripe ainda cobra (ou tenta cobrar). */
const AINDA_COBRA = new Set(['active', 'trialing', 'past_due', 'unpaid']);

/**
 * A assinatura de PLANO que vale agora (ignora o add-on de conexão). As
 * listas do Stripe vêm da mais nova pra mais antiga: fica a mais nova.
 */
export function assinaturaDoPlano<T extends AssinaturaResumo>(subs: readonly T[] | null | undefined): T | null {
  return (subs || []).find((s) => !s.addon && DA_DIREITO.has(s.status)) || null;
}

/** Esta assinatura pode definir o plano desta conta? */
export function assinaturaDefineOPlano(conta: ContaVitalicio | null | undefined, sub: Pick<AssinaturaResumo, 'criadaEm'>): boolean {
  if (!conta?.vitalicio) return true;
  const desde = conta.vitalicio_em ? Date.parse(conta.vitalicio_em) : NaN;
  if (!Number.isFinite(desde)) return false;
  return Number(sub.criadaEm) * 1000 > desde;
}

export type Encerramento = { id: string; como: 'no_fim' | 'agora' };

/** O que fazer com as assinaturas de plano quando a conta vira vitalícia. */
export function assinaturasAEncerrarNoVitalicio(subs: readonly AssinaturaResumo[] | null | undefined): Encerramento[] {
  const fora: Encerramento[] = [];
  for (const s of subs || []) {
    if (s.addon || !AINDA_COBRA.has(s.status)) continue;
    if (DA_DIREITO.has(s.status)) {
      if (!s.cancelaNoFim) fora.push({ id: s.id, como: 'no_fim' });
    } else {
      fora.push({ id: s.id, como: 'agora' });
    }
  }
  return fora;
}

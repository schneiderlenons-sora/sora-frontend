// =============================================================================
// O que o card do cartão diz sobre a fatura. Puro — eval:selo-cartao.
//
// Relato (28/11/2026): fatura do Nubank paga, e a tela mostrava "Paga" num
// cartão cadastrado à mão e VAZIO e "Em aberto" no cartão do banco. Duas causas:
//  1. o cartão do banco nunca consultava a situação no servidor — fatura paga
//     seguia "Em aberto" (com botão de pagar);
//  2. fatura sem nada (R$ 0,00) aparecia como "Paga".
// =============================================================================

/** O que o servidor diz da fatura (de `/faturas` ou `/fatura/status`). */
export type SituacaoServidor = {
  competencia?: string;
  fatura?: number | null;
  pago?: number | null;
  restante?: number | null;
  quitada?: boolean | null;
  situacao?: string | null;
};

export type Selo = 'atrasada' | 'rolada' | 'vazia' | 'paga' | 'aberta';

const POUCO = 0.009;
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function seloDoCartao(p: {
  /** Cartão cadastrado à mão (não vem do banco). */
  manual: boolean;
  status: SituacaoServidor | null;
  temAtrasada: boolean;
  /** Marcação feita à mão neste aparelho (legado). */
  marcadaPaga: boolean;
}): Selo {
  const { manual, status, temAtrasada, marcadaPaga } = p;
  if (temAtrasada || (manual && status?.situacao === 'atrasada')) return 'atrasada';
  if (manual && status?.situacao === 'rolada') return 'rolada';
  if (!status) return marcadaPaga ? 'paga' : 'aberta';
  if (manual) {
    // Nada lançado e nada pago não é "paga" — é uma fatura sem nada.
    if (n(status.fatura) <= POUCO && n(status.pago) <= POUCO && n(status.restante) <= POUCO) return 'vazia';
    return n(status.restante) <= 0.01 ? 'paga' : 'aberta';
  }
  // Cartão do banco: quem sabe é o servidor; a marcação à mão continua valendo.
  return status.quitada || marcadaPaga ? 'paga' : 'aberta';
}

/**
 * A fatura ANTERIOR à exibida, quando ela está paga — pra dizer isso junto da
 * fatura em curso. Sem este aviso, quem acabou de pagar via só a próxima
 * "Em aberto" e concluía que o pagamento não tinha sido reconhecido.
 */
export function anteriorPaga(
  anterior: SituacaoServidor | null | undefined,
  competenciaAnterior: string,
): { competencia: string; pago: number } | null {
  if (!anterior || anterior.competencia !== competenciaAnterior) return null;
  if (!anterior.quitada || n(anterior.pago) <= POUCO || n(anterior.restante) > 0.01) return null;
  return { competencia: competenciaAnterior, pago: n(anterior.pago) };
}

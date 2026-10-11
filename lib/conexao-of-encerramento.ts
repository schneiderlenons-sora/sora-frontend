// =============================================================================
// O que gravar quando a assinatura de CONEXÃO de Open Finance deixa de estar
// ativa (cancelada, past_due, unpaid).
//
// ⚠️ BUG QUE ORIGINOU (gilbertojun 09/2026, davidson 10/2026): o cliente pagou
// uma conexão ANUAL (R$60/conexão/ano, pré-pago por 12 meses), depois tentou
// subir a quantidade, a proration da diferença FALHOU, e o Stripe cancelou a
// assinatura inteira por "payment_failed" — levando `of_conexoes_pagas` a 0 pelo
// webhook. Resultado: a pessoa perdia a conexão que JÁ TINHA PAGO e caía no
// corte do JOB 1R. A migration 180 remendou UM cliente à mão; esta regra conserta
// a RAIZ, pra não precisar de remendo a cada caso.
//
// A regra:
//   · MENSAL cancelado → zera. Não há período futuro pago; a conexão é custo
//     nosso no agregador, manter ligado sem pagamento é prejuízo.
//   · ANUAL cancelado → MANTÉM a quantidade PAGA até o fim do período pago
//     (`of_conexoes_pagas_ate`, migration 180). Depois do prazo, `acessoOpenFinance`
//     expira sozinho — ninguém ganha conexão grátis pra sempre.
//
// ⚠️ A quantidade e o prazo vêm das invoices PAGAS de `subscription_create`/
// `subscription_cycle` (quem resolve isso é o webhook) — NUNCA da quantidade
// atual do item nem de proration de `subscription_update`: era justamente a
// mudança de quantidade cuja cobrança falhou. Creditar só o que foi pago de fato
// erra pro lado seguro (nunca dá conexão de graça).
//
// Função PURA: o webhook faz o IO (ler as invoices) e chama isto. Eval:
// npm run eval:conexao-encerramento
// =============================================================================

export function decidirEncerramentoConexao({ intervalo, pagoAteMs, quantidadePaga, agoraMs }: {
  intervalo?: string | null;
  pagoAteMs?: number | null;
  quantidadePaga?: number | null;
  agoraMs: number;
}): { of_conexoes_pagas: number; of_conexoes_pagas_ate: string | null } {
  const qtd = Number(quantidadePaga);
  const ate = Number(pagoAteMs);
  const agora = Number(agoraMs);

  // Só o ANUAL pré-pago, com quantidade paga de verdade e período ainda no
  // futuro, sobrevive ao cancelamento. Qualquer dúvida (dado faltando, prazo no
  // passado, mensal) cai no lado seguro: zera.
  if (
    intervalo === 'anual'
    && Number.isFinite(qtd) && qtd > 0
    && Number.isFinite(ate) && ate > agora
  ) {
    return { of_conexoes_pagas: Math.floor(qtd), of_conexoes_pagas_ate: new Date(ate).toISOString() };
  }
  return { of_conexoes_pagas: 0, of_conexoes_pagas_ate: null };
}

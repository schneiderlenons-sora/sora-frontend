// =====================================================================
// Quanto uma transação soma NA FATURA do cartão — PORTE FIEL de
// `sora-backend/src/services/valorFatura.js` (que é o CANÔNICO).
//
// Mexeu num, mexa no outro e rode `npm run eval:valor-fatura` nos dois repos.
//
// BUG QUE ISTO CORRIGE (relatado por cliente Nubank, ago/2026): a fatura só
// sabia SOMAR. Todo crédito — estorno, cashback, "Crédito de parcelamento de
// compra" — era DESCARTADO do cálculo, nunca subtraído. Um estorno de R$ 40
// deixava a fatura da Sora R$ 40 maior que a do banco, e o limite comprometido
// nunca voltava.
//
// ⚠️ A REGRA É DELIBERADAMENTE ESTREITA. Só abate quando a linha é
// `Recebimento` **E** `transferencia = true` **E** não é pagamento de fatura.
// Medido na base inteira antes de subir: ZERO linhas existentes mudam de valor.
// Fica de fora de propósito o `Recebimento` com `transferencia = false` em
// carteira de crédito (medidos: 1 "Salário" lançado errado e 8 "📦 Importado"
// de OFX, um deles com cara de pagamento de fatura — abatê-lo contaria em
// dobro com `pagamentos_fatura`).
// =====================================================================

export type TxFatura = {
  tipo?: string | null;
  valor?: number | null;
  categoria?: string | null;
  transferencia?: boolean | null;
};

const cent = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * É a categoria do PAGAMENTO da fatura?
 *
 * Compara sem emoji e sem acento: `'💳 Fatura'` precisa casar igual a
 * `'Fatura'`. Um falso negativo aqui é caro — a linha viraria abatimento e a
 * fatura cairia indevidamente.
 */
export function ehPagamentoFaturaCat(categoria?: string | null): boolean {
  const limpo = String(categoria || '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')       // tira acento
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')                     // tira emoji e pontuação
    .toLowerCase().replace(/\s+/g, ' ').trim();
  return limpo === 'fatura' || limpo === 'fatura cartao';
}

/**
 * Quanto esta linha soma na fatura do ciclo.
 *
 *   compra (Gasto)               → +valor
 *   "Fatura anterior" (rollover) → +valor   (é Gasto com transferencia=true)
 *   pagamento da fatura          →  0       (abate via `pagamentos_fatura`,
 *                                            contar aqui seria em dobro)
 *   estorno / cashback / crédito → −valor
 *   qualquer outro Recebimento   →  0       (ver o aviso do topo)
 */
export function valorNaFatura(t?: TxFatura | null): number {
  if (!t) return 0;
  const v = Math.abs(Number(t.valor) || 0);

  if (t.tipo === 'Gasto') return v;
  if (t.tipo !== 'Recebimento') return 0;

  // Só crédito RECONHECIDO pelo sync abate. `transferencia` é a flag que o
  // normalize marca em pagamento de fatura E em crédito/estorno; sem ela a
  // linha é um recebimento comum que alguém lançou na carteira do cartão.
  if (t.transferencia !== true) return 0;

  if (ehPagamentoFaturaCat(t.categoria)) return 0;
  return -v;
}

/** Soma a fatura de uma lista já filtrada pelo ciclo. Nunca devolve negativo. */
export function somarFatura(transacoes: (TxFatura | null | undefined)[]): number {
  const total = (transacoes || []).reduce((s, t) => s + valorNaFatura(t), 0);
  return Math.max(0, cent(total));
}

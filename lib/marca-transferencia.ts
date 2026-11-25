// =============================================================================
// "Transferência entre minhas contas" na EDIÇÃO de um lançamento.
//
// ESPELHO de sora-backend/src/services/marcaTransferencia.js — o servidor é
// quem decide de verdade; aqui só se escolhe QUANDO mostrar o interruptor e
// avisar ANTES de salvar (em vez de a pessoa tocar "Salvar" e levar um erro).
// `npm run eval:marca-transferencia` compara os dois lados caso a caso.
//
// Relato (Breno, nov/2026): o banco mandou o pagamento do financiamento como
// transferência (ficou fora dos gastos) e o Pix pra si mesmo como gasto — e a
// tela não tinha como corrigir nenhum dos dois.
// =============================================================================
import { ehPagamentoFatura, ehPagamentoFaturaLegado, ehAjusteSaldo } from './categorizar';

const ehCartao = (tipo?: string | null) => /cr[eé]dito/i.test(String(tipo || ''));
const foraPelaCategoria = (c?: string | null) => ehPagamentoFatura(c) || ehPagamentoFaturaLegado(c) || ehAjusteSaldo(c);

/**
 * Mostra o interruptor? Só em lançamento que veio do BANCO, fora de cartão,
 * e que não é pagamento de fatura nem ajuste de saldo.
 */
export function mostraMarcaTransferencia(
  tx: { of_tx_id?: string | null; categoria?: string | null } | null | undefined,
  tipoCarteira?: string | null,
): boolean {
  if (!tx || !tx.of_tx_id) return false;
  if (ehCartao(tipoCarteira)) return false;
  return !foraPelaCategoria(tx.categoria);
}

/**
 * O que impede salvar a troca, já com a categoria que a pessoa escolheu.
 * `null` = pode salvar.
 */
export function erroMarcaTransferencia({ quer, categoriaFinal }: { quer: boolean; categoriaFinal?: string | null }): string | null {
  if (foraPelaCategoria(categoriaFinal)) {
    return 'Pagamento de fatura e ajuste de saldo já ficam fora dos gastos e receitas.';
  }
  if (!quer && String(categoriaFinal || '').trim() === 'Transferências') {
    return 'Escolha a categoria deste lançamento (ex.: Financiamento). Com "Transferências" ele continua fora dos gastos e receitas.';
  }
  return null;
}

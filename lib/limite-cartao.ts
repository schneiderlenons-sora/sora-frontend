// =============================================================================
// LIMITE COMPROMETIDO DO CARTÃO MANUAL — quanto do limite está ocupado.
//
// Relato de cliente (nov/2026): pagou a fatura de R$ 178,15 e a tela de cartões
// seguiu mostrando "usado R$ 1.207,56". A soma pegava tudo do início da fatura
// atual em diante (a própria fatura + as parcelas das próximas) e NUNCA
// descontava o pagamento — fatura paga continuava ocupando o limite. O "posso
// comprar?" do WhatsApp já descontava (oraculo.js: `restante` + parcelas
// futuras); a tela de cartões era a que destoava.
//
// A regra: para cada fatura da ATUAL em diante, conta o que ainda falta pagar
// dela (fatura − pago, nunca abaixo de zero). Sem pagamento registrado o
// resultado é EXATAMENTE a soma antiga (`eval:limite-cartao` compara com a
// cópia congelada). O pagamento de uma fatura só abate ESSA fatura — pagar a
// mais não "libera" parcela de outro mês.
//
// Só pro cartão MANUAL. No Open Finance quem informa o limite usado é o banco
// (`of_limite_usado`), e a tela segue usando o número dele.
//
// Os pagamentos vêm do `/wallets/faturas` (offsets 0 e 1) que a tela já busca —
// o `pago` de cada competência, a mesma conta do "Pagar fatura".
//
// Rodar: npm run eval:limite-cartao
// =============================================================================
import { competenciaAtual, cicloPorCompetencia, dentroDoCiclo, type CartaoCiclo } from './ciclo-fatura';
import { somarFatura, type TxFatura } from './valor-fatura';

type TxLimite = TxFatura & { data?: string | null };

const cent = (v: number) => Math.round(v * 100) / 100;

/**
 * @param cartao   dia de fechamento/vencimento do cartão
 * @param txs      lançamentos DESTE cartão (já filtrados pela carteira)
 * @param pagos    quanto já foi pago por competência ('YYYY-MM' do vencimento)
 * @param hoje     'YYYY-MM-DD' em São Paulo (padrão: hoje)
 */
export function limiteComprometido(
  cartao: CartaoCiclo,
  txs: readonly (TxLimite | null | undefined)[] | null | undefined,
  pagos?: Record<string, number> | null,
  hoje?: string,
): { valor: number; abatido: number } {
  const atual = competenciaAtual(cartao, hoje);
  const inicio = cicloPorCompetencia(cartao, atual).ini;
  const minhas = (txs || []).filter((t): t is TxLimite => !!t && String(t.data || '').slice(0, 10) >= inicio);
  const bruto = somarFatura(minhas);

  let abatido = 0;
  for (const [comp, valor] of Object.entries(pagos || {})) {
    const pago = Number(valor);
    // Só fatura da atual em diante: a de antes já não está nesta soma.
    if (!/^\d{4}-\d{2}$/.test(comp) || comp < atual || !(pago > 0)) continue;
    const ciclo = cicloPorCompetencia(cartao, comp);
    const fatura = somarFatura(minhas.filter((t) => dentroDoCiclo(t.data, ciclo)));
    abatido += Math.min(pago, fatura);
  }
  abatido = cent(abatido);
  // Sem pagamento: EXATAMENTE a soma de sempre (`abatido` 0 diz à tela que
  // nada mudou — ela mantém o comportamento antigo nesse caso).
  if (abatido === 0) return { valor: bruto, abatido: 0 };
  return { valor: Math.max(0, cent(bruto - abatido)), abatido };
}

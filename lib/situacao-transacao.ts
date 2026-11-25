// =============================================================================
// SITUAÇÃO DE UMA TRANSAÇÃO NA LISTA — pago, pendente ou "na fatura de X".
//
// Relato de cliente (nov/2026): "lancei uma compra de R$ 1.000 em 5x no cartão;
// a 1ª aparece como PAGA e as outras como PENDENTE". Ele lia "pendente" como
// conta em aberto — e o quadro "Pendentes · a pagar" somava as parcelas.
//
// ⚠️ PARCELA DE CARTÃO NÃO É CONTA A PAGAR. Ela já está no limite do cartão e
// será cobrada DENTRO de uma fatura; quem se paga é a fatura (que tem a própria
// conta: "vai sobrar", Previstos, Pagar fatura). Contá-la como pendente também
// somava em dobro com a fatura pra quem olhasse os dois números.
//
// ⚠️ O `pago` DA PARCELA NÃO MUDA — e isso é decisão. Nas parcelas de cartão,
// `pago = false` com data futura quer dizer "ainda não cobrada nem antecipada":
// é dele que dependem o comando "parcelas" do WhatsApp, o "Antecipar" (painel e
// zap) e a sincronização do banco (`patchReconciliacaoParcela` só anda de false
// pra true). `pago = true` com data futura quer dizer ANTECIPADA. Marcar tudo
// como pago na criação apagaria essa distinção. Por isso a correção é de
// LEITURA: esta função decide o que a tela mostra e o que entra nas somas de
// pendentes, sem tocar no dado.
//
// A regra (só pra parcela de cartão: carteira Crédito, Gasto, não
// transferência, parcela_total > 1):
//   · paga                         → 'pago' (inclusive antecipada)
//   · o dia dela já chegou          → 'pago' — já foi cobrada, igual à 1ª
//                                    parcela (mesma definição de
//                                    `parcelaJaCobrada` no backend)
//   · o dia ainda não chegou        → 'na_fatura', com a competência da fatura
//                                    em que ela cai (o mesmo ciclo da visão
//                                    "Por fatura")
// Todo o resto segue exatamente como antes: `pago` → 'pago', senão 'pendente'.
// Compra de cartão SEM parcela fica de fora de propósito: ali "pendente" pode
// ser previsão de conta fixa no cartão esperando o valor real.
//
// Rodar: npm run eval:situacao-transacao
// =============================================================================
import { cicloPorFechamento, dataDaFatura, diaNaProximaDe } from './ciclo-fatura';
import { diaDe } from './data-br';

export type Situacao =
  | { tipo: 'pago' }
  | { tipo: 'pendente' }
  | { tipo: 'na_fatura'; competencia: string };

type CartaoCiclo = {
  dia_fechamento?: number | null; dia_vencimento?: number | null;
  fechamento_dia_proxima?: boolean | null; of_conta_id?: string | null;
} | null | undefined;

type TxSituacao = {
  pago?: boolean | null;
  tipo?: string | null;
  transferencia?: boolean | null;
  parcela_total?: number | null;
  parcela_num?: number | null;
  data?: string | null;
  of_bill_post_date?: string | null;
};

/**
 * Em que fatura (competência 'YYYY-MM' do vencimento) cai um dia, neste cartão.
 * É o ciclo que CONTÉM o dia — a mesma conta de `dentroDoCiclo` +
 * `cicloPorCompetencia`. Cartão sem fechamento: mês-calendário (o legado).
 */
export function competenciaDaData(cartao: CartaoCiclo, dia: string): string {
  if (!cartao?.dia_fechamento) return dia.slice(0, 7);
  const [Y, M] = dia.split('-').map(Number);
  // ⚠️ `fimExcl`, não `fim`: com a opção "dia do fechamento vai pra próxima"
  // (migration 200) o próprio dia do fechamento já é da fatura seguinte.
  const op = { diaNaProxima: diaNaProximaDe(cartao) };
  const desteMes = cicloPorFechamento(Y, M - 1, cartao.dia_fechamento, cartao.dia_vencimento, op);
  if (dia < desteMes.fimExcl) return desteMes.competencia;
  return cicloPorFechamento(Y, M, cartao.dia_fechamento, cartao.dia_vencimento, op).competencia;
}

/**
 * A situação que a lista mostra. `cartao` = a carteira de crédito da transação
 * (ou null quando ela é de conta). `hoje` = 'YYYY-MM-DD' em São Paulo.
 */
export function situacaoDaTransacao(t: TxSituacao | null | undefined, cartao: CartaoCiclo | false, hoje: string): Situacao {
  if (t?.pago) return { tipo: 'pago' };
  const ehParcelaDeCartao = !!cartao
    && t?.tipo === 'Gasto'
    && !t?.transferencia
    && Number(t?.parcela_total) > 1;
  if (!ehParcelaDeCartao) return { tipo: 'pendente' };
  const dia = diaDe(t?.data);
  if (!dia) return { tipo: 'pendente' };
  if (dia <= hoje) return { tipo: 'pago' };
  const diaFatura = dataDaFatura(t) || dia;
  return { tipo: 'na_fatura', competencia: competenciaDaData(cartao as CartaoCiclo, diaFatura) };
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "Fatura de dez" (mesmo ano de hoje) · "Fatura de jan/27" (outro ano). */
export function rotuloNaFatura(competencia: string, hoje: string): string {
  const [Y, M] = competencia.split('-').map(Number);
  const mes = MESES_CURTOS[(M - 1) % 12] || competencia;
  const ano = String(hoje).slice(0, 4) === String(Y) ? '' : `/${String(Y).slice(-2)}`;
  return `Fatura de ${mes}${ano}`;
}

/** Busca a carteira de crédito da transação pelo nome (sem caixa/espaço). */
export function mapaDeCartoes<W extends { tipo?: string | null; nome?: string | null }>(wallets: W[] | null | undefined): Map<string, W> {
  const m = new Map<string, W>();
  for (const w of wallets || []) {
    if (w?.tipo === 'Crédito') m.set(String(w.nome || '').trim().toLowerCase(), w);
  }
  return m;
}

export function cartaoDaTransacao<W>(mapa: Map<string, W>, t: { carteira_nome?: string | null; wallet_nome?: string | null } | null | undefined): W | null {
  return mapa.get(String(t?.carteira_nome || t?.wallet_nome || '').trim().toLowerCase()) || null;
}

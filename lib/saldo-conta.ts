import { montarExtrato, type Quitacao, type Ajuste, type TransacaoExtrato } from './extrato-futuro';
import { saldoNaBase } from './moeda';

// =============================================================================
// SALDO ATUAL E PREVISTO DE UMA CONTA — o mesmo número em Transações e no Extrato.
//
// Relato (set/2026), com o filtro de Transações na conta Inter PJ:
//   · o card "Saldo em contas" seguia somando TODAS as contas (R$ 6.294,15),
//     enquanto os outros três cards obedeciam ao filtro;
//   · o "Saldo" do rodapé (R$ 20.570,36) era receitas − despesas da LISTA — e
//     foi lido como saldo da conta, que era R$ 5.217,71.
// O cliente apontou o Extrato dos Previstos como a referência certa e pediu o
// saldo atual e o previsto também em Transações.
//
// ⚠️ NÃO EXISTE UMA SEGUNDA CONTA AQUI. O previsto sai de `montarExtrato`, com
// os mesmos parâmetros que o Extrato usa filtrado numa conta, e o saldo de
// partida sai de `saldoInicialDaConta`, que o próprio Extrato passou a chamar.
// Duas telas do painel com dois "saldos previstos" diferentes pro mesmo dia é
// exatamente o defeito que o cliente reportou — o eval trava a igualdade.
//
// ⚠️ DÍVIDA E FATURA NÃO ENTRAM na conta filtrada — e não por escolha daqui:
// nenhuma das duas tem conta de débito (`dividas` não tem a coluna; a fatura
// vem do cartão). Com filtro de conta o Extrato também as descarta. Passá-las
// vazias evita duas requisições que não mudariam o resultado.
// =============================================================================

type CarteiraConta = {
  nome?: string | null; tipo?: string | null;
  saldo?: number | null; saldo_brl?: number | null; moeda?: string | null;
  saldo_base?: number | null; moeda_base?: string | null;
};

/** 'YYYY-MM-DD' do último dia do mês de `hoje`. */
export function ultimoDiaDoMes(hoje: string): string {
  const [a, m] = hoje.slice(0, 10).split('-').map(Number);
  const dia = new Date(a, m, 0).getDate();
  return `${hoje.slice(0, 7)}-${String(dia).padStart(2, '0')}`;
}

/**
 * A conta de DÉBITO selecionada no filtro — ou null.
 *
 * Cartão fica de fora: o `saldo` de uma carteira de crédito é a fatura, não
 * dinheiro disponível (mesma regra do `saldoHoje` dos Previstos). Com um cartão
 * no filtro, "saldo atual" não significa nada.
 */
export function contaDebitoDoFiltro<W extends CarteiraConta>(nome: string | null | undefined, wallets: W[]): W | null {
  if (!nome || nome === 'todas') return null;
  return (wallets || []).find((w) => w.tipo !== 'Crédito' && w.nome === nome) || null;
}

/**
 * Saldo de partida de uma conta, na moeda BASE do grupo (em real, sem `base`).
 *
 * ⚠️ Conta que sumiu (renomeada, desconectada) → 0, nunca o total: com o filtro
 * de pé as linhas também saem vazias, e devolver o total desenharia um saldo
 * cheio sob uma lista vazia. Câmbio que falhou (`saldo_brl: null`) também → 0.
 */
export function saldoInicialDaConta(wallets: CarteiraConta[], nome: string, moedaBase?: string | null): number {
  const w = contaDebitoDoFiltro(nome, wallets);
  return w ? (saldoNaBase(w, moedaBase) ?? 0) : 0;
}

export type SaldoPrevisto = {
  /** Último dia considerado ('YYYY-MM-DD'). */
  ate: string;
  saldoAtual: number;
  saldoPrevisto: number;
  /** Alguma conta variável entrou — o número é aproximado. */
  temEstimativa: boolean;
};

/**
 * Saldo da conta ao fim do mês corrente, pela mesma régua do Extrato.
 *
 * `transacoes` precisa cobrir o mês de `hoje` (o Extrato usa a listagem do mês
 * corrente). Transação de antes de hoje não move a projeção — paga já está no
 * saldo, e pendente vencida o Extrato também não projeta.
 */
export function saldoPrevistoDaConta(p: {
  hoje: string;
  conta: string;
  wallets: CarteiraConta[];
  transacoes: TransacaoExtrato[];
  recorrencias: Parameters<typeof montarExtrato>[0]['recorrencias'];
  quitacoes?: Quitacao[];
  ajustes?: Ajuste[];
  /** Moeda base do grupo (migration 168). Sem ela, real. */
  moedaBase?: string | null;
}): SaldoPrevisto {
  const saldoAtual = saldoInicialDaConta(p.wallets, p.conta, p.moedaBase);
  const ate = ultimoDiaDoMes(p.hoje);
  const ex = montarExtrato({
    de: p.hoje,
    ate,
    saldoInicial: saldoAtual,
    transacoes: p.transacoes,
    recorrencias: p.recorrencias,
    dividas: [],
    faturas: [],
    quitacoes: p.quitacoes,
    ajustes: p.ajustes,
    carteiras: [p.conta],
  });
  const ultimo = ex.dias[ex.dias.length - 1];
  return {
    ate,
    saldoAtual: ex.saldoInicial,
    saldoPrevisto: ultimo ? ultimo.saldo : ex.saldoInicial,
    temEstimativa: ex.temEstimativa,
  };
}

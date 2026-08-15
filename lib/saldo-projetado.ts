// =============================================================================
// SALDO PROJETADO — "com o que ainda vai entrar e sair, como eu termino o mês?"
//
// Pedido de cliente: "saldo + créditos previstos − débitos previstos?". A
// fórmula dele está certa; o cuidado todo está em NÃO CONTAR DUAS VEZES.
//
// ── O que já está no saldo e o que não está ─────────────────────────────────
// Medido no código do cron (`jobs/index.js`) — os 3 modos de conta fixa:
//
//   'lancar'     → no dia do vencimento cria a transação JÁ PAGA e desconta a
//                  carteira. Depois do dia, ela ESTÁ dentro do saldo atual.
//   'prever'     → cria um "[Previsto]" com `pago: false`. ⚠️ Esse insert NÃO
//                  mexe na carteira, então NÃO está no saldo.
//   'nao_lancar' → não cria transação nenhuma. Quem usa esse modo tem Open
//                  Finance, e a cobrança real chega pelo banco.
//
// Por isso a regra é o DIA: item cujo vencimento já passou é tratado como
// resolvido (ou a Sora lançou, ou o banco trouxe); item cujo vencimento ainda
// vem é o que entra na projeção. É a mesma separação "ainda vem × já passou"
// que a listagem de recorrências usa no WhatsApp.
//
// ⚠️ LIMITE CONHECIDO, assumido de propósito: no modo 'prever', uma conta que
// venceu e ainda não foi confirmada fica de fora da projeção, mesmo não estando
// no saldo. Tratar o contrário exigiria casar cada "[Previsto]" com a sua
// recorrência — e não existe `recorrencia_id` em `transacoes` (conferido no
// schema), então o casamento seria por descrição, que é justamente o tipo de
// palpite que já causou bug nesta base. Preferimos subestimar a saída a inventar
// um vínculo.
//
// ⚠️ CARTÃO DE CRÉDITO FICA FORA do saldo de hoje. O saldo de uma carteira de
// crédito representa a FATURA (negativo por definição no Open Finance), não
// dinheiro disponível — somá-lo ao caixa misturaria duas coisas diferentes.
// =============================================================================

export type ItemPrevisto = {
  tipo:            'Gasto' | 'Recebimento';
  valor:           number;
  dia_vencimento:  number;
  valor_variavel?: boolean;
};

export type CarteiraSaldo = {
  /** Ausente em carteira antiga; só 'Crédito' muda o comportamento. */
  tipo?:  string;
  /** A rota devolve `select('*')`, mas o campo é opcional por segurança. */
  saldo?: number;
};

export type SaldoProjetado = {
  /** Soma das carteiras que são dinheiro disponível (crédito fora). */
  saldoHoje:    number;
  /** Receitas que ainda não caíram neste mês. */
  aReceber:     number;
  /** Despesas que ainda não saíram neste mês (fixas + variáveis + dívidas). */
  aPagar:       number;
  /** saldoHoje + aReceber − aPagar */
  projetado:    number;
  /** Há item de valor variável na conta? Então o número é aproximado. */
  aproximado:   boolean;
  /** Quantos itens entraram na projeção (0 = nada a projetar). */
  itens:        number;
};

const cent = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Dia de hoje no fuso de São Paulo — nunca `getDate()` local nem UTC. */
export function diaHojeSP(agora: Date = new Date()): number {
  // `en-CA` dá YYYY-MM-DD, que é fatiável sem ambiguidade de ordem.
  const iso = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return parseInt(iso.slice(8, 10), 10);
}

/**
 * @param carteiras  wallets do grupo (crédito é ignorado)
 * @param previstos  recorrências ativas do mês
 * @param parcelas   parcela do mês de cada dívida que conta nos previstos
 */
export function calcularSaldoProjetado(
  carteiras: CarteiraSaldo[],
  previstos: ItemPrevisto[],
  parcelas: ItemPrevisto[] = [],
  agora: Date = new Date(),
): SaldoProjetado {
  const hoje = diaHojeSP(agora);

  const saldoHoje = cent((carteiras || [])
    .filter((c) => c.tipo !== 'Crédito')
    .reduce((s, c) => s + (Number(c.saldo) || 0), 0));

  // Sem `dia_vencimento` não dá pra saber se já passou — conta como "ainda vem",
  // que é o lado conservador pra despesa (assume que ainda vai sair).
  const aindaVem = (i: ItemPrevisto) => !i.dia_vencimento || i.dia_vencimento >= hoje;

  const todos = [...(previstos || []), ...(parcelas || [])].filter(aindaVem);

  const soma = (tipo: 'Gasto' | 'Recebimento') => cent(todos
    .filter((i) => i.tipo === tipo)
    .reduce((s, i) => s + (Number(i.valor) || 0), 0));

  const aReceber = soma('Recebimento');
  const aPagar   = soma('Gasto');

  return {
    saldoHoje,
    aReceber,
    aPagar,
    projetado:  cent(saldoHoje + aReceber - aPagar),
    // Variável sem valor definido entra como 0 — o total é estimativa, e a tela
    // precisa dizer isso em vez de fingir precisão.
    aproximado: todos.some((i) => i.valor_variavel),
    itens:      todos.length,
  };
}

// =============================================================================
// O QUE AINDA VEM NO MÊS — fonte única do "vai sobrar" (nov/2026).
//
// Pergunta que três telas fazem: "com o que ainda entra e sai, como eu fecho o
// mês?" — o card Previstos da aba Transações, a manchete da aba Previstos e o
// "saldo previsto" dos Relatórios. Cada uma montava a lista à mão, e elas
// DIVERGIAM. Medido na base em out/2026, só leitura:
//
//   · 23 contas fixas pagas ANTES do vencimento (7 clientes, R$ 28.320) eram
//     contadas DUAS VEZES na aba Previstos e no card da Transações: o dinheiro
//     já tinha saído do saldo e a conta seguia como "a pagar". Só os Relatórios
//     liam `resolvida_no_mes`.
//   · 19 parcelas de dívida pagas adiantadas (5 clientes) idem — nas TRÊS
//     telas: o filtro só comparava o dia, nunca o pagamento. O Extrato Futuro
//     já usava `proximoVencimento`; agora todo mundo usa.
//   · Lançamento PENDENTE (previsto único, conta "só prever" que o cron já
//     criou) entrava nos Relatórios e ficava fora das outras duas.
//
// ⚠️ As regras não são novas: são as dos Relatórios (as recorrências) e as do
// Extrato (as dívidas), MOVIDAS pra cá. Quem mudar algo aqui muda nas três
// telas — que é exatamente o ponto.
// =============================================================================

import { aindaVemNoMes, diaHojeSP, itemPrevistoDe, vezesQueAindaVem } from './saldo-projetado';
import { proximoVencimento } from './vencimento-divida';

export type PrevistoRestante = {
  chave: string;
  titulo: string;
  tipo: 'Gasto' | 'Recebimento';
  valor: number;
  dia: number;
  variavel: boolean;
  origem: string;
  /** Quantas vezes a linha cai (conta fixa semanal = várias). */
  vezes: number;
  /** O objeto de origem (conta fixa, dívida ou fatura) — a tela o usa pra
   *  desenhar a linha com ícone e legenda, sem refazer a regra. */
  ref: unknown;
};

type Rec = {
  id: string; tipo: 'Gasto' | 'Recebimento'; valor: number | string;
  dia_vencimento?: number | null; descricao?: string | null; categoria?: string | null;
  valor_variavel?: boolean | null; frequencia?: string | null; dia_semana?: number | null;
  mes_vencimento?: number | null; data_inicio?: string | null; data_fim?: string | null;
  modo_lancamento?: string | null; ativa?: boolean | null;
  /** Vem do servidor (services/resolvidasNoMes.js): paga OU pulada neste mês. */
  resolvida_no_mes?: boolean | null;
};
type Div = {
  id: string; titulo?: string | null; valor_parcela?: number | string | null;
  dia_vencimento?: number | null; status?: string | null; nos_previstos?: boolean | null;
  data_inicio?: string | null; ultimo_pagamento?: string | null; proximo_vencimento?: string | null;
};
type Fat = {
  cartao_id: string; nome?: string | null; restante?: number | string | null;
  venc?: string | null; nos_previstos?: boolean | null;
};

const hojeISO = (agora: Date) => agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

/**
 * A parcela de dívida AINDA cai neste mês? Pelo `proximoVencimento` — a regra
 * do card da dívida e do Extrato, a única que sabe que ela foi PAGA adiantada
 * (aí o próximo vencimento já é no mês seguinte). Atrasada e não paga: ainda.
 */
export function parcelaAindaNoMes(d: Div, agora: Date = new Date()): boolean {
  const hoje = hojeISO(agora);
  const prox = proximoVencimento(d, hoje);
  return !!prox && prox.data.slice(0, 7) === hoje.slice(0, 7);
}

/**
 * Quantas vezes a conta fixa ainda aparece como "a pagar/receber" nas LISTAS
 * do mês (Receitas, Despesas, Caixa).
 *
 * ⚠️ `resolvida_no_mes` primeiro (paga OU pulada, vem do servidor). As listas
 * decidiam só pela DATA e uma conta paga antes do vencimento seguia como
 * "ainda sai" logo abaixo de uma manchete que já a tinha descontado (relato
 * do dono, nov/2026). Fora isso é a regra de data de sempre.
 */
export function vezesAindaNaLista(r: Rec, agora: Date = new Date()): number {
  if (r.resolvida_no_mes) return 0;
  return vezesQueAindaVem(itemPrevistoDe(r as Parameters<typeof itemPrevistoDe>[0]), agora);
}

export function previstosRestantesDoMes(p: {
  recorrencias?: Rec[] | null;
  dividas?: Div[] | null;
  faturas?: Fat[] | null;
  agora?: Date;
}): PrevistoRestante[] {
  const agora = p.agora ?? new Date();
  const diaHoje = diaHojeSP(agora);

  // ── Contas fixas ──────────────────────────────────────────────────────────
  // ⚠️ `modo_lancamento` impede contar em dobro: "lançar" e "só prever" VIRAM
  // transação no dia do vencimento — e a partir daí quem responde é ela (paga,
  // ou pendente logo abaixo). "Não lançar" nunca cria nada, então vale até o
  // próprio dia. Frequência não mensal é CONTAGEM (semanal cai várias vezes,
  // anual só no mês dela).
  const fixas = (p.recorrencias || [])
    .filter((r) => r.ativa !== false && !r.resolvida_no_mes)
    .map((r) => {
      const item = itemPrevistoDe(r as Parameters<typeof itemPrevistoDe>[0]);
      const naoMensal = !!r.frequencia && r.frequencia !== 'mensal';
      const vezes = naoMensal
        ? vezesQueAindaVem(item, agora)
        : ((r.modo_lancamento || 'lancar') === 'nao_lancar'
          ? (aindaVemNoMes(item, agora) ? 1 : 0)
          : (Number(r.dia_vencimento) > diaHoje ? 1 : 0));
      return { r, vezes };
    })
    .filter((x) => x.vezes > 0 && Number(x.r.valor) > 0)
    .map(({ r, vezes }): PrevistoRestante => ({
      chave: `rec:${r.id}`,
      titulo: r.descricao || r.categoria || 'Conta fixa',
      tipo: r.tipo,
      valor: (Number(r.valor) || 0) * vezes,
      dia: Number(r.dia_vencimento) || 0,
      variavel: !!r.valor_variavel,
      origem: vezes > 1 ? `Conta fixa · ${vezes}x no mês` : 'Conta fixa',
      vezes,
      ref: r,
    }));

  // ── Parcelas de dívida ────────────────────────────────────────────────────
  // ⚠️ `proximoVencimento` e não "o dia ainda não passou": é a regra do card
  // da dívida e do Extrato, a única que sabe que a parcela FOI PAGA adiantada
  // (aí o próximo vencimento já é no mês seguinte e ela sai daqui).
  const parcelas = (p.dividas || [])
    .filter((d) => d.status !== 'quitada' && Number(d.valor_parcela) > 0 && d.nos_previstos !== false)
    .filter((d) => parcelaAindaNoMes(d, agora))
    .map((d): PrevistoRestante => ({
      chave: `div:${d.id}`,
      titulo: d.titulo || 'Dívida',
      tipo: 'Gasto',
      valor: Number(d.valor_parcela) || 0,
      dia: Number(d.dia_vencimento) || 0,
      variavel: false,
      origem: 'Parcela de dívida',
      vezes: 1,
      ref: d,
    }));

  // ── Faturas ───────────────────────────────────────────────────────────────
  // A data INTEIRA manda: o ciclo do cartão cruza meses, e um vencimento 13/10
  // reduzido a "13" seria lido como já vencido.
  // ⚠️ A fatura que vence no MÊS SEGUINTE entra, de propósito (caso real em
  // `saldo-projetado.ts`, `ItemPrevisto.venc`): é dinheiro que a pessoa precisa
  // guardar. Quem projeta vários meses (aba Previstos) tem de tirá-la dos meses
  // seguintes — senão ela sai duas vezes do saldo acumulado.
  const faturas = (p.faturas || [])
    .filter((f) => Number(f.restante) > 0.01 && f.nos_previstos !== false
      && aindaVemNoMes({ tipo: 'Gasto', valor: Number(f.restante), dia_vencimento: 0, venc: f.venc ? String(f.venc) : undefined }, agora))
    .map((f): PrevistoRestante => ({
      chave: `fat:${f.cartao_id}`,
      titulo: `Fatura ${f.nome || 'do cartão'}`,
      tipo: 'Gasto',
      valor: Number(f.restante) || 0,
      dia: parseInt(String(f.venc || '').slice(8, 10), 10) || 0,
      variavel: false,
      origem: 'Fatura de cartão',
      vezes: 1,
      ref: f,
    }));

  return [...fixas, ...parcelas, ...faturas].sort((a, b) => a.dia - b.dia);
}

type Tx = {
  tipo?: string | null; valor?: number | string | null; pago?: boolean | null;
  carteira_nome?: string | null; wallet_nome?: string | null; transferencia?: boolean | null;
};

/**
 * Lançamentos PENDENTES que ainda vão mexer no caixa do mês.
 *
 * ⚠️ Compra em cartão fica de fora: ela já está na FATURA, que entra acima.
 * Transferência também: não é dinheiro entrando nem saindo — e um pagamento
 * de fatura pendente contaria a fatura duas vezes.
 */
export function pendentesDoCaixa(txs: Tx[] | null | undefined, nomesCartao: Set<string>): Tx[] {
  return (txs || []).filter((t) => !t.pago && !t.transferencia
    && (t.tipo === 'Gasto' || t.tipo === 'Recebimento')
    && !nomesCartao.has(String(t.carteira_nome || t.wallet_nome || '').trim().toLowerCase()));
}

/** Nomes (minúsculos) das carteiras de cartão — o filtro dos pendentes. */
export function nomesDeCartao(wallets: { tipo?: string | null; nome?: string | null }[] | null | undefined): Set<string> {
  return new Set((wallets || []).filter((w) => w.tipo === 'Crédito').map((w) => String(w.nome || '').trim().toLowerCase()));
}

/**
 * Tudo junto, no formato que `calcularSaldoProjetado` espera.
 *
 * ⚠️ `dia_vencimento: 0` de propósito: a regra de data JÁ foi aplicada acima,
 * e 0 é lido como "ainda vem". Refiltrar derrubaria o pendente atrasado — que
 * continua tendo de ser pago.
 */
export function itensDoSaldoProjetado(restantes: PrevistoRestante[], pendentes: Tx[]) {
  return [
    ...restantes.map((i) => ({ tipo: i.tipo, valor: i.valor, dia_vencimento: 0, valor_variavel: i.variavel || undefined })),
    ...pendentes.map((t) => ({ tipo: t.tipo as 'Gasto' | 'Recebimento', valor: Number(t.valor) || 0, dia_vencimento: 0 })),
  ];
}

// =============================================================================
// CONTAS A PAGAR E A RECEBER DO MÊS — a lista da aba "Contas" dos Previstos
// (eval:contas-do-mes).
//
// Pedido de cliente (Fábio, nov/2026), vindo do Gestor Money: "uma tela de
// Contas a Pagar/Receber, onde eu via o que ainda tenho a receber ou a pagar".
// Decisões do dono: aba dentro de Previstos, abre no mês atual, entram fatura
// e parcela de dívida, com opção de esconder as faturas.
//
// ⚠️ NENHUMA REGRA NOVA DE "O QUE VENCE QUANDO". As contas fixas e as parcelas
// de dívida saem de `montarExtrato` (lib/extrato-futuro.ts) — o mesmo motor
// do Extrato Futuro, que já resolve baixa (`recorrencia_id + competencia`),
// pulada, adiada, a quitação implícita do cron e o `proximoVencimento` da
// dívida. As faturas saem de `/wallets/faturas` (faturaVista, a fonte única do
// valor). Esta lista só CLASSIFICA: atrasada / hoje / a vencer / paga.
//
// ⚠️ NADA CONTADO DUAS VEZES:
//   · compra no CARTÃO (inclusive parcela futura, que é `pago: false`) não
//     entra: ela já está dentro da fatura;
//   · lançamento pago de conta fixa não vira linha "paga" pela transação — a
//     lista de pagas sai das BAIXAS (`quitacoes`), uma por ocorrência;
//   · a parcela de dívida atrasada de meses anteriores entra UMA vez, sem a do
//     mês (que já vem do motor).
//   · transferência, ajuste de saldo, pagamento de fatura e "não considerar"
//     ficam fora.
// =============================================================================

import { montarExtrato, type TransacaoExtrato, type Ajuste } from './extrato-futuro';
import type { ItemRecorrente, ItemParcelado } from './previstos';
import { venceEm } from './frequencia-recorrencia';
import { parcelasEmAtraso, proximoVencimento } from './vencimento-divida';
import type { Pendencia } from './previstos-atrasados';

export type StatusConta = 'atrasada' | 'hoje' | 'a_vencer' | 'paga';
export type OrigemConta = 'fixa' | 'fatura' | 'divida' | 'avulsa';

export type ItemConta = {
  chave: string;
  tipo: 'pagar' | 'receber';
  origem: OrigemConta;
  descricao: string;
  valor: number;
  /** Conta de valor variável: o número é estimativa. */
  estimado: boolean;
  /** Vencimento (aberta) ou dia do pagamento (paga), 'YYYY-MM-DD'. */
  data: string;
  status: StatusConta;
  /** Dias de atraso (só `atrasada`). */
  diasAtraso?: number;
  carteira: string | null;
  /** Veio de mês anterior (só aparece no mês atual). */
  deMesAnterior?: boolean;
  detalhe?: string | null;
  // Ids das ações (cada origem usa o fluxo de pagamento que já existe).
  recorrenciaId?: string | null;
  competencia?: string | null;
  transacaoId?: string | null;
  cartaoId?: string | null;
  dividaId?: string | null;
  semanal?: boolean;
  adiada?: boolean;
};

export type RecorrenciaConta = ItemRecorrente & { id?: string; carteira?: string | null; modo_lancamento?: string | null };
export type DividaConta = ItemParcelado & {
  id?: string; titulo?: string | null; carteira?: string | null; status?: string | null;
  data_inicio?: string | null; ultimo_pagamento?: string | null; proximo_vencimento?: string | null;
};
export type QuitacaoConta = {
  recorrenciaId: string; competencia: string;
  transacaoId?: string | null; data?: string | null; valor?: number | null; pago?: boolean | null;
};
export type TransacaoConta = TransacaoExtrato & {
  categoria?: string | null; ignorar_em?: string | null;
};
/** Fatura de UM cartão numa competência, já na moeda do grupo. */
export type FaturaConta = {
  cartao_id: string; nome: string; competencia: string; venc: string;
  restante: number; pago?: number | null; fatura?: number | null; quitada?: boolean | null;
  carteira?: string | null;
};

const cent = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
const ym = (s: string) => String(s).slice(0, 7);
const CATS_FORA = /\b(fatura|transfer[eê]ncias?|ajuste)\b/i;

function ultimoDia(mes: string) {
  const [y, m] = mes.split('-').map(Number);
  return `${mes}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
}
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}
function statusDe(data: string, hoje: string): { status: StatusConta; diasAtraso?: number } {
  if (data < hoje) return { status: 'atrasada', diasAtraso: diasEntre(data, hoje) };
  if (data === hoje) return { status: 'hoje' };
  return { status: 'a_vencer' };
}
/**
 * Qual parcela vence nesta data. ⚠️ Não é "pagas + 1": com parcela atrasada no
 * meio, a de dezembro é a 5ª, não a 4ª (a 4ª é a de novembro, ainda em aberto).
 * Conta os meses desde a PRIMEIRA em aberto — a atrasada mais antiga (mesma
 * regra do card) ou, sem atraso, o próximo vencimento.
 */
function numeroDaParcela(div: ItemParcelado, data: string, hoje: string): number {
  const total = Number(div.parcelas_total) || 0;
  const pagas = Number(div.parcelas_pagas) || 0;
  const primeira = parcelasEmAtraso(div as never, hoje)?.desde ?? proximoVencimento(div as never, hoje)?.data ?? data;
  const meses = (Number(data.slice(0, 4)) * 12 + Number(data.slice(5, 7))) - (Number(primeira.slice(0, 4)) * 12 + Number(primeira.slice(5, 7)));
  const n = pagas + 1 + Math.max(0, meses);
  return total > 0 ? Math.min(n, total) : n;
}
/** Primeiro dia em que a conta fixa vence naquela competência (pra pendência antiga). */
function vencimentoNaCompetencia(r: RecorrenciaConta | undefined, comp: string): string {
  if (r) {
    for (let d = 1; d <= 31; d++) {
      const dia = `${comp}-${String(d).padStart(2, '0')}`;
      if (dia > ultimoDia(comp)) break;
      if (venceEm(r as never, dia)) return dia;
    }
  }
  return `${comp}-01`;
}

export function montarContasDoMes(p: {
  mes: string;
  hoje: string;
  transacoes: TransacaoConta[];
  recorrencias: RecorrenciaConta[];
  dividas: DividaConta[];
  quitacoes: QuitacaoConta[];
  ajustes: Ajuste[];
  faturas: FaturaConta[];
  /** Nomes das carteiras de cartão: pendente nelas está DENTRO da fatura. */
  cartoes: string[];
  /** Só no mês atual: o que ficou em aberto antes dele. */
  anteriores?: { fixas: Pendencia[]; faturas: FaturaConta[] };
}): ItemConta[] {
  const { mes, hoje } = p;
  const de = `${mes}-01`;
  const ate = ultimoDia(mes);
  const ehMesAtual = mes === ym(hoje);
  const cartoes = new Set((p.cartoes || []).map((c) => String(c).toLowerCase()));
  const recPorId = new Map((p.recorrencias || []).filter((r) => r.id).map((r) => [String(r.id), r]));
  const itens: ItemConta[] = [];

  // Lançamentos que contam: nem cartão, nem transferência/ajuste/fatura, nem "não considerar".
  const txs = (p.transacoes || []).filter((t) =>
    !t.transferencia && !t.ignorar_em && !CATS_FORA.test(String(t.categoria || ''))
    && !cartoes.has(String(t.carteira_nome || '').toLowerCase()));

  // ── 1. Contas fixas, lançamentos pendentes e parcelas de dívida (o motor do Extrato) ──
  // Dívida ENTRA mesmo com "fora dos previstos": continua sendo conta a pagar.
  const ext = montarExtrato({
    de, ate, saldoInicial: 0,
    transacoes: txs,
    recorrencias: p.recorrencias || [],
    dividas: (p.dividas || []).map((d) => ({ ...d, nos_previstos: true })),
    faturas: [],
    quitacoes: (p.quitacoes || []).map((q) => ({ recorrenciaId: q.recorrenciaId, competencia: q.competencia })),
    ajustes: p.ajustes || [],
  });
  for (const dia of ext.dias) {
    for (const l of dia.linhas) {
      if (l.estado !== 'previsto') continue;            // pago vem das BAIXAS (abaixo)
      const rec = l.recorrenciaId ? recPorId.get(String(l.recorrenciaId)) : undefined;
      const origem: OrigemConta = l.origem === 'divida' ? 'divida'
        : (l.origem === 'recorrencia' || l.recorrenciaId) ? 'fixa' : 'avulsa';
      const div = l.dividaId ? (p.dividas || []).find((d) => d.id === l.dividaId) : undefined;
      itens.push({
        chave: `${origem}:${l.recorrenciaId || l.dividaId || l.transacaoId || l.descricao}:${l.data}`,
        tipo: l.tipo === 'Recebimento' ? 'receber' : 'pagar',
        origem,
        descricao: l.descricao,
        valor: cent(l.valor),
        estimado: !!l.estimado,
        data: l.data,
        ...statusDe(l.data, hoje),
        carteira: l.carteira ?? null,
        detalhe: origem === 'divida' && div && Number(div.parcelas_total) > 0
          ? `parcela ${numeroDaParcela(div, l.data, hoje)}/${div.parcelas_total}` : (l.adiada ? 'adiada' : null),
        recorrenciaId: l.recorrenciaId ?? null,
        competencia: l.competencia ?? null,
        transacaoId: l.transacaoId ?? null,
        dividaId: l.dividaId ?? null,
        semanal: rec ? (rec.frequencia || 'mensal') === 'semanal' : false,
        adiada: !!l.adiada,
      });
    }
  }

  // ── 2. Pagas/recebidas: contas fixas pelas BAIXAS do mês ──
  const vistas = new Set<string>();
  for (const q of p.quitacoes || []) {
    if (q.competencia !== mes || q.pago === false) continue;
    const k = `${q.recorrenciaId}:${q.competencia}`;
    if (vistas.has(k)) continue;
    vistas.add(k);
    const r = recPorId.get(String(q.recorrenciaId));
    if (!r) continue;
    const data = q.data ? String(q.data).slice(0, 10) : vencimentoNaCompetencia(r, mes);
    itens.push({
      chave: `paga:fixa:${k}`,
      tipo: r.tipo === 'Recebimento' ? 'receber' : 'pagar',
      origem: 'fixa',
      descricao: r.descricao || (r.tipo === 'Recebimento' ? 'Receita fixa' : 'Conta fixa'),
      valor: cent(q.valor ?? r.valor),
      estimado: false,
      data, status: 'paga',
      carteira: r.carteira ?? null,
      recorrenciaId: q.recorrenciaId, competencia: q.competencia, transacaoId: q.transacaoId ?? null,
    });
  }
  // Parcela de dívida paga no mês (a data do último pagamento).
  for (const d of p.dividas || []) {
    const pg = d.ultimo_pagamento ? String(d.ultimo_pagamento).slice(0, 10) : null;
    if (!pg || ym(pg) !== mes || !(Number(d.valor_parcela) > 0)) continue;
    itens.push({
      chave: `paga:divida:${d.id}:${pg}`, tipo: 'pagar', origem: 'divida',
      descricao: d.titulo || 'Parcela', valor: cent(d.valor_parcela), estimado: false,
      data: pg, status: 'paga', carteira: d.carteira ?? null, dividaId: d.id ?? null,
    });
  }

  // ── 3. Faturas da competência do mês ──
  const fatVistas = new Set<string>();
  for (const f of p.faturas || []) {
    if (f.competencia !== mes || !f.venc) continue;
    const k = `${f.cartao_id}:${f.competencia}`;
    if (fatVistas.has(k)) continue;
    fatVistas.add(k);
    const restante = cent(f.restante);
    const base = {
      tipo: 'pagar' as const, origem: 'fatura' as const, descricao: `Fatura ${f.nome}`.trim(),
      estimado: false, carteira: f.carteira ?? null, cartaoId: f.cartao_id, competencia: f.competencia,
    };
    if (restante > 0.009) {
      const pago = cent(f.pago);
      itens.push({
        ...base, chave: `fatura:${k}`, valor: restante, data: String(f.venc).slice(0, 10),
        ...statusDe(String(f.venc).slice(0, 10), hoje),
        detalhe: pago > 0.009 ? `já pagou ${pago.toFixed(2).replace('.', ',')}` : null,
      });
    } else if (cent(f.pago) > 0.009 || f.quitada) {
      itens.push({
        ...base, chave: `paga:fatura:${k}`, valor: cent(f.pago) > 0.009 ? cent(f.pago) : cent(f.fatura),
        data: String(f.venc).slice(0, 10), status: 'paga',
      });
    }
  }

  // ── 4. Só no mês atual: o que ficou em aberto antes dele ──
  if (ehMesAtual && p.anteriores) {
    for (const pd of p.anteriores.fixas || []) {
      const r = recPorId.get(String(pd.recorrenciaId));
      const data = vencimentoNaCompetencia(r, pd.competencia);
      if (data >= de) continue;
      itens.push({
        chave: `anterior:fixa:${pd.recorrenciaId}:${pd.competencia}`,
        tipo: pd.tipo === 'Recebimento' ? 'receber' : 'pagar', origem: 'fixa',
        descricao: pd.descricao, valor: cent(pd.valor), estimado: !!pd.estimado,
        data, ...statusDe(data, hoje), carteira: pd.carteira ?? null, deMesAnterior: true,
        recorrenciaId: pd.recorrenciaId, competencia: pd.competencia,
        semanal: r ? (r.frequencia || 'mensal') === 'semanal' : false,
      });
    }
    for (const f of p.anteriores.faturas || []) {
      const venc = String(f.venc).slice(0, 10);
      if (!(cent(f.restante) > 0.009) || venc >= de) continue;
      const k = `${f.cartao_id}:${f.competencia}`;
      if (fatVistas.has(k)) continue;
      fatVistas.add(k);
      itens.push({
        chave: `anterior:fatura:${k}`, tipo: 'pagar', origem: 'fatura',
        descricao: `Fatura ${f.nome}`.trim(), valor: cent(f.restante), estimado: false,
        data: venc, ...statusDe(venc, hoje), carteira: f.carteira ?? null, deMesAnterior: true,
        cartaoId: f.cartao_id, competencia: f.competencia,
      });
    }
    // Parcelas de dívida atrasadas de meses ANTERIORES (a do mês já veio do motor).
    for (const d of p.dividas || []) {
      const at = parcelasEmAtraso(d as never, hoje);
      if (!at || !(at.quantas > 0) || !(Number(d.valor_parcela) > 0)) continue;
      const antes = at.quantas - (at.ultima >= de ? 1 : 0);
      if (antes <= 0) continue;
      itens.push({
        chave: `anterior:divida:${d.id}`, tipo: 'pagar', origem: 'divida',
        descricao: d.titulo || 'Parcela', valor: cent(antes * Number(d.valor_parcela)), estimado: false,
        data: at.desde, ...statusDe(at.desde, hoje), carteira: d.carteira ?? null, deMesAnterior: true,
        detalhe: `${antes}${at.ouMais && antes === at.quantas ? '+' : ''} ${antes === 1 ? 'parcela atrasada' : 'parcelas atrasadas'}`,
        dividaId: d.id ?? null,
      });
    }
  }

  const peso: Record<StatusConta, number> = { atrasada: 0, hoje: 1, a_vencer: 2, paga: 3 };
  return itens.sort((a, b) => peso[a.status] - peso[b.status]
    || (a.status === 'paga' ? b.data.localeCompare(a.data) : a.data.localeCompare(b.data))
    || a.descricao.localeCompare(b.descricao, 'pt-BR'));
}

export type FiltroStatus = 'todas' | 'atrasadas' | 'hoje' | 'a_vencer';

/** O que a aba mostra: a lista da sub-aba, com filtro, busca e faturas escondidas. */
export function filtrarContas(itens: ItemConta[], f: {
  aba: 'pagar' | 'receber' | 'pagas'; status?: FiltroStatus; busca?: string; ocultarFaturas?: boolean;
}): ItemConta[] {
  const termo = String(f.busca || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  return itens.filter((i) => {
    if (f.ocultarFaturas && i.origem === 'fatura') return false;
    if (f.aba === 'pagas') { if (i.status !== 'paga') return false; }
    else {
      if (i.status === 'paga' || i.tipo !== f.aba) return false;
      if (f.status === 'atrasadas' && i.status !== 'atrasada') return false;
      if (f.status === 'hoje' && i.status !== 'hoje') return false;
      if (f.status === 'a_vencer' && i.status !== 'a_vencer') return false;
    }
    if (termo) {
      const alvo = `${i.descricao} ${i.carteira || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (!termo.split(/\s+/).every((p) => alvo.includes(p))) return false;
    }
    return true;
  });
}

/** Totais do topo (respeitam "esconder faturas"). */
export function totaisContas(itens: ItemConta[], ocultarFaturas = false) {
  let aPagar = 0, aReceber = 0, atrasado = 0, nAtrasadas = 0, pago = 0, recebido = 0;
  for (const i of itens) {
    if (ocultarFaturas && i.origem === 'fatura') continue;
    if (i.status === 'paga') { if (i.tipo === 'pagar') pago += i.valor; else recebido += i.valor; continue; }
    if (i.tipo === 'pagar') aPagar += i.valor; else aReceber += i.valor;
    if (i.status === 'atrasada' && i.tipo === 'pagar') { atrasado += i.valor; nAtrasadas += 1; }
  }
  return { aPagar: cent(aPagar), aReceber: cent(aReceber), atrasado: cent(atrasado), nAtrasadas, pago: cent(pago), recebido: cent(recebido) };
}

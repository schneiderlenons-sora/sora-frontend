// =====================================================================
// ciclo-fatura — CICLO REAL da fatura do cartão (painel).
//
// PORTE FIEL de sora-backend/src/services/cicloFatura.js — o backend é
// CANÔNICO. Se a regra mudar lá, espelhar aqui, senão os números "pulam" na
// tela ao revalidar (foi o bug real "fatura zerada no zap × R$ 146,89 no
// painel"). A bateria de casos vive em lib/ciclo-fatura.eval.mjs e tem que
// bater campo a campo com evals/cicloFatura.eval.js do backend.
//
// A fatura NÃO é o mês-calendário: vai do dia seguinte ao fechamento anterior
// até o fechamento. Ex.: cartão que fecha dia 5 → ciclo 06/07 a 05/08 (compra
// em 30/07 e outra em 01/08 caem na MESMA fatura).
//
// `competencia` = 'YYYY-MM' do VENCIMENTO ("fatura de agosto" = vence em
// agosto, igual Nubank/Itaú). Cartão SEM dia_fechamento → mês-calendário.
// =====================================================================

const TZ = 'America/Sao_Paulo';

export interface Ciclo {
  ini:         string;  // 'YYYY-MM-DD' inclusivo
  fim:         string;  // 'YYYY-MM-DD' inclusivo (dia do fechamento)
  fimExcl:     string;  // 'YYYY-MM-DD' EXCLUSIVO (usar em comparação < )
  venc:        string;  // 'YYYY-MM-DD' do vencimento
  competencia: string;  // 'YYYY-MM' do vencimento
  label:       string;  // 'DD/MM a DD/MM'
  porCiclo:    boolean; // false = fallback mês-calendário (sem dia_fechamento)
}

/** Só o que o cálculo precisa de uma wallet de crédito. */
export interface CartaoCiclo {
  dia_fechamento?: number | null;
  dia_vencimento?: number | null;
}

function ultimoDia(Y: number, M0: number): number {
  return new Date(Date.UTC(Y, M0 + 1, 0)).getUTCDate();
}

// Meio-dia UTC evita que fuso/DST empurre a data pro dia vizinho.
function dataUTC(Y: number, M0: number, D: number): Date {
  return new Date(Date.UTC(Y, M0, D, 12));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const ym  = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const dm  = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

/** Hoje no fuso SP como 'YYYY-MM-DD' (NÃO usar toISOString: é UTC e vira o dia errado à noite). */
export function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

function fechamentoDe(Y: number, M0: number, diaFechamento: number | null | undefined): Date {
  const dia = Math.max(1, Math.min(Number(diaFechamento) || 1, 31));
  return dataUTC(Y, M0, Math.min(dia, ultimoDia(Y, M0)));
}

function vencimentoApos(fim: Date, diaVencimento: number | null | undefined): Date {
  const dia = Math.max(1, Math.min(Number(diaVencimento) || 10, 31));
  let Y = fim.getUTCFullYear();
  let M0 = fim.getUTCMonth();
  let v = dataUTC(Y, M0, Math.min(dia, ultimoDia(Y, M0)));
  if (v <= fim) {
    M0 += 1;
    if (M0 > 11) { M0 = 0; Y += 1; }
    v = dataUTC(Y, M0, Math.min(dia, ultimoDia(Y, M0)));
  }
  return v;
}

/** Ciclo cujo FECHAMENTO cai no mês (Y, M0). M0 pode estourar 0..11 (normaliza o ano). */
export function cicloPorFechamento(
  Y: number, M0: number,
  diaFechamento: number | null | undefined,
  diaVencimento: number | null | undefined,
): Ciclo {
  const fim = fechamentoDe(Y, M0, diaFechamento);
  const antY = M0 === 0 ? Y - 1 : Y;
  const antM = M0 === 0 ? 11 : M0 - 1;
  const ini = new Date(fechamentoDe(antY, antM, diaFechamento));
  ini.setUTCDate(ini.getUTCDate() + 1);
  const fimExcl = new Date(fim);
  fimExcl.setUTCDate(fimExcl.getUTCDate() + 1);
  const venc = vencimentoApos(fim, diaVencimento);
  return {
    ini: iso(ini), fim: iso(fim), fimExcl: iso(fimExcl),
    venc: iso(venc), competencia: ym(venc),
    label: `${dm(ini)} a ${dm(fim)}`,
    porCiclo: true,
  };
}

/** Fallback legado: mês-calendário inteiro (cartão sem dia_fechamento). */
export function cicloMesCalendario(comp: string, diaVencimento?: number | null): Ciclo {
  const [Y, M] = comp.split('-').map(Number);
  const M0 = M - 1;
  const ini = dataUTC(Y, M0, 1);
  const fim = dataUTC(Y, M0, ultimoDia(Y, M0));
  const fimExcl = dataUTC(Y, M0 + 1, 1);
  const venc = diaVencimento
    ? dataUTC(Y, M0, Math.min(Math.max(Number(diaVencimento) || 10, 1), ultimoDia(Y, M0)))
    : fim;
  return {
    ini: iso(ini), fim: iso(fim), fimExcl: iso(fimExcl),
    venc: iso(venc), competencia: comp,
    label: `${dm(ini)} a ${dm(fim)}`,
    porCiclo: false,
  };
}

/**
 * Competência da fatura "atual" = a do PRÓXIMO vencimento a partir de hoje.
 * Ex.: fecha 21 / vence 28 — em 26/07 a atual é a que fechou 21/07 (vence
 * 28/07); em 29/07 passa a ser a que fecha 21/08.
 */
export function competenciaAtual(cartao: CartaoCiclo, hojeStr?: string): string {
  const hoje = hojeStr || hojeSP();
  if (!cartao?.dia_fechamento) return hoje.slice(0, 7);
  const [Y, M] = hoje.split('-').map(Number);
  // Começa no ciclo que fechou no mês ANTERIOR: quando o vencimento é antes do
  // fechamento (ex.: fecha 24, vence 5), a fatura que vence hoje fechou no mês
  // passado — começar no mês de hoje pularia ela.
  for (let i = -1; i < 4; i++) {
    const c = cicloPorFechamento(Y, (M - 1) + i, cartao.dia_fechamento, cartao.dia_vencimento);
    if (c.venc >= hoje) return c.competencia;
  }
  return cicloPorFechamento(Y, M - 1, cartao.dia_fechamento, cartao.dia_vencimento).competencia;
}

/** Resolve o ciclo de um cartão para uma competência. Nunca retorna null. */
export function cicloPorCompetencia(cartao: CartaoCiclo, competencia?: string): Ciclo {
  const comp = /^\d{4}-\d{2}$/.test(competencia || '') ? (competencia as string) : hojeSP().slice(0, 7);
  if (!cartao?.dia_fechamento) return cicloMesCalendario(comp, cartao?.dia_vencimento);
  const [Y, M] = comp.split('-').map(Number);
  for (const off of [0, -1, 1, -2]) {
    const c = cicloPorFechamento(Y, (M - 1) + off, cartao.dia_fechamento, cartao.dia_vencimento);
    if (c.competencia === comp) return c;
  }
  return cicloPorFechamento(Y, M - 1, cartao.dia_fechamento, cartao.dia_vencimento);
}

/** Navega entre faturas (delta em ciclos: -1 = anterior, +1 = próxima). */
export function competenciaVizinha(cartao: CartaoCiclo, competencia: string, delta: number): string {
  const base = cicloPorCompetencia(cartao, competencia);
  if (!cartao?.dia_fechamento) {
    const [Y, M] = base.competencia.split('-').map(Number);
    return ym(new Date(Date.UTC(Y, (M - 1) + delta, 1, 12)));
  }
  const [fY, fM] = base.fim.split('-').map(Number);
  return cicloPorFechamento(fY, (fM - 1) + delta, cartao.dia_fechamento, cartao.dia_vencimento).competencia;
}

/** Uma transação (data 'YYYY-MM-DD' ou ISO) cai neste ciclo? */
export function dentroDoCiclo(dataTx: string | null | undefined, ciclo: Ciclo): boolean {
  if (!dataTx) return false;
  const d = String(dataTx).slice(0, 10);
  return d >= ciclo.ini && d < ciclo.fimExcl;
}

/**
 * A transação entra NESTA fatura?
 *
 * Por data (o ciclo) resolve o cartão manual, mas erra no Open Finance quando há
 * PARCELAMENTO: o banco manda as N parcelas com a data da COMPRA, então uma
 * compra de 20/06 em 3× cairia inteira na fatura de junho, quando na verdade se
 * espalha por julho, agosto e setembro. Quem sabe em qual fatura a linha entra é
 * o EMISSOR — e ele diz isso no `of_bill_id` (migration 101).
 *
 * ⚠️ O CRITÉRIO É ESCOLHIDO UMA VEZ POR FATURA, NUNCA POR TRANSAÇÃO.
 *
 * A versão anterior decidia linha a linha: quem tinha `of_bill_id` era julgada
 * pelo vínculo, quem não tinha caía na data. Como o emissor só vincula as
 * compras DEPOIS que a fatura fecha, o ciclo aberto tem transações sem vínculo —
 * e a fatura passava a somar as duas coisas: as compras da fatura vinculada MAIS
 * as compras soltas do ciclo novo. Numa conta real deu R$ 3.143,75 (julho, já
 * pago) + R$ 1.870,24 (agosto) = R$ 5.013,99 onde o banco mostrava R$ 3.423,57.
 *
 * Quem decide o critério é `criterioDaFatura`, chamado uma vez por cartão.
 */
export function pertenceAFatura(
  tx: any,
  cartao: any,
  ciclo: Ciclo,
  ehFaturaAtual: boolean,
  /** Resultado de `criterioDaFatura`. Sem ele, cai no ciclo — nunca mistura. */
  criterio?: 'bill' | 'ciclo',
): boolean {
  if (criterio === 'bill') {
    const alvo = ehFaturaAtual ? cartao?.of_bill_atual : null;
    return !!alvo && tx?.of_bill_id === alvo;
  }
  return dentroDoCiclo(tx?.data, ciclo);
}

/**
 * Qual critério vale pra ESTA fatura deste cartão.
 *
 * Só usa o vínculo do emissor quando ele cobre a fatura inteira: existe uma
 * fatura aberta publicada E as transações dela vieram vinculadas. Se parte veio
 * sem vínculo, a data é o único critério que trata todas igual — melhor um
 * número que erra por menos do que um que soma duas faturas.
 */
export function criterioDaFatura(
  txs: any[],
  cartao: any,
  ehFaturaAtual: boolean,
): 'bill' | 'ciclo' {
  const alvo = ehFaturaAtual ? cartao?.of_bill_atual : null;
  if (!alvo) return 'ciclo';
  const doCartao = (txs || []).filter((t) => t?.of_bill_id);
  if (!doCartao.length) return 'ciclo';
  return doCartao.some((t) => t.of_bill_id === alvo) ? 'bill' : 'ciclo';
}

/** Rótulo humano da fatura: "Agosto de 2026". */
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
               'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export function labelCompetencia(comp: string): string {
  const [Y, M] = comp.split('-').map(Number);
  return `${MESES[(M - 1) % 12]} de ${Y}`;
}

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


/**
 * QUAL DATA DECIDE A FATURA de uma transação.
 *
 * O banco NÃO agrupa pela data da compra: agrupa pela data em que ELE lançou
 * a compra na fatura (`bill_post_date`, "Data de lançamento na fatura" na doc
 * da Celcoin). Compra feita NO DIA DO FECHAMENTO e processada no dia seguinte
 * entra na fatura NOVA — e é aí que a nossa conta divergia da do app.
 *
 * Caso real (cartão `gold`, fecha dia 7): quatro compras de 07/08 com
 * `bill_post_date` 08/08. Pela data da compra caíam na fatura anterior; o
 * banco as cobrou na atual.
 *
 * ⚠️ DUAS GUARDAS, e as duas são obrigatórias:
 *
 * 1. SÓ ATÉ 7 DIAS de diferença. Atraso de processamento é de DIAS — medido
 *    na base: +1 dia domina (327 de 578 divergências). Diferença de semanas
 *    não é atraso, é outra coisa, e mover a linha por causa dela seria chute.
 *
 * 2. NUNCA em parcela que NÓS redistribuímos (`parcela_num > 1`). Nessas, o
 *    `bill_post_date` é o lançamento da compra ORIGINAL, não o daquela
 *    parcela — medido: uma parcela nossa de 03/09 vinha com post_date 07/08,
 *    27 dias ANTES. Sem esta guarda, toda parcela futura seria arrastada pra
 *    fatura de hoje e o valor explodiria.
 *
 * Medido antes de ligar (26 cartões de Open Finance): 3 faturas ficam mais
 * perto do valor que o próprio banco informa, 12 não mudam e NENHUMA piora.
 * Em dois cartões o erro cai de R$ 134,17 → R$ 0,00 e de R$ 182,59 → R$ 5,00.
 */
export function dataDaFatura(tx: {
  data?: string | null; of_bill_post_date?: string | null; parcela_num?: number | null;
} | null | undefined): string {
  const d = String(tx?.data || '').slice(0, 10);
  const p = tx?.of_bill_post_date ? String(tx.of_bill_post_date).slice(0, 10) : null;
  if (!p || !d) return d;
  if (Number(tx?.parcela_num) > 1) return d;
  const delta = Math.abs(Math.round((+new Date(p) - +new Date(d)) / 86400000));
  return delta > 7 ? d : p;
}

/** Uma transação (data 'YYYY-MM-DD' ou ISO) cai neste ciclo? */
export function dentroDoCiclo(dataTx: string | null | undefined, ciclo: Ciclo): boolean {
  if (!dataTx) return false;
  const d = String(dataTx).slice(0, 10);
  return d >= ciclo.ini && d < ciclo.fimExcl;
}

/**
 * Agrupar a fatura pela atribuição do EMISSOR (modo híbrido)?
 *
 * ⚠️ CHAVE DE ROLLBACK. Ligada por padrão; pra voltar ao comportamento antigo
 * basta `NEXT_PUBLIC_FATURA_AGRUPA_BANCO=0` na Vercel — sem deploy, sem
 * reverter commit. Mexe em dinheiro na tela, então tem de dar pra desligar na
 * hora se algum cliente reclamar.
 *
 * Medido antes de ligar (24 faturas com histórico completo): 9 aproximam do
 * total do banco, 12 ficam iguais, 3 pioram. O VALOR exibido não muda em caso
 * nenhum — muda só QUAIS lançamentos aparecem listados.
 */
export const AGRUPA_POR_BANCO = process.env.NEXT_PUBLIC_FATURA_AGRUPA_BANCO !== '0';

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
  criterio?: 'bill' | 'ciclo' | 'hibrido',
  /** Fatura do emissor NESTA competência (of_faturas.of_bill_id). Só o híbrido usa. */
  billId?: string | null,
): boolean {
  if (criterio === 'hibrido') {
    // ⚠️ HÍBRIDO — o banco onde ele opinou, o ciclo onde ele calou.
    //
    // O modo 'bill' é tudo-ou-nada e por isso só serve quando o emissor
    // vinculou a fatura INTEIRA. Medido: só ~14% das linhas chegam com
    // `of_bill_id` (ele só vincula depois do fechamento), então na prática
    // o 'bill' quase nunca podia ser usado e tudo caía na data.
    //
    // Aqui as duas fontes convivem sem se misturar: a linha que o emissor
    // JÁ atribuiu obedece a ele; a que ele ainda não atribuiu obedece ao
    // ciclo. Não há sobreposição — ou a linha tem vínculo, ou não tem.
    //
    // É o que resolve o "total certo, lista somando outra coisa": o banco
    // agrupa pela data em que LANÇOU a compra na fatura (`bill_post_date`),
    // não pela data da compra, e nenhuma regra de data prevê esse atraso.
    //
    // Medido em 24 faturas com histórico completo: 9 aproximam do total do
    // banco, 12 ficam iguais, 3 pioram — as 3 num cartão que não fecha em
    // configuração nenhuma (nem hoje, nem híbrido, nem ciclo deslocado).
    if (billId) {
      if (tx?.of_bill_id) return tx.of_bill_id === billId;
      return dentroDoCiclo(dataDaFatura(tx), ciclo);
    }
    return dentroDoCiclo(dataDaFatura(tx), ciclo);
  }
  if (criterio === 'bill') {
    const alvo = ehFaturaAtual ? cartao?.of_bill_atual : null;
    return !!alvo && tx?.of_bill_id === alvo;
  }
  return dentroDoCiclo(dataDaFatura(tx), ciclo);
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
  /** Ciclo da fatura exibida — usado pra descartar `of_bill_atual` VELHO. */
  ciclo?: Ciclo,
  /** Fatura do emissor NESTA competência (vem de of_faturas). Liga o híbrido. */
  billId?: string | null,
): 'bill' | 'ciclo' | 'hibrido' {
  // ⚠️ O HÍBRIDO VEM PRIMEIRO quando sabemos qual é a fatura do emissor nesta
  // competência. Ele é estritamente melhor que o 'bill': cobre a fatura
  // inteira (o que o emissor não vinculou cai no ciclo), então não precisa da
  // condição de "vinculou tudo" que na prática quase nunca era satisfeita.
  if (AGRUPA_POR_BANCO && billId) return 'hibrido';

  const alvo = ehFaturaAtual ? cartao?.of_bill_atual : null;
  if (!alvo) return 'ciclo';
  const doAlvo = (txs || []).filter((t) => t?.of_bill_id === alvo);
  if (!doAlvo.length) return 'ciclo';

  // ⚠️ `of_bill_atual` pode estar preso numa fatura JÁ VENCIDA: o sync só
  // gravava esse campo quando tinha valor, então uma vez preenchido ele nunca
  // era limpo. Agrupar por uma fatura morta ESCONDE tudo que veio depois do
  // fechamento dela — caso real: fatura fechada em 08/08 listando lançamentos
  // só até 31/07, porque foi até aí que o emissor vinculou.
  //
  // Guarda: se nenhum lançamento daquela fatura cai dentro do ciclo exibido,
  // ela não é a fatura deste ciclo — volta pro período, que nunca esconde nada.
  if (ciclo && !doAlvo.some((t) => dentroDoCiclo(dataDaFatura(t), ciclo))) return 'ciclo';

  return 'bill';
}

/** Rótulo humano da fatura: "Agosto de 2026". */
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
               'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export function labelCompetencia(comp: string): string {
  const [Y, M] = comp.split('-').map(Number);
  return `${MESES[(M - 1) % 12]} de ${Y}`;
}

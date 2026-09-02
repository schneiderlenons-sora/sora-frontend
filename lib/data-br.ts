// =============================================================================
// O DIA de uma transação — sem deslocar fuso.
//
// ⚠️ `transacoes.data` é `timestamptz`, mas guarda DUAS semânticas diferentes,
// e é por isso que este arquivo existe:
//
//   1. DATA PURA — o usuário (ou o sync, ao redistribuir parcelas) escolheu um
//      DIA. O backend grava a string 'YYYY-MM-DD' e o Postgres a coage pra
//      meia-noite UTC: `2026-09-01T00:00:00+00:00`.
//   2. INSTANTE REAL — o extrato do banco traz a hora da compra:
//      `2026-09-01T16:59:40.963+00:00`.
//
// `new Date(v).toLocaleDateString('pt-BR')` — o que a tela fazia — converte
// pro fuso do NAVEGADOR. No Brasil (UTC−3) a meia-noite UTC vira 21h do dia
// ANTERIOR, então toda transação do caso 1 aparecia um dia antes. Foi o bug
// relatado: lançamento feito em 01/09 listado como "31 de ago.".
//
// ⚠️ E NÃO DÁ PRA SÓ FATIAR OS 10 PRIMEIROS CARACTERES. Medido na base (12.000
// transações de 2026): 2.882 (24%) são data pura — que o fatiamento acerta —,
// mas 975 (8,1%) são instante real entre 00:00 e 02:59 UTC, onde o dia em São
// Paulo É o anterior e fatiar erraria pro outro lado. As duas semânticas têm
// volume; a regra precisa separá-las.
//
// Regra: hora exatamente 00:00:00 UTC ⇒ data pura, usa a parte da data.
// Qualquer outra hora ⇒ instante real, converte pra São Paulo.
// (Uma compra real exatamente às 00:00:00,000 UTC seria lida como data pura —
// as 452 linhas de Open Finance nesse formato SÃO data pura, gravadas pelo
// próprio sync, então na prática o falso positivo não existe.)
// =============================================================================

const TZ = 'America/Sao_Paulo';

const SO_DATA   = /^\d{4}-\d{2}-\d{2}$/;
const MEIA_UTC  = /^\d{4}-\d{2}-\d{2}T00:00:00(\.0+)?(Z|\+00:?00)$/;

/** O dia da transação em 'YYYY-MM-DD'. Nunca desloca fuso indevidamente. */
export function diaDe(v: string | Date | null | undefined): string {
  if (!v) return '';
  const s = typeof v === 'string' ? v : v.toISOString();
  if (SO_DATA.test(s) || MEIA_UTC.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleDateString('en-CA', { timeZone: TZ });   // 'YYYY-MM-DD'
}

/**
 * `Date` na meia-noite LOCAL do dia — seguro pra `.getDate()` e pra formatar.
 * ⚠️ Não usar `new Date('YYYY-MM-DD')`: essa forma é interpretada como UTC e
 * traz o bug de volta pela porta dos fundos.
 */
export function dataLocal(v: string | Date | null | undefined): Date {
  const dia = diaDe(v);
  const [y, m, d] = dia.split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

/** Dia do mês (1–31) da transação, no fuso certo. */
export function diaDoMes(v: string | Date | null | undefined): number {
  return dataLocal(v).getDate();
}

/** Formata o DIA da transação em pt-BR. Padrão: "01 de set". */
export function fmtDataBR(
  v: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' },
): string {
  if (!v) return '';
  return dataLocal(v).toLocaleDateString('pt-BR', opts);
}

// =============================================================================
// Compromisso de MAIS DE UM DIA — o lado da tela (eval:agenda-periodo).
//
// Pedido de cliente (nov/2026): um evento de dois dias seguidos teve de ser
// cadastrado duas vezes. O compromisso ganhou um fim opcional (`data_fim`,
// migration 204). A regra canônica é a do backend
// (sora-backend/src/services/compromissoPeriodo.js); aqui fica o que a TELA
// precisa: conferir o "até" antes de salvar (o servidor confere de novo),
// mover o fim junto com o início e mostrar "dia 1 de 2".
//
// O feed manda um evento POR DIA, com `periodo: { dia, total, inicio, fim }`
// e o mesmo `raw` (o compromisso inteiro). Evento de um dia não tem `periodo`.
// =============================================================================

/** Igual ao backend (o eval compara os dois). */
export const MAX_DIAS = 60;

export type Periodo = { dia: number; total: number; inicio: string; fim: string };

const RE_ISO = /^\d{4}-\d{2}-\d{2}$/;

function dataValida(s: string): boolean {
  if (!RE_ISO.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function somarDias(s: string, n: number): string {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}

/** O "até" do formulário. Vazio ou igual ao início = um dia só (null). */
export function validarPeriodo(data: string, dataFim: string | null | undefined):
  { ok: true; dataFim: string | null } | { ok: false; erro: string } {
  const ini = String(data || '').slice(0, 10);
  if (!dataValida(ini)) return { ok: false, erro: 'Escolha a data.' };
  if (dataFim == null || dataFim === '') return { ok: true, dataFim: null };
  const fim = String(dataFim).slice(0, 10);
  if (!dataValida(fim)) return { ok: false, erro: 'A data de fim não é válida.' };
  const n = diasEntre(ini, fim);
  if (n === 0) return { ok: true, dataFim: null };
  if (n < 0) return { ok: false, erro: 'O fim tem que ser depois do início.' };
  if (n + 1 > MAX_DIAS) return { ok: false, erro: `Um evento pode durar até ${MAX_DIAS} dias.` };
  return { ok: true, dataFim: fim };
}

/**
 * A pessoa mudou o INÍCIO no formulário: o fim anda junto, mantendo a duração
 * (um evento de 2 dias continua de 2). Sem fim, segue sem fim.
 */
export function moverFim(inicioAntigo: string, inicioNovo: string, fim: string): string {
  if (!fim || !dataValida(inicioAntigo) || !dataValida(inicioNovo) || !dataValida(fim)) return fim;
  return somarDias(fim, diasEntre(inicioAntigo, inicioNovo));
}

/** Quantos dias vai de `data` a `fim` (contando os dois). */
export const duracaoEmDias = (data: string, fim: string) => diasEntre(data, fim) + 1;

/** A mesma chave pra todos os dias do mesmo compromisso (contar/remover uma vez só). */
export function chaveDoEvento(e: { id: string; periodo?: Periodo | null; raw?: { id?: string } | null }): string {
  return e.periodo && e.raw?.id ? `comp-${e.raw.id}` : e.id;
}

/** Tira os dias repetidos do mesmo compromisso, mantendo o PRIMEIRO da lista. */
export function umPorEvento<T extends { id: string; periodo?: Periodo | null; raw?: { id?: string } | null }>(lista: T[]): T[] {
  const vistos = new Set<string>();
  return lista.filter((e) => {
    const k = chaveDoEvento(e);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/** "27/11" */
export const diaMes = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

/** "Dia 2 de 3" — ou null em evento de um dia. */
export function rotuloDoDia(p?: Periodo | null): string | null {
  return p && p.total > 1 ? `Dia ${p.dia} de ${p.total}` : null;
}

/** Pro resumo do painel: "até 28/11" no 1º dia; "dia 2 de 3" depois. */
export function rotuloCurto(p?: Periodo | null): string | null {
  if (!p || p.total <= 1) return null;
  return p.dia === 1 ? `até ${diaMes(p.fim)}` : `dia ${p.dia} de ${p.total}`;
}

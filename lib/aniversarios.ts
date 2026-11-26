// =============================================================================
// Aniversários e datas comemorativas — o lado da tela (eval:aniversarios).
//
// Pedido de cliente (Tatiane, nov/2026). A regra canônica é a do backend
// (sora-backend/src/services/aniversarios.js); aqui fica o que a TELA precisa
// pra ordenar e mostrar: a próxima data, quantos dias faltam, a idade. O eval
// compara com o backend caso a caso.
// =============================================================================

export type TipoData = 'aniversario' | 'casamento' | 'data';
export type Aniversario = {
  id: string;
  nome: string;
  tipo: TipoData;
  dia: number;
  mes: number;
  ano: number | null;
  lembrete_semana: boolean;
  lembrete_dia: boolean;
  observacao: string | null;
};

export const TIPOS_DATA: Record<TipoData, { rotulo: string; curto: string; emoji: string }> = {
  aniversario: { rotulo: 'Aniversário', curto: 'Aniversário', emoji: '🎂' },
  casamento:   { rotulo: 'Aniversário de casamento', curto: 'Casamento', emoji: '💍' },
  data:        { rotulo: 'Data comemorativa', curto: 'Outra data', emoji: '🎉' },
};

export const MESES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const pad = (n: number) => String(n).padStart(2, '0');
const bissexto = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const diasNoMes = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Quantos dias tem o mês (fevereiro com 29: a data pode ser 29/02). */
export const maxDiaDoMes = (mes: number) => (mes === 2 ? 29 : diasNoMes(2024, mes));

/** A data no ano `y` — 29/02 em ano comum cai em 28/02 (igual ao backend). */
export function dataNoAno(dia: number, mes: number, y: number): string {
  const d = mes === 2 && dia === 29 && !bissexto(y) ? 28 : Math.min(dia, diasNoMes(y, mes));
  return `${y}-${pad(mes)}-${pad(d)}`;
}

export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}

/** A próxima vez que a data acontece (hoje inclusive). Antes do ano informado não conta. */
export function proximaData(a: Pick<Aniversario, 'dia' | 'mes' | 'ano'>, hoje: string): string {
  let y = Number(hoje.slice(0, 4));
  if (a.ano && y <= a.ano) y = a.ano + 1;
  let d = dataNoAno(a.dia, a.mes, y);
  if (d < hoje) d = dataNoAno(a.dia, a.mes, y + 1);
  return d;
}

/** "faz 30 anos" · "10 anos de casados" · "10 anos" — ou null sem ano. */
export function rotuloAnos(a: Pick<Aniversario, 'tipo' | 'ano'>, dataIso: string): string | null {
  if (!a.ano) return null;
  const n = Number(dataIso.slice(0, 4)) - a.ano;
  if (n <= 0) return null;
  const anos = `${n} ${n === 1 ? 'ano' : 'anos'}`;
  if (a.tipo === 'casamento') return `${anos} de casados`;
  if (a.tipo === 'data') return anos;
  return `faz ${anos}`;
}

/** "Hoje" · "Amanhã" · "Em 9 dias". */
export function quandoFalta(dias: number): string {
  if (dias <= 0) return 'Hoje';
  if (dias === 1) return 'Amanhã';
  return `Em ${dias} dias`;
}

/** A lista na ordem de quem vem primeiro, com a próxima data já calculada. */
export function ordenarPorProxima<T extends Aniversario>(lista: T[], hoje: string) {
  return lista
    .map((a) => { const proxima = proximaData(a, hoje); return { a, proxima, dias: diasEntre(hoje, proxima) }; })
    .sort((x, y) => x.dias - y.dias || x.a.nome.localeCompare(y.a.nome, 'pt-BR'));
}

/** "05/12" */
export const diaMesTexto = (a: Pick<Aniversario, 'dia' | 'mes'>) => `${pad(a.dia)}/${pad(a.mes)}`;

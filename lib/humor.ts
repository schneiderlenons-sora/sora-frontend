// =============================================================================
// Registro de humor com DATA — o lado da tela (eval:humor).
//
// Pedido de cliente (Tatiane, nov/2026): "fui dormir depois da meia-noite e,
// ao registrar meu humor, não percebi que o app já considerava o dia
// seguinte". Agora dá pra escolher o dia, corrigir depois, e na MADRUGADA
// (até as 5h) o registro rápido já sugere "ontem" — dizendo isso na tela.
//
// A regra canônica é a do backend (services/humorRegistro.js); o eval
// compara a validação da data com ela.
// =============================================================================

/** Até esta hora, o check-in rápido sugere "ontem" (a pessoa ainda não dormiu). */
export const MADRUGADA_ATE = 5;
/** Igual ao backend: até 1 ano pra trás. */
export const DIAS_PRA_TRAS = 366;

const pad = (n: number) => String(n).padStart(2, '0');

/** A data do APARELHO (não UTC: `toISOString` às 22h já dá o dia seguinte). */
export function dataLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function somarDias(s: string, n: number): string {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type Alvo = 'hoje' | 'ontem';

/** Na madrugada o registro rápido vai pra ontem (e a tela avisa). */
export function alvoPadrao(agora: Date = new Date()): Alvo {
  return agora.getHours() < MADRUGADA_ATE ? 'ontem' : 'hoje';
}

/** "Hoje" · "Ontem" · "qua, 25/11" */
export function rotuloDia(data: string, hoje: string): string {
  if (data === hoje) return 'Hoje';
  if (data === somarDias(hoje, -1)) return 'Ontem';
  return new Date(`${data}T12:00:00Z`)
    .toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' })
    .replace('.', '');
}

/** Erro da data escolhida (null = ok). Mesma regra do servidor. */
export function erroDaData(data: string, hoje: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return 'Data inválida.';
  const d = new Date(`${data}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== data) return 'Data inválida.';
  if (data > hoje) return 'Não dá pra registrar o humor de um dia que ainda não chegou.';
  if (data < somarDias(hoje, -DIAS_PRA_TRAS)) return 'Dá pra registrar até 1 ano pra trás.';
  return null;
}

/** Mais recentes primeiro. */
export function recentesPrimeiro<T extends { data: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => b.data.localeCompare(a.data));
}

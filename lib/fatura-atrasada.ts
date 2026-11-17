// =============================================================================
// Fatura ATRASADA — o que a TELA escreve. A regra (o que está atrasado, passar
// pra próxima) é do backend: `sora-backend/src/services/faturaAtrasada.js`.
// Travado em `npm run eval:fatura-atrasada`.
// =============================================================================

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** '2026-11' → 'novembro' (a fatura leva o nome do mês em que VENCE). */
export function nomeDoMesFatura(competencia: string): string {
  const m = Number(String(competencia || '').slice(5, 7));
  return MESES[m - 1] || competencia;
}

/** '2026-12' → '2027-01'. */
export function mesSeguinteFatura(competencia: string): string {
  const [y, m] = String(competencia).split('-').map(Number);
  if (!y || !m) return competencia;
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** '2026-11-15' → '15/11' */
export function ddmmFatura(dia: string): string {
  return `${String(dia).slice(8, 10)}/${String(dia).slice(5, 7)}`;
}

/** 1 → 'há 1 dia' · 12 → 'há 12 dias' · 0/indefinido → '' */
export function textoDiasAtraso(dias?: number | null): string {
  if (!dias || dias < 1) return '';
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

// =============================================================================
// Histórico de PESO (Saúde do Grow) — o que a tela mostra.
//
// Regra de gravação (validação, data em SP, nada no futuro) é do backend:
// `sora-backend/src/services/pesoRegistro.js`. Aqui só a leitura: ordem,
// variação entre pesagens e a tendência do período. Travado em `eval:peso`.
// =============================================================================

export interface RegistroPeso {
  id: string;
  data: string;            // YYYY-MM-DD
  peso_kg: number | string; // o PostgREST devolve numeric como texto às vezes
  observacao?: string | null;
}

export interface LinhaPeso extends RegistroPeso {
  kg: number;
  /** Diferença pra pesagem ANTERIOR (a de data mais antiga mais próxima). null na primeira. */
  delta: number | null;
  /** Dias desde a pesagem anterior. */
  diasDesde: number | null;
}

/** Hoje em São Paulo (YYYY-MM-DD) — nunca `toISOString()`, que é UTC. */
export function hojeSP(agora: Date = new Date()): string {
  return agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

const dia = (s: string) => String(s).slice(0, 10);
const kgDe = (v: number | string) => Math.round(Number(String(v).replace(',', '.')) * 100) / 100;
const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(`${dia(b)}T12:00:00Z`) - Date.parse(`${dia(a)}T12:00:00Z`)) / 86400000);

/**
 * Lista pra tela: mais RECENTE primeiro, cada linha com a variação em relação
 * à pesagem anterior no tempo (não à linha de cima da lista).
 */
export function linhasDoHistorico(registros: RegistroPeso[] = []): LinhaPeso[] {
  const cronologica = [...registros]
    .filter((r) => r && r.data && Number.isFinite(kgDe(r.peso_kg)))
    .sort((a, b) => dia(a.data).localeCompare(dia(b.data)));
  const out: LinhaPeso[] = cronologica.map((r, i) => {
    const kg = kgDe(r.peso_kg);
    const ant = cronologica[i - 1];
    return {
      ...r,
      data: dia(r.data),
      kg,
      delta: ant ? Math.round((kg - kgDe(ant.peso_kg)) * 100) / 100 : null,
      diasDesde: ant ? diasEntre(ant.data, r.data) : null,
    };
  });
  return out.reverse();
}

/** Variação do período: da pesagem mais antiga à mais recente. null com < 2. */
export function variacaoDoPeriodo(registros: RegistroPeso[] = []): { delta: number; dias: number } | null {
  const l = linhasDoHistorico(registros);
  if (l.length < 2) return null;
  const recente = l[0], antiga = l[l.length - 1];
  return { delta: Math.round((recente.kg - antiga.kg) * 100) / 100, dias: diasEntre(antiga.data, recente.data) };
}

/** 72.5 → "72,5" · 80 → "80" (sem casas desnecessárias). */
export function fmtKg(v: number): string {
  return (Math.round(v * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

/** "+0,4 kg" / "−1,2 kg" / "sem mudança". */
export function fmtDelta(delta: number): string {
  if (Math.abs(delta) < 0.05) return 'sem mudança';
  return `${delta > 0 ? '+' : '−'}${fmtKg(Math.abs(delta))} kg`;
}

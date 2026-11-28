// =============================================================================
// Tarefas: busca e ordem por horário. Puro — eval:tarefas.
// =============================================================================

export type TarefaBusca = {
  titulo?: string | null; descricao?: string | null; categoria?: string | null;
  tags?: string[] | null; projetos?: { nome?: string | null } | null;
};

/** Sem acento, sem caixa e com um espaço só — "reuniao" acha "Reunião". */
export function normalizarBusca(texto?: string | null): string {
  return String(texto || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Cada palavra digitada precisa aparecer em algum lugar da tarefa (título,
 * descrição, categoria, projeto ou tag), em qualquer ordem.
 */
export function casaBusca(tarefa: TarefaBusca, busca: string): boolean {
  const palavras = normalizarBusca(busca).split(' ').filter(Boolean);
  if (!palavras.length) return true;
  const alvo = normalizarBusca([
    tarefa.titulo, tarefa.descricao, tarefa.categoria, tarefa.projetos?.nome, ...(tarefa.tags || []),
  ].filter(Boolean).join(' '));
  return palavras.every((p) => alvo.includes(p));
}

/** Com horário primeiro, na ordem do relógio; sem horário no fim. */
export function compararHora(a: { hora?: string | null }, b: { hora?: string | null }): number {
  return (a.hora || '99:99').localeCompare(b.hora || '99:99');
}

/** "vence hoje" → "vence hoje às 15:00". */
export function comHora(rotulo: string, hora?: string | null): string {
  return hora ? `${rotulo} às ${hora}` : rotulo;
}

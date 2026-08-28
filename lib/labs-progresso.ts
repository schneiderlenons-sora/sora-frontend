// =====================================================================
// Progresso do aluno no Sora Labs — aulas lidas e missões do desafio.
//
// Guardado em localStorage POR USUÁRIO, e não numa tabela: é marcação de
// leitura, não dado financeiro. Uma coluna no banco exigiria migration e
// viraria estado permanente pra algo que, se perdido, custa um toque pra
// remarcar — o CONTEÚDO nunca se perde, só o "já li isto".
//
// Mesmo padrão de `lib/of-intent.ts` e `lib/plan-intent.ts`.
//
// ⚠️ SEM TTL, ao contrário dos dois acima. Progresso de curso não expira: quem
// volta depois de três meses tem de reencontrar o curso onde parou. O que
// existe é a checagem de `userId` — em PC compartilhado o próximo usuário não
// pode herdar o progresso de quem estava logado antes.
//
// ⚠️ TUDO em try/catch: modo privado do Safari e storage cheio LANÇAM em vez de
// devolver null. Sem isso a página do curso quebraria inteira por causa da
// barrinha de progresso.
// =====================================================================

const KEY = 'sora-labs-progresso-v1';

/** `{ [cursoId]: { aulas: string[]; missoes: number[] } }` */
type Curso = { aulas: string[]; missoes: number[] };
type Registro = { userId: string; cursos: Record<string, Curso> };

function ler(userId?: string | null): Registro | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const cru = window.localStorage.getItem(KEY);
    if (!cru) return null;
    const r = JSON.parse(cru) as Registro;
    // Sessão de outra pessoa neste navegador → ignora (não vaza progresso).
    if (!r || r.userId !== userId) return null;
    return r;
  } catch { return null; }
}

function gravar(userId: string, cursos: Record<string, Curso>) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ userId, cursos }));
  } catch { /* modo privado / storage cheio — progresso é best-effort */ }
}

function doCurso(userId: string | null | undefined, cursoId: string): Curso {
  const r = ler(userId);
  const c = r?.cursos?.[cursoId];
  return {
    aulas:   Array.isArray(c?.aulas) ? c!.aulas : [],
    missoes: Array.isArray(c?.missoes) ? c!.missoes : [],
  };
}

/** Aulas concluídas deste curso. */
export function aulasLidas(userId: string | null | undefined, cursoId: string): string[] {
  return doCurso(userId, cursoId).aulas;
}

/** Missões marcadas do desafio de 30 dias. */
export function missoesFeitas(userId: string | null | undefined, cursoId: string): number[] {
  return doCurso(userId, cursoId).missoes;
}

/** Marca/desmarca uma aula. Devolve a lista nova (pra o estado do React). */
export function alternarAula(userId: string | null | undefined, cursoId: string, aulaId: string): string[] {
  const atual = doCurso(userId, cursoId);
  const tem = atual.aulas.includes(aulaId);
  const aulas = tem ? atual.aulas.filter((a) => a !== aulaId) : [...atual.aulas, aulaId];
  if (userId) {
    const r = ler(userId);
    gravar(userId, { ...(r?.cursos || {}), [cursoId]: { ...atual, aulas } });
  }
  return aulas;
}

/** Marca/desmarca uma missão do desafio. */
export function alternarMissao(userId: string | null | undefined, cursoId: string, dia: number): number[] {
  const atual = doCurso(userId, cursoId);
  const tem = atual.missoes.includes(dia);
  const missoes = tem ? atual.missoes.filter((d) => d !== dia) : [...atual.missoes, dia];
  if (userId) {
    const r = ler(userId);
    gravar(userId, { ...(r?.cursos || {}), [cursoId]: { ...atual, missoes } });
  }
  return missoes;
}

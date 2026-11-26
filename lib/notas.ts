// =============================================================================
// Notas do Drive — regras PURAS da tela (eval:notas).
//
// As notas moram na tabela `notas` (a mesma do WhatsApp: "anota que …"). O
// servidor (sora-backend/src/services/notasPainel.js) valida e ordena; aqui fica
// o que a TELA decide: busca, cadernos, prévia do cartão e a lista depois de
// salvar sem esperar o servidor.
// =============================================================================

export type Nota = {
  id: string;
  titulo: string | null;
  texto: string;
  /** O "caderno" da nota (coluna `categoria`). */
  categoria: string | null;
  origem?: 'texto' | 'audio' | string | null;
  fixada?: boolean;
  created_at: string;
  updated_at?: string | null;
};

/** Sem acento, sem caixa, espaços juntos — pra comparar e buscar. */
export function chave(s: string | null | undefined): string {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Quando a nota mudou pela última vez (sem a migration 203, a criação). */
export const momento = (n: Pick<Nota, 'updated_at' | 'created_at'>) => String(n.updated_at || n.created_at || '');

/** Fixadas primeiro; depois a mexida mais recente. Mesma regra do servidor. */
export function ordenarNotas<T extends Nota>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    const fa = a.fixada ? 1 : 0, fb = b.fixada ? 1 : 0;
    if (fa !== fb) return fb - fa;
    return momento(b).localeCompare(momento(a));
  });
}

/** Busca em título, texto e caderno, ignorando acento e caixa. Todas as palavras têm de aparecer. */
export function casaBusca(n: Nota, termo: string): boolean {
  const palavras = chave(termo).split(' ').filter(Boolean);
  if (!palavras.length) return true;
  const alvo = chave(`${n.titulo || ''} ${n.texto || ''} ${n.categoria || ''}`);
  return palavras.every((p) => alvo.includes(p));
}

export type Filtro = { termo?: string; caderno?: string | null; soFixadas?: boolean };

export function filtrarNotas<T extends Nota>(lista: T[], f: Filtro): T[] {
  const cad = f.caderno ? chave(f.caderno) : null;
  return lista.filter((n) =>
    (!f.soFixadas || !!n.fixada)
    && (!cad || chave(n.categoria) === cad)
    && casaBusca(n, f.termo || ''));
}

/**
 * Os cadernos que existem, com quantas notas cada um. "Trabalho" e "trabalho"
 * são o MESMO caderno; o nome mostrado é a grafia mais usada.
 */
export function cadernos(lista: Nota[]): { nome: string; quantidade: number }[] {
  const grupos = new Map<string, { contagem: Map<string, number>; total: number }>();
  for (const n of lista) {
    const nome = (n.categoria || '').trim();
    if (!nome) continue;
    const k = chave(nome);
    const g = grupos.get(k) || { contagem: new Map(), total: 0 };
    g.contagem.set(nome, (g.contagem.get(nome) || 0) + 1);
    g.total++;
    grupos.set(k, g);
  }
  return [...grupos.values()]
    .map((g) => {
      const nome = [...g.contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
      return { nome, quantidade: g.total };
    })
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * O que o cartão mostra. Sem título, a 1ª linha do texto vira o título e a
 * prévia segue dali — o cartão nunca repete a mesma frase duas vezes.
 */
export function cabecalhoDaNota(n: Pick<Nota, 'titulo' | 'texto'>): { titulo: string; previa: string } {
  const texto = String(n.texto || '');
  const titulo = (n.titulo || '').trim();
  if (titulo) return { titulo, previa: texto.trim() };
  const linhas = texto.split('\n');
  const i = linhas.findIndex((l) => l.trim());
  if (i < 0) return { titulo: 'Nota sem título', previa: '' };
  return { titulo: linhas[i].trim(), previa: linhas.slice(i + 1).join('\n').trim() };
}

/** Palavras do texto (pro rodapé do editor). */
export function contarPalavras(s: string): number {
  const t = String(s || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Coloca a nota salva na lista (nova ou atualizada) e reordena. */
export function comNota<T extends Nota>(lista: T[] | undefined, nota: T): T[] {
  const sem = (lista || []).filter((n) => n.id !== nota.id);
  return ordenarNotas([nota, ...sem]);
}

/** Tira a nota da lista. */
export function semNota<T extends Nota>(lista: T[] | undefined, id: string): T[] {
  return (lista || []).filter((n) => n.id !== id);
}

/** "agora", "5 min", "3 h", "ontem", "12/11". */
export function quandoMudou(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const min = Math.floor((agora.getTime() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dia = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const ontem = new Date(agora.getTime() - 86400000);
  if (dia(d) === dia(ontem)) return 'ontem';
  const mesmoAno = dia(d).slice(0, 4) === dia(agora).slice(0, 4);
  return d.toLocaleDateString('pt-BR', mesmoAno
    ? { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }
    : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}

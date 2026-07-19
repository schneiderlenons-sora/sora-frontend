// ─────────────────────────────────────────────────────────────────────────────
// Conteúdo ESTÁTICO da seção Bíblia (Estudos do Grow) — planos de leitura por
// REFERÊNCIA (sem o texto completo da Bíblia; o usuário lê na sua Bíblia/app) e
// versículos do dia curados. Cristão, sem viés de denominação.
//
// Planos "gerados" dividem capítulos de livros em N dias automaticamente;
// planos "fixos" (temáticos) trazem a referência de cada dia à mão.
// ─────────────────────────────────────────────────────────────────────────────

export type PlanoDia = { dia: number; referencia: string };
export type Plano = {
  id: string;
  nome: string;
  descricao: string;
  emoji: string;
  categoria: 'trilha' | 'livro' | 'tematico';
  duracaoDias: number;
  // Só um dos dois: `livros` (gerado) OU `diasFixos` (temático).
  livros?: { nome: string; caps: number }[];
  diasFixos?: string[];
};

// Divide uma lista de "livro + nº de capítulos" em `dias` leituras diárias,
// agrupando capítulos contíguos (ex.: "Mateus 1–3"). Distribui o resto de forma
// equilibrada nos primeiros dias.
function gerarDias(livros: { nome: string; caps: number }[], dias: number): PlanoDia[] {
  // Sequência linear de todos os capítulos: [{livro, cap}, ...]
  const seq: { livro: string; cap: number }[] = [];
  livros.forEach(l => { for (let c = 1; c <= l.caps; c++) seq.push({ livro: l.nome, cap: c }); });

  const total = seq.length;
  const base = Math.floor(total / dias);
  const resto = total % dias;

  const out: PlanoDia[] = [];
  let i = 0;
  for (let d = 0; d < dias; d++) {
    const qtd = base + (d < resto ? 1 : 0);
    const bloco = seq.slice(i, i + qtd);
    i += qtd;
    out.push({ dia: d + 1, referencia: rotularBloco(bloco) });
  }
  return out;
}

// "Mateus 1–3", "Mateus 28 · Marcos 1", "Salmos 119" — legível e compacto.
function rotularBloco(bloco: { livro: string; cap: number }[]): string {
  if (!bloco.length) return '—';
  const partes: string[] = [];
  let li = 0;
  while (li < bloco.length) {
    const livro = bloco[li].livro;
    let fim = li;
    while (fim + 1 < bloco.length && bloco[fim + 1].livro === livro && bloco[fim + 1].cap === bloco[fim].cap + 1) fim++;
    const a = bloco[li].cap, b = bloco[fim].cap;
    partes.push(`${livro} ${a}${b > a ? `–${b}` : ''}`);
    li = fim + 1;
  }
  return partes.join(' · ');
}

// Retorna as leituras diárias de um plano (gerado ou fixo).
export function diasDoPlano(p: Plano): PlanoDia[] {
  if (p.diasFixos) return p.diasFixos.map((referencia, i) => ({ dia: i + 1, referencia }));
  if (p.livros) return gerarDias(p.livros, p.duracaoDias);
  return [];
}

// ─── Catálogo de planos ──────────────────────────────────────────────────────
export const PLANOS: Plano[] = [
  {
    id: 'evangelhos-40',
    nome: 'Evangelhos em 40 dias',
    descricao: 'A vida e os ensinos de Jesus, de Mateus a João.',
    emoji: '✝️', categoria: 'trilha', duracaoDias: 40,
    livros: [{ nome: 'Mateus', caps: 28 }, { nome: 'Marcos', caps: 16 }, { nome: 'Lucas', caps: 24 }, { nome: 'João', caps: 21 }],
  },
  {
    id: 'nt-90',
    nome: 'Novo Testamento em 90 dias',
    descricao: 'Todo o Novo Testamento em três meses, no seu ritmo.',
    emoji: '📖', categoria: 'trilha', duracaoDias: 90,
    livros: [
      { nome: 'Mateus', caps: 28 }, { nome: 'Marcos', caps: 16 }, { nome: 'Lucas', caps: 24 }, { nome: 'João', caps: 21 },
      { nome: 'Atos', caps: 28 }, { nome: 'Romanos', caps: 16 }, { nome: '1 Coríntios', caps: 16 }, { nome: '2 Coríntios', caps: 13 },
      { nome: 'Gálatas', caps: 6 }, { nome: 'Efésios', caps: 6 }, { nome: 'Filipenses', caps: 4 }, { nome: 'Colossenses', caps: 4 },
      { nome: '1 Tessalonicenses', caps: 5 }, { nome: '2 Tessalonicenses', caps: 3 }, { nome: '1 Timóteo', caps: 6 }, { nome: '2 Timóteo', caps: 4 },
      { nome: 'Tito', caps: 3 }, { nome: 'Filemom', caps: 1 }, { nome: 'Hebreus', caps: 13 }, { nome: 'Tiago', caps: 5 },
      { nome: '1 Pedro', caps: 5 }, { nome: '2 Pedro', caps: 3 }, { nome: '1 João', caps: 5 }, { nome: '2 João', caps: 1 },
      { nome: '3 João', caps: 1 }, { nome: 'Judas', caps: 1 }, { nome: 'Apocalipse', caps: 22 },
    ],
  },
  {
    id: 'proverbios-31',
    nome: 'Provérbios em 31 dias',
    descricao: 'Um capítulo de sabedoria por dia — combina com o mês.',
    emoji: '🦉', categoria: 'livro', duracaoDias: 31,
    livros: [{ nome: 'Provérbios', caps: 31 }],
  },
  {
    id: 'salmos-60',
    nome: 'Salmos em 60 dias',
    descricao: 'Orações e louvores para todo tipo de dia.',
    emoji: '🎵', categoria: 'livro', duracaoDias: 60,
    livros: [{ nome: 'Salmos', caps: 150 }],
  },
  {
    id: 'genesis-25',
    nome: 'Gênesis em 25 dias',
    descricao: 'O começo de tudo: criação, promessas e histórias marcantes.',
    emoji: '🌍', categoria: 'livro', duracaoDias: 25,
    livros: [{ nome: 'Gênesis', caps: 50 }],
  },
  // ── Temáticos (7 dias) ──
  {
    id: 'tema-ansiedade',
    nome: 'Paz na ansiedade',
    descricao: '7 dias de textos para acalmar o coração.',
    emoji: '🕊️', categoria: 'tematico', duracaoDias: 7,
    diasFixos: ['Filipenses 4:4-9', 'Mateus 6:25-34', 'Salmos 23', 'Salmos 46', '1 Pedro 5:6-7', 'João 14:25-27', 'Isaías 41:10'],
  },
  {
    id: 'tema-fe',
    nome: 'Fortalecendo a fé',
    descricao: '7 dias sobre confiar mesmo sem ver.',
    emoji: '⭐', categoria: 'tematico', duracaoDias: 7,
    diasFixos: ['Hebreus 11', 'Marcos 9:14-29', 'Romanos 10:9-17', 'Tiago 1:2-8', 'Mateus 17:14-20', 'Habacuque 3:17-19', '2 Coríntios 5:1-10'],
  },
  {
    id: 'tema-gratidao',
    nome: 'Coração grato',
    descricao: '7 dias para enxergar as bênçãos de cada dia.',
    emoji: '🙏', categoria: 'tematico', duracaoDias: 7,
    diasFixos: ['Salmos 100', '1 Tessalonicenses 5:16-18', 'Salmos 103', 'Colossenses 3:15-17', 'Lucas 17:11-19', 'Salmos 136:1-9', 'Filipenses 4:10-13'],
  },
  {
    id: 'tema-perdao',
    nome: 'O poder do perdão',
    descricao: '7 dias sobre perdoar e ser perdoado.',
    emoji: '💛', categoria: 'tematico', duracaoDias: 7,
    diasFixos: ['Mateus 18:21-35', 'Efésios 4:25-32', 'Colossenses 3:12-14', 'Lucas 15:11-32', 'Salmos 32', 'Mateus 6:9-15', '1 João 1:5-10'],
  },
];

export function planoPorId(id?: string | null): Plano | undefined {
  return PLANOS.find(p => p.id === id) || undefined;
}

// ─── Versículo do dia (curado, rotativo por dia do ano) ──────────────────────
export type Versiculo = { ref: string; texto: string };

export const VERSICULOS: Versiculo[] = [
  { ref: 'Filipenses 4:13', texto: 'Posso todas as coisas naquele que me fortalece.' },
  { ref: 'Salmos 23:1', texto: 'O Senhor é o meu pastor; nada me faltará.' },
  { ref: 'João 3:16', texto: 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.' },
  { ref: 'Provérbios 3:5-6', texto: 'Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento. Reconhece-o em todos os teus caminhos, e ele endireitará as tuas veredas.' },
  { ref: 'Josué 1:9', texto: 'Sê forte e corajoso; não temas, nem te espantes, porque o Senhor, teu Deus, é contigo por onde quer que andares.' },
  { ref: 'Isaías 41:10', texto: 'Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus; eu te fortaleço, e te ajudo, e te sustento.' },
  { ref: 'Salmos 46:1', texto: 'Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.' },
  { ref: 'Mateus 11:28', texto: 'Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.' },
  { ref: 'Jeremias 29:11', texto: 'Porque eu bem sei os pensamentos que penso de vós, pensamentos de paz e não de mal, para vos dar o fim que esperais.' },
  { ref: 'Romanos 8:28', texto: 'Todas as coisas contribuem juntamente para o bem daqueles que amam a Deus.' },
  { ref: 'Salmos 37:5', texto: 'Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.' },
  { ref: 'Filipenses 4:6-7', texto: 'Não estejais inquietos por coisa alguma; antes, as vossas petições sejam em tudo conhecidas diante de Deus, e a paz de Deus guardará os vossos corações.' },
  { ref: '1 Coríntios 13:4-7', texto: 'O amor é sofredor, é benigno; o amor não é invejoso; não trata com leviandade, não se ensoberbece.' },
  { ref: 'Salmos 121:1-2', texto: 'Elevo os meus olhos para os montes; de onde me virá o socorro? O meu socorro vem do Senhor, que fez o céu e a terra.' },
  { ref: 'Mateus 6:33', texto: 'Buscai primeiro o Reino de Deus e a sua justiça, e todas estas coisas vos serão acrescentadas.' },
  { ref: 'Salmos 91:1-2', texto: 'Aquele que habita no esconderijo do Altíssimo descansará à sombra do Onipotente.' },
  { ref: 'Gálatas 5:22-23', texto: 'O fruto do Espírito é amor, alegria, paz, longanimidade, benignidade, bondade, fé, mansidão, temperança.' },
  { ref: 'Provérbios 16:3', texto: 'Confia ao Senhor as tuas obras, e os teus pensamentos serão estabelecidos.' },
  { ref: 'Salmos 34:8', texto: 'Provai e vede que o Senhor é bom; bem-aventurado o homem que nele confia.' },
  { ref: 'Isaías 40:31', texto: 'Os que esperam no Senhor renovarão as suas forças; subirão com asas como águias; correrão e não se cansarão.' },
  { ref: 'João 14:27', texto: 'Deixo-vos a paz, a minha paz vos dou; não vo-la dou como o mundo a dá. Não se turbe o vosso coração, nem se atemorize.' },
  { ref: '1 Pedro 5:7', texto: 'Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.' },
  { ref: 'Salmos 27:1', texto: 'O Senhor é a minha luz e a minha salvação; a quem temerei?' },
  { ref: 'Miquéias 6:8', texto: 'Ele te declarou o que é bom: que pratiques a justiça, e ames a misericórdia, e andes humildemente com o teu Deus.' },
  { ref: 'Romanos 12:12', texto: 'Alegrai-vos na esperança, sede pacientes na tribulação, perseverai na oração.' },
  { ref: 'Salmos 143:8', texto: 'Faze-me ouvir a tua benignidade pela manhã, pois em ti confio; mostra-me o caminho por onde devo andar.' },
  { ref: 'Colossenses 3:23', texto: 'E tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor e não aos homens.' },
  { ref: 'Salmos 118:24', texto: 'Este é o dia que fez o Senhor; regozijemo-nos e alegremo-nos nele.' },
  { ref: 'Provérbios 4:23', texto: 'Sobre tudo o que se deve guardar, guarda o teu coração, porque dele procedem as fontes da vida.' },
  { ref: 'Efésios 2:8', texto: 'Pela graça sois salvos, por meio da fé; e isto não vem de vós; é dom de Deus.' },
  { ref: 'Salmos 55:22', texto: 'Lança o teu cuidado sobre o Senhor, e ele te susterá; nunca permitirá que o justo seja abalado.' },
  { ref: 'Lamentações 3:22-23', texto: 'As misericórdias do Senhor são a causa de não sermos consumidos; renovam-se cada manhã. Grande é a tua fidelidade.' },
];

// Versículo do dia — determinístico pelo dia do ano (todo mundo vê o mesmo hoje).
export function versiculoDoDia(d: Date = new Date()): Versiculo {
  const inicio = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - inicio.getTime();
  const diaDoAno = Math.floor(diff / 86400000);
  return VERSICULOS[diaDoAno % VERSICULOS.length];
}

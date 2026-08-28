// ─────────────────────────────────────────────────────────────────────────
// Catálogo do Sora Labs — biblioteca de conteúdos em LEITURA (sem vídeo).
// Por enquanto todas as capas são placeholders ("em breve"): os conteúdos
// reais ainda serão produzidos. Mantém os mesmos covers/estilo da landing.
// ─────────────────────────────────────────────────────────────────────────
import {
  GraduationCap, CreditCard, Heart, Brain, TrendingUp, PiggyBank,
  Moon, Target, Briefcase, Rocket, Leaf, Wallet, Dumbbell, BookOpen,
} from 'lucide-react';

export type LabCurso = {
  id:       string;
  titulo:   string;
  tag:      string;     // categoria curta no topo do card
  meta:     string;     // ex.: "12 capítulos · 2h de leitura"
  desc:     string;
  cor:      string;     // hex base do gradient
  corDark:  string;     // hex escuro do gradient
  corGlow:  string;     // rgba do halo no hover
  icon:     any;
  destaque?: boolean;   // aparece também na fileira "Em destaque"
};

export type LabCategoria = { id: string; nome: string; emoji: string; cursos: LabCurso[] };

export const CATEGORIAS: LabCategoria[] = [
  {
    id: 'financas',
    nome: 'Finanças',
    emoji: '💸',
    cursos: [
      {
        id: 'domine-vida-financeira',
        titulo: 'Domine sua vida financeira',
        tag: 'Curso · Finanças',
        // ⚠️ `meta` bate com o conteúdo REAL (lib/labs-conteudo): 9 aulas,
        // 75 min somados. Estava "12 capítulos · 2h" de quando era placeholder
        // — prometer 2h e entregar 1h15 é o tipo de detalhe que faz a pessoa
        // desconfiar do resto.
        meta: '9 aulas · 1h15 de leitura',
        desc: 'Do zero ao controle: organize contas, monte sua reserva e saia do vermelho de uma vez.',
        cor: '#61ce70', corDark: '#1f6f3d', corGlow: 'rgba(97, 206, 112, 0.45)',
        icon: GraduationCap, destaque: true,
      },
      {
        id: 'cartao-a-seu-favor',
        titulo: 'Cartão de crédito a seu favor',
        tag: 'Curso · Crédito',
        meta: '8 capítulos · 1h20 de leitura',
        desc: 'Use limite, pontos e cashback como alavanca. Nunca mais pague juros à toa.',
        cor: '#3b82f6', corDark: '#1d3a8a', corGlow: 'rgba(59, 130, 246, 0.45)',
        icon: CreditCard, destaque: true,
      },
      {
        id: 'investir-do-zero',
        titulo: 'Investir do zero sem medo',
        tag: 'Curso · Investimentos',
        meta: '10 capítulos · guia prático',
        desc: 'Renda fixa, fundos, ações e cripto explicados de forma simples. Comece com R$30.',
        cor: '#14b8a6', corDark: '#0f5e57', corGlow: 'rgba(20, 184, 166, 0.45)',
        icon: TrendingUp,
      },
      {
        id: 'sair-das-dividas',
        titulo: 'Saia das dívidas em 90 dias',
        tag: 'Desafio · Finanças',
        meta: '90 dias · passo a passo',
        desc: 'Método de quitação, negociação com bancos e um plano semanal pra zerar tudo.',
        cor: '#22c55e', corDark: '#14532d', corGlow: 'rgba(34, 197, 94, 0.45)',
        icon: PiggyBank,
      },
    ],
  },
  {
    id: 'saude',
    nome: 'Saúde & Bem-estar',
    emoji: '❤️',
    cursos: [
      {
        id: 'desafio-10kg',
        titulo: 'Desafio: 10kg em 30 dias',
        tag: 'Desafio · Saúde',
        meta: '30 dias · cardápio diário',
        desc: 'Plano alimentar dia a dia, treinos curtos e checkpoints. Emagreça com saúde.',
        cor: '#f97316', corDark: '#9a3412', corGlow: 'rgba(249, 115, 22, 0.45)',
        icon: Heart, destaque: true,
      },
      {
        id: 'sono-reparador',
        titulo: 'Sono reparador',
        tag: 'Guia · Saúde',
        meta: '6 capítulos · 40min',
        desc: 'Higiene do sono, rotina noturna e ajustes que melhoram seu descanso já na 1ª semana.',
        cor: '#6366f1', corDark: '#312e81', corGlow: 'rgba(99, 102, 241, 0.45)',
        icon: Moon,
      },
      {
        id: 'mente-em-paz',
        titulo: 'Mente em paz: ansiedade no controle',
        tag: 'Curso · Bem-estar',
        meta: '8 capítulos · práticas guiadas',
        desc: 'Técnicas de respiração, gestão de estresse e hábitos pra uma cabeça mais leve.',
        cor: '#10b981', corDark: '#065f46', corGlow: 'rgba(16, 185, 129, 0.45)',
        icon: Leaf,
      },
      {
        id: 'corpo-em-movimento',
        titulo: 'Corpo em movimento em casa',
        tag: 'Desafio · Treino',
        meta: '21 dias · sem equipamento',
        desc: 'Treinos de 15 minutos pra fazer em casa, com progressão semanal. Sem academia.',
        cor: '#ef4444', corDark: '#7f1d1d', corGlow: 'rgba(239, 68, 68, 0.45)',
        icon: Dumbbell,
      },
    ],
  },
  {
    id: 'produtividade',
    nome: 'Produtividade & Foco',
    emoji: '🎯',
    cursos: [
      {
        id: 'anti-procrastinacao',
        titulo: 'Organização anti-procrastinação',
        tag: 'Curso · Produtividade',
        meta: '6 capítulos · 45min',
        desc: 'Sistema de rotina e foco pra quem sempre adia. Comece pequeno, mantenha grande.',
        cor: '#8b5cf6', corDark: '#4c1d95', corGlow: 'rgba(139, 92, 246, 0.45)',
        icon: Brain, destaque: true,
      },
      {
        id: 'rotina-matinal',
        titulo: 'A rotina matinal perfeita',
        tag: 'Guia · Hábitos',
        meta: '5 capítulos · 30min',
        desc: 'Monte uma manhã que dá energia e direção pro dia — adaptada à sua realidade.',
        cor: '#f59e0b', corDark: '#92400e', corGlow: 'rgba(245, 158, 11, 0.45)',
        icon: Target,
      },
      {
        id: 'foco-profundo',
        titulo: 'Foco profundo na era das distrações',
        tag: 'Curso · Foco',
        meta: '7 capítulos · 1h',
        desc: 'Recupere sua atenção: blocos de foco, gestão do celular e ambiente sem ruído.',
        cor: '#0ea5e9', corDark: '#0c4a6e', corGlow: 'rgba(14, 165, 233, 0.45)',
        icon: BookOpen,
      },
    ],
  },
  {
    id: 'negocios',
    nome: 'Negócios & Renda extra',
    emoji: '🚀',
    cursos: [
      {
        id: 'comece-seu-negocio',
        titulo: 'Comece seu negócio do zero',
        tag: 'Curso · Negócios',
        meta: '10 capítulos · guia completo',
        desc: 'Da ideia ao primeiro cliente: validação, precificação e os erros que quebram quem começa.',
        cor: '#06b6d4', corDark: '#155e75', corGlow: 'rgba(6, 182, 212, 0.45)',
        icon: Rocket,
      },
      {
        id: 'renda-extra-digital',
        titulo: 'Renda extra no digital',
        tag: 'Curso · Renda extra',
        meta: '8 capítulos · prático',
        desc: 'Formas reais de faturar online no seu tempo livre — sem promessas mágicas.',
        cor: '#d946ef', corDark: '#701a75', corGlow: 'rgba(217, 70, 239, 0.45)',
        icon: Wallet,
      },
      {
        id: 'mei-descomplicado',
        titulo: 'MEI descomplicado',
        tag: 'Guia · Negócios',
        meta: '5 capítulos · passo a passo',
        desc: 'Abra seu MEI, emita nota e organize impostos sem dor de cabeça.',
        cor: '#64748b', corDark: '#1e293b', corGlow: 'rgba(100, 116, 139, 0.4)',
        icon: Briefcase,
      },
    ],
  },
];

/** Lista plana — o leitor (`/labs/[curso]`) resolve o id por aqui. */
export const TODOS_CURSOS: LabCurso[] = CATEGORIAS.flatMap(c => c.cursos);

// Fileira "Em destaque" — os marcados com destaque (mesmas capas da landing).
export const DESTAQUES: LabCurso[] = TODOS_CURSOS.filter(c => c.destaque);

export const TOTAL_CURSOS = TODOS_CURSOS.length;

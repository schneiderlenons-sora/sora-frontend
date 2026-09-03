import type { Feature } from '@/lib/plans';

// =============================================================================
// Catálogo da sidebar — FONTE ÚNICA da navegação do app.
//
// Mesmo padrão do `lib/negocios-nav.ts`: o ícone entra pelo NOME, não pelo
// componente. Assim este arquivo não arrasta a árvore do lucide e pode ser lido
// no servidor (prefetch, testes) sem custo de bundle.
//
// ── Hierarquia ───────────────────────────────────────────────────────────────
//   grupo (colapsável) → subgrupo (cabeçalho com ponto de cor) → itens
//
// FINANÇAS e GROW colapsam e guardam o estado; AJUSTES e SUA CONTA são seções
// planas, sempre visíveis — são o destino de quem está PROCURANDO alguma coisa,
// e esconder atrás de mais um clique só atrapalharia.
//
// ⚠️ CADA ITEM APARECE UMA VEZ SÓ. "Dívidas e Parcelas" chegou a ser pedida em
// Finanças E em Analisar, e "Agentes" em Planejar E no bloco fixo. Item repetido
// destrói a noção de "onde eu estava" e quebra `nav-hierarchy`: Dívidas ficou em
// Finanças (é onde se registra) e Agentes só no bloco fixo do rodapé.
//
// ── Sobre o `tom` ────────────────────────────────────────────────────────────
// ⚠️ O FUNDO DA SIDEBAR É A COR DA MARCA (`--primary`), não um cinza claro como
// nos apps de referência — e a marca tem 6 paletas (verde, azul, roxo, laranja,
// rosa, vermelho) mais o tema black. Ícone colorido sobre fundo saturado quebra:
// verde SOME na paleta verde, laranja VIBRA na vermelha. Nenhuma escolha de tom
// salva as seis ao mesmo tempo.
//
// Por isso a cor não vai no ícone. Vai no `tom` do subgrupo, usado em dois
// lugares onde é decorativa e nunca carrega informação sozinha:
//   · o PONTO do cabeçalho (sólido, então o matiz lê de verdade);
//   · a ESPINHA vertical de 1px à esquerda da pilha de itens.
// São pastéis de luminosidade alta (L ≈ 85%): contrastam por CLAREZA, não por
// matiz, então funcionam sobre as seis paletas e sobre o preto. O rótulo em
// texto sempre acompanha (`color-not-only`).
// =============================================================================

export type ItemNav = {
  href:    string;
  label:   string;
  icone:   string;                     // nome do ícone lucide
  gate?:   Feature;                    // feature exigida
  badge?:  'Premium' | 'Platinum';     // rótulo quando bloqueado
  breve?:  boolean;                    // aba futura: mostra, não navega
  externa?: boolean;                   // href com query (não casa por igualdade)
};

export type SubgrupoNav = {
  id:     string;
  titulo: string;
  /** Pastel do ponto e da espinha. Ver a nota sobre `tom` acima. */
  tom:    string;
  itens:  ItemNav[];
};

export type GrupoNav = {
  id:          string;
  titulo:      string;
  /** Colapsa e guarda o estado (FINANÇAS e GROW). */
  colapsavel:  boolean;
  /** O grupo inteiro exige acesso ao Sora Grow. */
  grow?:       boolean;
  subgrupos:   SubgrupoNav[];
};

// ── Topo: fora de qualquer grupo ────────────────────────────────────────────
// ⚠️ Negócios fica AQUI, não dentro de Finanças: não é uma aba de finanças
// pessoais, é a porta de outro painel (tem switcher e navegação próprios).
// Enterrá-lo num grupo colapsado esconderia a feature mais cara do produto.
export const NAV_TOPO: ItemNav[] = [
  { href: '/dashboard', label: 'Dashboard', icone: 'LayoutDashboard' },
  { href: '/negocios',  label: 'Negócios',  icone: 'Briefcase', gate: 'negocios', badge: 'Platinum' },
];

export const GRUPOS: GrupoNav[] = [
  {
    id: 'financas', titulo: 'Finanças', colapsavel: true,
    subgrupos: [
      {
        id: 'dia-a-dia', titulo: 'Dia a dia', tom: '#A7F3D0',
        itens: [
          { href: '/transacoes',        label: 'Transações',         icone: 'ArrowLeftRight' },
          { href: '/contas-bancarias',  label: 'Contas',             icone: 'Landmark' },
          { href: '/cartao-de-credito', label: 'Cartão de crédito',  icone: 'CreditCard' },
          { href: '/open-finance',      label: 'Open Finance',       icone: 'Building2' },
          { href: '/dividas',           label: 'Dívidas e Parcelas', icone: 'Receipt' },
        ],
      },
      {
        id: 'planejar', titulo: 'Planejar', tom: '#BFDBFE',
        itens: [
          { href: '/metas',             label: 'Metas',      icone: 'Flag' },
          { href: '/limites-de-gastos', label: 'Limites',    icone: 'Target' },
          { href: '/relatorios',        label: 'Relatórios', icone: 'BarChart2' },
        ],
      },
      {
        id: 'analisar', titulo: 'Analisar', tom: '#FDE68A',
        itens: [
          { href: '/categorias',    label: 'Categorias',           icone: 'Tag' },
          { href: '/investimentos', label: 'Investimentos',        icone: 'TrendingUp', gate: 'investimentos', badge: 'Premium' },
          { href: '/juros',         label: 'Calculadora de Juros', icone: 'Percent' },
        ],
      },
    ],
  },
  {
    id: 'grow', titulo: 'Grow', colapsavel: true, grow: true,
    subgrupos: [
      {
        id: 'rotina', titulo: 'Rotina', tom: '#DDD6FE',
        itens: [
          { href: '/grow/habitos',   label: 'Hábitos',   icone: 'Target' },
          { href: '/grow/tarefas',   label: 'Tarefas',   icone: 'ListChecks' },
          { href: '/grow/agenda',    label: 'Agenda',    icone: 'CalendarDays' },
          { href: '/grow/estudos',   label: 'Estudos',   icone: 'GraduationCap', gate: 'grow_estudos', badge: 'Premium' },
          { href: '/grow/saude',     label: 'Saúde',     icone: 'Activity',      gate: 'grow_saude',   badge: 'Premium' },
          { href: '/grow/bem-estar', label: 'Bem-estar', icone: 'Heart' },
        ],
      },
      {
        id: 'organizacao', titulo: 'Organização', tom: '#FBCFE8',
        itens: [
          { href: '/grow/casa',     label: 'Casa',            icone: 'Home',         gate: 'grow_casa',     badge: 'Premium' },
          { href: '/grow/viagens',  label: 'Viagens',         icone: 'Plane',        gate: 'grow_colecoes', badge: 'Premium' },
          { href: '/grow/midia',    label: 'Filmes & Séries', icone: 'Clapperboard', gate: 'grow_colecoes', badge: 'Premium' },
          { href: '/grow/leituras', label: 'Leituras',        icone: 'BookOpen',     gate: 'grow_colecoes', badge: 'Premium' },
        ],
      },
    ],
  },
];

// ── Seções planas, depois dos grupos ────────────────────────────────────────
export const SECOES: SubgrupoNav[] = [
  {
    id: 'ajustes', titulo: 'Ajustes', tom: '#E2E8F0',
    itens: [
      // ⚠️ O antigo item "Compartilhamento" (/grow/configuracoes) saiu do grupo
      // Grow: virou uma SEÇÃO dentro da Gestão compartilhada, que é onde quem
      // divide a conta já está mexendo. Ter dois lugares pra dividir a mesma
      // coisa era exatamente o que confundia.
      { href: '/comunidade',   label: 'Gestão compartilhada', icone: 'Users', gate: 'compartilhamento', badge: 'Premium' },
      { href: '/planos',       label: 'Planos',               icone: 'Zap' },
      { href: '/reportar-bug', label: 'Relatar um problema',  icone: 'Bug' },
      { href: '/configuracoes?aba=aparencia', label: 'Aparência', icone: 'Palette', externa: true },
    ],
  },
  {
    id: 'conta', titulo: 'Sua conta', tom: '#FED7AA',
    itens: [
      { href: '/wrapped', label: 'Sora Wrapped', icone: 'Gift' },
      // Cai direto na seção de sugestão do Relatar um problema.
      { href: '/reportar-bug?aba=sugestao', label: 'Novidades e sugestões', icone: 'Lightbulb', externa: true },
      // Abas que ainda não existem: aparecem pra dar noção do todo, mas não
      // navegam. 404 é pior que "em breve" — mesma regra do `negocios-nav`.
      { href: '/indique',   label: 'Indique e ganhe', icone: 'Share2' },
      { href: '/afiliados', label: 'Seja afiliado',   icone: 'Megaphone' },
    ],
  },
];

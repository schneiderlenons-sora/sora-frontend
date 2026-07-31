// =============================================================================
// Navegação do painel Sora Negócios — FONTE ÚNICA.
//
// A sidebar, o prefetch e o menu mobile leem daqui. Espalhar a lista de rotas
// em três lugares foi o que fez a aba Grow ganhar item fantasma no passado.
//
// `tipos` é o que faz a navegação SE ADAPTAR: loja física não vê Integrações
// (não tem Hotmart), negócio digital não vê Estoque (não tem prateleira). Sem
// isso, metade do menu seria tela morta — e menu com tela morta ensina o
// usuário a ignorar o menu.
// =============================================================================
import type { TipoEmpresa } from './empresas';

export type ItemNegocios = {
  href:   string;
  label:  string;
  icone:  string;              // nome do ícone lucide (resolvido na sidebar)
  tipos?: TipoEmpresa[];       // ausente = vale pra todos os tipos
  breve?: boolean;             // rota das próximas fases — mostra, não navega
};

export type GrupoNegocios = {
  id:     string;
  titulo: string;
  itens:  ItemNegocios[];
};

/**
 * Grupos na ordem em que o dono do negócio pensa no próprio dia:
 * primeiro "como estou", depois "o dinheiro", depois "a operação", por fim
 * "as pessoas". Agrupar por domínio (e não uma lista de 15 links) é o que
 * mantém a barra escaneável quando as fases 2–5 entrarem.
 */
export const GRUPOS_NEGOCIOS: GrupoNegocios[] = [
  {
    id: 'visao',
    titulo: 'Visão geral',
    itens: [
      { href: '/negocios',           label: 'Painel',    icone: 'LayoutDashboard' },
      { href: '/negocios/insights',  label: 'Insights',  icone: 'Sparkles' },
    ],
  },
  {
    id: 'dinheiro',
    titulo: 'Dinheiro',
    itens: [
      { href: '/negocios/caixa',     label: 'Fluxo de caixa', icone: 'ArrowLeftRight' },
      { href: '/negocios/contas',    label: 'A pagar',        icone: 'Receipt' },
      { href: '/negocios/receber',   label: 'A receber',      icone: 'HandCoins' },
      { href: '/negocios/dre',       label: 'DRE',            icone: 'FileBarChart' },
      { href: '/negocios/forecast',  label: 'Previsão',       icone: 'TrendingUp' },
    ],
  },
  {
    id: 'operacao',
    titulo: 'Operação',
    itens: [
      { href: '/negocios/vendas',      label: 'Vendas',      icone: 'ShoppingCart' },
      { href: '/negocios/produtos',    label: 'Produtos',    icone: 'Package',   tipos: ['fisico', 'hibrido'] },
      { href: '/negocios/estoque',     label: 'Estoque',     icone: 'Boxes',     breve: true, tipos: ['fisico', 'hibrido'] },
      { href: '/negocios/clientes',    label: 'Clientes',    icone: 'Users' },
      { href: '/negocios/fornecedores',label: 'Fornecedores',icone: 'Truck',     breve: true, tipos: ['fisico', 'hibrido'] },
    ],
  },
  {
    id: 'gente',
    titulo: 'Gente',
    itens: [
      { href: '/negocios/equipe',    label: 'Equipe',     icone: 'IdCard' },
    ],
  },
  {
    id: 'canais',
    titulo: 'Canais de venda',
    itens: [
      // Só o digital tem plataforma de infoproduto pra integrar.
      { href: '/negocios/integracoes',  label: 'Integrações', icone: 'Plug',      tipos: ['digital', 'hibrido'] },
      { href: '/negocios/conciliacao',  label: 'Conciliação', icone: 'CheckCheck', tipos: ['digital', 'hibrido'] },
    ],
  },
];

/** Grupos visíveis pra um tipo de empresa (sem grupo vazio). */
export function gruposPara(tipo?: TipoEmpresa | null): GrupoNegocios[] {
  const t = tipo || 'fisico';
  return GRUPOS_NEGOCIOS
    .map((g) => ({ ...g, itens: g.itens.filter((i) => !i.tipos || i.tipos.includes(t)) }))
    .filter((g) => g.itens.length > 0);
}

/** Rotas que já existem — as únicas que vale prefetchar. */
export function rotasNavegaveis(tipo?: TipoEmpresa | null): string[] {
  return gruposPara(tipo).flatMap((g) => g.itens.filter((i) => !i.breve).map((i) => i.href));
}

/**
 * A rota ativa. `/negocios` é prefixo de todas, então precisa de match exato —
 * senão o "Painel" fica aceso em todas as telas do painel.
 */
export function rotaAtiva(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/negocios') return pathname === '/negocios';
  return pathname === href || pathname.startsWith(`${href}/`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonte única dos dados visuais dos planos.
// Use em todos os lugares que mostram o catálogo de planos: landing
// (Pricing), página /planos e seção "Plano" em Configurações.
//
// Preços e Price IDs ficam em lib/stripe.ts.
// Gates de feature ficam em lib/plans.ts.
// ─────────────────────────────────────────────────────────────────────────────

import type { PlanoId } from '@/lib/stripe';

export type PlanoDisplay = {
  id:         PlanoId;
  nome:       string;
  cor:        string;   // hex base (acompanha a landing)
  corDark:    string;   // versão mais escura para gradientes
  subtitulo:  string;
  destaque?:  boolean;
  badge?:     string;       // versão longa (landing/planos)
  badgeShort?: string;      // versão curta (cards compactos em configurações)
  features:   string[];     // lista completa
};

export const PLANOS_DISPLAY: PlanoDisplay[] = [
  {
    id: 'basico',
    nome: 'Básico',
    cor: '#71717a',
    corDark: '#52525b',
    subtitulo: 'Pra começar a se organizar.',
    features: [
      'Lançamentos ilimitados',
      'WhatsApp ou painel (texto/áudio)',
      '3 contas bancárias',
      'Gráficos interativos no painel',
      'Categorias e subcategorias personalizadas',
      'Lembretes de contas',
      'Relatórios financeiros',
      'Alertas e limites de gastos',
      'Suporte via WhatsApp',
    ],
  },
  {
    id: 'premium',
    nome: 'Premium',
    cor: '#61ce70',
    corDark: '#3fa85a',
    subtitulo: 'A vida toda organizada.',
    destaque: true,
    badge: 'Mais popular · Sora Grow incluso',
    badgeShort: 'Mais popular',
    features: [
      'Tudo do Básico',
      'Contas e cartões ilimitados',
      'Controle de gastos por imagem (OCR)',
      'Importação OFX',
      'Exportação de dados',
      'Gestão compartilhada (casal/família)',
      'Relatórios avançados',
      'Suporte prioritário',
      'Central de Investimentos',
      'Metas com aporte automático',
      'Metas compartilhadas',
      'Recomendações por perfil de risco',
      'Sora Grow incluso — hábitos, saúde, estudos, casa',
    ],
  },
  {
    id: 'black',
    nome: 'Black',
    cor: '#fbbf24',
    corDark: '#b45309',
    subtitulo: 'Pra empreendedor digital.',
    badge: 'Business · Sora Grow incluso',
    badgeShort: 'Business',
    features: [
      'Tudo do Premium',
      'Painel DRE completo',
      'Integrações Hotmart, Kiwify, Eduzz, Stripe',
      'Importação histórica 90 dias',
      'Forecast 3 meses (receita/lucro)',
      'Insights da IA financeira',
      'Conciliação automática (venda × banco)',
      'Wrapped mensal compartilhável',
      'Config tributária (MEI/Simples/Lucro Presumido)',
      'Custos por categoria',
      'MRR / ARR tracking',
    ],
  },
];

export function getPlanoDisplay(id: PlanoId): PlanoDisplay | undefined {
  return PLANOS_DISPLAY.find((p) => p.id === id);
}

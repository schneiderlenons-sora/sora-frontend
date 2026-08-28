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
      'Sora Grow básico — hábitos, tarefas, agenda e bem-estar',
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
    badge: 'Mais popular',
    badgeShort: 'Mais popular',
    features: [
      'Tudo do Básico',
      'Contas e cartões ilimitados',
      'Controle de gastos por imagem (OCR)',
      'Importação OFX',
      'Exportação de dados',
      'Gestão compartilhada (casal/família)',
      'Relatórios avançados',
      'Conexão Open Finance — até 3 bancos',
      'Central de Investimentos',
      'Metas com aporte automático',
      'Metas compartilhadas',
      'Recomendações por perfil de risco',
      'Sora Grow completo — saúde, estudos, casa, viagens, filmes e leituras',
      'Wrapped mensal compartilhável',
      'Suporte via WhatsApp',
    ],
  },
  {
    // ⚠️ A ABA NEGÓCIOS SAIU DO PREMIUM E VEIO PARA CÁ. Quem já tinha acesso
    // NÃO perde: a migration 142 marcou `negocios_liberado` em todos eles e o
    // gate é `temNegocios()`, não `podeUsar(plano,'negocios')`. Esta lista é
    // só a vitrine de quem compra a partir de agora.
    id: 'platinum',
    nome: 'Platinum',
    cor: '#a78bfa',
    corDark: '#7c3aed',
    subtitulo: 'Pra quem também toca um negócio.',
    badge: 'Completo',
    badgeShort: 'Completo',
    features: [
      'Tudo do Premium',
      'Aba Negócios — Painel DRE completo',
      'Vendas, clientes, produtos e estoque',
      'Contas a pagar, a receber e fluxo de caixa',
      'Equipe e folha com comissão por venda',
      'Integrações Hotmart, Kiwify, Eduzz, Stripe',
      'Forecast de receita/lucro + insights da IA',
      'Conciliação automática (venda × banco)',
      'Config tributária (MEI/Simples/Lucro Presumido)',
      'Venda pelo WhatsApp: "vendi 3 bolos por 90 pra dona Maria"',
      'Conexão Open Finance — até 5 bancos',
      'Suporte prioritário',
    ],
  },
];

export function getPlanoDisplay(id: PlanoId): PlanoDisplay | undefined {
  return PLANOS_DISPLAY.find((p) => p.id === id);
}

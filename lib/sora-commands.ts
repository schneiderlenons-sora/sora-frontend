// =============================================================================
// Catálogo central de comandos que a Sora entende no WhatsApp.
// Fonte única da verdade — usado tanto pela Central da Sora (UI) quanto
// (futuramente) pelo HELP_TEXT do backend (auto-geração).
//
// Importante: a Sora interpreta linguagem natural via IA. Os "exemplos"
// abaixo são apenas guias — variações funcionam.
// =============================================================================

import type { Feature } from '@/lib/plans';

export type CategoriaCmdId =
  | 'lancamentos'
  | 'contas'
  | 'cartoes'
  | 'dividas'
  | 'recorrencias'
  | 'limites'
  | 'transferencias'
  | 'analises'
  | 'midia'
  | 'investimentos'
  | 'sora-grow'
  | 'negocios';

export type Comando = {
  id:        string;
  titulo:    string;
  exemplo:   string;        // exemplo principal que vai pro botão "enviar"
  descricao: string;
  variantes?: string[];     // outras formas de escrever a mesma coisa
  categoria: CategoriaCmdId;
  feature?:  Feature;       // se requer plano específico
};

// ─── CATEGORIAS ──────────────────────────────────────────────────────────────

export const CATEGORIAS: ReadonlyArray<{
  id:        CategoriaCmdId;
  nome:      string;
  descricao: string;
  emoji:     string;
  cor:       string;
  corDark:   string;
  feature?:  Feature;
}> = [
  {
    id: 'lancamentos',
    nome: 'Lançar gastos e receitas',
    descricao: 'Texto, áudio ou comando rápido pra registrar transações',
    emoji: '💸',
    cor: '#61D17B',
    corDark: '#3FA85A',
  },
  {
    id: 'contas',
    nome: 'Contas bancárias',
    descricao: 'Criar contas, ver saldos, organizar carteiras',
    emoji: '🏦',
    cor: '#3b82f6',
    corDark: '#1e40af',
  },
  {
    id: 'cartoes',
    nome: 'Cartão de crédito',
    descricao: 'Compras parceladas, faturas, limites do cartão',
    emoji: '💳',
    cor: '#a855f7',
    corDark: '#6b21a8',
  },
  {
    id: 'dividas',
    nome: 'Dívidas e empréstimos',
    descricao: 'Empréstimos, financiamentos, parcelamentos longos',
    emoji: '📋',
    cor: '#ef4444',
    corDark: '#991b1b',
  },
  {
    id: 'recorrencias',
    nome: 'Contas e receitas fixas',
    descricao: 'Aluguel, internet, salário — tudo que se repete todo mês',
    emoji: '🔁',
    cor: '#0ea5e9',
    corDark: '#075985',
  },
  {
    id: 'limites',
    nome: 'Metas e limites de gastos',
    descricao: 'Defina tetos de gasto por categoria ou geral',
    emoji: '🎯',
    cor: '#f59e0b',
    corDark: '#92400e',
  },
  {
    id: 'transferencias',
    nome: 'Transferências',
    descricao: 'Mova dinheiro entre suas contas',
    emoji: '🔀',
    cor: '#14b8a6',
    corDark: '#115e59',
  },
  {
    id: 'analises',
    nome: 'Análises e relatórios',
    descricao: 'Resumos mensais, projeções, comparações',
    emoji: '📊',
    cor: '#8b5cf6',
    corDark: '#5b21b6',
  },
  {
    id: 'midia',
    nome: 'Áudio, foto e PDF',
    descricao: 'Mande qualquer mídia que a IA interpreta',
    emoji: '📱',
    cor: '#ec4899',
    corDark: '#9d174d',
    feature: 'ocr_imagem',
  },
  {
    id: 'investimentos',
    nome: 'Investimentos',
    descricao: 'Acompanhe sua carteira, dividendos e rentabilidade',
    emoji: '📈',
    cor: '#10b981',
    corDark: '#065f46',
    feature: 'investimentos',
  },
  {
    id: 'sora-grow',
    nome: 'Sora Grow',
    descricao: 'Hábitos, tarefas, saúde, estudos — vida além das finanças',
    emoji: '🌱',
    cor: '#7c3aed',
    corDark: '#4c1d95',
    feature: 'sora_grow',
  },
  {
    id: 'negocios',
    nome: 'Negócios',
    descricao: 'DRE, vendas, fluxo de caixa do seu negócio',
    emoji: '💼',
    cor: '#fbbf24',
    corDark: '#854d0e',
    feature: 'negocios',
  },
];

// ─── COMANDOS ────────────────────────────────────────────────────────────────

export const COMANDOS: Comando[] = [
  // ─── LANÇAMENTOS ──────────────────────────────────────────────────
  {
    id: 'gasto-simples',
    titulo: 'Registrar gasto',
    exemplo: 'gastei 50 no mercado',
    descricao: 'A Sora identifica valor, categoria e descrição automaticamente.',
    variantes: ['50 no atacado', 'paguei 120 no posto'],
    categoria: 'lancamentos',
  },
  {
    id: 'recebimento',
    titulo: 'Registrar recebimento',
    exemplo: 'recebi 2000 de salário',
    descricao: 'Cria uma receita. Funciona com freelas, vendas, devoluções.',
    variantes: ['caiu 500 de freela', 'me pagaram 300'],
    categoria: 'lancamentos',
  },
  {
    id: 'gasto-categoria',
    titulo: 'Gasto com categoria específica',
    exemplo: 'gastei 80 em farmácia categoria saúde',
    descricao: 'Quando você quer forçar uma categoria diferente da padrão.',
    categoria: 'lancamentos',
  },
  {
    id: 'apagar-ultimo',
    titulo: 'Apagar último lançamento',
    exemplo: 'apagar último',
    descricao: 'Desfaz o último gasto ou receita registrado por engano.',
    variantes: ['excluir último', 'cancelar último'],
    categoria: 'lancamentos',
  },

  // ─── CONTAS ───────────────────────────────────────────────────────
  {
    id: 'criar-conta',
    titulo: 'Criar conta nova',
    exemplo: 'nubank 1000',
    descricao: 'Cria conta "Nubank" com saldo inicial de R$ 1000.',
    variantes: ['itau 500', 'carteira 200'],
    categoria: 'contas',
  },
  {
    id: 'ver-saldo',
    titulo: 'Ver saldos',
    exemplo: 'saldo',
    descricao: 'Lista o saldo de todas as suas contas.',
    variantes: ['meu saldo', 'quanto tenho'],
    categoria: 'contas',
  },
  {
    id: 'ajuste-saldo',
    titulo: 'Ajustar saldo',
    exemplo: 'ajustar nubank 850',
    descricao: 'Atualiza o saldo manualmente quando estiver diferente do real.',
    categoria: 'contas',
  },

  // ─── CARTÕES ──────────────────────────────────────────────────────
  {
    id: 'parcelado',
    titulo: 'Compra parcelada',
    exemplo: 'comprei fone no nubank crédito em 3x de 150',
    descricao: 'Cria 3 lançamentos futuros automaticamente.',
    variantes: ['parcelei 600 em 3x no itau credito'],
    categoria: 'cartoes',
  },
  {
    id: 'fatura',
    titulo: 'Ver fatura do mês',
    exemplo: 'fatura nubank',
    descricao: 'Mostra o valor total da fatura atual do cartão.',
    categoria: 'cartoes',
  },

  // ─── DÍVIDAS ──────────────────────────────────────────────────────
  {
    id: 'criar-divida',
    titulo: 'Criar dívida parcelada',
    exemplo: 'criar divida empréstimo nubank 5000 em 10x dia 15',
    descricao: 'Empréstimos, financiamentos. Cria lembrete mensal automático.',
    categoria: 'dividas',
  },
  {
    id: 'listar-dividas',
    titulo: 'Listar dívidas',
    exemplo: 'minhas dívidas',
    descricao: 'Mostra todas as dívidas em aberto e quanto falta pra quitar.',
    categoria: 'dividas',
  },
  {
    id: 'pagar-divida',
    titulo: 'Pagar parcela',
    exemplo: 'pagar divida nubank 250',
    descricao: 'Registra o pagamento de uma parcela.',
    categoria: 'dividas',
  },
  {
    id: 'quitar-divida',
    titulo: 'Quitar dívida',
    exemplo: 'quitar divida nubank',
    descricao: 'Marca a dívida como totalmente paga.',
    categoria: 'dividas',
  },
  {
    id: 'cancelar-lembrete-divida',
    titulo: 'Cancelar lembrete',
    exemplo: 'cancelar lembrete divida nubank',
    descricao: 'Para de receber lembretes mensais dessa dívida.',
    variantes: ['cancelar lembrete dividas'],
    categoria: 'dividas',
  },

  // ─── RECORRÊNCIAS ─────────────────────────────────────────────────
  {
    id: 'conta-fixa',
    titulo: 'Cadastrar conta fixa',
    exemplo: 'todo mês 1000 aluguel dia 5',
    descricao: 'Cria recorrência mensal. A Sora avisa quando estiver perto de vencer.',
    variantes: ['todo mês 50 spotify dia 10'],
    categoria: 'recorrencias',
  },
  {
    id: 'receita-fixa',
    titulo: 'Cadastrar salário/receita fixa',
    exemplo: 'todo mês recebo 3000 salário dia 5',
    descricao: 'Lança a receita automaticamente todo mês no dia escolhido.',
    categoria: 'recorrencias',
  },

  // ─── LIMITES ──────────────────────────────────────────────────────
  {
    id: 'limite-geral',
    titulo: 'Definir limite geral do mês',
    exemplo: 'limite 2000',
    descricao: 'A Sora alerta quando você estiver perto de estourar.',
    categoria: 'limites',
  },
  {
    id: 'limite-categoria',
    titulo: 'Limite por categoria',
    exemplo: 'limite mercado 500',
    descricao: 'Define teto específico para uma categoria.',
    variantes: ['limite lazer 300', 'limite transporte 400'],
    categoria: 'limites',
  },

  // ─── TRANSFERÊNCIAS ───────────────────────────────────────────────
  {
    id: 'transferir',
    titulo: 'Transferir entre contas',
    exemplo: 'transferir 200 do nubank pro inter',
    descricao: 'Move dinheiro entre suas contas (atualiza ambos os saldos).',
    variantes: ['mandar 100 do nubank pra carteira'],
    categoria: 'transferencias',
  },

  // ─── ANÁLISES ─────────────────────────────────────────────────────
  {
    id: 'resumo',
    titulo: 'Resumo do mês',
    exemplo: 'resumo',
    descricao: 'Recebe um relatório completo: receitas, gastos, saldo, top categorias.',
    categoria: 'analises',
  },
  {
    id: 'analisar',
    titulo: 'Análise inteligente da semana',
    exemplo: 'analisar',
    descricao: 'A IA analisa seus hábitos da semana e dá insights.',
    categoria: 'analises',
  },
  {
    id: 'painel',
    titulo: 'Abrir painel web',
    exemplo: 'painel',
    descricao: 'A Sora manda o link direto pro dashboard com gráficos completos.',
    categoria: 'analises',
  },

  // ─── MÍDIA ────────────────────────────────────────────────────────
  {
    id: 'audio',
    titulo: 'Áudio',
    exemplo: '🎙️ Grave um áudio falando o gasto',
    descricao: 'A Sora transcreve com Whisper e interpreta. Bom pra quando não dá pra digitar.',
    categoria: 'midia',
  },
  {
    id: 'foto-cupom',
    titulo: 'Foto de cupom/nota',
    exemplo: '📷 Tire foto do cupom fiscal',
    descricao: 'A IA lê o valor, data e estabelecimento. Disponível no Premium e Black.',
    categoria: 'midia',
    feature: 'ocr_imagem',
  },
  {
    id: 'pdf-boleto',
    titulo: 'PDF de boleto ou nota',
    exemplo: '📄 Mande o PDF',
    descricao: 'Extrai valor, vencimento e descrição automaticamente.',
    categoria: 'midia',
    feature: 'ocr_imagem',
  },

  // ─── INVESTIMENTOS ────────────────────────────────────────────────
  {
    id: 'inv-comprar',
    titulo: 'Registrar compra de ativo',
    exemplo: 'comprei 10 PETR4 a 35',
    descricao: 'Adiciona ao portfólio. Funciona com ações, FIIs, ETFs e cripto.',
    variantes: ['investi 1000 em CDB 110% CDI'],
    categoria: 'investimentos',
    feature: 'investimentos',
  },
  {
    id: 'inv-carteira',
    titulo: 'Ver carteira',
    exemplo: 'minha carteira',
    descricao: 'Mostra patrimônio total, rentabilidade e distribuição por classe.',
    categoria: 'investimentos',
    feature: 'investimentos',
  },
  {
    id: 'inv-cotacoes',
    titulo: 'Atualizar cotações',
    exemplo: 'atualizar cotações',
    descricao: 'Busca os preços atuais via Yahoo Finance e CoinGecko.',
    categoria: 'investimentos',
    feature: 'investimentos',
  },

  // ─── SORA GROW ────────────────────────────────────────────────────
  {
    id: 'grow-habito',
    titulo: 'Marcar hábito do dia',
    exemplo: 'fiz exercício hoje',
    descricao: 'Marca o hábito como concluído e atualiza seu streak.',
    categoria: 'sora-grow',
    feature: 'sora_grow',
  },
  {
    id: 'grow-refeicao',
    titulo: 'Registrar refeição',
    exemplo: 'almocei arroz, feijão e frango',
    descricao: 'A Sora calcula calorias, proteínas, carbs e gorduras.',
    categoria: 'sora-grow',
    feature: 'sora_grow',
  },
  {
    id: 'grow-tarefa',
    titulo: 'Adicionar tarefa',
    exemplo: 'tarefa: estudar SQL amanhã',
    descricao: 'Cria task no Kanban com prioridade e data.',
    categoria: 'sora-grow',
    feature: 'sora_grow',
  },

  // ─── NEGÓCIOS ─────────────────────────────────────────────────────
  {
    id: 'negocios-dre',
    titulo: 'DRE do mês',
    exemplo: 'DRE',
    descricao: 'Relatório completo: receita bruta, custos, despesas, lucro líquido.',
    categoria: 'negocios',
    feature: 'negocios',
  },
  {
    id: 'negocios-vendas',
    titulo: 'Vendas do mês',
    exemplo: 'vendas',
    descricao: 'Total de vendas + ticket médio + comparação com mês anterior.',
    categoria: 'negocios',
    feature: 'negocios',
  },

  // ─── ESPECIAIS ────────────────────────────────────────────────────
  {
    id: 'ajuda',
    titulo: 'Pedir ajuda',
    exemplo: 'ajuda',
    descricao: 'A Sora envia a lista completa de comandos pelo WhatsApp.',
    categoria: 'analises',
  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

export function comandosPorCategoria(catId: CategoriaCmdId): Comando[] {
  return COMANDOS.filter((c) => c.categoria === catId);
}

export function buscar(query: string): Comando[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return COMANDOS.filter((c) =>
    c.titulo.toLowerCase().includes(q) ||
    c.descricao.toLowerCase().includes(q) ||
    c.exemplo.toLowerCase().includes(q) ||
    (c.variantes || []).some((v) => v.toLowerCase().includes(q))
  );
}

/** Total de comandos do app (usado em "X comandos descobertos"). */
export const TOTAL_COMANDOS = COMANDOS.length;

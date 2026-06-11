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
  destaque?: boolean;       // se aparece em "essenciais" / topo
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
    titulo: 'Gasto rápido',
    exemplo: 'gastei 50 no mercado',
    descricao: 'A Sora identifica valor, categoria e descrição automaticamente. Vai pra sua conta principal.',
    variantes: ['50 no atacado', 'paguei 120 no posto', 'gastei 30 com uber'],
    categoria: 'lancamentos',
    destaque: true,
  },
  {
    id: 'gasto-com-conta',
    titulo: 'Gasto especificando a conta',
    exemplo: 'gastei 50 no mercado pelo nubank',
    descricao: 'Mencione o banco e a Sora debita da conta certa. Funciona com qualquer banco que você tenha cadastrado.',
    variantes: [
      'paguei 80 farmácia pix do inter',
      '120 posto débito itau',
      'pagamento pix nubank 50',
    ],
    categoria: 'lancamentos',
    destaque: true,
  },
  {
    id: 'gasto-cartao-credito',
    titulo: 'Gasto no cartão de crédito',
    exemplo: 'comprei 200 no mercado nubank crédito',
    descricao: 'Adicione "crédito" depois do nome do banco pra usar o cartão (não a conta corrente).',
    variantes: ['gastei 150 farmácia itau credito', 'comprei 80 no atacado credito do nubank'],
    categoria: 'lancamentos',
  },
  {
    id: 'recebimento',
    titulo: 'Registrar recebimento',
    exemplo: 'recebi 2000 de salário',
    descricao: 'Cria uma receita. Vai pra sua conta principal — ou mencione o banco se for outra.',
    variantes: ['caiu 500 de freela no nubank', 'me pagaram 300 pix inter'],
    categoria: 'lancamentos',
    destaque: true,
  },
  {
    id: 'gasto-categoria',
    titulo: 'Gasto com categoria específica',
    exemplo: 'gastei 80 em farmácia categoria saúde',
    descricao: 'Quando você quer forçar uma categoria diferente da padrão.',
    categoria: 'lancamentos',
  },
  {
    id: 'corrigir-ultima-conta',
    titulo: 'Corrigir conta do último gasto',
    exemplo: 'não, foi do nubank',
    descricao: 'Se a Sora pôs na conta errada, peça pra corrigir — ela move pro banco certo e ajusta os saldos.',
    variantes: [
      'corrige a última pra inter',
      'esse último foi no cartão do itau',
      'a última foi crédito do nubank',
    ],
    categoria: 'lancamentos',
  },
  {
    id: 'apagar-ultimo',
    titulo: 'Apagar último lançamento',
    exemplo: 'apagar último',
    descricao: 'Desfaz o último gasto ou receita registrado por engano.',
    variantes: ['excluir último', 'cancelar último', 'apagar transação ABC123'],
    categoria: 'lancamentos',
  },

  // ─── CONTAS ───────────────────────────────────────────────────────
  {
    id: 'criar-conta',
    titulo: 'Criar conta corrente',
    exemplo: 'nubank 1000',
    descricao: 'Cria conta corrente Nubank com R$ 1.000 de saldo. Você pode mudar pra outro tipo depois.',
    variantes: ['itau 500', 'inter 2500'],
    categoria: 'contas',
    destaque: true,
  },
  {
    id: 'criar-poupanca',
    titulo: 'Criar conta poupança',
    exemplo: 'poupança nubank 5000',
    descricao: 'Mencione "poupança" no comando pra criar como tipo poupança.',
    variantes: ['conta poupança itau 3000', 'poup bradesco 1500'],
    categoria: 'contas',
  },
  {
    id: 'criar-vale',
    titulo: 'Criar Vale Alimentação / Refeição',
    exemplo: 'vale alimentação alelo 800',
    descricao: 'A Sora reconhece "VA", "alelo", "sodexo", "ticket" e "refeição".',
    variantes: ['VA sodexo 500', 'alelo 600', 'ticket 300'],
    categoria: 'contas',
  },
  {
    id: 'criar-carteira',
    titulo: 'Criar carteira (dinheiro)',
    exemplo: 'carteira 200',
    descricao: 'Pra registrar dinheiro físico. Funciona com "dinheiro" também.',
    variantes: ['dinheiro 100'],
    categoria: 'contas',
  },
  {
    id: 'ver-saldo',
    titulo: 'Ver saldos',
    exemplo: 'saldo',
    descricao: 'Lista o saldo de todas as suas contas.',
    variantes: ['meu saldo', 'quanto tenho'],
    categoria: 'contas',
    destaque: true,
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
    id: 'criar-cartao-rapido',
    titulo: 'Criar cartão de uma vez (avançado)',
    exemplo: 'cartão nubank limite 5000 fecha 5 vence 15',
    descricao: 'Cria o cartão com todos os dados de gestão de fatura. Você pode adicionar a bandeira: "cartão nubank mastercard limite 5000 fecha 5 vence 15".',
    variantes: [
      'cartão itau mastercard limite 3000 fecha 10 vence 20',
      'cartão inter visa limite 8000 fecha 1 vence 10',
    ],
    categoria: 'cartoes',
    destaque: true,
  },
  {
    id: 'criar-cartao-wizard',
    titulo: 'Criar cartão guiado',
    exemplo: 'criar cartão nubank',
    descricao: 'A Sora te pergunta limite, dia de fechamento, vencimento e bandeira — uma coisa por vez.',
    variantes: ['novo cartão itau', 'cartão de crédito bradesco'],
    categoria: 'cartoes',
  },
  {
    id: 'parcelado',
    titulo: 'Compra parcelada',
    exemplo: 'comprei fone no nubank crédito em 3x de 150',
    descricao: 'Cria as parcelas automaticamente — a 1ª já entra na fatura atual e as próximas nos meses seguintes. Todas aparecem no painel do cartão.',
    variantes: ['parcelei 600 em 3x no itau credito', 'comprei tv 1200 em 6x no nubank credito'],
    categoria: 'cartoes',
    destaque: true,
  },
  {
    id: 'antecipar-parcela',
    titulo: 'Antecipar uma parcela',
    exemplo: 'antecipar parcela do fone',
    descricao: 'Paga a próxima parcela em aberto antes da hora. A Sora pergunta de qual conta debitar e libera o limite do cartão.',
    variantes: ['pagar parcela do fone', 'adiantar parcela da tv'],
    categoria: 'cartoes',
  },
  {
    id: 'quitar-parcelas',
    titulo: 'Quitar todas as parcelas',
    exemplo: 'quitar parcelas da tv',
    descricao: 'Paga de uma vez todas as parcelas restantes de uma compra. A Sora pergunta de qual conta debitar.',
    variantes: ['quitar parcelas do notebook', 'pagar todas as parcelas do celular'],
    categoria: 'cartoes',
  },
  {
    id: 'fatura',
    titulo: 'Ver fatura do mês',
    exemplo: 'fatura nubank',
    descricao: 'Mostra o valor total da fatura atual do cartão. Quando a fatura fecha (e quando vence), a Sora te avisa sozinha e já oferece pagar — é só responder de qual conta.',
    categoria: 'cartoes',
  },
  {
    id: 'pagar-fatura',
    titulo: 'Pagar fatura do cartão',
    exemplo: 'pagar fatura nubank',
    descricao: 'A Sora soma a fatura do mês e pergunta de qual conta você quer pagar — ao escolher, ela debita o saldo e registra a saída nas transações.',
    variantes: ['quitar a fatura do nubank'],
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
    descricao: 'Registra o pagamento de uma parcela. Em seguida a Sora pergunta se quer descontar de uma conta — responda o número e ela debita o saldo e lança nas transações.',
    categoria: 'dividas',
  },
  {
    id: 'quitar-divida',
    titulo: 'Quitar dívida',
    exemplo: 'quitar divida nubank',
    descricao: 'Marca a dívida como totalmente paga. Também pergunta se quer descontar o valor de uma conta.',
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
  {
    id: 'meta-aporte',
    titulo: 'Guardar dinheiro numa meta',
    exemplo: 'guardar 500 na meta viagem',
    descricao: 'Adiciona o valor à meta e atualiza o progresso. Em seguida a Sora pergunta se você quer descontar de uma conta — é só responder o número.',
    variantes: ['aplicar 200 na meta carro', 'aportar 300 na meta reserva'],
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
    titulo: 'Registrar compra / aporte',
    exemplo: 'comprei 10 PETR4 a 35',
    descricao: 'Adiciona ao portfólio (ações, FIIs, ETFs e cripto). Depois a Sora pergunta se quer descontar o valor de uma conta — responda o número e ela debita o saldo e lança nas transações.',
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
    id: 'grow-habitos-todos',
    titulo: 'Marcar todos os hábitos do dia',
    exemplo: 'fiz todos',
    descricao: 'Marca de uma vez todos os hábitos programados pra hoje. Ative o lembrete diário na aba Hábitos pra a Sora te avisar.',
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
  {
    id: 'grow-despensa-acabou',
    titulo: 'Marcar item da despensa como acabado',
    exemplo: 'acabou o café',
    descricao: 'Marca o item na despensa e já joga na sua lista de compras automaticamente.',
    categoria: 'sora-grow',
    feature: 'sora_grow',
  },
  {
    id: 'grow-despensa-ver',
    titulo: 'Ver a despensa',
    exemplo: 'minha despensa',
    descricao: 'A Sora mostra o que você tem, o que tá acabando e o que já entrou na lista de compras.',
    categoria: 'sora-grow',
    feature: 'sora_grow',
  },
  {
    id: 'grow-manutencao-feita',
    titulo: 'Marcar manutenção como feita',
    exemplo: 'fiz a manutenção do filtro de água',
    descricao: 'Registra a manutenção como feita hoje e a Sora reprograma a próxima automaticamente.',
    categoria: 'sora-grow',
    feature: 'sora_grow',
  },
  {
    id: 'grow-manutencao-ver',
    titulo: 'Ver manutenções da casa',
    exemplo: 'minhas manutenções',
    descricao: 'Lista as manutenções com o que está em dia, vencendo ou atrasado.',
    categoria: 'sora-grow',
    feature: 'sora_grow',
  },
  {
    id: 'grow-receitas-ver',
    titulo: 'Ver suas receitas',
    exemplo: 'minhas receitas',
    descricao: 'Lista todas as receitas salvas com tempo de preparo e porções.',
    categoria: 'sora-grow',
    feature: 'sora_grow',
  },
  {
    id: 'grow-receita-detalhe',
    titulo: 'Ver ingredientes e preparo',
    exemplo: 'receita strogonoff',
    descricao: 'A Sora mostra os ingredientes (marcando o que você já tem) e o modo de preparo.',
    categoria: 'sora-grow',
    feature: 'sora_grow',
  },
  {
    id: 'grow-receita-cozinhar',
    titulo: 'Cozinhar uma receita',
    exemplo: 'cozinhar strogonoff',
    descricao: 'A Sora confere a despensa e joga os ingredientes que faltam direto na lista de compras.',
    categoria: 'sora-grow',
    feature: 'sora_grow',
  },
  {
    id: 'grow-receita-sugestao',
    titulo: 'O que dá pra cozinhar',
    exemplo: 'o que posso cozinhar',
    descricao: 'A Sora sugere receitas que você consegue fazer agora com o que tem na despensa.',
    categoria: 'sora-grow',
    feature: 'sora_grow',
  },
  {
    id: 'grow-agenda-ver',
    titulo: 'Ver sua agenda',
    exemplo: 'minha agenda',
    descricao: 'Lista seus compromissos dos próximos 7 dias, agrupados por dia.',
    categoria: 'sora-grow',
    feature: 'sora_grow',
  },
  {
    id: 'grow-agenda-hoje',
    titulo: 'Compromissos de hoje',
    exemplo: 'agenda hoje',
    descricao: 'A Sora mostra só os compromissos marcados para hoje.',
    categoria: 'sora-grow',
    feature: 'sora_grow',
  },
  {
    id: 'grow-agenda-marcar',
    titulo: 'Marcar compromisso',
    exemplo: 'marca dentista terça 15h',
    descricao: 'Cria um compromisso pela conversa — a Sora entende dia e hora e te lembra. Funciona até em fala natural ("tenho uma reunião amanhã às 19, me lembra?"). Você define a antecedência na própria frase: "me avisa 1 dia antes", "30 min antes" ou "na hora".',
    variantes: ['agendar reunião amanhã 9h me avisa 1 dia antes', 'tenho uma reunião amanhã às 19, me lembra?', 'marca consulta sexta 10h avisa 30 min antes'],
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

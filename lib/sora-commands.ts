// =============================================================================
// Catálogo central de comandos que a Sora entende no WhatsApp.
// Fonte única da verdade — usado tanto pela aba Comandos (ex-Central da Sora, UI) quanto
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
  | 'drive'
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
    id: 'drive',
    nome: 'Drive Inteligente',
    descricao: 'Mande arquivos que a Sora guarda, organiza em pastas e acha depois',
    emoji: '📁',
    cor: '#16a34a',
    corDark: '#14532d',
    feature: 'drive',
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
    id: 'listar-parcelas',
    titulo: 'Ver minhas parcelas',
    exemplo: 'parcelas',
    descricao: 'Lista as compras parceladas em aberto: quantas parcelas faltam, o valor de cada uma, a próxima e o total que ainda falta pagar.',
    variantes: ['minhas parcelas', 'como estão minhas parcelas', 'quantas parcelas tenho pra pagar', 'compras parceladas'],
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
    exemplo: 'paguei a fatura do nubank',
    descricao: 'A Sora soma a fatura do mês e pergunta de qual conta você quer pagar — ao escolher, ela debita o saldo e registra a saída. Você pode pagar só uma PARTE ("paguei 100 da fatura do nubank"): a fatura diminui e o que sobra rola pra próxima (a Sora avisa no vencimento e, se você não responder em 24h, rola sozinha). No painel dá pra dividir o pagamento entre várias contas.',
    variantes: ['pagar fatura nubank', 'quitar a fatura do nubank', 'paguei 100 da fatura do itaú'],
    categoria: 'cartoes',
  },

  // ─── DÍVIDAS E PARCELAMENTOS ──────────────────────────────────────
  {
    id: 'parcelamento-sem-cartao',
    titulo: 'Compra parcelada SEM cartão',
    exemplo: 'comprei um celular em 5x de 300 sem cartão',
    descricao: 'Parcelou algo sem cartão (com um amigo, direto na loja)? A Sora cria um parcelamento em "Dívidas e Parcelamentos", te lembra a cada vencimento e você escolhe de qual conta pagar. Ela ainda pergunta se você já pagou a 1ª parcela. Não desconta de nenhum cartão.',
    variantes: ['parcelei o sofá com o joão em 3x de 200 dia 10', 'parcelei a tv com meu pai em 10x de 150'],
    destaque: true,
    categoria: 'dividas',
  },
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
  {
    id: 'listar-gastos-fixos',
    titulo: 'Ver seus gastos fixos do mês',
    exemplo: 'quais meus gastos fixos desse mês?',
    descricao: 'Lista suas contas fixas separando o que ainda vem do que já passou neste mês, com o total que sai todo mês. Contas de valor variável aparecem sem valor (porque ele muda).',
    variantes: ['contas fixas', 'minhas contas fixas do mês', 'listar despesas fixas'],
    categoria: 'recorrencias',
  },
  {
    id: 'listar-receitas-fixas',
    titulo: 'Ver suas receitas fixas',
    exemplo: 'quais minhas receitas fixas?',
    descricao: 'O que entra todo mês (salário e outras receitas recorrentes), com o dia de cada uma.',
    variantes: ['minhas entradas fixas', 'o que eu recebo todo mês'],
    categoria: 'recorrencias',
  },
  {
    id: 'listar-recorrencias',
    titulo: 'Ver todas as recorrências',
    exemplo: 'quais minhas recorrências desse mês',
    descricao: 'Mostra gastos e receitas fixas juntos e diz quanto sobra depois das fixas.',
    variantes: ['minhas recorrências', 'recorrências'],
    categoria: 'recorrencias',
  },
  {
    id: 'confirmar-previsto',
    titulo: 'Confirmar conta de valor variável',
    exemplo: 'confirmar luz 243',
    descricao: 'Contas cujo valor muda (luz, água, cartão): no dia do vencimento a Sora te lembra e você confirma o valor real por aqui. Cadastre a conta como "valor varia" no painel de Transações.',
    variantes: ['confirmar água 89,90', 'confirmar cartão 1250'],
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
    id: 'oraculo-compra',
    titulo: 'Posso comprar isso? 🔮',
    exemplo: 'posso comprar um celular em 10x de 500?',
    descricao: 'O **Oráculo** cruza seu caixa, contas fixas, dívidas, fatura em aberto e limite do cartão e responde se a compra cabe — antes de você assumir a parcela. Se ele não tiver dado suficiente pra cravar, ele diz isso em vez de chutar.',
    variantes: [
      'dá pra comprar uma tv de 2500 em 12x?',
      'vale a pena parcelar 1200 em 6x?',
      'consigo comprar uma geladeira de 4000 à vista?',
    ],
    categoria: 'analises',
    feature: 'oraculo',
    destaque: true,
  },
  {
    id: 'resumo',
    titulo: 'Resumo do mês',
    exemplo: 'resumo',
    descricao: 'Recebe um relatório completo: receitas, gastos, saldo, top categorias e quanto saiu de cada conta/cartão.',
    categoria: 'analises',
    destaque: true,
  },
  {
    id: 'gastos-carteiras',
    titulo: 'Gastos por cartão e conta',
    exemplo: 'gastos dos meus cartões',
    descricao: 'Mostra quanto saiu em cada cartão (fatura aberta) e em cada conta bancária no mês, com o total geral.',
    variantes: ['quanto gastei nas contas', 'gastos por cartão e conta', 'gastos dos meus cartões e contas'],
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
    descricao: 'A IA lê o valor, data e estabelecimento. Disponível no Premium e Platinum.',
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

  // ─── DRIVE INTELIGENTE ────────────────────────────────────────────
  {
    id: 'drive-salvar',
    titulo: 'Guardar um arquivo',
    exemplo: '📎 Mande o arquivo + "salva na pasta comprovantes"',
    descricao: 'Envie qualquer documento, PDF ou foto que a Sora guarda no seu Drive e organiza na pasta certa. Sem legenda, ela escolhe a pasta pelo conteúdo.',
    variantes: ['guarda esse contrato', 'arquiva esse boleto', 'salva isso na pasta trabalho'],
    categoria: 'drive',
    feature: 'drive',
    destaque: true,
  },
  {
    id: 'drive-buscar',
    titulo: 'Achar um arquivo',
    exemplo: 'ache meu comprovante do mecânico',
    descricao: 'Descreva o arquivo com suas palavras que a Sora procura no seu Drive e te devolve na hora.',
    variantes: ['me manda o contrato de aluguel', 'cadê meu currículo', 'procura a nota do notebook'],
    categoria: 'drive',
    feature: 'drive',
  },
  {
    id: 'drive-painel',
    titulo: 'Ver tudo no painel',
    exemplo: 'onde vejo meus arquivos?',
    descricao: 'Todos os arquivos ficam na aba Drive do painel — com busca, pastas e download. Tudo pelo WhatsApp, sem abrir app nenhum.',
    categoria: 'drive',
    feature: 'drive',
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
    id: 'grow-tarefa-natural',
    titulo: 'Criar tarefa falando 🎤',
    exemplo: 'anote que eu tenho que terminar a edição do vídeo',
    descricao: 'Manda em áudio ou texto o que precisa fazer, em linguagem natural. A Sora transcreve, guarda **só o essencial** (tira o "anote que eu tenho que…" e o "anota pra mim" do fim) e já categoriza (Viagem, Compras, Trabalho, Saúde…). Pra encadear outra, é só dizer "anota também que…".',
    variantes: ['tenho que enviar o relatório pro cliente', 'preciso terminar o trabalho, anota pra mim', 'anota também que tenho que revisar o contrato', 'não esquecer de pagar o boleto', 'preciso ligar pro dentista'],
    categoria: 'sora-grow',
    feature: 'sora_grow',
    destaque: true,
  },
  {
    id: 'grow-nota-salvar',
    titulo: 'Salvar uma ideia / insight 💡',
    exemplo: 'tive uma ideia sobre o projeto de expansão',
    descricao: 'Grave um áudio ou mande um texto com uma ideia solta ou insight. A Sora guarda pra você consultar quando quiser.',
    variantes: ['anota que o cliente prefere azul', 'guarda esse insight: o público jovem converte mais', 'nota: renegociar o aluguel em janeiro'],
    categoria: 'sora-grow',
    feature: 'sora_grow',
    destaque: true,
  },
  {
    id: 'grow-nota-consultar',
    titulo: 'Consultar suas notas 🔎',
    exemplo: 'o que anotei sobre o projeto de expansão?',
    descricao: 'Pergunte com suas palavras que a Sora acha a nota na hora. Ou peça *minhas notas* pra ver as últimas.',
    variantes: ['minhas notas', 'procura minha ideia sobre marketing', 'o que eu pensei sobre o preço'],
    categoria: 'sora-grow',
    feature: 'sora_grow',
  },
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
    id: 'grow-macros-foto',
    titulo: 'Macros por foto 📸',
    exemplo: 'macros',
    descricao: 'Mande a *foto da comida* no WhatsApp com a legenda "macros" (ou "calorias") e a Sora identifica os alimentos e devolve os macros estimados: calorias, proteínas, carboidratos e gorduras. Premium/Platinum.',
    variantes: ['calorias', 'quantas calorias tem nessa comida'],
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
    variantes: ['agendar reunião amanhã 9h me avisa 1 dia antes', 'Sora, tenho reunião dia 12 às 18, me lembra?', 'tenho uma reunião amanhã às 19, me lembra?', 'marca consulta sexta 10h avisa 30 min antes'],
    categoria: 'sora-grow',
    feature: 'sora_grow',
  },
  {
    id: 'grow-lembrete',
    titulo: 'Criar um lembrete',
    exemplo: 'me lembra que amanhã tenho que pagar o boleto',
    descricao: 'Diga "me lembra de [o quê] [quando]" e a Sora cria na sua agenda e te avisa. Entende "amanhã", dias da semana, "dia 12", "às 18h"… Com horário, ela te lembra antes da hora; sem horário, o item aparece no seu dia (e no briefing matinal).',
    variantes: ['me lembra de ligar pro médico segunda às 15h', 'me lembra de mandar o relatório sexta', 'Sora, tenho reunião dia 12 às 18, me lembra?'],
    categoria: 'sora-grow',
    feature: 'sora_grow',
  },
  {
    id: 'biblia-versiculo',
    titulo: 'Versículo do dia',
    exemplo: 'qual o versículo de hoje?',
    descricao: 'Peça o versículo do dia a qualquer hora. Pra receber todo dia de manhã automaticamente, diga "ativar versículo diário" (e "desativar versículo diário" pra parar).',
    variantes: ['me manda a palavra do dia', 'ativar versículo diário', 'desativar versículo diário'],
    categoria: 'sora-grow',
    feature: 'grow_estudos',
  },
  {
    id: 'biblia-leitura',
    titulo: 'Leitura bíblica',
    exemplo: 'qual a leitura de hoje?',
    descricao: 'Veja a leitura do seu plano bíblico e marque como lida pelo WhatsApp. Registre também leituras avulsas ("li João 3"). Tudo aparece no painel em Grow › Estudos › Bíblia.',
    variantes: ['como tá meu plano de leitura?', 'terminei a leitura de hoje', 'li João 3', 'acabei de ler Salmos 23'],
    categoria: 'sora-grow',
    feature: 'grow_estudos',
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
  {
    id: 'negocios-registrar-venda',
    titulo: 'Registrar venda',
    exemplo: 'vendi 3 bolos por 90 pra dona Maria',
    descricao: 'Registra a venda, lança no caixa e dá baixa no estoque — sem abrir o painel. Diga "fiado" e vira conta a receber.',
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
  {
    id: 'duplicadas-watson',
    titulo: 'Procurar lançamentos repetidos',
    exemplo: 'tem alguma duplicada?',
    descricao: 'O Detetive Watson examina seus lançamentos e mostra os que entraram duas vezes — com a prova. Depois é só responder o número pra ele apagar a cópia (ele confirma antes). Diga "na fatura" pra ele olhar só a fatura atual do cartão.',
    variantes: ['tem lançamento repetido?', 'watson', 'verifica duplicadas na fatura', 'tem compra em dobro?'],
    categoria: 'analises',
  },
  {
    id: 'suporte',
    titulo: 'Falar com o suporte',
    exemplo: 'quero falar com o suporte',
    descricao: 'Precisa de ajuda, achou um bug ou algo não funcionou? A Sora te passa o contato do suporte humano (e-mail e WhatsApp).',
    variantes: ['achei um bug', 'falar com um humano', 'relatar um problema'],
    categoria: 'analises',
  },
  {
    id: 'resumos-toggle',
    titulo: 'Ligar/desligar os resumos',
    exemplo: 'desativar resumos',
    descricao: 'Liga ou desliga os resumos automáticos que a Sora manda no WhatsApp (o da semana, no domingo, e o fechamento do mês, no dia 1º).',
    variantes: ['ativar resumos'],
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

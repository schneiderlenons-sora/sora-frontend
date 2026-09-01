// =============================================================================
// Vídeos e dicas do app — o conteúdo da aba Ajuda.
//
// FONTE ÚNICA do texto. A tela não escreve dica nenhuma: ela só desenha o que
// está aqui, então acrescentar uma pasta ou uma dica é mexer só neste arquivo.
//
// ⚠️ Uma dica pode aparecer em MAIS DE UMA pasta (ex.: "Pagamento de fatura
// duplicando o gasto?" está em "Comece por aqui" e em "Regras"). Por isso as
// dicas moram num catálogo por `id` e as pastas guardam só a LISTA DE IDS —
// duplicar o texto criaria duas versões pra desatualizar.
//
// ⚠️ O corpo é um ARRAY de parágrafos, não uma string com \n\n. É o que permite
// a tela espaçar os parágrafos com o mesmo ritmo do resto do painel sem depender
// de `white-space: pre-line`.
// =============================================================================

export type Dica = {
  id: string;
  titulo: string;
  /** Uma linha, mostrada na lista da pasta — diz o benefício, não o passo. */
  resumo: string;
  corpo: string[];
};

export type PastaDicas = {
  id: string;
  titulo: string;
  /** Nome do ícone lucide, resolvido na tela. */
  icone: string;
  dicas: string[];   // ids do catálogo abaixo
};

// ── Catálogo de dicas ───────────────────────────────────────────────────────
export const DICAS: Record<string, Dica> = {
  'fechamento-cartao': {
    id: 'fechamento-cartao',
    titulo: 'Acerte a data de fechamento do cartão',
    resumo: 'É ela que define em qual fatura cada compra cai.',
    corpo: [
      'Abra o app do seu banco e veja duas datas do cartão: a de fechamento e a de vencimento.',
      'Depois configure as duas na aba Contas, toque no cartão e informe os dias. Faça isso para todos os cartões que você conectou.',
      'Pronto: seu cartão fica configurado do jeito certo e os valores batem com o banco.',
    ],
  },

  'fatura-duplicando': {
    id: 'fatura-duplicando',
    titulo: 'Pagamento de fatura duplicando o gasto?',
    resumo: 'O pagamento não é um gasto novo — se escapar do filtro, crie uma regra.',
    corpo: [
      'Quando você paga a fatura pela conta corrente, o débito aparece na conta, mas as compras do cartão já contam como despesa. Se os dois entram como despesa, o mês parece o dobro do que foi.',
      'Nós já corrigimos isso identificando Pagamentos da Fatura vindos do Open Finance e categorizando-os como "Transferência" ao invés de despesa. Porém, alguns bancos enviam o Pagamento da Fatura com nomes diferentes, podendo fugir do nosso filtro. Caso você note que o seu pagamento de fatura está sendo contado como despesa, você poderá criar uma regra individual para sua conta:',
      'Vá em Agentes → Watson → Regras, crie uma regra com o texto que o seu banco usa (ex.: "PAGAMENTO FATURA" ou "PGTO CARTAO") — ação Não considerar, Em tudo, Criar regra.',
      'A partir daí, todo pagamento de fatura vira transferência sozinho, e a despesa conta uma vez só: nas compras.',
    ],
  },

  'trocar-categoria': {
    id: 'trocar-categoria',
    titulo: 'Experimente alterar uma categoria',
    resumo: 'Os gráficos acompanham na hora.',
    corpo: [
      'Utilize o Agente Watson ou abra qualquer lançamento na lista de transações e toque em editar pra trocar a categoria. A mudança reflete na hora em tudo: donut de categorias, limites, ritmo do mês.',
      'Se o mesmo estabelecimento sempre cai na categoria errada, crie uma regra a partir dele — as próximas já entram certas.',
    ],
  },

  'recorrentes': {
    id: 'recorrentes',
    titulo: 'Cadastre receitas e despesas recorrentes',
    resumo: 'Salário e contas fixas entram sozinhos nas projeções.',
    corpo: [
      'Em Previstos ou Transações, cadastre seu salário (ou qualquer renda fixa) como fixa. A Sora passa a projetar os próximos meses já contando com ela, e o saldo futuro fica realista. Lembre-se de desativar o lançamento automático se estiver com Open Finance conectado.',
      'O mesmo processo vale para as despesas fixas (aluguel, assinaturas, parcelas fixas): cadastre na mesma aba e elas entram na projeção do mesmo jeito.',
      'Você também pode adicionar despesas e receitas variáveis. Se estiver gerindo manualmente, a Sora te envia uma mensagem no dia do recebimento ou pagamento e você confirma o valor. Se estiver com Open Finance conectado, apenas marque como "Só prever" ou "Não lançar", para o sistema mesmo lançar o valor correto. Nesse caso, certifique-se de que o nome da transação esteja de acordo com o que o banco envia, para ele cobrir a sua previsão corretamente.',
    ],
  },

  // ⚠️ ESTA DICA NÃO VEIO COM TEXTO PRONTO. Foi escrita a partir da regra que
  // existe de fato no app (o campo "Renomear para" do formulário do Watson),
  // pra pasta "Regras" não ficar com um item vazio. Revisar o texto.
  'renomear-lancamentos': {
    id: 'renomear-lancamentos',
    titulo: 'Renomeie lançamentos confusos',
    resumo: 'Sigla de maquininha vira o nome que você reconhece.',
    corpo: [
      'Lançamento de banco costuma vir com nome de máquina: siglas, códigos e razão social. "EC*VELOXINGRESSOS" ou "IFD*R. T. N. KOYAMA" não dizem nada quando você olha a lista semanas depois.',
      'Vá em Agentes → Watson → Regras e crie uma regra com um pedaço do texto que o banco manda. Escreva como aparece no extrato — maiúsculas, acentos e pontuação não importam. Preencha "Renomear para" com o nome que você reconhece e, se quiser, já escolha a categoria.',
      'Toda transação futura que casar com esse texto entra renomeada e categorizada, e as que já existem são ajustadas na hora.',
    ],
  },

  'limite-categoria': {
    id: 'limite-categoria',
    titulo: 'Defina limite por categoria',
    resumo: 'Saiba quanto dá pra gastar por dia sem estourar.',
    corpo: [
      'Em Limites você pode definir um limite de gastos geral ou por categoria.',
      'Com limite definido, você pode ver quanto dá pra gastar por dia até o fim do mês sem estourar.',
      'Você pode receber alerta no seu WhatsApp ao bater o limite, e configurar em qual porcentagem do limite quer receber o alerta.',
      'Comece com 2 ou 3 categorias onde o gasto varia mais (ex.: iFood, Lazer): limite demais vira ruído.',
    ],
  },

  'revisar-lancamentos': {
    id: 'revisar-lancamentos',
    titulo: 'Revise seus gastos e receitas',
    resumo: 'Uma passada rápida revela o que passou batido.',
    corpo: [
      'De tempos em tempos vale abrir as transações e conferir o que entrou e o que saiu.',
      'Lançamento com categoria errada, gasto que você nem lembrava, receita que caiu sem você ver: é numa revisada rápida que essas coisas aparecem.',
    ],
  },

  'previstos-proximos-meses': {
    id: 'previstos-proximos-meses',
    titulo: 'Enxergue os próximos meses nos Previstos',
    resumo: 'Descubra com antecedência se algum mês vai apertar.',
    corpo: [
      'A aba Previstos mostra os próximos meses ANTES de eles acontecerem: tudo que é recorrente (salário, assinaturas, aluguel), as faturas de cartão e os parcelamentos entram na projeção de cada mês.',
      'Toque num mês pra abrir o detalhe: as entradas, as saídas e o saldo previsto daquele mês. É onde você descobre com antecedência se algum mês vai apertar — e dá tempo de ajustar.',
    ],
  },

  'saldo-previsto': {
    id: 'saldo-previsto',
    titulo: 'O saldo previsto do fim do mês',
    resumo: 'Responde a pergunta que importa: fecho o mês no azul?',
    corpo: [
      'O saldo previsto responde a pergunta que importa: "fecho o mês no azul?". Ele parte do seu saldo de hoje e aplica tudo que ainda vem pela frente: assinaturas, fatura do cartão, salário, recorrências.',
      'Cada item futuro que a Sora conhece entra na conta — por isso vale manter as recorrências cadastradas e a fatura com a data certa. Quanto mais completo o app, mais confiável o número.',
    ],
  },

  'conectar-banco': {
    id: 'conectar-banco',
    titulo: 'Conecte seu banco (ou não!)',
    resumo: 'Automático pelo Open Finance ou 100% manual — você escolhe.',
    corpo: [
      'Em Open Finance → Conectar banco, você conecta seu banco via Open Finance (padrão do Banco Central): as transações entram sozinhas, sem digitar nada.',
      'Prefere não conectar? Sem problema, a Sora funciona 100% no modo manual: crie uma conta manual e lance os gastos do dia a dia pelo painel ou pelo WhatsApp, por mensagem, áudio ou foto.',
      'Dá pra misturar: banco principal conectado + uma conta manual pro dinheiro físico.',
    ],
  },
};

// ── Pastas ──────────────────────────────────────────────────────────────────
export const PASTAS: PastaDicas[] = [
  {
    id: 'comece-por-aqui',
    titulo: 'Comece por aqui',
    icone: 'Rocket',
    dicas: ['fechamento-cartao', 'fatura-duplicando', 'trocar-categoria', 'recorrentes'],
  },
  {
    id: 'regras',
    titulo: 'Regras',
    icone: 'Wand2',
    dicas: ['renomear-lancamentos', 'fatura-duplicando', 'trocar-categoria'],
  },
  {
    id: 'limites',
    titulo: 'Limites',
    icone: 'Target',
    dicas: ['limite-categoria'],
  },
  {
    id: 'projecao-saldo',
    titulo: 'Projeção e saldo',
    icone: 'TrendingUp',
    dicas: ['revisar-lancamentos', 'previstos-proximos-meses', 'saldo-previsto'],
  },
  {
    id: 'contas-bancos',
    titulo: 'Contas e bancos',
    icone: 'Landmark',
    dicas: ['conectar-banco'],
  },
];

export function dicasDaPasta(pasta: PastaDicas): Dica[] {
  return pasta.dicas.map((id) => DICAS[id]).filter(Boolean);
}

export const TOTAL_DICAS = new Set(PASTAS.flatMap((p) => p.dicas)).size;

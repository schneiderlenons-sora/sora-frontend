// ─────────────────────────────────────────────────────────────────────────────
// CONTEÚDO dos cursos do Sora Labs.
//
// Separado de `labs-cursos.ts` de propósito: lá fica a VITRINE (capa, cor,
// ícone) e aqui o TEXTO. A vitrine é carregada na listagem inteira; o texto só
// quando alguém abre o curso.
//
// ⚠️ TODA INSTRUÇÃO AQUI TEM DE EXISTIR NA SORA DE VERDADE.
// O rascunho original deste curso foi escrito por fora, sem acesso ao produto,
// e mandava o aluno "cadastrar cada dívida como uma meta negativa" e "criar uma
// categoria chamada Dívidas" — quando Dívidas é uma ABA PRÓPRIA, com tipo,
// parcelas, vencimento e lembrete. Também dizia "se houver função de orçamento,
// use-a; senão crie uma anotação" (existe: limites por categoria) e prometia que
// o gasto de lazer "desconta automaticamente da meta" (não existe; quem faz isso
// é o limite por categoria).
//
// Curso que ensina a usar uma função que não existe queima a confiança no
// produto inteiro — a pessoa acha que ela é que não entendeu. Antes de escrever
// uma linha nova, confira a função em `lib/sora-commands.ts` (catálogo do
// WhatsApp) ou na aba correspondente.
// ─────────────────────────────────────────────────────────────────────────────

/** Bloco de texto. `tipo` decide como a aula renderiza. */
export type Bloco =
  | { tipo: 'p';       texto: string }
  | { tipo: 'h';       texto: string }
  /** Lista simples com marcador. */
  | { tipo: 'lista';   itens: string[] }
  /** Passo a passo numerado — para o que a pessoa executa em ordem. */
  | { tipo: 'passos';  itens: string[] }
  /** Comando do WhatsApp, copiável com um toque. */
  | { tipo: 'comando'; texto: string; nota?: string }
  /** Destaque. `variante` muda a cor e o ícone (nunca só a cor). */
  | { tipo: 'caixa';   titulo: string; texto: string; variante?: 'dica' | 'atencao' | 'tarefa' }
  /** Texto para a pessoa copiar e usar fora do app (scripts de negociação). */
  | { tipo: 'script';  titulo: string; texto: string }
  /** Tabela do desafio de 30 dias. */
  | { tipo: 'missoes'; itens: { dia: number; texto: string }[] };

export type Aula = {
  id:       string;
  numero:   number;
  modulo:   string;
  titulo:   string;
  objetivo: string;
  /** Minutos de leitura — some no card e no topo da aula. */
  minutos:  number;
  blocos:   Bloco[];
};

export type CursoConteudo = {
  cursoId:  string;
  /** Frase de abertura, antes da primeira aula. */
  intro:    string;
  aulas:    Aula[];
};

// ═══════════════════════════════════════════════════════════════════════════
// DOMINE SUA VIDA FINANCEIRA
// ═══════════════════════════════════════════════════════════════════════════
const DOMINE_VIDA_FINANCEIRA: CursoConteudo = {
  cursoId: 'domine-vida-financeira',
  intro:
    'Em 30 dias você vai sair do "não sei pra onde vai meu dinheiro" para um plano que '
    + 'você entende e consegue seguir. Cada aula termina com uma tarefa que você faz na '
    + 'própria Sora — nada de planilha paralela. No fim, o painel mostra a sua evolução '
    + 'sozinho.',

  aulas: [
    // ── MÓDULO 1 ─────────────────────────────────────────────────────────
    {
      id: 'onde-voce-esta',
      numero: 1,
      modulo: 'Diagnóstico',
      titulo: 'Onde você está agora',
      objetivo: 'Enxergar sua situação real, sem medo e sem planilha.',
      minutos: 8,
      blocos: [
        { tipo: 'p', texto:
          'Quase todo mundo evita olhar o saldo. O problema é que o dinheiro não melhora '
          + 'por ser ignorado — ele só fica mais difícil de organizar. A boa notícia: você '
          + 'não precisa montar nada. A Sora já tem os seus números.' },

        { tipo: 'h', texto: 'Passo 1 — Deixe a Sora fazer o diagnóstico' },
        { tipo: 'p', texto:
          'Abra o painel e olhe o Dashboard. Ele já mostra quanto entrou, quanto saiu e '
          + 'o saldo de cada conta no mês. Em Relatórios você vê o mesmo por categoria: é '
          + 'ali que costuma aparecer a surpresa.' },
        { tipo: 'caixa', variante: 'dica', titulo: 'Atalho: conecte o banco',
          texto:
            'Se você tem Open Finance no seu plano, conectar o banco na aba Open Finance '
            + 'traz o extrato e as faturas sozinho — inclusive dos meses anteriores. É a '
            + 'diferença entre lançar tudo à mão e já começar a aula 1 com o diagnóstico '
            + 'pronto.' },

        { tipo: 'h', texto: 'Passo 2 — Confira se o retrato está limpo' },
        { tipo: 'p', texto:
          'Antes de tirar conclusão de um número, garanta que ele não está inflado por '
          + 'lançamento repetido — acontece quando o banco reenvia a mesma compra. Chame '
          + 'o Detetive Watson pelo WhatsApp:' },
        { tipo: 'comando', texto: 'tem alguma duplicada?',
          nota: 'Ele mostra as repetidas com a prova de por que são repetidas, e você apaga em um toque.' },

        { tipo: 'h', texto: 'Passo 3 — Cadastre o que é fixo' },
        { tipo: 'p', texto:
          'O que se repete todo mês não deveria ser lançado à mão toda vez. Cadastre sua '
          + 'renda e suas contas fixas uma única vez:' },
        { tipo: 'comando', texto: 'todo mês recebo 3000 salário dia 5' },
        { tipo: 'comando', texto: 'todo mês 1200 aluguel dia 10' },
        { tipo: 'p', texto:
          'Conta que muda de valor (luz, água, cartão) você marca como "valor varia" na '
          + 'aba Transações — a Sora te lembra no vencimento e você confirma o valor real '
          + 'na hora, respondendo por exemplo "confirmar luz 243".' },

        { tipo: 'caixa', variante: 'tarefa', titulo: 'Tarefa da aula 1',
          texto:
            'Cadastre sua renda e pelo menos 3 contas fixas. Depois mande "resumo" no '
            + 'WhatsApp: o número que voltar é o seu ponto de partida real. Anote-o — na '
            + 'aula 8 você vai comparar.' },
      ],
    },

    {
      id: 'mapa-das-dividas',
      numero: 2,
      modulo: 'Diagnóstico',
      titulo: 'O mapa das dívidas',
      objetivo: 'Colocar toda dívida no lugar certo e ordenar por urgência.',
      minutos: 9,
      blocos: [
        { tipo: 'caixa', variante: 'atencao', titulo: 'Dívida não é meta',
          texto:
            'Meta é dinheiro que você JUNTA (viagem, reserva). Dívida é dinheiro que você '
            + 'DEVE. Na Sora são abas diferentes, e usar meta pra dívida faz você perder o '
            + 'que só a aba Dívidas tem: parcelas, vencimento, lembrete automático e o '
            + 'desconto na conta certa quando você paga.' },

        { tipo: 'h', texto: 'Os 3 níveis de perigo' },
        { tipo: 'p', texto:
          'Nem toda dívida merece a mesma pressa. Classifique cada uma:' },
        { tipo: 'lista', itens: [
          'Nível 1 — você pode PERDER algo: financiamento de casa ou carro, luz e água atrasadas.',
          'Nível 2 — os juros devoram: cartão rotativo, cheque especial, empréstimo pessoal caro.',
          'Nível 3 — juros baixos ou zero: consignado, empréstimo com parente.',
        ] },
        { tipo: 'p', texto:
          'A ordem de ataque é essa mesma: 1, depois 2, depois 3. Perder a casa é pior do '
          + 'que pagar juros; pagar juros é pior do que dever ao seu irmão.' },

        { tipo: 'h', texto: 'Cadastrando na Sora' },
        { tipo: 'p', texto:
          'Abra a aba Dívidas e cadastre cada uma. A Sora tem tipo pra todas: empréstimo, '
          + 'financiamento, cartão rotativo, cheque especial, crediário, consignado, '
          + 'parcelamento e consórcio. Pelo WhatsApp também dá:' },
        { tipo: 'comando', texto: 'criar divida empréstimo nubank 5000 em 10x dia 15' },
        { tipo: 'p', texto:
          'Coloque o nível no título ("N2 · Cartão Visa") — assim a lista já nasce ordenada '
          + 'por urgência quando você bater o olho.' },
        { tipo: 'caixa', variante: 'dica', titulo: 'Parcelou sem cartão?',
          texto:
            'Compra parcelada com um conhecido ou direto na loja também é dívida: '
            + '"parcelei o sofá com o João em 3x de 200 dia 10". A Sora cria o parcelamento '
            + 'e te lembra em cada vencimento.' },

        { tipo: 'caixa', variante: 'tarefa', titulo: 'Tarefa da aula 2',
          texto:
            'Cadastre TODAS as suas dívidas — inclusive as que dá vergonha. Ligue para cada '
            + 'credor e peça o "saldo devedor para quitação à vista": esse número costuma '
            + 'ser bem menor que a soma das parcelas restantes, e é ele que você vai usar '
            + 'na aula 3. Depois mande "minhas dívidas" pra ver o total.' },
        { tipo: 'comando', texto: 'minhas dívidas' },
      ],
    },

    // ── MÓDULO 2 ─────────────────────────────────────────────────────────
    {
      id: 'negociar-como-profissional',
      numero: 3,
      modulo: 'Renegociação',
      titulo: 'Como negociar dívidas como um profissional',
      objetivo: 'Reduzir o valor total usando os argumentos certos.',
      minutos: 10,
      blocos: [
        { tipo: 'p', texto:
          'Negociar não é pedir favor. Para o credor, receber menos hoje é melhor do que '
          + 'receber nada nunca — e ele sabe disso melhor que você. Ligue com o número do '
          + 'saldo devedor em mãos e use os roteiros abaixo.' },
        { tipo: 'caixa', variante: 'dica', titulo: 'Três regras antes de discar',
          texto:
            '1) Nunca aceite a primeira proposta. 2) Peça sempre o valor à vista primeiro — '
            + 'é onde mora o maior desconto. 3) Só feche um parcelamento cuja parcela caiba '
            + 'no seu orçamento de verdade; acordo quebrado costuma voltar pior.' },

        { tipo: 'script', titulo: 'Roteiro 1 — cartão, banco, financeira',
          texto:
            'Bom dia. Quero regularizar minha dívida e já estou organizando meu orçamento '
            + 'pra isso. Qual é a melhor proposta de vocês para quitação à vista? '
            + 'Se eu precisar parcelar, qual a menor entrada e a menor parcela possível, '
            + 'com redução de juros?' },
        { tipo: 'script', titulo: 'Roteiro 2 — contas atrasadas (luz, água, gás)',
          texto:
            'Preciso regularizar meu débito. Vocês têm programa de parcelamento sem juros '
            + 'ou desconto para pagamento integral? Qual o valor se eu quitar tudo hoje?' },
        { tipo: 'script', titulo: 'Roteiro 3 — empréstimo com familiar',
          texto:
            'Quero honrar esse compromisso e não deixar isso indefinido entre a gente. '
            + 'Posso propor um valor mensal fixo que cabe no meu orçamento? Vou registrar '
            + 'o combinado e te mando o comprovante de cada parcela.' },

        { tipo: 'h', texto: 'Depois da ligação, na Sora' },
        { tipo: 'passos', itens: [
          'Abra a dívida na aba Dívidas e atualize o valor total e o número de parcelas para o que foi acordado.',
          'Ajuste o dia de vencimento para o do acordo — é ele que dispara o lembrete.',
          'Escreva o combinado na observação da dívida ("Acordo 12/03: 10x de R$ 85, protocolo 4471").',
          'Deixe o lembrete ligado. Acordo perdido por esquecimento é o jeito mais bobo de voltar à estaca zero.',
        ] },
        { tipo: 'caixa', variante: 'atencao', titulo: 'Guarde a prova',
          texto:
            'Peça o acordo por e-mail ou pelo app do credor e guarde: se ele sumir do '
            + 'sistema deles (acontece), a prova é sua. Nos planos Premium e Platinum dá '
            + 'pra mandar o arquivo direto no WhatsApp com "salva na pasta acordos" que a '
            + 'Sora arquiva no seu Drive.' },
      ],
    },

    {
      id: 'bola-de-neve',
      numero: 4,
      modulo: 'Renegociação',
      titulo: 'Método bola de neve',
      objetivo: 'Um plano de quitação que gera motivação a cada conquista.',
      minutos: 9,
      blocos: [
        { tipo: 'p', texto:
          'O método é simples: pague o mínimo de todas as dívidas e jogue todo dinheiro '
          + 'extra na MENOR delas. Quando ela morrer, o valor que você pagava nela vai '
          + 'inteiro para a próxima. A bola cresce sozinha.' },
        { tipo: 'p', texto:
          'Matematicamente, atacar a de maior juros economiza mais. Na prática, a maioria '
          + 'das pessoas desiste antes de ver resultado — e quitar a menor primeiro dá a '
          + 'vitória rápida que sustenta os outros 11 meses. Se você tem uma dívida de '
          + 'nível 1 (risco de perder algo), ela fura a fila.' },

        { tipo: 'h', texto: 'Vendo funcionar' },
        { tipo: 'p', texto:
          'Digamos que sobrem R$ 300 por mês e você tenha duas dívidas: Loja A, R$ 150 no '
          + 'total, parcela de R$ 50; e Cartão B, R$ 800.' },
        { tipo: 'lista', itens: [
          'Mês 1 — você quita a Loja A inteira com R$ 150 e ainda sobram R$ 150 pro Cartão B.',
          'Mês 2 — os R$ 300 de sempre MAIS os R$ 50 que eram da Loja A: R$ 350 no Cartão B.',
          'Mês 3 — o Cartão B, que parecia intocável, já está quase zerado.',
        ] },
        { tipo: 'p', texto:
          'Nada mudou na sua renda. O que mudou foi a ordem.' },

        { tipo: 'h', texto: 'Na Sora' },
        { tipo: 'passos', itens: [
          'Na aba Dívidas, olhe a lista e identifique a de MENOR valor total. É o seu alvo.',
          'Todo mês, registre o pagamento das outras normalmente: "pagar divida nubank 250". A Sora pergunta de qual conta descontar e já baixa o saldo.',
          'Jogue tudo que sobrar na dívida-alvo — mesmo R$ 30.',
          'Quando ela acabar, mande "quitar divida [nome]". Ela sai da lista e o próximo alvo aparece sozinho.',
        ] },
        { tipo: 'comando', texto: 'pagar divida nubank 250' },
        { tipo: 'comando', texto: 'quitar divida loja a' },

        { tipo: 'caixa', variante: 'dica', titulo: 'Todo extra é combustível',
          texto:
            'Vendeu algo, fez um bico, caiu um reembolso? Registre ("recebi 200 de freela") '
            + 'e mande direto pra dívida-alvo no mesmo dia. Dinheiro extra que fica parado '
            + 'na conta vira gasto — essa é a regra, não a exceção.' },
        { tipo: 'caixa', variante: 'tarefa', titulo: 'Tarefa da aula 4',
          texto:
            'Escolha sua dívida-alvo hoje e pague qualquer valor extra nela, nem que sejam '
            + 'R$ 20. O objetivo não é o valor: é provar pra você mesmo que a fila anda.' },
      ],
    },

    // ── MÓDULO 3 ─────────────────────────────────────────────────────────
    {
      id: 'orcamento-50-30-20',
      numero: 5,
      modulo: 'Orçamento',
      titulo: 'O 50-30-20 na prática',
      objetivo: 'Um orçamento que respeita a sua realidade, sem cortes malucos.',
      minutos: 10,
      blocos: [
        { tipo: 'p', texto:
          'A regra é uma referência, não uma lei: 50% para o essencial, 30% para quitar '
          + 'dívidas (e depois investir), 20% para reserva e lazer. Se hoje sua conta não '
          + 'chega perto disso, tudo bem — o valor está em saber ONDE você está.' },

        { tipo: 'h', texto: '50% — o que você não pode deixar de pagar' },
        { tipo: 'p', texto:
          'Moradia, alimentação, transporte, saúde. Abra Relatórios e some essas categorias. '
          + 'Passou de 50%? Não corte o café: ataque as três maiores linhas, que é onde mora '
          + 'o dinheiro de verdade.' },

        { tipo: 'h', texto: '30% — quitação' },
        { tipo: 'p', texto:
          'É o combustível da bola de neve da aula 4. A aba Dívidas mostra o quanto falta '
          + 'e o card do painel acompanha o progresso.' },

        { tipo: 'h', texto: '20% — reserva e lazer' },
        { tipo: 'p', texto:
          'Metade para a reserva de emergência, metade para viver. Lazer não é desperdício: '
          + 'orçamento sem nenhum prazer é orçamento que você abandona em três semanas.' },

        { tipo: 'h', texto: 'Fazendo a Sora vigiar pra você' },
        { tipo: 'p', texto:
          'Aqui está a parte que muda o jogo: em vez de conferir planilha, você define o '
          + 'teto e a Sora avisa quando estiver perto de estourar.' },
        { tipo: 'comando', texto: 'limite mercado 800',
          nota: 'Teto para uma categoria. Gasto em subcategoria conta no limite da categoria-pai.' },
        { tipo: 'comando', texto: 'limite 3000',
          nota: 'Teto geral do mês, somando tudo.' },
        { tipo: 'p', texto:
          'Você também define os limites na aba Categorias, com uma barra de consumo por '
          + 'categoria. Comece pelas três em que você mais gasta — limite em tudo de uma vez '
          + 'vira ruído e você desliga.' },
        { tipo: 'caixa', variante: 'atencao', titulo: 'Um erro comum',
          texto:
            'Não use meta para controlar gasto de lazer. Meta serve pra JUNTAR dinheiro; '
            + 'quem controla gasto é o LIMITE por categoria. É ele que soma seus gastos '
            + 'sozinho e te avisa — a meta não faz isso.' },
        { tipo: 'caixa', variante: 'tarefa', titulo: 'Tarefa da aula 5',
          texto: 'Defina limite nas suas 3 maiores categorias de gasto e um limite geral do mês.' },
      ],
    },

    {
      id: 'metas-que-funcionam',
      numero: 6,
      modulo: 'Orçamento',
      titulo: 'Metas que saem do papel',
      objetivo: 'Transformar intenção em número com data.',
      minutos: 8,
      blocos: [
        { tipo: 'p', texto:
          '"Quero juntar dinheiro" não é meta — é desejo. Meta tem valor, prazo e um '
          + 'aporte que cabe no mês. A aba Metas guarda os três e mostra a barra de '
          + 'progresso.' },

        { tipo: 'h', texto: 'As duas metas para criar hoje' },
        { tipo: 'p', texto:
          'Reserva de emergência — comece com R$ 1.000, mesmo que pareça pouco. O objetivo '
          + 'do primeiro mil não é te proteger de tudo: é provar que você consegue guardar. '
          + 'Depois você mira de 3 a 6 meses de custo de vida.' },
        { tipo: 'p', texto:
          'Uma meta que te dá vontade — viagem, troca de celular, curso. Sem ela o plano '
          + 'inteiro vira sacrifício, e sacrifício tem prazo de validade curto.' },

        { tipo: 'h', texto: 'Alimentando as metas' },
        { tipo: 'comando', texto: 'guardar 500 na meta reserva',
          nota: 'A Sora pergunta de qual conta descontar e já ajusta o saldo.' },
        { tipo: 'p', texto:
          'Guarde no dia que o dinheiro entra, não no fim do mês. O que sobra no fim do mês '
          + 'é o que ninguém viu passar.' },
        { tipo: 'caixa', variante: 'dica', titulo: 'Reserva rende no lugar certo',
          texto:
            'Reserva de emergência não é investimento de longo prazo: ela precisa estar '
            + 'disponível hoje, num lugar com liquidez diária. Se o seu plano tem a aba '
            + 'Investimentos (Premium, Platinum e Kit), marque a posição como "reserva de '
            + 'emergência" e ela passa a contar separada do resto da carteira.' },

        { tipo: 'h', texto: 'Antes de comprar, pergunte' },
        { tipo: 'p', texto:
          'Está na dúvida se aquele parcelamento cabe? Pergunte ao Oráculo pelo WhatsApp. '
          + 'Ele cruza seu caixa, contas fixas, dívidas, fatura em aberto e limite do cartão '
          + 'antes de responder — e quando não tem dado suficiente, ele diz isso em vez de '
          + 'chutar um "pode".' },
        { tipo: 'comando', texto: 'posso comprar um celular em 10x de 500?',
          nota: 'O Oráculo faz parte dos planos Premium e Platinum.' },
        { tipo: 'caixa', variante: 'tarefa', titulo: 'Tarefa da aula 6',
          texto:
            'Crie a meta "Reserva de emergência" com valor e data, e faça o primeiro aporte '
            + 'hoje — qualquer valor, nem que seja R$ 20. O primeiro aporte não muda sua '
            + 'vida financeira; ele muda a sua identidade de "quem não consegue guardar" '
            + 'para "quem guarda".' },
      ],
    },

    // ── MÓDULO 4 ─────────────────────────────────────────────────────────
    {
      id: 'habitos-que-curam',
      numero: 7,
      modulo: 'Hábitos',
      titulo: 'Os 5 hábitos que curam o vermelho',
      objetivo: 'Trocar força de vontade por rotina.',
      minutos: 9,
      blocos: [
        { tipo: 'p', texto:
          'Quem sai do vermelho não é quem tem mais disciplina — é quem montou uma rotina '
          + 'que sobrevive aos dias ruins. Estes cinco hábitos cabem em minutos por semana.' },

        { tipo: 'h', texto: '1. O dia do dinheiro' },
        { tipo: 'p', texto:
          'Escolha um dia fixo por semana para abrir o painel e conferir a semana. Dez '
          + 'minutos. Pra não depender da sua memória, ligue os resumos automáticos: a Sora '
          + 'manda o da semana no domingo e o fechamento do mês no dia 1º.' },
        { tipo: 'comando', texto: 'ativar resumos' },

        { tipo: 'h', texto: '2. A lista dos 30 dias' },
        { tipo: 'p', texto:
          'Bateu vontade de comprar algo que não é urgente? Anote e espere 30 dias. A '
          + 'maioria dos desejos morre sozinha nesse prazo — e o que sobreviver você compra '
          + 'sem culpa, porque virou decisão e não impulso.' },
        { tipo: 'comando', texto: 'anota que quero comprar um fone novo — esperar até dia 30' },

        { tipo: 'h', texto: '3. Saiba onde o dinheiro está saindo' },
        { tipo: 'p', texto:
          'Crédito dá a ilusão de que o mês está tranquilo, porque a conta chega depois. '
          + 'Confira quanto está saindo por cartão e quanto por conta:' },
        { tipo: 'comando', texto: 'gastos dos meus cartões' },
        { tipo: 'p', texto:
          'Se o cartão domina, é sinal de alerta. Comece pagando no débito o que é do dia a '
          + 'dia — mercado, transporte, farmácia.' },

        { tipo: 'h', texto: '4. Todo extra tem destino antes de entrar' },
        { tipo: 'p', texto:
          'Renda extra sem destino definido vira gasto em 48 horas. Decida antes de receber: '
          + '100% vai para a dívida-alvo (ou para a reserva, se você já estiver no azul).' },

        { tipo: 'h', texto: '5. Comemore de graça' },
        { tipo: 'p', texto:
          'Faça uma lista de 10 programas que custam zero e te fazem bem. Guarde na Sora e '
          + 'consulte quando bater a vontade de gastar por tédio.' },
        { tipo: 'comando', texto: 'anota 10 programas grátis que eu gosto: parque, praia, filme em casa...' },

        { tipo: 'caixa', variante: 'tarefa', titulo: 'Tarefa da aula 7',
          texto:
            'Ligue os resumos automáticos e escolha o seu dia do dinheiro. Depois faça o '
            + 'hábito 3: veja quanto do seu mês está indo no crédito.' },
      ],
    },

    {
      id: 'plano-de-voo',
      numero: 8,
      modulo: 'Hábitos',
      titulo: 'Seu plano de voo',
      objetivo: 'Consolidar o que mudou e definir o próximo ciclo.',
      minutos: 7,
      blocos: [
        { tipo: 'p', texto:
          'Você chegou ao fim. Abra o painel e compare com o número que anotou na aula 1 — '
          + 'é essa comparação, e não a sensação, que mostra o que aconteceu.' },

        { tipo: 'h', texto: 'O que olhar' },
        { tipo: 'lista', itens: [
          'Dívidas: quantas saíram da lista e quanto o total caiu.',
          'Reserva: existe hoje um valor guardado que não existia há 30 dias.',
          'Categorias: alguma que estourava agora respeita o limite.',
          'Fixos: o que se repete todo mês já entra sozinho, sem você lembrar.',
        ] },
        { tipo: 'caixa', variante: 'dica', titulo: 'Guarde a foto do antes e depois',
          texto:
            'Tire um print do painel hoje. Daqui a seis meses, num dia em que der vontade '
            + 'de desistir, ele vai valer mais que qualquer discurso.' },

        { tipo: 'h', texto: 'O próximo ciclo' },
        { tipo: 'passos', itens: [
          'Quando a última dívida cair, o valor que ia nela vira aporte — não vira gasto novo. Redirecione no mesmo dia.',
          'Suba a reserva até 3 a 6 meses do seu custo de vida. Esse é o alvo real.',
          'Só depois disso pense em investir com prazo mais longo — o curso "Investir do zero sem medo" começa exatamente daí.',
          'Mantenha o dia do dinheiro. É o único hábito da lista que sustenta todos os outros.',
        ] },
        { tipo: 'p', texto:
          'Estar no azul não é um lugar aonde se chega. É uma rotina que se mantém — e '
          + 'agora você tem uma.' },
      ],
    },

    // ── DESAFIO ──────────────────────────────────────────────────────────
    {
      id: 'desafio-30-dias',
      numero: 9,
      modulo: 'Desafio',
      titulo: 'Desafio dos 30 dias',
      objetivo: 'Uma missão pequena por dia, para o curso virar hábito.',
      minutos: 5,
      blocos: [
        { tipo: 'p', texto:
          'Cada missão leva poucos minutos. Marque conforme for fazendo — o progresso fica '
          + 'salvo neste aparelho. Pulou um dia? Siga do ponto onde parou; a sequência '
          + 'importa menos que a continuidade.' },
        { tipo: 'missoes', itens: [
          { dia: 1,  texto: 'Cadastre sua renda como receita fixa: "todo mês recebo X salário dia Y".' },
          { dia: 2,  texto: 'Revise as categorias dos últimos 7 dias e corrija o que a Sora não acertou.' },
          { dia: 3,  texto: 'Cadastre 3 contas fixas (aluguel, internet, luz).' },
          { dia: 4,  texto: 'Cadastre TODAS as suas dívidas na aba Dívidas, com o nível no título.' },
          { dia: 5,  texto: 'Ligue para um credor e peça o saldo devedor para quitação à vista.' },
          { dia: 6,  texto: 'Cancele 1 assinatura que você não usa há mais de um mês.' },
          { dia: 7,  texto: 'Mande "tem alguma duplicada?" e limpe os lançamentos repetidos.' },
          { dia: 8,  texto: 'Use o roteiro 1 da aula 3 para negociar uma dívida.' },
          { dia: 9,  texto: 'Crie a meta "Reserva de emergência", nem que seja de R$ 300.' },
          { dia: 10, texto: 'Faça o primeiro aporte: "guardar 50 na meta reserva".' },
          { dia: 11, texto: 'Escolha seu dia do dinheiro e ative os resumos automáticos.' },
          { dia: 12, texto: 'Anote 5 desejos de compra e marque para revisar em 30 dias.' },
          { dia: 13, texto: 'Pague qualquer valor extra na sua dívida-alvo.' },
          { dia: 14, texto: 'Coloque algo à venda e registre a renda extra quando entrar.' },
          { dia: 15, texto: 'Abra Relatórios: alguma categoria passa de 50% da sua renda?' },
          { dia: 16, texto: 'Ligue para internet e celular e peça revisão do plano.' },
          { dia: 17, texto: 'Defina limite nas suas 3 maiores categorias de gasto.' },
          { dia: 18, texto: 'Confira "gastos dos meus cartões" e veja quanto está no crédito.' },
          { dia: 19, texto: 'Faça um programa 100% gratuito no fim de semana.' },
          { dia: 20, texto: 'Atualize os valores das dívidas com os acordos que você fechou.' },
          { dia: 21, texto: 'Mande "resumo" e compare com o número da aula 1.' },
          { dia: 22, texto: 'Releia a aula 7 e marque quais dos 5 hábitos você já faz.' },
          { dia: 23, texto: 'Cadastre o aporte da reserva como recorrência mensal.' },
          { dia: 24, texto: 'Se divide contas com alguém, convide a pessoa pela Gestão compartilhada.' },
          { dia: 25, texto: 'Revise as datas das suas metas: ainda são realistas?' },
          { dia: 26, texto: 'Faça um dia sem gastar nada. Registre que conseguiu.' },
          { dia: 27, texto: 'Pergunte ao Oráculo sobre uma compra que está na sua cabeça.' },
          { dia: 28, texto: 'Liste 3 conquistas suas desde o dia 1 — por menores que pareçam.' },
          { dia: 29, texto: 'Calcule quanto falta para quitar a próxima dívida da fila.' },
          { dia: 30, texto: 'Compare o painel de hoje com o print do dia 1. Comemore.' },
        ] },
      ],
    },
  ],
};

// ─── Registro ────────────────────────────────────────────────────────────────
const CONTEUDOS: Record<string, CursoConteudo> = {
  [DOMINE_VIDA_FINANCEIRA.cursoId]: DOMINE_VIDA_FINANCEIRA,
};

export function conteudoDoCurso(cursoId: string): CursoConteudo | null {
  return CONTEUDOS[cursoId] || null;
}

/** O curso já pode ser aberto? A capa usa isto pra decidir link × "em breve". */
export function cursoDisponivel(cursoId: string): boolean {
  return !!CONTEUDOS[cursoId];
}

/** Total de minutos de leitura — alimenta o `meta` do card. */
export function minutosDoCurso(cursoId: string): number {
  const c = CONTEUDOS[cursoId];
  return c ? c.aulas.reduce((s, a) => s + a.minutos, 0) : 0;
}

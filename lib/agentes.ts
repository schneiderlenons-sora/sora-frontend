// =============================================================================
// Catálogo dos AGENTES da Sora — fonte única do painel.
//
// Cada agente é o "dono" de uma família de avisos. O que era uma lista de
// interruptores cinzas (a antiga /avisos) vira uma tripulação com nome, voz e
// rosto — mensagem com personagem é LIDA, interruptor cinza é MUTADO.
//
// ⚠️ REGRA CENTRAL: `chave` de cada aviso aponta pra uma COLUNA que já existe
// em `users` (ver COLS_AVISOS em sora-backend/src/routes/users.js). O agente é
// uma camada de catálogo POR CIMA do que já está no ar — quem já desligou o
// resumo semanal continua desligado, sem migration de dados.
//
// `chave: null` = aviso que hoje NÃO tem interruptor no banco (medicamentos,
// consultas, fatura…). Ele aparece no painel como "sempre ligado" até a
// migration da fase 4 criar a coluna. É melhor MOSTRAR que o aviso existe (e
// dizer que ainda não dá pra desligar) do que esconder que a Sora o envia.
//
// `emBreve: true` = agente cujo aviso ainda não foi construído (fase 4). Ele
// aparece na faixa "Sugestões" com o vídeo rodando, sem toggle funcional.
// =============================================================================

export type ChaveAviso =
  | 'lembretes_ativos'
  | 'lembretes_dividas'
  | 'resumo_semanal'
  | 'resumo_mensal'
  | 'habito_lembrete_ativo'
  | 'agenda_briefing_ativo';

export type Cadencia = 'Diário' | 'Semanal' | 'Mensal' | 'Quando acontece' | 'Sob demanda';

export interface AvisoAgente {
  id: string;
  titulo: string;
  desc: string;
  cadencia: Cadencia;
  /** Coluna em `users`. `null` = ainda sem interruptor próprio. */
  chave: ChaveAviso | null;
  /** Campo de horário que acompanha o toggle (só 2 avisos têm). */
  chaveHorario?: 'habito_lembrete_horario' | 'agenda_briefing_horario';
  /** Aviso ainda não construído — o agente pode estar ativo com os outros. */
  emBreve?: boolean;
  /** Exemplo real da mensagem, na voz do agente — é o que vende o agente. */
  exemplo: string;
}

export interface Agente {
  id: string;
  nome: string;
  tagline: string;
  /** Uma linha sobre COMO ele fala. Aparece no drawer. */
  voz: string;
  cor: string;
  /**
   * Arquivos em `public/agentes/`. O `id` é o nome do arquivo — e é o MESMO id
   * usado no backend (`src/agentes/index.js`), então renomear aqui exige
   * renomear lá.
   *
   * `video` ausente = ainda não temos a animação: o card cai no gradiente com a
   * inicial do agente, que é um estado desenhado de propósito (não é falha).
   *
   * Só `<id>-thumb.jpg` (320px, ~14 KB) entra aqui como `poster` do vídeo.
   * Existe porque no mobile o card ficava VAZIO até o .webm baixar (queixa
   * real). O poster aparece na hora e o vídeo entra por cima sem salto — é o
   * PRIMEIRO frame do próprio vídeo, então a troca é invisível.
   *
   * A CAPA DO WHATSAPP não entra aqui — é `public/agentes/whatsapp/<id>.png`,
   * **1200×630** (o formato que a Meta espera pra cabeçalho de template; usar
   * outra proporção faz ela cortar/recusar a imagem). Pasta SEPARADA da arte
   * acima de propósito — são finalidades e dimensões diferentes, e o backend
   * monta aquela URL sozinho (`src/agentes/index.js`), sem passar por aqui.
   * ⚠️ `public/agentes/<id>.png` (640×640, sem pasta) é resquício da versão
   * antiga — nada mais referencia esses arquivos.
   */
  poster?: string;
  video?: string;
  cadencia: Cadencia;
  emBreve?: boolean;
  avisos: AvisoAgente[];
}

export const AGENTES: Agente[] = [
  {
    id: 'sardinha',
    nome: 'Sardinha',
    tagline: 'Vigia as contas que estão pra vencer',
    voz: 'Afobado e atento — fala rápido, mas nunca deixa passar uma data.',
    cor: '#38bdf8',
    poster: '/agentes/sardinha-thumb.jpg',
    video: '/agentes/sardinha.webm',
    cadencia: 'Quando acontece',
    avisos: [
      {
        id: 'recorrencias',
        titulo: 'Contas fixas vencendo',
        desc: 'Avisa no dia em que uma recorrência (luz, aluguel, assinatura) vence.',
        cadencia: 'Quando acontece',
        chave: 'lembretes_ativos',
        exemplo: 'Chefia! A luz vence HOJE — R$ 187,40. Já era pra ter pago ontem, mas eu não julgo.',
      },
      {
        id: 'parcelas',
        titulo: 'Parcelas do mês',
        desc: 'Lembra das parcelas de compras parceladas que caem agora.',
        cadencia: 'Quando acontece',
        chave: 'lembretes_ativos',
        exemplo: 'Parcela 3/12 do notebook cai hoje: R$ 291,58. Faltam 9. Estamos indo bem!',
      },
      {
        id: 'fatura',
        titulo: 'Fatura fechando e vencendo',
        desc: 'Avisa quando a fatura do cartão fecha e quando vence.',
        cadencia: 'Quando acontece',
        chave: null,
        exemplo: 'Fatura do Nubank fechou: R$ 1.544,01. Vence dia 2. Anota aí!',
      },
    ],
  },
  {
    id: 'don-baleone',
    nome: 'Don Baleone',
    tagline: 'Puxa sua orelha quando o gasto passa da conta',
    voz: 'Mafioso das finanças: intimidador e engraçado, nunca ofensivo.',
    cor: '#ef4444',
    poster: '/agentes/don-baleone-thumb.jpg',
    video: '/agentes/don-baleone.webm',
    cadencia: 'Quando acontece',
    avisos: [
      {
        id: 'limite',
        titulo: 'Limite de gastos estourado',
        desc: 'Quando você passa do teto do mês, geral ou de uma categoria.',
        cadencia: 'Quando acontece',
        chave: null,
        exemplo: 'Escuta aqui, chefe... Você já gastou R$ 1.284 e seu limite era R$ 1.000. Eu finjo que não vi. Uma vez. 🤌',
      },
      {
        id: 'dividas',
        titulo: 'Dívida vencendo ou atrasada',
        desc: 'Avisa 3 dias antes, no dia, e quando a parcela atrasa.',
        cadencia: 'Quando acontece',
        chave: 'lembretes_dividas',
        exemplo: 'A parcela do empréstimo vence em 3 dias: R$ 629,51. Não me faça mandar o Sardinha aí.',
      },
      {
        id: 'gasto-absurdo',
        titulo: 'Gasto fora da curva',
        desc: 'Quando aparece uma compra muito acima do seu padrão.',
        cadencia: 'Quando acontece',
        chave: null,
        exemplo: 'R$ 890 numa tacada só? Chefe, isso é 4x o seu normal. Me explica devagar.',
      },
    ],
  },
  {
    id: 'sora',
    nome: 'Sora',
    tagline: 'Narra a expedição dos seus gastos',
    voz: 'Narrador de documentário — observa seu comportamento como quem estuda uma espécie rara.',
    cor: '#8b5cf6',
    poster: '/agentes/sora-thumb.jpg',
    video: '/agentes/sora.webm',
    cadencia: 'Semanal',
    avisos: [
      {
        id: 'resumo-semanal',
        titulo: 'Resumo da semana',
        desc: 'Todo domingo, o panorama do que entrou e saiu — com uma leitura do que mudou.',
        cadencia: 'Semanal',
        chave: 'resumo_semanal',
        exemplo: 'Semana 32. O espécime cortou o delivery pela metade e migrou para a padaria. Uma adaptação notável.',
      },
      {
        id: 'resumo-mensal',
        titulo: 'Fechamento do mês',
        desc: 'No dia 1º, o balanço do mês que passou.',
        cadencia: 'Mensal',
        chave: 'resumo_mensal',
        exemplo: 'Julho encerrado. Receitas superaram gastos em R$ 1.300 — o primeiro superávit em três ciclos.',
      },
      {
        id: 'wrapped',
        titulo: 'Sora Wrapped',
        desc: 'A retrospectiva do mês, com os destaques e recordes.',
        cadencia: 'Mensal',
        chave: null,
        exemplo: 'Sua retrospectiva de julho está pronta. Há um recorde ali que você não vai gostar de ver.',
      },
    ],
  },
  {
    id: 'loki',
    nome: 'Loki',
    tagline: 'Mantém sua agenda em ordem — e não deixa você esquecer',
    voz: 'Certinho e debochado — deixa tudo organizado e ironiza de leve quando você esquece.',
    cor: '#f59e0b',
    poster: '/agentes/loki-thumb.jpg',
    video: '/agentes/loki.webm',
    cadencia: 'Diário',
    avisos: [
      {
        id: 'briefing',
        titulo: 'Briefing matinal',
        desc: 'De manhã, tudo que você tem pra hoje: compromissos, contas e consultas.',
        cadencia: 'Diário',
        chave: 'agenda_briefing_ativo',
        chaveHorario: 'agenda_briefing_horario',
        exemplo: 'Enquanto você dormia, eu li sua agenda. Hoje: 2 compromissos, a luz vence e o Dr. House quer falar sobre água.',
      },
      {
        id: 'habitos',
        titulo: 'Checkup de hábitos',
        desc: 'Um lembrete pra marcar seus hábitos do dia. Funciona melhor à noite.',
        cadencia: 'Diário',
        chave: 'habito_lembrete_ativo',
        chaveHorario: 'habito_lembrete_horario',
        exemplo: 'Você marcou quase tudo hoje. Quase. Falta a leitura — dois toques e o dia fecha.',
      },
      {
        id: 'compromissos',
        titulo: 'Compromissos da agenda',
        desc: 'Avisa com a antecedência que você escolheu em cada compromisso.',
        cadencia: 'Quando acontece',
        chave: null,
        exemplo: 'Dentista às 15h, daqui a uma hora. Lembrete que você jurou não precisar.',
      },
      {
        id: 'casa',
        titulo: 'Manutenções da casa',
        desc: 'Troca de filtro, limpeza da caixa d’água, revisão — o que vence agora.',
        cadencia: 'Quando acontece',
        chave: null,
        exemplo: 'O filtro de água venceu há 3 dias e continua ali, te encarando. Cinco minutos e você para de me dar trabalho.',
      },
    ],
  },
  {
    id: 'dr-house',
    nome: 'Dr. House',
    tagline: 'Diagnostica sua saúde e não passa a mão na sua cabeça',
    voz: 'Brutalmente honesto e sarcástico — mas sempre certo. Parte do princípio de que todo mundo mente.',
    cor: '#10b981',
    poster: '/agentes/dr-house-thumb.jpg',
    video: '/agentes/dr-house.webm',
    cadencia: 'Diário',
    avisos: [
      {
        id: 'medicamentos',
        titulo: 'Hora do medicamento',
        desc: 'No horário exato de cada remédio cadastrado.',
        cadencia: 'Diário',
        chave: null,
        exemplo: 'Dose das 14h. De novo. Eu diria que pular invalida o tratamento, mas você já sabe disso.',
      },
      {
        id: 'consultas',
        titulo: 'Consultas e exames',
        desc: 'Lembra 24h antes e avisa quando o retorno está chegando.',
        cadencia: 'Quando acontece',
        chave: null,
        exemplo: 'Cardiologista amanhã, 9h. Leve os exames. Não, não estão "em algum lugar" — estão no Drive.',
      },
      {
        id: 'hidratacao',
        titulo: 'Hidratação',
        desc: 'Acompanha seu consumo de água ao longo do dia.',
        cadencia: 'Diário',
        chave: null,
        exemplo: 'Dois copos até as 16h. Você me disse que ia beber dois litros. Todo mundo mente.',
      },
    ],
  },
  {
    id: 'detetive-watson',
    nome: 'Detetive Watson',
    tagline: 'Caça transações duplicadas e cobranças estranhas',
    voz: 'Deduz em voz alta, no melhor estilo Sherlock — e sempre apresenta a prova.',
    cor: '#6366f1',
    poster: '/agentes/detetive-watson-thumb.jpg',
    video: '/agentes/detetive-watson.webm',
    cadencia: 'Quando acontece',
    avisos: [
      {
        id: 'duplicadas',
        titulo: 'Transações duplicadas',
        desc: 'Avisa quando a mesma compra entra duas vezes — pelo banco em dobro ou porque você já tinha lançado à mão.',
        cadencia: 'Quando acontece',
        chave: null,
        exemplo: 'Elementar: R$ 56,66 na CHINOCA, dois lançamentos no mesmo instante. Duas entradas, uma compra só.',
      },
      {
        id: 'conta-fantasma',
        titulo: 'Conta que não existe',
        desc: 'Detecta lançamentos apontando pra uma carteira que você já apagou.',
        cadencia: 'Quando acontece',
        chave: null,
        emBreve: true,
        exemplo: 'Há 4 transações órfãs numa conta que não existe mais. Alguém apagou a carteira e esqueceu os corpos.',
      },
    ],
  },
  {
    id: 'osvaldo',
    nome: 'Osvaldo',
    tagline: 'Cuida dos seus investimentos como se fossem dele',
    voz: 'Tio rico e sovina simpático — comemora cada centavo rendido e sofre com cada taxa.',
    cor: '#eab308',
    poster: '/agentes/osvaldo-thumb.jpg',
    video: '/agentes/osvaldo.webm',
    cadencia: 'Diário',
    emBreve: true,
    avisos: [
      {
        id: 'carteira',
        titulo: 'Movimento da carteira',
        desc: 'Avisa quando sua carteira tem uma variação que merece atenção.',
        cadencia: 'Diário',
        chave: null,
        exemplo: 'Sua carteira subiu 2,4% hoje, meu jovem. Isso é dinheiro que você fez dormindo. Lindo.',
      },
      {
        id: 'oportunidade',
        titulo: 'Oportunidade do dia',
        desc: 'Aponta oportunidades com base no que você já tem em carteira.',
        cadencia: 'Diário',
        chave: null,
        exemplo: 'O ativo que você namora há duas semanas caiu 6%. Não estou dizendo nada. Só falando.',
      },
    ],
  },
  {
    id: 'oraculo',
    nome: 'Oráculo',
    tagline: 'Diz se aquela compra cabe no seu bolso',
    voz: 'Místico e curto — responde em uma frase, como quem já sabia a pergunta.',
    cor: '#a855f7',
    poster: '/agentes/oraculo-thumb.jpg',
    video: '/agentes/oraculo.webm',
    cadencia: 'Sob demanda',
    emBreve: true,
    avisos: [
      {
        id: 'consulta',
        titulo: 'Vale a pena comprar?',
        desc: 'Pergunte no WhatsApp e ele cruza seu limite, a fatura em aberto e suas metas.',
        cadencia: 'Sob demanda',
        chave: null,
        exemplo: '"Posso comprar um celular de R$ 3.000?" — Pode. Mas sua meta da viagem atrasa 2 meses. Escolha.',
      },
    ],
  },
];

export const agentePorId = (id: string) => AGENTES.find((a) => a.id === id);

/** Todas as chaves de preferência que o catálogo controla (sem repetir). */
export const CHAVES_EM_USO: ChaveAviso[] = Array.from(
  new Set(AGENTES.flatMap((a) => a.avisos.map((av) => av.chave).filter(Boolean) as ChaveAviso[])),
);

/**
 * Um agente está ATIVO quando pelo menos um aviso controlável dele está ligado.
 * Agente cujos avisos ainda não têm interruptor conta como ativo (ele já manda).
 */
export function agenteAtivo(agente: Agente, prefs: Record<string, unknown>): boolean {
  if (agente.emBreve) return false;
  const controlaveis = agente.avisos.filter((a) => a.chave);
  if (!controlaveis.length) return true;
  return controlaveis.some((a) => prefs[a.chave as string] !== false);
}

/** Quantos avisos desse agente estão ligados / quantos ele tem no total. */
export function contagemAtivos(agente: Agente, prefs: Record<string, unknown>) {
  const ligados = agente.avisos.filter((a) => !a.chave || prefs[a.chave] !== false).length;
  return { ligados, total: agente.avisos.length };
}

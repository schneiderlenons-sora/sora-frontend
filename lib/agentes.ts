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
  /** Arquivos em public/agentes/. O vídeo é opcional (cai no poster). */
  imagem: string;
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
    imagem: '/agentes/sardinha.png',
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
    id: 'baleaone',
    nome: 'Don Baleaone',
    tagline: 'Puxa sua orelha quando o gasto passa da conta',
    voz: 'Mafioso das finanças: intimidador e engraçado, nunca ofensivo.',
    cor: '#ef4444',
    imagem: '/agentes/baleaone.png',
    video: '/agentes/baleaone.webm',
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
    id: 'jacques',
    nome: 'Jacques',
    tagline: 'Narra a expedição dos seus gastos',
    voz: 'Narrador de documentário — observa seu comportamento como quem estuda uma espécie rara.',
    cor: '#8b5cf6',
    imagem: '/agentes/jacques.png',
    video: '/agentes/jacques.webm',
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
    id: 'aurora',
    nome: 'Aurora',
    tagline: 'Organiza o seu dia antes dele começar',
    voz: 'Calma e matinal — a que já acordou, já tomou café e já viu sua agenda.',
    cor: '#f59e0b',
    imagem: '/agentes/aurora.png',
    video: '/agentes/aurora.webm',
    cadencia: 'Diário',
    avisos: [
      {
        id: 'briefing',
        titulo: 'Briefing matinal',
        desc: 'De manhã, tudo que você tem pra hoje: compromissos, contas e consultas.',
        cadencia: 'Diário',
        chave: 'agenda_briefing_ativo',
        chaveHorario: 'agenda_briefing_horario',
        exemplo: 'Bom dia. Hoje: 2 compromissos, a luz vence e o Dr. House quer falar com você sobre água.',
      },
      {
        id: 'habitos',
        titulo: 'Checkup de hábitos',
        desc: 'Um lembrete pra marcar seus hábitos do dia. Funciona melhor à noite.',
        cadencia: 'Diário',
        chave: 'habito_lembrete_ativo',
        chaveHorario: 'habito_lembrete_horario',
        exemplo: 'Antes de dormir: 3 dos 4 hábitos marcados hoje. Falta só a leitura.',
      },
      {
        id: 'compromissos',
        titulo: 'Compromissos da agenda',
        desc: 'Avisa com a antecedência que você escolheu em cada compromisso.',
        cadencia: 'Quando acontece',
        chave: null,
        exemplo: 'Dentista às 15h, daqui a uma hora. O endereço está no painel.',
      },
      {
        id: 'casa',
        titulo: 'Manutenções da casa',
        desc: 'Troca de filtro, limpeza da caixa d’água, revisão — o que vence agora.',
        cadencia: 'Quando acontece',
        chave: null,
        exemplo: 'O filtro de água venceu há 3 dias. Leva 5 minutos e você adia há uma semana.',
      },
    ],
  },
  {
    id: 'dr-house',
    nome: 'Dr. House',
    tagline: 'Diagnostica sua saúde e não passa a mão na sua cabeça',
    voz: 'Brutalmente honesto e sarcástico — mas sempre certo. Parte do princípio de que todo mundo mente.',
    cor: '#10b981',
    imagem: '/agentes/dr-house.png',
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
    id: 'watson',
    nome: 'Detetive Watson',
    tagline: 'Caça transações duplicadas e cobranças estranhas',
    voz: 'Deduz em voz alta, no melhor estilo Sherlock — e sempre apresenta a prova.',
    cor: '#6366f1',
    imagem: '/agentes/watson.png',
    video: '/agentes/watson.webm',
    cadencia: 'Quando acontece',
    emBreve: true,
    avisos: [
      {
        id: 'duplicadas',
        titulo: 'Transações duplicadas',
        desc: 'Encontra a mesma compra lançada duas vezes e deixa você escolher qual apagar.',
        cadencia: 'Quando acontece',
        chave: null,
        exemplo: 'Elementar: R$ 89,90 na Amazon, dois lançamentos, três minutos de diferença. Um deles é impostor.',
      },
      {
        id: 'conta-fantasma',
        titulo: 'Conta que não existe',
        desc: 'Detecta lançamentos apontando pra uma carteira que você já apagou.',
        cadencia: 'Quando acontece',
        chave: null,
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
    imagem: '/agentes/osvaldo.png',
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
    imagem: '/agentes/oraculo.png',
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

/**
 * Mensagens canned do test drive. 100% client-side, zero IA.
 * Cada item = 1 chip clicável → produz uma conversa pré-programada.
 */

export type MsgUser =
  | { tipo: 'text'; texto: string }
  | { tipo: 'audio'; duracao: string; texto: string /* p/ legenda */ }
  | { tipo: 'image'; src: string; legenda?: string };

export type MsgSora =
  | { tipo: 'text'; texto: string }
  | { tipo: 'audio'; duracao: string; texto: string }
  | { tipo: 'card_saldo';     valor: string; periodo: string; delta: string; sparkline: number[] }
  | { tipo: 'card_categoria'; total: string; categorias: { nome: string; emoji: string; valor: string; pct: number }[] }
  | { tipo: 'card_habito';    nome: string; streak: number; meta: number }
  | { tipo: 'card_remedio';   nome: string; horarios: string[] }
  | { tipo: 'card_meta';      titulo: string; atual: string; objetivo: string; pct: number; eta: string }
  | { tipo: 'card_dre';       receita: string; lucro: string; margem: string }
  | { tipo: 'card_agenda';    titulo: string; quando: string; lembrete: string }
  | { tipo: 'card_macros';    refeicao: string; kcal: number; itens: { nome: string; kcal: number }[]; prot: number; carb: number; gord: number; meta?: string };

export type Conversa = {
  user: MsgUser;
  sora: MsgSora[];
};

export type Categoria = {
  id: string;
  label: string;
  cor: string;
  emoji: string;
  conversas: { titulo: string; conversa: Conversa }[];
};

export const CATEGORIAS: Categoria[] = [
  {
    id: 'financas', label: 'Finanças', cor: '#61ce70', emoji: '💸',
    conversas: [
      {
        titulo: 'gastei 50 no mercado',
        conversa: {
          user: { tipo: 'text', texto: 'gastei 50 no mercado' },
          sora: [
            { tipo: 'text', texto: '✅ Anotei na hora! 💸 *R$ 50,00* em Mercado → Alimentação.' },
            { tipo: 'text', texto: 'Você tá em *R$ 487 de R$ 2.000* nessa categoria esse mês (23%). Folga tranquila 👌' },
          ],
        },
      },
      {
        titulo: 'gastei 120 na adidas ontem',
        conversa: {
          user: { tipo: 'text', texto: 'gastei 120 na adidas ontem' },
          sora: [
            { tipo: 'text', texto: '✅ Lançado! 👟 *R$ 120,00* na Adidas → Vestuário.' },
            { tipo: 'text', texto: '📅 Registrei na data de *ontem* — pode lançar de qualquer dia, é só falar 😉' },
          ],
        },
      },
      {
        titulo: 'qual meu saldo?',
        conversa: {
          user: { tipo: 'text', texto: 'qual meu saldo?' },
          sora: [
            { tipo: 'card_saldo', valor: 'R$ 3.450,00', periodo: 'Maio 2026', delta: '+12,4%', sparkline: [38, 42, 35, 48, 52, 47, 55, 61, 58, 65, 70, 68, 75, 82] },
            { tipo: 'text', texto: 'Subiu *R$ 380* vs abril 📈 Seu padrão tá saudável — continua assim!' },
          ],
        },
      },
      {
        titulo: 'pra onde foi meu dinheiro?',
        conversa: {
          user: { tipo: 'text', texto: 'pra onde foi meu dinheiro esse mês?' },
          sora: [
            { tipo: 'card_categoria', total: 'R$ 2.130,00', categorias: [
              { nome: 'iFood',       emoji: '🍔', valor: 'R$ 612', pct: 29 },
              { nome: 'Transporte',  emoji: '🚗', valor: 'R$ 380', pct: 18 },
              { nome: 'Mercado',     emoji: '🛒', valor: 'R$ 310', pct: 15 },
              { nome: 'Lazer',       emoji: '🎮', valor: 'R$ 280', pct: 13 },
            ]},
            { tipo: 'text', texto: 'Seu *vilão do mês* foi o iFood 🍔 No fim do mês eu te mando um Wrapped completo (estilo Spotify) 🐳' },
          ],
        },
      },
      {
        titulo: '📷 enviar nota fiscal',
        conversa: {
          user: { tipo: 'image', src: '/demo/nota-fiscal.svg', legenda: '' },
          sora: [
            { tipo: 'text', texto: '🔎 Li sua nota em segundos:' },
            { tipo: 'card_categoria', total: 'R$ 87,50', categorias: [
              { nome: 'Mercado Extra',   emoji: '🛒', valor: '15/05',     pct: 0 },
              { nome: '12 itens lidos',  emoji: '📋', valor: 'R$ 87,50',  pct: 0 },
            ]},
            { tipo: 'text', texto: 'Já lancei em Alimentação, na conta certa. Quer ajustar algo? 🙌' },
          ],
        },
      },
      {
        titulo: '🎤 enviar áudio',
        conversa: {
          user: { tipo: 'audio', duracao: '0:09', texto: 'gastei 80 reais na padaria do bairro hoje cedo' },
          sora: [
            { tipo: 'text', texto: 'Entendi pelo áudio: 🥖 *R$ 80* na Padaria → Alimentação.' },
            { tipo: 'text', texto: 'Lançado! Pode falar do seu jeito — eu transcrevo e organizo 😄' },
          ],
        },
      },
    ],
  },
  {
    id: 'agenda', label: 'Agenda', cor: '#0ea5e9', emoji: '📅',
    conversas: [
      {
        titulo: 'tenho reunião amanhã às 19, me lembra?',
        conversa: {
          user: { tipo: 'text', texto: 'tenho reunião amanhã às 19, me lembra?' },
          sora: [
            { tipo: 'text', texto: 'Pode deixar! Marquei aqui 👇' },
            { tipo: 'card_agenda', titulo: 'Reunião', quando: 'amanhã às 19:00', lembrete: 'Te aviso 1h antes' },
            { tipo: 'text', texto: 'Quer ser avisado em outro momento? Só dizer *"me lembra 1 dia antes"* 😉' },
          ],
        },
      },
      {
        titulo: 'marca dentista terça 15h',
        conversa: {
          user: { tipo: 'text', texto: 'marca dentista terça 15h' },
          sora: [
            { tipo: 'card_agenda', titulo: 'Dentista', quando: 'terça, 16/06 às 15:00', lembrete: 'Lembrete ativo' },
            { tipo: 'text', texto: 'Tá na sua agenda! Tudo que tem data — consultas, contas, faturas — eu junto num lugar só 📲' },
          ],
        },
      },
    ],
  },
  {
    id: 'habitos', label: 'Hábitos', cor: '#7c3aed', emoji: '🎯',
    conversas: [
      {
        titulo: 'acabei de voltar da academia',
        conversa: {
          user: { tipo: 'text', texto: 'acabei de voltar da academia 🏋️' },
          sora: [
            { tipo: 'text', texto: 'Aeee, foi! 🔥' },
            { tipo: 'card_habito', nome: 'Academia', streak: 13, meta: 30 },
            { tipo: 'text', texto: '*13 dias seguidos!* Faltam 17 pro marco de 1 mês. Você é uma máquina 💪' },
          ],
        },
      },
      {
        titulo: 'criar hábito ler 30min',
        conversa: {
          user: { tipo: 'text', texto: 'criar hábito ler 30min por dia' },
          sora: [
            { tipo: 'text', texto: '📚 Hábito criado: *Ler 30min/dia*, todo dia às 21h.' },
            { tipo: 'text', texto: 'Posso te mandar um lembrete gentil no horário pra não esquecer 😉' },
          ],
        },
      },
      {
        titulo: 'como tão meus hábitos?',
        conversa: {
          user: { tipo: 'text', texto: 'como tão meus hábitos esse mês?' },
          sora: [
            { tipo: 'card_categoria', total: '12/15 hoje', categorias: [
              { nome: 'Academia',       emoji: '🏋️', valor: '13 dias', pct: 100 },
              { nome: 'Ler 30min',      emoji: '📚', valor: '7 dias',  pct: 70 },
              { nome: 'Água 2L',        emoji: '💧', valor: '21 dias', pct: 100 },
              { nome: 'Sem celular 1h', emoji: '📵', valor: '4 dias',  pct: 45 },
            ]},
            { tipo: 'text', texto: 'Tá voando! 21 dias de água é seu recorde 🏆' },
          ],
        },
      },
    ],
  },
  {
    id: 'saude', label: 'Saúde', cor: '#ef4444', emoji: '❤️',
    conversas: [
      {
        titulo: 'comi 2 ovos, 1 pão e café',
        conversa: {
          user: { tipo: 'text', texto: 'comi 2 ovos, 1 pão na chapa e um café com leite' },
          sora: [
            { tipo: 'text', texto: '🍽️ Calculei os macros da sua refeição:' },
            { tipo: 'card_macros', refeicao: 'Café da manhã', kcal: 415,
              itens: [
                { nome: '2 ovos', kcal: 156 },
                { nome: 'Pão na chapa', kcal: 180 },
                { nome: 'Café com leite', kcal: 79 },
              ], prot: 24, carb: 38, gord: 19, meta: 'Hoje: 415 / 2.000 kcal · 💪 24g de proteína' },
            { tipo: 'text', texto: 'É só me contar o que comeu — calculo caloria e macros na hora 😋' },
          ],
        },
      },
      {
        titulo: 'tomei a losartana',
        conversa: {
          user: { tipo: 'text', texto: 'tomei a losartana agora' },
          sora: [
            { tipo: 'card_remedio', nome: 'Losartana 50mg', horarios: ['08:00 ✓', '20:00'] },
            { tipo: 'text', texto: 'Anotado! Próxima dose às 20h — vou te lembrar 🔔' },
          ],
        },
      },
      {
        titulo: 'minha pressão tá 12/8',
        conversa: {
          user: { tipo: 'text', texto: 'minha pressão tá 12/8' },
          sora: [
            { tipo: 'text', texto: 'Registrado: *120/80 mmHg* ❤️' },
            { tipo: 'text', texto: 'Dentro do ideal! Sua média do mês: 122/82 — bem estável 👍' },
          ],
        },
      },
    ],
  },
  {
    id: 'estudos', label: 'Estudos', cor: '#3b82f6', emoji: '📚',
    conversas: [
      {
        titulo: 'estudei 2h de cálculo',
        conversa: {
          user: { tipo: 'text', texto: 'estudei 2h de cálculo' },
          sora: [
            { tipo: 'text', texto: '📝 Sessão registrada: *Cálculo I — 2h*. Total da semana: *9h* 🎯' },
            { tipo: 'text', texto: 'Faltam 6h pra bater sua meta semanal. Bom ritmo!' },
          ],
        },
      },
      {
        titulo: 'prova de cálculo na sexta',
        conversa: {
          user: { tipo: 'text', texto: 'prova de cálculo na sexta 23/05' },
          sora: [
            { tipo: 'card_agenda', titulo: 'Prova — Cálculo I', quando: 'sexta, 23/05', lembrete: 'Aviso 1 dia antes' },
            { tipo: 'text', texto: 'Falta 1 semana. Quer que eu monte um cronograma de revisão pros próximos 7 dias? 📖' },
          ],
        },
      },
    ],
  },
  {
    id: 'negocios', label: 'Negócios', cor: '#fbbf24', emoji: '💼',
    conversas: [
      {
        titulo: 'qual minha receita do mês?',
        conversa: {
          user: { tipo: 'text', texto: 'qual minha receita do mês?' },
          sora: [
            { tipo: 'card_dre', receita: 'R$ 142.300', lucro: 'R$ 47.832', margem: '33.7%' },
            { tipo: 'text', texto: '*23% acima de abril* 🚀 Hotmart puxou 62% da receita. Quer o DRE detalhado?' },
          ],
        },
      },
      {
        titulo: 'minha meta é 50k de lucro',
        conversa: {
          user: { tipo: 'text', texto: 'minha meta esse mês é 50k de lucro' },
          sora: [
            { tipo: 'card_meta', titulo: 'Meta de lucro · Maio 2026', atual: 'R$ 47.832', objetivo: 'R$ 50.000', pct: 96, eta: '~3 dias' },
            { tipo: 'text', texto: 'No ritmo atual você bate em ~3 dias. *96%* do caminho! 💪' },
          ],
        },
      },
    ],
  },
];

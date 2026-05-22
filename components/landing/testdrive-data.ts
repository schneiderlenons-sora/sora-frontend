/**
 * Mensagens canned do test drive. 100% client-side, zero IA.
 * Cada item = 1 chip clicável → produz uma conversa pré-programada.
 *
 * Tipos de mensagem:
 *  - text  → bolha texto normal
 *  - audio → bolha de áudio com waveform fake (visual only)
 *  - image → imagem (mock de nota fiscal etc.)
 *  - card  → bolha com componente visual embutido (saldo, gráfico)
 */

export type MsgUser  =
  | { tipo: 'text'; texto: string }
  | { tipo: 'audio'; duracao: string; texto: string /* p/ legenda */ }
  | { tipo: 'image'; src: string; legenda?: string };

export type MsgSora  =
  | { tipo: 'text';  texto: string }
  | { tipo: 'audio'; duracao: string; texto: string }
  | { tipo: 'card_saldo';     valor: string; periodo: string; delta: string; sparkline: number[] }
  | { tipo: 'card_categoria'; total: string; categorias: { nome: string; emoji: string; valor: string; pct: number }[] }
  | { tipo: 'card_habito';    nome: string; streak: number; meta: number }
  | { tipo: 'card_remedio';   nome: string; horarios: string[] }
  | { tipo: 'card_meta';      titulo: string; atual: string; objetivo: string; pct: number; eta: string }
  | { tipo: 'card_dre';       receita: string; lucro: string; margem: string };

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
            { tipo: 'text', texto: 'Anotei! 💸 R$ 50,00 em Mercado (Alimentação).' },
            { tipo: 'text', texto: 'Você já gastou R$ 487 esse mês nessa categoria — 23% do seu limite. Tá tranquilo.' },
          ],
        },
      },
      {
        titulo: 'qual meu saldo?',
        conversa: {
          user: { tipo: 'text', texto: 'qual meu saldo?' },
          sora: [
            { tipo: 'card_saldo', valor: 'R$ 3.450,00', periodo: 'Maio 2026', delta: '+12,4%', sparkline: [38, 42, 35, 48, 52, 47, 55, 61, 58, 65, 70, 68, 75, 82] },
            { tipo: 'text', texto: 'Subiu R$ 380 vs mês passado. Seu padrão tá saudável 👌' },
          ],
        },
      },
      {
        titulo: 'pra onde foi meu dinheiro?',
        conversa: {
          user: { tipo: 'text', texto: 'pra onde foi meu dinheiro esse mês?' },
          sora: [
            { tipo: 'card_categoria', total: 'R$ 2.130,00', categorias: [
              { nome: 'Alimentação', emoji: '🍽️', valor: 'R$ 487', pct: 23 },
              { nome: 'Transporte',  emoji: '🚗', valor: 'R$ 380', pct: 18 },
              { nome: 'Lazer',       emoji: '🎮', valor: 'R$ 310', pct: 15 },
              { nome: 'Casa',        emoji: '🏠', valor: 'R$ 280', pct: 13 },
            ]},
            { tipo: 'text', texto: 'Top categorias do mês. Quer ver detalhe de alguma?' },
          ],
        },
      },
      {
        titulo: '📷 enviar nota fiscal',
        conversa: {
          user: { tipo: 'image', src: '/demo/nota-fiscal.svg', legenda: '' },
          sora: [
            { tipo: 'text', texto: '🔎 Li sua nota:' },
            { tipo: 'card_categoria', total: 'R$ 87,50', categorias: [
              { nome: 'Mercado Extra',  emoji: '🛒', valor: '15/05',  pct: 0 },
              { nome: 'Total: 12 itens', emoji: '📋', valor: 'R$ 87,50', pct: 0 },
            ]},
            { tipo: 'text', texto: 'Lancei em Alimentação. Tá certo? 🙌' },
          ],
        },
      },
      {
        titulo: '🎤 enviar áudio',
        conversa: {
          user: { tipo: 'audio', duracao: '0:09', texto: 'gastei 80 reais na padaria do bairro hoje cedo' },
          sora: [
            { tipo: 'text', texto: 'Entendi pelo áudio: 🍞 R$ 80 na Padaria (Alimentação).' },
            { tipo: 'text', texto: 'Lançado! 😄' },
          ],
        },
      },
    ],
  },
  {
    id: 'habitos', label: 'Hábitos', cor: '#7c3aed', emoji: '🎯',
    conversas: [
      {
        titulo: 'fiz minha corrida',
        conversa: {
          user: { tipo: 'text', texto: 'fiz minha corrida hoje 🏃' },
          sora: [
            { tipo: 'text', texto: 'Aeee! 🔥' },
            { tipo: 'card_habito', nome: 'Correr 30min', streak: 13, meta: 30 },
            { tipo: 'text', texto: '13 dias consecutivos! Faltam 17 pro próximo marco de "1 mês". Vai!' },
          ],
        },
      },
      {
        titulo: 'criar hábito ler 30min',
        conversa: {
          user: { tipo: 'text', texto: 'criar hábito ler 30min por dia' },
          sora: [
            { tipo: 'text', texto: '📚 Hábito criado: *Ler 30min/dia*. Marquei pra todo dia às 21h.' },
            { tipo: 'text', texto: 'Quer que eu te lembre? Posso mandar um nudge gentil no horário 😉' },
          ],
        },
      },
      {
        titulo: 'como tá meu streak?',
        conversa: {
          user: { tipo: 'text', texto: 'como tão meus hábitos esse mês?' },
          sora: [
            { tipo: 'card_categoria', total: '12/15 hoje', categorias: [
              { nome: 'Correr 30min',   emoji: '🏃', valor: '13 dias', pct: 100 },
              { nome: 'Ler 30min',      emoji: '📚', valor: '7 dias',  pct: 70 },
              { nome: 'Água 2L',        emoji: '💧', valor: '21 dias', pct: 100 },
              { nome: 'Sem celular 1h', emoji: '📵', valor: '4 dias',  pct: 45 },
            ]},
          ],
        },
      },
    ],
  },
  {
    id: 'saude', label: 'Saúde', cor: '#ef4444', emoji: '❤️',
    conversas: [
      {
        titulo: 'tomei losartana',
        conversa: {
          user: { tipo: 'text', texto: 'tomei a losartana agora' },
          sora: [
            { tipo: 'card_remedio', nome: 'Losartana 50mg', horarios: ['08:00 ✓', '20:00'] },
            { tipo: 'text', texto: 'Anotei. Próxima às 20h — vou te lembrar 🔔' },
          ],
        },
      },
      {
        titulo: 'consulta dia 15',
        conversa: {
          user: { tipo: 'text', texto: 'consulta cardiologista dia 15 às 14h' },
          sora: [
            { tipo: 'text', texto: '📅 Anotei: *Cardiologista, 15/05 às 14h*.' },
            { tipo: 'text', texto: 'Te lembro 1 dia antes e 1h antes. Endereço você quer que eu busque depois?' },
          ],
        },
      },
      {
        titulo: 'minha pressão 12/8',
        conversa: {
          user: { tipo: 'text', texto: 'minha pressão tá 12/8' },
          sora: [
            { tipo: 'text', texto: 'Registrado: 120/80 mmHg ❤️' },
            { tipo: 'text', texto: 'Tá dentro do ideal. Sua média do mês: 122/82. Bem estável 👍' },
          ],
        },
      },
    ],
  },
  {
    id: 'estudos', label: 'Estudos', cor: '#3b82f6', emoji: '📚',
    conversas: [
      {
        titulo: 'estudei 2h cálculo',
        conversa: {
          user: { tipo: 'text', texto: 'estudei 2h de cálculo' },
          sora: [
            { tipo: 'text', texto: '📝 Sessão registrada: *Cálculo I — 2h*. Total da semana: 9h 🎯' },
            { tipo: 'text', texto: 'Faltam 6h pra bater sua meta semanal. Tá indo bem!' },
          ],
        },
      },
      {
        titulo: 'prova de cálculo sexta',
        conversa: {
          user: { tipo: 'text', texto: 'prova de cálculo na sexta 23/05' },
          sora: [
            { tipo: 'text', texto: '📌 Anotei: *Prova Cálculo I — sexta 23/05*.' },
            { tipo: 'text', texto: 'Falta 1 semana. Quer que eu monte um cronograma de revisão pros próximos 7 dias?' },
          ],
        },
      },
    ],
  },
  {
    id: 'negocios', label: 'Negócios', cor: '#fbbf24', emoji: '💼',
    conversas: [
      {
        titulo: 'minha receita do mês',
        conversa: {
          user: { tipo: 'text', texto: 'qual minha receita do mês?' },
          sora: [
            { tipo: 'card_dre', receita: 'R$ 142.300', lucro: 'R$ 47.832', margem: '33.7%' },
            { tipo: 'text', texto: '23% acima de abril 🚀 Hotmart puxou 62% da receita. Quer que eu mande o DRE detalhado?' },
          ],
        },
      },
      {
        titulo: 'meta R$ 50k esse mês',
        conversa: {
          user: { tipo: 'text', texto: 'minha meta esse mês é 50k de lucro' },
          sora: [
            { tipo: 'card_meta', titulo: 'Meta de lucro · Maio 2026', atual: 'R$ 47.832', objetivo: 'R$ 50.000', pct: 96, eta: '~3 dias' },
            { tipo: 'text', texto: 'No ritmo atual você bate em ~3 dias. 96% do caminho! 💪' },
          ],
        },
      },
    ],
  },
];

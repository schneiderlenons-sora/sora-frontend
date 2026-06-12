// Decks de DEMONSTRAÇÃO do Sora Wrapped (dados de exemplo p/ validar o design).
// Depois ligamos aos endpoints reais de agregação.
import { THEMES, type WrappedDeck } from './themes';

export const deckFinanceDemo: WrappedDeck = {
  marca: 'Sora · Finance',
  periodoLabel: 'Maio 2026',
  accent: '#61D17B',
  slides: [
    { tipo: 'cover', theme: THEMES.ink, kicker: 'Seu maio com a Sora', titulo: 'Maio', sub: 'foi assim.', selo: 'Finance Wrapped', emoji: '💸' },
    { tipo: 'numero', theme: THEMES.sora, label: 'Você movimentou', valor: 14820, prefixo: 'R$ ', sub: 'em 137 lançamentos ao longo do mês inteiro.', delta: 12, emoji: '🌀' },
    { tipo: 'numero', theme: THEMES.acid, label: 'E ainda sobrou', valor: 2340, prefixo: 'R$ ', sub: 'no fim do mês. Isso é dinheiro trabalhando pra você.', delta: 34, emoji: '🤑' },
    { tipo: 'ranking', theme: THEMES.violet, label: 'Pra onde seu dinheiro foi', itens: [
      { nome: 'iFood', valorTexto: 'R$ 980', pct: 100, cor: '#ea1d2c', emoji: '🍔' },
      { nome: 'Mercado', valorTexto: 'R$ 720', pct: 74, cor: '#22c55e', emoji: '🛒' },
      { nome: 'Uber', valorTexto: 'R$ 410', pct: 42, cor: '#111', emoji: '🚗' },
      { nome: 'Shein', valorTexto: 'R$ 260', pct: 27, cor: '#f472b6', emoji: '🛍️' },
    ] },
    { tipo: 'frase', theme: THEMES.sunset, antes: 'seu vilão favorito foi o', destaque: 'iFood', depois: 'de novo, né 🍔', sub: 'R$ 980 no mês — dava pra 12 idas ao cinema. Sem julgamentos (mentira).' },
    { tipo: 'numero', theme: THEMES.cyber, label: 'Seu maior gasto único', valor: 1200, prefixo: 'R$ ', sub: 'no dia 5 — “aluguel”. A vida adulta cobrando o pedágio.', emoji: '🏠' },
    { tipo: 'persona', theme: THEMES.cotton, label: 'Seu perfil do mês', emoji: '🦅', nome: 'Águia Econômica', sub: 'Você gastou menos que em 78% dos seus meses. Voando alto e leve.' },
    { tipo: 'streak', theme: THEMES.magma, label: 'Dias registrando', valor: 28, sufixo: 'dias', sub: 'Quase o mês inteiro anotado. Controle nível Sora. 🔥' },
    { tipo: 'final', theme: THEMES.ink, titulo: 'Esse foi o\nseu Maio.', sub: 'Mostra pra todo mundo que você tá no controle da grana.', handle: '@forsora', resumo: [
      { label: 'Movimentado', valor: 'R$ 14,8k' },
      { label: 'Economizou', valor: 'R$ 2,3k' },
      { label: 'Top categoria', valor: 'iFood 🍔' },
      { label: 'Dias seguidos', valor: '28 🔥' },
    ] },
  ],
};

export const deckGrowDemo: WrappedDeck = {
  marca: 'Sora · Grow',
  periodoLabel: 'Maio 2026',
  accent: '#7c3aed',
  slides: [
    { tipo: 'cover', theme: THEMES.ink, kicker: 'Seu maio de evolução', titulo: 'Maio', sub: 'você cresceu.', selo: 'Grow Wrapped', emoji: '🌱' },
    { tipo: 'numero', theme: THEMES.violet, label: 'Hábitos concluídos', valor: 142, sub: 'checks no mês. Cada um te deixou 1% melhor que ontem.', emoji: '✅' },
    { tipo: 'streak', theme: THEMES.magma, label: 'Sua maior sequência', valor: 23, sufixo: 'dias', sub: '23 dias seguidos sem furar. Você é uma máquina. 🔥' },
    { tipo: 'numero', theme: THEMES.cyber, label: 'Tarefas finalizadas', valor: 67, sub: 'coisas que saíram da sua cabeça e viraram feito.', emoji: '📋' },
    { tipo: 'ranking', theme: THEMES.sora, label: 'Seus hábitos campeões', itens: [
      { nome: 'Beber água', valorTexto: '30x', pct: 100, cor: '#38bdf8', emoji: '💧' },
      { nome: 'Ler', valorTexto: '26x', pct: 87, cor: '#f59e0b', emoji: '📖' },
      { nome: 'Academia', valorTexto: '22x', pct: 73, cor: '#ef4444', emoji: '🏋️' },
      { nome: 'Meditar', valorTexto: '18x', pct: 60, cor: '#a855f7', emoji: '🧘' },
    ] },
    { tipo: 'frase', theme: THEMES.ocean, antes: 'seu humor médio foi', destaque: '4,3 de 5', depois: 'um mês feliz 🙂', sub: 'Maio te tratou bem. Que junho seja ainda melhor.' },
    { tipo: 'persona', theme: THEMES.cotton, label: 'Seu perfil Grow', emoji: '🧱', nome: 'Construtor de Hábitos', sub: 'Consistência é seu superpoder. Você aparece todo santo dia.' },
    { tipo: 'final', theme: THEMES.ink, titulo: 'Esse foi o\nseu Maio.', sub: 'Mostra pra galera que você tá evoluindo de verdade.', handle: '@forsora', resumo: [
      { label: 'Hábitos', valor: '142 ✅' },
      { label: 'Maior streak', valor: '23 dias 🔥' },
      { label: 'Tarefas', valor: '67' },
      { label: 'Humor', valor: '4,3/5 🙂' },
    ] },
  ],
};

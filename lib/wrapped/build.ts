// Monta os decks do Wrapped a partir dos dados reais agregados pelo backend.
import { THEMES, type Slide, type WrappedDeck } from './themes';

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0);

// "R$ 14,8k" / "R$ 980"
function fmtCompact(n: number): string {
  n = Math.round(n || 0);
  if (n >= 1000) {
    const milhares = n / 1000;
    const s = milhares >= 100 ? Math.round(milhares).toString() : milhares.toFixed(1).replace('.', ',').replace(',0', '');
    return `R$ ${s}k`;
  }
  return fmtMoney(n);
}

function coverBits(label: string, anual: boolean) {
  return anual
    ? { titulo: label, sub: 'foi seu ano.' }
    : { titulo: label.split(' ')[0], sub: 'foi assim.' };
}

// ─── FINANCE ──────────────────────────────────────────────────────────────
export function construirDeckFinance(d: any): WrappedDeck {
  const cb = coverBits(d.periodo_label, d.anual);
  const slides: Slide[] = [];

  slides.push({ tipo: 'cover', theme: THEMES.ink, kicker: d.anual ? 'Seu ano com a Sora' : 'Seu mês com a Sora', titulo: cb.titulo, sub: cb.sub, selo: 'Finance Wrapped', emoji: '💸' });

  slides.push({ tipo: 'numero', theme: THEMES.sora, label: 'Você movimentou', valor: d.movimentado, prefixo: 'R$ ',
    sub: `em ${d.n_lancamentos} lançamentos${d.anual ? ' no ano inteiro' : ' no mês'}.`, delta: d.delta_movimentado_pct, emoji: '🌀' });

  if (d.economia > 0) {
    slides.push({ tipo: 'numero', theme: THEMES.acid, label: 'E ainda sobrou', valor: d.economia, prefixo: 'R$ ',
      sub: 'foi o que entrou a mais do que saiu. Isso é controle.', emoji: '🤑' });
  }

  if (d.top_categorias?.length) {
    slides.push({ tipo: 'ranking', theme: THEMES.violet, label: 'Pra onde seu dinheiro foi',
      itens: d.top_categorias.map((c: any) => ({ nome: c.categoria, valorTexto: fmtCompact(c.total), pct: c.pct })) });
  }

  if (d.vilao) {
    slides.push({ tipo: 'frase', theme: THEMES.sunset, antes: 'seu vilão favorito foi', destaque: d.vilao.categoria, depois: 'esse mês 👀',
      sub: `${fmtMoney(d.vilao.total)} ${d.anual ? 'no ano' : 'no mês'} — sua categoria campeã de gastos.` });
  }

  if (d.maior_gasto) {
    slides.push({ tipo: 'numero', theme: THEMES.cyber, label: 'Seu maior gasto único', valor: d.maior_gasto.valor, prefixo: 'R$ ',
      sub: `em ${d.maior_gasto.categoria}. A vida cobrando o pedágio.`, emoji: '💥' });
  }

  // persona
  const ratio = d.receitas > 0 ? d.economia / d.receitas : 0;
  const persona = ratio >= 0.3 ? { emoji: '🦅', nome: 'Águia Econômica', sub: 'Você guardou mais de 30% do que entrou. Voando alto e leve.' }
    : d.economia > 0 ? { emoji: '🐜', nome: 'Formiguinha', sub: 'Sobrou no fim do mês. Constância é o seu superpoder.' }
    : { emoji: '🚀', nome: 'Espírito Livre', sub: 'O mês foi intenso — e a Sora tá aqui pra te ajudar a virar o jogo.' };
  slides.push({ tipo: 'persona', theme: THEMES.cotton, label: 'Seu perfil financeiro', ...persona });

  if (d.dias_registrando > 1) {
    slides.push({ tipo: 'streak', theme: THEMES.magma, label: 'Dias registrando', valor: d.dias_registrando, sufixo: 'dias',
      sub: 'dias com lançamentos anotados. Controle nível Sora. 🔥' });
  }

  slides.push({ tipo: 'final', theme: THEMES.ink, titulo: d.anual ? `Esse foi o\nseu ${cb.titulo}.` : `Esse foi o\nseu ${cb.titulo}.`,
    sub: 'Mostra pra todo mundo que você tá no controle da grana.', handle: '@forsora',
    resumo: [
      { label: 'Movimentado', valor: fmtCompact(d.movimentado) },
      ...(d.economia > 0 ? [{ label: 'Economizou', valor: fmtCompact(d.economia) }] : []),
      ...(d.vilao ? [{ label: 'Top categoria', valor: d.vilao.categoria }] : []),
      { label: 'Dias seguidos', valor: `${d.dias_registrando} 🔥` },
    ].slice(0, 4),
  });

  return { marca: 'Sora · Finance', periodoLabel: d.periodo_label, accent: '#61D17B', slides };
}

// ─── GROW ───────────────────────────────────────────────────────────────────
export function construirDeckGrow(d: any): WrappedDeck {
  const cb = coverBits(d.periodo_label, d.anual);
  const slides: Slide[] = [];

  slides.push({ tipo: 'cover', theme: THEMES.ink, kicker: d.anual ? 'Seu ano de evolução' : 'Seu mês de evolução', titulo: cb.titulo, sub: d.anual ? 'você cresceu.' : 'você cresceu.', selo: 'Grow Wrapped', emoji: '🌱' });

  if (d.habitos_concluidos > 0) {
    slides.push({ tipo: 'numero', theme: THEMES.violet, label: 'Hábitos concluídos', valor: d.habitos_concluidos,
      sub: 'checks no período. Cada um te deixou 1% melhor que ontem.', emoji: '✅' });
  }

  if (d.maior_streak > 1) {
    slides.push({ tipo: 'streak', theme: THEMES.magma, label: 'Sua maior sequência', valor: d.maior_streak, sufixo: 'dias',
      sub: 'dias seguidos firme. Você é uma máquina. 🔥' });
  }

  if (d.tarefas_concluidas > 0) {
    slides.push({ tipo: 'numero', theme: THEMES.cyber, label: 'Tarefas finalizadas', valor: d.tarefas_concluidas,
      sub: 'coisas que saíram da sua cabeça e viraram feito.', emoji: '📋' });
  }

  if (d.top_habitos?.length) {
    slides.push({ tipo: 'ranking', theme: THEMES.sora, label: 'Seus hábitos campeões',
      itens: d.top_habitos.map((h: any) => ({ nome: h.nome, valorTexto: `${h.total}x`, pct: h.pct, emoji: h.icone })) });
  }

  if (d.humor_medio != null) {
    const cara = d.humor_medio >= 4 ? '🙂' : d.humor_medio >= 3 ? '😌' : '💜';
    slides.push({ tipo: 'frase', theme: THEMES.ocean, antes: 'seu humor médio foi', destaque: `${String(d.humor_medio).replace('.', ',')} de 5`, depois: `${cara}`,
      sub: d.humor_medio >= 4 ? 'Um período feliz. Que venha mais.' : 'Cuidar de si também é progresso.' });
  }

  const persona = d.maior_streak >= 21 ? { emoji: '🧱', nome: 'Construtor de Hábitos', sub: 'Consistência é seu superpoder. Você aparece todo santo dia.' }
    : d.maior_streak >= 7 ? { emoji: '🌱', nome: 'Em plena evolução', sub: 'Você tá criando raízes fortes. Continua firme!' }
    : { emoji: '✨', nome: 'Começando forte', sub: 'Cada pequeno passo conta. O importante é não parar.' };
  slides.push({ tipo: 'persona', theme: THEMES.cotton, label: 'Seu perfil Grow', ...persona });

  slides.push({ tipo: 'final', theme: THEMES.ink, titulo: `Esse foi o\nseu ${cb.titulo}.`,
    sub: 'Mostra pra galera que você tá evoluindo de verdade.', handle: '@forsora',
    resumo: [
      { label: 'Hábitos', valor: `${d.habitos_concluidos} ✅` },
      ...(d.maior_streak > 1 ? [{ label: 'Maior streak', valor: `${d.maior_streak} dias 🔥` }] : []),
      ...(d.tarefas_concluidas > 0 ? [{ label: 'Tarefas', valor: `${d.tarefas_concluidas}` }] : []),
      ...(d.humor_medio != null ? [{ label: 'Humor', valor: `${String(d.humor_medio).replace('.', ',')}/5` }] : []),
    ].slice(0, 4),
  });

  return { marca: 'Sora · Grow', periodoLabel: d.periodo_label, accent: '#7c3aed', slides };
}

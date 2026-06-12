'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, Wallet, Sprout, Share2 } from 'lucide-react';
import { SlideView } from '@/components/wrapped/slides';
import { WrappedStill } from '@/components/wrapped/fx';
import { THEMES, type Slide, type WrappedDeck } from '@/lib/wrapped/themes';

// Renderiza um slide REAL do Wrapped em tamanho de "design" (380px) e escala
// pro tamanho do container — fidelidade total ao produto.
const DW = 380;
const DH = Math.round((DW * 16) / 9);

function MiniWrapped({ slide, deck }: { slide: Slide; deck: WrappedDeck }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.55);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / DW);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative w-full aspect-[9/16] rounded-[22px] overflow-hidden shadow-2xl ring-1 ring-black/20 dark:ring-white/10">
      <div style={{ width: DW, height: DH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <WrappedStill.Provider value={true}>
          <SlideView slide={slide} deck={deck} />
        </WrappedStill.Provider>
      </div>
      {/* brilho de vidro */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-1/4 pointer-events-none bg-gradient-to-b from-white/15 to-transparent" />
    </div>
  );
}

// Card do leque com efeito no HOVER (desktop) E no TOQUE (mobile).
function FanItem({ base, children }: { base: string; children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  return (
    <div
      className={`absolute transition-transform duration-300 ease-out ${base} ${active ? 'scale-[1.06] z-40' : ''}`}
      style={{ touchAction: 'manipulation' }}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onTouchStart={() => setActive(true)}
      onTouchEnd={() => setActive(false)}
      onTouchCancel={() => setActive(false)}
    >
      {children}
    </div>
  );
}

// ── Cards de exemplo (slides reais) ──────────────────────────────────────
const deckFinMes: WrappedDeck = { marca: 'Sora · Finance', periodoLabel: 'Maio 2026', accent: '#61D17B', slides: [] };
const deckFinAno: WrappedDeck = { marca: 'Sora · Finance', periodoLabel: '2026', accent: '#61D17B', slides: [] };
const deckGrowMes: WrappedDeck = { marca: 'Sora · Grow', periodoLabel: 'Maio 2026', accent: '#7c3aed', slides: [] };

const slideVilao: Slide = {
  tipo: 'frase', theme: THEMES.sunset,
  antes: 'seu vilão favorito foi o', destaque: 'iFood', depois: 'de novo, né 🍔',
  sub: 'R$ 980 no mês — daria 12 idas ao cinema. Sem julgamentos (mentira).',
};
const slideAcademia: Slide = {
  tipo: 'streak', theme: THEMES.magma,
  label: 'Dias de academia', valor: 23, sufixo: 'treinos',
  sub: '23 treinos sem furar no mês. Imparável. 🔥',
};
const slideAno: Slide = {
  tipo: 'numero', theme: THEMES.sora,
  label: 'Você movimentou em 2026', valor: 182400, prefixo: 'R$ ',
  sub: 'um ano inteiro de controle, registrado lançamento por lançamento.', delta: 18, emoji: '🌀',
};

const CHIPS = [
  { icon: Calendar, txt: 'Mensal e anual' },
  { icon: Wallet, txt: 'Finanças' },
  { icon: Sprout, txt: 'Sora Grow' },
  { icon: Share2, txt: 'Pronto pro story' },
];

export default function WrappedShowcase() {
  return (
    <section className="relative py-24 lg:py-32 border-t border-zinc-200/50 dark:border-white/[0.04] overflow-hidden">
      {/* glow de fundo */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[1000px] h-[640px] opacity-25 dark:opacity-20"
          style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.22) 0%, transparent 62%)' }} />
      </div>

      <div className="relative max-w-5xl mx-auto px-5 sm:px-8 text-center">
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
          Sora Wrapped
        </p>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-[-0.03em] max-w-3xl mx-auto">
          No fim do mês, seus números<br className="hidden sm:block" /> viram um story.
        </h2>

        <p className="text-base lg:text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto mt-5">
          Tipo o Spotify Wrapped — só que do seu dinheiro e da sua evolução.
        </p>

        {/* ── Leque de cards (slides reais do Wrapped) ── */}
        <div className="relative mt-14 mb-12 h-[440px] sm:h-[540px]">
          {/* glow atrás */}
          <div aria-hidden className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[420px] rounded-full opacity-70 blur-[70px] pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(97,206,112,0.3) 0%, transparent 70%)' }} />

          <div className="absolute inset-0 flex items-center justify-center">
            {/* esquerda — academia */}
            <FanItem base="w-[164px] sm:w-[210px] z-10 -rotate-[10deg] -translate-x-[60%] sm:-translate-x-[78%] translate-y-5">
              <MiniWrapped slide={slideAcademia} deck={deckGrowMes} />
            </FanItem>
            {/* direita — anual finanças */}
            <FanItem base="w-[164px] sm:w-[210px] z-10 rotate-[10deg] translate-x-[60%] sm:translate-x-[78%] translate-y-5">
              <MiniWrapped slide={slideAno} deck={deckFinAno} />
            </FanItem>
            {/* centro — vilão dos gastos (a estrela) */}
            <FanItem base="w-[210px] sm:w-[258px] z-30">
              <MiniWrapped slide={slideVilao} deck={deckFinMes} />
            </FanItem>
          </div>
        </div>

        {/* chips */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-8">
          {CHIPS.map(c => (
            <span key={c.txt} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-zinc-700 dark:text-white/70 bg-zinc-100 dark:bg-white/[0.06] px-3.5 py-2 rounded-full ring-1 ring-zinc-200 dark:ring-white/10">
              <c.icon size={14} className="text-[#61ce70]" /> {c.txt}
            </span>
          ))}
        </div>

        <p className="text-base lg:text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto">
          Todo mês — e todo fim de ano — a Sora transforma seus dados num resumo animado e lindo:
          seu <strong className="text-zinc-900 dark:text-white">maior vilão de gastos</strong>, quanto você
          economizou, sua <strong className="text-zinc-900 dark:text-white">sequência de treinos</strong>, seus
          hábitos campeões. Do jeitinho que dá vontade de mostrar pra todo mundo — em um toque.
        </p>
      </div>
    </section>
  );
}

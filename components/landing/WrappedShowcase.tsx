'use client';

import { Calendar, Wallet, Sprout, Share2 } from 'lucide-react';
import { THEMES } from '@/lib/wrapped/themes';

// ─────────────────────────────────────────────────────────────────────────
// Mockups do Sora Wrapped na landing — versão LEVE e ESTÁTICA.
//
// (Antes: 3x SlideView reais renderizados e escalados via transform:scale +
// ResizeObserver + filtro de baleia + blur do brilho. Isso era pesadíssimo de
// compositar no GPU — em celular fraco travava/"crashava" ao chegar nesta
// seção, e os handlers de toque davam jank ao rolar. Aqui são só gradiente +
// texto, sem filtros, sem scale de subárvore, sem JS — barato pra qualquer GPU.)
// O player real (/wrapped) segue completo, com os slides de verdade.
// ─────────────────────────────────────────────────────────────────────────

const CHIPS = [
  { icon: Calendar, txt: 'Mensal e anual' },
  { icon: Wallet, txt: 'Finanças' },
  { icon: Sprout, txt: 'Sora Grow' },
  { icon: Share2, txt: 'Pronto pro story' },
];

// Selo "鯨/クジラ" (baleia) — identidade dos posts, em texto (sem imagem/filtro).
function Selo({ cor }: { cor: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="grid place-items-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-[12px] sm:text-[14px]"
            style={{ background: cor }}>🐳</span>
      <span className="text-[7px] sm:text-[8px] tracking-[0.2em] text-white/45">クジラ</span>
    </div>
  );
}

// Card estático no formato de story (gradiente + conteúdo). `pos` posiciona no
// leque (rotação/translação são transforms ESTÁTICOS — baratos de compositar).
function Card({
  pos, gradient, badge, periodo, selo, children,
}: {
  pos: string; gradient: string; badge: string; periodo: string; selo: string; children: React.ReactNode;
}) {
  return (
    <div className={`absolute aspect-[9/16] rounded-[22px] overflow-hidden shadow-2xl ring-1 ring-black/20 dark:ring-white/10 ${pos}`}
         style={{ background: gradient }}>
      {/* vinheta superior — gradiente puro, sem blur */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-1/3 pointer-events-none"
           style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.14), transparent)' }} />
      <div className="relative h-full flex flex-col p-4 sm:p-5 text-white">
        <div className="flex items-center justify-between">
          <span className="text-[7px] sm:text-[9px] font-bold tracking-[0.18em] uppercase text-white/70">{badge}</span>
          <span className="text-[7px] sm:text-[9px] font-bold tracking-[0.18em] uppercase text-white/55">{periodo}</span>
        </div>
        <div className="mt-3"><Selo cor={selo} /></div>
        <div className="flex-1 flex flex-col justify-center">{children}</div>
        <p className="text-[7px] sm:text-[8px] text-center text-white/35 tracking-wide">toque pra avançar</p>
      </div>
    </div>
  );
}

export default function WrappedShowcase() {
  return (
    <section className="relative py-24 lg:py-32 border-t border-zinc-200/50 dark:border-white/[0.04] overflow-x-clip">
      {/* glow de fundo — gradiente radial puro (sem filtro blur) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[560px] opacity-25 dark:opacity-20"
          style={{ background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(97,206,112,0.30) 0%, transparent 70%)' }} />
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

        {/* ── Leque de cards estáticos ── */}
        <div className="relative mt-14 mb-12 h-[440px] sm:h-[540px]">
          <div className="absolute inset-0 flex items-center justify-center">
            {/* esquerda — academia (Grow) */}
            <Card
              pos="w-[164px] sm:w-[210px] z-10 -rotate-[10deg] -translate-x-[60%] sm:-translate-x-[78%] translate-y-5"
              gradient={THEMES.magma.gradient} badge="Sora · Grow" periodo="Maio 2026" selo="#b91c1c"
            >
              <p className="text-[8px] sm:text-[10px] font-bold tracking-widest uppercase text-white/70">Dias de academia</p>
              <div className="flex items-end gap-1.5 mt-1">
                <span className="text-[44px] sm:text-[58px] font-black leading-none tabular-nums">23</span>
                <span className="text-[10px] sm:text-xs text-white/70 mb-1.5">treinos</span>
              </div>
              <p className="text-[9px] sm:text-[11px] text-white/60 mt-2 leading-snug">23 treinos sem furar no mês. Imparável. 🔥</p>
            </Card>

            {/* direita — anual finanças */}
            <Card
              pos="w-[164px] sm:w-[210px] z-10 rotate-[10deg] translate-x-[60%] sm:translate-x-[78%] translate-y-5"
              gradient={THEMES.sora.gradient} badge="Sora · Finance" periodo="2026" selo="#0a5e33"
            >
              <p className="text-[8px] sm:text-[10px] font-bold tracking-widest uppercase text-white/70">Movimentou em 2026</p>
              <p className="text-[26px] sm:text-[34px] font-black leading-none tabular-nums mt-1">R$ 182.400</p>
              <p className="text-[9px] sm:text-[11px] text-white/60 mt-2 leading-snug">Um ano inteiro de controle, registrado lançamento por lançamento. 🌀</p>
            </Card>

            {/* centro — vilão dos gastos (a estrela) */}
            <Card
              pos="w-[210px] sm:w-[258px] z-30"
              gradient={THEMES.sunset.gradient} badge="Sora · Finance" periodo="Maio 2026" selo="#e11d48"
            >
              <p className="text-[14px] sm:text-[17px] text-white/85 leading-tight">seu vilão favorito foi o</p>
              <p className="text-[34px] sm:text-[44px] font-black leading-none my-1.5" style={{ color: THEMES.sunset.accent }}>iFood</p>
              <p className="text-[14px] sm:text-[17px] text-white/85 leading-tight">de novo, né 🍔</p>
              <p className="text-[10px] sm:text-xs text-white/60 mt-3 leading-snug">R$ 980 no mês — daria 12 idas ao cinema. Sem julgamentos (mentira).</p>
            </Card>
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

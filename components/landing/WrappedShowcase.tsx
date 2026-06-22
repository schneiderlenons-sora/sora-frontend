'use client';

import { useState } from 'react';
import { Calendar, Wallet, Sprout, Share2 } from 'lucide-react';

// Imagens de exemplo do Wrapped (artes 9:16, formato story).
// Coloque em public/landing/wrapped/ — índice 0 = centro (destaque).
const WRAPPED_IMGS = [
  '/landing/wrapped/1.png', // centro (a estrela)
  '/landing/wrapped/2.png', // esquerda
  '/landing/wrapped/3.png', // direita
];

// Card 9:16 com a arte do Wrapped (+ brilho de vidro). Fallback elegante
// enquanto a imagem não existe — a feature já fica apresentável.
function WrappedImg({ src }: { src: string }) {
  const [erro, setErro] = useState(false);
  return (
    <div className="relative w-full aspect-[9/16] rounded-[22px] overflow-hidden shadow-2xl ring-1 ring-black/20 dark:ring-white/10 bg-zinc-900">
      {erro ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center px-3"
             style={{ background: 'linear-gradient(160deg, rgba(97,206,112,0.22), rgba(124,58,237,0.12) 55%, #0a0a0c)' }}>
          <span className="text-3xl" aria-hidden>🐳</span>
          <span className="text-[10px] text-white/60">Wrapped em breve</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Exemplo do Sora Wrapped"
          loading="lazy"
          draggable={false}
          onError={() => setErro(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
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
      onTouchMove={() => setActive(false)}   /* dedo moveu = rolagem → cancela o efeito (sem jank) */
      onTouchEnd={() => setActive(false)}
      onTouchCancel={() => setActive(false)}
    >
      {children}
    </div>
  );
}

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
            {/* esquerda */}
            <FanItem base="w-[164px] sm:w-[210px] z-10 -rotate-[10deg] -translate-x-[60%] sm:-translate-x-[78%] translate-y-5">
              <WrappedImg src={WRAPPED_IMGS[1]} />
            </FanItem>
            {/* direita */}
            <FanItem base="w-[164px] sm:w-[210px] z-10 rotate-[10deg] translate-x-[60%] sm:translate-x-[78%] translate-y-5">
              <WrappedImg src={WRAPPED_IMGS[2]} />
            </FanItem>
            {/* centro — a estrela */}
            <FanItem base="w-[210px] sm:w-[258px] z-30">
              <WrappedImg src={WRAPPED_IMGS[0]} />
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

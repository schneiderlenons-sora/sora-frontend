'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Seção da aba Saúde (Sora Grow) — carrossel com 3 prints (dashboard,
// nutrição/macros e calculadora). Imagens em public/landing/.
const SLIDES = [
  { src: '/landing/saude-dashboard.png',   titulo: 'Dashboard de saúde',      desc: 'Peso, água, treinos e consultas — tudo num lugar só.' },
  { src: '/landing/saude-nutricao.png',    titulo: 'Macros do dia',           desc: 'Proteínas, carboidratos e gorduras calculados automaticamente.' },
  { src: '/landing/saude-calculadora.png', titulo: 'Calculadora nutricional', desc: 'Descubra suas metas ideais em segundos.' },
];

export default function SaudeShowcase() {
  const [idx, setIdx]       = useState(0);
  const [paused, setPaused] = useState(false);
  const n = SLIDES.length;
  const go = (i: number) => setIdx((i + n) % n);

  // Autoplay suave — pausa no hover/foco e respeita reduced-motion.
  useEffect(() => {
    if (paused) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setTimeout(() => setIdx(p => (p + 1) % n), 5000);
    return () => clearTimeout(t);
  }, [idx, paused, n]);

  const ativo = SLIDES[idx];

  return (
    <section className="relative py-24 lg:py-32 border-t border-zinc-200/50 dark:border-white/[0.04] overflow-hidden">
      {/* Glow de fundo sutil (mesmo padrão das outras seções) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-20 dark:opacity-15"
          style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.18) 0%, transparent 60%)' }}
        />
      </div>

      <div className="relative max-w-5xl mx-auto px-5 sm:px-8 text-center">
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
          Corpo em dia
        </p>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-[-0.03em] max-w-3xl mx-auto">
          Sua saúde com a mesma clareza das suas finanças
        </h2>

        {/* ── Carrossel ── */}
        <div
          className="relative mt-12 mb-7 max-w-3xl lg:max-w-4xl mx-auto group/carousel"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          role="group"
          aria-roledescription="carrossel"
          aria-label="Prints da aba Saúde"
        >
          {/* Glow colorido atrás do frame (efeito) */}
          <div aria-hidden className="absolute -inset-6 sm:-inset-10 pointer-events-none">
            <div className="w-full h-full rounded-[40px] opacity-60 blur-2xl"
                 style={{ background: 'radial-gradient(60% 60% at 50% 40%, rgba(97,206,112,0.28) 0%, transparent 70%)' }} />
          </div>

          {/* Frame com a trilha de imagens */}
          <div className="relative rounded-2xl overflow-hidden ring-1 ring-zinc-200 dark:ring-white/10 shadow-2xl shadow-black/10 dark:shadow-black/50 bg-white dark:bg-white/[0.03] transition-transform duration-500 group-hover/carousel:scale-[1.01]">
            <div className="flex transition-transform duration-500 ease-out"
                 style={{ transform: `translateX(-${idx * 100}%)` }}>
              {SLIDES.map((s, i) => (
                <div key={s.src} className="w-full flex-shrink-0 aspect-[2/1]">
                  {/* aspect-[2/1] reserva a altura ANTES da imagem carregar —
                      sem isso o frame nasce com ~0px e "estoura" ao carregar,
                      empurrando tudo abaixo (Wrapped + resto da landing). */}
                  <img
                    src={s.src}
                    alt={s.titulo}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    aria-hidden={i !== idx}
                    className="block w-full h-full object-contain select-none"
                    draggable={false}
                  />
                </div>
              ))}
            </div>

            {/* brilho sutil de vidro no topo (efeito) */}
            <div aria-hidden className="absolute inset-x-0 top-0 h-1/3 pointer-events-none bg-gradient-to-b from-white/10 to-transparent" />
          </div>

          {/* Setas */}
          <button onClick={() => go(idx - 1)} aria-label="Anterior"
            className="absolute left-2 sm:-left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-white/90 dark:bg-zinc-900/80 ring-1 ring-zinc-200 dark:ring-white/10 shadow-lg text-zinc-700 dark:text-white/80 backdrop-blur transition-all hover:scale-105 active:scale-95">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => go(idx + 1)} aria-label="Próximo"
            className="absolute right-2 sm:-right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-white/90 dark:bg-zinc-900/80 ring-1 ring-zinc-200 dark:ring-white/10 shadow-lg text-zinc-700 dark:text-white/80 backdrop-blur transition-all hover:scale-105 active:scale-95">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Legenda do slide ativo (troca junto).
            min-h fixo: as descrições têm 1 ou 2 linhas (46↔66px). Sem reservar
            a altura, cada troca do autoplay (5s) mudava a altura e empurrava
            TODA a landing abaixo uns 20px — os "pulos frequentes" relatados. */}
        <div key={idx} className="animate-fade-in mb-5 min-h-[66px] flex flex-col justify-center">
          <p className="text-base font-bold text-zinc-900 dark:text-white">{ativo.titulo}</p>
          <p className="text-sm text-zinc-500 dark:text-white/50 mt-0.5">{ativo.desc}</p>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mb-9">
          {SLIDES.map((s, i) => (
            <button key={s.src} onClick={() => go(i)} aria-label={`Ir para ${s.titulo}`} aria-current={i === idx}
              className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-[#61ce70]' : 'w-2 bg-zinc-300 dark:bg-white/20 hover:bg-zinc-400 dark:hover:bg-white/40'}`} />
          ))}
        </div>

        <p className="text-base lg:text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto">
          Registre o que comeu e a Sora calcula proteínas, carboidratos e gorduras do seu dia
          na hora. Com uma calculadora nutricional completa pra você bater suas metas — do
          controle do bolso ao controle do prato, tudo num só lugar.
        </p>
      </div>
    </section>
  );
}

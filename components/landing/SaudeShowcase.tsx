'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Camera } from 'lucide-react';

// Seção "Corpo em dia" (Sora Grow · Saúde) — carrossel das 6 artes 9:16.
// Desktop mostra 3 por vez; mobile, 1 por vez. As imagens já têm texto
// explicativo, então não há legenda por slide. Coloque os arquivos em
// public/landing/corpo/ como 1.png … 6.png.
const IMAGENS = [1, 2, 3, 4, 5, 6].map((n) => `/landing/corpo/${n}.png`);

export default function SaudeShowcase() {
  const [perView, setPerView] = useState(3);
  const [idx, setIdx]         = useState(0);
  const [paused, setPaused]   = useState(false);
  const n = IMAGENS.length;

  // 3 imagens no desktop (≥768px), 1 no mobile.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const upd = () => setPerView(mq.matches ? 3 : 1);
    upd();
    mq.addEventListener('change', upd);
    return () => mq.removeEventListener('change', upd);
  }, []);

  const maxIdx = Math.max(0, n - perView);
  // Reajusta o índice se a quantidade visível mudar (resize).
  useEffect(() => { setIdx((i) => Math.min(i, maxIdx)); }, [maxIdx]);

  const go = (i: number) => setIdx(((i % (maxIdx + 1)) + (maxIdx + 1)) % (maxIdx + 1));

  // Autoplay suave — pausa no hover/foco e respeita reduced-motion.
  useEffect(() => {
    if (paused) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setTimeout(() => setIdx((p) => (p >= maxIdx ? 0 : p + 1)), 5000);
    return () => clearTimeout(t);
  }, [idx, paused, maxIdx]);

  return (
    <section className="relative py-24 lg:py-32 border-t border-zinc-200/50 dark:border-white/[0.04] overflow-hidden">
      {/* Glow de fundo sutil (mesmo padrão das outras seções) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-20 dark:opacity-15"
          style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.18) 0%, transparent 60%)' }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8 text-center">
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
          Corpo em dia
        </p>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-[-0.03em] max-w-3xl mx-auto">
          Sua saúde com a mesma clareza das suas finanças
        </h2>

        {/* ── Carrossel ── */}
        <div
          className="relative mt-12 mb-9 max-w-sm md:max-w-5xl mx-auto group/carousel"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          role="group"
          aria-roledescription="carrossel"
          aria-label="Telas da aba Saúde da Sora"
        >
          {/* Trilha de imagens (overflow escondido) */}
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${idx * (100 / perView)}%)` }}
            >
              {IMAGENS.map((src, i) => (
                <div key={src} className="w-full md:w-1/3 flex-shrink-0 px-2 sm:px-2.5">
                  {/* aspect-[9/16] reserva a altura ANTES da imagem carregar —
                      evita o "estouro" que empurra o resto da landing. */}
                  <div className="rounded-3xl overflow-hidden aspect-[9/16] bg-zinc-100 dark:bg-white/[0.03] ring-1 ring-zinc-200/70 dark:ring-white/10 shadow-lg shadow-black/10 dark:shadow-black/40">
                    <img
                      src={src}
                      alt=""
                      loading={i < perView ? 'eager' : 'lazy'}
                      className="block w-full h-full object-cover select-none"
                      draggable={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Setas */}
          <button onClick={() => go(idx - 1)} aria-label="Anterior"
            className="absolute -left-2 sm:-left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-white/90 dark:bg-zinc-900/80 ring-1 ring-zinc-200 dark:ring-white/10 shadow-lg text-zinc-700 dark:text-white/80 backdrop-blur transition-all hover:scale-105 active:scale-95">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => go(idx + 1)} aria-label="Próximo"
            className="absolute -right-2 sm:-right-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-white/90 dark:bg-zinc-900/80 ring-1 ring-zinc-200 dark:ring-white/10 shadow-lg text-zinc-700 dark:text-white/80 backdrop-blur transition-all hover:scale-105 active:scale-95">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Dots (uma posição por "página" do carrossel) */}
        <div className="flex items-center justify-center gap-2 mb-9">
          {Array.from({ length: maxIdx + 1 }).map((_, i) => (
            <button key={i} onClick={() => go(i)} aria-label={`Ir para a posição ${i + 1}`} aria-current={i === idx}
              className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-[#61ce70]' : 'w-2 bg-zinc-300 dark:bg-white/20 hover:bg-zinc-400 dark:hover:bg-white/40'}`} />
          ))}
        </div>

        <p className="text-base lg:text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto">
          Registre o que comeu e a Sora calcula proteínas, carboidratos e gorduras do seu dia
          na hora. Com uma calculadora nutricional completa pra você bater suas metas — do
          controle do bolso ao controle do prato, tudo num só lugar.
        </p>

        {/* Destaque: macros por foto */}
        <div className="mt-6 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#61ce70]/10 ring-1 ring-[#61ce70]/25">
          <Camera size={16} className="text-[#3FA85A] dark:text-[#61ce70] flex-shrink-0" />
          <p className="text-sm font-semibold text-zinc-700 dark:text-white/80">
            Novo: mande a <strong className="text-zinc-900 dark:text-white">foto do prato</strong> e a Sora calcula os macros na hora.
          </p>
        </div>
      </div>
    </section>
  );
}

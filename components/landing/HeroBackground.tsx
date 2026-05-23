'use client';

import { useEffect, useRef, useState } from 'react';

const BRAND = '#61ce70';

/**
 * Fundo do hero — estilo Lovable/Linear:
 * grid super sutil presente nas bordas, completamente apagado no centro
 * (área de leitura) e no topo (transição suave a partir do header).
 *
 * Camadas (ordem de pintura, de trás pra frente):
 *   1. Grid base                    — linhas 1px, opacidade 8–10% em todo hero
 *   2. Overlay TOP                  — fade vertical alto pra emergir do header
 *   3. Overlay CENTRAL              — radial amplo que apaga o grid sobre os textos
 *   4. Overlay BOTTOM               — fade vertical pra próxima seção
 *   5. Spotlight grid (desktop)     — segue cursor, sutil, sobre os overlays
 *   6. Pulse dots (2 sutis)         — vida sem distração
 *   7. Green glow + light beam      — identidade Sora
 *   8. Noise grain                  — textura imperceptível
 *
 * Sem cells highlights, sem multiplos elementos chamativos — minimalismo Apple.
 * Light + dark sem cores extras. Respeita prefers-reduced-motion.
 */
export default function HeroBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const el = containerRef.current;
    if (!el) return;

    let raf = 0;
    let targetX = 50, targetY = 30;
    let curX = 50, curY = 30;

    function onMove(e: PointerEvent) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      if (x < -10 || x > 110 || y < -10 || y > 110) {
        el.style.setProperty('--spot-opacity', '0');
        return;
      }
      targetX = x;
      targetY = y;
      el.style.setProperty('--spot-opacity', '1');
      if (!raf) raf = requestAnimationFrame(loop);
    }

    function onLeave() {
      el?.style.setProperty('--spot-opacity', '0');
    }

    function loop() {
      curX += (targetX - curX) * 0.18;
      curY += (targetY - curY) * 0.18;
      el?.style.setProperty('--spot-x', `${curX}%`);
      el?.style.setProperty('--spot-y', `${curY}%`);
      const dx = Math.abs(targetX - curX);
      const dy = Math.abs(targetY - curY);
      if (dx < 0.05 && dy < 0.05) { raf = 0; return; }
      raf = requestAnimationFrame(loop);
    }

    window.addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="absolute inset-0 -z-10 pointer-events-none overflow-hidden"
      style={{
        ['--spot-x' as string]: '50%',
        ['--spot-y' as string]: '30%',
        ['--spot-opacity' as string]: '0',
      } as React.CSSProperties}
    >
      {/* ═════════════════════════════════════════════════════════════
          1. GRID BASE — sutil, linhas finas, cobre todo o hero
          ═════════════════════════════════════════════════════════════ */}
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(15, 23, 42, 0.09) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(15, 23, 42, 0.09) 1px, transparent 1px)
          `,
          backgroundSize: '84px 84px',
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.10) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.10) 1px, transparent 1px)
          `,
          backgroundSize: '84px 84px',
        }}
      />

      {/* ═════════════════════════════════════════════════════════════
          2. OVERLAY TOP — fade longo, grid emerge muito suave do header
          (h-80 = 320px, equivale a ~30% de um hero de 1000px)
          ═════════════════════════════════════════════════════════════ */}
      <div
        className="absolute inset-x-0 top-0 h-80 dark:hidden"
        style={{
          background:
            'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0.92) 30%, rgba(255,255,255,0.6) 60%, rgba(255,255,255,0.2) 85%, transparent 100%)',
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-80 hidden dark:block"
        style={{
          background:
            'linear-gradient(to bottom, rgba(10,10,10,1) 0%, rgba(10,10,10,0.92) 30%, rgba(10,10,10,0.6) 60%, rgba(10,10,10,0.2) 85%, transparent 100%)',
        }}
      />

      {/* ═════════════════════════════════════════════════════════════
          3. OVERLAY CENTRAL — radial AMPLO que apaga o grid sobre todo
          o conteúdo (título + subtítulo + CTAs). Cobre 75% × 70% do
          hero, centrado em 50% 50%.
          ═════════════════════════════════════════════════════════════ */}
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          background:
            'radial-gradient(ellipse 75% 70% at 50% 50%, rgba(255,255,255,1) 5%, rgba(255,255,255,0.92) 30%, rgba(255,255,255,0.55) 55%, rgba(255,255,255,0.15) 80%, transparent 100%)',
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background:
            'radial-gradient(ellipse 75% 70% at 50% 50%, rgba(10,10,10,1) 5%, rgba(10,10,10,0.92) 30%, rgba(10,10,10,0.55) 55%, rgba(10,10,10,0.15) 80%, transparent 100%)',
        }}
      />

      {/* ═════════════════════════════════════════════════════════════
          4. OVERLAY BOTTOM — fade pra próxima seção
          ═════════════════════════════════════════════════════════════ */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-white dark:to-[#0a0a0a]" />

      {/* ═════════════════════════════════════════════════════════════
          5. SPOTLIGHT GRID — só desktop, segue cursor, bem sutil
          ═════════════════════════════════════════════════════════════ */}
      {!reducedMotion && (
        <>
          <div
            className="hidden lg:block dark:lg:hidden absolute inset-0 transition-opacity duration-500"
            style={{
              opacity: 'var(--spot-opacity)',
              backgroundImage: `
                linear-gradient(to right, rgba(15, 23, 42, 0.22) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(15, 23, 42, 0.22) 1px, transparent 1px)
              `,
              backgroundSize: '84px 84px',
              maskImage: 'radial-gradient(320px circle at var(--spot-x) var(--spot-y), black 0%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(320px circle at var(--spot-x) var(--spot-y), black 0%, transparent 70%)',
            }}
          />
          <div
            className="hidden dark:lg:block absolute inset-0 transition-opacity duration-500"
            style={{
              opacity: 'var(--spot-opacity)',
              backgroundImage: `
                linear-gradient(to right, rgba(255, 255, 255, 0.28) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.28) 1px, transparent 1px)
              `,
              backgroundSize: '84px 84px',
              maskImage: 'radial-gradient(320px circle at var(--spot-x) var(--spot-y), black 0%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(320px circle at var(--spot-x) var(--spot-y), black 0%, transparent 70%)',
            }}
          />
        </>
      )}

      {/* ═════════════════════════════════════════════════════════════
          6. PULSE DOTS (apenas 2, nos cantos extremos)
          ═════════════════════════════════════════════════════════════ */}
      {!reducedMotion && (
        <>
          <style>{`
            @keyframes hero-pulse {
              0%, 100% { opacity: 0; transform: scale(0.6); }
              50%      { opacity: 0.7; transform: scale(1); }
            }
          `}</style>
          <div className="absolute inset-0 hidden lg:block text-zinc-700 dark:text-white">
            <div
              className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2 bg-current"
              style={{
                top: '12%',
                left: '92%',
                boxShadow: '0 0 6px currentColor',
                animation: 'hero-pulse 3.5s ease-in-out infinite',
              }}
            />
            <div
              className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2 bg-current"
              style={{
                top: '75%',
                left: '6%',
                boxShadow: '0 0 6px currentColor',
                animation: 'hero-pulse 3.5s ease-in-out infinite',
                animationDelay: '1.8s',
              }}
            />
          </div>
        </>
      )}

      {/* ═════════════════════════════════════════════════════════════
          7. GREEN GLOW + LIGHT BEAM — identidade Sora
          ═════════════════════════════════════════════════════════════ */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full opacity-25 dark:opacity-35"
        style={{ background: `radial-gradient(ellipse, ${BRAND}22 0%, transparent 60%)` }}
      />
      <div
        className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-px h-[40vh] opacity-50 dark:opacity-35"
        style={{ background: `linear-gradient(to bottom, ${BRAND}80, transparent)` }}
      />

      {/* ═════════════════════════════════════════════════════════════
          8. NOISE GRAIN — quebra gradientes, sutil
          ═════════════════════════════════════════════════════════════ */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

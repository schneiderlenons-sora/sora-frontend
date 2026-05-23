'use client';

import { useEffect, useRef, useState } from 'react';

const BRAND = '#61ce70';

/**
 * Fundo cinematográfico do hero — arquitetura por camadas:
 *
 *   1. Grid base               — sempre presente, em todo o hero
 *   2. Overlay TOP             — emerge suavemente do header (cor do BG + fade)
 *   3. Overlay HEADLINE        — protege a área do título com radial (cor do BG)
 *   4. Overlay BOTTOM          — funde com a próxima seção
 *   5. Spotlight grid          — segue o cursor (Linear-style)
 *   6. Cell highlights         — quadrados acentuados nos cantos
 *   7. Pulse dots              — pontos pulsando (vida)
 *   8. Green glow              — halo da marca no topo
 *   9. Light beam              — feixe vertical fino
 *  10. Noise                   — grain
 *
 * Light + dark sem cores extras (rgba branco / rgba zinc).
 * Respeita prefers-reduced-motion (desliga spotlight + pulse).
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

  // Spotlight cursor (desktop, sem reduced-motion)
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
          CAMADA 1 — GRID BASE (sempre presente, sem máscaras)
          ═════════════════════════════════════════════════════════════ */}
      {/* Light */}
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(15, 23, 42, 0.18) 1.5px, transparent 1.5px),
            linear-gradient(to bottom, rgba(15, 23, 42, 0.18) 1.5px, transparent 1.5px)
          `,
          backgroundSize: '72px 72px',
        }}
      />
      {/* Dark */}
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.20) 1.5px, transparent 1.5px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.20) 1.5px, transparent 1.5px)
          `,
          backgroundSize: '72px 72px',
        }}
      />

      {/* ═════════════════════════════════════════════════════════════
          CAMADA 2 — OVERLAY TOP (fade do header, grid emerge suave)
          ═════════════════════════════════════════════════════════════ */}
      <div
        className="absolute inset-x-0 top-0 h-40 dark:hidden"
        style={{
          background:
            'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 35%, rgba(255,255,255,0.35) 70%, transparent 100%)',
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-40 hidden dark:block"
        style={{
          background:
            'linear-gradient(to bottom, rgba(10,10,10,1) 0%, rgba(10,10,10,0.85) 35%, rgba(10,10,10,0.35) 70%, transparent 100%)',
        }}
      />

      {/* ═════════════════════════════════════════════════════════════
          CAMADA 3 — OVERLAY HEADLINE (protege o título, lado esquerdo)
          Elipse centrada no centro-esquerda (onde fica o título).
          Opaca no centro, dissolve nas bordas — apaga o grid.
          ═════════════════════════════════════════════════════════════ */}
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          background:
            'radial-gradient(ellipse 60% 65% at 28% 55%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.85) 30%, rgba(255,255,255,0.5) 55%, transparent 85%)',
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background:
            'radial-gradient(ellipse 60% 65% at 28% 55%, rgba(10,10,10,0.98) 0%, rgba(10,10,10,0.85) 30%, rgba(10,10,10,0.5) 55%, transparent 85%)',
        }}
      />

      {/* ═════════════════════════════════════════════════════════════
          CAMADA 4 — OVERLAY BOTTOM (fade pra próxima seção)
          ═════════════════════════════════════════════════════════════ */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white dark:to-[#0a0a0a]" />

      {/* ═════════════════════════════════════════════════════════════
          CAMADA 5 — SPOTLIGHT GRID (segue o cursor)
          Acima dos overlays pra ser sempre visível na trajetória.
          ═════════════════════════════════════════════════════════════ */}
      {!reducedMotion && (
        <>
          <div
            className="hidden lg:block dark:lg:hidden absolute inset-0 transition-opacity duration-500"
            style={{
              opacity: 'var(--spot-opacity)',
              backgroundImage: `
                linear-gradient(to right, rgba(15, 23, 42, 0.32) 1.5px, transparent 1.5px),
                linear-gradient(to bottom, rgba(15, 23, 42, 0.32) 1.5px, transparent 1.5px)
              `,
              backgroundSize: '72px 72px',
              maskImage: 'radial-gradient(360px circle at var(--spot-x) var(--spot-y), black 5%, transparent 65%)',
              WebkitMaskImage: 'radial-gradient(360px circle at var(--spot-x) var(--spot-y), black 5%, transparent 65%)',
            }}
          />
          <div
            className="hidden dark:lg:block absolute inset-0 transition-opacity duration-500"
            style={{
              opacity: 'var(--spot-opacity)',
              backgroundImage: `
                linear-gradient(to right, rgba(255, 255, 255, 0.4) 1.5px, transparent 1.5px),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.4) 1.5px, transparent 1.5px)
              `,
              backgroundSize: '72px 72px',
              maskImage: 'radial-gradient(360px circle at var(--spot-x) var(--spot-y), black 5%, transparent 65%)',
              WebkitMaskImage: 'radial-gradient(360px circle at var(--spot-x) var(--spot-y), black 5%, transparent 65%)',
            }}
          />
        </>
      )}

      {/* ═════════════════════════════════════════════════════════════
          CAMADA 6 — CELL HIGHLIGHTS (cantos absolutos)
          Acima dos overlays pra ficarem sempre visíveis. Posicionadas
          fora completamente da área do título.
          ═════════════════════════════════════════════════════════════ */}
      <CellHighlights />

      {/* ═════════════════════════════════════════════════════════════
          CAMADA 7 — PULSE DOTS
          ═════════════════════════════════════════════════════════════ */}
      {!reducedMotion && <PulseDots />}

      {/* ═════════════════════════════════════════════════════════════
          CAMADA 8 — GREEN GLOW (identidade Sora)
          ═════════════════════════════════════════════════════════════ */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full opacity-30 dark:opacity-40"
        style={{ background: `radial-gradient(ellipse, ${BRAND}22 0%, transparent 60%)` }}
      />

      {/* ═════════════════════════════════════════════════════════════
          CAMADA 9 — LIGHT BEAM (feixe vertical fino do topo)
          ═════════════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-px h-[40vh] opacity-60 dark:opacity-40"
        style={{ background: `linear-gradient(to bottom, ${BRAND}80, transparent)` }}
      />

      {/* ═════════════════════════════════════════════════════════════
          CAMADA 10 — NOISE GRAIN
          ═════════════════════════════════════════════════════════════ */}
      <div
        className="absolute inset-0 opacity-[0.018] dark:opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

// ─── Cell Highlights ─────────────────────────────────────────────────────────
// Posições nos 4 cantos absolutos + 2 bordas (longe da headline e dos phones).

function CellHighlights() {
  const cells = [
    { top: '4%',   left: '2%',   o: 0.13 },  // canto sup esq
    { top: '4%',   left: '94%',  o: 0.13 },  // canto sup dir
    { top: '86%',  left: '4%',   o: 0.10 },  // canto inf esq
    { top: '86%',  left: '92%',  o: 0.10 },  // canto inf dir
    { top: '14%',  left: '92%',  o: 0.09 },  // borda dir alta
    { top: '70%',  left: '2%',   o: 0.09 },  // borda esq baixa
  ];

  return (
    <div className="absolute inset-0 hidden sm:block">
      {cells.map((c, i) => (
        <div key={i} className="absolute w-[72px] h-[72px]" style={{ top: c.top, left: c.left }}>
          <div className="absolute inset-0 dark:hidden" style={{ background: `rgba(15, 23, 42, ${c.o})` }} />
          <div className="absolute inset-0 hidden dark:block" style={{ background: `rgba(255, 255, 255, ${c.o + 0.02})` }} />
        </div>
      ))}
    </div>
  );
}

// ─── Pulse Dots ──────────────────────────────────────────────────────────────
// Pontos brancos/escuros pulsando em interseções do grid.

function PulseDots() {
  const dots = [
    { top: '18%', left: '6%',  delay: '0s'   },
    { top: '32%', left: '95%', delay: '1.2s' },
    { top: '52%', left: '4%',  delay: '2.4s' },
    { top: '70%', left: '90%', delay: '0.8s' },
    { top: '12%', left: '88%', delay: '1.8s' },
  ];

  return (
    <>
      <style>{`
        @keyframes hero-pulse {
          0%, 100% { opacity: 0; transform: scale(0.6); }
          50%      { opacity: 0.85; transform: scale(1); }
        }
        @keyframes hero-pulse-halo {
          0%   { opacity: 0.5; transform: scale(0.5); }
          100% { opacity: 0;   transform: scale(3); }
        }
      `}</style>
      <div className="absolute inset-0 hidden sm:block text-zinc-700 dark:text-white">
        {dots.map((d, i) => (
          <div key={i} className="absolute" style={{ top: d.top, left: d.left }}>
            <div
              className="absolute w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2 bg-current opacity-50"
              style={{
                animation: `hero-pulse-halo 3.5s ease-out infinite`,
                animationDelay: d.delay,
              }}
            />
            <div
              className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2 bg-current"
              style={{
                boxShadow: '0 0 6px currentColor',
                animation: `hero-pulse 3.5s ease-in-out infinite`,
                animationDelay: d.delay,
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}

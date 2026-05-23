'use client';

import { useEffect, useRef, useState } from 'react';

const BRAND = '#61ce70';

/**
 * Fundo cinematográfico do hero — 7 camadas combinadas:
 *
 *   1. Grid base               — quadradinhos sutis com fade radial (sempre visível)
 *   2. Spotlight grid          — grid amplificado que segue o cursor (Linear-style)
 *   3. Cell highlights         — alguns quadrados pintados (constelação)
 *   4. Pulse dots              — pontos pulsando em interseções (estática suave)
 *   5. Green glow              — halo da marca no topo
 *   6. Light beam              — feixe vertical fino do topo
 *   7. Noise                   — grain pra quebrar gradientes
 *
 * Tudo respeita `prefers-reduced-motion`: spotlight e pulse desabilitam.
 * Funciona em light e dark sem cores adicionais (usa currentColor + opacidade).
 */
export default function HeroBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Detecta preferência de motion reduzido
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Spotlight que segue o cursor (apenas desktop, sem reduced-motion)
  useEffect(() => {
    if (reducedMotion) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(pointer: coarse)').matches) return; // só pointers finos (mouse)

    const el = containerRef.current;
    if (!el) return;

    let raf = 0;
    let targetX = 50, targetY = 30; // valores em % iniciais
    let curX = 50, curY = 30;

    function onMove(e: PointerEvent) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      // Só atualiza se o cursor está dentro (com margem)
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

    // Easing pra mover suavemente (não saltar com movimentos bruscos)
    function loop() {
      curX += (targetX - curX) * 0.18;
      curY += (targetY - curY) * 0.18;
      el?.style.setProperty('--spot-x', `${curX}%`);
      el?.style.setProperty('--spot-y', `${curY}%`);
      const dx = Math.abs(targetX - curX);
      const dy = Math.abs(targetY - curY);
      if (dx < 0.05 && dy < 0.05) {
        raf = 0;
        return;
      }
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
        // CSS vars usadas no spotlight
        ['--spot-x' as string]: '50%',
        ['--spot-y' as string]: '30%',
        ['--spot-opacity' as string]: '0',
      } as React.CSSProperties}
    >
      {/* ── 1. GRID BASE ──────────────────────────────────────────────
          Bem visível no topo, dissolve aos poucos pra baixo.
          Estilo Lovable/Concursa. currentColor herda do texto (light: zinc
          950, dark: white) — sem cores adicionais.                        */}
      <div
        className="absolute inset-0 opacity-[0.16] dark:opacity-[0.22]"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          // Fade vertical: visível no topo, some perto da próxima seção
          maskImage: 'linear-gradient(to bottom, black 0%, black 45%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 45%, transparent 100%)',
        }}
      />

      {/* ── 2. SPOTLIGHT GRID ─────────────────────────────────────────
          Grid amplificado (mais visível) revelado pela posição do cursor.
          Linear/Vercel-style: efeito "lanterna" sobre o grid base.        */}
      {!reducedMotion && (
        <div
          className="hidden lg:block absolute inset-0 transition-opacity duration-500 opacity-[0.18] dark:opacity-[0.22]"
          style={{
            opacity: `calc(var(--spot-opacity) * 1)`,
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(360px circle at var(--spot-x) var(--spot-y), black 5%, transparent 65%)',
            WebkitMaskImage: 'radial-gradient(360px circle at var(--spot-x) var(--spot-y), black 5%, transparent 65%)',
          }}
        />
      )}

      {/* ── 3. CELL HIGHLIGHTS — "constelação" ─────────────────────────
          Alguns quadrados sutilmente pintados, alinhados ao grid de 64px.
          Posicionados em % pra responder ao viewport. Dão profundidade
          sem competir com o grid principal.                              */}
      <CellHighlights />

      {/* ── 4. PULSE DOTS ─────────────────────────────────────────────
          Pontos brancos pulsando suavemente em pontos do grid.
          Cria sensação de "vida" sem ser distrativo.                     */}
      {!reducedMotion && <PulseDots />}

      {/* ── 5. GREEN GLOW ─────────────────────────────────────────────
          Halo verde no topo, reforça identidade Sora.                    */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full opacity-30 dark:opacity-40"
        style={{ background: `radial-gradient(ellipse, ${BRAND}22 0%, transparent 60%)` }}
      />

      {/* ── 6. LIGHT BEAM ─────────────────────────────────────────────
          Feixe vertical fino do topo (depth + foco na headline).         */}
      <div
        className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-px h-[40vh] opacity-60 dark:opacity-40"
        style={{ background: `linear-gradient(to bottom, ${BRAND}80, transparent)` }}
      />

      {/* ── 7. NOISE GRAIN ────────────────────────────────────────────
          Textura sutil que quebra o gradient liso e dá sensação de mídia
          impressa de qualidade.                                          */}
      <div
        className="absolute inset-0 opacity-[0.018] dark:opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── 8. BOTTOM FADE ────────────────────────────────────────────
          Transição suave pra próxima seção, evita corte abrupto.         */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-white dark:to-[#0a0a0a]" />
    </div>
  );
}

// ─── Cell Highlights ─────────────────────────────────────────────────────────
// Quadrados pintados em posições fixas. Posições escolhidas pra dar uma
// "constelação" equilibrada — nem amontoado, nem espalhado demais.

function CellHighlights() {
  // Constelação balanceada pelos cantos. Tamanho 64px = grid match.
  // Opacidades variadas pra dar profundidade (sem ficar uniforme).
  const cells = [
    { top: '8%',   left: '12%',  o: 0.14 },
    { top: '14%',  left: '78%',  o: 0.16 },
    { top: '24%',  left: '4%',   o: 0.10 },
    { top: '32%',  left: '88%',  o: 0.12 },
    { top: '46%',  left: '18%',  o: 0.09 },
    { top: '54%',  left: '76%',  o: 0.11 },
    { top: '16%',  left: '44%',  o: 0.08 },
    { top: '38%',  left: '60%',  o: 0.07 },
    { top: '6%',   left: '92%',  o: 0.12 },
    { top: '26%',  left: '34%',  o: 0.07 },
  ];

  return (
    <div
      className="absolute inset-0 hidden sm:block"
      style={{
        maskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 95%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 95%)',
      }}
    >
      {cells.map((c, i) => (
        <div
          key={i}
          className="absolute w-16 h-16"
          style={{
            top: c.top,
            left: c.left,
            background: 'currentColor',
            opacity: c.o,
          }}
        />
      ))}
    </div>
  );
}

// ─── Pulse Dots ──────────────────────────────────────────────────────────────
// Pequenos pontos em interseções do grid pulsando suavemente.
// Usa keyframes inline pra não depender do tailwind.config.

function PulseDots() {
  const dots = [
    { top: '18%', left: '24%', delay: '0s'   },
    { top: '32%', left: '74%', delay: '1.2s' },
    { top: '52%', left: '14%', delay: '2.4s' },
    { top: '60%', left: '82%', delay: '0.8s' },
    { top: '28%', left: '52%', delay: '1.8s' },
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
          <div
            key={i}
            className="absolute"
            style={{ top: d.top, left: d.left }}
          >
            {/* Halo expansivo (neutro, herda do tema) */}
            <div
              className="absolute w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2 bg-current opacity-50"
              style={{
                animation: `hero-pulse-halo 3.5s ease-out infinite`,
                animationDelay: d.delay,
              }}
            />
            {/* Dot central (neutro, ligeiro glow neutro) */}
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

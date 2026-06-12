'use client';

import { useEffect, useRef, useState } from 'react';
import type { WrappedTheme } from '@/lib/wrapped/themes';

// ─── Grão de filme animado (textura premium, estilo capa de disco) ───────
export function Grain({ opacity = 0.18 }: { opacity?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-overlay">
      <div
        className="absolute -inset-[60%] motion-safe:animate-[wr-grain_1.1s_steps(6)_infinite]"
        style={{
          opacity,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundSize: '200px 200px',
        }}
      />
    </div>
  );
}

// ─── Blobs orgânicos derivando no fundo ──────────────────────────────────
export function Blobs({ theme }: { theme: WrappedTheme }) {
  const cfg = [
    { c: theme.blobs[0], top: '-12%', left: '-18%', size: 320, dur: 9,  r: -8 },
    { c: theme.blobs[1], top: '38%',  left: '52%',  size: 300, dur: 12, r: 6 },
    { c: theme.blobs[2], top: '64%',  left: '-10%', size: 260, dur: 10, r: 0 },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {cfg.map((b, i) => (
        <div key={i}
          className="absolute rounded-full blur-[60px] opacity-50 motion-safe:animate-[wr-blob_var(--d)_ease-in-out_infinite]"
          style={{
            top: b.top, left: b.left, width: b.size, height: b.size,
            background: `radial-gradient(circle, ${b.c} 0%, transparent 70%)`,
            ['--d' as string]: `${b.dur}s`,
            animationDelay: `${i * -2.5}s`,
          }} />
      ))}
    </div>
  );
}

// ─── Reveal por máscara (linha sobe atrás de uma cortina) ────────────────
export function Reveal({
  children, delay = 0, className = '',
}: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <span className={`block overflow-hidden ${className}`}>
      <span
        className="block motion-safe:animate-[wr-reveal_700ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
        style={{ animationDelay: `${delay}ms` }}
      >
        {children}
      </span>
    </span>
  );
}

// ─── Pop (escala + fade) pra ícones/selos/personas ───────────────────────
export function Pop({
  children, delay = 0, className = '',
}: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <span
      className={`inline-block motion-safe:animate-[wr-pop_600ms_cubic-bezier(0.34,1.56,0.64,1)_both] motion-reduce:animate-none ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </span>
  );
}

// ─── Número com count-up (ease-out cubic) ────────────────────────────────
export function CountUp({
  valor, format, duration = 1500, delay = 250,
}: { valor: number; format: (n: number) => string; duration?: number; delay?: number }) {
  const [v, setV] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setV(valor); return; }
    let startTs = 0;
    const begin = performance.now() + delay;
    function step(now: number) {
      if (now < begin) { raf.current = requestAnimationFrame(step); return; }
      if (!startTs) startTs = now;
      const p = Math.min(1, (now - startTs) / duration);
      setV(valor * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(step);
    }
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [valor, duration, delay]);

  return <>{format(v)}</>;
}

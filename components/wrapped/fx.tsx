'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { WrappedTheme } from '@/lib/wrapped/themes';

// "Still" = sem animação contínua (usado nos mockups da landing pra evitar
// jank/repaint constante). No player fica false (animação completa).
export const WrappedStill = createContext(false);

// ─── Grão de filme animado (textura premium, estilo capa de disco) ───────
export function Grain({ opacity = 0.18 }: { opacity?: number }) {
  const still = useContext(WrappedStill);
  if (still) return null; // mockups da landing: sem grão (pintura mais leve)
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-overlay">
      <div
        className={`absolute -inset-[60%] ${still ? '' : 'motion-safe:animate-[wr-grain_1.1s_steps(6)_infinite]'}`}
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
  const still = useContext(WrappedStill);
  if (still) return null; // mockups da landing: sem blur pesado (evita jank no scroll)
  const cfg = [
    { c: theme.blobs[0], top: '-12%', left: '-18%', size: 320, dur: 9,  r: -8 },
    { c: theme.blobs[1], top: '38%',  left: '52%',  size: 300, dur: 12, r: 6 },
    { c: theme.blobs[2], top: '64%',  left: '-10%', size: 260, dur: 10, r: 0 },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {cfg.map((b, i) => (
        <div key={i}
          className={`absolute rounded-full blur-[60px] opacity-50 ${still ? '' : 'motion-safe:animate-[wr-blob_var(--d)_ease-in-out_infinite]'}`}
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

// ─── Baleia mascote (orca streetwear com óculos verdes) ──────────────────
export function WhaleMascot({ accent = '#a3e635', className = '', style }:
  { accent?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 200 150" className={className} style={style} aria-hidden>
      {/* cauda */}
      <path d="M148 76 L190 50 Q181 76 190 102 Z" fill="#0b1015" />
      {/* corpo */}
      <ellipse cx="92" cy="80" rx="63" ry="43" fill="#0b1015" />
      {/* barriga branca */}
      <path d="M38 98 Q92 126 152 94 Q118 112 92 112 Q66 112 38 98 Z" fill="#f4f7f5" />
      {/* nadadeira de cima */}
      <path d="M84 38 Q95 20 113 33 Q100 40 84 43 Z" fill="#0b1015" />
      {/* nadadeira lateral */}
      <path d="M68 98 Q77 116 96 106 Q84 102 75 93 Z" fill="#070b0e" />
      {/* mancha branca do olho */}
      <ellipse cx="58" cy="66" rx="13" ry="8.5" fill="#f4f7f5" transform="rotate(-14 58 66)" />
      {/* óculos verdes */}
      <g>
        <rect x="40" y="60" width="18" height="13" rx="5.5" fill={accent} stroke="#0b1015" strokeWidth="1.5" />
        <rect x="60" y="60" width="18" height="13" rx="5.5" fill={accent} stroke="#0b1015" strokeWidth="1.5" />
        <rect x="57" y="64" width="5" height="3" fill="#0b1015" />
        <circle cx="46" cy="65" r="2" fill="#fff" opacity="0.85" />
        <circle cx="66" cy="65" r="2" fill="#fff" opacity="0.85" />
      </g>
      {/* sorriso */}
      <path d="M48 88 Q60 95 74 88" stroke="#f4f7f5" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Baleia nadando (ambiente) — atravessa o slide num loop longo; congela na captura.
export function WhaleSwim({ accent, bottom = '14%' }: { accent: string; bottom?: string }) {
  const still = useContext(WrappedStill);
  return (
    <div aria-hidden className="absolute left-0 right-0 pointer-events-none overflow-hidden" style={{ bottom, height: 120 }}>
      <div className={`absolute w-[150px] ${still ? 'left-[7%]' : 'motion-safe:animate-[whale-cross_17s_linear_infinite] motion-reduce:left-[8%]'}`} style={{ ['--r' as string]: '0deg' }}>
        <div className={still ? '' : 'motion-safe:animate-[wr-float_3.5s_ease-in-out_infinite]'}>
          <WhaleMascot accent={accent} className="w-[150px] h-auto drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)]" style={{ opacity: 0.96 }} />
        </div>
      </div>
    </div>
  );
}

// ─── Halftone (textura de pontos, look de impressão/IG) ──────────────────
export function Halftone({ color = '#000000', opacity = 0.12, size = 9 }:
  { color?: string; opacity?: number; size?: number }) {
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none"
      style={{ opacity, backgroundImage: `radial-gradient(${color} 1.1px, transparent 1.3px)`, backgroundSize: `${size}px ${size}px` }} />
  );
}

// ─── Carimbo hinomaru (círculo vermelho + kanji) ─────────────────────────
export function Stamp({ kanji = '鯨', sub = 'クジラ', className = '' }:
  { kanji?: string; sub?: string; className?: string }) {
  return (
    <div aria-hidden className={`absolute flex flex-col items-center gap-1 ${className}`}>
      <div className="w-14 h-14 rounded-full flex items-center justify-center font-black text-[22px] text-white"
        style={{ background: '#e0202a', boxShadow: '0 4px 14px rgba(224,32,42,0.45)' }}>
        {kanji}
      </div>
      {sub && <span className="text-[9px] font-bold tracking-[0.2em]" style={{ color: 'currentColor', opacity: 0.6 }}>{sub}</span>}
    </div>
  );
}

// ─── Texto gigante de fundo (preenche espaço, estilo cartaz) ──────────────
export function BgWord({ children, color = '#ffffff' }: { children: React.ReactNode; color?: string }) {
  return (
    <span aria-hidden className="absolute -right-4 top-1/2 -translate-y-1/2 font-black uppercase leading-[0.8] tracking-tighter select-none pointer-events-none"
      style={{
        writingMode: 'vertical-rl', fontSize: 150, color: 'transparent',
        WebkitTextStroke: `1.5px ${color}`, opacity: 0.07,
      }}>
      {children}
    </span>
  );
}

// Divisória dupla fina (assinatura dos posts da Sora)
export function Divider({ color }: { color: string }) {
  return (
    <span aria-hidden className="block w-12 my-2" style={{ borderTop: `2px solid ${color}`, boxShadow: `0 4px 0 -2px ${color}` }} />
  );
}

// ─── Número com count-up (ease-out cubic) ────────────────────────────────
export function CountUp({
  valor, format, duration = 1500, delay = 250,
}: { valor: number; format: (n: number) => string; duration?: number; delay?: number }) {
  const still = useContext(WrappedStill);
  const [v, setV] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    const reduce = still || (typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
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

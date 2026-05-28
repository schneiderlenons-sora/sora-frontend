'use client';

import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────
// GrowHero — hero unificado pras abas do Sora Grow.
//
// Visual base (gradient sutil + halo radial colorido) é o mesmo das
// abas de Tarefas e Bem-estar no design original. Outras abas (Saúde,
// Estudos, Casa, Hábitos) estavam fora desse padrão; este componente
// normaliza tudo num só lugar.
//
// O Dashboard do Grow mantém o hero próprio (com saudação dinâmica +
// frase motivacional) — não usar este componente lá.
// ─────────────────────────────────────────────────────────────

interface Props {
  badge:      string;                          // "Tarefas", "Hábitos", "Saúde"
  badgeIcon?: any;                             // ícone do badge (default Sparkles)
  badgeColor?: string;                         // cor do texto/ícone do badge
  badgeBgClass?: string;                       // tailwind bg do chip (light + dark)
  haloRgba?:  string;                          // cor RGBA do halo no canto superior direito
  titulo:     string;                          // título grande (h1)
  subtitulo?: ReactNode;                       // linha de apoio
  children?:  ReactNode;                       // ações (botões) à direita
}

const VIOLET   = '#7c3aed';

export default function GrowHero({
  badge,
  badgeIcon: Icon = Sparkles,
  badgeColor = VIOLET,
  badgeBgClass = 'bg-violet-100 dark:bg-violet-950/40',
  haloRgba = 'rgba(124,58,237,0.12)',
  titulo,
  subtitulo,
  children,
}: Props) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-border/60 animate-fade-in"
      style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{ background: `radial-gradient(ellipse at top right, ${haloRgba} 0%, transparent 60%)` }}
      />
      <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div className="min-w-0">
          <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3 ${badgeBgClass}`}>
            <Icon size={12} style={{ color: badgeColor }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: badgeColor }}>
              {badge}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
            {titulo}
          </h1>
          {subtitulo && (
            <p className="text-muted-foreground text-sm mt-2 max-w-md">
              {subtitulo}
            </p>
          )}
        </div>
        {children && (
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        )}
      </div>
    </div>
  );
}

'use client';

import { LucideIcon, Sparkles, Check } from 'lucide-react';

interface Props {
  icon:        LucideIcon;
  badge:       string;
  titulo:      string;
  subtitulo:   string;
  features:    string[];
  accentColor?: string;
}

export default function ComingSoon({ icon: Icon, badge, titulo, subtitulo, features, accentColor = '#7c3aed' }: Props) {
  return (
    <div className="max-w-4xl mx-auto pb-20 animate-fade-in">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-3xl border border-border/40 backdrop-blur-xl p-8 sm:p-10 mb-5"
        style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card) / 0.7) 0%, hsl(var(--bg-subtle) / 0.5) 100%)' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at top right, ${accentColor}1F 0%, transparent 55%)` }}
        />
        <div className="relative">
          <div
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-4"
            style={{ background: `${accentColor}1A` }}
          >
            <Sparkles size={11} style={{ color: accentColor }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accentColor }}>{badge}</span>
          </div>

          <div className="flex items-center gap-4 mb-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${accentColor}1F` }}
            >
              <Icon size={26} style={{ color: accentColor }} />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">{titulo}</h1>
              <p className="text-muted-foreground text-sm mt-2">{subtitulo}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Card "Em breve" com features */}
      <div
        className="rounded-3xl border border-border/40 backdrop-blur-xl p-6 sm:p-8"
        style={{ background: 'hsl(var(--bg-card) / 0.5)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Em construção</p>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-1">O que vem por aqui</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Esta seção é parte da próxima fase do <strong className="text-foreground">Sora Grow · Saúde</strong>. Veja o que está sendo construído:
        </p>

        <ul className="space-y-2.5">
          {features.map((f, i) => (
            <li
              key={i}
              className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/40"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `${accentColor}22` }}
              >
                <Check size={11} style={{ color: accentColor }} strokeWidth={3} />
              </div>
              <p className="text-sm text-foreground leading-snug">{f}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

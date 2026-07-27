'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const APP_STYLE = [
  { emoji: '📊', cor: 'bg-emerald-500/10' },
  { emoji: '🎯', cor: 'bg-blue-500/10' },
  { emoji: '📅', cor: 'bg-red-500/10' },
  { emoji: '📝', cor: 'bg-amber-500/10' },
  { emoji: '💊', cor: 'bg-pink-500/10' },
  { emoji: '💳', cor: 'bg-purple-500/10' },
  { emoji: '📚', cor: 'bg-indigo-500/10' },
  { emoji: '🏋️', cor: 'bg-orange-500/10' },
  { emoji: '🗒️', cor: 'bg-zinc-500/10' },
  { emoji: '✅', cor: 'bg-green-500/10' },
  { emoji: '📈', cor: 'bg-cyan-500/10' },
  { emoji: '🥗', cor: 'bg-lime-500/10' },
];

export default function Problema() {
  const t = useTranslations('problema');
  const nomes = t.raw('apps') as string[];
  const APPS = APP_STYLE.map((s, i) => ({ ...s, nome: nomes[i] }));
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    // Dispara quando o usuário CHEGA na seção. threshold:0 + rootMargin negativo
    // no rodapé faz o gatilho depender da POSIÇÃO da seção na tela (não de quantos
    // % dela cabem na viewport) — funciona mesmo quando a seção é mais alta que a
    // tela (tablet retrato), que antes prendia o grid de apps em opacity-0.
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0, rootMargin: '0px 0px -20% 0px' },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">

        {/* Section label */}
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4 text-center">
          {t('label')}
        </p>

        {/* Headline */}
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em] mb-6 max-w-3xl mx-auto text-center">
          {t('tituloL1')}<br />
          <span className="text-zinc-400 dark:text-white/30">{t('tituloL2')}</span>
        </h2>

        <p className="text-lg lg:text-xl text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto text-center mb-16">
          {t('subtitulo')}
        </p>

        {/* Grid de apps */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {APPS.map((app, i) => (
            <div
              key={app.nome}
              className={`flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.02] backdrop-blur-sm transition-all duration-700 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: `${i * 40}ms` }}
            >
              <div className={`w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center text-lg ${app.cor}`}>
                {app.emoji}
              </div>
              <span className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-white/70 leading-tight">{app.nome}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

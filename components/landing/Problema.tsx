'use client';

import { useEffect, useRef, useState } from 'react';

const APPS = [
  { nome: 'Planilha de gastos',  emoji: '📊', cor: 'bg-emerald-500/10' },
  { nome: 'App de hábitos',       emoji: '🎯', cor: 'bg-blue-500/10' },
  { nome: 'Calendário',           emoji: '📅', cor: 'bg-red-500/10' },
  { nome: 'Notepad de metas',     emoji: '📝', cor: 'bg-amber-500/10' },
  { nome: 'Lembrete de remédios', emoji: '💊', cor: 'bg-pink-500/10' },
  { nome: 'Controle de dívidas',  emoji: '💳', cor: 'bg-purple-500/10' },
  { nome: 'Cronograma estudos',   emoji: '📚', cor: 'bg-indigo-500/10' },
  { nome: 'Tracker de treinos',   emoji: '🏋️', cor: 'bg-orange-500/10' },
  { nome: 'Anotações',            emoji: '🗒️', cor: 'bg-zinc-500/10' },
  { nome: 'Lista de tarefas',     emoji: '✅', cor: 'bg-green-500/10' },
  { nome: 'App de investimentos', emoji: '📈', cor: 'bg-cyan-500/10' },
  { nome: 'Controle de dieta',    emoji: '🥗', cor: 'bg-lime-500/10' },
];

export default function Problema() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">

        {/* Section label */}
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4 text-center">
          O problema
        </p>

        {/* Headline */}
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em] mb-6 max-w-3xl mx-auto text-center">
          Sua vida tá espalhada<br />
          <span className="text-zinc-400 dark:text-white/30">em 12 lugares diferentes.</span>
        </h2>

        <p className="text-lg lg:text-xl text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto text-center mb-16">
          Planilhas, apps, post-its, lembretes do celular. É muito pra controlar — e você esquece.
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

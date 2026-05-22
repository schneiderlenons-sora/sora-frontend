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
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
          O problema
        </p>

        {/* Headline */}
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em] mb-6 max-w-3xl">
          Sua vida tá espalhada<br />
          <span className="text-zinc-400 dark:text-white/30">em 12 lugares diferentes.</span>
        </h2>

        <p className="text-lg lg:text-xl text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mb-16">
          Planilhas, apps, post-its, lembretes do celular. É muito pra controlar — e você esquece.
        </p>

        {/* Grid de apps */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-20">
          {APPS.map((app, i) => (
            <div
              key={app.nome}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.02] backdrop-blur-sm transition-all duration-700 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: `${i * 40}ms` }}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${app.cor}`}>
                {app.emoji}
              </div>
              <span className="text-sm font-medium text-zinc-700 dark:text-white/70 truncate">{app.nome}</span>
            </div>
          ))}
        </div>

        {/* Estatística */}
        <div className="relative rounded-3xl overflow-hidden border border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02] p-8 lg:p-14">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 pointer-events-none -translate-y-1/2 translate-x-1/3"
               style={{ background: 'radial-gradient(circle, #61ce70, transparent 70%)' }} />
          <div className="relative grid lg:grid-cols-[auto_1fr] gap-8 items-center">
            <p className="text-7xl sm:text-8xl lg:text-9xl font-bold tabular-nums tracking-tight leading-none">
              78<span className="text-zinc-400 dark:text-white/30">%</span>
            </p>
            <div className="max-w-md">
              <p className="text-xl lg:text-2xl font-semibold leading-snug text-zinc-900 dark:text-white">
                dos brasileiros não sabem exatamente quanto gastaram no último mês.
              </p>
              <p className="text-sm text-zinc-500 dark:text-white/40 mt-3">
                Fonte: SPC Brasil, 2024
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

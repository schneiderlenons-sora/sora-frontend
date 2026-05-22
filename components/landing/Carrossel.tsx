'use client';

import { useState } from 'react';

/**
 * Carrossel mostrando as principais telas dos painéis Finance + Grow.
 * Placeholder com SVG ilustrativo até screenshots reais entrarem em /public/screenshots.
 */
const SHOTS = [
  { id: 'dashboard',     titulo: 'Dashboard Finance',  painel: 'finance', desc: 'Saldo, fluxo e KPIs do mês em uma só tela.' },
  { id: 'transacoes',    titulo: 'Transações',         painel: 'finance', desc: 'Histórico completo, filtros e busca instantânea.' },
  { id: 'investimentos', titulo: 'Investimentos',      painel: 'finance', desc: 'Carteira consolidada com rentabilidade ao vivo.' },
  { id: 'metas',         titulo: 'Metas',              painel: 'finance', desc: 'Cálculo automático de aporte pra bater o objetivo.' },
  { id: 'grow-dash',     titulo: 'Dashboard Grow',     painel: 'grow',    desc: 'Visão diária de hábitos, tarefas, saúde.' },
  { id: 'habitos',       titulo: 'Hábitos',            painel: 'grow',    desc: 'Heatmap GitHub-style + conquistas dinâmicas.' },
  { id: 'saude',         titulo: 'Saúde',              painel: 'grow',    desc: 'Consultas, remédios, treinos, peso, nutrição.' },
  { id: 'estudos',       titulo: 'Estudos',            painel: 'grow',    desc: 'Sessões cronometradas + progresso por curso.' },
];

export default function Carrossel() {
  const [idx, setIdx] = useState(0);
  const ativo = SHOTS[idx];

  return (
    <section className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">

        <div className="text-center mb-12 lg:mb-16">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
            Por dentro
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em] max-w-3xl mx-auto">
            Cada tela,<br />
            <span className="text-zinc-400 dark:text-white/30">pensada nos detalhes.</span>
          </h2>
        </div>

        {/* Display principal */}
        <div className="relative rounded-3xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.02] overflow-hidden mb-6">
          <div className="aspect-[16/9] w-full relative bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 flex items-center justify-center">
            {/* Browser chrome fake */}
            <div className="absolute top-0 left-0 right-0 px-4 py-2.5 flex items-center gap-2 border-b border-zinc-200 dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.03] backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
              </div>
              <div className="ml-3 px-3 py-1 rounded-md bg-zinc-100 dark:bg-white/[0.06] text-[10px] font-mono text-zinc-500 dark:text-white/40">
                forsora.com/{ativo.id}
              </div>
            </div>

            {/* Placeholder shot — placeholder até screenshots reais */}
            <PlaceholderShot id={ativo.id} painel={ativo.painel as 'finance' | 'grow'} />
          </div>
        </div>

        {/* Lista de thumbnails */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SHOTS.map((s, i) => {
            const ativa = idx === i;
            const cor = s.painel === 'finance' ? '#61ce70' : '#7c3aed';
            return (
              <button
                key={s.id}
                onClick={() => setIdx(i)}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  ativa
                    ? 'border-zinc-300 dark:border-white/[0.18] bg-white dark:bg-white/[0.05] shadow-md'
                    : 'border-zinc-200 dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.02] hover:border-zinc-300 dark:hover:border-white/[0.12]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cor }}>
                    {s.painel === 'finance' ? 'Finance' : 'Grow'}
                  </p>
                </div>
                <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{s.titulo}</p>
                <p className="text-[11px] text-zinc-500 dark:text-white/50 mt-1 line-clamp-2">{s.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Aviso pra screenshots reais */}
        <p className="text-center mt-6 text-xs text-zinc-400 dark:text-white/30">
          Imagens ilustrativas — as telas reais do produto serão exibidas em breve.
        </p>
      </div>
    </section>
  );
}

function PlaceholderShot({ id, painel }: { id: string; painel: 'finance' | 'grow' }) {
  const cor = painel === 'finance' ? '#61ce70' : '#7c3aed';
  return (
    <div className="absolute inset-0 mt-10 p-8 flex items-center justify-center">
      <div className="w-full max-w-3xl">
        {/* Mock dashboard */}
        <div className="rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/[0.06] p-6 shadow-2xl">
          {/* Top metrics */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[1, 2, 3].map(n => (
              <div key={n} className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03]">
                <div className="w-12 h-2.5 rounded-full bg-zinc-200 dark:bg-white/10 mb-2" />
                <div className="w-20 h-5 rounded-full" style={{ background: `${cor}33` }} />
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div className="h-40 rounded-xl bg-zinc-50 dark:bg-white/[0.02] p-4 flex items-end gap-1.5">
            {[40, 65, 50, 80, 70, 95, 60, 75, 85, 70, 90, 100].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-md"
                   style={{ height: `${h}%`, background: `linear-gradient(to top, ${cor}, ${cor}66)` }} />
            ))}
          </div>

          {/* List */}
          <div className="mt-5 space-y-2">
            {[1, 2, 3].map(n => (
              <div key={n} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-white/[0.02]">
                <div className="w-7 h-7 rounded-lg" style={{ background: `${cor}33` }} />
                <div className="flex-1">
                  <div className="w-32 h-2.5 rounded-full bg-zinc-200 dark:bg-white/10 mb-1" />
                  <div className="w-20 h-2 rounded-full bg-zinc-100 dark:bg-white/[0.06]" />
                </div>
                <div className="w-16 h-3 rounded-full" style={{ background: `${cor}55` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

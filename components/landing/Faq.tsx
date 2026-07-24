'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function Faq() {
  const t = useTranslations('faq');
  const PERGUNTAS = t.raw('perguntas') as { q: string; a: string }[];
  const [aberto, setAberto] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04]">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">

        <div className="text-center mb-14">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
            {t('label')}
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em]">
            {t('tituloL1')}<br />
            <span className="text-zinc-400 dark:text-white/30">{t('tituloL2')}</span>
          </h2>
        </div>

        <div className="space-y-2">
          {PERGUNTAS.map((p, i) => {
            const open_ = aberto === i;
            return (
              <div key={p.q}
                   className="rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.02] backdrop-blur-sm overflow-hidden">
                <button
                  onClick={() => setAberto(open_ ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.02]"
                >
                  <span className="text-base font-bold text-zinc-900 dark:text-white">{p.q}</span>
                  <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
                        style={{ background: open_ ? '#61ce70' : 'rgba(0,0,0,0.05)' }}>
                    {open_
                      ? <Minus size={13} className="text-white" />
                      : <Plus size={13} className="text-zinc-700 dark:text-white/70" />}
                  </span>
                </button>
                {open_ && (
                  <div className="px-5 pb-5 animate-[fade-in_250ms_ease-out_both]">
                    <p className="text-sm text-zinc-600 dark:text-white/65 leading-relaxed">{p.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

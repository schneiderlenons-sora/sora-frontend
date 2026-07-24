'use client';

import { UserPlus, MessageCircle, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

const PASSO_STYLE = [
  { n: '01', icon: UserPlus },
  { n: '02', icon: MessageCircle },
  { n: '03', icon: Wand2 },
];

export default function ComoFunciona() {
  const t = useTranslations('comoFunciona');
  const passos = t.raw('passos') as { titulo: string; desc: string }[];
  const PASSOS = PASSO_STYLE.map((s, i) => ({ ...s, ...passos[i] }));
  return (
    <section className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">

        <div className="text-center mb-16 lg:mb-20">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
            {t('label')}
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em] max-w-3xl mx-auto">
            {t('tituloL1')}<br />
            <span className="text-zinc-400 dark:text-white/30">{t('tituloL2')}</span>
          </h2>
        </div>

        {/* Linha conectando os passos */}
        <div className="relative">
          <div aria-hidden className="hidden lg:block absolute top-12 left-[15%] right-[15%] h-px"
               style={{
                 background: 'linear-gradient(to right, transparent, rgba(97,206,112,0.4), rgba(97,206,112,0.4), transparent)',
               }} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            {PASSOS.map((passo, i) => {
              const Icon = passo.icon;
              return (
                <div key={passo.n} className="relative text-center">
                  {/* Número grande */}
                  <div className="relative inline-flex items-center justify-center mb-6">
                    {/* Círculo verde de fundo (glow) */}
                    <div className="absolute inset-0 rounded-full opacity-20 blur-2xl scale-110"
                         style={{ background: '#61ce70' }} />
                    <div className="relative w-24 h-24 rounded-full border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950 flex items-center justify-center shadow-sm">
                      <Icon size={28} style={{ color: '#61ce70' }} strokeWidth={1.5} />
                    </div>
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold text-white shadow-md"
                          style={{ background: 'linear-gradient(135deg, #61ce70 0%, #4DAE61 100%)' }}>
                      {passo.n}
                    </span>
                  </div>

                  <h3 className="text-2xl font-bold tracking-tight mb-3">
                    {passo.titulo}
                  </h3>
                  <p className="text-zinc-600 dark:text-white/60 leading-relaxed max-w-xs mx-auto">
                    {passo.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

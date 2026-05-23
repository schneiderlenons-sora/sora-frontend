'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Crown, Sparkles } from 'lucide-react';
import { PLANOS_DISPLAY } from '@/lib/planos-display';
import { PLANOS_INFO } from '@/lib/stripe';

// Ícone exibido junto ao nome do plano destacado. Mantido aqui pra não
// vazar dependência de lucide-react no lib/planos-display.
const ICONES = { premium: Sparkles, black: Crown } as const;

export default function Pricing() {
  const [anual, setAnual] = useState(false);

  return (
    <section id="pricing" className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04]">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-30 dark:opacity-15"
             style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.18) 0%, transparent 60%)' }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8">

        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
            Planos
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em] max-w-3xl mx-auto">
            Escolha o seu.<br />
            <span className="text-zinc-400 dark:text-white/30">Cancele quando quiser.</span>
          </h2>
        </div>

        {/* Toggle mensal/anual */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-zinc-100/80 dark:bg-white/[0.04] border border-zinc-200/60 dark:border-white/[0.06]">
            <button
              onClick={() => setAnual(false)}
              className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${
                !anual ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-white/60'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setAnual(true)}
              className={`relative px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${
                anual ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-white/60'
              }`}
            >
              Anual
              {!anual && (
                <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white"
                      style={{ background: '#61ce70' }}>
                  -40%
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Cards de planos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {PLANOS_DISPLAY.map((p) => {
            const info = PLANOS_INFO[p.id];
            const precoExibido = anual ? info.anual : info.mensal;
            const Icon = ICONES[p.id as keyof typeof ICONES];

            return (
              <div
                key={p.id}
                className={`relative rounded-3xl p-7 transition-all hover:-translate-y-1 duration-300 ${
                  p.destaque
                    ? 'border-2 shadow-[0_20px_60px_-20px_rgba(97,206,112,0.4)] bg-white dark:bg-zinc-950'
                    : 'border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.14] shadow-sm bg-white/40 dark:bg-white/[0.02]'
                }`}
                style={p.destaque ? { borderColor: p.cor } : {}}
              >
                {/* Tinted overlay no destaque, em ambos os temas */}
                {p.destaque && (
                  <div aria-hidden className="absolute inset-0 rounded-3xl pointer-events-none"
                       style={{ background: 'linear-gradient(180deg, rgba(97,206,112,0.06), transparent 60%)' }} />
                )}

                <div className="relative">
                  {/* Badge no topo */}
                  {p.badge && (
                    <div className="absolute -top-9 -right-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white shadow-md whitespace-nowrap"
                         style={{ background: `linear-gradient(135deg, ${p.cor} 0%, ${escurecer(p.cor)} 100%)` }}>
                      {p.destaque && <Sparkles size={9} />}
                      {p.badge}
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    {Icon && (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                           style={{ background: `${p.cor}18` }}>
                        <Icon size={13} style={{ color: p.cor }} />
                      </div>
                    )}
                    <h3 className="text-xl font-bold tracking-tight">{p.nome}</h3>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-white/50 mb-6">{p.subtitulo}</p>

                  {/* Preço */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold">R$</span>
                      <span className="text-5xl font-bold tabular-nums tracking-tight">
                        {Math.floor(precoExibido)}
                        <span className="text-2xl">,{(precoExibido % 1).toFixed(2).slice(2)}</span>
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-white/50 mt-1">
                      por mês{anual && <> · pago anualmente · <span style={{ color: p.cor }} className="font-bold">{info.descAnual}% off</span></>}
                    </p>
                  </div>

                  {/* CTA */}
                  <Link
                    href={`/signup?plano=${p.id}`}
                    className={`block w-full text-center px-4 py-3 text-sm font-bold rounded-xl mb-7 transition-all hover:-translate-y-0.5 ${
                      p.destaque
                        ? 'text-white shadow-md hover:shadow-lg'
                        : 'text-zinc-950 dark:text-white border border-zinc-300 dark:border-white/[0.14] hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                    }`}
                    style={p.destaque ? { background: `linear-gradient(135deg, ${p.cor} 0%, ${escurecer(p.cor)} 100%)` } : {}}
                  >
                    Começar agora →
                  </Link>

                  {/* Features list */}
                  <ul className="space-y-2.5">
                    {p.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-[13px] text-zinc-700 dark:text-white/75 leading-snug">
                        <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ background: `${p.cor}22` }}>
                          <Check size={9} style={{ color: p.cor }} strokeWidth={3} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center mt-10 text-sm text-zinc-500 dark:text-white/50">
          Cancele a qualquer momento.{' '}
          <span className="text-zinc-900 dark:text-white font-semibold">Sem letras miúdas.</span>
        </p>
      </div>
    </section>
  );
}

function escurecer(hex: string, amt = 0.18): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - Math.round(255 * amt));
  const g = Math.max(0, ((n >> 8)  & 0xff) - Math.round(255 * amt));
  const b = Math.max(0,  (n        & 0xff) - Math.round(255 * amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

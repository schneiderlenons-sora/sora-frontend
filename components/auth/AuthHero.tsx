'use client';

import { useEffect, useState } from 'react';
import { Check, Sparkles, Star } from 'lucide-react';

const BRAND = '#61ce70';

const TESTIMONIALS = [
  {
    stars: 5,
    quote: 'Finalmente consigo organizar minha vida financeira em um lugar só. A IA da Sora é insana.',
    author: 'Lenon S.',
    role: 'Designer',
  },
  {
    stars: 5,
    quote: 'Em 2 semanas economizei R$ 800 só de notar onde tava perdendo. Mudou minha relação com dinheiro.',
    author: 'Marina R.',
    role: 'Empreendedora',
  },
  {
    stars: 4.5,
    quote: 'Uso pelo WhatsApp todo dia. Não preciso abrir mais nenhum app de planilha. Salvou minha rotina.',
    author: 'Carlos M.',
    role: 'Estudante de medicina',
  },
];

export default function AuthHero() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % TESTIMONIALS.length), 5500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative overflow-hidden bg-black text-white
                    px-6 sm:px-10 lg:px-12 pt-10 lg:pt-12 pb-16 lg:pb-12
                    lg:w-1/2 lg:min-h-dvh
                    flex flex-col justify-between
                    rounded-b-[2rem] lg:rounded-none">

      {/* Pontilhado de fundo */}
      <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
           style={{
             backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
             backgroundSize: '24px 24px',
           }} />

      {/* Glow verde sutil */}
      <div className="absolute inset-0 pointer-events-none opacity-50"
           style={{
             background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${BRAND}25 0%, transparent 60%),
                          radial-gradient(circle at 90% 90%, ${BRAND}15 0%, transparent 50%)`,
           }} />

      {/* Ruído sutil (textura premium) */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
           style={{
             backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
           }} />

      {/* ── Marca no topo ── */}
      <div className="relative flex items-center gap-3 animate-fade-in">
        <img src="/sora-icon.png" alt="Sora"
             width={44} height={44}
             className="w-11 h-11 rounded-xl object-cover shadow-lg"
             draggable={false} />
        <span className="font-bold text-xl tracking-tight">Sora</span>
      </div>

      {/* ── Headline + showcase ── */}
      <div className="relative mt-8 lg:mt-0 space-y-7 animate-fade-in" style={{ animationDelay: '80ms' }}>

        <h1 className="text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight">
          Sua vida<br />sob controle.{' '}
          <span style={{ color: BRAND }}>Definitivamente!</span>
        </h1>

        <p className="text-white/60 text-sm sm:text-base leading-relaxed max-w-md">
          Gastos, hábitos, dívidas, estudos, saúde — tudo num só lugar e conversando direto no seu WhatsApp.
        </p>

        {/* Badges mobile */}
        <div className="flex flex-wrap gap-2 lg:hidden">
          <PillBadge label="Setup em 30s" />
          <PillBadge label="Grátis pra começar" />
        </div>

        {/* Card mockup desktop */}
        <div className="hidden lg:block relative rounded-2xl p-5 border border-white/10 backdrop-blur-sm overflow-hidden"
             style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)' }}>
          <div className="absolute inset-0 pointer-events-none opacity-50"
               style={{ background: `radial-gradient(circle at top right, ${BRAND}1A 0%, transparent 60%)` }} />

          <div className="relative space-y-3">
            <DataRow icon="💰" label="Saldo este mês"    value="R$ 3.450"   cor="#fff" />
            <DataRow icon="🎯" label="Score financeiro"  value="847 / 1000" cor="#fff" />
            <DataRow icon="🔥" label="Streak de hábitos" value="12 dias"    cor={BRAND} />
            <DataRow icon="✈️" label="Meta de viagem"    value="67% ✓"      cor={BRAND} />
          </div>

          <div className="relative inline-flex items-center gap-1.5 mt-4 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-white/10 bg-white/5"
               style={{ color: BRAND }}>
            <Sparkles size={10} className="animate-pulse" />
            IA analisando seus dados…
          </div>
        </div>
      </div>

      {/* ── Carrossel de testemunhos (desktop only) ── */}
      <div className="hidden lg:block relative mt-8 animate-fade-in" style={{ animationDelay: '200ms' }}>
        <div className="relative" style={{ minHeight: 110 }}>
          {TESTIMONIALS.map((t, i) => (
            <div key={i}
                 className="absolute inset-0 transition-all duration-500 ease-out"
                 style={{
                   opacity: i === idx ? 1 : 0,
                   transform: i === idx ? 'translateY(0)' : 'translateY(8px)',
                   pointerEvents: i === idx ? 'auto' : 'none',
                 }}>
              <RatingStars stars={t.stars} />
              <p className="text-white/85 text-sm italic leading-relaxed mt-2">
                "{t.quote}"
              </p>
              <p className="text-white/40 text-xs mt-1.5">
                {t.author}, {t.role}
              </p>
            </div>
          ))}
        </div>

        {/* Dots indicator */}
        <div className="flex items-center gap-1.5 mt-3">
          {TESTIMONIALS.map((_, i) => (
            <button key={i}
                    onClick={() => setIdx(i)}
                    aria-label={`Depoimento ${i + 1}`}
                    className="transition-all duration-300"
                    style={{
                      width: i === idx ? 18 : 5,
                      height: 5,
                      borderRadius: 9999,
                      background: i === idx ? BRAND : 'rgba(255,255,255,0.25)',
                    }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function PillBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-white/90 border border-white/15 bg-white/[0.04] backdrop-blur-sm">
      <Check size={12} style={{ color: BRAND }} strokeWidth={3} />
      {label}
    </span>
  );
}

function DataRow({ icon, label, value, cor }: { icon: string; label: string; value: string; cor: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-base flex-shrink-0">{icon}</span>
      <span className="text-xs text-white/60 flex-1">{label}</span>
      <span className="text-sm font-bold tabular tracking-tight" style={{ color: cor }}>{value}</span>
    </div>
  );
}

function RatingStars({ stars }: { stars: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => {
        const full = stars >= n;
        const half = !full && stars >= n - 0.5;
        return (
          <span key={n} className="relative inline-block" style={{ width: 13, height: 13 }}>
            {/* Estrela base (fundo apagado) */}
            <Star
              size={13}
              fill="currentColor"
              className="absolute inset-0"
              style={{ color: 'rgba(97, 206, 112, 0.22)' }}
            />
            {/* Estrela colorida (cheia ou metade) */}
            {(full || half) && (
              <Star
                size={13}
                fill="currentColor"
                className="absolute inset-0"
                style={{
                  color: BRAND,
                  clipPath: half ? 'inset(0 50% 0 0)' : 'none',
                }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

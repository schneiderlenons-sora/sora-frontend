'use client';

import Link from 'next/link';
import { ArrowRight, Check, ShieldCheck, Sparkles, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import IPhoneFrame from './IPhoneFrame';
import HeroPhoneWhatsApp from './HeroPhoneWhatsApp';
import HeroPhoneSora from './HeroPhoneSora';

const BRAND = '#61ce70';

export default function Hero() {
  const { user } = useAuth();

  return (
    <section className="relative overflow-hidden pt-10 lg:pt-20 pb-20 lg:pb-32">

      {/* ── Background: grid + radial green glow + light beam + grain ── */}
      <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
        {/* Grid pattern — visível mas elegante, com fade suave nas bordas.
            Mesmo design do CTA final, agora se aplicando ao hero inteiro. */}
        <div className="absolute inset-0 opacity-[0.07] dark:opacity-[0.08]"
             style={{
               backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
               backgroundSize: '56px 56px',
               maskImage: 'radial-gradient(ellipse 100% 80% at 50% 35%, black 30%, transparent 85%)',
               WebkitMaskImage: 'radial-gradient(ellipse 100% 80% at 50% 35%, black 30%, transparent 85%)',
             }} />

        {/* Radial green glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full opacity-30 dark:opacity-40"
             style={{ background: `radial-gradient(ellipse, ${BRAND}22 0%, transparent 60%)` }} />

        {/* Vertical light beam */}
        <div className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-px h-[40vh] opacity-60 dark:opacity-40"
             style={{ background: `linear-gradient(to bottom, ${BRAND}80, transparent)` }} />

        {/* Noise grain — quebra o gradiente puro, dá textura */}
        <div className="absolute inset-0 opacity-[0.018] dark:opacity-[0.03] mix-blend-overlay pointer-events-none"
             style={{
               backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
             }} />
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-10 lg:gap-8 items-center">

        {/* ── COLUNA TEXTO + (no mobile) MOCKUPS NO MEIO ─────── */}
        <div className="relative text-center lg:text-left">

          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/60 dark:bg-white/[0.03] backdrop-blur-sm animate-[slide-up_600ms_ease-out_both]">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full animate-ping" style={{ background: BRAND, opacity: 0.6 }} />
              <span className="relative rounded-full w-1.5 h-1.5" style={{ background: BRAND }} />
            </span>
            <span className="text-[11px] font-bold tracking-wide uppercase text-zinc-700 dark:text-white/80">
              Disponível agora
            </span>
          </div>

          {/* Headline */}
          <h1 className="mt-6 text-[40px] sm:text-[54px] lg:text-[64px] font-bold leading-[0.98] tracking-[-0.03em] animate-[slide-up_700ms_ease-out_both]" style={{ animationDelay: '80ms' }}>
            Sua vida inteira{' '}
            <span className="relative inline-block">
              sob controle.
              <svg className="absolute -bottom-1 left-0 w-full" height="8" viewBox="0 0 200 8" preserveAspectRatio="none">
                <path d="M2,5 Q50,2 100,4 T198,5" stroke={BRAND} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
              </svg>
            </span>
            <br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
              Em um único sistema.
            </span>
          </h1>

          {/* Subhead */}
          <p className="mt-6 text-base sm:text-lg lg:text-xl text-zinc-600 dark:text-white/70 leading-relaxed max-w-xl mx-auto lg:mx-0 animate-[slide-up_800ms_ease-out_both]" style={{ animationDelay: '160ms' }}>
            Finanças, hábitos, saúde, dietas, estudos, trabalhos, investimentos.{' '}
            <span className="text-zinc-900 dark:text-white font-medium">Tudo num lugar só</span>, organizados e controlados direto pelo seu WhatsApp.
          </p>

          {/* MOBILE ONLY — Mockups aqui (logo após subheadline) */}
          <div className="lg:hidden mt-10 mb-2">
            <HeroPhones />
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3 animate-[slide-up_900ms_ease-out_both]" style={{ animationDelay: '240ms' }}>
            <Link href={user ? '/dashboard' : '/signup'}
                  className="group inline-flex items-center gap-2 px-5 py-3.5 text-sm font-bold text-white rounded-xl shadow-[0_8px_30px_-8px_rgba(97,206,112,0.6)] hover:shadow-[0_12px_40px_-8px_rgba(97,206,112,0.7)] hover:-translate-y-0.5 transition-all"
                  style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
              {user ? 'Abrir meu painel' : 'Criar conta'}
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <a href="#demo"
               className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-bold rounded-xl border border-zinc-300 dark:border-white/[0.12] bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm hover:bg-white dark:hover:bg-white/[0.08] hover:-translate-y-0.5 transition-all">
              <Sparkles size={14} style={{ color: BRAND }} />
              Testar Sora no zap
            </a>
          </div>

          {/* Trust bar */}
          <div className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-[12px] text-zinc-500 dark:text-white/50 animate-[slide-up_1000ms_ease-out_both]" style={{ animationDelay: '320ms' }}>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={12} /> Open Finance · BACEN</span>
            <span className="inline-flex items-center gap-1.5"><Lock size={12} /> Criptografia de ponta</span>
            <span className="inline-flex items-center gap-1.5"><Check size={12} /> 100% LGPD</span>
          </div>
        </div>

        {/* ── DESKTOP ONLY: Mockups na coluna direita ─────── */}
        <div className="hidden lg:block">
          <HeroPhones />
        </div>
      </div>
    </section>
  );
}

/**
 * Bloco dos 2 iPhones + floating chips.
 * Usado tanto no mobile (entre subheadline e CTAs) quanto no desktop (coluna direita).
 */
function HeroPhones() {
  return (
    <div className="relative h-[440px] sm:h-[540px] lg:h-[680px] flex items-center justify-center mx-auto max-w-md lg:max-w-none">

      {/* Phone 1 — WhatsApp (back, rotated) */}
      <div className="absolute left-[4%] sm:left-[8%] top-[6%] w-[58%] max-w-[260px] sm:max-w-[280px] animate-[slide-up_900ms_ease-out_both] z-10"
           style={{ animationDelay: '300ms', transform: 'rotate(-6deg)' }}>
        <div className="animate-[float-slow_7s_ease-in-out_infinite]">
          <IPhoneFrame>
            <HeroPhoneWhatsApp />
          </IPhoneFrame>
        </div>
      </div>

      {/* Phone 2 — Sora app (front, taller) */}
      <div className="absolute right-[2%] sm:right-[4%] bottom-[2%] w-[62%] max-w-[290px] sm:max-w-[310px] animate-[slide-up_1100ms_ease-out_both] z-20"
           style={{ animationDelay: '500ms', transform: 'rotate(5deg)' }}>
        <div className="animate-[float-slow_8s_ease-in-out_infinite]" style={{ animationDelay: '1s' }}>
          <IPhoneFrame>
            <HeroPhoneSora />
          </IPhoneFrame>
        </div>
      </div>

      {/* Floating chips — z-40 fica acima dos phones */}
      <FloatingChip className="top-[8%] right-[0%] sm:right-[2%]" delay="600ms">
        <span style={{ color: BRAND }}>↑</span> R$ 3.450 saldo
      </FloatingChip>
      <FloatingChip className="bottom-[10%] left-[-2%] sm:left-[0%]" delay="900ms">
        🔥 12 dias de hábito
      </FloatingChip>
      <FloatingChip className="top-[42%] left-[-6%] sm:left-[-4%] hidden sm:flex" delay="1100ms" variant="accent">
        <Sparkles size={11} /> Lançado
      </FloatingChip>
    </div>
  );
}

function FloatingChip({
  children, className = '', delay = '0ms', variant = 'default',
}: {
  children: React.ReactNode; className?: string; delay?: string;
  variant?: 'default' | 'accent';
}) {
  return (
    <div
      className={`absolute z-40 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-full shadow-lg backdrop-blur-md whitespace-nowrap animate-[slide-up_1000ms_ease-out_both,float-slow_5s_ease-in-out_infinite] ${
        variant === 'accent'
          ? 'text-white shadow-[0_8px_25px_-5px_rgba(97,206,112,0.5)]'
          : 'bg-white/90 dark:bg-zinc-900/80 text-zinc-950 dark:text-white border border-zinc-200 dark:border-white/[0.08]'
      } ${className}`}
      style={{
        animationDelay: delay,
        ...(variant === 'accent' ? { background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` } : {}),
      }}
    >
      {children}
    </div>
  );
}

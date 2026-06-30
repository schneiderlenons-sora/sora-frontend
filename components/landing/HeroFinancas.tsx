'use client';

import Link from 'next/link';
import { ArrowRight, ShieldCheck, Sparkles, Lock, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import HeroBackground from './HeroBackground';
import { HeroPhones } from './Hero';

const BRAND = '#61ce70';

// Hero FOCADO (landing de teste /financas): uma promessa só — finanças no
// WhatsApp — pra autônomo desorganizado e casal. CTA principal = testar grátis.
export default function HeroFinancas() {
  const { user } = useAuth();

  return (
    <section className="relative isolate overflow-hidden pt-10 lg:pt-20 pb-20 lg:pb-32">
      <HeroBackground />

      <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-10 lg:gap-8 items-center">
        <div className="relative text-center lg:text-left">

          {/* Eyebrow — qualifica o público */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/60 dark:bg-white/[0.03] backdrop-blur-sm animate-[slide-up_600ms_ease-out_both]">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full animate-ping" style={{ background: BRAND, opacity: 0.6 }} />
              <span className="relative rounded-full w-1.5 h-1.5" style={{ background: BRAND }} />
            </span>
            <span className="text-[11px] font-bold tracking-wide uppercase text-zinc-700 dark:text-white/80">
              Sua assistente financeira no WhatsApp
            </span>
          </div>

          {/* Headline — o QUE + o COMO + a FACILIDADE */}
          <h1 className="mt-6 text-[38px] sm:text-[52px] lg:text-[60px] font-bold leading-[1.0] tracking-[-0.03em] animate-[slide-up_700ms_ease-out_both]" style={{ animationDelay: '80ms' }}>
            Saiba pra onde vai seu dinheiro{' '}
            <span className="relative inline-block">
              sem planilha
              <svg className="absolute -bottom-1 left-0 w-full" height="8" viewBox="0 0 200 8" preserveAspectRatio="none">
                <path d="M2,5 Q50,2 100,4 T198,5" stroke={BRAND} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
              </svg>
            </span>
            ,<br className="hidden sm:block" />{' '}
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
              só mandando no WhatsApp.
            </span>
          </h1>

          {/* Subhead — a mágica + o público (autônomo + casal) */}
          <p className="mt-6 text-base sm:text-lg lg:text-xl text-zinc-600 dark:text-white/70 leading-relaxed max-w-xl mx-auto lg:mx-0 animate-[slide-up_800ms_ease-out_both]" style={{ animationDelay: '160ms' }}>
            Manda <span className="text-zinc-900 dark:text-white font-medium">&ldquo;gastei 50 no mercado&rdquo;</span> e a Sora lança, categoriza e organiza tudo — gastos, contas, cartões e metas.
            Pra <span className="text-zinc-900 dark:text-white font-medium">autônomo</span> que mistura tudo e pra <span className="text-zinc-900 dark:text-white font-medium">casal</span> que quer as contas num lugar só.
          </p>

          {/* MOBILE — mockups */}
          <div className="lg:hidden mt-10 mb-2"><HeroPhones /></div>

          {/* CTAs — TESTAR primeiro (deixa sentir o valor), preço é secundário */}
          <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3 animate-[slide-up_900ms_ease-out_both]" style={{ animationDelay: '240ms' }}>
            <a href="#demo"
               className="group inline-flex items-center gap-2 px-5 py-3.5 text-sm font-bold text-white rounded-xl shadow-[0_8px_30px_-8px_rgba(97,206,112,0.6)] hover:shadow-[0_12px_40px_-8px_rgba(97,206,112,0.7)] hover:-translate-y-0.5 transition-all"
               style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
              <Sparkles size={15} /> Testar grátis agora
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </a>

            <Link href={user ? '/dashboard' : '#pricing'}
               className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-bold rounded-xl border border-zinc-300 dark:border-white/[0.12] bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm hover:bg-white dark:hover:bg-white/[0.08] hover:-translate-y-0.5 transition-all">
              {user ? 'Abrir meu painel' : 'Ver planos'}
            </Link>
          </div>

          {/* Micro-prova de facilidade */}
          <p className="mt-4 text-[12px] text-zinc-500 dark:text-white/50 animate-[slide-up_950ms_ease-out_both]" style={{ animationDelay: '300ms' }}>
            Sem planilha · sem app pra aprender · funciona no WhatsApp que você já usa
          </p>

          {/* Trust bar */}
          <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-[12px] text-zinc-500 dark:text-white/50 animate-[slide-up_1000ms_ease-out_both]" style={{ animationDelay: '360ms' }}>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={12} /> Open Finance · BACEN</span>
            <span className="inline-flex items-center gap-1.5"><Lock size={12} /> Criptografia de ponta</span>
            <span className="inline-flex items-center gap-1.5"><Check size={12} /> 100% LGPD</span>
          </div>
        </div>

        {/* DESKTOP — mockups */}
        <div className="hidden lg:block"><HeroPhones /></div>
      </div>
    </section>
  );
}

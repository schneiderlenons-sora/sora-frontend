'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const BRAND = '#61ce70';

export default function CtaFinal() {
  const { user } = useAuth();

  return (
    <section className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04]">
      <div className="max-w-5xl mx-auto px-5 sm:px-8">

        <div className="relative rounded-[2.5rem] overflow-hidden border border-zinc-200 dark:border-white/[0.08] p-12 sm:p-16 lg:p-24 text-center"
             style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1e 100%)' }}>

          {/* Decorative bg */}
          <div aria-hidden className="absolute inset-0 pointer-events-none">
            {/* Mesh radial gradient */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-50"
                 style={{ background: `radial-gradient(ellipse, ${BRAND}30 0%, transparent 60%)` }} />
            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-[0.04]"
                 style={{
                   backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`,
                   backgroundSize: '60px 60px',
                   maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
                   WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
                 }} />
            {/* Noise */}
            <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
                 style={{
                   backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                 }} />
            {/* Floating dots */}
            <div className="absolute top-12 left-12 w-2 h-2 rounded-full opacity-60" style={{ background: BRAND }} />
            <div className="absolute top-20 right-16 w-1.5 h-1.5 rounded-full opacity-40" style={{ background: BRAND }} />
            <div className="absolute bottom-16 left-20 w-1.5 h-1.5 rounded-full opacity-40" style={{ background: BRAND }} />
            <div className="absolute bottom-24 right-12 w-2 h-2 rounded-full opacity-60" style={{ background: BRAND }} />
          </div>

          <div className="relative text-white">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 border border-white/15 bg-white/5 backdrop-blur-sm">
              <Sparkles size={11} style={{ color: BRAND }} />
              <span className="text-[11px] font-bold tracking-widest uppercase">A vida que você quer</span>
            </div>

            <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.02] tracking-[-0.03em] mb-6">
              Comece hoje.<br />
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
                Sua vida agradece.
              </span>
            </h2>

            <p className="text-lg lg:text-xl text-white/65 max-w-2xl mx-auto leading-relaxed mb-10">
              Cancele em 1 toque. Sem letras miúdas, sem permanência.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href={user ? '/dashboard' : '/signup'}
                    className="group inline-flex items-center gap-2 px-6 py-4 text-base font-bold text-white rounded-2xl shadow-[0_15px_50px_-10px_rgba(97,206,112,0.6)] hover:-translate-y-0.5 transition-all"
                    style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
                {user ? 'Abrir meu painel' : 'Criar conta agora'}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>

              <a href="#pricing"
                 className="inline-flex items-center gap-2 px-6 py-4 text-base font-bold rounded-2xl border border-white/15 bg-white/[0.03] backdrop-blur-sm text-white/90 hover:bg-white/[0.08] transition-all">
                Ver planos
              </a>
            </div>

            <p className="text-xs text-white/40 mt-8">
              Sem cartão pra começar. Cancele em 1 clique.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

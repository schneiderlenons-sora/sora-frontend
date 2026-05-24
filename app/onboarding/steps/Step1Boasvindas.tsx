'use client';

import { Sparkles } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';
import StepNav from '../components/StepNav';

const BRAND = '#61D17B';

export default function Step1Boasvindas() {
  const { state, setNome } = useOnboarding();

  return (
    <>
      <div className="text-center space-y-6 py-4">

        {/* Hero icon */}
        <div
          className="mx-auto w-20 h-20 rounded-3xl flex items-center justify-center shadow-glow animate-fade-in"
          style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}
        >
          <Sparkles size={32} className="text-white" />
        </div>

        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20"
             style={{ animationDelay: '60ms' }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BRAND }} />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND }}>
            Bem-vindo
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-tight max-w-md mx-auto">
          Vamos personalizar a Sora{' '}
          <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
            pra você
          </span>
        </h1>

        <p className="text-base text-muted-foreground leading-relaxed max-w-md mx-auto">
          Em 3 minutinhos a gente configura tudo: categorias, contas, gastos fixos e WhatsApp.
          Já dá pra começar a usar de verdade.
        </p>
      </div>

      <div className="mt-10 max-w-md mx-auto">
        <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Como podemos te chamar?
        </label>
        <input
          type="text"
          value={state.nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu primeiro nome"
          className="w-full px-4 py-4 rounded-2xl bg-card border border-border text-foreground text-lg
                     placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary
                     transition-colors"
          autoFocus
        />
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          A Sora vai te chamar por esse nome no painel e no WhatsApp.
        </p>
      </div>

      <StepNav podeAvancar={state.nome.trim().length >= 2} semPular semVoltar />
    </>
  );
}

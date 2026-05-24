'use client';

import Link from 'next/link';
import { useOnboarding, TOTAL_STEPS } from '../OnboardingContext';

const BRAND = '#61D17B';

interface Props {
  children: React.ReactNode;
  /** Esconde o footer inteiro quando true (para steps customizados de final). */
  semFooter?: boolean;
}

/**
 * Shell do wizard de onboarding — mobile-first, com header (logo + step
 * counter), progress bar verde e footer com nav (voltar/pular/continuar).
 *
 * Os steps individuais renderizam o conteúdo dentro do main.
 */
export default function WizardShell({ children, semFooter }: Props) {
  const { state } = useOnboarding();

  return (
    <div className="min-h-dvh flex flex-col bg-background">

      {/* HEADER fixo com logo + counter */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-glow-sm"
                 style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-bold text-foreground tracking-tight">Sora</span>
          </Link>

          {/* Step counter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground tabular-nums">
              Passo <strong className="text-foreground">{state.step}</strong> de {TOTAL_STEPS}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <ProgressBar value={state.step / TOTAL_STEPS} />
      </header>

      {/* MAIN — conteúdo do step */}
      <main className="flex-1 px-5 sm:px-8 py-8 sm:py-12 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full animate-fade-in">
          {children}
        </div>
      </main>

      {/* FOOTER renderizado dentro de cada step quando precisar (via StepNav) */}
      {!semFooter && null}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-1 bg-muted/40 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 h-full transition-all duration-500 ease-out"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${BRAND}, #3FA85A)`,
          boxShadow: `0 0 12px ${BRAND}80`,
        }}
      />
    </div>
  );
}

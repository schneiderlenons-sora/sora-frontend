'use client';

import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useOnboarding, TOTAL_STEPS } from '../OnboardingContext';

const BRAND = '#61D17B';

interface Props {
  /** Permite avançar (controla disable do botão principal). */
  podeAvancar?:    boolean;
  /** Texto do botão principal. Default 'Continuar'. */
  textoContinuar?: string;
  /** Callback antes de avançar (útil pra salvar dados específicos do step). */
  onAntesAvancar?: () => Promise<void> | void;
  /** Esconde o botão "Pular este passo" (alguns steps são essenciais). */
  semPular?:       boolean;
  /** Esconde o botão "Voltar" (Step 1). */
  semVoltar?:      boolean;
}

/**
 * Footer com navegação do wizard. Inclui voltar, pular (opcional) e
 * botão principal (Continuar/Finalizar dependendo do step).
 */
export default function StepNav({
  podeAvancar = true,
  textoContinuar,
  onAntesAvancar,
  semPular,
  semVoltar,
}: Props) {
  const { state, prev, next, skip, finalizar, salvando } = useOnboarding();
  const ehUltimo = state.step >= TOTAL_STEPS;

  async function handleContinuar() {
    if (onAntesAvancar) await onAntesAvancar();
    if (ehUltimo) {
      await finalizar();
      // O OnboardingRedirect detecta onboarding_completed=true e libera.
      // Redirect explícito pra dashboard como reforço:
      window.location.href = '/dashboard';
    } else {
      await next();
    }
  }

  const label = textoContinuar || (ehUltimo ? 'Finalizar' : 'Continuar');

  return (
    <div className="sticky bottom-0 left-0 right-0 z-20 mt-10 pt-6 pb-[max(env(safe-area-inset-bottom),16px)] bg-gradient-to-t from-background via-background/95 to-transparent">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 flex items-center gap-2.5">
        {/* Voltar */}
        {!semVoltar && state.step > 1 && (
          <button
            type="button"
            onClick={prev}
            disabled={salvando}
            className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <ArrowLeft size={14} />
            Voltar
          </button>
        )}

        {/* Pular */}
        {!semPular && !ehUltimo && (
          <button
            type="button"
            onClick={skip}
            disabled={salvando}
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            Pular este passo
          </button>
        )}

        {/* Continuar / Finalizar */}
        <button
          type="button"
          onClick={handleContinuar}
          disabled={!podeAvancar || salvando}
          className="ml-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white shadow-glow-sm transition-all hover:-translate-y-0.5 hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}
        >
          {salvando ? (
            <Loader2 size={15} className="animate-spin" />
          ) : ehUltimo ? (
            <Sparkles size={15} />
          ) : (
            <ArrowRight size={15} />
          )}
          {label}
        </button>
      </div>
    </div>
  );
}

'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { PerfilUso, ObjetivoPrincipal } from '@/contexts/AuthContext';

export const TOTAL_STEPS = 10;

export type ModoOnboarding = "completo" | "curto";

/**
 * Quais passos cada modo roda, na ordem.
 *
 * ⚠️ É UMA SEQUÊNCIA, NÃO UM CORTE. O modo curto reaproveita os MESMOS
 * componentes de passo, só pulando os que não fazem sentido pra quem entrou
 * pelo modo manual: perfil de uso, objetivo, gastos e receitas fixas, meta e
 * os dois passos de WhatsApp — que ele nem tem. Renumerar os steps quebraria
 * o `onboarding_step` já gravado de quem está no meio do wizard completo.
 *
 * Sobram nome (quem é) e contas (de onde sai o dinheiro). Categoria não entra
 * porque o banco já cria as padrão sozinho (`criar_categorias_padrao`).
 */
export const SEQUENCIAS: Record<ModoOnboarding, number[]> = {
  completo: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  curto:    [1, 5],
};

interface OnboardingState {
  step:            number;
  nome:            string;
  perfilUso:       PerfilUso | null;
  objetivo:        ObjetivoPrincipal | null;
}

interface OnboardingContextType {
  state:           OnboardingState;
  setNome:         (n: string) => void;
  setPerfilUso:    (p: PerfilUso) => void;
  setObjetivo:     (o: ObjetivoPrincipal) => void;
  goTo:            (s: number) => void;
  next:            () => Promise<void>;
  prev:            () => void;
  skip:            () => Promise<void>;
  finalizar:       () => Promise<void>;
  salvando:        boolean;
  /** Posição na sequência do modo (1-based) — o "Passo X". */
  posicao:         number;
  /** Quantos passos este modo tem — o "de Y". */
  total:           number;
  modo:            ModoOnboarding;
}

const Ctx = createContext<OnboardingContextType>({} as OnboardingContextType);

export function OnboardingProvider({
  children,
  modo = "completo",
}: { children: React.ReactNode; modo?: ModoOnboarding }) {
  const sequencia = SEQUENCIAS[modo];
  const { user, perfil, recarregar } = useAuth();
  const [salvando, setSalvando] = useState(false);

  const [state, setState] = useState<OnboardingState>({
    // onboarding_step tem default 0 no banco — clamp pra 1 (senão o 1º clique
    // só vai de 0→1, exigindo dois cliques pra sair do passo inicial).
    // ⚠️ CLAMPADO À SEQUÊNCIA DO MODO. Quem parou no passo 3 do wizard
    // completo e volta pelo modo curto tem um `onboarding_step` que não
    // existe nesta sequência — sem o clamp, `indexOf` daria -1 e o "próximo"
    // jogaria a pessoa pro começo.
    step:      sequencia.includes(perfil?.onboarding_step || 0)
      ? (perfil?.onboarding_step as number)
      : sequencia[0],
    nome:      perfil?.name ?? '',
    perfilUso: (perfil?.perfil_uso as PerfilUso | undefined) ?? null,
    objetivo:  (perfil?.objetivo_principal as ObjetivoPrincipal | undefined) ?? null,
  });

  const setNome      = (n: string)            => setState((s) => ({ ...s, nome: n }));
  const setPerfilUso = (p: PerfilUso)         => setState((s) => ({ ...s, perfilUso: p }));
  const setObjetivo  = (o: ObjetivoPrincipal) => setState((s) => ({ ...s, objetivo: o }));
  const goTo         = (s: number)            => setState((st) => ({ ...st, step: Math.min(Math.max(1, s), TOTAL_STEPS) }));

  // Persiste o step + dados básicos no Supabase
  const persist = useCallback(async (overrides: Partial<OnboardingState> = {}) => {
    if (!user) return;
    const merged = { ...state, ...overrides };
    setSalvando(true);
    try {
      await supabase.from('users').update({
        name:                merged.nome || undefined,
        perfil_uso:          merged.perfilUso,
        objetivo_principal:  merged.objetivo,
        onboarding_step:     merged.step,
      }).eq('id', user.id);
    } catch (e) {
      console.warn('[onboarding] persist erro', e);
    } finally {
      setSalvando(false);
    }
  }, [user, state]);

  // Posição na sequência do modo (não o número do passo).
  const posicao = Math.max(0, sequencia.indexOf(state.step));

  const next = useCallback(async () => {
    const atual = sequencia.indexOf(state.step);
    const novo = sequencia[Math.min(atual + 1, sequencia.length - 1)];
    setState((s) => ({ ...s, step: novo }));
    await persist({ step: novo });
  }, [state.step, persist, sequencia]);

  const prev = useCallback(() => {
    setState((s) => {
      const atual = sequencia.indexOf(s.step);
      return { ...s, step: sequencia[Math.max(atual - 1, 0)] };
    });
  }, [sequencia]);

  const skip = useCallback(async () => {
    await next();
  }, [next]);

  const finalizar = useCallback(async () => {
    if (!user) return;
    setSalvando(true);
    try {
      await supabase.from('users').update({
        name:                state.nome || undefined,
        perfil_uso:          state.perfilUso,
        objetivo_principal:  state.objetivo,
        onboarding_step:     TOTAL_STEPS,
        onboarding_completed: true,
      }).eq('id', user.id);
      await recarregar();
    } finally {
      setSalvando(false);
    }
  }, [user, state, recarregar]);

  return (
    <Ctx.Provider value={{
      state,
      setNome, setPerfilUso, setObjetivo,
      goTo, next, prev, skip, finalizar,
      salvando,
      posicao: posicao + 1,
      total: sequencia.length,
      modo,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useOnboarding = () => useContext(Ctx);

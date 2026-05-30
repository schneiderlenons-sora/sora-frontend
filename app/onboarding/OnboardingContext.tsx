'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { PerfilUso, ObjetivoPrincipal } from '@/contexts/AuthContext';

export const TOTAL_STEPS = 9;

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
}

const Ctx = createContext<OnboardingContextType>({} as OnboardingContextType);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user, perfil, recarregar } = useAuth();
  const [salvando, setSalvando] = useState(false);

  const [state, setState] = useState<OnboardingState>({
    // onboarding_step tem default 0 no banco — clamp pra 1 (senão o 1º clique
    // só vai de 0→1, exigindo dois cliques pra sair do passo inicial).
    step:      Math.max(1, perfil?.onboarding_step || 1),
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

  const next = useCallback(async () => {
    const novo = Math.min(state.step + 1, TOTAL_STEPS);
    setState((s) => ({ ...s, step: novo }));
    await persist({ step: novo });
  }, [state.step, persist]);

  const prev = useCallback(() => {
    setState((s) => ({ ...s, step: Math.max(1, s.step - 1) }));
  }, []);

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
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useOnboarding = () => useContext(Ctx);

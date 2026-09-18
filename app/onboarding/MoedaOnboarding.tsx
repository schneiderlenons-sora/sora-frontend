'use client';

// =============================================================================
// Moeda base DENTRO do onboarding (Fase 6 do plano da moeda base).
//
// O painel recebe a moeda do servidor (`app/(app)/layout.tsx`), mas o
// onboarding fica fora daquele layout — e é justamente aqui que ela é
// ESCOLHIDA. Então a escolha vive neste estado, que o passo 1 atualiza na hora,
// e todo passo seguinte (saldo da conta, gastos fixos, meta) já mostra o
// símbolo certo sem recarregar nada.
//
// O valor inicial vem do perfil (`grupo_ativo.moeda_base`); sem perfil, real —
// o mesmo padrão de fora do provider.
// =============================================================================

import { createContext, useContext, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MoedaBaseProvider } from '@/lib/moeda-base';

type Ctx = { moeda: string | null; setMoeda: (m: string) => void };
const MoedaOnboardingCtx = createContext<Ctx>({ moeda: null, setMoeda: () => {} });

export function MoedaOnboardingProvider({ children }: { children: React.ReactNode }) {
  const { perfil } = useAuth();
  // Estado DERIVADO: enquanto ninguém escolheu, vale a do perfil (que chega
  // depois do primeiro render). Com useEffect+setState o símbolo piscaria.
  const [escolhida, setMoeda] = useState<string | null>(null);
  const moeda = escolhida ?? perfil?.grupo_ativo?.moeda_base ?? null;
  return (
    <MoedaOnboardingCtx.Provider value={{ moeda, setMoeda }}>
      <MoedaBaseProvider moeda={moeda}>{children}</MoedaBaseProvider>
    </MoedaOnboardingCtx.Provider>
  );
}

export const useMoedaOnboarding = () => useContext(MoedaOnboardingCtx);

'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react';
import SoraLoader from './SoraLoader';

// Ancestral de todas as páginas (montado em providers.tsx). Cada chamada de
// useApi avisa, por um contador, quando está no PRIMEIRO carregamento (sem
// dado em cache). Enquanto houver ≥1 carregando, a baleia cobre a área de
// conteúdo — a tela real só aparece quando os dados chegam (sem flash de zeros).
// Em revisita (cache quente) o SWR já tem dado → isLoading=false → sem baleia.

type Register = (active: boolean) => void;
const LoadingGateCtx = createContext<Register>(() => {});

// layout-effect no client (cobre antes do paint → sem flash); effect no SSR.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function LoadingGateProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const register = useCallback<Register>((active) => {
    setCount((c) => Math.max(0, c + (active ? 1 : -1)));
  }, []);

  return (
    <LoadingGateCtx.Provider value={register}>
      {children}
      {count > 0 && (
        <div
          className="fixed inset-0 md:left-64 z-40 flex items-center justify-center animate-[fade-in_200ms_ease-out_both]"
          style={{ background: 'hsl(var(--bg))' }}
        >
          <SoraLoader />
        </div>
      )}
    </LoadingGateCtx.Provider>
  );
}

// Registra um carregamento ativo no portão. `active` deve ser o `isLoading` do
// SWR (true só no 1º load sem cache). Usado internamente pelo useApi.
export function useGateRegister(active: boolean) {
  const register = useContext(LoadingGateCtx);
  useIsoLayoutEffect(() => {
    if (!active) return;
    register(true);
    return () => register(false);
  }, [active, register]);
}

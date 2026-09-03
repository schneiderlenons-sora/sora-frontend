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
          // ⚠️ z-30, ABAIXO DA NAVEGAÇÃO — e isso não é detalhe de estilo.
          //
          // Aqui era `z-40`, o MESMO do BottomNav, e o `md:left-64` só recua no
          // DESKTOP. No mobile, portanto, este overlay cobria a tela INTEIRA,
          // inclusive a barra de baixo e o botão que abre a sidebar. Enquanto
          // qualquer `useApi` estivesse no primeiro carregamento, TODO toque na
          // navegação era engolido: o usuário tocava em "Transações" duas, três
          // vezes e nada acontecia, até o dado chegar e o portão sumir.
          //
          // Com z-30 o BottomNav (z-40) fica por cima: continua clicável e
          // visível durante o carregamento. Os modais (z-50) e o drawer da
          // sidebar (z-[60]) seguem acima de tudo, como antes.
          //
          // ⚠️ NÃO resolver subindo o BottomNav pra z-50: ele empataria com
          // TODOS os modais do app, que são z-50, e passaria a disputar
          // empilhamento com eles por ordem de DOM.
          //
          // Bloquear o CONTEÚDO continua sendo o trabalho deste portão (é o que
          // evita o flash de zeros). Bloquear a NAVEGAÇÃO nunca foi.
          className="fixed inset-0 md:left-64 z-30 flex items-center justify-center animate-[fade-in_200ms_ease-out_both]"
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

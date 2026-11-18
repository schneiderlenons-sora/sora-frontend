'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react';
import SoraLoader from './SoraLoader';
import type { EstadoPortao } from '@/lib/portao';

// Ancestral de todas as páginas (montado em providers.tsx). Cada chamada de
// useApi avisa, por contadores, em que estado está — a REGRA de qual estado é
// qual mora em `lib/portao.ts` (nov/2026):
//
//   • 'baleia'   → não há NADA pra mostrar: a baleia cobre a área de conteúdo
//                  (sem flash de zeros). Era o único estado antes, e acendia
//                  também com a tela cheia de dados — ver lib/portao.ts.
//   • 'trocando' → a tela mostra o dado ANTERIOR (troca de mês/ano): barra fina
//                  no topo + conteúdo apagado. NÃO bloqueia nada — a pessoa
//                  continua navegando e tocando; só não lê o número antigo como
//                  se fosse do mês novo.

type Register = (estado: Exclude<EstadoPortao, null>, ativo: boolean) => void;
const LoadingGateCtx = createContext<Register>(() => {});

// layout-effect no client (cobre antes do paint → sem flash); effect no SSR.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function LoadingGateProvider({ children }: { children: React.ReactNode }) {
  const [baleias, setBaleias] = useState(0);
  const [trocas, setTrocas] = useState(0);
  const register = useCallback<Register>((estado, ativo) => {
    const set = estado === 'baleia' ? setBaleias : setTrocas;
    set((c) => Math.max(0, c + (ativo ? 1 : -1)));
  }, []);

  return (
    <LoadingGateCtx.Provider value={register}>
      {children}
      {baleias > 0 && (
        <div
          data-portao="baleia"
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
      {baleias === 0 && trocas > 0 && (
        <>
          {/* Conteúdo apagado: o número na tela é do período ANTERIOR.
              ⚠️ `pointer-events-none`: nada fica bloqueado — dá pra tocar de
              novo no "mês anterior", abrir menu, rolar.
              ⚠️ Só aparece depois de 150 ms (delay da animação): resposta
              rápida não pisca nada. */}
          <div
            data-portao="trocando"
            aria-hidden
            className="fixed inset-0 md:left-64 z-30 pointer-events-none opacity-0 animate-[portao-aparece_200ms_ease-out_150ms_forwards]"
            style={{ background: 'hsl(var(--bg) / 0.45)' }}
          />
          {/* Barra fina no topo (indeterminada). */}
          <div
            data-portao="trocando-barra"
            className="fixed top-0 left-0 md:left-64 right-0 z-30 h-[3px] overflow-hidden pointer-events-none opacity-0 animate-[portao-aparece_200ms_ease-out_150ms_forwards]"
          >
            <div
              className="h-full w-1/3 rounded-full motion-safe:animate-[portao-barra_1.1s_ease-in-out_infinite]"
              style={{ background: 'hsl(var(--primary))' }}
            />
            <span className="sr-only" role="status">Atualizando</span>
          </div>
        </>
      )}
    </LoadingGateCtx.Provider>
  );
}

// Diagnóstico: QUAIS chaves estão segurando a baleia agora. Fica só na memória
// da página (`window.__soraPortao`), sem rede — foi o que faltou pra explicar
// "a baleia apareceu nesta aba" sem chutar a causa (nov/2026).
const chavesNoPortao = new Map<string, number>();
function marcarChave(chaveDebug: string | undefined, delta: 1 | -1) {
  if (!chaveDebug || typeof window === 'undefined') return;
  const n = (chavesNoPortao.get(chaveDebug) || 0) + delta;
  if (n > 0) chavesNoPortao.set(chaveDebug, n); else chavesNoPortao.delete(chaveDebug);
  (window as unknown as { __soraPortao?: string[] }).__soraPortao = Array.from(chavesNoPortao.keys());
}

// Registra o estado de uma chamada no portão (regra em lib/portao.ts). Usado
// internamente pelo useApi. Só a BALEIA entra no diagnóstico de chaves.
export function useGateRegister(estado: EstadoPortao, chaveDebug?: string) {
  const register = useContext(LoadingGateCtx);
  useIsoLayoutEffect(() => {
    if (!estado) return;
    register(estado, true);
    if (estado === 'baleia') marcarChave(chaveDebug, 1);
    return () => {
      register(estado, false);
      if (estado === 'baleia') marcarChave(chaveDebug, -1);
    };
  }, [estado, register, chaveDebug]);
}

'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import SoraLoader from './SoraLoader';
import PageSkeleton from './PageSkeleton';
import SectionSkeleton from './SectionSkeleton';
import EsqueletoDashboard from './EsqueletoDashboard';
import EsqueletoNegocios from '@/components/negocios/EsqueletoNegocios';
import { esqueletoDaRota, type EstadoPortao } from '@/lib/portao';

// Ancestral de todas as páginas (montado em providers.tsx). Cada chamada de
// useApi avisa, por contadores, em que estado está — a REGRA de qual estado é
// qual mora em `lib/portao.ts` (nov/2026):
//
//   • 'baleia'   → não há NADA pra mostrar. No PAINEL o conteúdo fica
//                  invisível e entra o MESMO esqueleto do `loading.tsx` da rota
//                  (ver `ConteudoDoPortao`, abaixo). Fora do painel (só o
//                  /wrapped hoje) segue a baleia em tela cheia, como era.
//   • 'trocando' → a tela mostra o dado ANTERIOR (troca de mês/ano): barra fina
//                  no topo + conteúdo apagado. NÃO bloqueia nada — a pessoa
//                  continua navegando e tocando; só não lê o número antigo como
//                  se fosse do mês novo.

type Register = (estado: Exclude<EstadoPortao, null>, ativo: boolean) => void;
const LoadingGateCtx = createContext<Register>(() => {});
// "Nada pra mostrar" agora — lido SÓ pelo `ConteudoDoPortao` (um boolean: os
// outros componentes nem re-renderizam quando muda).
const CobrirCtx = createContext(false);
// O painel avisa que tem onde desenhar o esqueleto; sem ele, vale a baleia.
const SlotCtx = createContext<() => () => void>(() => () => {});

// layout-effect no client (cobre antes do paint → sem flash); effect no SSR.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function LoadingGateProvider({ children }: { children: React.ReactNode }) {
  const [baleias, setBaleias] = useState(0);
  const [trocas, setTrocas] = useState(0);
  const [slots, setSlots] = useState(0);
  const register = useCallback<Register>((estado, ativo) => {
    const set = estado === 'baleia' ? setBaleias : setTrocas;
    set((c) => Math.max(0, c + (ativo ? 1 : -1)));
  }, []);
  const registrarSlot = useCallback(() => {
    setSlots((c) => c + 1);
    return () => setSlots((c) => Math.max(0, c - 1));
  }, []);

  return (
    <SlotCtx.Provider value={registrarSlot}>
    <CobrirCtx.Provider value={baleias > 0}>
    <LoadingGateCtx.Provider value={register}>
      {children}
      {baleias > 0 && slots === 0 && (
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
    </CobrirCtx.Provider>
    </SlotCtx.Provider>
  );
}

// =============================================================================
// O ESQUELETO NO LUGAR DA BALEIA (nov/2026) — mora no `main` do DashboardLayout.
//
// ⚠️ POR QUE NÃO É UM OVERLAY. Ao abrir uma aba a pessoa via TRÊS telas: o
// esqueleto do `loading.tsx` (rota) → a baleia em tela cheia → o conteúdo. E a
// baleia entrava com fade a partir de opacidade 0 — medido: 0,00 no 1º quadro
// em toda aba —, então a tela ZERADA aparecia por trás dela, que é justamente o
// que ela existia pra esconder. Agora:
//   • o conteúdo fica INVISÍVEL (`visibility: hidden`), não desmontado nem
//     `display: none`: continua medindo largura (os gráficos), buscando dado e
//     ocupando o mesmo lugar — quando o dado chega, só volta a ser pintado;
//   • por cima entra o MESMO esqueleto que o `loading.tsx` daquela rota desenha
//     (`esqueletoDaRota`, travado no `eval:portao` contra cada loading.tsx), no
//     MESMO lugar (`padding: inherit` = o respiro do `main`). Da rota pro portão
//     nada se move: é um esqueleto só, até o conteúdo.
//   • sem fundo pintado: o gradiente do painel e a barra de baixo seguem iguais.
//
// ⚠️ `display: contents` no invólucro: ele não cria caixa, então nenhum layout
// das páginas muda (flex, sticky, h-full continuam relativos ao `main`). A
// `visibility` é herdada pelos filhos mesmo assim.
// ⚠️ Invisível também NÃO recebe toque — os botões da tela vazia ficam fora de
// alcance enquanto o esqueleto está ali, como com a baleia. A navegação (fora do
// `main`) segue livre.
// =============================================================================
export function ConteudoDoPortao({ children }: { children: React.ReactNode }) {
  const cobrir = useContext(CobrirCtx);
  const registrarSlot = useContext(SlotCtx);
  const pathname = usePathname();
  const ancora = useRef<HTMLDivElement>(null);
  const capa = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => registrarSlot(), [registrarSlot]);

  // O esqueleto nasce onde a pessoa ESTÁ olhando. Numa navegação a rolagem já
  // está no topo (0); num carregamento no meio da tela (ex.: um modal que busca
  // dado), sem isto ele ficaria lá em cima e a área visível ficaria vazia.
  useIsoLayoutEffect(() => {
    if (!cobrir || !capa.current) return;
    capa.current.style.top = `${ancora.current?.parentElement?.scrollTop || 0}px`;
  }, [cobrir]);

  const tipo = esqueletoDaRota(pathname);
  return (
    <>
      <div
        ref={ancora}
        data-portao-conteudo=""
        style={cobrir ? { display: 'contents', visibility: 'hidden' } : { display: 'contents' }}
      >
        {children}
      </div>
      {cobrir && (
        <div
          ref={capa}
          data-portao="esqueleto"
          role="status"
          aria-live="polite"
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{ padding: 'inherit' }}
        >
          <span className="sr-only">Carregando seus dados…</span>
          {tipo === 'dashboard' ? <EsqueletoDashboard />
            : tipo === 'negocios' ? <EsqueletoNegocios />
            : tipo === 'secao' ? <SectionSkeleton />
            : <PageSkeleton />}
        </div>
      )}
    </>
  );
}

// Diagnóstico: QUAIS chaves estão segurando a tela sem conteúdo agora (o
// esqueleto no painel, a baleia fora dele). Fica só na memória da página
// (`window.__soraPortao`), sem rede — foi o que faltou pra explicar "a baleia
// apareceu nesta aba" sem chutar a causa (nov/2026).
const chavesNoPortao = new Map<string, number>();
function marcarChave(chaveDebug: string | undefined, delta: 1 | -1) {
  if (!chaveDebug || typeof window === 'undefined') return;
  const n = (chavesNoPortao.get(chaveDebug) || 0) + delta;
  if (n > 0) chavesNoPortao.set(chaveDebug, n); else chavesNoPortao.delete(chaveDebug);
  (window as unknown as { __soraPortao?: string[] }).__soraPortao = Array.from(chavesNoPortao.keys());
}

// Registra o estado de uma chamada no portão (regra em lib/portao.ts). Usado
// internamente pelo useApi. Só o "nada pra mostrar" entra no diagnóstico.
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

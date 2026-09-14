'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { detectarOrigem } from '@/lib/origem-app';
import { LINK_TESTE_PLAY } from '@/lib/play-store';

// ─────────────────────────────────────────────────────────────────────────────
// Barra de convite pro app Android — o cabeçalho colorido no topo do painel.
//
// QUEM VÊ:
//   · celular ANDROID, no navegador. iPhone não instala app da Play Store, e
//     mostrar o convite ali seria mandar a pessoa pra um link que não abre;
//   · que ainda NÃO abriu a Sora dentro do app — nem neste aparelho (origem
//     local) nem em nenhum outro (`perfil.app_android_em`, migration 166).
// Dentro do próprio app a barra nunca aparece.
//
// ⚠️ ELA EMPURRA O TOPO DO PAINEL, e três coisas dependiam de "onde começa o
// topo": o padding do <main>, o círculo de tema (FIXO no canto superior
// direito — ficaria em cima do botão "Baixar") e o hero de vídeo do dashboard
// (também fixo em top: 0). Os três leem duas variáveis globais:
//
//   --sora-barra-altura   altura desta barra (0px sem ela)
//   --sora-topo-safe      safe-area do topo (0px com ela, porque ESTA barra já
//                         a absorve — senão o espaço do notch contaria 2 vezes)
//
// ⚠️ SEM A BARRA, OS VALORES SÃO EXATAMENTE OS DE ANTES: as variáveis só são
// escritas enquanto ela está na tela, e os padrões em `globals.css` reproduzem
// a conta antiga. iPhone, desktop e quem já está no app não sentem diferença.
//
// ⚠️ SEM BOTÃO DE FECHAR, de propósito: o pedido é que ela saia quando a pessoa
// BAIXAR. Se incomodar, o lugar de um "agora não" é aqui.
//
// Teste sem celular Android: `?barraplay=1` força a exibição.
// ─────────────────────────────────────────────────────────────────────────────

const TEXTO = '#2B1700';
const FUNDO = 'linear-gradient(135deg, #FFB547 0%, #FF9A3C 100%)';

export default function BarraPlayStore() {
  const { user, perfil } = useAuth();
  const [visivel, setVisivel] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const jaInstalou = !!perfil?.app_android_em;

  // ⚠️ Decidido em EFEITO: o servidor não conhece o aparelho, e decidir no
  // primeiro render daria hydration mismatch.
  useEffect(() => {
    if (!user) { setVisivel(false); return; }
    let forcar = false;
    try { forcar = new URLSearchParams(window.location.search).get('barraplay') === '1'; } catch { /* URL estranha */ }
    if (forcar) { setVisivel(true); return; }

    const android = /Android/i.test(navigator.userAgent);
    const dentroDoApp = detectarOrigem() === 'android';
    setVisivel(android && !dentroDoApp && !jaInstalou && !!LINK_TESTE_PLAY);
  }, [user, jaInstalou]);

  // Publica a altura real (ResizeObserver: a frase quebra em 2 linhas em tela
  // estreita, e no tablet o `md:hidden` a zera).
  useLayoutEffect(() => {
    const raiz = document.documentElement;
    const limpar = () => {
      raiz.style.removeProperty('--sora-barra-altura');
      raiz.style.removeProperty('--sora-topo-safe');
    };
    const el = ref.current;
    if (!visivel || !el) { limpar(); return; }

    const aplicar = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) {
        raiz.style.setProperty('--sora-barra-altura', `${h}px`);
        raiz.style.setProperty('--sora-topo-safe', '0px');
      } else {
        // Escondida pelo breakpoint: devolve os valores de antes, senão o
        // tablet com notch perderia a safe-area do topo.
        limpar();
      }
    };
    aplicar();
    const ro = new ResizeObserver(aplicar);
    ro.observe(el);
    return () => { ro.disconnect(); limpar(); };
  }, [visivel]);

  if (!visivel) return null;

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Convite para o app da Sora na Play Store"
      className="md:hidden relative z-[35] flex-shrink-0"
      style={{ background: FUNDO, paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          aria-hidden
          className="grid place-items-center w-11 h-11 rounded-xl flex-shrink-0"
          style={{ background: 'rgba(43, 23, 0, 0.10)' }}
        >
          {/* Triângulo do Play, monocromático — mesma linguagem do ícone da
              referência, sem as quatro cores da marca brigando com o fundo. */}
          <svg viewBox="0 0 24 24" width="20" height="20" fill={TEXTO}>
            <path d="M5 3.6v16.8a1.1 1.1 0 0 0 1.66.95l14.5-8.4a1.1 1.1 0 0 0 0-1.9L6.66 2.65A1.1 1.1 0 0 0 5 3.6z" />
          </svg>
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-bold leading-tight" style={{ color: TEXTO }}>
            A Sora chegou na Play Store
          </p>
          <p className="text-[12.5px] leading-snug mt-0.5" style={{ color: 'rgba(43, 23, 0, 0.78)' }}>
            Você foi convidado pra testar o app antes de todo mundo
          </p>
        </div>

        <a
          href={LINK_TESTE_PLAY}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 inline-flex items-center justify-center h-11 px-4 rounded-full
                     text-[13.5px] font-bold motion-safe:active:scale-[0.97] transition-transform"
          style={{ background: TEXTO, color: '#FFB547', minWidth: 44 }}
        >
          Baixar
        </a>
      </div>
    </div>
  );
}

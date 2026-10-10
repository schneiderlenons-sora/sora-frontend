'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { detectarOrigem } from '@/lib/origem-app';
import { LINK_PLAY_STORE } from '@/lib/play-store';

// ─────────────────────────────────────────────────────────────────────────────
// Barra "A Sora está na Play Store" — o cabeçalho no topo do painel no mobile.
//
// O app saiu do teste fechado e está PÚBLICO (out/2026). Antes esta barra
// convidava a TESTAR o app e abria um card explicando o e-mail da lista de
// testadores; agora é um aviso simples com botão que leva DIRETO pra página da
// loja (qualquer conta Google instala). Sem card intermediário.
//
// QUEM VÊ:
//   · celular ANDROID, no navegador (iPhone não instala da Play Store);
//   · que ainda NÃO abriu a Sora dentro do app — nem neste aparelho (origem
//     local) nem em outro (`perfil.app_android_em`, migration 166);
//   · que NÃO fechou a barra antes (o "x" grava a dispensa e ela não volta).
// Dentro do próprio app a barra nunca aparece.
//
// ⚠️ O "X" FECHA PRA SEMPRE: a dispensa é gravada em localStorage e checada no
// mount. É por aparelho/navegador (sem migration) — o mesmo padrão do
// `sora-pwa-prompted-v1` do InstallPwa. Quem instala o app faz a barra sumir
// por outro caminho (`app_android_em`), então os dois motivos de "não mostrar"
// coexistem sem conflito.
//
// ⚠️ ELA EMPURRA O TOPO DO PAINEL, e três coisas dependiam de "onde começa o
// topo": o padding do <main>, o círculo de tema (fixo no canto sup. direito) e
// o hero de vídeo do dashboard (fixo em top:0). Os três leem duas variáveis:
//   --sora-barra-altura   altura desta barra (0px sem ela)
//   --sora-topo-safe      safe-area do topo (0px com ela, porque ESTA barra já
//                         a absorve — senão o espaço do notch contaria 2 vezes)
// ⚠️ SEM A BARRA OS VALORES SÃO OS DE ANTES: as variáveis só são escritas
// enquanto ela está na tela, e os padrões em `globals.css` reproduzem a conta
// antiga. iPhone, desktop e quem já está no app não sentem diferença.
//
// Teste sem celular Android: `?barraplay=1` força a exibição (ignora a dispensa).
// ─────────────────────────────────────────────────────────────────────────────

const TEXTO = '#2B1700';
const FUNDO = 'linear-gradient(135deg, #FFB547 0%, #FF9A3C 100%)';
const CHAVE_DISPENSA = 'sora-barraplay-dispensada-v1';

function IconePlay({ tamanho }: { tamanho: number }) {
  // Triângulo do Play, monocromático — sem as quatro cores da marca brigando
  // com o fundo âmbar.
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill={TEXTO} aria-hidden>
      <path d="M5 3.6v16.8a1.1 1.1 0 0 0 1.66.95l14.5-8.4a1.1 1.1 0 0 0 0-1.9L6.66 2.65A1.1 1.1 0 0 0 5 3.6z" />
    </svg>
  );
}

export default function BarraPlayStore() {
  const { user, perfil } = useAuth();
  const [visivel, setVisivel] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const jaInstalou = !!perfil?.app_android_em;

  // ⚠️ Decidido em EFEITO: o servidor não conhece o aparelho nem o localStorage,
  // e decidir no primeiro render daria hydration mismatch.
  useEffect(() => {
    if (!user) { setVisivel(false); return; }

    let forcar = false;
    try { forcar = new URLSearchParams(window.location.search).get('barraplay') === '1'; } catch { /* URL estranha */ }
    if (forcar) { setVisivel(true); return; }

    let dispensada = false;
    try { dispensada = localStorage.getItem(CHAVE_DISPENSA) === '1'; } catch { /* storage bloqueado */ }

    const android = /Android/i.test(navigator.userAgent);
    const dentroDoApp = detectarOrigem() === 'android';
    setVisivel(android && !dentroDoApp && !jaInstalou && !dispensada && !!LINK_PLAY_STORE);
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

  function fechar() {
    try { localStorage.setItem(CHAVE_DISPENSA, '1'); } catch { /* storage bloqueado: some só nesta sessão */ }
    setVisivel(false);
  }

  if (!visivel) return null;

  return (
    <div
      ref={ref}
      role="region"
      aria-label="A Sora está disponível na Play Store"
      className="md:hidden relative z-[35] flex-shrink-0"
      style={{ background: FUNDO, paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* ~56px de corpo, fora a safe-area do topo. */}
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        <span
          aria-hidden
          className="grid place-items-center w-9 h-9 rounded-lg flex-shrink-0"
          style={{ background: 'rgba(43, 23, 0, 0.10)' }}
        >
          <IconePlay tamanho={16} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold leading-tight" style={{ color: TEXTO }}>
            A Sora está na Play Store
          </p>
          <p className="text-[12px] leading-snug" style={{ color: 'rgba(43, 23, 0, 0.78)' }}>
            Baixe o app oficial no seu Android
          </p>
        </div>

        {/* Download DIRETO pra loja — sem card intermediário (app público).
            Botão visual de 36px, mas a ÁREA DE TOQUE continua 44px via
            `after:-inset-1`, sem engordar a barra. */}
        <a
          href={LINK_PLAY_STORE}
          target="_blank"
          rel="noopener noreferrer"
          className="relative flex-shrink-0 inline-flex items-center justify-center h-9 px-3.5 rounded-full
                     text-[13px] font-bold motion-safe:active:scale-[0.97] transition-transform
                     after:content-[''] after:absolute after:-inset-1"
          style={{ background: TEXTO, color: '#FFB547' }}
        >
          Baixar
        </a>

        {/* Fechar pra sempre. 44px de alvo mesmo com ícone de 18px. */}
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar e não mostrar mais"
          className="relative flex-shrink-0 grid place-items-center w-9 h-9 -mr-1 rounded-full
                     motion-safe:active:scale-[0.92] transition-transform
                     after:content-[''] after:absolute after:-inset-1"
          style={{ color: 'rgba(43, 23, 0, 0.72)' }}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

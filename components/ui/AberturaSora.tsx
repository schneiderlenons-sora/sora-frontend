'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

// =============================================================================
// Animação de abertura da Sora — só no MOBILE, uma vez por sessão.
//
// Cobre a tela enquanto o painel carrega. Fica ACIMA do LoadingGate (z-40) e
// dos drawers (z-100), porque é a primeira coisa que a pessoa vê.
//
// ── AS TRAVAS, E POR QUE CADA UMA EXISTE ────────────────────────────────────
//
// ⚠️ O VÍDEO É VP9/WebM, E iOS NÃO TOCA ISSO ATÉ O SAFARI 16. Sem checar, o
//    iPhone mostraria uma TELA PRETA de 5 segundos no lugar da animação — pior
//    que não ter animação nenhuma. `canPlayType` decide ANTES de montar: não
//    tocando, a abertura simplesmente não acontece.
//
// ⚠️ TIMEOUT DURO. `onEnded` não dispara se o arquivo trava no meio (rede ruim
//    é a regra no mobile, não a exceção). O relógio corre em paralelo e some
//    com a tela de qualquer jeito — a abertura NUNCA pode virar um app que não
//    abre.
//
// ⚠️ UMA VEZ POR SESSÃO (sessionStorage). Sem isso ela reapareceria a cada
//    navegação entre abas, o que transforma um carinho em obstáculo.
//
// ⚠️ TOQUE PULA. São 5 segundos — e o painel carrega em ~1s. Quem já viu a
//    animação e quer o saldo agora tem de conseguir passar por cima.
//
// ⚠️ `prefers-reduced-motion` PULA. Quem pediu menos movimento ao sistema não
//    pode receber vídeo em tela cheia (regra §1 da ui-ux-pro-max).
//
// ⚠️ SÓ EM ROTA DE APP. Na landing e no login a abertura seria intrusiva — e a
//    landing tem métrica de conversão que um overlay de 5s destruiria.
// =============================================================================

const SRC = '/abertura/sora-intro.webm';

/** Duração real do arquivo (5,02s) + margem pro decode começar. */
const TETO_MS = 7000;

const CHAVE = 'sora-abertura-vista';

// Rotas públicas: a abertura não aparece nelas.
const PUBLICAS = ['/', '/login', '/signup', '/recuperar-senha', '/redefinir-senha',
                  '/oferta', '/kit', '/checkout-vitalicio', '/es'];

export default function AberturaSora() {
  const pathname = usePathname();
  const [fase, setFase] = useState<'oculta' | 'tocando' | 'saindo'>('oculta');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const encerrar = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setFase((f) => (f === 'tocando' ? 'saindo' : f));
  }, []);

  // ⚠️ setState só depois do await/rAF — nunca síncrono no corpo do efeito
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    let vivo = true;

    const publica = PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
    if (publica) return;

    let ok = false;
    try {
      const jaViu = sessionStorage.getItem(CHAVE) === '1';
      const mobile = window.matchMedia('(max-width: 767px)').matches;
      const calmo  = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // `canPlayType` devolve '' quando não sabe tocar, 'maybe' ou 'probably'.
      const v = document.createElement('video');
      const tocaVp9 = !!v.canPlayType('video/webm; codecs="vp9"');
      ok = !jaViu && mobile && calmo && tocaVp9;
      if (ok) sessionStorage.setItem(CHAVE, '1');
    } catch {
      ok = false;   // navegador privado sem sessionStorage: só não mostra
    }
    if (!ok) return;

    const raf = requestAnimationFrame(() => { if (vivo) setFase('tocando'); });
    return () => { vivo = false; cancelAnimationFrame(raf); };
  }, [pathname]);

  // Relógio de segurança: corre junto com o vídeo e vence se ele travar.
  useEffect(() => {
    if (fase !== 'tocando') return;
    timer.current = setTimeout(encerrar, TETO_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [fase, encerrar]);

  // Desmonta depois do fade — sem isso o overlay invisível continuaria por
  // cima da tela e engoliria todo toque do usuário.
  useEffect(() => {
    if (fase !== 'saindo') return;
    const t = setTimeout(() => setFase('oculta'), 400);
    return () => clearTimeout(t);
  }, [fase]);

  if (fase === 'oculta') return null;

  return (
    <div
      role="presentation"
      onClick={encerrar}
      className={`fixed inset-0 z-[200] flex items-center justify-center md:hidden ${
        fase === 'saindo' ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ background: 'hsl(var(--bg))', transition: 'opacity 380ms ease-out' }}
    >
      <video
        ref={videoRef}
        src={SRC}
        autoPlay
        muted
        playsInline
        // ⚠️ SEM `loop`: a animação toca uma vez e sai. Em loop ela viraria uma
        // tela de carregamento infinita se o timeout falhasse.
        preload="auto"
        aria-hidden="true"
        onEnded={encerrar}
        onError={encerrar}
        // Se o vídeo não conseguir NEM começar, não vale segurar a tela.
        onStalled={encerrar}
        className="h-full w-full object-cover"
      />

      {/* Saída visível. Sem isto o único jeito de pular seria adivinhar que a
          tela inteira é clicável — e são 5 segundos de espera. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); encerrar(); }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full px-5 text-[13px] font-semibold text-white/80 backdrop-blur-sm transition-colors hover:text-white"
        style={{ background: 'rgba(0,0,0,0.35)', minHeight: 44 }}
      >
        Pular
      </button>
    </div>
  );
}

'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';

// =============================================================================
// Vídeo de fundo do hero do dashboard — SÓ MOBILE (<1024px).
//
// Referência: dashboard do Pierre (print do usuário) — vídeo curto que toca
// UMA vez ao entrar na tela e, ao terminar, congela sozinho no último frame
// (comportamento NATIVO do <video loop={false}>, não precisa de nada extra
// pra "pausar no fim"). Só reinicia se: (a) o componente remonta — trocou de
// aba do site e voltou pro dashboard — ou (b) a aba do NAVEGADOR volta a ficar
// visível (troca de app/aba do SO e retorna).
//
// PESO: os dois .webm ficam em public/dashboard/ (~350–450 KB cada). O
// componente NUNCA monta a tag <video> em telas ≥1024px — o navegador não
// chega a pedir o arquivo pra quem tá no desktop, onde o usuário não pediu
// isso. `useMediaQuery` usa useSyncExternalStore (não useState+useEffect):
// no servidor devolve sempre `false` e só troca pro valor real DEPOIS da
// hidratação — sem hydration mismatch e sem o "setState direto no efeito"
// que gera render em cascata.
//
// `prefers-reduced-motion` desliga o vídeo de vez: quem pediu menos animação
// ao sistema fica só com o gradiente estático que já existia no card.
// =============================================================================

/** Assina uma media query via useSyncExternalStore — sem setState em efeito,
 *  sem gate de "mounted" manual, sem risco de hydration mismatch (o servidor
 *  sempre recebe `false` do getServerSnapshot). */
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false, // snapshot do servidor
  );
}

const SRC = {
  claro: '/dashboard/baleia-animada-claro.webm',
  black: '/dashboard/baleia-animada-black.webm',
};

// Mesmos stops do gradiente que o .insight-hero já usa em cada tema
// (app/globals.css) — o vídeo aparece translúcido no topo e a própria cor do
// card "engole" o vídeo perto do fim, sem costura visível com o resto do card.
const SCRIM = {
  claro: 'linear-gradient(180deg, rgba(250,250,250,0.32) 0%, rgba(250,250,250,0.58) 38%, #F4F4F5 72%, #EDEDEF 100%)',
  black: 'linear-gradient(180deg, rgba(8,8,10,0.32) 0%, rgba(8,8,10,0.58) 38%, #08080A 72%, #030305 100%)',
};

export default function HeroVideoBg() {
  const { resolvedTheme } = useTheme();
  const mobile = useMediaQuery('(max-width: 1023px)'); // abaixo do breakpoint lg
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Cobre o caso de troca de ABA/APP do sistema operacional (não só navegação
  // dentro do site, que já reinicia sozinha ao remontar o componente). Só
  // controle imperativo do <video> via ref — nenhum setState aqui dentro.
  useEffect(() => {
    if (!mobile) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = 0;
      v.play().catch(() => { /* autoplay sem gesto pode ser bloqueado — falha em silêncio */ });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [mobile]);

  if (!mobile || reduceMotion) return null;

  const isDark = resolvedTheme === 'black' || resolvedTheme === 'dark';
  const src = isDark ? SRC.black : SRC.claro;
  const scrim = isDark ? SCRIM.black : SCRIM.claro;

  return (
    <>
      {/* key=src força remontar (e reiniciar do zero) quando o usuário troca
          de tema com o vídeo já rodando. */}
      <video
        key={src}
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        autoPlay
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src={src} type="video/webm" />
      </video>
      {/* Scrim: deixa o vídeo como pano de fundo discreto (não uma foto vívida
          competindo com o texto) e funde com a cor sólida do card no final —
          é o que garante contraste igual ao de hoje pra QUALQUER frame do
          vídeo, nos dois temas. */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: scrim }} />
    </>
  );
}

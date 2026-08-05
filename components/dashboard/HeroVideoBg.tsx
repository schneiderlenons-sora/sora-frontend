'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
// As medidas vivem em lib/dashboard-hero.ts (módulo sem 'use client'), porque
// o loading.tsx é Server Component e precisa reservar a mesma altura.
import { ALTURA_VIDEO } from '@/lib/dashboard-hero';

// =============================================================================
// Vídeo de FUNDO do dashboard — SÓ MOBILE (<768px, o mesmo breakpoint do shell:
// sidebar aparece em `md`, BottomNav some em `md`).
//
// Referência: dashboard do Pierre (print do usuário). O vídeo NÃO é do card —
// é o fundo da tela inteira: encosta no topo (por baixo da safe-area) e nas
// duas laterais, com o conteúdo começando mais abaixo, já dentro do gradiente
// do PRÓPRIO vídeo.
//
// ⚠️ SEM VÉU / SEM OVERLAY. Os dois arquivos já trazem o gradiente que funde
// com o tema (um por tema). Qualquer camada por cima aqui deixa a imagem
// lavada — foi exatamente o que o usuário rejeitou na 1ª versão.
//
// `object-position: 50% 100%` ancora o vídeo pela BASE: assim o gradiente que
// vem dentro do arquivo cai sempre exatamente na borda de baixo da faixa, que
// é onde ele precisa encontrar o fundo do painel. Se ancorasse pelo centro, o
// corte comeria justamente o gradiente e apareceria uma costura.
//
// Comportamento: toca UMA vez e congela no último frame (nativo do <video>
// sem `loop`). Reinicia quando a página remonta (voltou de outra aba do site)
// ou quando a aba do navegador volta a ficar visível.
//
// PESO: os .webm ficam em public/dashboard/. A tag <video> NUNCA é montada em
// ≥768px — no desktop o navegador nem chega a pedir o arquivo.
// =============================================================================

/** Assina uma media query via useSyncExternalStore — sem setState em efeito e
 *  sem hydration mismatch (o servidor sempre recebe `false`). */
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

export default function HeroVideoBg() {
  const { resolvedTheme } = useTheme();
  const mobile = useMediaQuery('(max-width: 767px)');
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Troca de app/aba do SISTEMA e volta → reinicia a animação. (Navegar dentro
  // do site já remonta o componente, que reinicia sozinho.)
  useEffect(() => {
    if (!mobile || reduceMotion) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = 0;
      v.play().catch(() => { /* autoplay pode ser bloqueado — falha em silêncio */ });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [mobile, reduceMotion]);

  if (!mobile) return null;

  const isDark = resolvedTheme === 'black' || resolvedTheme === 'dark';
  const src = isDark ? SRC.black : SRC.claro;

  return (
    <div
      aria-hidden
      className="md:hidden absolute inset-x-0 top-0 overflow-hidden pointer-events-none select-none"
      // `inset-x-0 / top-0` já encosta nas bordas: o bloco que contém um
      // elemento absoluto é o PADDING BOX do <main> (que é o ancestral
      // `relative`), então o px-4/pt do main NÃO deslocam o vídeo.
      style={{
        height: `calc(env(safe-area-inset-top, 0px) + 0.75rem + ${ALTURA_VIDEO})`,
        zIndex: 0,
      }}
    >
      {/* key=src remonta (e reinicia do zero) ao trocar de tema com o vídeo
          já rodando. Sem `loop`: congela no último frame por conta própria.
          Com prefers-reduced-motion fica no primeiro frame, como uma foto. */}
      <video
        key={src}
        ref={videoRef}
        className="w-full h-full"
        style={{ objectFit: 'cover', objectPosition: '50% 100%' }}
        autoPlay={!reduceMotion}
        muted
        playsInline
        preload="auto"
        tabIndex={-1}
      >
        <source src={src} type="video/webm" />
      </video>
    </div>
  );
}

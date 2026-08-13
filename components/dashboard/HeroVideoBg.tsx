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
    <>
      {/* ⚠️ `fixed`, não `absolute`: o fundo fica PARADO e o conteúdo rola por
          cima dele (os cards são semitransparentes — ver `.dash-glass .card`
          no globals.css). Como `absolute`, ele subia junto com a rolagem e
          sumia depois dos primeiros 400px.
          Funciona mesmo dentro do <main overflow-y-auto>: `fixed` se ancora na
          viewport e escapa do scroll — desde que nenhum ancestral tenha
          transform/filter/backdrop-filter (nenhum tem; ver DashboardLayout). */}
      <div
        aria-hidden
        className="md:hidden fixed inset-x-0 top-0 overflow-hidden pointer-events-none select-none"
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

        {/* ── Costura com o fundo do painel (SÓ NO ESCURO) ───────────────
            Os arquivos .webm trazem um gradiente próprio que fecha certo no
            tema CLARO — o usuário confirmou que ali está ótimo, então lá não
            entra máscara nenhuma (uma segunda camada só lavaria a imagem, que
            foi o motivo do "SEM VÉU" original).
            No ESCURO o preto do vídeo e o preto do painel não são o mesmo
            preto, e ficava uma linha nítida no encontro. Esta faixa fecha o
            último terço na cor REAL do fundo (`--bg`), fazendo o encontro
            deixar de existir. É máscara de BORDA: começa transparente e só
            fecha no fim, então a parte vívida continua intocada. */}
        {isDark && (
          <div
            className="absolute inset-x-0 bottom-0 h-1/3"
            style={{
              background: 'linear-gradient(to bottom, transparent 0%, hsl(var(--bg) / .55) 55%, hsl(var(--bg)) 100%)',
            }}
          />
        )}
      </div>

      {/* ── Scrim do topo ─────────────────────────────────────────────────
          Fixo acima do conteúdo (z-2 > z-1 dos cards): é nele que os cards
          "somem" ao rolar pra cima, em vez de encostarem na borda da tela
          cortados no meio. Curto e só na faixa da status bar. */}
      <div
        aria-hidden
        className="md:hidden fixed inset-x-0 top-0 pointer-events-none"
        style={{
          height: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)',
          zIndex: 2,
          background: 'linear-gradient(to bottom, hsl(var(--bg)) 0%, hsl(var(--bg) / .75) 45%, transparent 100%)',
        }}
      />
    </>
  );
}

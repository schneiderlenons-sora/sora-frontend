'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
// As medidas vivem em lib/dashboard-hero.ts (módulo sem 'use client'), porque
// o loading.tsx é Server Component e precisa reservar a mesma altura.
import { ALTURA_VIDEO, ALTURA_VIDEO_DESKTOP } from '@/lib/dashboard-hero';

// =============================================================================
// Vídeo de FUNDO do dashboard — MOBILE e DESKTOP, com arquivos diferentes.
//
// Referência: dashboard do Pierre. O vídeo NÃO é do card — é o fundo da área
// de conteúdo: encosta no topo e nas laterais, com o conteúdo começando mais
// abaixo, já dentro do gradiente.
//
// ── A DIFERENÇA ENTRE OS DOIS ────────────────────────────────────────────
// MOBILE: dois arquivos 800×800, um por tema, e cada um JÁ TRAZ o gradiente
//   que funde com o fundo. Por isso lá quase não há overlay — no claro
//   nenhum, no escuro só uma faixa de costura (os pretos não batem).
//   ⚠️ SEM VÉU por cima da parte vívida: foi o que o usuário rejeitou na 1ª
//   versão, deixa a imagem lavada.
// DESKTOP: um arquivo só, 2690×770, panorâmico e SEM gradiente embutido
//   (medido: opaco de ponta a ponta, sunset laranja em cima, mar azul
//   embaixo). Então aqui o gradiente é NOSSO, desenhado em `hsl(var(--bg))` —
//   ou seja, ele acompanha o tema sozinho, sem precisar de dois arquivos.
//
// Os dois ancoram pela BASE (eixo Y em `100%`). No mobile é onde o gradiente
// do arquivo cai; no desktop é o que garante que, quando o teto de altura
// corta a faixa, quem se perde é o CÉU e não o horizonte/água — justamente
// onde o nosso gradiente encontra o fundo do painel.
//
// Comportamento: toca UMA vez e congela no último frame (nativo do <video>
// sem `loop`). Reinicia quando a página remonta ou quando a aba volta a ficar
// visível.
//
// PESO: os arquivos ficam em public/dashboard/. Cada <video> só é montado na
// faixa de largura dele — o celular NUNCA pede o arquivo de 1,8 MB do desktop,
// e o desktop não pede os do mobile.
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
  desktop: '/dashboard/baleia-animada-desktop.webm',
};

export default function HeroVideoBg() {
  const { resolvedTheme } = useTheme();
  const mobile = useMediaQuery('(max-width: 767px)');
  const desktop = useMediaQuery('(min-width: 768px)');
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const videoRef = useRef<HTMLVideoElement>(null);
  const ancoraRef = useRef<HTMLDivElement>(null);
  // Scrim do topo só entra DEPOIS que a rolagem começa (pedido do usuário: de
  // cara, parado no topo, ele escurecia a imagem sem motivo — não há conteúdo
  // passando por baixo ainda).
  const [rolou, setRolou] = useState(false);
  // Largura da barra de rolagem do <main>. Ver o efeito de scroll abaixo.
  const [barra, setBarra] = useState(0);

  const ativo = mobile || desktop;

  // Troca de app/aba do SISTEMA e volta → reinicia a animação. (Navegar dentro
  // do site já remonta o componente, que reinicia sozinho.)
  useEffect(() => {
    if (!ativo || reduceMotion) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = 0;
      v.play().catch(() => { /* autoplay pode ser bloqueado — falha em silêncio */ });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [ativo, reduceMotion]);

  // ⚠️ Quem rola NÃO é a window: é o <main> (`overflow-y-auto` no
  // DashboardLayout). Ouvir `window` aqui nunca dispararia. Chego nele por
  // `closest('main')` a partir de uma âncora no próprio componente — os divs
  // são `fixed`, mas isso só afeta o LAYOUT; na árvore do DOM eles seguem
  // dentro do main.
  useEffect(() => {
    if (!ativo) return;
    const scroller = ancoraRef.current?.closest('main');
    if (!scroller) return;
    const onScroll = () => setRolou(scroller.scrollTop > 12);
    onScroll();                                     // estado inicial correto
    scroller.addEventListener('scroll', onScroll, { passive: true });

    // ⚠️ QUEM ROLA É O <main>, MAS AS CAMADAS SÃO `fixed` — logo elas se
    // ancoram na VIEWPORT e `right: 0` cai em cima da barra de rolagem do
    // main, escondendo a barra inteira (o usuário perdia a referência de onde
    // estava na página). Não dá pra resolver só com CSS: a largura da barra
    // varia por SO e por navegador, e em barra "overlay" (mobile, macOS) ela é
    // ZERO — descontar um valor fixo deixaria uma tira do fundo aparecendo.
    // Então é medida: largura de fora menos largura de dentro.
    const medir = () => setBarra(Math.max(0, scroller.clientWidth ? scroller.getBoundingClientRect().width - scroller.clientWidth : 0));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(scroller);

    return () => {
      scroller.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [ativo]);

  if (!ativo) return null;

  const isDark = resolvedTheme === 'black' || resolvedTheme === 'dark';
  const src = desktop ? SRC.desktop : (isDark ? SRC.black : SRC.claro);

  return (
    <>
      {/* ⚠️ `fixed`, não `absolute`: o fundo fica PARADO e o conteúdo rola por
          cima dele (os cards são semitransparentes — ver `.dash-glass .card`
          no globals.css). Como `absolute`, ele subia junto com a rolagem e
          sumia depois dos primeiros 400px.
          Funciona mesmo dentro do <main overflow-y-auto>: `fixed` se ancora na
          viewport e escapa do scroll — desde que nenhum ancestral tenha
          transform/filter/backdrop-filter (nenhum tem; ver DashboardLayout).
          ⚠️ `md:left-64` = a largura da sidebar (`w-64` no Sidebar.tsx). Sem
          isso a faixa passaria POR BAIXO dela: `fixed` se ancora na viewport,
          não no <main>. */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 md:left-64 overflow-hidden pointer-events-none select-none"
        style={{
          // Recuo da barra de rolagem do <main> — sem ele a faixa cobre a
          // barra inteira (ver o efeito que mede `barra`).
          right: barra,
          // Altura pela PROPORÇÃO do arquivo no desktop (ver
          // lib/dashboard-hero.ts): é o que faz a cena aparecer inteira do
          // tablet ao ultrawide, em vez de o `cover` comer as laterais numa
          // tela estreita.
          height: desktop
            ? ALTURA_VIDEO_DESKTOP
            : `calc(env(safe-area-inset-top, 0px) + 0.75rem + ${ALTURA_VIDEO})`,
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
          // Os dois ancoram pela BASE (`100%` no eixo Y). No X eles divergem: o
          // mobile é quadrado e centraliza; o desktop ancora à ESQUERDA porque
          // o único corte horizontal que ele sofre é no tablet, e lá o que
          // precisa sobrar é a casa + a costa (o lado direito é só mar aberto).
          style={{ objectFit: 'cover', objectPosition: desktop ? '0% 100%' : '50% 100%' }}
          autoPlay={!reduceMotion}
          muted
          playsInline
          preload="auto"
          tabIndex={-1}
        >
          <source src={src} type="video/webm" />
        </video>

        {/* ── Costura com o fundo do painel ──────────────────────────────
            MOBILE, tema claro: NADA. O arquivo já fecha certo — uma segunda
              camada só lavaria a imagem (o "SEM VÉU" original).
            MOBILE, tema escuro: o preto do vídeo e o preto do painel não são
              o mesmo preto, e ficava uma linha nítida no encontro.
            DESKTOP, os dois temas: o arquivo é panorâmico e NÃO traz gradiente
              nenhum — o mar azul bateria direto no fundo do painel. Aqui a
              faixa é obrigatória, e é mais longa (3/5 contra 1/3) porque no
              tema claro a distância entre o azul do mar e o fundo quase branco
              é grande demais pra fechar em pouco espaço.
            Nos dois casos a cor é `hsl(var(--bg))` — a MESMA variável do fundo
            do painel, então o encontro some sozinho em qualquer tema, sem
            precisar de um arquivo por tema. */}
        {desktop ? (
          <div
            className="absolute inset-x-0 bottom-0 h-3/5"
            style={{
              background:
                'linear-gradient(to bottom, transparent 0%, hsl(var(--bg) / .25) 30%,'
                + ' hsl(var(--bg) / .68) 60%, hsl(var(--bg) / .93) 84%, hsl(var(--bg)) 100%)',
            }}
          />
        ) : isDark ? (
          <div
            className="absolute inset-x-0 bottom-0 h-1/3"
            style={{
              background: 'linear-gradient(to bottom, transparent 0%, hsl(var(--bg) / .55) 55%, hsl(var(--bg)) 100%)',
            }}
          />
        ) : null}
      </div>

      {/* ── Scrim do topo ─────────────────────────────────────────────────
          Fixo acima do conteúdo (z-2 > z-1 dos cards): é nele que os cards
          "somem" ao rolar pra cima, em vez de encostarem na borda da tela
          cortados no meio.
          ⚠️ `opacity` amarrada ao scroll: parado no topo ele não existe (não há
          nada passando por baixo pra cobrir, e escurecia a imagem à toa).
          Transição só na opacidade — barata, não causa reflow. */}
      <div
        ref={ancoraRef}
        aria-hidden
        className="fixed inset-x-0 top-0 md:left-64 pointer-events-none transition-opacity duration-300"
        style={{
          right: barra,
          height: 'calc(env(safe-area-inset-top, 0px) + 4rem)',
          zIndex: 2,
          opacity: rolou ? 1 : 0,
          background: 'linear-gradient(to bottom, hsl(var(--bg)) 0%, hsl(var(--bg) / .82) 40%, hsl(var(--bg) / .4) 72%, transparent 100%)',
        }}
      />
    </>
  );
}

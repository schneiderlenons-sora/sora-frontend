'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Vídeo de demonstração da landing — decorativo, em loop, sem controles.
//
// ⚠️ EXISTE POR CAUSA DO PESO. Os dois vídeos da landing somam ~7 MB. Um
// `<video src>` comum começa a baixar assim que o HTML chega, mesmo lá embaixo
// na página: no 4G isso rouba banda do LCP e derruba o Lighthouse mobile, que
// é justamente a métrica que o CLAUDE.md manda proteger nesta base.
//
// Aqui o `src` só é ATRIBUÍDO quando o bloco chega perto da tela. Antes disso o
// elemento existe (reserva o espaço) mas não tem o que baixar.
//
// ⚠️ `aspecto` é OBRIGATÓRIO e reserva a altura antes do vídeo existir. Sem
// isso a chegada do arquivo empurra tudo abaixo — o CLS que o CLAUDE.md cita
// como regra de não-regressão.
//
// Respeita `prefers-reduced-motion`: quem pediu menos animação recebe o vídeo
// parado no primeiro quadro, com controles, em vez de um loop automático.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { useVisivel } from '@/lib/useVisivel';

export default function VideoLazy({
  src,
  aspecto,
  titulo,
  className = '',
}: {
  src: string;
  /** Ex.: '9 / 16' (celular em pé) ou '16 / 10'. Reserva o espaço. */
  aspecto: string;
  /** Descrição do que o vídeo mostra — vira `aria-label`. */
  titulo: string;
  className?: string;
}) {
  // `true` como `ativo`: este bloco não depende de dado remoto, ao contrário
  // dos gráficos do painel — pode observar desde a montagem.
  const { ref, visivel } = useVisivel<HTMLDivElement>(true, '400px');
  const [semMovimento, setSemMovimento] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Segurar/passar o mouse PAUSA ──────────────────────────────────────────
  // O vídeo roda em loop e é rápido; sem uma forma de parar, quem quer ler a
  // tela precisa esperar dar a volta. `pointer*` cobre mouse e toque com o
  // mesmo par de eventos, então não há caminho duplicado pra manter.
  //
  // ⚠️ Não faz nada com `prefers-reduced-motion`: ali o vídeo já nasce parado e
  // com controles nativos — mexer no play/pause brigaria com o próprio usuário.
  const pausar = () => {
    if (semMovimento) return;
    videoRef.current?.pause();
  };
  const retomar = () => {
    if (semMovimento) return;
    // `play()` devolve uma promise que REJEITA se o elemento sair da tela ou o
    // navegador bloquear — engolir evita erro no console em algo decorativo.
    videoRef.current?.play().catch(() => {});
  };

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setSemMovimento(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  return (
    <div
      ref={ref}
      style={{ aspectRatio: aspecto }}
      // ⚠️ `select-none` + `-webkit-touch-callout` NÃO são enfeite: segurar o
      // dedo pra pausar disparava a seleção de texto do iOS — a lupa aparecia e
      // o parágrafo acima do vídeo saía todo marcado de azul. Como aqui não há
      // nada pra selecionar nem pra copiar, desligar é o certo. `manipulation`
      // tira o duplo-toque-pra-zoom (o toque aqui é pra pausar) sem afetar o
      // rolar da página.
      className={`relative w-full overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-white/10
                  bg-zinc-100 dark:bg-[#0d0d0d] select-none [touch-action:manipulation]
                  [-webkit-touch-callout:none] [-webkit-user-select:none]
                  shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] dark:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.85)]
                  ${className}`}
    >
      {visivel ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          src={src}
          autoPlay={!semMovimento}
          loop
          muted
          playsInline
          preload="none"
          controls={semMovimento}
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
          aria-label={titulo}
          draggable={false}
          // Segurar no iOS abre o menu "Salvar vídeo" e leva junto a seleção;
          // o toque aqui só serve pra pausar.
          onContextMenu={(e) => e.preventDefault()}
          onPointerEnter={pausar}
          onPointerLeave={retomar}
          onPointerDown={pausar}
          onPointerUp={retomar}
          onPointerCancel={retomar}
        />
      ) : (
        // Placeholder do MESMO tamanho: o bloco já ocupa o espaço final, então
        // a troca pelo vídeo não move nada na página.
        <div className="absolute inset-0 animate-pulse bg-zinc-200/70 dark:bg-white/[0.04]"
             role="status" aria-label={`Carregando: ${titulo}`} />
      )}
    </div>
  );
}

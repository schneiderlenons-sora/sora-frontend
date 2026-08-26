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

import { useEffect, useState } from 'react';
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
      className={`relative w-full overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-white/10
                  bg-zinc-100 dark:bg-[#0d0d0d]
                  shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] dark:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.85)]
                  ${className}`}
    >
      {visivel ? (
        <video
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

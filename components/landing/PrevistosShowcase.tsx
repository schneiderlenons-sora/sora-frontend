'use client';

// Seção "Previstos" — logo depois do Open Finance, e essa ordem é proposital:
// o Open Finance conta o que JÁ aconteceu; esta conta o que ainda VAI. Juntas
// fecham o mês inteiro, que é o argumento da página.

import { useTranslations } from 'next-intl';
import VideoLazy from '@/components/landing/VideoLazy';

export default function PrevistosShowcase() {
  const t = useTranslations('previstos');

  return (
    <section className="relative py-24 lg:py-32 border-t border-zinc-200/50 dark:border-white/[0.04]">
      {/* Glow de fundo, no mesmo padrão das outras seções de destaque. */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-20 dark:opacity-15"
          style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.18) 0%, transparent 60%)' }}
        />
      </div>

      <div className="relative max-w-5xl mx-auto px-5 sm:px-8 text-center">
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
          {t('eyebrow')}
        </p>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-[-0.03em] max-w-3xl mx-auto">
          {t('titulo')}
        </h2>

        <p className="mt-5 text-base lg:text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto">
          {t('desc')}
        </p>

        {/* ⚠️ O vídeo é de tela de CELULAR (9/16). Numa seção de largura cheia
            ele ficaria gigante e empurraria o resto pra fora da dobra, então
            vai num container estreito e centralizado — do tamanho que a tela
            realmente tem. */}
        <div className="mt-12 mx-auto w-full max-w-[300px] sm:max-w-[340px]">
          <VideoLazy
            src="/landing/previstos/previstos.webm"
            aspecto="9 / 16"
            titulo={t('alt')}
          />
        </div>
      </div>
    </section>
  );
}

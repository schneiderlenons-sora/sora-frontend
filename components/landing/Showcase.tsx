'use client';

import { useTranslations } from 'next-intl';
import VideoLazy from '@/components/landing/VideoLazy';
import CtaPlanos from '@/components/landing/CtaPlanos';

// Seções de destaque (título + imagem + subtítulo) logo após o Open Finance.
// Imagens em public/landing/ — versões separadas pra tema claro e escuro
// (as PNGs já vêm transparentes; renderizadas sem moldura/fundo).
const SECAO_IMG = [
  { imgDark: '/landing/para-onde-vai.png', imgLight: '/landing/para-onde-vai-light.png' },
  { imgDark: '/landing/gestao-compartilhada.png', imgLight: '/landing/gestao-compartilhada-light.png' },
];

export default function Showcase() {
  const t = useTranslations('showcase');
  const txt = t.raw('secoes') as { eyebrow: string; titulo: string; alt: string; sub: string }[];

  // Conteúdo extra por seção, alinhado por ÍNDICE com `SECAO_IMG`.
  // [0] Clareza total · [1] Gestão compartilhada.
  const EXTRAS: (React.ReactNode | null)[] = [
    (
      <div key="categorias" className="mt-14">
        <p className="text-lg lg:text-xl font-semibold tracking-[-0.02em] max-w-2xl mx-auto">
          {t('categorias.frase')}
        </p>
        {/* Vídeo de tela de celular (9/16) — container estreito, senão ele
            domina a seção e empurra o CTA pra fora da vista. */}
        <div className="mt-8 mx-auto w-full max-w-[300px] sm:max-w-[340px]">
          <VideoLazy
            src="/landing/categorias/categorias.webm"
            aspecto="9 / 16"
            titulo={t('categorias.alt')}
          />
        </div>
        <div className="mt-10">
          <CtaPlanos fraseKey="verPlanos" />
        </div>
      </div>
    ),
    null,
  ];

  const SECOES = SECAO_IMG.map((s, i) => ({ ...s, ...txt[i], extra: EXTRAS[i] }));
  return (
    <>
      {SECOES.map((s) => (
        <section
          key={s.titulo}
          className="relative py-24 lg:py-32 border-t border-zinc-200/50 dark:border-white/[0.04]"
        >
          {/* Glow de fundo sutil da seção (não envolve a imagem) */}
          <div aria-hidden className="absolute inset-0 pointer-events-none">
            <div
              className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-20 dark:opacity-15"
              style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.18) 0%, transparent 60%)' }}
            />
          </div>

          <div className="relative max-w-5xl mx-auto px-5 sm:px-8 text-center">
            <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
              {s.eyebrow}
            </p>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-[-0.03em] max-w-3xl mx-auto">
              {s.titulo}
            </h2>

            {/* Imagem limpa, sem moldura — troca por tema via CSS.
                aspect-[17/12] (= 1530×1080) reserva o espaço antes da imagem
                carregar, evitando o "estouro" que empurra as seções abaixo. */}
            <div className="mt-10 mb-8">
              <img
                src={s.imgLight}
                alt={s.alt}
                loading="lazy"
                className="block dark:hidden mx-auto w-full h-auto max-h-[640px] aspect-[17/12] object-contain"
              />
              <img
                src={s.imgDark}
                alt={s.alt}
                loading="lazy"
                className="hidden dark:block mx-auto w-full h-auto max-h-[640px] aspect-[17/12] object-contain"
              />
            </div>

            {/* Seção sem subtítulo não deixa buraco: um <p> vazio ainda ocupa
                uma linha de altura e o espaçamento sai maior que nas outras. */}
            {s.sub && (
              <p className="text-base lg:text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto">
                {s.sub}
              </p>
            )}

            {/* Bloco extra da seção, quando existe. Fica DENTRO dela (mesma
                borda, mesmo glow) porque é continuação do mesmo assunto — uma
                seção nova ali quebraria o encadeamento e faria a página parecer
                mais longa do que é. */}
            {s.extra}
          </div>
        </section>
      ))}
    </>
  );
}

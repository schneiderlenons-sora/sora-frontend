'use client';

import { useTranslations } from 'next-intl';

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
  const SECOES = SECAO_IMG.map((s, i) => ({ ...s, ...txt[i] }));
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

            <p className="text-base lg:text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto">
              {s.sub}
            </p>
          </div>
        </section>
      ))}
    </>
  );
}

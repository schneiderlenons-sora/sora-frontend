'use client';

// Seções de destaque (título + imagem + subtítulo) logo após o Open Finance.
// Imagens em public/landing/ — versões separadas pra tema claro e escuro
// (as PNGs já vêm transparentes; renderizadas sem moldura/fundo).
const SECOES = [
  {
    eyebrow:  'Clareza total',
    titulo:   'A Sora detalha exatamente para onde seu dinheiro está indo',
    imgDark:  '/landing/para-onde-vai.png',
    imgLight: '/landing/para-onde-vai-light.png',
    alt:      'Painel da Sora detalhando os gastos por categoria',
    sub:      'E ainda te mostra onde dá pra economizar da melhor forma.',
  },
  {
    eyebrow:  'Em conjunto',
    titulo:   'Gestão Compartilhada',
    imgDark:  '/landing/gestao-compartilhada.png',
    imgLight: '/landing/gestao-compartilhada-light.png',
    alt:      'Gestão financeira compartilhada entre casal ou família',
    sub:      'Organize sua vida e suas finanças em casal ou família, cada um com seu próprio acesso.',
  },
] as const;

export default function Showcase() {
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

            {/* Imagem limpa, sem moldura — troca por tema via CSS */}
            <div className="mt-10 mb-8">
              <img
                src={s.imgLight}
                alt={s.alt}
                loading="lazy"
                className="block dark:hidden mx-auto w-full h-auto max-h-[640px] object-contain"
              />
              <img
                src={s.imgDark}
                alt={s.alt}
                loading="lazy"
                className="hidden dark:block mx-auto w-full h-auto max-h-[640px] object-contain"
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

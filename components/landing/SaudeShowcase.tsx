'use client';

import { useState } from 'react';

// Seção da aba Saúde (Sora Grow) — mesmo estilo do Showcase, mas com dois
// prints lado a lado (dashboard de nutrição + calculadora nutricional).
// Imagens em public/landing/. As <img> se escondem sozinhas se ainda não
// existirem (onError) — então a seção não fica com ícone de imagem quebrada
// enquanto os prints não forem enviados.
const IMAGENS = [
  { src: '/landing/saude-nutricao.png',    alt: 'Dashboard de nutrição da Sora com os macros do dia' },
  { src: '/landing/saude-calculadora.png', alt: 'Calculadora nutricional da Sora' },
];

export default function SaudeShowcase() {
  const [ocultas, setOcultas] = useState<Record<string, boolean>>({});

  return (
    <section className="relative py-24 lg:py-32 border-t border-zinc-200/50 dark:border-white/[0.04]">
      {/* Glow de fundo sutil (mesmo padrão das outras seções) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-20 dark:opacity-15"
          style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.18) 0%, transparent 60%)' }}
        />
      </div>

      <div className="relative max-w-5xl mx-auto px-5 sm:px-8 text-center">
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
          Corpo em dia
        </p>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-[-0.03em] max-w-3xl mx-auto">
          Sua saúde com a mesma clareza das suas finanças
        </h2>

        {/* Dois prints lado a lado (empilham no mobile) */}
        <div className="mt-10 mb-8 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 max-w-3xl mx-auto">
          {IMAGENS.filter(img => !ocultas[img.src]).map(img => (
            <div key={img.src}
                 className="rounded-2xl overflow-hidden ring-1 ring-zinc-200 dark:ring-white/10 shadow-xl shadow-black/5 dark:shadow-black/40 bg-white dark:bg-white/[0.03]">
              <img
                src={img.src}
                alt={img.alt}
                loading="lazy"
                onError={() => setOcultas(prev => ({ ...prev, [img.src]: true }))}
                className="block w-full h-auto object-contain"
              />
            </div>
          ))}
        </div>

        <p className="text-lg lg:text-xl text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto">
          Registre o que comeu e a Sora calcula proteínas, carboidratos e gorduras do seu dia
          na hora. Com uma calculadora nutricional completa pra você bater suas metas — do
          controle do bolso ao controle do prato, tudo num só lugar.
        </p>
      </div>
    </section>
  );
}

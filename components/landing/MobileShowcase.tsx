'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import IPhoneFrame from './IPhoneFrame';

// Seção "também no celular" — 2 mockups de iPhone lado a lado.
// Coloque os 2 prints (tela do celular, proporção ~9:19.5) em:
//   public/landing/celular/1.png  e  public/landing/celular/2.png
const PRINTS = [
  { id: 1, img: '/landing/celular/1.png', alt: 'App da Sora no celular — tela 1' },
  { id: 2, img: '/landing/celular/2.png', alt: 'App da Sora no celular — tela 2' },
];

export default function MobileShowcase() {
  const t = useTranslations('mobileShowcase');
  return (
    <section className="relative py-24 lg:py-32 border-t border-zinc-200/50 dark:border-white/[0.04] overflow-hidden">
      {/* glow de fundo (mesmo padrão das outras seções) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-20 dark:opacity-15"
             style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.18) 0%, transparent 60%)' }} />
      </div>

      <div className="relative max-w-5xl mx-auto px-5 sm:px-8 text-center">
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
          {t('eyebrow')}
        </p>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-[-0.03em] max-w-3xl mx-auto">
          {t('tituloL1')}<br className="hidden sm:block" /> {t('tituloL2')}
        </h2>

        <p className="mt-5 text-base lg:text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto">
          {t('sub')}
        </p>

        {/* ── 2 mockups lado a lado, levemente inclinados ── */}
        <div className="mt-14 mb-4 flex items-center justify-center">
          <div className="w-[46%] max-w-[230px] -rotate-[6deg] mr-[-5%] z-10 drop-shadow-2xl transition-transform duration-300 hover:scale-[1.03] hover:z-30">
            <IPhoneFrame>
              <PrintTela {...PRINTS[0]} />
            </IPhoneFrame>
          </div>
          <div className="w-[48%] max-w-[240px] rotate-[6deg] ml-[-5%] z-20 drop-shadow-2xl transition-transform duration-300 hover:scale-[1.03] hover:z-30">
            <IPhoneFrame>
              <PrintTela {...PRINTS[1]} />
            </IPhoneFrame>
          </div>
        </div>
      </div>
    </section>
  );
}

// Print dentro da moldura — com fallback elegante enquanto a imagem não existe.
function PrintTela({ img, alt }: { img: string; alt: string }) {
  const t = useTranslations('mobileShowcase');
  const [erro, setErro] = useState(false);
  if (erro) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4"
           style={{ background: 'linear-gradient(160deg, rgba(97,206,112,0.25) 0%, rgba(97,206,112,0.05) 60%, #0a0a0c 100%)' }}>
        <span className="w-9 h-9 rounded-full bg-[#61ce70]" />
        <p className="text-[11px] font-bold text-white/90">{t('printEmBreve')}</p>
      </div>
    );
  }
  return (
    <img
      src={img}
      alt={alt}
      onError={() => setErro(true)}
      loading="lazy"
      draggable={false}
      className="absolute inset-0 w-full h-full object-cover object-top"
    />
  );
}

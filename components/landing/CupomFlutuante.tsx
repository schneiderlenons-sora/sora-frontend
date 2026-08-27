'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Gift, Check, Copy, X } from 'lucide-react';

const BRAND = '#61ce70';
const CUPOM = 'SORA10';
const KEY = 'cupom-sora10-dismiss';

/** Seções de planos/preços — o card só aparece quando uma delas chega à tela.
 *  `#pricing` é a landing principal e a /oferta; `#ofertas`, a /kit. */
const ALVOS = '#pricing, #ofertas';

/** Só usado quando a página NÃO tem seção de preços (fallback). */
const ESPERA_MS = 7000;

// Card flutuante oferecendo 10% OFF (cupom SORA10). Fixo no rodapé, acompanha o
// rolamento; fecha no X (some pela sessão) e copia o cupom. Theme-aware: tema
// claro na landing principal/oferta e escuro na /kit (dark forçado) ou no dark.
export default function CupomFlutuante() {
  const t = useTranslations('cupom');
  const [visivel, setVisivel] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    // Não reaparece se o usuário já fechou nesta sessão.
    try { if (sessionStorage.getItem(KEY) === '1') return; } catch { /* noop */ }

    // ⚠️ O GATILHO É CHEGAR NOS PLANOS, não o tempo de página.
    //
    // Antes era "7s + rolou 500px", o que fazia o card cobrir a faixa de baixo
    // da tela no meio da leitura — e quem fecha, fecha pela sessão inteira: o
    // cupom morria antes de a pessoa ver um preço. Amarrado à seção de preços
    // ele chega no único momento em que um desconto significa alguma coisa.
    //
    // Aparece UMA vez e FICA. Sumir ao rolar de volta deixaria o card piscando
    // a cada vaivém — e o botão de copiar precisa continuar alcançável depois
    // que a pessoa desce pro checkout.
    const alvo = document.querySelector(ALVOS);

    // Página sem seção de preços (nenhuma hoje, mas nada garante amanhã) cai
    // no comportamento antigo em vez de nunca mostrar o cupom.
    if (!alvo || typeof IntersectionObserver === 'undefined') {
      const t = setTimeout(() => setVisivel(true), ESPERA_MS);
      return () => clearTimeout(t);
    }

    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisivel(true); io.disconnect(); } },
      // rootMargin negativo embaixo: dispara quando a seção realmente entrou
      // na tela, não quando encostou o primeiro pixel na dobra.
      { threshold: 0, rootMargin: '0px 0px -15% 0px' },
    );
    io.observe(alvo);
    return () => io.disconnect();
  }, []);

  const fechar = () => {
    setVisivel(false);
    try { sessionStorage.setItem(KEY, '1'); } catch { /* noop */ }
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(CUPOM);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch { /* clipboard indisponível */ }
  };

  if (!visivel) return null;

  return (
    <div className="fixed z-[60] bottom-4 inset-x-4 sm:inset-x-auto sm:right-5 sm:w-[22rem] animate-[slide-up_400ms_ease-out_both]"
         style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="relative rounded-2xl border p-4 pr-10 backdrop-blur-xl
                      bg-gradient-to-b from-white to-emerald-50 border-[#61ce70]/40
                      shadow-[0_20px_60px_-15px_rgba(0,0,0,0.22)]
                      dark:from-[#0f1a10] dark:to-[#0a0a0a] dark:border-[#61ce70]/55
                      dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]">
        {/* Fechar */}
        <button onClick={fechar} aria-label={t('fechar')}
                className="absolute top-2 right-2 w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                           text-zinc-400 hover:text-zinc-700 hover:bg-black/5
                           dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10">
          <X size={16} />
        </button>

        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${BRAND}22` }}>
            <Gift size={20} style={{ color: BRAND }} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-snug text-zinc-900 dark:text-white">
              {t('ganhouInicio')} <span style={{ color: BRAND }}>{t('ganhouDesconto')}</span> 🎉
            </p>
            <p className="text-xs mt-0.5 leading-snug text-zinc-500 dark:text-white/60">{t('aproveite')}</p>
          </div>
        </div>

        {/* Cupom + copiar */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed py-2.5 font-black tracking-[0.2em] text-zinc-900 dark:text-white"
               style={{ borderColor: `${BRAND}66`, background: `${BRAND}12` }}>
            {CUPOM}
          </div>
          <button onClick={copiar}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-black text-sm active:scale-[0.97] transition min-w-[7rem]"
                  style={{ background: `linear-gradient(135deg, ${BRAND}, #b6f54f)` }}>
            {copiado ? <><Check size={15} /> {t('copiado')}</> : <><Copy size={15} /> {t('copiar')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

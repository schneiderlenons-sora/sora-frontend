'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

// CTA intermediário da landing — sempre leva pra seção de planos (#pricing).
// `frase` é texto literal (usado em /financas, /oferta). `fraseKey` resolve a
// frase pelo catálogo (namespace `cta`) via o provider de idioma mais PRÓXIMO —
// é o que faz o /es ficar em espanhol sem depender do layout raiz (que não
// re-renderiza na navegação client-side). Ver [[project-i18n-fase1-landing]].
export default function CtaPlanos({ frase, fraseKey, sub }: { frase?: string; fraseKey?: string; sub?: string }) {
  const t = useTranslations('cta');
  const texto = fraseKey ? t(fraseKey) : (frase ?? '');
  return (
    <section className="relative py-14 lg:py-20 flex flex-col items-center text-center px-5">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] opacity-20 dark:opacity-15"
          style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.25) 0%, transparent 65%)' }} />
      </div>
      {sub && (
        <p className="relative text-lg sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white max-w-xl mb-5 leading-snug">
          {sub}
        </p>
      )}
      <Link href="#pricing"
        className="relative group inline-flex items-center gap-2 px-7 py-4 text-base font-bold text-white rounded-2xl shadow-[0_10px_40px_-8px_rgba(97,206,112,0.6)] hover:-translate-y-0.5 hover:shadow-[0_14px_48px_-8px_rgba(97,206,112,0.75)] active:scale-95 transition-all"
        style={{ background: 'linear-gradient(135deg, #61ce70 0%, #4DAE61 100%)' }}>
        {texto}
        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
      </Link>
    </section>
  );
}

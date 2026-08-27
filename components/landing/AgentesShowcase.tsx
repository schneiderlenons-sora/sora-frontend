'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Os agentes da Sora — carrossel de cards (arte + nome + o que ele faz).
//
// ⚠️ CARROSSEL NATIVO, sem biblioteca: `overflow-x-auto` + `scroll-snap`. Numa
// landing que precisa ser rápida no mobile, um slider em JS custaria bundle e
// main thread pra fazer o que o navegador já faz — com inércia de verdade e
// respeitando a acessibilidade do sistema.
//
// A fonte é o MESMO catálogo do painel (`lib/agentes.ts`): agente novo aparece
// aqui sozinho, sem ninguém lembrar de atualizar a landing.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { AGENTES } from '@/lib/agentes';

export default function AgentesShowcase() {
  const t = useTranslations('agentes');

  // ⚠️ AS ARTES FORA DA TELA PRECISAM SER BUSCADAS ANTES DO DEDO CHEGAR NELAS.
  //
  // `next/image` é lazy por padrão, e lazy olha a VIEWPORT: num carrossel
  // horizontal os cards da direita estão fora dela, então o download só
  // começava quando o card já estava entrando na tela — o usuário arrastava e
  // via o retângulo cinza por um instante antes da arte aparecer.
  //
  // A correção NÃO é `priority`/`eager` fixo: são 8 PNGs e isso os colocaria
  // na fila do carregamento inicial, competindo com o LCP de uma seção que
  // está lá embaixo na página (regra de performance do CLAUDE.md).
  //
  // Em vez disso, o observer avisa quando a seção se APROXIMA (600px antes) e
  // só então as imagens viram `eager`: no load da página nada é baixado, e
  // quando a pessoa chega para arrastar as 8 já estão em cache.
  const listaRef = useRef<HTMLUListElement>(null);
  const [perto, setPerto] = useState(false);

  useEffect(() => {
    const el = listaRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setPerto(true); return; }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setPerto(true); io.disconnect(); } },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="relative py-24 lg:py-32 border-t border-zinc-200/50 dark:border-white/[0.04]">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-20 dark:opacity-15"
          style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.18) 0%, transparent 60%)' }}
        />
      </div>

      <div className="relative">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 text-center">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
            {t('eyebrow')}
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-[-0.03em] max-w-3xl mx-auto">
            {t('titulo')}
          </h2>
          <p className="mt-5 text-base lg:text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto">
            {t('desc')}
          </p>
        </div>

        {/* ⚠️ SANGRA ATÉ A BORDA no mobile (`-mx` + padding interno): o card
            cortado na direita é o que diz "tem mais, arrasta". Um carrossel que
            termina certinho na margem parece uma lista completa e ninguém rola.
            `scrollbar-none` esconde a barra sem tirar o scroll. */}
        <ul
          ref={listaRef}
          className="mt-12 flex gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory
                     px-5 sm:px-8 lg:px-0 lg:justify-start lg:max-w-6xl lg:mx-auto
                     [scroll-padding-inline:1.25rem]"
          aria-label={t('titulo')}
        >
          {AGENTES.map((a) => (
            <li
              key={a.id}
              className="snap-start shrink-0 w-[230px] sm:w-[260px]"
            >
              <figure className="h-full">
                <div className="relative overflow-hidden rounded-2xl aspect-square bg-zinc-100 dark:bg-white/[0.03]">
                  {/* ⚠️ `next/image` E NÃO `<img>`, e aqui a diferença é grande:
                      os 8 PNGs de agente somam 4,8 MB (640×640 cada) e são
                      exibidos a 230–260px. Servidos crus, seriam o item mais
                      pesado da landing inteira. O otimizador entrega WebP/AVIF
                      no tamanho real do slot e já vem com lazy nativo.
                      `sizes` é obrigatório — sem ele o Next assume 100vw e
                      escolhe a maior variante, desfazendo o ganho. */}
                  <Image
                    src={`/agentes/${a.id}.png`}
                    alt={t('altAgente', { nome: a.nome })}
                    width={520}
                    height={520}
                    sizes="(max-width: 640px) 230px, 260px"
                    loading={perto ? 'eager' : 'lazy'}
                    className="w-full h-full object-cover"
                  />
                  {/* Fio na cor do agente: liga a arte ao mesmo código de cor
                      que o painel usa, sem precisar escrever o nome da cor. */}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-1"
                    style={{ background: a.cor }}
                  />
                </div>
                <figcaption className="mt-4">
                  <p className="text-xl font-bold tracking-[-0.02em]">{a.nome}</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-white/55 leading-snug">
                    {a.tagline}
                  </p>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

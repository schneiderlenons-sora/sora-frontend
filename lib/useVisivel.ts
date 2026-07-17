'use client';

import { useCallback, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// "Já chegou perto da tela?" — pra adiar trabalho de conteúdo abaixo da dobra.
//
// ⚠️ LIÇÃO APRENDIDA: NÃO observe antes do conteúdo principal renderizar.
// Enquanto a página é só skeleton ela é CURTA e tudo cabe na tela — o observer
// dispara na hora, com razão (naquele instante o card estava mesmo visível).
// Aí os dados chegam, os cards crescem e empurram o bloco pra 1200px, mas o
// gate já abriu. Medido: gráfico a 1227px com limite de 940px, carregado assim
// mesmo. Por isso `ativo`: só começa a observar quando quem chama diz que a
// tela já assentou (tipicamente `!!data` da chamada principal).
//
// Usa callback ref (e não useRef + useEffect) pra observar no instante em que o
// nó entra no DOM — com useEffect, se o elemento ainda não montou, ref.current
// vem null e não há re-execução pra corrigir.
// ─────────────────────────────────────────────────────────────────────────────
export function useVisivel<T extends HTMLElement = HTMLDivElement>(
  ativo = true,
  margem = '200px',
) {
  const [visivel, setVisivel] = useState(false);
  const obs = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    obs.current?.disconnect();
    if (!node || visivel) return;
    // Sem suporte a IntersectionObserver: não esconde conteúdo de ninguém.
    if (typeof IntersectionObserver === 'undefined') { setVisivel(true); return; }
    // Ainda não assentou: não observa agora — este callback roda de novo quando
    // `ativo` virar true (o `ref` muda de identidade e o React reanexa).
    if (!ativo) return;

    obs.current = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) { setVisivel(true); obs.current?.disconnect(); } },
      { rootMargin: margem },
    );
    obs.current.observe(node);
  }, [ativo, visivel, margem]);

  return { ref, visivel };
}

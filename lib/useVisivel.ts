'use client';

import { useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// "Já chegou perto da tela?" — pra adiar trabalho de conteúdo abaixo da dobra.
//
// Por que existe: no dashboard, os cards do Grow disparavam 4 chamadas de API
// no MESMO instante da /api/dashboard. Medido: /grow/agenda/feed e
// /grow/habitos levam ~1,5s cada e alimentam cards que nem estão visíveis —
// mas competiam por banda e CPU justamente na janela do LCP, que depende da
// /api/dashboard. Adiar até o card se aproximar da viewport libera a chamada
// que importa.
//
// `margem` dispara ANTES de entrar na tela, pra o dado já estar chegando quando
// o usuário rolar. Uma vez visível, nunca volta a false (não faz sentido
// "descarregar" o card).
// ─────────────────────────────────────────────────────────────────────────────
export function useVisivel<T extends HTMLElement = HTMLDivElement>(margem = '300px') {
  const ref = useRef<T>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (visivel) return;
    const el = ref.current;
    // Sem suporte a IntersectionObserver (ou sem nó): não esconde conteúdo de
    // ninguém — assume visível e segue o fluxo antigo.
    if (!el || typeof IntersectionObserver === 'undefined') { setVisivel(true); return; }

    const obs = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) { setVisivel(true); obs.disconnect(); } },
      { rootMargin: margem },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visivel, margem]);

  return { ref, visivel };
}

'use client';

import { useEffect } from 'react';

// Trava o /chat no TEMA CLARO, independente do tema escolhido no forsora.com
// (next-themes: 'black' -> classe .dark no <html>). O funil embute seções da
// landing com variantes dark:, que ficavam bugadas sobre o fundo branco forçado
// quando o site estava no tema black. Aqui removemos .dark enquanto o /chat está
// montado e restauramos o tema salvo ao sair — SEM tocar no estado do next-themes.
export default function ForceLightTheme() {
  useEffect(() => {
    const el = document.documentElement;
    const forcarClaro = () => {
      if (el.classList.contains('dark')) el.classList.remove('dark');
      if (!el.classList.contains('light')) el.classList.add('light');
    };
    forcarClaro();

    // next-themes pode reaplicar .dark após a hidratação → observamos e removemos.
    const obs = new MutationObserver(forcarClaro);
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });

    return () => {
      obs.disconnect();
      // Ao sair do /chat, restaura o tema salvo (black -> .dark) pra não deixar o
      // resto do site claro sem querer.
      try {
        if (localStorage.getItem('sora-theme') === 'black') {
          el.classList.remove('light');
          el.classList.add('dark');
        }
      } catch { /* noop */ }
    };
  }, []);

  return null;
}

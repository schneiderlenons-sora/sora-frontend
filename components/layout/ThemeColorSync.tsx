'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { NAV_CORES } from '@/lib/nav-cores';

// =============================================================================
// Mantém o `<meta name="theme-color">` igual à cor da barra inferior.
//
// ⚠️ POR QUE ISTO NÃO PODE SER SÓ O `themeColor` DO `viewport`.
//
// No PWA do iOS é o `theme-color` que pinta a faixa do home-indicator, embaixo
// da barra. A forma declarativa aceita variantes por `prefers-color-scheme` —
// mas isso segue o tema do SISTEMA, e aqui o tema é ESCOLHA DO USUÁRIO
// (`sora-theme`, claro ou black). Quem usa o app no claro com o celular no
// escuro receberia uma faixa preta embaixo de uma barra branca: exatamente a
// divergência que este arquivo existe pra matar, entrando por outra porta.
//
// Então a meta é reescrita a partir do tema REAL do app.
//
// ⚠️ Sem elemento próprio no DOM (devolve `null`): só um efeito. Um wrapper
// aqui viraria um nó a mais em volta do app inteiro — e um nó com estilo em
// volta de tudo é o tipo de coisa que quebra `position: fixed` sem avisar.
// =============================================================================
export default function ThemeColorSync() {
  const { theme } = useTheme();

  useEffect(() => {
    const cor = NAV_CORES[theme === 'black' ? 'black' : 'light'].superficie;
    // Pode existir mais de uma meta (a do `viewport` + variantes). O navegador
    // usa a PRIMEIRA que casa, então todas precisam ir pra mesma cor — deixar
    // uma pra trás traria o degrau de volta em algum aparelho.
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (metas.length === 0) {
      const m = document.createElement('meta');
      m.name = 'theme-color';
      m.content = cor;
      document.head.appendChild(m);
      return;
    }
    metas.forEach((m) => {
      // A variante com `media` seguiria o sistema; tirando o atributo ela passa
      // a valer sempre, que é o que faz a cor acompanhar o tema DO APP.
      m.removeAttribute('media');
      m.content = cor;
    });
  }, [theme]);

  return null;
}

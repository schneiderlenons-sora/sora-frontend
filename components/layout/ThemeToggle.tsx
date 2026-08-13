'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

// =============================================================================
// Alternador de tema — círculo fixo no canto superior direito, em TODAS as
// abas (mobile e desktop).
//
// Antes vivia como uma LINHA DE BOTÃO dentro da barra lateral (Sidebar) — só
// alcançável abrindo o drawer no mobile. Saiu de lá pra abrir espaço pros
// atalhos de Agentes e Drive (ver Sidebar.tsx) e pra ficar acessível em
// qualquer tela sem precisar abrir nada.
//
// Só DOIS temas hoje: claro e black. O "escuro" (dark) foi descontinuado —
// quem tinha 'dark' salvo migra pra 'black' automaticamente. Esse efeito
// morava no Sidebar; mudou pra cá porque agora é este componente quem é dono
// do controle de tema (o Sidebar só LÊ o tema pra colorir o fundo dele).
//
// O ícone mostra o DESTINO do clique, não o estado atual — sol = "vira dia",
// lua = "vira noite". Mesma convenção que já existia.
// =============================================================================
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (mounted && theme === 'dark') setTheme('black'); }, [mounted, theme, setTheme]);

  // Placeholder do MESMO tamanho/posição antes de montar — evita hydration
  // mismatch (o tema real só existe no cliente) sem deixar buraco na tela.
  if (!mounted) {
    return (
      <div
        aria-hidden
        className="fixed z-30 w-11 h-11 rounded-full bg-card border border-border/60"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)', right: '1rem' }}
      />
    );
  }

  const efetivo: 'light' | 'black' = theme === 'black' ? 'black' : 'light';
  const proximo = efetivo === 'light' ? 'black' : 'light';
  const proxLabel = efetivo === 'light' ? 'Ativar tema black' : 'Ativar tema claro';

  return (
    <button
      onClick={() => setTheme(proximo)}
      aria-label={proxLabel}
      title={proxLabel}
      // w-11 h-11 (44px) = touch target mínimo, mesmo o círculo lendo como
      // pequeno perto do resto da UI. safe-area-inset-top evita notch/Dynamic
      // Island; z-30 fica acima do conteúdo normal mas abaixo de modais/drawer.
      className="group fixed z-30 w-11 h-11 rounded-full bg-card border border-border/60 shadow-md
                 flex items-center justify-center overflow-hidden
                 transition-all duration-300 hover:scale-105 active:scale-95
                 hover:border-primary/40 hover:shadow-glow-sm
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)', right: '1rem' }}
    >
      {/* Sol — visível quando o tema é BLACK (clicar vira dia) */}
      <Sun
        size={17}
        strokeWidth={2}
        className={`absolute text-amber-500 transition-all duration-300 ${
          efetivo === 'black' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'
        }`}
      />
      {/* Lua — visível quando o tema é CLARO (clicar vira noite) */}
      <Moon
        size={17}
        strokeWidth={2}
        className={`absolute text-indigo-500 transition-all duration-300 ${
          efetivo === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'
        }`}
      />

      {/* Halo decorativo */}
      <span
        aria-hidden
        className={`absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${
          efetivo === 'light'
            ? 'bg-gradient-to-br from-indigo-500/15 to-purple-500/10'
            : 'bg-gradient-to-br from-amber-500/15 to-orange-500/10'
        }`}
      />
    </button>
  );
}

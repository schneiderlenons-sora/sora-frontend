'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Sparkles } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        aria-hidden
        className="hidden md:block fixed bottom-6 left-6 z-40 w-12 h-12 rounded-2xl bg-card border border-border/60"
      />
    );
  }

  const efetivo: 'light' | 'dark' | 'black' =
    theme === 'black' ? 'black'
    : theme === 'system' ? (resolvedTheme === 'dark' ? 'dark' : 'light')
    : theme === 'dark' ? 'dark'
    : 'light';

  function ciclar() {
    const proximo = efetivo === 'light' ? 'dark' : efetivo === 'dark' ? 'black' : 'light';
    setTheme(proximo);
  }
  const proxLabel = efetivo === 'light' ? 'Ativar tema escuro' : efetivo === 'dark' ? 'Ativar tema black' : 'Ativar tema claro';

  return (
    <button
      onClick={ciclar}
      aria-label={proxLabel}
      title={proxLabel}
      className="group hidden md:flex fixed bottom-6 left-6 z-40 w-12 h-12 rounded-2xl bg-card border border-border/60 shadow-lg
                 items-center justify-center overflow-hidden
                 transition-all duration-300 hover:scale-105 active:scale-95
                 hover:border-primary/40 hover:shadow-glow-sm"
    >
      {/* Sol (visível em DARK ou BLACK — clica pra ir pro próximo, mas o desenho mostra qual irá ativar) */}
      <Sun
        size={18}
        strokeWidth={2}
        className={`absolute text-amber-500 transition-all duration-300 ${
          efetivo === 'black' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'
        }`}
      />
      {/* Lua (visível em LIGHT — próximo é dark) */}
      <Moon
        size={18}
        strokeWidth={2}
        className={`absolute text-indigo-500 transition-all duration-300 ${
          efetivo === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'
        }`}
      />
      {/* Sparkles (visível em DARK — próximo é black) */}
      <Sparkles
        size={18}
        strokeWidth={2}
        className={`absolute text-violet-400 transition-all duration-300 ${
          efetivo === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-45 scale-50'
        }`}
      />

      {/* Halo decorativo */}
      <span
        aria-hidden
        className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${
          efetivo === 'light'
            ? 'bg-gradient-to-br from-indigo-500/15 to-purple-500/10'
            : efetivo === 'dark'
              ? 'bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10'
              : 'bg-gradient-to-br from-amber-500/15 to-orange-500/10'
        }`}
      />

      {/* Indicador dos 3 temas embaixo */}
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 pointer-events-none">
        {(['light','dark','black'] as const).map(t => (
          <span key={t} className={`block w-1 h-1 rounded-full transition-all ${
            efetivo === t ? 'bg-foreground opacity-90' : 'bg-foreground opacity-20'
          }`} />
        ))}
      </span>
    </button>
  );
}

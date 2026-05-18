'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

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

  const isDark = (resolvedTheme || theme) === 'dark';

  // Esconde no mobile (sidebar já tem botão de tema próprio)
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
      className="group hidden md:flex fixed bottom-6 left-6 z-40 w-12 h-12 rounded-2xl bg-card border border-border/60 shadow-lg
                 items-center justify-center overflow-hidden
                 transition-all duration-300 hover:scale-105 active:scale-95
                 hover:border-primary/40 hover:shadow-glow-sm"
    >
      {/* Sol — visível no dark, ao trocar volta para claro */}
      <Sun
        size={18}
        strokeWidth={2}
        className={`absolute text-amber-500 transition-all duration-300 ${
          isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'
        }`}
      />
      {/* Lua — visível no light, ao trocar volta para escuro */}
      <Moon
        size={18}
        strokeWidth={2}
        className={`absolute text-indigo-500 transition-all duration-300 ${
          isDark ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
        }`}
      />

      {/* Halo decorativo no hover */}
      <span
        aria-hidden
        className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${
          isDark
            ? 'bg-gradient-to-br from-amber-500/15 to-orange-500/10'
            : 'bg-gradient-to-br from-indigo-500/15 to-purple-500/10'
        }`}
      />
    </button>
  );
}

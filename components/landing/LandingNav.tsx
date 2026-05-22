'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { Menu, X, Moon, Sun, ArrowRight } from 'lucide-react';

const LINKS = [
  { href: '#solucao',    label: 'Solução'  },
  { href: '#features',   label: 'Recursos' },
  { href: '#demo',       label: 'Demo'     },
  { href: '#pricing',    label: 'Planos'   },
  { href: '#faq',        label: 'Dúvidas'  },
];

export default function LandingNav() {
  const { user } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen]       = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <>
      {/* Spacer pra altura do nav */}
      <div aria-hidden className="h-16 lg:h-20" />

      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'backdrop-blur-xl bg-white/70 dark:bg-black/40 border-b border-zinc-200/60 dark:border-white/[0.06]'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <nav className="max-w-7xl mx-auto px-5 sm:px-8 h-16 lg:h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <img src="/sora-icon.png" alt="Sora"
                 width={32} height={32}
                 className="w-8 h-8 rounded-lg shadow-sm group-hover:rotate-3 transition-transform" />
            <span className="font-bold text-lg tracking-tight">Sora</span>
          </Link>

          {/* Links desktop */}
          <ul className="hidden lg:flex items-center gap-1">
            {LINKS.map(l => (
              <li key={l.href}>
                <a href={l.href}
                   className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-white/70 hover:text-zinc-950 dark:hover:text-white transition-colors rounded-lg">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Ações */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label="Alternar tema"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-600 dark:text-white/70 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              {mounted && (isDark ? <Sun size={16} /> : <Moon size={16} />)}
            </button>

            {/* Login link */}
            {user ? (
              <Link href="/dashboard"
                    className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg text-zinc-950 dark:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors">
                Meu painel <ArrowRight size={13} />
              </Link>
            ) : (
              <Link href="/login"
                    className="hidden sm:inline-flex items-center px-3.5 py-2 text-sm font-semibold rounded-lg text-zinc-700 dark:text-white/80 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors">
                Entrar
              </Link>
            )}

            {/* Primary CTA */}
            <Link href={user ? '/dashboard' : '/signup'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white shadow-[0_2px_10px_-2px_rgba(97,206,112,0.5)] rounded-lg transition-all hover:shadow-[0_4px_20px_-4px_rgba(97,206,112,0.6)] hover:-translate-y-[1px]"
                  style={{ background: 'linear-gradient(135deg, #61ce70 0%, #4DAE61 100%)' }}>
              {user ? 'Abrir Sora' : 'Começar'} <ArrowRight size={13} />
            </Link>

            {/* Mobile menu */}
            <button
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-zinc-700 dark:text-white/80"
            >
              <Menu size={18} />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile menu overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)}>
          <div
            className="absolute top-0 right-0 bottom-0 w-[78%] max-w-xs bg-white dark:bg-zinc-950 p-6 shadow-2xl border-l border-zinc-200 dark:border-white/[0.06] animate-slide-in-right"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-10">
              <span className="font-bold text-lg">Sora</span>
              <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-white/[0.06]">
                <X size={18} />
              </button>
            </div>
            <ul className="space-y-1">
              {LINKS.map(l => (
                <li key={l.href}>
                  <a href={l.href}
                     onClick={() => setOpen(false)}
                     className="block px-3 py-3 text-base font-semibold text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06]">
                    {l.label}
                  </a>
                </li>
              ))}
              <li className="pt-4 mt-4 border-t border-zinc-200 dark:border-white/[0.06]">
                <Link href={user ? '/dashboard' : '/signup'}
                      onClick={() => setOpen(false)}
                      className="block w-full text-center px-4 py-3 text-sm font-bold text-white rounded-xl shadow-md"
                      style={{ background: 'linear-gradient(135deg, #61ce70 0%, #4DAE61 100%)' }}>
                  {user ? 'Abrir Sora' : 'Começar'}
                </Link>
              </li>
              {!user && (
                <li>
                  <Link href="/login"
                        onClick={() => setOpen(false)}
                        className="block w-full text-center px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-white/80">
                    Entrar
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

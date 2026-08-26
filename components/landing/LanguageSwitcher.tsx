'use client';

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { Check, Globe } from 'lucide-react';

// Botão de troca de idioma da landing. Grava o cookie `sora-locale` (trava a
// escolha e desliga o auto-redirect do middleware) e navega pra árvore certa:
// PT vive na raiz (/), ES em /es. Só faz sentido na landing pública.
const IDIOMAS = [
  { locale: 'pt', bandeira: '🇧🇷', nome: 'Português', destino: '/' },
  { locale: 'es', bandeira: '🇲🇽', nome: 'Español',    destino: '/es' },
] as const;

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const atual = IDIOMAS.find(i => i.locale === locale) ?? IDIOMAS[0];

  function trocar(destino: string, loc: string) {
    document.cookie = `sora-locale=${loc}; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
    // Navegação com carga COMPLETA (não router.push): o layout raiz não
    // re-renderiza numa navegação client-side, então o idioma poderia não
    // aplicar. window.location garante a árvore certa (root p/ PT, /es layout
    // p/ ES) desde o servidor.
    if (pathname !== destino) window.location.assign(destino);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Trocar idioma / Cambiar idioma"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-9 px-2 sm:px-2.5 rounded-lg text-sm font-semibold text-zinc-700 dark:text-white/80 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
      >
        {/* No celular só a bandeira: o globo é redundante ao lado dela e os
            ~20px que ele ocupa eram parte do que fazia o cabeçalho estourar. */}
        <Globe size={15} className="hidden sm:block" />
        <span className="text-base leading-none">{atual.bandeira}</span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-1.5 w-44 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] shadow-xl z-[70]"
        >
          {IDIOMAS.map(i => (
            <li key={i.locale}>
              <button
                role="option"
                aria-selected={i.locale === locale}
                onClick={() => trocar(i.destino, i.locale)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-left text-zinc-800 dark:text-white/90 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
              >
                <span className="text-base leading-none">{i.bandeira}</span>
                <span className="flex-1">{i.nome}</span>
                {i.locale === locale && <Check size={14} className="text-emerald-500" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

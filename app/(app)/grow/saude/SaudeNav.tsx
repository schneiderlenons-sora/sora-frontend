'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Dumbbell, Apple,
  CalendarHeart, Pill, Ruler,
} from 'lucide-react';

const TABS = [
  { href: '/grow/saude/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/grow/saude/treinos',   label: 'Treinos',    icon: Dumbbell },
  { href: '/grow/saude/nutricao',  label: 'Nutrição',   icon: Apple },
  { href: '/grow/saude/consultas', label: 'Consultas',  icon: CalendarHeart },
  { href: '/grow/saude/remedios',  label: 'Remédios',   icon: Pill },
  { href: '/grow/saude/corpo',     label: 'Corpo',      icon: Ruler },
];

// Sub-nav das seções de Saúde — abaixo do hero, NÃO sticky (estilo das abas
// de Hábitos). Renderizada por cada página logo após o card de título.
export default function SaudeNav() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
      {TABS.map(({ href, label, icon: Icon }) => {
        const ativo = pathname === href || (pathname === '/grow/saude' && href === '/grow/saude/dashboard');
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              ativo
                ? 'bg-primary text-white shadow-sm shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Icon size={12} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

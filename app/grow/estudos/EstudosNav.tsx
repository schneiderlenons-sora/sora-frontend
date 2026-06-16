'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, GraduationCap, BookOpen, Trophy } from 'lucide-react';

const TABS = [
  { href: '/grow/estudos/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/grow/estudos/faculdade', label: 'Faculdade',  icon: GraduationCap },
  { href: '/grow/estudos/cursos',    label: 'Cursos',     icon: BookOpen },
  { href: '/grow/estudos/concursos', label: 'Concursos',  icon: Trophy },
];

// Sub-nav das seções de Estudos — abaixo do hero, NÃO sticky (estilo das abas
// de Hábitos). Renderizada por cada página logo após o card de título.
export default function EstudosNav() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
      {TABS.map(({ href, label, icon: Icon }) => {
        const ativo = pathname === href || (pathname === '/grow/estudos' && href === '/grow/estudos/dashboard');
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

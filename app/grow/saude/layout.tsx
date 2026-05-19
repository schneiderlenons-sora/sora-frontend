'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Dumbbell, Apple, ClipboardCheck,
  CalendarHeart, Pill, Ruler,
} from 'lucide-react';

const TABS = [
  { href: '/grow/saude/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/grow/saude/treinos',   label: 'Treinos',    icon: Dumbbell },
  { href: '/grow/saude/nutricao',  label: 'Nutrição',   icon: Apple },
  { href: '/grow/saude/registro',  label: 'Registro',   icon: ClipboardCheck },
  { href: '/grow/saude/consultas', label: 'Consultas',  icon: CalendarHeart },
  { href: '/grow/saude/remedios',  label: 'Remédios',   icon: Pill },
  { href: '/grow/saude/corpo',     label: 'Corpo',      icon: Ruler },
];

export default function SaudeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false });

  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLAnchorElement>(`a[data-active="true"]`);
    if (el && navRef.current) {
      const navBox = navRef.current.getBoundingClientRect();
      const elBox  = el.getBoundingClientRect();
      setIndicator({
        left: elBox.left - navBox.left + navRef.current.scrollLeft,
        width: elBox.width,
        visible: true,
      });
      // Scroll to keep active tab visible
      const scrollLeft = el.offsetLeft - navRef.current.offsetWidth / 2 + el.offsetWidth / 2;
      navRef.current.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  }, [pathname]);

  return (
    <div className="-mx-4 sm:-mx-6 -mt-[calc(env(safe-area-inset-top,0px)+4rem)] md:-mt-6 mb-2">
      {/* Sub-tabs nav — sticky, glassmorphism */}
      <div
        className="sticky z-30 backdrop-blur-xl border-b border-border/40"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px))',
          background: 'color-mix(in srgb, hsl(var(--background)) 75%, transparent)',
        }}
      >
        <div
          ref={navRef}
          className="relative flex items-center gap-1 px-4 sm:px-6 py-3 overflow-x-auto scrollbar-none"
        >
          {TABS.map(({ href, label, icon: Icon }) => {
            const ativo = pathname === href || (pathname === '/grow/saude' && href === '/grow/saude/dashboard');
            return (
              <Link
                key={href}
                href={href}
                data-active={ativo}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  ativo
                    ? 'text-violet-600 dark:text-violet-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={13} />
                {label}
              </Link>
            );
          })}
          {/* Indicator animado embaixo */}
          <span
            className="absolute bottom-0 h-[2px] bg-violet-600 dark:bg-violet-400 rounded-full transition-all duration-300 ease-out pointer-events-none"
            style={{
              left:  indicator.left,
              width: indicator.width,
              opacity: indicator.visible ? 1 : 0,
            }}
          />
        </div>
      </div>

      <div className="px-4 sm:px-6 pt-6">
        {children}
      </div>
    </div>
  );
}

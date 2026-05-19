'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, BarChart2, Landmark, CreditCard,
  Tag, Target, TrendingUp, Settings, LogOut, Menu, X, Users, ArrowLeftRight,
  Sun, Moon, Flag, Download, Receipt,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { usePwa } from '@/components/pwa/InstallPwa';

const NAV = [
  { href: '/dashboard',          label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/transacoes',         label: 'Transações',        icon: ArrowLeftRight },
  { href: '/relatorios',         label: 'Relatórios',        icon: BarChart2 },
  { href: '/contas-bancarias',   label: 'Contas',            icon: Landmark },
  { href: '/cartao-de-credito',  label: 'Cartão de crédito', icon: CreditCard },
  { href: '/categorias',         label: 'Categorias',        icon: Tag },
  { href: '/limites-de-gastos',  label: 'Limites',           icon: Target },
  { href: '/metas',              label: 'Metas',             icon: Flag },
  { href: '/dividas',            label: 'Dívidas',           icon: Receipt },
  { href: '/comunidade',         label: 'Grupos',            icon: Users },
  { href: '/investimentos',      label: 'Investimentos',     icon: TrendingUp, black: true },
  { href: '/configuracoes',      label: 'Configurações',     icon: Settings },
];

// Plano badge — fundo branco translúcido sobre o verde
const PLANO_BADGE: Record<string, string> = {
  basico:  'bg-white text-emerald-700',
  premium: 'bg-white text-blue-700',
  black:   'bg-zinc-900 text-white',
  inativo: 'bg-white text-emerald-800',
};

// Gradientes verdes — light e dark mode
const SIDEBAR_BG_LIGHT = 'linear-gradient(180deg, #5BC571 0%, #4DAE61 100%)';
const SIDEBAR_BG_DARK  = 'linear-gradient(180deg, #4DAE61 0%, #3C9450 100%)';

export default function Sidebar() {
  const pathname       = usePathname();
  const { perfil, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted && (resolvedTheme === 'dark' || theme === 'dark');
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');
  const { abrir: abrirInstall } = usePwa();

  const plano  = perfil?.plano || 'inativo';
  const isBlack = plano === 'black';

  const conteudo = (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10">
        <img src="/sora-logo-green.png" alt="Sora" className="h-10 w-auto object-contain" />
        <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${PLANO_BADGE[plano]}`}>
          {plano.charAt(0).toUpperCase() + plano.slice(1)}
        </span>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, black: soBlack }) => {
          const bloqueado = soBlack && !isBlack;
          const ativo     = pathname === href;

          return (
            <Link
              key={href}
              href={bloqueado ? '#' : href}
              onClick={() => setOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                ${ativo
                  ? 'bg-white/20 text-white font-semibold backdrop-blur-sm shadow-sm'
                  : bloqueado
                    ? 'text-white/40 cursor-not-allowed'
                    : 'text-white/75 hover:text-white hover:bg-white/15'
                }
              `}
              title={bloqueado ? 'Disponível no plano Black' : label}
            >
              <Icon size={18} />
              <span>{label}</span>
              {soBlack && !isBlack && (
                <span className="ml-auto text-[10px] bg-zinc-900 text-white px-1.5 py-0.5 rounded font-semibold">
                  Black
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Rodapé — toggle de tema, instalar, usuário e logout */}
      <div className="px-3 py-4 border-t border-white/20">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-white/75 hover:text-white hover:bg-white/15 transition-all mb-1"
          aria-label="Alternar tema"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
          <span>{isDark ? 'Tema claro' : 'Tema escuro'}</span>
        </button>

        <button
          onClick={() => { setOpen(false); abrirInstall(); }}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-white/75 hover:text-white hover:bg-white/15 transition-all mb-1"
          aria-label="Instalar app"
        >
          <Download size={18} />
          <span>Instalar app</span>
        </button>

        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/15 backdrop-blur-sm mb-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-sm">
            {perfil?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{perfil?.name || 'Usuário'}</p>
            <p className="text-xs text-white/70 truncate">{perfil?.phone || ''}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-white/75 hover:text-white hover:bg-white/15 transition-all"
        >
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );

  const sidebarStyle = { background: isDark ? SIDEBAR_BG_DARK : SIDEBAR_BG_LIGHT };

  return (
    <>
      {/* Desktop */}
      <aside
        className="hidden md:flex flex-col w-64 h-screen sticky top-0 shadow-xl"
        style={sidebarStyle}
      >
        {conteudo}
      </aside>

      {/* Mobile — botão hamburguer (respeita safe-area do notch no iPhone) */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="md:hidden fixed left-3 z-50 w-11 h-11 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <Menu size={20} className="text-foreground" />
      </button>

      {/* Mobile — drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 flex flex-col shadow-xl" style={sidebarStyle}>
            <div className="flex justify-end p-3">
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15">
                <X size={18} />
              </button>
            </div>
            {conteudo}
          </div>
          {/* overlay */}
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}

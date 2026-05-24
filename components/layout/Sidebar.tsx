'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, BarChart2, Landmark, CreditCard,
  Tag, Target, TrendingUp, Settings, LogOut, Menu, X, Users, ArrowLeftRight,
  Sun, Moon, Flag, Download, Receipt, Briefcase,
  Sprout, Heart, ListChecks, Home as HomeIcon, Activity, GraduationCap, Sparkles, Zap,
  MessageCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { usePwa } from '@/components/pwa/InstallPwa';
import PainelSwitch from './PainelSwitch';
import type { Feature } from '@/lib/plans';

type NavItem = {
  href:    string;
  label:   string;
  icon:    any;
  gate?:   Feature;       // feature requerida pra acessar
  badge?:  'Premium' | 'Black'; // rótulo exibido quando bloqueado
};

const NAV_FINANCE: NavItem[] = [
  { href: '/dashboard',          label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/transacoes',         label: 'Transações',        icon: ArrowLeftRight },
  { href: '/relatorios',         label: 'Relatórios',        icon: BarChart2 },
  { href: '/contas-bancarias',   label: 'Contas',            icon: Landmark },
  { href: '/cartao-de-credito',  label: 'Cartão de crédito', icon: CreditCard },
  { href: '/categorias',         label: 'Categorias',        icon: Tag },
  { href: '/limites-de-gastos',  label: 'Limites',           icon: Target },
  { href: '/metas',              label: 'Metas',             icon: Flag },
  { href: '/dividas',            label: 'Dívidas',           icon: Receipt },
  { href: '/comunidade',         label: 'Grupos',            icon: Users,       gate: 'compartilhamento', badge: 'Premium' },
  { href: '/investimentos',      label: 'Investimentos',     icon: TrendingUp,  gate: 'investimentos',    badge: 'Premium' },
  { href: '/negocios',           label: 'Negócios',          icon: Briefcase,   gate: 'negocios',         badge: 'Black'   },
  { href: '/central-sora',       label: 'Central da Sora',   icon: MessageCircle },
  { href: '/planos',             label: 'Planos',            icon: Zap },
  { href: '/configuracoes',      label: 'Configurações',     icon: Settings },
];

const NAV_GROW = [
  { href: '/grow/dashboard',  label: 'Dashboard',     icon: Sprout },
  { href: '/grow/habitos',    label: 'Hábitos',       icon: Target },
  { href: '/grow/tarefas',    label: 'Tarefas',       icon: ListChecks },
  { href: '/grow/bem-estar',  label: 'Bem-estar',     icon: Heart },
  { href: '/grow/saude',      label: 'Saúde',         icon: Activity },
  { href: '/grow/estudos',    label: 'Estudos',       icon: GraduationCap },
  { href: '/grow/casa',       label: 'Casa',          icon: HomeIcon },
  { href: '/configuracoes',   label: 'Configurações', icon: Settings },
];

const PLANO_BADGE: Record<string, string> = {
  basico:  'bg-white text-emerald-700',
  premium: 'bg-white text-blue-700',
  black:   'bg-zinc-900 text-white',
  inativo: 'bg-white text-emerald-800',
};

const SIDEBAR_BG_FINANCE_LIGHT = 'linear-gradient(180deg, #5BC571 0%, #4DAE61 100%)';
const SIDEBAR_BG_FINANCE_DARK  = 'linear-gradient(180deg, #4DAE61 0%, #3C9450 100%)';
const SIDEBAR_BG_GROW_LIGHT    = 'linear-gradient(180deg, #7c3aed 0%, #4f46e5 100%)';
const SIDEBAR_BG_GROW_DARK     = 'linear-gradient(180deg, #6d28d9 0%, #4338ca 100%)';
const SIDEBAR_BG_BLACK         = '#000000';

export default function Sidebar() {
  const pathname = usePathname();
  const { perfil, signOut, painelAtivo, podeUsar } = useAuth();
  const [open, setOpen] = useState(false);

  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Tema efetivo: light | dark | black (resolve 'system')
  const efetivo: 'light' | 'dark' | 'black' = mounted
    ? theme === 'black' ? 'black'
    : theme === 'system' ? (resolvedTheme === 'dark' ? 'dark' : 'light')
    : theme === 'dark' ? 'dark'
    : 'light'
    : 'light';

  const isTemaBlack = efetivo === 'black';
  const isDark      = efetivo === 'dark' || isTemaBlack;

  function ciclarTema() {
    const proximo = efetivo === 'light' ? 'dark' : efetivo === 'dark' ? 'black' : 'light';
    setTheme(proximo);
  }
  const proxLabel = efetivo === 'light' ? 'Tema escuro' : efetivo === 'dark' ? 'Tema black' : 'Tema claro';
  const ProxIcon  = efetivo === 'light' ? Moon : efetivo === 'dark' ? Sparkles : Sun;
  const { abrir: abrirInstall } = usePwa();

  const plano  = perfil?.plano || 'inativo';

  const ehGrowPath = pathname?.startsWith('/grow');
  const usarGrow = ehGrowPath || (painelAtivo === 'grow' && pathname !== '/configuracoes');
  const NAV = usarGrow ? NAV_GROW : NAV_FINANCE;

  const sidebarBg = isTemaBlack
    ? SIDEBAR_BG_BLACK
    : usarGrow
      ? (isDark ? SIDEBAR_BG_GROW_DARK : SIDEBAR_BG_GROW_LIGHT)
      : (isDark ? SIDEBAR_BG_FINANCE_DARK : SIDEBAR_BG_FINANCE_LIGHT);

  const conteudo = (
    <div className="flex flex-col h-full">
      {/* HEADER: PainelSwitch ocupa o topo inteiro (cabe "Sora Finance/Grow" completo) */}
      <div className="px-4 py-4 border-b border-white/10">
        <PainelSwitch />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const { href, label, icon: Icon, gate, badge } = item as NavItem;
          const bloqueado = gate ? !podeUsar(gate) : false;
          const ativo     = href === '/grow/saude'
            ? !!pathname?.startsWith('/grow/saude')
            : href === '/grow/estudos'
            ? !!pathname?.startsWith('/grow/estudos')
            : href === '/negocios'
            ? !!pathname?.startsWith('/negocios')
            : pathname === href;
          const corBadge = badge === 'Black'
            ? 'bg-zinc-900 text-white'
            : 'bg-white text-emerald-700';
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
              title={bloqueado ? `Disponível no plano ${badge || 'Premium'}` : label}
            >
              <Icon size={18} />
              <span>{label}</span>
              {bloqueado && badge && (
                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold ${corBadge}`}>
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/20">
        <button onClick={ciclarTema} className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-white/75 hover:text-white hover:bg-white/15 transition-all mb-1">
          <ProxIcon size={18} />
          <span>{proxLabel}</span>
          {/* Indicador discreto de qual tema está ativo */}
          <span className="ml-auto flex items-center gap-0.5">
            {(['light','dark','black'] as const).map(t => (
              <span key={t} className={`block w-1.5 h-1.5 rounded-full transition-all ${
                efetivo === t ? 'bg-white opacity-100' : 'bg-white opacity-25'
              }`} />
            ))}
          </span>
        </button>
        <button onClick={() => { setOpen(false); abrirInstall(); }} className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-white/75 hover:text-white hover:bg-white/15 transition-all mb-1">
          <Download size={18} />
          <span>Instalar app</span>
        </button>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/15 backdrop-blur-sm mb-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {perfil?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{perfil?.name || 'Usuário'}</p>
            <p className="text-xs text-white/70 truncate">{perfil?.phone || ''}</p>
          </div>
          <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${PLANO_BADGE[plano]}`}>
            {plano}
          </span>
        </div>
        <button onClick={signOut} className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-white/75 hover:text-white hover:bg-white/15 transition-all">
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );

  const sidebarStyle = { background: sidebarBg };

  return (
    <>
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 shadow-xl transition-all duration-500" style={sidebarStyle}>
        {conteudo}
      </aside>

      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="md:hidden fixed left-3 z-50 w-11 h-11 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <Menu size={20} className="text-foreground" />
      </button>

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
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}

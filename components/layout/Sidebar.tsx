'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, BarChart2, Landmark, CreditCard,
  Tag, Target, TrendingUp, Settings, LogOut, Menu, X, Users, ArrowLeftRight,
  Sun, Moon, Flag, Download, Receipt, Briefcase,
  Heart, ListChecks, Home as HomeIcon, Activity, GraduationCap, Sparkles, Zap,
  MessageCircle, CalendarDays, ChevronDown, Lock,
  Beaker, ArrowLeft, Wallet, Rocket, Check,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { usePwa } from '@/components/pwa/InstallPwa';
import type { Feature } from '@/lib/plans';

type NavItem = {
  href:    string;
  label:   string;
  icon:    any;
  gate?:   Feature;             // feature requerida (Finance)
  badge?:  'Premium' | 'Black'; // rótulo quando bloqueado por plano
};

// ── Grupo FINANCE (núcleo) ──────────────────────────────────────────
// Dashboard unifica Finance + Grow — fica fora dos grupos, no topo.
const NAV_DASHBOARD: NavItem = { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard };

const NAV_FINANCE: NavItem[] = [
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
];

// ── Grupo GROW ──────────────────────────────────────────────────────
const NAV_GROW: NavItem[] = [
  { href: '/grow/habitos',    label: 'Hábitos',    icon: Target },
  { href: '/grow/tarefas',    label: 'Tarefas',    icon: ListChecks },
  { href: '/grow/bem-estar',  label: 'Bem-estar',  icon: Heart },
  { href: '/grow/saude',      label: 'Saúde',      icon: Activity,      gate: 'grow_saude',   badge: 'Premium' },
  { href: '/grow/estudos',    label: 'Estudos',    icon: GraduationCap, gate: 'grow_estudos', badge: 'Premium' },
  { href: '/grow/casa',       label: 'Casa',       icon: HomeIcon },
  { href: '/grow/agenda',     label: 'Agenda',     icon: CalendarDays },
];

// ── Geral (app-wide, sempre visível) ────────────────────────────────
const NAV_GERAL: NavItem[] = [
  { href: '/central-sora',  label: 'Central da Sora', icon: MessageCircle },
  { href: '/planos',        label: 'Planos',          icon: Zap },
  { href: '/configuracoes', label: 'Configurações',   icon: Settings },
];

// ── Sora Labs (painel separado) — âncoras pras fileiras do /labs ─────
const NAV_LABS: NavItem[] = [
  { href: '/labs#destaques',      label: 'Em destaque',  icon: Sparkles },
  { href: '/labs#financas',       label: 'Finanças',     icon: Wallet },
  { href: '/labs#saude',          label: 'Saúde',        icon: Heart },
  { href: '/labs#produtividade',  label: 'Produtividade', icon: Target },
  { href: '/labs#negocios',       label: 'Negócios',     icon: Rocket },
];

const PLANO_BADGE: Record<string, string> = {
  basico:  'bg-white text-emerald-700',
  premium: 'bg-white text-blue-700',
  black:   'bg-zinc-900 text-white',
  inativo: 'bg-white text-emerald-800',
};

// Sidebar segue a cor temática escolhida (--primary)
const SIDEBAR_BG_LIGHT = 'linear-gradient(180deg, hsl(var(--primary)) 0%, color-mix(in srgb, hsl(var(--primary)) 82%, #000) 100%)';
const SIDEBAR_BG_DARK  = 'linear-gradient(180deg, color-mix(in srgb, hsl(var(--primary)) 86%, #000) 0%, color-mix(in srgb, hsl(var(--primary)) 68%, #000) 100%)';
const SIDEBAR_BG_BLACK = '#000000';

// Opção do dropdown de troca de painel (Sora / Sora Labs).
function PainelOpcao({ ativo, titulo, sub, onClick, logo, icon: Icon }:
  { ativo: boolean; titulo: string; sub: string; onClick: () => void; logo?: boolean; icon?: any }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${ativo ? 'bg-primary/10' : 'hover:bg-muted/70'}`}>
      {logo ? (
        <img src="/brands/sora.png" alt="" width={28} height={28} className="w-7 h-7 rounded-lg flex-shrink-0 shadow-sm" draggable={false} />
      ) : (
        <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/15">
          {Icon && <Icon size={15} className="text-primary" />}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight truncate">{titulo}</p>
        <p className="text-[11px] text-muted-foreground leading-tight truncate">{sub}</p>
      </div>
      {ativo && <Check size={15} className="text-primary flex-shrink-0" />}
    </button>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { perfil, signOut, podeUsar, temAcessoGrow, trialAtivo, diasTrialRestantes } = useAuth();
  const [open, setOpen] = useState(false); // drawer mobile
  const [switcherOpen, setSwitcherOpen] = useState(false); // dropdown Sora ↔ Labs
  const ehLabs = !!pathname?.startsWith('/labs');

  // Colapso dos grupos (persistido). Grow começa colapsado pra quem não tem acesso.
  const [openFin, setOpenFin]   = useState(true);
  const [openGrow, setOpenGrow] = useState(true);

  // Navega entre painéis (Sora app ↔ Sora Labs) e fecha o drawer/dropdown.
  function irPara(href: string) {
    setSwitcherOpen(false);
    setOpen(false);
    router.push(href);
  }

  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Tema "escuro" foi removido — quem tinha 'dark' salvo migra pra 'black'.
  useEffect(() => { if (mounted && theme === 'dark') setTheme('black'); }, [mounted, theme, setTheme]);

  // Trava o scroll do conteúdo atrás enquanto o drawer está aberto (mobile).
  // Sem isso, arrastar na sidebar acaba rolando a página de baixo.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => { root.style.overflow = prev; };
  }, [open]);

  // Estado inicial dos grupos: lê localStorage; Grow default = tem acesso
  useEffect(() => {
    try {
      const f = localStorage.getItem('sora-sb-fin');
      const g = localStorage.getItem('sora-sb-grow');
      if (f !== null) setOpenFin(f === '1');
      if (g !== null) setOpenGrow(g === '1');
      else setOpenGrow(temAcessoGrow);
    } catch {}
  }, [temAcessoGrow]);

  // Abre automaticamente o grupo da página atual (pra o item ativo ficar visível)
  useEffect(() => {
    if (pathname?.startsWith('/grow')) setOpenGrow(true);
  }, [pathname]);

  function toggleFin()  { setOpenFin(v => { const n = !v; try { localStorage.setItem('sora-sb-fin', n ? '1' : '0'); } catch {} return n; }); }
  function toggleGrow() { setOpenGrow(v => { const n = !v; try { localStorage.setItem('sora-sb-grow', n ? '1' : '0'); } catch {} return n; }); }

  // Tema efetivo: light | black (o "escuro" foi removido)
  const efetivo: 'light' | 'black' = mounted ? (theme === 'black' ? 'black' : 'light') : 'light';
  const isTemaBlack = efetivo === 'black';
  const isDark      = isTemaBlack; // black usa as variáveis .dark

  function ciclarTema() {
    setTheme(efetivo === 'light' ? 'black' : 'light');
  }
  const proxLabel = efetivo === 'light' ? 'Tema black' : 'Tema claro';
  const ProxIcon  = efetivo === 'light' ? Moon : Sun;
  const { abrir: abrirInstall } = usePwa();

  const plano = perfil?.plano || 'inativo';
  const sidebarBg = isTemaBlack ? SIDEBAR_BG_BLACK : (isDark ? SIDEBAR_BG_DARK : SIDEBAR_BG_LIGHT);

  function isActive(href: string) {
    if (href === '/grow/saude')   return !!pathname?.startsWith('/grow/saude');
    if (href === '/grow/estudos') return !!pathname?.startsWith('/grow/estudos');
    if (href === '/negocios')     return !!pathname?.startsWith('/negocios');
    return pathname === href;
  }

  // ── Item de navegação ──
  function NavLink({ item, grow = false }: { item: NavItem; grow?: boolean }) {
    const { href, label, icon: Icon, gate, badge } = item;
    const growLocked = grow && !temAcessoGrow;
    const gateLocked = gate ? !podeUsar(gate) : false;
    const locked     = growLocked || gateLocked;
    const destino    = growLocked ? '/grow/upgrade' : gateLocked ? '/planos' : href;
    const ativo      = !locked && isActive(href);
    const badgeText  = growLocked ? 'Premium' : badge;
    const corBadge   = badgeText === 'Black' ? 'bg-zinc-900 text-white' : 'bg-white text-emerald-700';

    return (
      <Link
        href={destino}
        onClick={() => setOpen(false)}
        aria-disabled={locked || undefined}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
          ativo
            ? 'bg-white/20 text-white font-semibold backdrop-blur-sm shadow-sm'
            : locked
              ? 'text-white/45 hover:text-white/70 hover:bg-white/10'
              : 'text-white/80 hover:text-white hover:bg-white/15'
        }`}
        title={locked ? `Disponível no plano ${badgeText || 'Premium'}` : label}
      >
        <Icon size={18} className={locked ? 'opacity-70' : ''} />
        <span className="flex-1 truncate">{label}</span>
        {locked && (
          badgeText
            ? <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${corBadge}`}>{badgeText}</span>
            : <Lock size={13} className="text-white/55" />
        )}
      </Link>
    );
  }

  // ── Cabeçalho de grupo (colapsável) ──
  function GroupHeader({ label, open: aberto, onToggle, locked = false, trial }:
    { label: string; open: boolean; onToggle: () => void; locked?: boolean; trial?: number }) {
    return (
      <button
        onClick={onToggle}
        aria-expanded={aberto}
        className="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-lg text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors"
      >
        {locked && <Lock size={12} className="text-white/55 flex-shrink-0" />}
        <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
        {locked && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white text-emerald-700">Premium</span>
        )}
        {trial != null && trial > 0 && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-300 text-yellow-900">{trial}d</span>
        )}
        <ChevronDown size={15} className={`ml-auto flex-shrink-0 transition-transform duration-200 ${aberto ? '' : '-rotate-90'}`} />
      </button>
    );
  }

  const conteudo = (
    <div className="flex flex-col h-full">
      {/* Switcher de painel (Sora app ↔ Sora Labs) no lugar do logo */}
      <div
        className="relative px-4 pb-4 border-b border-white/10"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSwitcherOpen(v => !v)}
            aria-expanded={switcherOpen}
            aria-label="Trocar de painel"
            className="flex items-center gap-2.5 flex-1 min-w-0 -mx-1 px-1 py-1 rounded-xl hover:bg-white/10 active:scale-[0.99] transition-all"
          >
            {ehLabs ? (
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/15 shadow-sm">
                <Beaker size={18} className="text-white" />
              </span>
            ) : (
              <img src="/brands/sora.png" alt="Sora" width={36} height={36} className="w-9 h-9 rounded-xl flex-shrink-0 shadow-sm" draggable={false} />
            )}
            <div className="min-w-0 flex-1 text-left">
              <p className="text-white font-bold text-lg leading-none truncate">{ehLabs ? 'Sora Labs' : 'Sora'}</p>
              <p className="text-white/55 text-[10px] leading-none mt-1 truncate">{ehLabs ? 'Aprenda & evolua' : 'Sua vida organizada'}</p>
            </div>
            <ChevronDown size={16} className={`text-white/60 flex-shrink-0 transition-transform duration-200 ${switcherOpen ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="md:hidden -mr-1 w-10 h-10 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 active:scale-95 transition-all flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Dropdown de painéis */}
        {switcherOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setSwitcherOpen(false)} />
            <div className="absolute left-4 right-4 top-full -mt-1 z-30 rounded-xl p-1.5 shadow-2xl border border-border animate-fade-in"
                 style={{ background: 'hsl(var(--bg-card))' }}>
              <PainelOpcao ativo={!ehLabs} titulo="Sora" sub="Finanças, Grow e agenda"
                onClick={() => irPara('/dashboard')} logo />
              <PainelOpcao ativo={ehLabs} titulo="Sora Labs" sub="Cursos e conteúdos"
                onClick={() => irPara('/labs')} icon={Beaker} />
            </div>
          </>
        )}
      </div>

      <nav className="flex-1 min-h-0 px-3 py-3 overflow-y-auto overscroll-contain">
        {ehLabs ? (
          /* ── NAV do Sora Labs ── */
          <div className="animate-fade-in">
            <Link href="/dashboard" onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/75 hover:text-white hover:bg-white/15 transition-all mb-1">
              <ArrowLeft size={18} /> <span>Voltar pro app</span>
            </Link>
            <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-widest text-white/50">Categorias</p>
            <div className="space-y-0.5">
              {NAV_LABS.map(item => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/80 hover:text-white hover:bg-white/15 transition-all">
                    <Icon size={18} /> <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── NAV do app (Dashboard + Finance + Grow) ── */
          <>
            <div className="space-y-0.5 mb-2">
              <NavLink item={NAV_DASHBOARD} />
            </div>

            <GroupHeader label="Finance" open={openFin} onToggle={toggleFin} />
            {openFin && (
              <div className="space-y-0.5 mt-0.5 animate-fade-in">
                {NAV_FINANCE.map(item => <NavLink key={item.href} item={item} />)}
              </div>
            )}

            <GroupHeader label="Grow" open={openGrow} onToggle={toggleGrow}
              locked={!temAcessoGrow} trial={temAcessoGrow && trialAtivo ? diasTrialRestantes : undefined} />
            {openGrow && (
              <div className="space-y-0.5 mt-0.5 animate-fade-in">
                {NAV_GROW.map(item => <NavLink key={item.href} item={item} grow />)}
              </div>
            )}
          </>
        )}

        {/* GERAL — sempre visível */}
        <div className="mt-2 pt-2 border-t border-white/10 space-y-0.5">
          {NAV_GERAL.map(item => <NavLink key={item.href} item={item} />)}
        </div>
      </nav>

      <div className="px-3 pt-4 border-t border-white/20" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
        <button onClick={ciclarTema} className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-white/75 hover:text-white hover:bg-white/15 transition-all mb-1">
          <ProxIcon size={18} />
          <span>{proxLabel}</span>
          <span className="ml-auto flex items-center gap-0.5">
            {(['light','black'] as const).map(t => (
              <span key={t} className={`block w-1.5 h-1.5 rounded-full transition-all ${efetivo === t ? 'bg-white opacity-100' : 'bg-white opacity-25'}`} />
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

      {/* Botão de menu — canto superior esquerdo, flutuando sobre os cards. */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="md:hidden fixed left-3 z-50 w-11 h-11 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <Menu size={20} className="text-foreground" />
      </button>

      {open && (
        <div className="md:hidden fixed inset-0 z-[60] flex">
          <div className="w-72 h-full flex flex-col shadow-xl overscroll-contain" style={sidebarStyle}>
            {conteudo}
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}

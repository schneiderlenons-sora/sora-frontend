'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, BarChart2, Landmark, CreditCard,
  Tag, Target, TrendingUp, Settings, LogOut, Menu, X, Users, ArrowLeftRight,
  Flag, Download, Receipt, Briefcase,
  Heart, ListChecks, Home as HomeIcon, Activity, GraduationCap, Sparkles, Zap,
  MessageCircle, CalendarDays, ChevronDown, Lock,
  Beaker, ArrowLeft, Wallet, Rocket, Check, Gift,
  Plane, Clapperboard, BookOpen, Bug, Shield, Building2,
  Percent, CalendarRange, FolderLock,
  // Painel Negócios (resolvidos por nome a partir de lib/negocios-nav)
  HandCoins, FileBarChart, ShoppingCart, Package, Boxes, Truck,
  IdCard, Plug, CheckCheck, Store,
} from 'lucide-react';
import { gruposPara, rotaAtiva, rotasNavegaveis } from '@/lib/negocios-nav';
import { useEmpresa } from '@/components/negocios/EmpresaContext';
import EmpresaAvatar from '@/components/negocios/EmpresaAvatar';
import { isAdminEmail } from '@/lib/admin';
import AvatarMembro from '@/components/ui/AvatarMembro';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { prefetchRota, prefetchTopTabs } from '@/lib/prefetch';
import { usePwa } from '@/components/pwa/InstallPwa';
import type { Feature } from '@/lib/plans';

type NavItem = {
  href:    string;
  label:   string;
  icon:    any;
  gate?:   Feature;             // feature requerida (Finance)
  badge?:  'Premium' | 'Black'; // rótulo quando bloqueado por plano
  adminOnly?: boolean;          // só aparece pro admin (ex.: features em rollout)
  nota?:   string;              // mini texto abaixo do nome (ex.: status)
};

// ── Grupo FINANCE (núcleo) ──────────────────────────────────────────
// Dashboard unifica Finance + Grow — fica fora dos grupos, no topo.
const NAV_DASHBOARD: NavItem = { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard };

const NAV_FINANCE: NavItem[] = [
  { href: '/transacoes',         label: 'Transações',        icon: ArrowLeftRight },
  { href: '/relatorios',         label: 'Relatórios',        icon: BarChart2 },
  { href: '/contas-bancarias',   label: 'Contas',            icon: Landmark },
  { href: '/open-finance',       label: 'Open Finance',      icon: Building2 },
  { href: '/cartao-de-credito',  label: 'Cartão de crédito', icon: CreditCard },
  { href: '/categorias',         label: 'Categorias',        icon: Tag },
  { href: '/limites-de-gastos',  label: 'Limites',           icon: Target },
  { href: '/metas',              label: 'Metas',             icon: Flag },
  { href: '/dividas',            label: 'Dívidas e Parcelas', icon: Receipt },
  { href: '/juros',              label: 'Calculadora de Juros', icon: Percent },
  { href: '/planejamento',       label: 'Planejamento Anual', icon: CalendarRange },
  { href: '/investimentos',      label: 'Investimentos',     icon: TrendingUp,  gate: 'investimentos',    badge: 'Premium' },
  { href: '/negocios',           label: 'Negócios',          icon: Briefcase,   gate: 'negocios',         badge: 'Premium' },
];

// ── Grupo GROW ──────────────────────────────────────────────────────
const NAV_GROW: NavItem[] = [
  { href: '/grow/habitos',    label: 'Hábitos',    icon: Target },
  { href: '/grow/tarefas',    label: 'Tarefas',    icon: ListChecks },
  { href: '/grow/bem-estar',  label: 'Bem-estar',  icon: Heart },
  { href: '/grow/saude',      label: 'Saúde',      icon: Activity,      gate: 'grow_saude',   badge: 'Premium' },
  { href: '/grow/estudos',    label: 'Estudos',    icon: GraduationCap, gate: 'grow_estudos', badge: 'Premium' },
  { href: '/grow/casa',       label: 'Casa',       icon: HomeIcon,      gate: 'grow_casa',     badge: 'Premium' },
  { href: '/grow/agenda',     label: 'Agenda',     icon: CalendarDays },
  { href: '/grow/viagens',    label: 'Viagens',    icon: Plane,         gate: 'grow_colecoes', badge: 'Premium' },
  { href: '/grow/midia',      label: 'Filmes & Séries', icon: Clapperboard, gate: 'grow_colecoes', badge: 'Premium' },
  { href: '/grow/leituras',   label: 'Leituras',   icon: BookOpen,      gate: 'grow_colecoes', badge: 'Premium' },
  // Drive virou atalho fixo no rodapé (junto de Agentes) — mais fácil de
  // achar do que enterrado dentro do grupo Grow. Ver o bloco fixo mais abaixo.
  { href: '/grow/configuracoes', label: 'Compartilhamento', icon: Users },
];

// ── Geral (app-wide, sempre visível) ────────────────────────────────
const NAV_GERAL: NavItem[] = [
  { href: '/wrapped',       label: 'Sora Wrapped',    icon: Gift },
  { href: '/planos',        label: 'Planos',          icon: Zap },
  { href: '/comunidade',    label: 'Gestão compartilhada', icon: Users, gate: 'compartilhamento', badge: 'Premium' },
  { href: '/reportar-bug',  label: 'Relatar um problema', icon: Bug },
  // Agentes, Drive, Comandos e Configurações ficam FIXOS no rodapé (não rolam
  // com a lista) — Agentes/Drive viraram atalho pra facilitar achar (antes
  // enterrados aqui dentro / dentro do grupo Grow).
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

// Ícones do painel Negócios, resolvidos pelo NOME que vem de lib/negocios-nav.
// O catálogo de rotas fica livre de import de componente e pode ser lido no
// servidor (prefetch, testes) sem arrastar a árvore do lucide junto.
type IconeLucide = React.ComponentType<{ size?: number; className?: string }>;
const ICONES_NEGOCIOS: Record<string, IconeLucide> = {
  LayoutDashboard, Sparkles, ArrowLeftRight, Receipt, HandCoins, FileBarChart,
  TrendingUp, ShoppingCart, Package, Boxes, Users, Truck, IdCard, Plug, CheckCheck,
};

// Opção do dropdown de troca de painel (Sora / Sora Negócios / Sora Labs).
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

export default function Sidebar({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { perfil, phone, signOut, podeUsar, temAcessoGrow, trialAtivo, diasTrialRestantes } = useAuth();
  const ehAdmin = isAdminEmail(perfil?.email);

  // Aquece TODAS as abas principais no tempo ocioso → clicar em qualquer uma
  // (inclusive no mobile, onde não há hover) já é instantâneo, porque a rota
  // (RSC + chunk) já foi baixada. Não compete com o LCP do dashboard (roda no
  // ocioso, low-priority) e o recharts é dynamic → não vem no chunk da rota.
  useEffect(() => {
    if (!phone) return;
    const rotas = [
      NAV_DASHBOARD.href,
      ...NAV_FINANCE.map((i) => i.href),
      ...NAV_GROW.map((i) => i.href),
      '/wrapped', '/central-sora', '/planos', '/configuracoes', '/agentes', '/grow/dados',
    ];
    const warm = () => {
      rotas.forEach((r) => router.prefetch(r));
      prefetchTopTabs(phone); // + dados das 3 mais usadas
    };
    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void) => number);
    const id = ric ? ric(warm) : window.setTimeout(warm, 1500);
    return () => {
      const cic = (window as any).cancelIdleCallback as undefined | ((h: number) => void);
      if (ric && cic) cic(id as number); else clearTimeout(id as number);
    };
  }, [phone, router]);
  // Open Finance: a aba aparece pra TODOS. Quem está na allowlist (config no
  // back) vê o fluxo real da Polp; o resto vê o aviso "Em atualização" na página.
  // Drawer mobile agora é CONTROLADO pelo DashboardLayout (aberto pelo perfil do
  // BottomNav) — mantém `setOpen(false)` como fechar-mobile.
  const open = mobileOpen;
  const setOpen = (_v: boolean) => { if (!_v) onMobileClose?.(); };
  const [switcherOpen, setSwitcherOpen] = useState(false); // dropdown entre painéis
  const ehLabs     = !!pathname?.startsWith('/labs');
  const ehNegocios = !!pathname?.startsWith('/negocios');

  // Empresa ativa — só existe dentro do painel Negócios; fora dele o hook
  // devolve estado vazio (não quebra o app pessoal).
  const { empresa, empresas, trocar, abrirCadastro } = useEmpresa();
  const [empresaMenu, setEmpresaMenu] = useState(false);

  // Prefetch das rotas do painel assim que ele abre: são poucas e leves, e o
  // usuário do Negócios navega entre elas o tempo todo. Sem isto, a PRIMEIRA
  // visita a cada aba paga o download do chunk — que é exatamente o "delay ao
  // trocar de aba". Roda no ocioso pra não competir com o conteúdo.
  useEffect(() => {
    if (!ehNegocios) return;
    const rotas = rotasNavegaveis(empresa?.tipo);
    const warm = () => rotas.forEach((r) => router.prefetch(r));
    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void) => number);
    const id = ric ? ric(warm) : window.setTimeout(warm, 600);
    return () => {
      const cic = (window as any).cancelIdleCallback as undefined | ((h: number) => void);
      if (ric && cic) cic(id as number); else clearTimeout(id as number);
    };
  }, [ehNegocios, empresa?.tipo, router]);

  // Colapso dos grupos (persistido). Grow começa colapsado pra quem não tem acesso.
  const [openFin, setOpenFin]   = useState(true);
  const [openGrow, setOpenGrow] = useState(true);

  // Navega entre painéis (Sora app ↔ Sora Labs) e fecha o drawer/dropdown.
  function irPara(href: string) {
    setSwitcherOpen(false);
    setOpen(false);
    router.push(href);
  }

  // Só LÊ o tema (pra colorir o fundo da sidebar) — quem CONTROLA é o
  // ThemeToggle (círculo fixo no canto superior direito, em toda tela), que
  // também é o dono da migração 'dark' → 'black'.
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

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
    const { href, label, icon: Icon, gate, badge, nota } = item;
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
        // Ao passar o mouse / tocar num item, prefetcha a ROTA (JS) + os DADOS
        // daquela aba → quando clicar, tanto o código quanto os dados já estão
        // prontos = navegação instantânea (fim da travada do clique). Barato:
        // só a aba apontada, não todas de uma vez (por isso o prefetch={false}).
        // Só no HOVER (desktop). No mobile NÃO prefetchamos no toque: (1) o
        // aquecimento ocioso já baixou a rota, e (2) fazer prefetch no touchstart
        // adiciona jank ao próprio toque. Também prefetcha os dados da aba.
        onMouseEnter={() => { router.prefetch(destino); prefetchRota(destino, phone); }}
        // O prefetch do Next baixa a rota inteira quando o link aparece na tela.
        // Com a sidebar sempre visível, TODAS as rotas eram baixadas de uma vez —
        // e /investimentos, /metas, /relatorios, /juros e /planejamento carregam
        // recharts (~288 KB cada). Medido: o dashboard baixava 3 MB de JS, com
        // 864 KB de recharts, sem desenhar um gráfico. A rota continua sendo
        // buscada no clique; só não vem antes da hora.
        prefetch={false}
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
        <span className="flex-1 min-w-0">
          <span className="block truncate">{label}</span>
          {nota && <span className="block text-[10px] leading-tight text-white/45 truncate">{nota}</span>}
        </span>
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
            ) : ehNegocios ? (
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/15 shadow-sm">
                <Store size={18} className="text-white" />
              </span>
            ) : (
              <img src="/brands/sora.png" alt="Sora" width={36} height={36} className="w-9 h-9 rounded-xl flex-shrink-0 shadow-sm" draggable={false} />
            )}
            <div className="min-w-0 flex-1 text-left">
              <p className="text-white font-bold text-lg leading-none truncate">
                {ehLabs ? 'Sora Labs' : ehNegocios ? 'Sora Negócios' : 'Sora'}
              </p>
              <p className="text-white/55 text-[10px] leading-none mt-1 truncate">
                {ehLabs ? 'Aprenda & evolua' : ehNegocios ? 'Gestão do seu negócio' : 'Sua vida organizada'}
              </p>
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
              <PainelOpcao ativo={!ehLabs && !ehNegocios} titulo="Sora" sub="Finanças, Grow e agenda"
                onClick={() => irPara('/dashboard')} logo />
              <PainelOpcao ativo={ehNegocios} titulo="Sora Negócios" sub="Caixa, vendas e equipe"
                onClick={() => irPara('/negocios')} icon={Store} />
              <PainelOpcao ativo={ehLabs} titulo="Sora Labs" sub="Cursos e conteúdos"
                onClick={() => irPara('/labs')} icon={Beaker} />
            </div>
          </>
        )}
      </div>

      <nav className="flex-1 min-h-0 px-3 py-3 overflow-y-auto overscroll-contain">
        {ehNegocios ? (
          /* ── NAV do Sora Negócios ── */
          <div className="animate-fade-in">
            {/* Seletor de empresa: o CONTEXTO de tudo que vem abaixo. Fica no
                topo e sempre visível porque cada número da tela pertence a uma
                empresa — sem ele, o usuário multi-empresa lê o dado errado. */}
            {empresas.length > 0 && (
              <div className="relative mb-3">
                <button
                  onClick={() => setEmpresaMenu(v => !v)}
                  aria-expanded={empresaMenu}
                  aria-label="Trocar de empresa"
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.99] transition-all"
                  style={{ minHeight: 44 }}
                >
                  <EmpresaAvatar empresa={empresa} tamanho="sm" />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-white text-sm font-semibold leading-tight truncate">
                      {empresa?.nome || 'Escolher empresa'}
                    </span>
                    <span className="block text-white/50 text-[10px] leading-tight mt-0.5">
                      {empresas.length === 1 ? 'Sua empresa' : `${empresas.length} empresas`}
                    </span>
                  </span>
                  <ChevronDown size={15} className={`text-white/60 flex-shrink-0 transition-transform duration-200 ${empresaMenu ? 'rotate-180' : ''}`} />
                </button>

                {empresaMenu && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setEmpresaMenu(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl p-1.5 shadow-2xl border border-border animate-fade-in max-h-64 overflow-y-auto"
                         style={{ background: 'hsl(var(--bg-card))' }}>
                      {empresas.map(e => (
                        <button key={e.id}
                          onClick={() => { trocar(e); setEmpresaMenu(false); }}
                          className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors ${
                            e.id === empresa?.id ? 'bg-primary/10' : 'hover:bg-muted/70'}`}
                          style={{ minHeight: 44 }}>
                          <EmpresaAvatar empresa={e} tamanho="sm" />
                          <span className="flex-1 min-w-0 text-sm font-semibold text-foreground truncate">{e.nome}</span>
                          {e.id === empresa?.id && <Check size={15} className="text-primary flex-shrink-0" />}
                        </button>
                      ))}

                      {/* Gerenciar a empresa a partir de QUALQUER tela — antes
                          isso só existia no header de 4 páginas. */}
                      <div className="mt-1 pt-1 border-t border-border">
                        {empresa && (
                          <button onClick={() => { abrirCadastro(empresa); setEmpresaMenu(false); }}
                            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left hover:bg-muted/70 transition-colors"
                            style={{ minHeight: 44 }}>
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted">
                              <Settings size={14} className="text-muted-foreground" />
                            </span>
                            <span className="text-sm font-medium text-foreground">Editar {empresa.nome}</span>
                          </button>
                        )}
                        <button onClick={() => { abrirCadastro(null); setEmpresaMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left hover:bg-muted/70 transition-colors"
                          style={{ minHeight: 44 }}>
                          <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/15">
                            <Building2 size={14} className="text-primary" />
                          </span>
                          <span className="text-sm font-medium text-foreground">Nova empresa</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {gruposPara(empresa?.tipo).map(grupo => (
              <div key={grupo.id} className="mb-1">
                <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-widest text-white/40">
                  {grupo.titulo}
                </p>
                <div className="space-y-0.5">
                  {grupo.itens.map(item => {
                    const Icon = ICONES_NEGOCIOS[item.icone] || Briefcase;
                    const ativo = rotaAtiva(pathname, item.href);

                    // Rota das próximas fases: aparece pra dar noção do todo,
                    // mas não navega pra lugar nenhum (404 é pior que "em breve").
                    if (item.breve) {
                      return (
                        <span key={item.href} aria-disabled="true"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/35 cursor-default select-none">
                          <Icon size={18} />
                          <span className="flex-1 truncate">{item.label}</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/45">
                            em breve
                          </span>
                        </span>
                      );
                    }
                    return (
                      <Link key={item.href} href={item.href}
                        onClick={() => setOpen(false)}
                        onMouseEnter={() => router.prefetch(item.href)}
                        aria-current={ativo ? 'page' : undefined}
                        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                          ativo ? 'bg-white/20 text-white font-semibold' : 'text-white/80 hover:text-white hover:bg-white/15'}`}
                        style={{ minHeight: 44 }}>
                        {/* Barra de rota ativa: estado também na FORMA, não só
                            na cor (regra de acessibilidade — cor sozinha não
                            comunica pra quem não distingue contraste). */}
                        {ativo && <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-white" />}
                        <Icon size={18} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            <Link href="/dashboard" onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 mt-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/15 transition-all border-t border-white/10 pt-4"
              style={{ minHeight: 44 }}>
              <ArrowLeft size={18} /> <span>Voltar pro app</span>
            </Link>
          </div>
        ) : ehLabs ? (
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
                {NAV_FINANCE
                  .filter(item => !item.adminOnly || ehAdmin)
                  .map(item => <NavLink key={item.href} item={item} />)}
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
          {ehAdmin && <NavLink item={{ href: '/admin', label: 'Admin', icon: Shield }} />}
        </div>
      </nav>

      <div className="px-3 pt-3 border-t border-white/20 space-y-1.5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
        {/* Atalhos: Agentes + Drive (não rolam com a lista). Substituíram o
            toggle de tema aqui — o tema virou um círculo fixo no canto
            superior direito, em toda tela (ThemeToggle.tsx). Os dois eram os
            mais difíceis de achar (Agentes enterrado no meio da lista Geral,
            Drive dentro do grupo Grow); viraram atalho de propósito. */}
        <div className="grid grid-cols-2 gap-1.5">
          <Link href="/agentes" onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg text-[13px] font-medium text-white/85 hover:text-white bg-white/10 hover:bg-white/20 transition-all">
            <Sparkles size={16} /> Agentes
          </Link>
          <Link href="/grow/dados" onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg text-[13px] font-medium text-white/85 hover:text-white bg-white/10 hover:bg-white/20 transition-all">
            <FolderLock size={16} /> Drive
          </Link>
        </div>

        {/* Fixos: Comandos (ex-Central da Sora) + Configurações */}
        <div className="grid grid-cols-2 gap-1.5">
          <Link href="/central-sora" onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg text-[13px] font-medium text-white/85 hover:text-white bg-white/10 hover:bg-white/20 transition-all">
            <MessageCircle size={16} /> Comandos
          </Link>
          <Link href="/configuracoes" onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg text-[13px] font-medium text-white/85 hover:text-white bg-white/10 hover:bg-white/20 transition-all">
            <Settings size={16} /> Config.
          </Link>
        </div>

        {/* Perfil */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/15 backdrop-blur-sm">
          <AvatarMembro
            name={perfil?.name}
            src={perfil?.avatar_url}
            preset={perfil?.avatar_preset}
            cor={perfil?.avatar_cor}
            size="md"
            showTooltip={false}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{perfil?.name || 'Usuário'}</p>
            <p className="text-xs text-white/70 truncate">{perfil?.phone || ''}</p>
          </div>
          <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${PLANO_BADGE[plano]}`}>
            {plano}
          </span>
        </div>

        {/* Instalar app | Sair (mesma linha, economiza espaço) */}
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => { setOpen(false); abrirInstall(); }}
            className="flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg text-[13px] font-medium text-white/75 hover:text-white bg-white/10 hover:bg-white/20 transition-all">
            <Download size={16} /> Instalar
          </button>
          <button onClick={signOut}
            className="flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg text-[13px] font-medium text-white/75 hover:text-white bg-white/10 hover:bg-white/20 transition-all">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </div>
    </div>
  );

  const sidebarStyle = { background: sidebarBg };

  return (
    <>
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 shadow-xl transition-all duration-500" style={sidebarStyle}>
        {conteudo}
      </aside>

      {/* Drawer mobile — TELA CHEIA (aberto pelo ícone de perfil do BottomNav). */}
      {open && (
        <div className="md:hidden fixed inset-0 z-[60] flex flex-col animate-fade-in overscroll-contain" style={sidebarStyle}>
          {conteudo}
        </div>
      )}
    </>
  );
}

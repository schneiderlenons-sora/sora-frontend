'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, BarChart2, Landmark, CreditCard,
  Tag, Target, TrendingUp, Settings, LogOut, Menu, X, Users, ArrowLeftRight,
  Flag, Download, Receipt, Briefcase,
  Heart, ListChecks, Home as HomeIcon, Activity, GraduationCap, Sparkles, Zap,
  MessageCircle, HelpCircle, CalendarDays, ChevronDown, Lock,
  Beaker, ArrowLeft, Wallet, Rocket, Check, Gift,
  Plane, Clapperboard, BookOpen, Bug, Shield, Building2,
  Percent, CalendarRange, FolderLock, CalendarClock,
  Palette, Lightbulb, Share2, Megaphone,
  // Painel Negócios (resolvidos por nome a partir de lib/negocios-nav)
  HandCoins, FileBarChart, ShoppingCart, Package, Boxes, Truck,
  IdCard, Plug, CheckCheck, Store,
} from 'lucide-react';
import { gruposPara, rotaAtiva, rotasNavegaveis } from '@/lib/negocios-nav';
import { NAV_TOPO, GRUPOS, SECOES, type ItemNav, type SubgrupoNav } from '@/lib/sidebar-nav';
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
  badge?:  'Básico' | 'Premium' | 'Platinum'; // rótulo quando bloqueado por plano
  adminOnly?: boolean;          // só aparece pro admin (ex.: features em rollout)
  nota?:   string;              // mini texto abaixo do nome (ex.: status)
};

// ⚠️ O catálogo da navegação mora em `lib/sidebar-nav.ts` — grupos, subgrupos
// e o tom de cada seção. Aqui fica só o desenho. Antes as listas viviam neste
// arquivo e qualquer mexida na navegação obrigava a abrir o componente inteiro.

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
// ⚠️ FLAG DE MÓDULO, não estado do componente.
//
// Cada aba tem o SEU layout.tsx montando o próprio DashboardLayout, então a
// Sidebar é DESMONTADA E REMONTADA a cada troca de aba — e o efeito de
// aquecimento abaixo re-executava toda vez, disparando ~38 router.prefetch()
// mais 3 prefetch de dados. São ~41 requisições por clique, competindo com a
// navegação que o usuário acabou de pedir pelas 6 conexões que o browser abre
// por host: o app enfileirava a própria navegação atrás do próprio prefetch.
//
// `useRef`/`useState` não resolvem — morrem junto com o componente. A flag
// precisa viver no MÓDULO, que sobrevive enquanto a aba do browser existir.
//
// Guardada POR TELEFONE: trocar de conta (ou de grupo) reaquece, porque as
// rotas visíveis e os dados são outros.
let jaAqueceu: string | null = null;

type IconeLucide = React.ComponentType<{ size?: number; className?: string }>;
// Ícones da navegação do app, resolvidos pelo NOME vindo de lib/sidebar-nav.
const ICONES_APP: Record<string, IconeLucide> = {
  LayoutDashboard, Briefcase, ArrowLeftRight, Landmark, CreditCard, Building2,
  Receipt, Flag, Target, BarChart2, Tag, TrendingUp, Percent, ListChecks,
  CalendarDays, GraduationCap, Activity, Heart, Home: HomeIcon, Plane,
  Clapperboard, BookOpen, Users, Zap, Bug, Palette, Gift, Lightbulb, Share2,
  Megaphone, Shield, CalendarClock,
};

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
  const { perfil, phone, signOut, podeUsar, temNegocios, temAcessoGrow, trialAtivo, diasTrialRestantes } = useAuth();
  const ehAdmin = isAdminEmail(perfil?.email);

  // Aquece TODAS as abas principais no tempo ocioso → clicar em qualquer uma
  // (inclusive no mobile, onde não há hover) já é instantâneo, porque a rota
  // (RSC + chunk) já foi baixada. Não compete com o LCP do dashboard (roda no
  // ocioso, low-priority) e o recharts é dynamic → não vem no chunk da rota.
  useEffect(() => {
    if (!phone) return;
    if (jaAqueceu === phone) return;   // já aqueceu nesta sessão
    const rotas = [
      ...NAV_TOPO.map((i) => i.href),
      ...GRUPOS.flatMap((g) => g.subgrupos.flatMap((sg) => sg.itens.map((i) => i.href))),
      '/wrapped', '/ajuda', '/central-sora', '/planos', '/configuracoes', '/agentes', '/grow/dados',
    ];
    const warm = () => {
      // ⚠️ A FLAG É MARCADA AQUI DENTRO, não na entrada do efeito. Se o
      // componente desmontar antes de o navegador ficar ocioso, o cleanup
      // cancela o callback e NADA foi aquecido — marcar antes deixaria o
      // app sem prefetch nenhum pelo resto da sessão.
      if (jaAqueceu === phone) return;
      jaAqueceu = phone;
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

  // Qual das duas formas da sidebar existe (ver o bloco no final do arquivo).
  // `null` = ainda não sei — é o estado do servidor e da 1ª renderização.
  const [ehDesktop, setEhDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const ler = () => setEhDesktop(mq.matches);
    ler();
    mq.addEventListener('change', ler);
    return () => mq.removeEventListener('change', ler);
  }, []);

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

  // ═══ Item de navegação ═══════════════════════════════════════════════════
  //
  // Anatomia:  [barra do ativo] [chip 28×28] Rótulo ............ [badge/cadeado]
  //
  // ⚠️ O ÍCONE É SEMPRE BRANCO. O fundo da sidebar é a cor da marca e existem 6
  // paletas — ícone colorido some na paleta da mesma família e vibra na
  // complementar. A cor da seção vive no ponto do cabeçalho e na espinha
  // (ver a nota sobre `tom` em lib/sidebar-nav.ts).
  //
  // ⚠️ O ATIVO NÃO SE ANUNCIA SÓ POR COR: ganha barra à esquerda (forma), peso
  // de fonte (tipografia), fundo e `aria-current`. Regra `color-not-only` +
  // `nav-state-active` — quem não distingue contraste continua sabendo onde está.
  // O chip do ativo INVERTE (branco sólido, ícone na cor da marca): é o único
  // ponto em que a marca aparece como matiz, e como é a própria `--primary`
  // nunca briga com o fundo, em nenhuma das 6 paletas nem no tema black.
  // ⚠️ FUNÇÃO DE RENDER, NÃO COMPONENTE — e a diferença aqui é visível.
  //
  // Enquanto isto era `<NavLink/>`, o React via um TIPO NOVO a cada render da
  // Sidebar (a função é recriada junto com o corpo do componente). Tipo novo =
  // desmonta e monta de novo, então o `animate-[fade-in]` dos itens TOCAVA
  // OUTRA VEZ. E a Sidebar re-renderiza a cada navegação (usa `usePathname`
  // pro item ativo) — ou seja, a barra piscava a CADA clique de aba.
  //
  // Chamada como função (`{navLink({...})}`), ela devolve os elementos direto
  // na árvore de quem chama: não existe identidade de componente pra mudar, e
  // o React só reconcilia o que de fato mudou.
  //
  // ⚠️ Hoistar pra fora do componente também resolveria, mas exigiria passar
  // ~8 valores de escopo (tema, gates, router, phone) como props em cascata.
  // Como nenhuma destas usa hooks, virar função de render é equivalente e não
  // reescreve a cascata inteira.
  //
  // `chave` existe porque em `.map()` o key precisa ir no elemento devolvido.
  /**
   * Atalho do rodapé (Agentes, Drive).
   *
   * ⚠️ FUNÇÃO DE RENDER, não componente. Componente declarado dentro de
   * componente é recriado a cada render, e pro React isso é um TIPO novo —
   * ele desmonta e monta a árvore, refazendo a animação de entrada. Foi
   * exatamente a causa do "os itens da sidebar piscam" já corrigido aqui.
   *
   * Bloqueado NÃO some: continua visível, apagado e com cadeado, e abre a
   * própria aba, onde o card de convite explica o que ela faz. Sumir
   * esconderia que a função existe.
   */
  function atalho(href: string, label: string, icone: React.ReactNode, liberado: boolean) {
    const fundo = isTemaBlack
      ? 'bg-black/40 hover:bg-black/55 border border-white/5'
      : 'bg-white/10 hover:bg-white/20';
    return (
      <Link
        // Bloqueado também abre a própria aba: o guard de rota mostra o card
        // de convite ali, com o nome dela. Ver o comentário em `destino`.
        href={href}
        onClick={() => setOpen(false)}
        title={liberado ? label : `${label} — disponível a partir do plano Básico`}
        className={`flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg text-[13px] font-medium transition-all ${fundo} ${
          liberado ? 'text-white/85 hover:text-white' : 'text-white/40 hover:text-white/60'
        }`}
      >
        {icone} {label}
        {!liberado && <Lock size={12} className="flex-shrink-0" />}
      </Link>
    );
  }

  function navLink({ item, grow = false, chave }: { item: ItemNav; grow?: boolean; chave?: string }) {
    const { href, label, gate, badge, breve, externa } = item;
    const Icon = ICONES_APP[item.icone] || Sparkles;

    // Chip base: no tema BLACK o branco "acende" demais sobre o preto — mesma
    // observação que já valia pros atalhos do rodapé.
    const chipBase = isTemaBlack ? 'bg-white/[0.07]' : 'bg-white/[0.13]';

    // Aba que ainda não existe: aparece pra dar noção do todo, mas não navega.
    // 404 é pior que "em breve" (mesma regra do painel Negócios).
    if (breve) {
      return (
        <span
          key={chave}
          aria-disabled="true"
          title={`${label} — em breve`}
          className="flex items-center gap-3 pl-2 pr-2 rounded-xl text-[13.5px] text-white/40 cursor-default select-none"
          style={{ minHeight: 44 }}
        >
          <span className={`grid place-items-center w-7 h-7 rounded-[9px] flex-shrink-0 ${chipBase}`}>
            <Icon size={15} />
          </span>
          <span className="flex-1 truncate">{label}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/45 flex-shrink-0">
            em breve
          </span>
        </span>
      );
    }

    const growLocked = grow && !temAcessoGrow;
    // ⚠️ Negócios NÃO passa por `podeUsar`: o gate dele soma o direito adquirido
    // e o vitalício (temNegocios). Usar podeUsar aqui trancaria a aba de quem já
    // a usa — o item sumiria da barra do dia pra noite.
    const gateLocked = gate === 'negocios' ? !temNegocios : gate ? !podeUsar(gate) : false;
    const locked     = growLocked || gateLocked;
    // ⚠️ ITEM BLOQUEADO POR PLANO ABRE A PRÓPRIA ABA, não o /planos.
    //
    // Cada uma delas renderiza o convite no próprio lugar (`AbaBloqueada`,
    // `PaywallPremium`, o upsell do Open Finance…), com o nome da aba e o que
    // ela faz. Mandar pro /planos direto tirava a pessoa do contexto: ela
    // clicava em "Saúde" e caía numa tabela de preços sem nada dizendo qual
    // aba tinha pedido.
    //
    // `growLocked` continua indo pro /grow/upgrade: ali não é uma aba, é o
    // Grow inteiro, e essa página existe só pra isso.
    const destino    = growLocked ? '/grow/upgrade' : href;
    // Item com query (`?aba=`) nunca marca ativo: o pathname é o mesmo da aba
    // inteira e ele acenderia junto com ela.
    const ativo      = !locked && !externa && isActive(href);
    const badgeText  = growLocked ? 'Premium' : badge;
    const corBadge   = badgeText === 'Platinum' ? 'bg-violet-600 text-white' : 'bg-white text-emerald-700';

    return (
      <Link
        key={chave}
        href={destino}
        // Hover no desktop prefetcha ROTA + DADOS daquela aba → o clique já
        // encontra tudo pronto. No mobile NÃO: prefetch no touchstart adiciona
        // jank ao próprio toque, e o aquecimento ocioso já baixou a rota.
        onMouseEnter={() => { router.prefetch(destino); prefetchRota(destino, phone); }}
        // ⚠️ prefetch={false} é PERFORMANCE, não detalhe: a sidebar fica sempre
        // visível, então o prefetch automático do Next baixava TODAS as rotas de
        // uma vez — e /investimentos, /metas, /relatorios e /juros carregam
        // recharts (~288 KB cada). Medido: 3 MB de JS no dashboard sem desenhar
        // um gráfico.
        prefetch={false}
        onClick={() => setOpen(false)}
        aria-current={ativo ? 'page' : undefined}
        aria-disabled={locked || undefined}
        title={locked ? `Disponível no plano ${badgeText || 'Premium'}` : label}
        className={`group relative flex items-center gap-3 pl-2 pr-2 rounded-xl text-[13.5px] transition-all duration-200 ${
          ativo
            ? 'bg-white/[0.18] text-white font-semibold shadow-sm ring-1 ring-inset ring-white/20'
            : locked
              ? 'text-white/45 hover:text-white/75 hover:bg-white/[0.08]'
              : 'text-white/85 hover:text-white hover:bg-white/[0.10]'
        }`}
        style={{ minHeight: 44 }}
      >
        {ativo && (
          <span aria-hidden className="absolute -left-[9px] top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-white" />
        )}
        <span
          className={`grid place-items-center w-7 h-7 rounded-[9px] flex-shrink-0 transition-all duration-200 ${
            ativo ? 'shadow-sm' : `${chipBase} group-hover:bg-white/20`
          }`}
          style={ativo ? { background: 'rgba(255,255,255,0.95)', color: 'hsl(var(--primary))' } : undefined}
        >
          <Icon size={15} />
        </span>
        <span className="flex-1 min-w-0 truncate">{label}</span>
        {locked && (
          badgeText
            ? <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${corBadge}`}>{badgeText}</span>
            : <Lock size={13} className="text-white/55 flex-shrink-0" />
        )}
      </Link>
    );
  }

  // ── Cabeçalho de subgrupo: ponto de cor + rótulo ──
  // O ponto é decorativo (`aria-hidden`); quem informa é o texto ao lado.
  function subHeader({ titulo, tom }: { titulo: string; tom: string }) {
    return (
      <div className="flex items-center gap-2 px-2 pt-3 pb-1.5">
        <span
          aria-hidden
          className="w-[7px] h-[7px] rounded-full flex-shrink-0"
          style={{ background: tom, boxShadow: `0 0 0 3px ${tom}26` }}
        />
        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/55">{titulo}</span>
      </div>
    );
  }

  // ── Pilha de itens de um subgrupo, com a espinha colorida à esquerda ──
  // ⚠️ A espinha vai em `style`, não em classe do Tailwind: no v4 um
  // `border-l` sem o shorthand completo some por causa do preflight (regra
  // registrada no CLAUDE.md).
  function subgrupo({ sg, grow = false, from = 0 }: { sg: SubgrupoNav; grow?: boolean; from?: number }) {
    return (
      <div key={sg.id}>
        {subHeader({ titulo: sg.titulo, tom: sg.tom })}
        <div
          className="ml-[6px] pl-[10px] space-y-0.5"
          style={{ borderLeft: `1px solid ${sg.tom}30` }}
        >
          {sg.itens.map((item, i) => (
            <div
              key={item.href}
              className="animate-[fade-in_220ms_ease-out_both] motion-reduce:animate-none"
              style={{ animationDelay: `${Math.min((from + i) * 22, 260)}ms` }}
            >
              {navLink({ item, grow })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Cabeçalho de grupo (nível 1, colapsável) ──
  function groupHeader({ label, open: aberto, onToggle, locked = false, trial }:
    { label: string; open: boolean; onToggle: () => void; locked?: boolean; trial?: number }) {
    return (
      <button
        onClick={onToggle}
        aria-expanded={aberto}
        className="w-full flex items-center gap-2 px-2 py-2 mt-3 rounded-xl text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors"
        style={{ minHeight: 40 }}
      >
        {locked && <Lock size={11} className="text-white/55 flex-shrink-0" />}
        <span className="text-[11px] font-extrabold uppercase tracking-[0.16em]">{label}</span>
        {locked && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white text-emerald-700">Premium</span>
        )}
        {trial != null && trial > 0 && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-300 text-yellow-900">{trial}d</span>
        )}
        <ChevronDown
          size={14}
          className={`ml-auto flex-shrink-0 transition-transform duration-200 ${aberto ? '' : '-rotate-90'}`}
        />
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
          /* ── NAV do app (topo + grupos + seções) ──
             Hierarquia em três níveis, e é ela que organiza a barra:
               topo (sem grupo) → grupo colapsável → subgrupo com ponto de cor.
             Regra `nav-hierarchy`: navegação primária (Finanças/Grow) e
             secundária (Ajustes/Sua conta) ficam visualmente separadas. */
          <>
            {/* Fora de qualquer grupo: é onde se troca de CONTEXTO.
                ⚠️ Negócios mora aqui, não dentro de Finanças — ele abre outro
                painel, com switcher e navegação próprios. */}
            <div className="space-y-0.5">
              {NAV_TOPO.map(item => navLink({ item, chave: item.href }))}
            </div>

            {GRUPOS.map(g => {
              const aberto    = g.id === 'grow' ? openGrow : openFin;
              const alternar  = g.id === 'grow' ? toggleGrow : toggleFin;
              const bloqueado = !!g.grow && !temAcessoGrow;
              return (
                <div key={g.id}>
                  {groupHeader({
                    label: g.titulo,
                    open: aberto,
                    onToggle: alternar,
                    locked: bloqueado,
                    trial: g.grow && temAcessoGrow && trialAtivo ? diasTrialRestantes : undefined,
                  })}
                  {aberto && (
                    <div className="mt-0.5">
                      {g.subgrupos.map((sg, si) => (
                        subgrupo({
                          sg,
                          grow: !!g.grow,
                          // A entrada escalonada continua de um subgrupo pro
                          // outro em vez de reiniciar — senão a abertura do
                          // grupo pisca em blocos, em vez de escorrer.
                          from: g.subgrupos.slice(0, si).reduce((acc, x) => acc + x.itens.length, 0),
                        })
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Seções planas — visíveis em qualquer painel e SEM colapso.
            ⚠️ De propósito: é aqui que cai quem está PROCURANDO alguma coisa
            (planos, suporte, aparência). Esconder atrás de mais um clique
            economiza altura e cobra descoberta — troca ruim. */}
        <div className="mt-3 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          {SECOES.map(sg => subgrupo({ sg }))}
          {ehAdmin && (
            <div className="mt-0.5 ml-[6px] pl-[10px]" style={{ borderLeft: '1px solid #E2E8F030' }}>
              {navLink({ item: { href: '/admin', label: 'Admin', icone: 'Shield' } })}
            </div>
          )}
        </div>
      </nav>

      <div className="px-3 pt-3 border-t border-white/20 space-y-1.5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
        {/* Atalhos: Agentes + Drive (não rolam com a lista). Substituíram o
            toggle de tema aqui — o tema virou um círculo fixo no canto
            superior direito, em toda tela (ThemeToggle.tsx). Os dois eram os
            mais difíceis de achar (Agentes enterrado no meio da lista Geral,
            Drive dentro do grupo Grow); viraram atalho de propósito.
            ⚠️ SÓ estes 4 (+Ajuda/Config abaixo) ficam mais escuros no
            tema BLACK — quase a cor do próprio fundo da sidebar, porque
            bg-white/10 "acendia" demais em cima do preto. Instalar/Sair
            (mais abaixo) continuam no bg-white/10 de sempre, nos dois temas:
            só os 4 atalhos do topo tinham a queixa de "chamativo demais". */}
        {/* ⚠️ ESTES DOIS ATALHOS NÃO PASSAM PELO CATÁLOGO `ItemNav`, então o
            `gate:` de lá não os alcança — o gate tem de ser na mão. Foi
            justamente por viverem fora do catálogo que Agentes e Drive
            ficaram anos sem gate nenhum. */}
        <div className="grid grid-cols-2 gap-1.5">
          {atalho('/agentes', 'Agentes', <Sparkles size={16} />, podeUsar('agentes'))}
          {atalho('/grow/dados', 'Drive', <FolderLock size={16} />, podeUsar('drive_painel'))}
        </div>

        {/* Fixos: Ajuda (ex-Comandos, ex-Central da Sora) + Configurações */}
        <div className="grid grid-cols-2 gap-1.5">
          <Link href="/ajuda" onClick={() => setOpen(false)}
            className={`flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg text-[13px] font-medium text-white/85 hover:text-white transition-all ${
              isTemaBlack ? 'bg-black/40 hover:bg-black/55 border border-white/5' : 'bg-white/10 hover:bg-white/20'
            }`}>
            <HelpCircle size={16} /> Ajuda
          </Link>
          <Link href="/configuracoes" onClick={() => setOpen(false)}
            className={`flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg text-[13px] font-medium text-white/85 hover:text-white transition-all ${
              isTemaBlack ? 'bg-black/40 hover:bg-black/55 border border-white/5' : 'bg-white/10 hover:bg-white/20'
            }`}>
            <Settings size={16} /> Config.
          </Link>
        </div>

        {/* Perfil */}
        <Link href="/configuracoes" onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm transition-colors"
          style={{ minHeight: 44 }}>
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
        </Link>

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

  // ═══════════════════════════════════════════════════════════════════════════
  // ⚠️ UMA ÁRVORE SÓ — ANTES O `conteudo` ERA MONTADO DUAS VEZES.
  //
  // Ele aparecia no `<aside>` E no drawer. No mobile o `<aside>` é
  // `hidden md:flex`, ou seja, `display:none` — mas o React MONTA E RENDERIZA
  // a árvore inteira mesmo assim. Então o celular pagava a sidebar completa
  // (~40 itens, avatar, switcher) o tempo todo, invisível, e ao tocar no menu
  // montava uma SEGUNDA cópia inteira de uma vez. Era o "custa abrir".
  //
  // Agora renderiza só a que vale pro tamanho de tela. E no mobile o drawer
  // fica SEMPRE montado, apenas deslocado pra fora: abrir vira um `translate`
  // (composto na GPU, instantâneo) em vez de uma montagem.
  //
  // ⚠️ `ehDesktop` começa `null` de propósito. No servidor não existe
  // viewport; se eu chutasse um valor, a primeira renderização do cliente
  // poderia discordar e dar hydration mismatch. Com `null` os dois lados
  // desenham o `<aside>` (que o CSS já esconde no mobile) e o efeito decide
  // depois, com a medida real.
  // ═══════════════════════════════════════════════════════════════════════════
  if (ehDesktop === false) {
    return (
      <div
        className={`md:hidden fixed inset-0 z-[60] flex flex-col overscroll-contain
                    transition-transform duration-300 ease-out motion-reduce:transition-none
                    ${open ? 'translate-x-0' : '-translate-x-full pointer-events-none'}`}
        style={sidebarStyle}
        // ⚠️ Fechado, ele continua no DOM — então precisa sair do alcance do
        // toque E da árvore de acessibilidade. Sem isto eu criaria de novo o
        // bug que acabei de corrigir: um painel invisível engolindo toque.
        aria-hidden={!open}
        inert={!open}
      >
        {conteudo}
      </div>
    );
  }

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 shadow-xl transition-all duration-500" style={sidebarStyle}>
      {conteudo}
    </aside>
  );
}

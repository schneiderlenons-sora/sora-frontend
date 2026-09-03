'use client';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { navPaleta } from '@/lib/nav-cores';
import { Crown, Pencil, Eye } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { papel, perfil } = useAuth();
  const { theme } = useTheme();
  // `montado` evita hydration mismatch: no servidor não há tema resolvido.
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);
  const paletaNav = navPaleta(theme, montado);

  // ═══════════════════════════════════════════════════════════════════════════
  // ⚠️ QUEM PINTA A FAIXA DO HOME-INDICATOR É O FUNDO DE `html`/`body`.
  //
  // Não é o `theme-color` nem o gradiente aqui embaixo — tentei os dois e a cor
  // não mudou. Quem entregou foi a MEDIÇÃO: a faixa é exatamente
  // `hsl(var(--bg))`, que o globals.css aplica em `html` e `body`
  // (claro `220 20% 97%` = #F5F6F8; black `240 10% 4%` = #0A0A0B). É por isso
  // que no tema black a faixa parecia "preta, mas não tão preta quanto a barra":
  // ela É #0A0A0B contra o #000 da barra.
  //
  // ⚠️ ESCOPADO AO PAINEL, por isso está aqui e não no CSS global: `--bg` é o
  // fundo de TODA a aplicação, landing e login inclusive. Trocá-lo globalmente
  // pra cor da barra mudaria o fundo de páginas que nem têm barra. O cleanup
  // devolve o valor anterior ao sair do painel.
  //
  // Estilo inline de propósito: precisa vencer a regra do globals.css sem
  // depender de `!important` nem de ordem de folha.
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const antesHtml = html.style.backgroundColor;
    const antesBody = body.style.backgroundColor;
    html.style.backgroundColor = paletaNav.superficie;
    body.style.backgroundColor = paletaNav.superficie;
    return () => {
      html.style.backgroundColor = antesHtml;
      body.style.backgroundColor = antesBody;
    };
  }, [paletaNav.superficie]);

  const grupoNome = perfil?.grupo_ativo?.nome || '';
  const ehPessoal = /pessoal/i.test(grupoNome);
  // Drawer mobile (sidebar em tela cheia), aberto pelo ícone de perfil do BottomNav.
  const [navOpen, setNavOpen] = useState(false);

  // Em grupo Pessoal o usuário é sempre admin, esconde o badge para não poluir
  const mostrarBadge = !ehPessoal && papel;

  return (
    <div
      className="flex h-dvh md:h-screen overflow-hidden"
      // Fundo = --bg, MENOS a faixa do home-indicator (safe-area), que recebe
      // a cor da BARRA.
      //
      // ⚠️ Antes era `--bg-card`, "pra casar com o BottomNav (que é bg-card)".
      // Quando a barra ganhou paleta própria (branca no claro, preta no black)
      // esta linha ficou pra trás e apareceu um DEGRAU DE COR logo abaixo dela.
      // Lendo de `lib/nav-cores`, a faixa acompanha a barra sozinha.
      style={{
        background:
          `linear-gradient(to bottom, hsl(var(--bg)) calc(100% - env(safe-area-inset-bottom, 0px)), ${paletaNav.superficie} calc(100% - env(safe-area-inset-bottom, 0px)))`,
      }}
    >
      <Sidebar mobileOpen={navOpen} onMobileClose={() => setNavOpen(false)} />
      <main
        className="
          flex-1 overflow-y-auto relative
          px-4 sm:px-6
          pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] md:pt-6
          pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:pb-6
        "
      >
        {mostrarBadge && <PapelBadge papel={papel} />}
        {children}
      </main>
      <BottomNav onPerfil={() => setNavOpen(true)} />
      <ThemeToggle />
    </div>
  );
}

function PapelBadge({ papel }: { papel: 'admin' | 'escrita' | 'leitura' }) {
  const cfg = {
    admin:   { icon: Crown,  label: 'Admin',        bg: 'bg-green-100 dark:bg-green-950/40',   fg: 'text-green-700 dark:text-green-400'   },
    escrita: { icon: Pencil, label: 'Editor',       bg: 'bg-blue-100 dark:bg-blue-950/40',     fg: 'text-blue-700 dark:text-blue-400'     },
    leitura: { icon: Eye,    label: 'Modo leitura', bg: 'bg-zinc-100 dark:bg-zinc-900/60',     fg: 'text-zinc-600 dark:text-zinc-300'     },
  }[papel];
  const Icon = cfg.icon;
  // right-16 (não right-4): deixa espaço pro círculo de tema, que agora é FIXO
  // no canto superior direito em toda tela (ver ThemeToggle.tsx) — os dois
  // colidiam quando o badge aparecia (grupo compartilhado, não-Pessoal).
  return (
    <div className={`hidden md:inline-flex absolute top-4 right-16 z-10 items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.fg}`}>
      <Icon size={11} />
      {cfg.label}
    </div>
  );
}

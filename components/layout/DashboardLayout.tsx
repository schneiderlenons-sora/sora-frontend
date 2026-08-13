'use client';
import { useState } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { Crown, Pencil, Eye } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { papel, perfil } = useAuth();
  const grupoNome = perfil?.grupo_ativo?.nome || '';
  const ehPessoal = /pessoal/i.test(grupoNome);
  // Drawer mobile (sidebar em tela cheia), aberto pelo ícone de perfil do BottomNav.
  const [navOpen, setNavOpen] = useState(false);

  // Em grupo Pessoal o usuário é sempre admin, esconde o badge para não poluir
  const mostrarBadge = !ehPessoal && papel;

  return (
    <div
      className="flex h-dvh md:h-screen overflow-hidden"
      // Fundo = --bg, MENOS a faixa do home-indicator (safe-area) que fica
      // --bg-card, pra casar com o BottomNav (que é bg-card). No black mode
      // --bg == --bg-card, então a faixa some sozinha; no desktop env()=0.
      style={{
        background:
          'linear-gradient(to bottom, hsl(var(--bg)) calc(100% - env(safe-area-inset-bottom, 0px)), hsl(var(--bg-card)) calc(100% - env(safe-area-inset-bottom, 0px)))',
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

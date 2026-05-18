'use client';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { Crown, Pencil, Eye } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { papel, perfil } = useAuth();
  const grupoNome = perfil?.grupo_ativo?.nome || '';
  const ehPessoal = /pessoal/i.test(grupoNome);

  // Em grupo Pessoal o usuário é sempre admin, esconde o badge para não poluir
  const mostrarBadge = !ehPessoal && papel;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 relative">
        {mostrarBadge && <PapelBadge papel={papel} />}
        {children}
      </main>
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
  return (
    <div className={`hidden md:inline-flex absolute top-4 right-4 z-10 items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.fg}`}>
      <Icon size={11} />
      {cfg.label}
    </div>
  );
}

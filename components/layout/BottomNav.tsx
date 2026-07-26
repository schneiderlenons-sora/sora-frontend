'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { mutate } from 'swr';
import { Home, List, Plus, BarChart2, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import QuickAddSheet from '@/components/dashboard/QuickAddSheet';
import NovaTransacaoModal from '@/components/dashboard/NovaTransacaoModal';

// Barra de navegação inferior — SÓ mobile (md:hidden). 5 atalhos, com o "+"
// central elevado. É a navegação primária no mobile: Dashboard · Transações ·
// Registrar · Relatórios · Perfil (abre a sidebar em tela cheia). Guias
// ui-ux-pro-max: bottom-nav-limit(≤5), nav-state-active, safe-area, toque ≥44px.
export default function BottomNav({ onPerfil }: { onPerfil: () => void }) {
  const pathname = usePathname();
  const { phone } = useAuth();
  const [quickOpen, setQuickOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [wallets, setWallets] = useState<any[]>([]);

  // Pré-carrega as contas quando o menu de adicionar abre (pro modal já vir pronto).
  useEffect(() => {
    if (!(quickOpen || modalOpen) || !phone || wallets.length) return;
    api.wallets.listar(phone).then(w => setWallets(w || [])).catch(() => setWallets([]));
  }, [quickOpen, modalOpen, phone, wallets.length]);

  const ativo = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  const Item = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => {
    const on = ativo(href);
    return (
      <Link href={href} aria-label={label} aria-current={on ? 'page' : undefined}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full min-w-0 active:scale-95 transition-transform">
        <Icon size={22} className={on ? 'text-primary' : 'text-muted-foreground'} strokeWidth={on ? 2.4 : 2} />
        <span className={`text-[10px] leading-none font-medium ${on ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span>
      </Link>
    );
  };

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Navegação principal"
      >
        <div className="flex items-stretch h-14 px-1">
          <Item href="/dashboard"  icon={Home}     label="Início" />
          <Item href="/transacoes" icon={List}     label="Transações" />

          {/* + central elevado */}
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={() => setQuickOpen(true)}
              aria-label="Adicionar"
              className="w-14 h-14 -mt-6 rounded-2xl flex items-center justify-center text-white shadow-glow active:scale-90 transition-transform"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), #3dd68c)' }}
            >
              <Plus size={26} strokeWidth={2.6} />
            </button>
          </div>

          <Item href="/relatorios" icon={BarChart2} label="Relatórios" />

          <button onClick={onPerfil} aria-label="Menu e perfil"
            className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full min-w-0 active:scale-95 transition-transform">
            <User size={22} className="text-muted-foreground" />
            <span className="text-[10px] leading-none font-medium text-muted-foreground">Perfil</span>
          </button>
        </div>
      </nav>

      <QuickAddSheet
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        onNovaTransacao={() => setModalOpen(true)}
      />

      {modalOpen && (
        <NovaTransacaoModal
          phone={phone}
          wallets={wallets}
          onClose={() => setModalOpen(false)}
          onSuccess={() => { mutate(() => true); }}
        />
      )}
    </>
  );
}

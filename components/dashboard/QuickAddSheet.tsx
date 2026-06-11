'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeftRight, CalendarDays, Target, ListChecks, TrendingUp, Crown,
} from 'lucide-react';

type Atalho = {
  label: string;
  icon: any;
  cor: string;
  onClick?: () => void;
  href?: string;
  locked?: boolean;
};

export default function QuickAddSheet({
  open, onClose, onNovaTransacao,
}: { open: boolean; onClose: () => void; onNovaTransacao: () => void }) {
  const router = useRouter();
  const { podeUsar } = useAuth();
  const [render, setRender] = useState(open);
  const [shown, setShown]   = useState(false);
  const [dragY, setDragY]   = useState(0);
  const dragging = useRef(false);
  const startY   = useRef(0);

  // Enter/exit animado
  useEffect(() => {
    if (open) {
      setRender(true);
      const r = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => { setRender(false); setDragY(0); }, 250);
    return () => clearTimeout(t);
  }, [open]);

  if (!render) return null;

  const temInvest = podeUsar('investimentos');

  const atalhos: Atalho[] = [
    { label: 'Nova transação', icon: ArrowLeftRight, cor: 'hsl(var(--primary))', onClick: () => { onClose(); onNovaTransacao(); } },
    { label: 'Compromisso',    icon: CalendarDays,   cor: '#2563eb', href: '/grow/agenda' },
    { label: 'Hábito',         icon: Target,         cor: '#16a34a', href: '/grow/habitos' },
    { label: 'Tarefa',         icon: ListChecks,     cor: '#7c3aed', href: '/grow/tarefas' },
    { label: 'Investimento',   icon: TrendingUp,     cor: '#0ea5e9', href: temInvest ? '/investimentos' : '/planos', locked: !temInvest },
  ];

  function go(a: Atalho) {
    if (a.onClick) { a.onClick(); return; }
    onClose();
    if (a.href) router.push(a.href);
  }

  // Swipe pra baixo fecha
  function onTouchStart(e: React.TouchEvent) { dragging.current = true; startY.current = e.touches[0].clientY; }
  function onTouchMove(e: React.TouchEvent) {
    if (!dragging.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  }
  function onTouchEnd() {
    dragging.current = false;
    if (dragY > 90) onClose();
    else setDragY(0);
  }

  return (
    <div className="md:hidden fixed inset-0 z-[70] flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-200"
        style={{ opacity: shown ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full rounded-t-3xl border-t border-border shadow-2xl"
        style={{
          background: 'hsl(var(--bg-card))',
          transform: shown ? `translateY(${dragY}px)` : 'translateY(100%)',
          transition: dragging.current ? 'none' : 'transform 250ms cubic-bezier(0.32,0.72,0,1)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25" />
        </div>

        <p className="text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground pt-1 pb-4">
          Adicionar
        </p>

        <div className="grid grid-cols-3 gap-2.5 px-4">
          {atalhos.map(a => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={() => go(a)}
                className="relative flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border border-border/60 bg-muted/30 hover:bg-muted/60 active:scale-[0.97] transition-all"
                style={{ minHeight: 88 }}
              >
                {a.locked && (
                  <span className="absolute top-1.5 right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-amber-400">
                    <Crown size={9} className="text-amber-900" />
                  </span>
                )}
                <span className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: `color-mix(in srgb, ${a.cor} 14%, transparent)` }}>
                  <Icon size={20} style={{ color: a.cor }} />
                </span>
                <span className="text-xs font-medium text-foreground text-center leading-tight">{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

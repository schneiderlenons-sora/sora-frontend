'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Crown, X, ArrowRight, MessageCircle } from 'lucide-react';

// Banner de upsell mostrado SÓ pra quem tem o Kit (R$47) — leva pro upgrade
// vitalício de +R$50 (vira Sora Completa). Dispensável (por dispositivo).
export default function KitUpsellBanner() {
  const { isKit, perfil } = useAuth();
  const [oculto, setOculto] = useState(true);
  const chave = `sora_kit_upsell_${perfil?.id || ''}`;

  useEffect(() => {
    if (!isKit) { setOculto(true); return; }
    try { setOculto(localStorage.getItem(chave) === '1'); } catch { setOculto(false); }
  }, [isKit, chave]);

  if (!isKit || oculto) return null;

  function dispensar() {
    try { localStorage.setItem(chave, '1'); } catch { /* quota */ }
    setOculto(true);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 p-4 sm:p-5 animate-fade-in"
         style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none opacity-20"
           style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 60%)' }} />
      <button onClick={dispensar} aria-label="Dispensar"
              className="absolute top-2.5 right-2.5 p-1 rounded-lg text-muted-foreground hover:text-foreground z-10">
        <X size={16} />
      </button>
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 pr-6 sm:pr-0">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-400/15">
          <Crown size={22} className="text-amber-500 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Você tem o Kit</p>
          <p className="font-bold text-foreground leading-tight mt-0.5">Desbloqueie a Sora no WhatsApp + tudo por só <span className="text-amber-600 dark:text-amber-400">+R$50</span></p>
          <p className="text-sm text-muted-foreground mt-0.5 leading-snug">Registrar por texto, áudio e foto, Open Finance, painel do casal e o Sora Grow — pagamento único, pra sempre.</p>
        </div>
        <Link href="/checkout-vitalicio?tier=upgrade"
              className="flex-shrink-0 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-black transition active:scale-[0.98] hover:brightness-105"
              style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}>
          <MessageCircle size={16} /> Fazer upgrade <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}

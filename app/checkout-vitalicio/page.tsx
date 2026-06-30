'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import MercadoPagoBrick from '@/components/checkout/MercadoPagoBrick';
import { Crown, ShieldCheck } from 'lucide-react';

// Checkout transparente do vitalício (dentro do site). Acessado pelo signup
// (?vitalicio=1) e pela /planos. Exige login; ao aprovar, vai pra /planos.
export default function CheckoutVitalicioPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/signup?vitalicio=1');
  }, [loading, user, router]);

  const onApproved = useCallback(() => {
    router.replace('/planos?success=1&vitalicio=1');
  }, [router]);

  return (
    <main className="min-h-dvh bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 mb-3">
            <Crown size={14} className="text-amber-500 dark:text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Black Vitalício</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Garantir acesso vitalício</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pague uma única vez — <strong className="text-foreground">12x de R$9,87</strong> ou 1x de R$97,00. Black para sempre.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <MercadoPagoBrick amount={97} onApproved={onApproved} />
        </div>

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck size={13} /> Pagamento seguro via Mercado Pago
        </p>
      </div>
    </main>
  );
}

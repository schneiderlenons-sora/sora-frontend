'use client';

import { Suspense, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import MercadoPagoBrick from '@/components/checkout/MercadoPagoBrick';
import { Crown, ShieldCheck } from 'lucide-react';

// Checkout transparente vitalício (dentro do site). tier=kit (R$47, sem
// WhatsApp) ou completa (R$97, tudo). Sem tier → completa. O VALOR REAL é
// definido no servidor (/api/mercadopago/process) pelo tier — nunca no cliente.
const TIERS = {
  kit:      { amount: 47, titulo: 'Kit Organização',      selo: 'Acesso Vitalício' },
  completa: { amount: 97, titulo: 'Sora Completa',        selo: 'Acesso Vitalício' },
  upgrade:  { amount: 50, titulo: 'Upgrade pra Completa', selo: 'Upgrade Vitalício' },
} as const;

function CheckoutContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get('tier');
  const tier = (raw === 'kit' || raw === 'upgrade' ? raw : 'completa') as keyof typeof TIERS;
  const t = TIERS[tier];

  useEffect(() => {
    if (!loading && !user) router.replace(`/signup?vitalicio=1&tier=${tier}`);
  }, [loading, user, router, tier]);

  const onApproved = useCallback(() => {
    // Upgrade do Kit → Completa: agora ele TEM WhatsApp, então pede o número.
    router.replace(tier === 'upgrade' ? '/vincular-whatsapp?upgrade=1' : '/planos?success=1&vitalicio=1');
  }, [router, tier]);

  return (
    <main className="min-h-dvh bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 mb-3">
            <Crown size={14} className="text-amber-500 dark:text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">{t.selo}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t.titulo}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pague uma única vez — <strong className="text-foreground">R${t.amount},00</strong> em até 12x ou Pix. Pra sempre.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <MercadoPagoBrick amount={t.amount} tier={tier} onApproved={onApproved} />
        </div>

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck size={13} /> Pagamento seguro via Mercado Pago · 7 dias de garantia
        </p>
      </div>
    </main>
  );
}

export default function CheckoutVitalicioPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-background" />}>
      <CheckoutContent />
    </Suspense>
  );
}

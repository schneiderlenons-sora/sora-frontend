'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { useAuth } from '@/contexts/AuthContext';
import MercadoPagoBrick, { MP_SDK_ID, MP_SDK_SRC } from '@/components/checkout/MercadoPagoBrick';
import AuthHero from '@/components/auth/AuthHero';
import { aplicarCupomVitalicio, pctCupom } from '@/lib/cupons';
import { trackAddToCart, trackInitiateCheckout } from '@/lib/analytics';
import { Crown, ShieldCheck, Check, Tag, Loader2, X } from 'lucide-react';

const BRAND = 'hsl(var(--primary))';
const brl = (v: number) => `R$${v.toFixed(2).replace('.', ',')}`;

// Checkout transparente vitalício (dentro do site) — mesmo layout de 2 colunas do
// signup/Stripe: AuthHero (design) à esquerda, checkout à direita. tier=kit (R$47,
// sem WhatsApp) ou completa (R$97, tudo). Sem tier → completa. O VALOR REAL é
// definido no servidor (/api/mercadopago/process) pelo tier + cupom — nunca no cliente.
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

  // ── Cupom (opcional) ──────────────────────────────────────────────
  const [cupomInput, setCupomInput] = useState('');
  const [cupom, setCupom] = useState<string | null>(null); // aplicado
  const [cupomErro, setCupomErro] = useState('');
  const [ativando, setAtivando] = useState(false);
  const [erroGratis, setErroGratis] = useState('');

  // Cupom pré-aplicado via ?cupom= (ex.: link com desconto).
  useEffect(() => {
    const q = params.get('cupom');
    if (q && pctCupom(q)) { setCupom(q.trim().toUpperCase()); setCupomInput(q.trim().toUpperCase()); }
  }, [params]);

  const { valor: amountFinal, pct } = aplicarCupomVitalicio(t.amount, cupom);
  const gratis = pct >= 100;

  // Quem chega direto de /oferta ou /kit (clicando num link, sem passar por
  // /planos ou /signup) NUNCA disparava InitiateCheckout — chegar aqui JÁ É
  // a intenção de checkout. Uma vez por sessão de página (ref, não depende do
  // cupom pra não duplicar ao aplicar/remover cupom).
  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    try {
      trackAddToCart({ name: t.titulo, value: t.amount, currency: 'BRL' });
      trackInitiateCheckout({ name: t.titulo, value: t.amount, currency: 'BRL' });
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // rec=1 (link de recuperação): a conta já existe → login com retorno pra cá.
      // Senão (visitante novo) → cadastro.
      if (params.get('rec') === '1') {
        router.replace(`/login?next=${encodeURIComponent(`/checkout-vitalicio?${params.toString()}`)}`);
      } else {
        router.replace(`/signup?vitalicio=1&tier=${tier}`);
      }
      return;
    }
    // Logado: registra a intenção do vitalício (pra recuperação futura). Fire-and-forget.
    fetch('/api/vitalicio/intent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }),
    }).catch(() => {});
  }, [loading, user, router, tier, params]);

  const onApproved = useCallback(() => {
    // Upgrade do Kit → Completa: agora ele TEM WhatsApp, então pede o número.
    router.replace(tier === 'upgrade' ? '/vincular-whatsapp?upgrade=1' : '/planos?success=1&vitalicio=1');
  }, [router, tier]);

  function aplicarCupom() {
    if (!pctCupom(cupomInput)) { setCupomErro('Cupom inválido ou expirado.'); return; }
    setCupom(cupomInput.trim().toUpperCase()); setCupomErro('');
  }
  function removerCupom() { setCupom(null); setCupomInput(''); setCupomErro(''); setErroGratis(''); }

  // 100% OFF → ativa grátis (sem Mercado Pago). O servidor revalida o cupom.
  async function ativarGratis() {
    setAtivando(true); setErroGratis('');
    try {
      const res = await fetch('/api/mercadopago/process', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, cupom }),
      }).then((r) => r.json());
      if (res.status === 'approved') { onApproved(); return; }
      setErroGratis(res.erro || 'Não consegui ativar agora. Confira o cupom e tente de novo.');
    } catch {
      setErroGratis('Falha de conexão. Tente de novo.');
    } finally {
      setAtivando(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-white dark:bg-zinc-950">
      {/* SDK do Mercado Pago carregado JÁ NA PÁGINA, não só quando o Brick monta.
          Além de o formulário aparecer mais rápido, é o SDK que gera o
          `MP_DEVICE_SESSION_ID` (fingerprint) — e o antifraude do MP pesa muito
          esse sinal. Quanto mais cedo carrega, mais dado ele coleta antes do
          submit; carregando tarde dava pra pagar sem fingerprint nenhum e a
          compra voltava como cc_rejected_high_risk. */}
      <Script id={MP_SDK_ID} src={MP_SDK_SRC} strategy="afterInteractive" />

      <AuthHero pagamento="Mercado Pago" />

      <div className="relative flex-1 flex items-center justify-center
                      px-6 sm:px-10 lg:px-12 py-10 lg:py-12
                      -mt-10 lg:mt-0 rounded-t-[2rem] lg:rounded-none
                      bg-white dark:bg-zinc-950 z-10">
        <div className="w-full max-w-md space-y-6 animate-fade-in">

          {/* Cabeçalho da oferta */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15">
              <Crown size={14} className="text-amber-500 dark:text-amber-400" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">{t.selo}</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight leading-none">{t.titulo}</h1>
            <p className="text-sm text-muted-foreground">
              {gratis ? (
                <>Acesso <strong className="text-foreground">grátis</strong> com o cupom <strong className="text-foreground">{cupom}</strong> 🎉 Pra sempre.</>
              ) : pct > 0 ? (
                <>De <span className="line-through">{brl(t.amount)}</span> por <strong className="text-foreground">{brl(amountFinal)}</strong> — {pct}% OFF com <strong className="text-foreground">{cupom}</strong>. Em até 12x ou Pix. Pra sempre.</>
              ) : (
                <>Pague uma única vez — <strong className="text-foreground">{brl(t.amount)}</strong> em até 12x ou Pix. Pra sempre.</>
              )}
            </p>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: BRAND }}>
              <ShieldCheck size={14} /> Garantia de 7 dias — reembolso de 100% se não curtir.
            </div>
          </div>

          {/* Cupom */}
          <div>
            {!cupom ? (
              <>
                <div className="flex gap-2">
                  <input
                    value={cupomInput}
                    onChange={(e) => { setCupomInput(e.target.value.toUpperCase()); setCupomErro(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') aplicarCupom(); }}
                    placeholder="Tem um cupom de desconto?"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground uppercase placeholder:normal-case placeholder:text-muted-foreground/70 focus:outline-none focus:border-foreground/40 transition-colors"
                  />
                  <button
                    type="button" onClick={aplicarCupom} disabled={!cupomInput.trim()}
                    className="px-4 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted/60 disabled:opacity-40 transition-colors"
                  >
                    Aplicar
                  </button>
                </div>
                {cupomErro && <p className="text-xs text-red-500 mt-1.5">{cupomErro}</p>}
              </>
            ) : (
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-green-500/30 bg-green-500/10">
                <span className="text-sm font-semibold text-green-700 dark:text-green-400 inline-flex items-center gap-1.5">
                  <Tag size={14} /> {cupom} · {pct}% OFF aplicado
                </span>
                <button type="button" onClick={removerCupom} aria-label="Remover cupom"
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10">
                  <X size={15} />
                </button>
              </div>
            )}
          </div>

          {/* Pagamento — ou ativação grátis quando o cupom é 100% */}
          {gratis ? (
            <div className="space-y-3">
              <button
                type="button" onClick={ativarGratis} disabled={ativando}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-white text-base disabled:opacity-60 transition active:scale-[0.99]"
                style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}
              >
                {ativando ? <><Loader2 size={18} className="animate-spin" /> Ativando…</> : <><Crown size={18} /> Ativar meu acesso grátis</>}
              </button>
              {erroGratis && <p className="text-sm text-red-600 dark:text-red-400 text-center">{erroGratis}</p>}
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Check size={13} className="text-green-500" /> Sem cobrança · acesso liberado na hora
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <MercadoPagoBrick amount={amountFinal} tier={tier} cupom={cupom} email={user?.email} onApproved={onApproved} />
              </div>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck size={13} /> Pagamento seguro via Mercado Pago · acesso imediato
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CheckoutVitalicioPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-background" />}>
      <CheckoutContent />
    </Suspense>
  );
}

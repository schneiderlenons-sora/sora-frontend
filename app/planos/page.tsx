'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { PLANOS_INFO, type PlanoId, type Intervalo } from '@/lib/stripe';
import { PLANOS_DISPLAY } from '@/lib/planos-display';
import { PLANO_LABEL } from '@/lib/plans';
import { trackInitiateCheckout, trackPurchase } from '@/lib/analytics';
import {
  Check, Crown, Sparkles, Loader2, AlertCircle, CheckCircle2,
  CreditCard, Settings, Zap,
} from 'lucide-react';

const BRAND = '#61D17B';

// Catálogo de planos vem de lib/planos-display (fonte única, igual à landing).
const PLANOS = PLANOS_DISPLAY;

const ORDEM: Record<PlanoId | 'inativo', number> = {
  inativo: 0, basico: 1, premium: 2, black: 3,
};

// ─── Componente principal (separado por causa do Suspense) ────────────────────

function PlanosContent() {
  const { perfil, plano: planoAtual, recarregar } = useAuth();
  const searchParams = useSearchParams();
  const [anual, setAnual]         = useState(false);
  const [loadingPlano, setLoading] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [erro, setErro]           = useState('');

  const success  = searchParams.get('success');
  const canceled = searchParams.get('canceled');
  const intent   = searchParams.get('intent');             // 'upgrade' vindo do signup
  const planoIntencao = searchParams.get('plano') as PlanoId | null;
  const planoIntencaoValido =
    planoIntencao && ['basico', 'premium', 'black'].includes(planoIntencao) ? planoIntencao : null;
  // Ciclo escolhido na landing (mensal/anual) — preserva a escolha no checkout.
  const cicloIntencao: Intervalo = searchParams.get('ciclo') === 'anual' ? 'anual' : 'mensal';

  // Refs pra fazer scroll até o card escolhido na intent
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Após o pagamento, o webhook do Stripe leva alguns segundos pra ativar o
  // plano. Re-checa o perfil a cada 2s (até ~20s); quando o plano ativa, o
  // PaywallRedirect/OnboardingRedirect assumem e levam pro onboarding.
  const recarregarRef = useRef(recarregar);
  recarregarRef.current = recarregar;
  useEffect(() => {
    if (!success) return;
    trackPurchase({ value: 0 });
    let tries = 0;
    const iv = setInterval(() => {
      tries += 1;
      recarregarRef.current();
      if (tries >= 10) clearInterval(iv);
    }, 2000);
    return () => clearInterval(iv);
  }, [success]);

  // Auto-checkout: se o usuário já escolheu o plano na landing (intent), vai
  // direto pro Stripe sem precisar clicar de novo. Só dispara uma vez, com o
  // usuário autenticado e inativo, e nunca ao voltar de um success/cancel
  // (evita loop). Se o checkout falhar, cai no fallback (a tela com os cards).
  const autoCheckout = useRef(false);
  useEffect(() => {
    if (autoCheckout.current) return;
    if (intent !== 'upgrade' || !planoIntencaoValido) return;
    if (planoAtual !== 'inativo') return;
    if (success || canceled) return;
    if (!perfil) return;                       // precisa de sessão pro checkout
    autoCheckout.current = true;
    assinar(planoIntencaoValido, cicloIntencao); // respeita mensal/anual da landing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, planoIntencaoValido, planoAtual, success, canceled, perfil, cicloIntencao]);

  // Reflete o ciclo escolhido na landing no toggle (fallback visual, caso o
  // auto-checkout não dispare e o usuário veja os cards).
  useEffect(() => {
    if (cicloIntencao === 'anual') setAnual(true);
  }, [cicloIntencao]);

  // Fallback: se por algum motivo o auto-checkout não disparar, ao menos
  // rola suave até o card pré-selecionado.
  useEffect(() => {
    if (intent !== 'upgrade' || !planoIntencaoValido) return;
    const t = setTimeout(() => {
      const el = cardRefs.current[planoIntencaoValido];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    return () => clearTimeout(t);
  }, [intent, planoIntencaoValido]);

  async function assinar(plano: PlanoId, intervaloForcado?: Intervalo) {
    setErro('');
    setLoading(plano);
    try {
      const intervalo: Intervalo = intervaloForcado ?? (anual ? 'anual' : 'mensal');
      const info = PLANOS_INFO[plano];
      const preco = intervalo === 'anual' ? info.anual : info.mensal;
      trackInitiateCheckout({ value: preco, currency: 'BRL' });

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano, intervalo }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setErro(data.erro || 'Erro ao iniciar checkout.');
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setLoading(null);
    }
  }

  async function gerenciarAssinatura() {
    setErro('');
    setLoadingPortal(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setErro(data.erro || 'Erro ao abrir portal.');
      }
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setLoadingPortal(false);
    }
  }

  const ordemAtual = ORDEM[planoAtual];
  const temAssinatura = planoAtual !== 'inativo' && !!perfil;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto pb-24 space-y-8 px-4">

        {/* Banner de boas-vindas (vindo do signup com plano pré-selecionado) */}
        {intent === 'upgrade' && planoIntencaoValido && planoAtual === 'inativo' && (
          <div
            className="relative overflow-hidden rounded-2xl p-5 animate-fade-in border"
            style={{
              background: `linear-gradient(135deg, ${BRAND}0F 0%, ${BRAND}04 100%)`,
              borderColor: `${BRAND}40`,
            }}
          >
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none opacity-20"
                 style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 60%)` }} />
            <div className="relative flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md"
                   style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
                <Sparkles size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">
                  Bem-vindo à Sora! 🎉
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Você escolheu o plano <strong className="text-foreground capitalize">{PLANO_LABEL[planoIntencaoValido]}</strong> na landing.
                  Confirme abaixo pra concluir sua assinatura — você pode trocar de plano ou ciclo (mensal/anual) antes de pagar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Banners de feedback */}
        {success && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/60 animate-fade-in">
            <CheckCircle2 size={18} className="text-green-600 dark:text-green-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">Pagamento confirmado!</p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                Seu plano está sendo ativado. Em alguns instantes o painel será atualizado.
              </p>
            </div>
          </div>
        )}
        {canceled && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 animate-fade-in">
            <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">Checkout cancelado. Escolha um plano quando quiser.</p>
          </div>
        )}
        {erro && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60">
            <AlertCircle size={18} className="text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{erro}</p>
          </div>
        )}

        {/* Header */}
        <div className="text-center space-y-2 pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 mb-2">
            <Zap size={12} style={{ color: BRAND }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: BRAND }}>
              Planos
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-tight">
            {planoAtual === 'inativo' ? 'Escolha o seu plano' : `Você está no ${PLANO_LABEL[planoAtual]}`}
          </h1>
          {planoAtual !== 'inativo' && (
            <p className="text-muted-foreground text-sm">
              Faça upgrade a qualquer momento ou gerencie sua assinatura abaixo.
            </p>
          )}
          {planoAtual === 'inativo' && (
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Cancele quando quiser. Sem letras miúdas.
            </p>
          )}
        </div>

        {/* Toggle mensal/anual */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-muted/50 border border-border/60">
            <button
              onClick={() => setAnual(false)}
              className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${
                !anual ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setAnual(true)}
              className={`relative px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${
                anual ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Anual
              {!anual && (
                <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white"
                      style={{ background: BRAND }}>
                  até -40%
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Cards de planos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {PLANOS.map((p) => {
            const info       = PLANOS_INFO[p.id];
            const preco      = anual ? info.anual : info.mensal;
            const ehAtual    = planoAtual === p.id;
            const ehIntencao = planoIntencaoValido === p.id && planoAtual === 'inativo';
            const podeSubir  = ORDEM[p.id] > ordemAtual;
            const podeDescer = ORDEM[p.id] < ordemAtual && ordemAtual > 0;
            const isLoading  = loadingPlano === p.id;

            return (
              <div
                key={p.id}
                ref={(el) => { cardRefs.current[p.id] = el; }}
                className={`relative rounded-3xl p-7 transition-all duration-300 ${
                  ehIntencao
                    ? 'border-2 shadow-[0_20px_60px_-20px_rgba(97,206,112,0.5)] bg-card animate-pulse-glow'
                    : p.destaque
                      ? 'border-2 shadow-[0_20px_60px_-20px_rgba(97,206,112,0.35)] bg-card'
                      : ehAtual
                        ? 'border-2 bg-card'
                        : 'border border-border/70 bg-card/60 hover:border-border'
                }`}
                style={{
                  borderColor: ehIntencao || p.destaque || ehAtual ? p.cor : undefined,
                  boxShadow: ehIntencao ? `0 0 0 4px ${p.cor}22, 0 20px 60px -20px ${p.cor}80` : undefined,
                }}
              >
                {/* Badge */}
                {p.badge && (
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white shadow-md"
                    style={{ background: `linear-gradient(135deg, ${p.cor}, ${escurecer(p.cor)})` }}
                  >
                    {p.id === 'premium' && <Sparkles size={9} />}
                    {p.id === 'black' && <Crown size={9} />}
                    {p.badge}
                  </div>
                )}

                {/* Plano atual badge */}
                {ehAtual && (
                  <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                       style={{ background: `${p.cor}22`, color: p.cor }}>
                    <CheckCircle2 size={10} /> Atual
                  </div>
                )}

                <div className="mt-2">
                  <h3 className="text-xl font-bold text-foreground tracking-tight">{p.nome}</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-5">{p.subtitulo}</p>

                  {/* Preço */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-foreground">R$</span>
                      <span className="text-5xl font-bold text-foreground tabular-nums tracking-tight">
                        {Math.floor(preco)}
                      </span>
                      <span className="text-2xl font-bold text-foreground">
                        ,{(preco % 1).toFixed(2).slice(2)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      por mês
                      {anual && (
                        <span className="ml-1 font-bold" style={{ color: p.cor }}>
                          · {info.descAnual}% off no anual
                        </span>
                      )}
                    </p>
                  </div>

                  {/* CTA */}
                  {ehAtual ? (
                    <button
                      onClick={gerenciarAssinatura}
                      disabled={loadingPortal || !temAssinatura}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 mb-7"
                      style={{ borderColor: p.cor, color: p.cor }}
                    >
                      {loadingPortal ? <Loader2 size={15} className="animate-spin" /> : <Settings size={15} />}
                      Gerenciar assinatura
                    </button>
                  ) : podeSubir ? (
                    <button
                      onClick={() => assinar(p.id)}
                      disabled={!!loadingPlano}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed mb-7"
                      style={{ background: `linear-gradient(135deg, ${p.cor}, ${escurecer(p.cor)})` }}
                    >
                      {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                      {ordemAtual === 0 ? 'Assinar' : 'Fazer upgrade'}
                    </button>
                  ) : podeDescer ? (
                    <button
                      onClick={gerenciarAssinatura}
                      disabled={loadingPortal}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border border-border text-muted-foreground transition-all hover:bg-muted/40 mb-7"
                    >
                      {loadingPortal ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                      Fazer downgrade
                    </button>
                  ) : (
                    // inativo — pode assinar qualquer plano
                    <button
                      onClick={() => assinar(p.id)}
                      disabled={!!loadingPlano}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed mb-7"
                      style={{ background: `linear-gradient(135deg, ${p.cor}, ${escurecer(p.cor)})` }}
                    >
                      {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                      Assinar
                    </button>
                  )}

                  {/* Features */}
                  <ul className="space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px] text-foreground/80 leading-snug">
                        <span
                          className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: `${p.cor}22` }}
                        >
                          <Check size={9} style={{ color: p.cor }} strokeWidth={3} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* Callout do Grow como teste (Básico) — distinto do checklist */}
                  {p.growTrialDias && (
                    <div className="mt-4 pt-4 border-t border-border/60">
                      <div
                        className="flex items-start gap-2.5 rounded-xl p-3"
                        style={{ background: `${BRAND}0F`, border: `1px solid ${BRAND}33` }}
                      >
                        <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center"
                              style={{ background: `${BRAND}22` }}>
                          <Sparkles size={11} style={{ color: BRAND }} />
                        </span>
                        <div className="leading-snug">
                          <p className="text-[13px] font-semibold text-foreground">
                            Sora Grow — {p.growTrialDias} dias grátis
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Hábitos, saúde e estudos. Incluso de vez no Premium e Black.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé */}
        <p className="text-center text-sm text-muted-foreground pb-4">
          Pagamentos processados com segurança pelo{' '}
          <span className="font-semibold text-foreground">Stripe</span>.
          Cancele a qualquer momento pelo portal de assinatura.
        </p>
      </div>
    </DashboardLayout>
  );
}

export default function PlanosPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    }>
      <PlanosContent />
    </Suspense>
  );
}

function escurecer(hex: string, amt = 0.18): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - Math.round(255 * amt));
  const g = Math.max(0, ((n >> 8)  & 0xff) - Math.round(255 * amt));
  const b = Math.max(0,  (n        & 0xff) - Math.round(255 * amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

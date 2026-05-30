'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { trackSignUp, trackInitiateCheckout } from '@/lib/analytics';
import { PLANOS_DISPLAY } from '@/lib/planos-display';
import { PLANOS_INFO, type PlanoId, type Intervalo } from '@/lib/stripe';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import AuthHero from '@/components/auth/AuthHero';
import {
  Eye, EyeOff, Loader2, ArrowRight, ArrowLeft, CheckCircle2, Circle,
  Check, User, Smartphone, CreditCard, Sparkles, Crown,
} from 'lucide-react';

const BRAND = '#61ce70';

// Carrega o Stripe uma vez (publishable key). Se faltar a env, fica null e a
// etapa de pagamento avisa.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

type Step = 'dados' | 'plano' | 'pagamento' | 'ativando';
const PLANOS_VALIDOS: PlanoId[] = ['basico', 'premium', 'black'];

const fmtPreco = (v: number) =>
  `R$ ${Math.floor(v)},${(v % 1).toFixed(2).slice(2)}`;

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupWizard />
    </Suspense>
  );
}

function SignupWizard() {
  const { signUp, signInWithGoogle, recarregar, plano: planoAtual } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const planoParam = searchParams.get('plano');
  const planoInicial: PlanoId = PLANOS_VALIDOS.includes(planoParam as PlanoId)
    ? (planoParam as PlanoId) : 'premium';

  const [step, setStep] = useState<Step>('dados');

  // Passo 1 — dados
  const [nome,     setNome]     = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPass, setShowPass] = useState(false);
  const [aceito,   setAceito]   = useState(true);

  // Passo 2 — plano
  const [planoSel, setPlanoSel] = useState<PlanoId>(planoInicial);
  const [anual,    setAnual]    = useState(searchParams.get('ciclo') === 'anual');
  const intervalo: Intervalo = anual ? 'anual' : 'mensal';

  const [loading,  setLoading]  = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [erro,     setErro]     = useState('');

  // ── PASSO 1: cria conta + vincula WhatsApp ────────────────────────
  async function handleDados(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (password !== confirm) { setErro('As senhas não coincidem.'); return; }
    if (password.length < 8)  { setErro('A senha deve ter pelo menos 8 caracteres.'); return; }
    if (!aceito)              { setErro('Você precisa aceitar os termos de uso.'); return; }

    let numero = whatsapp.replace(/\D/g, '');
    if (!numero.startsWith('55')) numero = '55' + numero;
    if (numero.length < 12) { setErro('Informe um WhatsApp válido com DDD.'); return; }

    setLoading(true);
    try {
      const uid = await signUp(email, password, nome);
      if (!uid) throw new Error('Não consegui criar a conta. Tente novamente.');

      // Salva o número e dispara as boas-vindas (não bloqueia)
      await supabase.from('users').update({ phone: numero, name: nome }).eq('id', uid);
      api.user.welcome({ user_id: uid, phone: numero, nome }).catch(() => {});
      trackSignUp();

      setStep('plano');
    } catch (err: any) {
      setErro(err.message || 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setErro('');
    setLoadingGoogle(true);
    try { await signInWithGoogle(); }
    catch (err: any) { setErro(err.message || 'Falha ao cadastrar com Google.'); setLoadingGoogle(false); }
  }

  // ── PASSO 3: client secret do Embedded Checkout ───────────────────
  const fetchClientSecret = useCallback(async () => {
    const res = await fetch('/api/stripe/embedded-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plano: planoSel, intervalo }),
    });
    const data = await res.json();
    if (!data.client_secret) throw new Error(data.erro || 'Falha ao iniciar o checkout.');
    return data.client_secret as string;
  }, [planoSel, intervalo]);

  // Após o pagamento: espera o webhook ativar o plano e segue pro onboarding.
  const recarregarRef = useRef(recarregar);
  recarregarRef.current = recarregar;
  function onPagamentoCompleto() {
    setStep('ativando');
  }
  // InitiateCheckout ao entrar no pagamento (Purchase é enviado pelo webhook/CAPI)
  useEffect(() => {
    if (step === 'pagamento') {
      trackInitiateCheckout({ value: PLANOS_INFO[planoSel][intervalo], currency: 'BRL' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  useEffect(() => {
    if (step !== 'ativando') return;
    let tries = 0;
    const iv = setInterval(async () => {
      tries += 1;
      await recarregarRef.current();
      if (tries >= 15) { clearInterval(iv); router.push('/onboarding'); }
    }, 2000);
    return () => clearInterval(iv);
  }, [step, router]);
  // Assim que o plano ativa, segue pro onboarding
  useEffect(() => {
    if (step === 'ativando' && planoAtual !== 'inativo') router.push('/onboarding');
  }, [step, planoAtual, router]);

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-white dark:bg-zinc-950">
      <AuthHero />

      <div className="relative flex-1 flex items-center justify-center
                      px-6 sm:px-10 lg:px-12 py-10 lg:py-12
                      -mt-10 lg:mt-0 rounded-t-[2rem] lg:rounded-none
                      bg-white dark:bg-zinc-950 z-10">
        <div className="w-full max-w-md space-y-6 animate-fade-in">

          <Stepper step={step} />

          {erro && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
              <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">{erro}</p>
            </div>
          )}

          {step === 'dados' && (
            <DadosStep
              {...{ nome, setNome, whatsapp, setWhatsapp, email, setEmail,
                    password, setPassword, confirm, setConfirm, showPass, setShowPass,
                    aceito, setAceito, loading, loadingGoogle, handleDados, handleGoogle }}
            />
          )}

          {step === 'plano' && (
            <PlanoStep
              planoSel={planoSel} setPlanoSel={setPlanoSel}
              anual={anual} setAnual={setAnual}
              onVoltar={() => setStep('dados')}
              onContinuar={() => setStep('pagamento')}
            />
          )}

          {step === 'pagamento' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">Finalizar assinatura</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Plano <strong className="text-foreground capitalize">{planoSel}</strong> · {fmtPreco(PLANOS_INFO[planoSel][intervalo])}/{anual ? 'mês (anual)' : 'mês'}
                </p>
              </div>

              {!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-sm text-amber-700 dark:text-amber-400">
                  Pagamento indisponível: falta configurar a chave pública do Stripe.
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden border border-border">
                  <EmbeddedCheckoutProvider
                    key={`${planoSel}-${intervalo}`}
                    stripe={stripePromise}
                    options={{ fetchClientSecret, onComplete: onPagamentoCompleto }}
                  >
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </div>
              )}

              <button
                onClick={() => setStep('plano')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={14} /> Voltar e trocar de plano
              </button>
            </div>
          )}

          {step === 'ativando' && (
            <div className="flex flex-col items-center text-center gap-4 py-12">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                   style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
                <CheckCircle2 size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Pagamento confirmado!</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Ativando seu plano… você será levado às configurações iniciais em instantes.
              </p>
              <Loader2 size={22} className="animate-spin text-muted-foreground" />
            </div>
          )}

          {step === 'dados' && (
            <p className="text-center text-sm text-muted-foreground">
              Já tem conta?{' '}
              <Link href="/login" className="font-bold hover:underline inline-flex items-center gap-0.5" style={{ color: BRAND }}>
                Entrar <ArrowRight size={12} />
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Indicador de passos
// ─────────────────────────────────────────────────────────────
function Stepper({ step }: { step: Step }) {
  const passos = [
    { id: 'dados',     label: 'Seus dados', icon: User },
    { id: 'plano',     label: 'Plano',      icon: Sparkles },
    { id: 'pagamento', label: 'Pagamento',  icon: CreditCard },
  ];
  const ordem = ['dados', 'plano', 'pagamento', 'ativando'];
  const atualIdx = ordem.indexOf(step);

  return (
    <div className="flex items-center gap-1.5">
      {passos.map((p, i) => {
        const Icon = p.icon;
        const feito = atualIdx > i;
        const ativo = atualIdx === i;
        return (
          <div key={p.id} className="flex items-center gap-1.5 flex-1">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: feito || ativo ? BRAND : 'transparent',
                  border: feito || ativo ? 'none' : '2px solid hsl(var(--border))',
                  color: feito || ativo ? '#fff' : 'hsl(var(--fg-muted))',
                }}
              >
                {feito ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
              </div>
            </div>
            {i < passos.length - 1 && (
              <div className="flex-1 h-0.5 rounded-full transition-all"
                   style={{ background: atualIdx > i ? BRAND : 'hsl(var(--border))' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Passo 1 — dados pessoais
// ─────────────────────────────────────────────────────────────
function DadosStep(p: any) {
  const regras = [
    { label: 'Mínimo 8 caracteres', ok: p.password.length >= 8 },
    { label: 'Uma letra maiúscula', ok: /[A-Z]/.test(p.password) },
    { label: 'Um número',           ok: /[0-9]/.test(p.password) },
  ];
  const inputCls = 'w-full px-4 py-3 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/40 transition-colors disabled:opacity-50';

  return (
    <>
      <div className="space-y-1.5">
        <h2 className="text-3xl font-bold text-foreground tracking-tight leading-none">Criar conta</h2>
        <p className="text-muted-foreground text-sm">Comece a usar a Sora em 30 segundos</p>
      </div>

      <button
        onClick={p.handleGoogle}
        disabled={p.loadingGoogle || p.loading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl border border-border bg-card hover:bg-muted/60 text-sm font-semibold text-foreground transition-all hover:scale-[1.005] active:scale-[0.99] disabled:opacity-50"
      >
        {p.loadingGoogle ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon size={18} />}
        Continuar com Google
      </button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">ou</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={p.handleDados} className="space-y-4">
        <Campo label="Nome completo">
          <input type="text" placeholder="João Silva" value={p.nome} onChange={(e: any) => p.setNome(e.target.value)} required disabled={p.loading} className={inputCls} />
        </Campo>

        <Campo label="WhatsApp">
          <div className="flex gap-2">
            <span className="inline-flex items-center gap-1 px-3 rounded-2xl bg-card border border-border text-sm text-foreground">
              <Smartphone size={14} className="text-muted-foreground" /> +55
            </span>
            <input type="tel" inputMode="numeric" placeholder="(11) 99999-9999" value={p.whatsapp} onChange={(e: any) => p.setWhatsapp(e.target.value)} required disabled={p.loading} className={inputCls} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Com DDD — é por aqui que você fala com a Sora.</p>
        </Campo>

        <Campo label="E-mail">
          <input type="email" placeholder="seu@email.com" value={p.email} onChange={(e: any) => p.setEmail(e.target.value)} required disabled={p.loading} className={inputCls} />
        </Campo>

        <Campo label="Senha">
          <div className="relative">
            <input type={p.showPass ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" value={p.password} onChange={(e: any) => p.setPassword(e.target.value)} required disabled={p.loading} className={inputCls + ' pr-11'} />
            <button type="button" onClick={() => p.setShowPass((v: boolean) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted-foreground hover:text-foreground" tabIndex={-1}>
              {p.showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {p.password && (
            <div className="space-y-1 mt-2">
              {regras.map((r) => (
                <div key={r.label} className="flex items-center gap-2">
                  {r.ok ? <CheckCircle2 size={13} style={{ color: BRAND }} /> : <Circle size={13} className="text-muted-foreground" />}
                  <span className="text-xs" style={{ color: r.ok ? BRAND : undefined }}>
                    <span className={r.ok ? '' : 'text-muted-foreground'}>{r.label}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Campo>

        <Campo label="Confirmar senha">
          <input type="password" placeholder="Repita a senha" value={p.confirm} onChange={(e: any) => p.setConfirm(e.target.value)} required disabled={p.loading}
                 className={`w-full px-4 py-3 rounded-2xl bg-card border text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-colors ${p.confirm && p.confirm !== p.password ? 'border-red-400' : 'border-border focus:border-foreground/40'}`} />
        </Campo>

        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={p.aceito} onChange={(e: any) => p.setAceito(e.target.checked)} className="w-4 h-4 mt-0.5 accent-[#61ce70] cursor-pointer" />
          <span className="text-[11px] text-muted-foreground leading-relaxed">
            Aceito os <span className="font-semibold" style={{ color: BRAND }}>Termos de uso</span> e a <span className="font-semibold" style={{ color: BRAND }}>Política de privacidade</span>.
          </span>
        </label>

        <button
          type="submit"
          disabled={p.loading || p.loadingGoogle || !p.nome || !p.whatsapp || !p.email || !p.password || !p.confirm}
          className="w-full px-4 py-3.5 rounded-2xl text-white text-sm font-bold transition-all hover:scale-[1.005] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
          style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)`, boxShadow: `0 8px 24px -8px ${BRAND}80` }}
        >
          {p.loading ? <><Loader2 size={16} className="animate-spin" /> Criando conta…</> : <>Continuar <ArrowRight size={15} /></>}
        </button>
      </form>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Passo 2 — escolher/revisar plano
// ─────────────────────────────────────────────────────────────
function PlanoStep({
  planoSel, setPlanoSel, anual, setAnual, onVoltar, onContinuar,
}: {
  planoSel: PlanoId; setPlanoSel: (p: PlanoId) => void;
  anual: boolean; setAnual: (v: boolean) => void;
  onVoltar: () => void; onContinuar: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h2 className="text-3xl font-bold text-foreground tracking-tight leading-none">Seu plano</h2>
        <p className="text-muted-foreground text-sm">Revise ou troque antes de pagar. Cancele quando quiser.</p>
      </div>

      {/* Toggle mensal/anual */}
      <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-muted/50 border border-border/60">
        <button onClick={() => setAnual(false)} className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${!anual ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Mensal</button>
        <button onClick={() => setAnual(true)} className={`relative px-4 py-2 text-sm font-bold rounded-xl transition-all ${anual ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
          Anual
          <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ background: BRAND }}>-40%</span>
        </button>
      </div>

      <div className="space-y-2.5">
        {PLANOS_DISPLAY.map((pl) => {
          const sel = planoSel === pl.id;
          const preco = anual ? PLANOS_INFO[pl.id].anual : PLANOS_INFO[pl.id].mensal;
          return (
            <button
              key={pl.id}
              onClick={() => setPlanoSel(pl.id)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${sel ? 'shadow-md' : 'border-border bg-card hover:border-border/80'}`}
              style={sel ? { borderColor: pl.cor, background: `${pl.cor}0D` } : undefined}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ border: sel ? 'none' : '2px solid hsl(var(--border))', background: sel ? pl.cor : 'transparent' }}>
                    {sel && <Check size={12} className="text-white" strokeWidth={3} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground flex items-center gap-1.5">
                      {pl.nome}
                      {pl.id === 'premium' && <Sparkles size={12} style={{ color: pl.cor }} />}
                      {pl.id === 'black' && <Crown size={12} style={{ color: pl.cor }} />}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{pl.subtitulo}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-foreground tabular-nums">{fmtPreco(preco)}</p>
                  <p className="text-[10px] text-muted-foreground">/mês{anual && ' · anual'}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button onClick={onVoltar} className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
          <ArrowLeft size={15} /> Voltar
        </button>
        <button
          onClick={onContinuar}
          className="flex-1 px-4 py-3.5 rounded-2xl text-white text-sm font-bold transition-all hover:scale-[1.005] active:scale-[0.99] shadow-lg flex items-center justify-center gap-2"
          style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)`, boxShadow: `0 8px 24px -8px ${BRAND}80` }}
        >
          Ir para o pagamento <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

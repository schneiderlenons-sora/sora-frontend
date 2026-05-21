'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Loader2, Check, ArrowRight, Sparkles, Star } from 'lucide-react';

const BRAND = '#61ce70';

export default function LoginPage() {
  const { signIn, signInWithGoogle, signInWithApple } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [loadingOAuth, setLoadingOAuth] = useState<'google' | 'apple' | null>(null);
  const [erro,     setErro]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try { await signIn(email, password); }
    catch (err: any) { setErro(err.message || 'Email ou senha incorretos.'); }
    finally { setLoading(false); }
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setErro('');
    setLoadingOAuth(provider);
    try {
      if (provider === 'google') await signInWithGoogle();
      else                       await signInWithApple();
    } catch (err: any) {
      setErro(err.message || 'Falha ao entrar. Tente novamente.');
      setLoadingOAuth(null);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-white dark:bg-zinc-950">

      {/* ════════════════════════════════════════════════════════════
          LADO ESQUERDO — Hero SEMPRE preto, independente do tema
          ════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden bg-black text-white
                      px-6 sm:px-10 lg:px-12 pt-10 lg:pt-12 pb-16 lg:pb-12
                      lg:w-1/2 lg:min-h-dvh
                      flex flex-col justify-between
                      rounded-b-[2rem] lg:rounded-none">

        {/* Pontilhado de fundo */}
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
             style={{
               backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
               backgroundSize: '24px 24px',
             }} />

        {/* Glow verde sutil */}
        <div className="absolute inset-0 pointer-events-none opacity-50"
             style={{
               background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${BRAND}25 0%, transparent 60%),
                            radial-gradient(circle at 90% 90%, ${BRAND}15 0%, transparent 50%)`,
             }} />

        {/* Ruído sutil (textura premium) */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
             style={{
               backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
             }} />

        {/* ── Marca no topo ── */}
        <div className="relative flex items-center gap-3 animate-fade-in">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg ring-1 ring-white/10"
               style={{ background: '#111' }}>
            <img src="/sora-icon.png" alt="Sora" width={28} height={28}
                 className="w-7 h-7 object-contain" draggable={false} />
          </div>
          <span className="font-bold text-xl tracking-tight">Sora</span>
        </div>

        {/* ── Headline + features showcase ── */}
        <div className="relative mt-8 lg:mt-0 space-y-7 animate-fade-in" style={{ animationDelay: '80ms' }}>

          <h1 className="text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight">
            Suas finanças<br />sob controle.{' '}
            <span style={{ color: BRAND }}>Finalmente.</span>
          </h1>

          <p className="text-white/60 text-sm sm:text-base leading-relaxed max-w-md">
            Gastos, hábitos, dívidas, estudos, saúde — tudo num só lugar e conversando direto no seu WhatsApp.
          </p>

          {/* Badges mobile (estilo Pierre/Kora) */}
          <div className="flex flex-wrap gap-2 lg:hidden">
            <PillBadge label="Setup em 30s" />
            <PillBadge label="Grátis pra começar" />
          </div>

          {/* Card mockup desktop */}
          <div className="hidden lg:block relative rounded-2xl p-5 border border-white/10 backdrop-blur-sm overflow-hidden"
               style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)' }}>
            <div className="absolute inset-0 pointer-events-none opacity-50"
                 style={{ background: `radial-gradient(circle at top right, ${BRAND}1A 0%, transparent 60%)` }} />

            <div className="relative space-y-3">
              <DataRow icon="💰" label="Saldo este mês"    value="R$ 3.450"    cor="#fff" />
              <DataRow icon="🎯" label="Score financeiro"  value="847 / 1000"  cor="#fff" />
              <DataRow icon="🔥" label="Streak de hábitos" value="12 dias"     cor={BRAND} />
              <DataRow icon="✈️" label="Meta de viagem"    value="67% ✓"       cor={BRAND} />
            </div>

            {/* "IA analisando" pill */}
            <div className="relative inline-flex items-center gap-1.5 mt-4 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-white/10 bg-white/5"
                 style={{ color: BRAND }}>
              <Sparkles size={10} className="animate-pulse" />
              IA analisando seus dados…
            </div>
          </div>

        </div>

        {/* ── Rodapé com testimonial (desktop only) ── */}
        <div className="hidden lg:block relative mt-8 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-0.5 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={12} fill={BRAND} className="text-transparent" style={{ color: BRAND }} />
            ))}
          </div>
          <p className="text-white/85 text-sm italic leading-relaxed">
            "Finalmente consigo organizar minha vida financeira em um lugar só. A IA da Sora é insana."
          </p>
          <p className="text-white/40 text-xs mt-1.5">Lenon S., Designer</p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          LADO DIREITO — Formulário (adapta ao tema)
          ════════════════════════════════════════════════════════════ */}
      <div className="relative flex-1 flex items-center justify-center
                      px-6 sm:px-10 lg:px-12 py-10 lg:py-12
                      -mt-10 lg:mt-0 rounded-t-[2rem] lg:rounded-none
                      bg-white dark:bg-zinc-950 z-10">

        <div className="w-full max-w-sm space-y-7 animate-fade-in" style={{ animationDelay: '120ms' }}>

          {/* Header */}
          <div className="space-y-1.5">
            <h2 className="text-3xl font-bold text-foreground tracking-tight leading-none">
              Bem-vindo!
            </h2>
            <p className="text-muted-foreground text-sm">
              Entre na sua conta para continuar
            </p>
          </div>

          {/* OAuth buttons */}
          <div className="space-y-2.5">
            <button
              onClick={() => handleOAuth('google')}
              disabled={!!loadingOAuth || loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl
                         border border-border bg-card hover:bg-muted/60
                         text-sm font-semibold text-foreground
                         transition-all hover:scale-[1.005] active:scale-[0.99]
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingOAuth === 'google'
                ? <Loader2 size={16} className="animate-spin" />
                : <GoogleIcon size={18} />
              }
              Continuar com Google
            </button>

            <button
              onClick={() => handleOAuth('apple')}
              disabled={!!loadingOAuth || loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl
                         border border-border bg-card hover:bg-muted/60
                         text-sm font-semibold text-foreground
                         transition-all hover:scale-[1.005] active:scale-[0.99]
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingOAuth === 'apple'
                ? <Loader2 size={16} className="animate-spin" />
                : <AppleIcon size={17} />
              }
              Continuar com Apple
            </button>
          </div>

          {/* Divisor */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Formulário email/senha */}
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={loading || !!loadingOAuth}
                className="w-full px-4 py-3 rounded-2xl bg-card border border-border
                           text-foreground placeholder:text-muted-foreground/60
                           focus:outline-none focus:border-foreground/40
                           transition-colors disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Senha</label>
                <Link href="/recuperar-senha"
                      className="text-xs font-semibold hover:underline"
                      style={{ color: BRAND }}>
                  Esqueci a senha
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading || !!loadingOAuth}
                  className="w-full px-4 py-3 pr-11 rounded-2xl bg-card border border-border
                             text-foreground placeholder:text-muted-foreground/60
                             focus:outline-none focus:border-foreground/40
                             transition-colors disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg
                             text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {erro && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">{erro}</p>
              </div>
            )}

            {/* Botão Entrar */}
            <button
              type="submit"
              disabled={loading || !!loadingOAuth || !email || !password}
              className="w-full px-4 py-3.5 rounded-2xl text-white text-sm font-bold
                         transition-all hover:scale-[1.005] active:scale-[0.99]
                         disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-lg flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)`,
                boxShadow: `0 8px 24px -8px ${BRAND}80`,
              }}
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Entrando…</>
                : <>Entrar <ArrowRight size={15} /></>
              }
            </button>
          </form>

          {/* Cadastro */}
          <p className="text-center text-sm text-muted-foreground">
            Não tem conta?{' '}
            <Link href="/signup"
                  className="font-bold hover:underline inline-flex items-center gap-0.5"
                  style={{ color: BRAND }}>
              Criar conta <ArrowRight size={12} />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENTES AUXILIARES
// ════════════════════════════════════════════════════════════════

function PillBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-white/90 border border-white/15 bg-white/[0.04] backdrop-blur-sm">
      <Check size={12} style={{ color: BRAND }} strokeWidth={3} />
      {label}
    </span>
  );
}

function DataRow({ icon, label, value, cor }: { icon: string; label: string; value: string; cor: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-base flex-shrink-0">{icon}</span>
      <span className="text-xs text-white/60 flex-1">{label}</span>
      <span className="text-sm font-bold tabular tracking-tight" style={{ color: cor }}>{value}</span>
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

function AppleIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 384 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
    </svg>
  );
}

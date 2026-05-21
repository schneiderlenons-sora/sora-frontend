'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import AuthHero from '@/components/auth/AuthHero';

const BRAND = '#61ce70';

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [erro,     setErro]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try { await signIn(email, password); }
    catch (err: any) { setErro(err.message || 'Email ou senha incorretos.'); }
    finally { setLoading(false); }
  }

  async function handleGoogle() {
    setErro('');
    setLoadingGoogle(true);
    try { await signInWithGoogle(); }
    catch (err: any) {
      setErro(err.message || 'Falha ao entrar com Google.');
      setLoadingGoogle(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-white dark:bg-zinc-950">

      <AuthHero />

      {/* ── Formulário ────────────────────────── */}
      <div className="relative flex-1 flex items-center justify-center
                      px-6 sm:px-10 lg:px-12 py-10 lg:py-12
                      -mt-10 lg:mt-0 rounded-t-[2rem] lg:rounded-none
                      bg-white dark:bg-zinc-950 z-10">

        <div className="w-full max-w-sm space-y-7 animate-fade-in" style={{ animationDelay: '120ms' }}>

          <div className="space-y-1.5">
            <h2 className="text-3xl font-bold text-foreground tracking-tight leading-none">
              Bem-vindo!
            </h2>
            <p className="text-muted-foreground text-sm">
              Entre na sua conta para continuar
            </p>
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={loadingGoogle || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl
                       border border-border bg-card hover:bg-muted/60
                       text-sm font-semibold text-foreground
                       transition-all hover:scale-[1.005] active:scale-[0.99]
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingGoogle
              ? <Loader2 size={16} className="animate-spin" />
              : <GoogleIcon size={18} />
            }
            Continuar com Google
          </button>

          {/* Divisor */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email/senha */}
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={loading || loadingGoogle}
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
                  disabled={loading || loadingGoogle}
                  className="w-full px-4 py-3 pr-11 rounded-2xl bg-card border border-border
                             text-foreground placeholder:text-muted-foreground/60
                             focus:outline-none focus:border-foreground/40
                             transition-colors disabled:opacity-50"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}>
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

            <button
              type="submit"
              disabled={loading || loadingGoogle || !email || !password}
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

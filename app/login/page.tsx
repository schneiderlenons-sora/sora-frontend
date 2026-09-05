'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import AuthHero from '@/components/auth/AuthHero';

const BRAND = 'hsl(var(--primary))';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [erro,     setErro]     = useState('');

  // ⚠️ POR QUE A PESSOA ESTÁ AQUI. O middleware manda `?motivo=sessao` quando
  // derrubou alguém de uma tela do painel. Sem essa mensagem o formulário
  // aparece do nada e a leitura é de defeito: foi o relato de um cliente com
  // vitalício ativo — "clico no menu e abre a tela de login, por quê?". A
  // sessão dele estava válida no navegador e inválida no servidor (trocar a
  // senha derruba as sessões antigas), e nada na tela dizia isso.
  const [aviso, setAviso] = useState('');
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('motivo') === 'sessao') {
      setAviso('Sua sessão expirou — entre de novo pra continuar de onde parou. Sua conta e seus dados estão intactos.');
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      await signIn(email, password);
      // ?next= (ex.: link de recuperação → volta pro checkout do vitalício). Só
      // caminhos internos; navegação dura evita corrida com o guard de auth.
      const next = new URLSearchParams(window.location.search).get('next');
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        window.location.href = next;
        return;
      }
    }
    catch (err: any) { setErro(err.message || 'Email ou senha incorretos.'); }
    finally { setLoading(false); }
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

          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={loading}
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
                  disabled={loading}
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

            {aviso && !erro && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900"
                   role="status">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{aviso}</p>
              </div>
            )}

            {erro && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">{erro}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full px-4 py-3.5 rounded-2xl text-white text-sm font-bold
                         transition-all hover:scale-[1.005] active:scale-[0.99]
                         disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-lg flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${BRAND} 0%, hsl(var(--primary)) 100%)`,
                boxShadow: `0 8px 24px -8px color-mix(in srgb, ${BRAND} 50%, transparent)`,
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

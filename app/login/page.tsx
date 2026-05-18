'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Loader2, TrendingUp, Shield, Zap } from 'lucide-react';

const FEATURES = [
  { icon: Zap,       title: 'Controle pelo WhatsApp', desc: 'Registre gastos enviando uma mensagem.' },
  { icon: TrendingUp, title: 'Investimentos em tempo real', desc: 'Portfólio atualizado automaticamente.' },
  { icon: Shield,    title: 'Dados seguros',           desc: 'Criptografia e acesso protegido.' },
];

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [erro,     setErro]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      setErro(err.message || 'Email ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Painel esquerdo — branding ───────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12"
           style={{ background: 'var(--gradient-hero)' }}>

        {/* Mesh animado de fundo */}
        <div className="absolute inset-0 opacity-20"
             style={{
               backgroundImage: `radial-gradient(circle at 20% 30%, white 0%, transparent 50%),
                                  radial-gradient(circle at 80% 70%, white 0%, transparent 50%)`,
             }} />
        {/* Círculos decorativos */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/10 blur-3xl" />

        {/* Logo */}
        <div className="relative flex items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">Sora</span>
        </div>

        {/* Headline */}
        <div className="relative space-y-6 animate-fade-in delay-150">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Sua vida financeira,{' '}
            <span className="text-white/80">organizada de verdade.</span>
          </h1>
          <p className="text-white/70 text-lg leading-relaxed">
            Controle gastos, investimentos e metas — tudo pelo WhatsApp e com um painel completo.
          </p>

          {/* Features */}
          <div className="space-y-4 pt-2">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <div key={i}
                   className="flex items-start gap-3 animate-fade-in"
                   style={{ animationDelay: `${200 + i * 75}ms` }}>
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{title}</p>
                  <p className="text-white/60 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <p className="relative text-white/40 text-xs animate-fade-in delay-300">
          © 2026 Sora. Todos os direitos reservados.
        </p>
      </div>

      {/* ── Painel direito — formulário ──────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm space-y-8 animate-fade-in">

          {/* Cabeçalho mobile */}
          <div className="lg:hidden flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                 style={{ background: 'var(--gradient-primary)' }}>
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-bold text-lg text-foreground">Sora</span>
          </div>

          {/* Título */}
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              Bem-vindo de volta
            </h2>
            <p className="text-muted-foreground text-sm">
              Entre na sua conta para continuar
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="input"
              />
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Senha</label>
                <Link href="/recuperar-senha"
                      className="text-xs text-primary hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {erro && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>
              </div>
            )}

            {/* Botão entrar */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full mt-2"
              style={{ padding: '11px 16px', fontSize: '15px' }}
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Entrando...</>
                : 'Entrar'
              }
            </button>
          </form>

          {/* Divisor */}
          <div className="divider text-xs text-muted-foreground">ou</div>

          {/* Cadastro */}
          <p className="text-center text-sm text-muted-foreground">
            Não tem conta?{' '}
            <Link href="/signup"
                  className="text-primary font-medium hover:underline">
              Criar conta grátis
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
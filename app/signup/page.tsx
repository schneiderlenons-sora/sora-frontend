'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Loader2, CheckCircle2, Circle } from 'lucide-react';

function RegrasSenha({ senha }: { senha: string }) {
  const regras = [
    { label: 'Mínimo 8 caracteres', ok: senha.length >= 8 },
    { label: 'Uma letra maiúscula',  ok: /[A-Z]/.test(senha) },
    { label: 'Um número',            ok: /[0-9]/.test(senha) },
  ];
  if (!senha) return null;
  return (
    <div className="space-y-1 mt-2">
      {regras.map(r => (
        <div key={r.label} className="flex items-center gap-2">
          {r.ok
            ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
            : <Circle       size={13} className="text-muted-foreground flex-shrink-0" />
          }
          <span className={`text-xs ${r.ok ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
            {r.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SignupPage() {
  const { signUp } = useAuth();
  const [nome,     setNome]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [erro,     setErro]     = useState('');
  const [sucesso,  setSucesso]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    if (password !== confirm) {
      setErro('As senhas não coincidem.');
      return;
    }
    if (password.length < 8) {
      setErro('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, nome);
      setSucesso(true);
    } catch (err: any) {
      setErro(err.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (sucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4 animate-fade-in max-w-sm">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
               style={{ background: 'var(--gradient-primary)' }}>
            <CheckCircle2 size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Conta criada!</h2>
          <p className="text-muted-foreground text-sm">
            Verifique seu email para confirmar o cadastro. Depois volte e faça login.
          </p>
          <Link href="/login" className="btn btn-primary mt-2">
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Painel esquerdo ──────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-center items-center p-12"
           style={{ background: 'var(--gradient-hero)' }}>
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/10 blur-3xl" />

        <div className="relative text-center space-y-6 max-w-sm animate-fade-in">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <span className="text-white font-bold text-2xl">Sora</span>
          </div>

          <h1 className="text-3xl font-bold text-white leading-tight">
            Comece a organizar suas finanças hoje
          </h1>
          <p className="text-white/70">
            Crie sua conta gratuita e conecte ao WhatsApp em menos de 2 minutos.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            {[
              { val: 'Grátis', label: 'Para começar' },
              { val: '2 min',  label: 'Para configurar' },
              { val: '100%',   label: 'No WhatsApp' },
            ].map((s, i) => (
              <div key={i} className="bg-white/10 backdrop-blur rounded-xl p-3 animate-fade-in"
                   style={{ animationDelay: `${150 + i * 75}ms` }}>
                <p className="text-white font-bold text-lg">{s.val}</p>
                <p className="text-white/60 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Painel direito — formulário ──────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background overflow-y-auto">
        <div className="w-full max-w-sm space-y-6 animate-fade-in py-8">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                 style={{ background: 'var(--gradient-primary)' }}>
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-bold text-lg text-foreground">Sora</span>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              Criar conta grátis
            </h2>
            <p className="text-muted-foreground text-sm">
              Preencha os dados abaixo para começar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Nome */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Seu nome</label>
              <input
                type="text"
                placeholder="João Silva"
                value={nome}
                onChange={e => setNome(e.target.value)}
                required
                className="input"
              />
            </div>

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
              <label className="text-sm font-medium text-foreground">Senha</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="input pr-10"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <RegrasSenha senha={password} />
            </div>

            {/* Confirmar senha */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Confirmar senha</label>
              <input
                type="password"
                placeholder="Repita a senha"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className={`input ${confirm && confirm !== password ? 'border-red-400 focus:border-red-400' : ''}`}
              />
              {confirm && confirm !== password && (
                <p className="text-xs text-red-500">As senhas não coincidem.</p>
              )}
            </div>

            {/* Erro */}
            {erro && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>
              </div>
            )}

            {/* Termos */}
            <p className="text-xs text-muted-foreground">
              Ao criar uma conta você concorda com nossos{' '}
              <span className="text-primary cursor-pointer hover:underline">Termos de uso</span>.
            </p>

            {/* Botão */}
            <button type="submit" disabled={loading} className="btn btn-primary w-full"
                    style={{ padding: '11px 16px', fontSize: '15px' }}>
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Criando conta...</>
                : 'Criar conta grátis'
              }
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Entrar
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, Loader2, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import AuthHero from '@/components/auth/AuthHero';

const BRAND = 'hsl(var(--primary))';
const MIN = 6;

// =============================================================================
// "Esqueci a senha" — passo 2: gravar a senha nova.
//
// É onde o link do e-mail cai. O Supabase entrega a sessão de recuperação de
// duas formas conforme o projeto:
//   · PKCE  → `?code=...` na query, que precisa de exchangeCodeForSession
//   · legado→ `#access_token=...&type=recovery` no HASH, que o client já troca
//             sozinho ao carregar (evento PASSWORD_RECOVERY)
// Tratamos as DUAS, senão o link funciona num projeto e falha no outro.
//
// ⚠️ Sem sessão válida, `updateUser` falharia com uma mensagem técnica. Por
// isso a página começa verificando e, se não houver, explica o que fazer em
// vez de deixar a pessoa digitar uma senha que não seria salva.
// =============================================================================
type Estado = 'verificando' | 'pronto' | 'invalido' | 'salvo';

export default function RedefinirSenhaPage() {
  const [estado, setEstado] = useState<Estado>('verificando');
  const [senha, setSenha]   = useState('');
  const [conf, setConf]     = useState('');
  const [ver, setVer]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro]     = useState('');

  useEffect(() => {
    let vivo = true;

    // O evento cobre o fluxo por HASH (o client troca o token sozinho).
    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      if (!vivo) return;
      if (evt === 'PASSWORD_RECOVERY' || evt === 'SIGNED_IN') setEstado('pronto');
    });

    (async () => {
      try {
        const code = new URLSearchParams(window.location.search).get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!vivo) return;
          setEstado(error ? 'invalido' : 'pronto');
          return;
        }
        // Sem `code`: ou o hash já virou sessão, ou o link é inválido/expirado.
        const { data } = await supabase.auth.getSession();
        if (!vivo) return;
        setEstado(data?.session ? 'pronto' : 'invalido');
      } catch {
        if (vivo) setEstado('invalido');
      }
    })();

    return () => { vivo = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (senha.length < MIN) { setErro(`A senha precisa ter pelo menos ${MIN} caracteres.`); return; }
    if (senha !== conf)     { setErro('As duas senhas não são iguais.'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      setEstado('salvo');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não consegui salvar a senha. Peça um link novo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-white dark:bg-zinc-950">
      <AuthHero />

      <div className="relative flex-1 flex items-center justify-center
                      px-6 sm:px-10 lg:px-12 py-10 lg:py-12
                      -mt-10 lg:mt-0 rounded-t-[2rem] lg:rounded-none
                      bg-white dark:bg-zinc-950 z-10">
        <div className="w-full max-w-sm space-y-7 animate-fade-in" style={{ animationDelay: '120ms' }}>

          {estado === 'verificando' && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> Conferindo seu link…
            </div>
          )}

          {estado === 'invalido' && (
            <div className="space-y-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-amber-500/12">
                <AlertTriangle size={26} className="text-amber-500" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Link expirado</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Esse link já foi usado ou passou de 1 hora. É só pedir outro — leva 10 segundos.
                </p>
              </div>
              <Link href="/recuperar-senha"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl font-bold text-white transition active:scale-[0.99]"
                style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 48 }}>
                Pedir um link novo <ArrowRight size={17} />
              </Link>
            </div>
          )}

          {estado === 'salvo' && (
            <div className="space-y-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                   style={{ background: `color-mix(in srgb, ${BRAND} 12%, transparent)` }}>
                <CheckCircle2 size={26} style={{ color: BRAND }} />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Senha alterada!</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Pronto. Já pode entrar com a senha nova.
                </p>
              </div>
              {/* Navegação DURA: o guard de auth lê a sessão no carregamento e
                  um push do router poderia correr com ela. */}
              <a href="/dashboard"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl font-bold text-white transition active:scale-[0.99]"
                style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 48 }}>
                Ir pro painel <ArrowRight size={17} />
              </a>
            </div>
          )}

          {estado === 'pronto' && (
            <>
              <div className="space-y-1.5">
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Nova senha</h1>
                <p className="text-sm text-muted-foreground">Escolha uma senha com pelo menos {MIN} caracteres.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="senha" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Nova senha
                  </label>
                  <div className="relative">
                    <input
                      id="senha" type={ver ? 'text' : 'password'} autoComplete="new-password"
                      required autoFocus value={senha} onChange={(e) => setSenha(e.target.value)}
                      className="w-full px-4 pr-12 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                      style={{ minHeight: 48 }}
                    />
                    <button
                      type="button" onClick={() => setVer((v) => !v)}
                      aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-1 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {ver ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="conf" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Repita a senha
                  </label>
                  <input
                    id="conf" type={ver ? 'text' : 'password'} autoComplete="new-password"
                    required value={conf} onChange={(e) => setConf(e.target.value)}
                    className="w-full px-4 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                    style={{ minHeight: 48 }}
                  />
                </div>

                {erro && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{erro}</p>}

                <button
                  type="submit" disabled={loading || !senha || !conf}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 48 }}
                >
                  {loading ? <><Loader2 size={17} className="animate-spin" /> Salvando…</>
                           : <>Salvar senha <ArrowRight size={17} /></>}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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
// É onde o link do e-mail cai.
//
// ⚠️⚠️ NUNCA CHAMAR `exchangeCodeForSession` AQUI. O código do link é de USO
// ÚNICO e o client JÁ O TROCA SOZINHO ao inicializar.
//
// Foi exatamente esse o bug: `createBrowserClient` (@supabase/ssr) força
// `flowType: 'pkce'` e liga `detectSessionInUrl` por padrão no navegador. Com
// isso o GoTrueClient lê o `?code=` da URL, chama `_exchangeCodeForSession`
// por conta própria e APAGA o `code` da URL em seguida. A página fazia a mesma
// troca de novo, na mão — a segunda chamada batia num código já queimado, o
// catch marcava "inválido" e a tela dizia LINK EXPIRADO com a sessão já
// criada. Dava pra reproduzir clicando no link em menos de um minuto.
//
// O que fazer no lugar: esperar a sessão aparecer. `getSession()` aguarda a
// inicialização do client internamente, e o `onAuthStateChange` cobre o caso
// de o evento chegar antes.
//
// ── OS DOIS MOTIVOS REAIS DE FALHA (e por que são telas diferentes) ─────────
// · EXPIRADO/USADO → o Supabase redireciona pra cá com `error`/`error_code` na
//   URL. Também é o que acontece quando um antivírus ou o scanner de link do
//   provedor de e-mail abre o link antes do usuário e queima o token.
// · OUTRO NAVEGADOR → o PKCE guarda um `code_verifier` no navegador que PEDIU
//   a troca. Pedir no computador e abrir o e-mail no celular deixa o `code` na
//   URL sem o verifier, e a troca falha SEM erro na URL. Chamar isso de
//   "expirado" mandava a pessoa pedir link novo em looping, porque o link
//   novo falharia igual.
// =============================================================================
type Estado = 'verificando' | 'pronto' | 'expirado' | 'outro-navegador' | 'salvo';

export default function RedefinirSenhaPage() {
  const [estado, setEstado] = useState<Estado>('verificando');
  const [senha, setSenha]   = useState('');
  const [conf, setConf]     = useState('');
  const [ver, setVer]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro]     = useState('');

  useEffect(() => {
    let vivo = true;
    let resolvido = false;
    const concluir = (e: Estado) => {
      if (!vivo || resolvido) return;
      resolvido = true;
      setEstado(e);
    };

    // ⚠️ LIDO DE FORMA SÍNCRONA, antes de qualquer await. O client apaga o
    // `code` da URL assim que troca com sucesso — se eu lesse depois, não
    // saberia mais que o link trazia um code, e é justamente isso que separa
    // "expirou" de "abriu em outro navegador".
    const url  = new URL(window.location.href);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const tinhaCode  = !!url.searchParams.get('code');
    const tinhaToken = !!hash.get('access_token');
    const erroNaUrl  = url.searchParams.get('error_code') || url.searchParams.get('error')
                    || hash.get('error_code') || hash.get('error');

    // Cobre o caso do evento chegar antes da nossa leitura.
    const { data: sub } = supabase.auth.onAuthStateChange((evt, session) => {
      if (session && (evt === 'PASSWORD_RECOVERY' || evt === 'SIGNED_IN' || evt === 'INITIAL_SESSION')) {
        concluir('pronto');
      }
    });

    (async () => {
      // O Supabase diz o motivo na própria URL quando o token não vale mais.
      if (erroNaUrl) { concluir('expirado'); return; }

      // Só faz sentido esperar se o link trouxe alguma credencial. Numa visita
      // direta a /redefinir-senha, uma checagem basta — não deixar a pessoa
      // olhando um spinner por 3s à toa.
      const tentativas = (tinhaCode || tinhaToken) ? 12 : 1;
      for (let i = 0; i < tentativas && vivo && !resolvido; i++) {
        const { data } = await supabase.auth.getSession();
        if (!vivo) return;
        if (data?.session) { concluir('pronto'); return; }
        if (i < tentativas - 1) await new Promise((r) => setTimeout(r, 250));
      }

      // Chegou code, não deu erro na URL e mesmo assim não virou sessão: falta
      // o `code_verifier` do PKCE, que vive no navegador que PEDIU o link.
      concluir(tinhaCode ? 'outro-navegador' : 'expirado');
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

          {estado === 'expirado' && (
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

          {/* ⚠️ TELA PRÓPRIA, não um "link expirado" genérico. Aqui o link está
              VÁLIDO — só foi aberto num navegador diferente do que pediu a
              troca (o PKCE guarda o `code_verifier` em quem pediu). Chamar
              isso de expirado mandava a pessoa pedir link novo em looping,
              porque o link novo falharia exatamente igual. */}
          {estado === 'outro-navegador' && (
            <div className="space-y-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-amber-500/12">
                <AlertTriangle size={26} className="text-amber-500" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  Abra no mesmo navegador
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Por segurança, esse link só funciona no navegador em que você pediu a troca de
                  senha. Se você pediu no computador e abriu o e-mail no celular — ou o link abriu
                  dentro do app de e-mail — é isso que aconteceu.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Copie o link e cole no navegador onde você pediu, ou peça um link novo{' '}
                  <strong className="text-foreground">aqui neste aparelho</strong> e abra o e-mail
                  por aqui mesmo.
                </p>
              </div>
              <Link href="/recuperar-senha"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl font-bold text-white transition active:scale-[0.99]"
                style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 48 }}>
                Pedir um link aqui <ArrowRight size={17} />
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

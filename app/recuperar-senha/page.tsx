'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Loader2, ArrowRight, ArrowLeft, MailCheck } from 'lucide-react';
import AuthHero from '@/components/auth/AuthHero';

const BRAND = 'hsl(var(--primary))';

// =============================================================================
// "Esqueci a senha" — passo 1: pedir o e-mail.
//
// ⚠️ ESTA PÁGINA NÃO EXISTIA. O /login sempre linkou pra cá, mas o diretório
// nunca foi criado: clicar em "Esqueci a senha" dava 404 em produção (medido).
// Ou seja, ninguém nunca conseguiu recuperar a senha sozinho.
//
// O Supabase manda o e-mail e o link volta em /redefinir-senha, que é onde a
// senha nova é gravada.
// =============================================================================
export default function RecuperarSenhaPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro]       = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setErro(''); setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) throw error;
      setEnviado(true);
    } catch {
      // ⚠️ Erro genérico DE PROPÓSITO. Dizer "esse e-mail não existe" entrega
      // pra qualquer um quais e-mails têm conta na Sora (enumeração de contas).
      setErro('Não consegui enviar agora. Confira o e-mail e tente de novo.');
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

          {enviado ? (
            // ⚠️ Mesma tela de sucesso mesmo se o e-mail não tiver conta — de
            // novo, pra não revelar quem é cadastrado.
            <div className="space-y-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                   style={{ background: `color-mix(in srgb, ${BRAND} 12%, transparent)` }}>
                <MailCheck size={26} style={{ color: BRAND }} />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Confira seu e-mail</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Se existir uma conta com <strong className="text-foreground">{email.trim()}</strong>,
                  o link pra criar uma senha nova já está a caminho. Ele vale por 1 hora.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Não achou? Olhe no <strong className="text-foreground">spam</strong> ou na aba
                  {' '}<strong className="text-foreground">Promoções</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setEnviado(false); setErro(''); }}
                className="text-sm font-semibold transition-colors hover:opacity-80"
                style={{ color: BRAND }}
              >
                Enviar de novo
              </button>
              <Link href="/login"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft size={14} /> Voltar pro login
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Esqueceu a senha?</h1>
                <p className="text-sm text-muted-foreground">
                  Sem problema. Diz seu e-mail que eu te mando um link pra criar uma nova.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    E-mail da conta
                  </label>
                  <input
                    id="email" type="email" autoComplete="email" required autoFocus
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                    className="w-full px-4 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
                    style={{ minHeight: 48 }}
                  />
                </div>

                {erro && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{erro}</p>}

                <button
                  type="submit" disabled={loading || !email.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 48 }}
                >
                  {loading ? <><Loader2 size={17} className="animate-spin" /> Enviando…</>
                           : <>Enviar link <ArrowRight size={17} /></>}
                </button>
              </form>

              <Link href="/login"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft size={14} /> Voltar pro login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

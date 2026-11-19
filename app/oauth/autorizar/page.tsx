'use client';

// ─────────────────────────────────────────────────────────────────────────────
// "Permitir que o ChatGPT leia sua Sora?" — a tela de consentimento do OAuth.
//
// O ChatGPT manda o navegador pra cá com os parâmetros do OAuth na URL
// (client_id, redirect_uri, code_challenge, state…). Esta tela NÃO decide
// nada: o backend confere tudo ao abrir (GET /api/ia-conectada/pedido) e de
// novo ao aprovar — só então devolve pra onde o navegador vai. Ver
// sora-backend/src/routes/mcp.js e services/oauthIa.js.
//
// ⚠️ PÚBLICA NO MIDDLEWARE, de propósito: quem chega aqui pelo ChatGPT pode
// não estar logado, e o redirect padrão do middleware diria "Sua sessão
// expirou" — falso e assustador no meio de uma conexão. A própria tela pede o
// login e volta pra cá com os mesmos parâmetros.
//
// ⚠️ Fica fora do painel (sem sidebar) e nas allowlists da abertura, do
// onboarding e do paywall: nada pode desviar a pessoa daqui no meio do OAuth.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2, LogIn, Check, X, AlertCircle, Eye, ShieldCheck, ArrowLeftRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { AcessoChatgpt } from '@/lib/ia-conectada';

const BRAND = '#61D17B';

const CAMPOS = ['response_type', 'client_id', 'redirect_uri', 'code_challenge',
  'code_challenge_method', 'scope', 'state', 'resource'] as const;

const VE = [
  'Transações e o resumo de cada mês',
  'Saldos das contas, cartões e faturas',
  'Dívidas, metas e contas fixas',
  'Investimentos e limites de gastos',
];
const NAO_FAZ = [
  'Lançar, editar ou apagar qualquer coisa',
  'Ver sua senha ou o acesso ao seu banco',
  'Mexer no seu plano ou pagamento',
];

type Fase = 'carregando' | 'deslogado' | 'pedido' | 'invalido' | 'sem_acesso' | 'enviando' | 'voltando';
type Pedido = { cliente: { nome: string; logo: string | null; host: string }; email: string | null; acesso: AcessoChatgpt };

function Autorizar() {
  const sp = useSearchParams();
  const { user, loading, signOut } = useAuth();
  const [fase, setFase] = useState<Fase>('carregando');
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const conferiu = useRef(false);

  // Só os parâmetros do OAuth, como vieram — o backend reconfere todos.
  const params: Record<string, string> = {};
  for (const k of CAMPOS) { const v = sp.get(k); if (v !== null) params[k] = v; }
  const aqui = `/oauth/autorizar?${sp.toString()}`;

  useEffect(() => {
    if (loading) return;
    if (!user) { setFase('deslogado'); return; }
    if (conferiu.current) return;
    conferiu.current = true;
    (async () => {
      try {
        const r = await api.iaConectada.pedido(params);
        setPedido({ cliente: r.cliente, email: r.email, acesso: r.acesso });
        setFase(r.acesso.ok ? 'pedido' : 'sem_acesso');
      } catch (e: any) {
        // Pedido com erro já conferido (ex.: sem PKCE): o OAuth manda voltar
        // ao ChatGPT com o erro. Sem endereço conferido, só a tela explica.
        const voltar = e?.body?.voltar;
        if (voltar) { setFase('voltando'); window.location.assign(voltar); return; }
        setErro(e?.body?.descricao || e?.message || 'Não consegui conferir este pedido de conexão.');
        setFase('invalido');
      }
    })();
    // `params` sai da URL, que não muda nesta tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  async function permitir() {
    setFase('enviando'); setAviso('');
    try {
      const r = await api.iaConectada.aprovar(params);
      setFase('voltando');
      window.location.assign(r.url);
    } catch (e: any) {
      setAviso(e?.message || 'Não consegui concluir a conexão. Tente de novo.');
      setFase('pedido');
    }
  }

  async function agoraNao() {
    setFase('enviando');
    try {
      const r = await api.iaConectada.negar(params);
      if (r.url) { setFase('voltando'); window.location.assign(r.url); return; }
    } catch { /* sem pra onde voltar: fica a tela */ }
    window.location.assign('/dashboard');
  }

  async function trocarConta() {
    await signOut();
    window.location.assign(`/login?next=${encodeURIComponent(aqui)}`);
  }

  const nomeCliente = pedido?.cliente.nome || 'ChatGPT';

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-8 bg-background">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-xl">
        {/* Sora ↔ ChatGPT */}
        <div className="flex items-center justify-center gap-3" aria-hidden="true">
          <img src="/sora-icon.png" alt="" width={48} height={48} className="w-12 h-12 rounded-2xl" />
          <ArrowLeftRight size={18} className="text-muted-foreground" />
          {pedido?.cliente.logo
            ? <img src={pedido.cliente.logo} alt="" width={48} height={48} className="w-12 h-12 rounded-2xl bg-white p-2 border border-border" />
            : <span className="w-12 h-12 rounded-2xl bg-muted grid place-items-center text-sm font-bold text-foreground">AI</span>}
        </div>

        {(fase === 'carregando' || fase === 'voltando') && (
          <p className="mt-8 mb-2 flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 size={16} className="animate-spin" />
            {fase === 'voltando' ? `Voltando para o ${nomeCliente}…` : 'Conferindo o pedido…'}
          </p>
        )}

        {fase === 'deslogado' && (
          <div className="text-center">
            <h1 className="mt-5 text-xl font-bold text-foreground">Conectar o ChatGPT à Sora</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Entre na sua conta da Sora para escolher se o ChatGPT pode ler seus dados.
            </p>
            <Link href={`/login?next=${encodeURIComponent(aqui)}`}
                  className="mt-6 w-full h-12 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, outlineColor: BRAND }}>
              <LogIn size={16} /> Entrar na Sora
            </Link>
          </div>
        )}

        {fase === 'invalido' && (
          <div className="text-center">
            <h1 className="mt-5 text-xl font-bold text-foreground">Não deu para conectar</h1>
            <p className="mt-3 inline-flex items-start gap-2 text-sm text-left text-red-500" role="alert">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> {erro}
            </p>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Volte ao ChatGPT e comece a conexão de novo por lá. Se continuar, fale com o suporte na Ajuda da Sora.
            </p>
            <Link href="/dashboard"
                  className="mt-6 w-full h-11 rounded-xl text-sm font-semibold text-foreground border border-border inline-flex items-center justify-center hover:bg-muted transition-colors">
              Ir para o painel
            </Link>
          </div>
        )}

        {fase === 'sem_acesso' && pedido && (
          <div className="text-center">
            <h1 className="mt-5 text-xl font-bold text-foreground">
              {pedido.acesso.motivo === 'plano' ? 'Disponível no Premium e no Platinum' : 'Ainda não disponível para esta conta'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {pedido.acesso.motivo === 'plano'
                ? 'O plano desta conta não inclui a Sora no ChatGPT.'
                : pedido.acesso.motivo === 'desligada'
                  ? 'A conexão com o ChatGPT está pausada por enquanto.'
                  : 'A Sora no ChatGPT está em teste com poucas contas. Ela chega para todos em breve.'}
            </p>
            {pedido.email && (
              <p className="mt-3 text-xs text-muted-foreground">
                Conta: <span className="font-semibold text-foreground">{pedido.email}</span>
                {' · '}
                <button type="button" onClick={trocarConta} className="underline underline-offset-2 hover:text-foreground min-h-[44px]">
                  Usar outra conta
                </button>
              </p>
            )}
            <button type="button" onClick={agoraNao}
                    className="mt-5 w-full h-12 rounded-xl text-sm font-bold text-foreground border border-border inline-flex items-center justify-center hover:bg-muted transition-colors">
              Voltar para o {nomeCliente}
            </button>
          </div>
        )}

        {(fase === 'pedido' || fase === 'enviando') && pedido && (
          <>
            <h1 className="mt-5 text-center text-xl font-bold text-foreground leading-snug">
              Permitir que o {nomeCliente} leia sua Sora?
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground leading-relaxed">
              Assim você pergunta sobre o seu dinheiro direto no {nomeCliente}, e ele responde com os seus números.
            </p>

            <section className="mt-6" aria-labelledby="ve">
              <h2 id="ve" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Eye size={16} style={{ color: BRAND }} /> Ele vai poder ver
              </h2>
              <ul className="mt-2 space-y-1.5">
                {VE.map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-foreground">
                    <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: BRAND }} aria-hidden="true" /> {t}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-5" aria-labelledby="naofaz">
              <h2 id="naofaz" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck size={16} className="text-muted-foreground" /> Ele não vai poder
              </h2>
              <ul className="mt-2 space-y-1.5">
                {NAO_FAZ.map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <X size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" /> {t}
                  </li>
                ))}
              </ul>
            </section>

            <p className="mt-5 rounded-2xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
              O que o {nomeCliente} ler fica na sua conta dele e segue as regras da OpenAI. Você desconecta
              quando quiser, na aba <strong className="text-foreground">ChatGPT</strong> do painel da Sora.
            </p>

            {pedido.email && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Conectando a conta <span className="font-semibold text-foreground">{pedido.email}</span>
                {' · '}
                <button type="button" onClick={trocarConta} className="underline underline-offset-2 hover:text-foreground min-h-[44px]">
                  Usar outra conta
                </button>
              </p>
            )}

            {aviso && (
              <p className="mt-3 inline-flex items-start gap-2 text-sm text-red-500" role="alert">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> {aviso}
              </p>
            )}

            <div className="mt-5 space-y-2.5">
              <button type="button" onClick={permitir} disabled={fase === 'enviando'}
                      className="w-full h-12 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2 transition-transform active:scale-[0.99] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, outlineColor: BRAND }}>
                {fase === 'enviando' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Permitir acesso
              </button>
              <button type="button" onClick={agoraNao} disabled={fase === 'enviando'}
                      className="w-full h-12 rounded-xl text-sm font-semibold text-foreground border border-border inline-flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-60">
                Agora não
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Depois você volta para {pedido.cliente.host}.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function AutorizarPage() {
  // `useSearchParams` precisa de Suspense no App Router.
  return (
    <Suspense fallback={<main className="min-h-dvh bg-background" />}>
      <Autorizar />
    </Suspense>
  );
}

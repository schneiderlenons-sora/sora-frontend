'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Entrar num grupo por LINK (o destino do QR do convite).
//
// ⚠️ POR QUE ESTA PÁGINA EXISTE — dois defeitos medidos em 23/09/2026, no mesmo
// relato de cliente ("não consigo colocar outros membros"):
//
// 1. O QR CODIFICAVA O CÓDIGO CRU (ex.: "A1B2C3"), não uma URL. Câmera de
//    celular que lê texto solto cai na BUSCA NA WEB / leitor de código de
//    produto — o cliente relatou que o QR "abre para fazer compra de papelão",
//    que é exatamente uma busca casando o código com um anúncio. Agora o QR
//    aponta pra cá.
//
// 2. QUEM CHEGAVA PELO SITE BATIA NO PAYWALL. Conta nova nasce `inativo`, e o
//    `PaywallRedirect` manda TODA rota pro /planos — então o convidado era
//    mandado pra uma tabela de preços e nunca alcançava
//    "Comunidade → Entrar em grupo". Era o "pelo site pede para criar conta e
//    efetuar pagamento" do relato. ⚠️ E isso CONTRARIA o próprio backend:
//    `POST /grupos/entrar` NÃO exige plano do convidado — o limite de membros
//    é do plano do DONO do grupo. Quem paga é quem convida.
//
// Por isso a rota entra em `ROTAS_LIVRES` e, ao resgatar um convite VÁLIDO,
// libera o modo grátis (`/api/plano-gratis`, que só anda de inativo → gratis).
// ⚠️ Não é brecha nova: essa rota já é chamável por qualquer conta autenticada
// e é o que o app Android faz com todo mundo. Aqui é mais estreito — exige um
// convite que o backend validou.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Users, CheckCircle2, AlertCircle, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const BRAND = '#61D17B';

type Fase = 'verificando' | 'deslogado' | 'entrando' | 'ok' | 'erro';

export default function ConvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user, perfil, loading, recarregar } = useAuth();

  const codigo = String(params?.codigo || '').toUpperCase().trim();
  const [fase, setFase] = useState<Fase>('verificando');
  const [erro, setErro] = useState('');
  // Uma tentativa por carregamento: o efeito depende do auth, que reavalia
  // quando a aba volta ao foco — sem isto o convite seria resgatado de novo.
  const tentou = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { setFase('deslogado'); return; }
    if (tentou.current) return;
    tentou.current = true;

    (async () => {
      setFase('entrando');
      try {
        // O backend valida código, validade, uso e o limite de membros do
        // plano do dono. Se recusar, a mensagem dele é a que aparece na tela.
        await api.grupos.aceitar(perfil?.phone || perfil?.id || '', codigo);

        // Só DEPOIS de entrar de verdade. Assim o modo grátis nunca é liberado
        // por um código inválido ou por um grupo que já estourou o limite.
        try { await fetch('/api/plano-gratis', { method: 'POST' }); } catch {}

        await recarregar();
        setFase('ok');
        // Navegação completa: o plano acabou de mudar e o paywall precisa ler
        // o valor novo — um push de client-side correria com ele.
        setTimeout(() => { window.location.href = '/dashboard'; }, 1200);
      } catch (e: any) {
        setErro(e?.message || 'Não foi possível usar este convite.');
        setFase('erro');
      }
    })();
  }, [loading, user, perfil, codigo, recarregar, router]);

  const destino = `/convite/${encodeURIComponent(codigo)}`;

  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-xl">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
             style={{ background: `${BRAND}1f` }}>
          <Users size={26} style={{ color: BRAND }} />
        </div>

        <h1 className="mt-4 text-xl font-bold text-foreground">Convite para um grupo na Sora</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Código <span className="font-mono font-bold text-foreground tabular-nums">{codigo}</span>
        </p>

        {(fase === 'verificando' || fase === 'entrando') && (
          <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            {fase === 'entrando' ? 'Entrando no grupo…' : 'Verificando…'}
          </p>
        )}

        {fase === 'deslogado' && (
          <>
            <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
              Entre na sua conta pra aceitar o convite. Se ainda não tem conta, crie uma —
              {' '}<strong className="text-foreground">você não precisa pagar nada pra participar</strong>:
              quem assina é quem te convidou.
            </p>
            <div className="mt-6 space-y-2.5">
              <Link href={`/login?next=${encodeURIComponent(destino)}`}
                    className="w-full h-12 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2"
                    style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
                <LogIn size={16} /> Entrar na minha conta
              </Link>
              <Link href={`/signup?next=${encodeURIComponent(destino)}`}
                    className="w-full h-12 rounded-xl text-sm font-bold text-foreground border border-border inline-flex items-center justify-center hover:bg-muted transition-colors">
                Criar conta gratuita
              </Link>
            </div>
          </>
        )}

        {fase === 'ok' && (
          <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: BRAND }}>
            <CheckCircle2 size={16} /> Pronto! Abrindo o painel do grupo…
          </p>
        )}

        {fase === 'erro' && (
          <>
            <p className="mt-6 inline-flex items-start gap-2 text-sm text-left text-red-500">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> {erro}
            </p>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Convites valem por 7 dias e só podem ser usados uma vez. Peça um código novo
              a quem te convidou.
            </p>
            <Link href="/dashboard"
                  className="mt-5 w-full h-11 rounded-xl text-sm font-semibold text-foreground border border-border inline-flex items-center justify-center hover:bg-muted transition-colors">
              Ir pro painel
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

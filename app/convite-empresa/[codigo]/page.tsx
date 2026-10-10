'use client';

// =============================================================================
// Aceitar convite de EMPRESA (Negócios multiusuário, Fase 3).
//
// Irmã da /convite (grupo), mas com DUAS diferenças de propósito:
//
// 1. NÃO aceita sozinha ao abrir. Resolve o convite, MOSTRA a empresa e o papel,
//    e só então oferece "Aceitar". É aqui que o convidado lê que precisa do
//    próprio Platinum pra operar — o plano 4.5 exige esse aviso ANTES.
// 2. NÃO libera modo grátis. Operar Negócios depende do Platinum do próprio
//    usuário; dar `gratis` aqui enganaria. Aceitar cria o VÍNCULO (fica
//    "guardado"); quando a pessoa assinar, já entra direto.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Store, CheckCircle2, AlertCircle, LogIn, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const BRAND = '#61D17B';
const PAPEL_LABEL: Record<string, string> = {
  admin: 'Admin', operador: 'Operador', leitura: 'Leitura (contador)',
};

type Fase = 'verificando' | 'deslogado' | 'pronto' | 'entrando' | 'ok' | 'sem-plano' | 'erro';

export default function ConviteEmpresaPage() {
  const params = useParams();
  const { user, loading, recarregar } = useAuth();
  const codigo = String(params?.codigo || '').toUpperCase().trim();

  const [fase, setFase]   = useState<Fase>('verificando');
  const [erro, setErro]   = useState('');
  const [info, setInfo]   = useState<{ empresa_nome: string; papel: string; tem_plano: boolean } | null>(null);
  const resolveu = useRef(false);

  // 1) Resolve o convite (não aceita ainda). Depende do auth: deslogado não
  //    consegue nem resolver (precisa saber quem é pra depois virar membro).
  useEffect(() => {
    if (loading) return;
    if (!user) { setFase('deslogado'); return; }
    if (resolveu.current) return;
    resolveu.current = true;
    (async () => {
      try {
        const r = await api.negocios.acessos.resolverConvite(codigo);
        setInfo({ empresa_nome: r.empresa_nome, papel: r.papel, tem_plano: r.tem_plano });
        setFase('pronto');
      } catch (e: any) {
        setErro(e?.message || 'Não foi possível abrir este convite.');
        setFase('erro');
      }
    })();
  }, [loading, user, codigo]);

  async function aceitar() {
    setFase('entrando'); setErro('');
    try {
      const r = await api.negocios.acessos.aceitarConvite(codigo);
      await recarregar();
      if (r.tem_plano) {
        setFase('ok');
        // Navegação completa: o acesso mudou e o shell de Negócios precisa reler.
        setTimeout(() => { window.location.href = '/negocios'; }, 1200);
      } else {
        setFase('sem-plano');   // é membro, mas falta o Platinum pra operar
      }
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível aceitar o convite.');
      setFase('erro');
    }
  }

  const destino = `/convite-empresa/${encodeURIComponent(codigo)}`;

  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-xl">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ background: `${BRAND}1f` }}>
          <Store size={26} style={{ color: BRAND }} />
        </div>

        <h1 className="mt-4 text-xl font-bold text-foreground">Convite para uma empresa na Sora</h1>

        {fase === 'verificando' && (
          <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Verificando…
          </p>
        )}

        {fase === 'deslogado' && (
          <>
            <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
              Entre na sua conta pra aceitar o convite. Se ainda não tem conta, crie uma.
            </p>
            <div className="mt-6 space-y-2.5">
              <Link href={`/login?next=${encodeURIComponent(destino)}`}
                    className="w-full h-12 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2"
                    style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
                <LogIn size={16} /> Entrar na minha conta
              </Link>
              <Link href={`/signup?next=${encodeURIComponent(destino)}`}
                    className="w-full h-12 rounded-xl text-sm font-bold text-foreground border border-border inline-flex items-center justify-center hover:bg-muted transition-colors">
                Criar conta
              </Link>
            </div>
          </>
        )}

        {fase === 'pronto' && info && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Você foi convidado para <strong className="text-foreground">{info.empresa_nome}</strong> como{' '}
              <strong className="text-foreground">{PAPEL_LABEL[info.papel] || info.papel}</strong>.
            </p>

            {!info.tem_plano && (
              <div className="mt-5 rounded-2xl border p-3.5 text-left flex gap-2.5"
                   style={{ borderColor: '#f59e0b55', background: '#f59e0b14' }}>
                <Crown size={16} className="shrink-0 mt-0.5 text-amber-500" />
                <p className="text-[12.5px] text-foreground leading-relaxed">
                  Pra operar esta empresa pelo painel e pelo WhatsApp é preciso um plano <strong>Platinum</strong>.
                  Pode aceitar agora mesmo assim — o convite fica guardado e você entra direto assim que assinar.
                </p>
              </div>
            )}

            <button type="button" onClick={aceitar}
              className="mt-6 w-full h-12 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
              <CheckCircle2 size={16} /> Aceitar convite
            </button>
          </>
        )}

        {fase === 'entrando' && (
          <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Entrando na empresa…
          </p>
        )}

        {fase === 'ok' && (
          <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: BRAND }}>
            <CheckCircle2 size={16} /> Pronto! Abrindo o painel da empresa…
          </p>
        )}

        {fase === 'sem-plano' && (
          <>
            <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: BRAND }}>
              <CheckCircle2 size={16} /> Você já faz parte de {info?.empresa_nome}!
            </p>
            <p className="mt-3 text-[13px] text-muted-foreground leading-relaxed">
              Falta só o plano <strong className="text-foreground">Platinum</strong> pra começar a lançar e ver os números.
              Assim que assinar, a empresa aparece pra você automaticamente.
            </p>
            <Link href="/planos"
                  className="mt-5 w-full h-12 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
              <Crown size={16} /> Ver o Platinum
            </Link>
          </>
        )}

        {fase === 'erro' && (
          <>
            <p className="mt-6 inline-flex items-start gap-2 text-sm text-left text-red-500">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> {erro}
            </p>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Convites valem por 7 dias e só podem ser usados uma vez. Peça um link novo a quem te convidou.
            </p>
            <Link href="/negocios"
                  className="mt-5 w-full h-11 rounded-xl text-sm font-semibold text-foreground border border-border inline-flex items-center justify-center hover:bg-muted transition-colors">
              Ir pro painel
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

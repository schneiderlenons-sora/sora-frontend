'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Check, CheckCircle2, Loader2, AlertCircle, ExternalLink, RefreshCw, Sparkles, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PLANOS_DISPLAY } from '@/lib/planos-display';
import { LINK_PLAY_STORE } from '@/lib/play-store';
import {
  produtoPlay, modoDeTroca, PRODUTOS_PLAY, ORDEM_PLAY,
  type PlanoPlay, type IntervaloPlay,
} from '@/lib/play-billing';
import {
  servicoPlay, detalhesPlay, comprarPlay, comprasDoAparelho, linkGerenciarPlay, type DetalheItem,
} from '@/lib/digital-goods';

// ─────────────────────────────────────────────────────────────────────────────
// A grade de planos DENTRO do app Android, cobrada pela Google Play.
//
// Substitui a grade do Stripe só no app nativo (`useEhAppNativo`). No site nada
// muda. O fluxo: janela de pagamento do Google → /api/play/verificar confere
// com o Google e libera o plano → só então a janela fecha com "sucesso".
//
// ⚠️ NESTA TELA NÃO SE FALA DO SITE NEM DE OUTRO MEIO DE PAGAMENTO. É a regra
// do Google ("anti-steering"): dentro do app, a única compra mencionada é a
// da própria Play.
// ─────────────────────────────────────────────────────────────────────────────

export type StatusPlay = {
  ativa: boolean;
  produto?: string;
  plano?: PlanoPlay;
  intervalo?: IntervaloPlay;
  estado?: string;
  expiraEm?: string;
  autoRenova?: boolean;
  purchaseToken?: string;
  indisponivel?: boolean;
};

const fetcherJson = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : { ativa: false }));
export function useStatusPlay(ligado = true) {
  return useSWR<StatusPlay>(ligado ? '/api/play/status' : null, fetcherJson, { revalidateOnFocus: true });
}

const PLANOS = PLANOS_DISPLAY.filter((p) => p.id in ORDEM_PLAY);

function precoTexto(d: DetalheItem | undefined): string | null {
  if (!d) return null;
  const v = Number(d.price.value);
  if (!Number.isFinite(v)) return null;
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: d.price.currency }).format(v);
  } catch { return `${d.price.currency} ${v.toFixed(2)}`; }
}

async function confirmarNoServidor(tokens: string[]) {
  const r = await fetch('/api/play/verificar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tokens }),
  });
  const j = await r.json().catch(() => ({})) as { resultados?: { ok: boolean; motivo?: string }[]; erro?: string };
  return { http: r.status, resultados: j.resultados || [], erro: j.erro };
}

const MOTIVO: Record<string, string> = {
  outra_conta: 'Esta compra da Google Play já está ligada a outra conta da Sora. Entre com a conta que fez a assinatura.',
  ja_tem_plano: 'Sua conta já tem um plano ativo, então esta compra não foi aplicada. O Google devolve o valor automaticamente em até 3 dias.',
  produto_desconhecido: 'Este plano não está disponível no momento. O Google devolve o valor automaticamente em até 3 dias.',
};

export default function PlanosPlay() {
  const { plano: planoAtual, isVitalicio, recarregar } = useAuth();
  const { data: status, mutate } = useStatusPlay();
  const [disponivel, setDisponivel] = useState<boolean | null>(null);
  const [precos, setPrecos] = useState<Record<string, DetalheItem>>({});
  // Derivado, não sincronizado por efeito: enquanto a pessoa não escolhe, abre
  // no ciclo da assinatura que ela já tem.
  const [cicloEscolhido, setAnual] = useState<boolean | null>(null);
  const anual = cicloEscolhido ?? status?.intervalo === 'anual';
  const [comprando, setComprando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro' | 'pendente'; texto: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const s = await servicoPlay();
      if (!vivo) return;
      setDisponivel(!!s);
      if (!s) return;
      try {
        const d = await detalhesPlay(Object.keys(PRODUTOS_PLAY));
        if (vivo) setPrecos(d);
      } catch { /* sem preço, os cards mostram "indisponível" */ }
    })();
    return () => { vivo = false; };
  }, []);

  async function tentarDeNovo() {
    setAviso(null);
    const tokens = await comprasDoAparelho();
    if (!tokens.length) { setAviso({ tipo: 'erro', texto: 'Não encontramos nenhuma compra neste aparelho.' }); return; }
    const r = await confirmarNoServidor(tokens);
    if (r.resultados.some((x) => x.ok)) {
      await Promise.all([recarregar(), mutate()]);
      setAviso({ tipo: 'ok', texto: 'Pronto! Sua assinatura está ativa.' });
    } else {
      setAviso({ tipo: 'erro', texto: MOTIVO[r.resultados[0]?.motivo || ''] || 'Ainda não conseguimos confirmar. Tente de novo em alguns minutos.' });
    }
  }

  async function assinar(plano: PlanoPlay) {
    const ciclo: IntervaloPlay = anual ? 'anual' : 'mensal';
    const sku = produtoPlay(plano, ciclo);
    setAviso(null);
    setComprando(sku);
    try {
      const troca = status?.ativa && status.produto && status.purchaseToken && status.plano && status.produto !== sku
        ? { oldSku: status.produto, purchaseToken: status.purchaseToken, replacementMode: modoDeTroca(status.plano, plano) }
        : undefined;
      const compra = await comprarPlay(sku, troca);
      if (!compra.ok) {
        if (!compra.cancelada) setAviso({ tipo: 'erro', texto: compra.erro || 'Não foi possível abrir o pagamento.' });
        return;
      }
      const r = await confirmarNoServidor([compra.purchaseToken]).catch(() => null);
      const res = r?.resultados[0];
      await compra.concluir(!!res?.ok);
      if (res?.ok) {
        await Promise.all([recarregar(), mutate()]);
        setAviso({
          tipo: 'ok',
          texto: troca && troca.replacementMode === 'deferred'
            ? 'Troca agendada! O novo plano começa na próxima renovação — até lá você continua no atual.'
            : 'Assinatura ativa! Já pode usar tudo do seu plano novo.',
        });
      } else if (res?.motivo && MOTIVO[res.motivo]) {
        setAviso({ tipo: 'erro', texto: MOTIVO[res.motivo] });
      } else {
        // ⚠️ O pagamento PODE ter sido feito. Dizer "deu erro" faria a pessoa
        // pagar de novo; a restauração na próxima abertura resolve sozinha.
        setAviso({
          tipo: 'pendente',
          texto: 'O pagamento foi enviado ao Google, mas ainda não conseguimos liberar o plano. Não pague de novo: a Sora confirma sozinha nos próximos minutos — ou toque em "Confirmar compra".',
        });
      }
    } finally {
      setComprando(null);
    }
  }

  // ── Casos em que não há o que vender aqui ─────────────────────────────────
  if (isVitalicio) {
    return (
      <Nota>
        {planoAtual === 'kit'
          ? 'Seu Kit é vitalício: sem mensalidade, pra sempre.'
          : 'Seu acesso é vitalício: sem mensalidade, pra sempre.'}
      </Nota>
    );
  }
  if (status === undefined || disponivel === null) {
    return <div className="h-64 rounded-3xl bg-muted/40 animate-pulse" aria-busy="true" aria-label="Carregando planos" />;
  }
  const pagoForaDaPlay = !status.ativa && ['basico', 'premium', 'platinum'].includes(planoAtual);
  if (pagoForaDaPlay) {
    return <Nota>Sua assinatura atual continua valendo normalmente. Ela foi feita fora deste app, então é gerenciada fora dele.</Nota>;
  }
  if (!disponivel) {
    return (
      <Nota>
        A assinatura pelo app chega na versão nova da Sora.{' '}
        <a href={LINK_PLAY_STORE} className="font-semibold underline" style={{ color: 'hsl(var(--primary))' }}>
          Atualize o app na Play Store
        </a>{' '}
        e volte aqui.
      </Nota>
    );
  }

  const ciclo: IntervaloPlay = anual ? 'anual' : 'mensal';

  return (
    <div className="space-y-5">
      {status.ativa && (
        <div className="max-w-2xl mx-auto rounded-2xl border border-border/60 bg-card/60 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-foreground/85">
            Assinatura pela Google Play
            {status.expiraEm && (
              <> · {status.autoRenova ? 'renova' : 'termina'} em {new Date(status.expiraEm).toLocaleDateString('pt-BR')}</>
            )}
            {status.estado === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' && (
              <span className="block text-xs text-amber-700 dark:text-amber-400 mt-1">
                O Google não conseguiu cobrar a renovação. Atualize a forma de pagamento na Play Store pra não perder o plano.
              </span>
            )}
          </p>
          <a href={linkGerenciarPlay(status.produto)}
             className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl text-sm font-semibold border border-border hover:bg-muted/50">
            Gerenciar na Play Store <ExternalLink size={14} aria-hidden />
          </a>
        </div>
      )}

      {aviso && (
        <div role={aviso.tipo === 'ok' ? 'status' : 'alert'}
             className={`max-w-2xl mx-auto flex items-start gap-3 p-4 rounded-2xl text-sm border ${
               aviso.tipo === 'ok'
                 ? 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900/60 text-green-800 dark:text-green-300'
                 : aviso.tipo === 'pendente'
                   ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-300'
                   : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300'
             }`}>
          {aviso.tipo === 'ok' ? <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p>{aviso.texto}</p>
            {aviso.tipo === 'pendente' && (
              <button onClick={tentarDeNovo} className="mt-2 inline-flex items-center gap-1.5 min-h-11 font-semibold underline">
                <RefreshCw size={14} aria-hidden /> Confirmar compra
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mensal / anual */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-muted/50 border border-border/60" role="group" aria-label="Ciclo de cobrança">
          {(['mensal', 'anual'] as const).map((c) => (
            <button key={c} onClick={() => setAnual(c === 'anual')} aria-pressed={ciclo === c}
                    className={`px-5 py-2.5 min-h-11 text-sm font-bold rounded-xl transition-all ${
                      ciclo === c ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}>
              {c === 'mensal' ? 'Mensal' : 'Anual'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 max-w-5xl mx-auto gap-5 pt-2">
        {PLANOS.map((p) => {
          const id = p.id as PlanoPlay;
          const sku = produtoPlay(id, ciclo);
          const preco = precoTexto(precos[sku]);
          const ehAtual = status.ativa && status.produto === sku;
          const mesmoPlanoOutroCiclo = status.ativa && status.plano === id && !ehAtual;
          const subir = status.ativa && status.plano ? ORDEM_PLAY[id] > ORDEM_PLAY[status.plano] : true;
          const ocupado = comprando !== null;
          const rotulo = !status.ativa ? 'Assinar' : mesmoPlanoOutroCiclo ? `Mudar pro ${ciclo}` : subir ? 'Fazer upgrade' : 'Mudar pra este';

          return (
            <div key={p.id}
                 className={`relative rounded-3xl p-6 bg-card ${p.destaque || ehAtual ? 'border-2' : 'border border-border/70'}`}
                 style={{ borderColor: p.destaque || ehAtual ? p.cor : undefined }}>
              {ehAtual ? (
                <span className="absolute top-4 right-4 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                      style={{ background: `color-mix(in srgb, ${p.cor} 13%, transparent)`, color: p.cor }}>
                  <CheckCircle2 size={10} aria-hidden /> Atual
                </span>
              ) : p.badge && (
                <span className="absolute top-4 right-4 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-white"
                      style={{ background: p.cor }}>
                  {p.id === 'premium' ? <Sparkles size={9} aria-hidden /> : <Crown size={9} aria-hidden />} {p.badge}
                </span>
              )}
              <h3 className="text-xl font-bold text-foreground tracking-tight">{p.nome}</h3>
              <p className="text-sm text-muted-foreground mt-1">{p.subtitulo}</p>

              <div className="mt-4 mb-5 min-h-[56px]">
                {preco ? (
                  <>
                    <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">{preco}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ciclo === 'anual' ? 'por ano' : 'por mês'} · cobrado pela Google Play</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Indisponível no momento.</p>
                )}
              </div>

              <button
                onClick={() => assinar(id)}
                disabled={ehAtual || !preco || ocupado}
                className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: ehAtual ? 'hsl(var(--muted-foreground))' : `linear-gradient(135deg, ${p.cor}, ${p.corDark})` }}
              >
                {comprando === sku ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                {ehAtual ? 'Seu plano atual' : comprando === sku ? 'Aguardando o Google…' : rotulo}
              </button>

              <ul className="mt-5 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground/80">
                    <Check size={15} className="flex-shrink-0 mt-0.5" style={{ color: p.cor }} aria-hidden /> {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground max-w-xl mx-auto leading-relaxed">
        A assinatura renova automaticamente e pode ser cancelada a qualquer momento em
        Play Store → Pagamentos e assinaturas. Ao cancelar, você continua com o plano até o fim do período pago.
        {' '}<button onClick={tentarDeNovo} className="underline min-h-11 inline-flex items-center">Já assinei e o plano não apareceu</button>
      </p>
    </div>
  );
}

function Nota({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-xl mx-auto rounded-2xl border border-border/60 bg-card/60 p-5 text-sm text-foreground/80 text-center leading-relaxed">
      {children}
    </div>
  );
}

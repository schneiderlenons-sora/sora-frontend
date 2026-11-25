'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, CheckCircle2, Loader2, AlertCircle, RefreshCw, Sparkles, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PLANOS_DISPLAY } from '@/lib/planos-display';
import { produtoApple, ORDEM_APPLE, type PlanoApple, type IntervaloApple } from '@/lib/apple-billing';
import { precoTexto } from './usePlayCompra';
import { useAppleCompra } from './useAppleCompra';

// ─────────────────────────────────────────────────────────────────────────────
// A grade de planos DENTRO do app de iPhone, cobrada pela Apple. Irmã da
// PlanosPlay (Android). Só aparece no build que vende (`useIosVende`); no app
// antigo continua a PlanosNoAppIos, que não vende nada.
//
// ⚠️ NESTA TELA NÃO SE FALA DO SITE NEM DE OUTRO MEIO DE PAGAMENTO (Apple
// 3.1.1 / anti-steering). A única compra mencionada é a da App Store.
//
// ⚠️ O QUE A APPLE EXIGE NA TELA DE ASSINATURA (3.1.2): nome e período de cada
// plano, preço, que renova sozinho e como cancelar, "Restaurar compras" e links
// pros Termos de Uso e a Política de Privacidade. Tirar um deles reprova o app.
// ─────────────────────────────────────────────────────────────────────────────

const PLANOS = PLANOS_DISPLAY.filter((p) => p.id in ORDEM_APPLE);

/** O texto que a Apple pede junto de toda oferta de assinatura. */
export function AvisoAssinaturaApple({ onRestaurar, className = '' }: { onRestaurar?: () => void; className?: string }) {
  return (
    <div className={`text-xs leading-relaxed ${className}`}>
      <p>
        A cobrança é feita na sua conta Apple ao confirmar a compra. A assinatura renova automaticamente pelo
        mesmo valor e período, a menos que seja cancelada até 24 horas antes do fim do período. Gerencie ou
        cancele em Ajustes › seu nome › Assinaturas. Ao cancelar, o plano segue até o fim do período pago.
      </p>
      <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Link href="/termos" className="underline min-h-11 inline-flex items-center">Termos de Uso</Link>
        <Link href="/privacidade" className="underline min-h-11 inline-flex items-center">Política de Privacidade</Link>
        {onRestaurar && (
          <button type="button" onClick={onRestaurar} className="underline min-h-11 inline-flex items-center">Restaurar compras</button>
        )}
      </p>
    </div>
  );
}

export default function PlanosApple() {
  const { plano: planoAtual, isVitalicio } = useAuth();
  const compra = useAppleCompra();
  const { status, disponivel, precos, comprando, aviso } = compra;
  const [cicloEscolhido, setAnual] = useState<boolean | null>(null);
  const anual = cicloEscolhido ?? status?.intervalo === 'anual';
  const [trocaAgendada, setTrocaAgendada] = useState(false);

  async function assinar(plano: PlanoApple) {
    const ciclo: IntervaloApple = anual ? 'anual' : 'mensal';
    // Na Apple, subir vale na hora; descer (ou mudar de ciclo) vale na próxima
    // renovação. A mensagem tem de dizer qual dos dois aconteceu.
    const desce = !!(status?.ativa && status.plano && ORDEM_APPLE[plano] <= ORDEM_APPLE[status.plano]);
    const ok = await compra.assinar(plano, ciclo);
    if (ok && desce) setTrocaAgendada(true);
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
  const pagoForaDaApple = !status.ativa && ['basico', 'premium', 'platinum'].includes(planoAtual);
  if (pagoForaDaApple) {
    return <Nota>Seu plano atual continua valendo normalmente neste app.</Nota>;
  }
  if (!disponivel) {
    return <Nota>As assinaturas não estão disponíveis no momento. Tente de novo mais tarde.</Nota>;
  }

  const ciclo: IntervaloApple = anual ? 'anual' : 'mensal';
  const textoAviso = aviso?.tipo === 'ok' && trocaAgendada
    ? 'Troca agendada! O novo plano começa na próxima renovação — até lá você continua no atual.'
    : aviso?.texto;

  return (
    <div className="space-y-5">
      {status.ativa && (
        <div className="max-w-2xl mx-auto rounded-2xl border border-border/60 bg-card/60 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-foreground/85">
            Assinatura pela App Store
            {status.expiraEm && (
              <> · {status.autoRenova ? 'renova' : 'termina'} em {new Date(status.expiraEm).toLocaleDateString('pt-BR')}</>
            )}
            {status.estado === 'carencia' && (
              <span className="block text-xs text-amber-700 dark:text-amber-400 mt-1">
                A Apple não conseguiu cobrar a renovação. Atualize a forma de pagamento nos Ajustes do iPhone pra não perder o plano.
              </span>
            )}
          </p>
          <button type="button" onClick={() => compra.gerenciar()}
                  className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl text-sm font-semibold border border-border hover:bg-muted/50">
            Gerenciar assinatura
          </button>
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
            <p>{textoAviso}</p>
            {aviso.tipo === 'pendente' && (
              <button onClick={() => compra.confirmarPendente()} className="mt-2 inline-flex items-center gap-1.5 min-h-11 font-semibold underline">
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
          const id = p.id as PlanoApple;
          const sku = produtoApple(id, ciclo);
          // Só o preço da App Store: o de tabela é o do site, e aqui ele é outro.
          const preco = precoTexto(precos[sku]);
          const ehAtual = status.ativa && status.produto === sku;
          const mesmoPlanoOutroCiclo = status.ativa && status.plano === id && !ehAtual;
          const subir = status.ativa && status.plano ? ORDEM_APPLE[id] > ORDEM_APPLE[status.plano] : true;
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
                    <p className="text-xs text-muted-foreground mt-0.5">{ciclo === 'anual' ? 'por ano' : 'por mês'} · renova automaticamente</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{compra.erroPreco ? 'Indisponível no momento.' : 'Carregando preço…'}</p>
                )}
              </div>

              <button
                onClick={() => assinar(id)}
                disabled={ehAtual || !preco || ocupado}
                className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: ehAtual ? 'hsl(var(--muted-foreground))' : `linear-gradient(135deg, ${p.cor}, ${p.corDark})` }}
              >
                {comprando === sku ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                {ehAtual ? 'Seu plano atual' : comprando === sku ? 'Aguardando a App Store…' : rotulo}
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

      <AvisoAssinaturaApple onRestaurar={() => compra.restaurar()} className="text-center text-muted-foreground max-w-xl mx-auto" />
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

'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Aba "Widgets": conecta os widgets do celular à conta (fase 2, nov/2026).
//
// Os widgets moram no app; aqui a pessoa (1) conecta ESTE aparelho, (2) vê os
// aparelhos conectados e desconecta, e (3) entende o que cada widget mostra.
// Conexão: lib/widgets.ts. Servidor: sora-backend/src/routes/widget.js.
//
// ⚠️ No app de iPhone NADA se vende: fora do plano a tela só diz que os widgets
// não fazem parte do plano (sem preço, sem link pra planos).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  Smartphone, CheckCircle2, AlertCircle, Loader2, Unplug, Zap, Waves, CalendarClock, CreditCard, EyeOff,
  FlaskConical, Lock,
} from 'lucide-react';
import GrowHero from '@/components/grow/GrowHero';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { api } from '@/lib/api';
import { useEhAppIos, useEhAppNativo } from '@/lib/useOrigem';
import {
  widgetIosDisponivel, conectarNoIphone, linkConexaoAndroid, type EstadoWidgets, type AparelhoWidget,
} from '@/lib/widgets';

const BRAND = '#61D17B';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const cartao = 'rounded-2xl border border-border/40 backdrop-blur-xl p-5';
const fundo = { background: 'hsl(var(--bg-card) / 0.5)' };
const comBrilho = { ...fundo, backgroundImage: `radial-gradient(circle at top right, ${BRAND}24 0%, transparent 70%)` };

const WIDGETS = [
  { icone: Waves, nome: 'Livre pra gastar', texto: 'Quanto dá pra gastar por dia até o fim do mês, com a maré do que ainda sobra.' },
  { icone: CalendarClock, nome: 'Próximas contas', texto: 'O que vence nos próximos 7 dias, com as atrasadas primeiro.' },
  { icone: CreditCard, nome: 'Cartão', texto: 'A fatura atual, quando fecha e quando vence.' },
  { icone: Zap, nome: 'Lançar rápido', texto: 'Gasto, receita, áudio ou foto direto no WhatsApp da Sora.' },
];

function haQuanto(iso: string | null): string {
  if (!iso) return 'ainda não atualizou';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return 'atualizou há pouco';
  const h = Math.round(min / 60);
  if (h < 24) return `atualizou há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'atualizou ontem' : `atualizou há ${d} dias`;
}
const semAssinatura = () => () => {};
const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export default function WidgetsPage() {
  const { user } = useAuth();
  const ehIos = useEhAppIos();
  const ehAppAndroid = useEhAppNativo() && !ehIos;
  const chave = user?.id ? `d:widgets:${user.id}` : null;
  const { data, error, mutate } = useApi<EstadoWidgets>(chave, () => api.widget.estado());

  const [conectando, setConectando] = useState(false);
  const [resultado, setResultado] = useState<'ok' | 'android' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // O plugin só existe no navegador do app: no servidor é sempre false.
  const iosComPlugin = useSyncExternalStore(semAssinatura, widgetIosDisponivel, () => false);

  // Android: a conexão acontece numa tela nativa e volta pra cá — ao voltar,
  // relê os aparelhos (é assim que a tela fica sabendo que deu certo).
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === 'visible') mutate(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [mutate]);

  async function conectar() {
    setErro(null); setConectando(true);
    try {
      const { codigo } = await api.widget.codigo();
      if (ehIos) {
        await conectarNoIphone(codigo, API_BASE);
        setResultado('ok');
        await mutate();
      } else {
        setResultado('android');
        window.location.href = linkConexaoAndroid(codigo, API_BASE);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui conectar agora. Tente de novo.');
    } finally {
      setConectando(false);
    }
  }

  if (error && !data) {
    return (
      <div className="space-y-5">
        <Cabecalho />
        <div className={cartao} style={fundo}>
          <p className="inline-flex items-start gap-2 text-sm text-red-500" role="alert">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> Não consegui carregar seus widgets agora.
          </p>
          <button type="button" onClick={() => mutate()}
                  className="mt-3 h-11 px-4 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted/40">
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }
  if (!data) return <div className="space-y-5"><Cabecalho /></div>;

  const fora = !data.acesso.ok || data.liberando;

  return (
    <div className="space-y-5">
      <Cabecalho />

      {fora ? (
        <div className={cartao} style={fundo}>
          <p className="flex items-start gap-3 text-sm text-foreground leading-relaxed">
            {data.acesso.motivo === 'plano'
              ? <Lock size={18} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
              : <FlaskConical size={18} className="mt-0.5 flex-shrink-0" style={{ color: BRAND }} />}
            <span>
              {data.liberando ? 'Os widgets ainda estão sendo liberados. Tente de novo mais tarde.'
                : data.acesso.motivo === 'teste' ? 'Os widgets estão em teste com poucas contas e chegam para todos em breve.'
                : data.acesso.motivo === 'desligado' ? 'Os widgets estão pausados por enquanto.'
                : ehIos ? 'Os widgets não fazem parte do seu plano.'
                : 'Os widgets fazem parte das assinaturas mensais e anuais.'}
            </span>
          </p>
          {data.acesso.motivo === 'plano' && !ehIos && (
            <Link href="/planos" className="mt-3 inline-flex h-11 items-center px-4 rounded-xl text-sm font-semibold text-white"
                  style={{ background: BRAND }}>
              Ver planos
            </Link>
          )}
        </div>
      ) : (
        <section className={`${cartao} animate-[slide-up_500ms_ease-out_both]`} style={comBrilho} aria-labelledby="aparelho">
          <h2 id="aparelho" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Smartphone size={16} style={{ color: BRAND }} /> Neste aparelho
          </h2>

          {ehIos && !iosComPlugin && (
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Atualize o app ForSora na App Store para conectar os widgets.
            </p>
          )}

          {!ehIos && !ehAppAndroid && (
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Os widgets moram no app da Sora no celular. Abra esta mesma tela pelo app (Menu → Widgets) para conectar.
            </p>
          )}

          {((ehIos && iosComPlugin) || ehAppAndroid) && resultado !== 'ok' && (
            <>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Conecte uma vez e os widgets passam a mostrar os seus números. Eles se atualizam sozinhos.
              </p>
              <button type="button" onClick={conectar} disabled={conectando}
                      className="mt-4 w-full sm:w-auto h-12 px-5 rounded-xl text-sm font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      style={{ background: BRAND }}>
                {conectando && <Loader2 size={16} className="animate-spin" />}
                {ehIos ? 'Conectar os widgets deste iPhone' : 'Conectar os widgets deste celular'}
              </button>
              {resultado === 'android' && (
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                  Se apareceu “Widgets conectados”, está pronto. Se nada aconteceu, atualize o app da Sora na Play Store e tente de novo.
                </p>
              )}
            </>
          )}

          {resultado === 'ok' && (
            <p className="mt-3 flex items-start gap-2 text-sm text-foreground" role="status">
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" style={{ color: BRAND }} /> Conectado.
            </p>
          )}

          {erro && (
            <p className="mt-3 inline-flex items-start gap-2 text-sm text-red-500" role="alert">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> {erro}
            </p>
          )}

          {(ehIos || ehAppAndroid) && (
            <div className="mt-4 rounded-xl bg-muted/40 p-4">
              <p className="text-xs font-semibold text-foreground">Para adicionar na tela inicial</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {ehIos
                  ? 'Toque e segure num espaço vazio da tela inicial, toque em Editar → Adicionar widget e procure ForSora.'
                  : 'Toque e segure num espaço vazio da tela inicial, toque em Widgets e procure Sora.'}
              </p>
            </div>
          )}
        </section>
      )}

      {data.aparelhos.length > 0 && (
        <section className={cartao} style={fundo} aria-labelledby="conectados">
          <h2 id="conectados" className="text-sm font-semibold text-foreground">Aparelhos conectados</h2>
          <ul className="mt-3 divide-y divide-border/40">
            {data.aparelhos.map((a) => (
              <Aparelho key={a.id} a={a} aoDesconectar={async () => { await api.widget.desconectar(a.id); await mutate(); }} />
            ))}
          </ul>
        </section>
      )}

      <section className={cartao} style={fundo} aria-labelledby="quais">
        <h2 id="quais" className="text-sm font-semibold text-foreground">Os widgets</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {WIDGETS.map(({ icone: Icone, nome, texto }) => (
            <li key={nome} className="flex gap-3">
              <span className="w-9 h-9 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${BRAND}24` }}>
                <Icone size={18} style={{ color: '#1F7A45' }} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">{nome}</span>
                <span className="block text-xs text-muted-foreground leading-relaxed">{texto}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
          <EyeOff size={14} className="mt-0.5 flex-shrink-0" />
          Em cada widget dá pra esconder os valores: toque e segure nele e escolha editar.
        </p>
      </section>
    </div>
  );
}

function Aparelho({ a, aoDesconectar }: { a: AparelhoWidget; aoDesconectar: () => Promise<void> }) {
  const [confirmar, setConfirmar] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const nome = a.aparelho || (a.plataforma === 'ios' ? 'iPhone' : 'Android');
  return (
    <li className="flex items-center gap-3 py-3">
      <Smartphone size={18} className="text-muted-foreground flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-foreground truncate">{nome}</span>
        <span className="block text-xs text-muted-foreground">Conectado em {dataCurta(a.criado_em)} · {haQuanto(a.ultimo_uso_em)}</span>
      </span>
      {confirmar ? (
        <span className="flex gap-2">
          <button type="button" onClick={() => setConfirmar(false)}
                  className="h-11 px-3 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted/40">Cancelar</button>
          <button type="button" disabled={saindo}
                  onClick={async () => { setSaindo(true); try { await aoDesconectar(); } finally { setSaindo(false); setConfirmar(false); } }}
                  className="h-11 px-3 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 inline-flex items-center gap-1.5">
            {saindo && <Loader2 size={14} className="animate-spin" />} Desconectar
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirmar(true)}
                className="h-11 px-3 rounded-lg border border-border text-xs font-semibold text-foreground inline-flex items-center gap-1.5 hover:bg-muted/40"
                aria-label={`Desconectar ${nome}`}>
          <Unplug size={14} /> Desconectar
        </button>
      )}
    </li>
  );
}

function Cabecalho() {
  return (
    <GrowHero
      badge="Widgets"
      titulo="A Sora na tela inicial"
      subtitulo="Quanto dá pra gastar hoje, o que vence na semana e a fatura do cartão, sem abrir o app."
    />
  );
}

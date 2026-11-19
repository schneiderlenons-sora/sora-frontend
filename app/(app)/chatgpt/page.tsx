'use client';

// ─────────────────────────────────────────────────────────────────────────────
// A aba "ChatGPT": conectar o ChatGPT da pessoa à Sora (fase 1: só leitura).
//
// A conversa acontece NO ChatGPT, na conta e no plano da pessoa — a Sora não
// paga pela IA. Aqui ela (1) aprende a conectar, (2) vê o que está conectado e
// desconecta, e (3) vê o que o ChatGPT consultou. Transparência é o que faz
// alguém confiar o próprio dinheiro a outro app.
//
// Backend: sora-backend/src/routes/mcp.js (GET /api/ia-conectada/conexoes).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import {
  Copy, Check, Eye, ShieldCheck, X, Loader2, Unplug, CheckCircle2, AlertCircle,
  MessageSquareText, Clock, FlaskConical,
} from 'lucide-react';
import GrowHero from '@/components/grow/GrowHero';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { api } from '@/lib/api';
import { NOME_FERRAMENTA, type ConexaoChatgpt, type EstadoChatgpt } from '@/lib/ia-conectada';

const BRAND = '#61D17B';

const PERGUNTAS = [
  'Onde eu mais gastei este mês e como isso se compara com o mês passado?',
  'Quanto ainda falta pagar nas faturas dos meus cartões?',
  'Monta um plano para eu quitar minhas dívidas sem apertar o mercado.',
  'Quais assinaturas e contas fixas eu pago todo mês?',
  'Estou dentro dos meus limites de gastos?',
];

const VE = ['Transações e o resumo de cada mês', 'Saldos das contas, cartões e faturas',
  'Dívidas, metas e contas fixas', 'Investimentos e limites de gastos'];
const NAO_FAZ = ['Lançar, editar ou apagar qualquer coisa', 'Ver sua senha ou o acesso ao seu banco',
  'Mexer no seu plano ou pagamento'];

function haQuanto(iso: string | null): string {
  if (!iso) return 'ainda não usada';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 2) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

function useCopiar() {
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(texto);
      setTimeout(() => setCopiado(null), 1800);
    } catch { /* sem clipboard: o texto está na tela */ }
  };
  return { copiado, copiar };
}

const cartao = 'rounded-2xl border border-border/40 backdrop-blur-xl p-5';
const fundo = { background: 'hsl(var(--bg-card) / 0.5)' };

export default function ChatgptPage() {
  const { user } = useAuth();
  const chave = user?.id ? `d:ia-conectada:${user.id}` : null;
  const { data, error, mutate } = useApi<EstadoChatgpt>(chave, () => api.iaConectada.conexoes());
  const { copiado, copiar } = useCopiar();

  if (error && !data) {
    return (
      <div className="space-y-5">
        <Cabecalho />
        <div className={cartao} style={fundo}>
          <p className="inline-flex items-start gap-2 text-sm text-red-500" role="alert">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> Não consegui carregar suas conexões agora.
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

  // Chegou por link mas ainda não faz parte do teste: explica, sem botão morto.
  if (data.acesso.motivo === 'teste' || data.acesso.motivo === 'desligada' || !data.pronto) {
    return (
      <div className="space-y-5">
        <Cabecalho />
        <div className={cartao} style={fundo}>
          <p className="flex items-start gap-3 text-sm text-foreground leading-relaxed">
            <FlaskConical size={18} className="mt-0.5 flex-shrink-0" style={{ color: BRAND }} />
            {data.acesso.motivo === 'desligada'
              ? 'A conexão com o ChatGPT está pausada por enquanto.'
              : 'A Sora no ChatGPT está em teste com poucas contas. Ela chega para todos em breve, e esta aba vai mostrar como conectar.'}
          </p>
        </div>
      </div>
    );
  }

  const conectado = data.conexoes.length > 0;

  return (
    <div className="space-y-5">
      <Cabecalho />

      {/* ── Estado da conexão ─────────────────────────────────────────────── */}
      {conectado ? (
        <section className={`${cartao} animate-[slide-up_500ms_ease-out_both]`} aria-labelledby="conexoes"
                 style={{ ...fundo, backgroundImage: `radial-gradient(circle at top right, ${BRAND}24 0%, transparent 70%)` }}>
          <h2 id="conexoes" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 size={16} style={{ color: BRAND }} /> Conectado
          </h2>
          <ul className="mt-3 space-y-2">
            {data.conexoes.map((c) => <LinhaConexao key={c.id} c={c} aoDesconectar={() => mutate()} />)}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
            Numa conversa do ChatGPT, ative a Sora e pergunte. Ele só lê: nada é lançado nem apagado por lá.
          </p>
        </section>
      ) : (
        <section className={`${cartao} animate-[slide-up_500ms_ease-out_both]`} aria-labelledby="como"
                 style={{ ...fundo, backgroundImage: `radial-gradient(circle at top right, ${BRAND}24 0%, transparent 70%)` }}>
          <h2 id="como" className="text-base font-bold text-foreground">Como conectar</h2>
          <p className="mt-1 text-xs text-muted-foreground">Leva um minuto. Faça pelo computador, no chatgpt.com.</p>
          <ol className="mt-4 space-y-4">
            <Passo n={1}>
              No ChatGPT, abra <strong className="text-foreground">Plugins</strong> (ou Apps), toque em <strong className="text-foreground">+</strong> e
              escolha <strong className="text-foreground">Adicionar servidor MCP personalizado</strong>.
            </Passo>
            <Passo n={2}>
              Dê o nome <strong className="text-foreground">Sora</strong>, escolha <strong className="text-foreground">endereço público</strong> e cole este endereço:
              <span className="mt-2 flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate rounded-lg bg-muted/60 px-3 py-2 text-xs text-foreground" title={data.url_mcp}>
                  {data.url_mcp}
                </code>
                <button type="button" onClick={() => copiar(data.url_mcp)}
                        className="h-11 px-3 rounded-lg border border-border text-xs font-semibold text-foreground inline-flex items-center gap-1.5 hover:bg-muted/40 flex-shrink-0"
                        aria-label="Copiar o endereço da Sora">
                  {copiado === data.url_mcp ? <Check size={14} style={{ color: BRAND }} /> : <Copy size={14} />}
                  {copiado === data.url_mcp ? 'Copiado' : 'Copiar'}
                </button>
              </span>
            </Passo>
            <Passo n={3}>
              Em autenticação, escolha <strong className="text-foreground">OAuth</strong> e conclua. Vai abrir a tela da Sora: confira e
              toque em <strong className="text-foreground">Permitir acesso</strong>.
            </Passo>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">Quando terminar, a conexão aparece aqui.</p>
        </section>
      )}

      {/* ── O que perguntar ───────────────────────────────────────────────── */}
      <section className={cartao} style={fundo} aria-labelledby="perguntas">
        <h2 id="perguntas" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MessageSquareText size={16} style={{ color: BRAND }} /> Para perguntar no ChatGPT
        </h2>
        <ul className="mt-3 space-y-2">
          {PERGUNTAS.map((p) => (
            <li key={p}>
              <button type="button" onClick={() => copiar(p)}
                      className="w-full min-h-[44px] text-left rounded-xl border border-border/60 px-3 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors flex items-start gap-2">
                <span className="flex-1">{p}</span>
                <span className="flex-shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true">
                  {copiado === p ? <Check size={14} style={{ color: BRAND }} /> : <Copy size={14} />}
                </span>
                <span className="sr-only">{copiado === p ? 'Copiada' : 'Copiar pergunta'}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ── O que ele vê / não faz ────────────────────────────────────────── */}
      <section className={`${cartao} grid gap-5 sm:grid-cols-2`} style={fundo}>
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Eye size={16} style={{ color: BRAND }} /> O ChatGPT pode ver
          </h2>
          <ul className="mt-2 space-y-1.5">
            {VE.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-foreground">
                <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: BRAND }} aria-hidden="true" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck size={16} className="text-muted-foreground" /> O ChatGPT não pode
          </h2>
          <ul className="mt-2 space-y-1.5">
            {NAO_FAZ.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-muted-foreground">
                <X size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="sm:col-span-2 text-xs text-muted-foreground leading-relaxed">
          O que o ChatGPT ler fica na sua conta dele e segue as regras da OpenAI. Os dados são os do seu grupo ativo na
          Sora; em gestão compartilhada, entram os lançamentos das outras pessoas do grupo.
        </p>
      </section>

      {/* ── O que foi consultado ──────────────────────────────────────────── */}
      {conectado && (
        <section className={cartao} style={fundo} aria-labelledby="consultas">
          <h2 id="consultas" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock size={16} className="text-muted-foreground" /> O que o ChatGPT consultou
          </h2>
          {data.consultas.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nada ainda. Assim que você perguntar algo, aparece aqui.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border/50">
              {data.consultas.map((q, i) => (
                <li key={`${q.criado_em}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-foreground min-w-0">
                    {q.ok
                      ? <Check size={14} className="flex-shrink-0" style={{ color: BRAND }} aria-label="Respondida" />
                      : <AlertCircle size={14} className="flex-shrink-0 text-amber-500" aria-label="Não respondida" />}
                    <span className="truncate">{NOME_FERRAMENTA[q.ferramenta] || q.ferramenta}</span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">{haQuanto(q.criado_em)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Cabecalho() {
  return (
    <GrowHero
      badge="ChatGPT"
      titulo="A Sora no seu ChatGPT"
      subtitulo="Pergunte sobre o seu dinheiro no ChatGPT. Ele lê os seus números na Sora e responde."
    />
  );
}

function Passo({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="w-7 h-7 rounded-full grid place-items-center text-xs font-bold text-white flex-shrink-0 tabular-nums"
            style={{ background: BRAND }} aria-hidden="true">{n}</span>
      <span className="flex-1 min-w-0 text-sm text-muted-foreground leading-relaxed flex flex-col">{children}</span>
    </li>
  );
}

function LinhaConexao({ c, aoDesconectar }: { c: ConexaoChatgpt; aoDesconectar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState('');

  async function desconectar() {
    setSaindo(true); setErro('');
    try {
      await api.iaConectada.desconectar(c.id);
      aoDesconectar();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui desconectar agora. Tente de novo.');
      setSaindo(false);
    }
  }

  return (
    <li className="rounded-xl border border-border/60 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{c.cliente_nome}</p>
          <p className="text-xs text-muted-foreground">
            Conectado em {dataCurta(c.criada_em)} · {c.ultimo_uso_em ? `usado ${haQuanto(c.ultimo_uso_em)}` : 'ainda sem uso'}
          </p>
        </div>
        {!confirmando && (
          <button type="button" onClick={() => setConfirmando(true)}
                  className="h-11 px-3 rounded-lg border border-border text-xs font-semibold text-foreground inline-flex items-center gap-1.5 hover:bg-muted/40 flex-shrink-0">
            <Unplug size={14} /> Desconectar
          </button>
        )}
      </div>
      {/* Confirmação na própria linha: o `confirm()` do navegador some no app do WhatsApp. */}
      {confirmando && (
        <div className="mt-3 rounded-lg bg-red-500/5 border border-red-500/20 p-3">
          <p className="text-xs text-foreground">O {c.cliente_nome} para de ler sua Sora na hora. Para voltar, é preciso conectar de novo.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={desconectar} disabled={saindo}
                    className="h-11 px-3 rounded-lg bg-red-600 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60">
              {saindo ? <Loader2 size={14} className="animate-spin" /> : <Unplug size={14} />} Desconectar
            </button>
            <button type="button" onClick={() => setConfirmando(false)} disabled={saindo}
                    className="h-11 px-3 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted/40">
              Cancelar
            </button>
          </div>
          {erro && <p className="mt-2 text-xs text-red-500" role="alert">{erro}</p>}
        </div>
      )}
    </li>
  );
}

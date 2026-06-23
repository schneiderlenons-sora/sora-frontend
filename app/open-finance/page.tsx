'use client';

import { useCallback, useEffect, useState } from 'react';
import Script from 'next/script';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  Landmark, Plus, Loader2, RefreshCw, Trash2, CheckCircle2, AlertCircle,
  Clock, ShieldCheck, Lock,
} from 'lucide-react';

declare global {
  interface Window { PluggyConnect?: any }
}

const BRAND = '#61D17B';
// CDN oficial do widget Pluggy Connect (SDK vanilla — sem dependência de npm).
const PLUGGY_SDK = 'https://cdn.pluggy.ai/pluggy-connect/v2.8.2/pluggy-connect.js';

type Conexao = {
  item_id: string;
  connector_nome: string | null;
  status: 'updating' | 'updated' | 'error';
  ultimo_erro: string | null;
  ultima_sync: string | null;
  created_at: string;
};

export default function OpenFinancePage() {
  const { plano } = useAuth();
  const liberado = plano === 'premium' || plano === 'black';

  const [sdkPronto, setSdkPronto] = useState(false);
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [conectando, setConectando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      const d = await api.pluggy.conexoes();
      setConexoes(d.conexoes || []);
    } catch (e: any) { setErro(e.message || 'Não consegui carregar as conexões.'); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { if (liberado) carregar(); else setCarregando(false); }, [liberado, carregar]);

  async function conectarBanco() {
    setErro('');
    if (!window.PluggyConnect) { setErro('O componente de conexão ainda está carregando. Tente de novo em instantes.'); return; }
    setConectando(true);
    try {
      const { connectToken } = await api.pluggy.connectToken();
      const widget = new window.PluggyConnect({
        connectToken,
        includeSandbox: false, // produção: só bancos reais (sem o conector de testes)
        onSuccess: async (itemData: any) => {
          const item = itemData?.item;
          if (item?.id) {
            try {
              await api.pluggy.registrarItem(item.id, item?.connector?.name);
              await carregar();
            } catch (e: any) { setErro(e.message || 'Conectou, mas falhei ao registrar. Tente sincronizar.'); }
          }
          setConectando(false);
        },
        onError: (err: any) => {
          console.error('[pluggy] erro no widget', err);
          setConectando(false);
        },
        onClose: () => setConectando(false),
      });
      widget.init();
    } catch (e: any) {
      setErro(e.message || 'Não consegui iniciar a conexão.');
      setConectando(false);
    }
  }

  async function desconectar(itemId: string, nome: string | null) {
    if (!confirm(`Desconectar ${nome || 'este banco'}? O histórico já importado continua na Sora.`)) return;
    setConexoes(prev => prev.filter(c => c.item_id !== itemId));
    try { await api.pluggy.desconectar(itemId); } catch (e: any) { setErro(e.message); carregar(); }
  }

  const [sincronizando, setSincronizando] = useState('');
  async function sincronizar(itemId: string) {
    setSincronizando(itemId); setErro('');
    try {
      const r = await api.pluggy.sincronizar(itemId);
      await carregar();
      // Diagnóstico detalhado (estamos em rollout/admin) — ajuda a ver o que veio.
      const linhas = (r.contas || []).map(c =>
        c.erro ? `• ${c.tipo}: erro — ${c.erro}` : `• ${c.tipo} "${c.nome}": ${c.txs ?? 0} txs (${c.novas ?? 0} novas)`);
      const resumo = [
        `Status no Pluggy: ${r.statusPluggy || '—'}`,
        `Total de novas transações: ${r.novas ?? 0}`,
        r.erro ? `Erro: ${r.erro}` : '',
        linhas.length ? '\nContas:\n' + linhas.join('\n') : '\nNenhuma conta retornada pelo Pluggy.',
      ].filter(Boolean).join('\n');
      alert(resumo);
    } catch (e: any) { setErro(e.message || 'Não consegui sincronizar.'); }
    finally { setSincronizando(''); }
  }

  return (
    <DashboardLayout>
      <Script src={PLUGGY_SDK} strategy="afterInteractive" onLoad={() => setSdkPronto(true)} />

      <div className="max-w-3xl mx-auto px-4 pb-24 space-y-6">
        {/* Hero */}
        <div className="space-y-3 pt-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl"
               style={{ background: `color-mix(in srgb, ${BRAND} 14%, transparent)` }}>
            <Landmark size={22} style={{ color: BRAND }} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Open Finance</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Conecte suas contas bancárias com segurança via Open Finance e deixe a Sora
            importar e atualizar seus saldos e transações automaticamente.
          </p>
        </div>

        {!liberado ? (
          /* Gate de plano — Open Finance é Premium+ */
          <div className="rounded-3xl border border-border bg-card p-8 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted">
              <Lock size={24} className="text-muted-foreground" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Disponível no Premium e Black</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              A conexão automática com bancos via Open Finance faz parte dos planos pagos superiores.
            </p>
            <a href="/planos" className="inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-bold text-white"
               style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 44 }}>
              Ver planos
            </a>
          </div>
        ) : (
          <>
            {/* Como funciona (Meu Pluggy) */}
            <div className="rounded-2xl border border-border bg-card/60 p-4 flex items-start gap-3">
              <ShieldCheck size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
                <p className="font-semibold text-foreground">Como conectar pelo Meu Pluggy</p>
                <p>
                  Ao clicar em <b>Conectar banco</b>, escolha <b>“Meu Pluggy”</b> na lista. Você autoriza
                  o acesso com a sua conta do Meu Pluggy (onde seus bancos já estão conectados) e pronto —
                  a Sora passa a ler os dados. Nada de senha do banco aqui dentro.
                </p>
              </div>
            </div>

            {/* Ação principal */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={conectarBanco} disabled={conectando || !sdkPronto}
                className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-2xl text-white text-sm font-bold shadow-lg transition-all disabled:opacity-50 active:scale-[0.99]"
                style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 44 }}>
                {conectando ? <Loader2 size={17} className="animate-spin" />
                  : !sdkPronto ? <Loader2 size={17} className="animate-spin" />
                  : <Plus size={17} />}
                {conectando ? 'Conectando…' : !sdkPronto ? 'Carregando…' : 'Conectar banco'}
              </button>
              <button onClick={carregar} title="Atualizar lista"
                className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-2xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw size={15} /> Atualizar
              </button>
            </div>

            {erro && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60" role="alert">
                <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">{erro}</p>
              </div>
            )}

            {/* Conexões */}
            <div className="space-y-2.5">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Bancos conectados</h2>
              {carregando ? (
                <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
              ) : conexoes.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground rounded-2xl border border-dashed border-border">
                  Nenhum banco conectado ainda. Clique em <b>Conectar banco</b> pra começar.
                </div>
              ) : conexoes.map(c => (
                <ConexaoCard key={c.item_id} c={c} onDesconectar={desconectar}
                  onSincronizar={sincronizar} sincronizando={sincronizando === c.item_id} />
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function ConexaoCard({ c, onDesconectar, onSincronizar, sincronizando }: {
  c: Conexao;
  onDesconectar: (id: string, nome: string | null) => void;
  onSincronizar: (id: string) => void;
  sincronizando: boolean;
}) {
  const meta = {
    updated:  { Icon: CheckCircle2, cor: 'text-emerald-500', label: 'Sincronizado' },
    updating: { Icon: Clock,        cor: 'text-amber-500',   label: 'Sincronizando…' },
    error:    { Icon: AlertCircle,  cor: 'text-red-500',     label: 'Erro na conexão' },
  }[c.status] || { Icon: Clock, cor: 'text-muted-foreground', label: c.status };
  const Icon = meta.Icon;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <Landmark size={18} className="text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{c.connector_nome || 'Banco conectado'}</p>
          <p className={`text-[11px] flex items-center gap-1 ${meta.cor}`}>
            <Icon size={12} /> {meta.label}
            {c.ultima_sync && c.status === 'updated' && (
              <span className="text-muted-foreground"> · {new Date(c.ultima_sync).toLocaleString('pt-BR')}</span>
            )}
          </p>
          {c.status === 'error' && c.ultimo_erro && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.ultimo_erro}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => onSincronizar(c.item_id)} disabled={sincronizando}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          aria-label="Sincronizar agora" title="Sincronizar agora">
          {sincronizando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        </button>
        <button onClick={() => onDesconectar(c.item_id, c.connector_nome)}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
          aria-label="Desconectar" title="Desconectar">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

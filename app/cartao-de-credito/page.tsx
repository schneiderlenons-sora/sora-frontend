'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AdicionarCartaoModal, { bancoLogo, loadCartaoMeta, CartaoMeta } from '@/components/cartoes/AdicionarCartaoModal';
import DetalhesCartaoModal from '@/components/cartoes/DetalhesCartaoModal';
import IconeMarca, { slugDaMarca, marcaDe } from '@/components/ui/IconeMarca';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  Plus, Sparkles, CreditCard, DollarSign, Eye, EyeOff, Pencil, Trash2,
  ChevronRight, ChevronLeft, AlertCircle, BarChart3, Calendar, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, CartesianGrid,
} from 'recharts';

const BRAND = '#61D17B';
const MES_ABREV  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MES_NOMES  = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtShort = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `${v}`;
};

interface Wallet {
  id:     string;
  nome:   string;
  tipo:   string;
  saldo?: number;
  limite?: number;
}

export default function CartaoDeCreditoPage() {
  const { phone, limiteDe } = useAuth();
  const limiteCartoes = limiteDe('cartoes');

  const [wallets,        setWallets]        = useState<Wallet[]>([]);
  const [txsMes,         setTxsMes]         = useState<any[]>([]);
  const [txsHistorico,   setTxsHistorico]   = useState<Record<string, any[]>>({});
  const [loading,        setLoading]        = useState(false);
  const [ocultar,        setOcultar]        = useState(false);
  const [addOpen,        setAddOpen]        = useState(false);
  const [edicao,         setEdicao]         = useState<Wallet | null>(null);
  const [detalhes,       setDetalhes]       = useState<Wallet | null>(null);
  const [mesIndex,       setMesIndex]       = useState(0); // 0 = mês atual, -1 = mês passado, etc.
  const [confirmDel,     setConfirmDel]     = useState<Wallet | null>(null);
  // Só monta o gráfico Recharts após o 1º paint do cliente — evita que o
  // ResponsiveContainer meça o container como -1 no mount tardio (React #284).
  const [graficoPronto, setGraficoPronto] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGraficoPronto(true), 0);
    return () => clearTimeout(t);
  }, []);

  const hoje = new Date();
  const mesAtualRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  // Mês selecionado para "Faturas anteriores"
  const refDate = useMemo(() => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + mesIndex, 1);
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesIndex]);

  const refMesLabel = `${MES_NOMES[refDate.getMonth()].charAt(0).toUpperCase() + MES_NOMES[refDate.getMonth()].slice(1)} de ${refDate.getFullYear()}`;

  const carregar = useCallback(async () => {
    if (!phone) return;
    setLoading(true);
    try {
      const ws = await api.wallets.listar(phone);
      setWallets((ws || []).filter((w: any) => w.tipo === 'Crédito'));
    } catch (e) {
      console.warn('[cartoes] wallets erro:', e);
    }

    try {
      const t = await api.transacoes.listar(phone, { mes: mesAtualRef, limit: 500 });
      setTxsMes(t.transacoes || []);
    } catch (e) {
      console.warn('[cartoes] txs mes erro:', e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  // Carrega 6 últimos meses para o gráfico de histórico
  useEffect(() => {
    if (!phone) return;
    (async () => {
      const novosHistoricos: Record<string, any[]> = {};
      for (let i = 0; i < 6; i++) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() + mesIndex - i, 1);
        const ref = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (txsHistorico[ref]) {
          novosHistoricos[ref] = txsHistorico[ref];
          continue;
        }
        try {
          const r = await api.transacoes.listar(phone, { mes: ref, limit: 500 });
          novosHistoricos[ref] = r.transacoes || [];
        } catch {
          novosHistoricos[ref] = [];
        }
      }
      setTxsHistorico(novosHistoricos);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, mesIndex]);

  // As transações guardam `carteira_nome` (string), não wallet_id — o
  // backend nem persiste wallet_id. Match precisa ser por nome.
  const mesmaCarteira = (t: any, w: any) =>
    t.wallet_id === w.id ||
    (t.carteira_nome || '').trim().toLowerCase() === (w.nome || '').trim().toLowerCase();

  // Fatura por cartão (mês atual ou mesIndex == 0)
  const faturaPorCartao = useMemo(() => {
    const acc: Record<string, number> = {};
    wallets.forEach(w => {
      acc[w.id] = txsMes
        .filter(t => mesmaCarteira(t, w) && t.tipo === 'Gasto')
        .reduce((s, t) => s + (t.valor || 0), 0);
    });
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets, txsMes]);

  const faturaTotal = useMemo(
    () => Object.values(faturaPorCartao).reduce((s, v) => s + v, 0),
    [faturaPorCartao]
  );

  // Dados do gráfico (6 meses, mais recente à direita)
  const dadosHistorico = useMemo(() => {
    return Array.from({ length: 6 }, (_, idx) => {
      const i = 5 - idx;
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + mesIndex - i, 1);
      const ref = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const txs = txsHistorico[ref] || [];
      const total = txs
        .filter((t: any) => wallets.some(w => mesmaCarteira(t, w)) && t.tipo === 'Gasto')
        .reduce((s: number, t: any) => s + (t.valor || 0), 0);
      return {
        mes: MES_ABREV[d.getMonth()],
        ref,
        total,
        atual: i === 0,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txsHistorico, wallets, mesIndex]);

  async function handleDeletar(w: Wallet) {
    try {
      await api.wallets.deletar(w.id);
      setConfirmDel(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`sora-cartao-${w.id}`);
      }
      carregar();
    } catch (e: any) {
      alert(e.message || 'Erro ao excluir cartão.');
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">

        {/* ═══════════════════════════════════════════════════════
            HERO HEADER
        ═══════════════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in border border-border/60"
             style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>

          <div className="absolute inset-0 pointer-events-none opacity-50"
               style={{ background: 'radial-gradient(ellipse at top right, hsl(134 55% 60% / .12) 0%, transparent 60%)' }} />

          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
                <Sparkles size={12} style={{ color: BRAND }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND }}>
                  {wallets.length} {wallets.length === 1 ? 'cartão' : 'cartões'}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
                Cartões de crédito
              </h1>
              <p className="text-muted-foreground text-sm mt-2 max-w-md">
                Gerencie seus cartões e acompanhe as faturas mensais.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setOcultar(v => !v)}
                className="btn-ghost px-3 py-2 text-sm gap-2"
                title={ocultar ? 'Mostrar valores' : 'Ocultar valores'}
              >
                {ocultar ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>

              <button
                onClick={() => {
                  if (wallets.length >= limiteCartoes) {
                    alert(`Plano atual permite ${limiteCartoes} cartões. Faça upgrade para Premium ou Black para ter cartões ilimitados.`);
                    return;
                  }
                  setEdicao(null); setAddOpen(true);
                }}
                className="btn btn-primary px-4 py-2.5 text-sm gap-2 shadow-glow-sm"
              >
                <Plus size={16} /> Adicionar cartão
              </button>
            </div>
          </div>
          {wallets.length >= limiteCartoes && Number.isFinite(limiteCartoes) && (
            <p className="relative mt-3 text-xs text-amber-600 dark:text-amber-400">
              Você atingiu o limite de {limiteCartoes} cartões do plano atual. <a href="/configuracoes#plano" className="underline font-semibold">Upgrade para Premium</a> para cartões ilimitados.
            </p>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            FATURA ATUAL TOTAL — branco no light, preto no dark
        ═══════════════════════════════════════════════════════ */}
        <div
          className="fatura-hero relative overflow-hidden rounded-3xl p-8 sm:p-10 animate-fade-in"
          style={{ animationDelay: '60ms' }}
        >
          {/* Halo verde único, contido no canto superior-esquerdo */}
          <div
            className="absolute -top-24 -left-24 w-72 h-72 rounded-full pointer-events-none opacity-25 dark:opacity-20"
            style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 60%)` }}
          />

          <div className="relative text-center space-y-2">
            <div className="inline-flex items-center justify-center gap-1.5 text-muted-foreground text-[11px] uppercase tracking-widest font-semibold">
              <DollarSign size={12} />
              Fatura atual
            </div>
            <p className="text-4xl sm:text-6xl font-bold text-foreground tabular tracking-tight leading-none">
              {ocultar ? '••••••••' : fmt(faturaTotal)}
            </p>
            {wallets.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Soma de {wallets.length} {wallets.length === 1 ? 'cartão' : 'cartões'}
              </p>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            SEUS CARTÕES
        ═══════════════════════════════════════════════════════ */}
        <div className="space-y-3 animate-fade-in" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <CreditCard size={16} className="text-foreground" />
            </div>
            <h2 className="text-base font-bold text-foreground">
              Seus cartões{' '}
              <span className="text-muted-foreground font-normal">({wallets.length})</span>
            </h2>
          </div>

          {loading && wallets.length === 0 ? (
            <div className="card rounded-3xl p-10 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : wallets.length === 0 ? (
            <div className="card rounded-3xl p-10 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <CreditCard size={22} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">Nenhum cartão cadastrado</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Adicione seu primeiro cartão para acompanhar a fatura mensal e os gastos por categoria.
              </p>
              <button
                onClick={() => { setEdicao(null); setAddOpen(true); }}
                className="btn btn-primary px-4 py-2 text-sm gap-2 mt-5"
              >
                <Plus size={14} /> Adicionar cartão
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {wallets.map((w, i) => (
                <CardCartao
                  key={w.id}
                  cartao={w}
                  fatura={faturaPorCartao[w.id] || 0}
                  ocultar={ocultar}
                  delay={i * 50}
                  onEditar={() => { setEdicao(w); setAddOpen(true); }}
                  onExcluir={() => setConfirmDel(w)}
                  onAbrir={() => setDetalhes(w)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            FATURAS ANTERIORES — gráfico de barras
        ═══════════════════════════════════════════════════════ */}
        {wallets.length > 0 && (
          <div className="card rounded-3xl p-5 sm:p-6 animate-fade-in" style={{ animationDelay: '180ms' }}>
            <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                  <BarChart3 size={16} className="text-foreground" />
                </div>
                <h2 className="text-base font-bold text-foreground">Faturas anteriores</h2>
              </div>

              {/* Navegação de mês */}
              <div className="flex items-center bg-muted/40 rounded-xl p-1">
                <button
                  onClick={() => setMesIndex(i => i - 1)}
                  className="p-1.5 rounded-lg hover:bg-card transition-colors"
                  title="Mês anterior"
                >
                  <ChevronLeft size={14} className="text-muted-foreground" />
                </button>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-semibold text-foreground min-w-[140px] justify-center">
                  <Calendar size={12} className="text-muted-foreground" />
                  {refMesLabel}
                </div>
                <button
                  onClick={() => setMesIndex(i => Math.min(0, i + 1))}
                  disabled={mesIndex >= 0}
                  className="p-1.5 rounded-lg hover:bg-card transition-colors disabled:opacity-40"
                  title="Próximo mês"
                >
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Wrapper com dimensão fixa — o ResponsiveContainer mede ESTE div
                (que já tem layout), evitando medir -1 no mount tardio (após o
                fetch de wallets) que disparava React #284 no Recharts 3 + React 19. */}
            <ErrorBoundary fallback={
              <div style={{ height: 240 }} className="flex flex-col items-center justify-center text-center gap-1">
                <BarChart3 size={22} className="text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Gráfico de faturas indisponível no momento.</p>
              </div>
            }>
            <div style={{ width: '100%', height: 240 }}>
            {graficoPronto && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosHistorico} margin={{ top: 12, right: 8, left: -10, bottom: 4 }} barSize={48}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 12, fill: 'hsl(var(--fg-muted))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--fg-muted))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtShort}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--bg-muted) / .4)' }}
                  contentStyle={{
                    background: 'hsl(var(--bg-card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [fmt(Number(v)), 'Fatura']}
                  labelFormatter={(l: string) => l}
                />
                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                  {dadosHistorico.map((d, i) => (
                    <Cell key={i} fill={d.atual ? BRAND : 'hsl(var(--bg-muted))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            )}
            </div>
            </ErrorBoundary>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODAIS
      ═══════════════════════════════════════════════════════ */}
      {addOpen && phone && (
        <AdicionarCartaoModal
          phone={phone}
          cartaoExistente={edicao}
          onClose={() => { setAddOpen(false); setEdicao(null); }}
          onSuccess={carregar}
        />
      )}

      {detalhes && phone && (
        <DetalhesCartaoModal
          phone={phone}
          cartao={detalhes}
          onClose={() => setDetalhes(null)}
          onRefresh={carregar}
        />
      )}

      {confirmDel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmDel(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center mb-4">
                <AlertCircle size={22} className="text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-base font-bold text-foreground">Excluir cartão?</h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Esta ação é permanente. As transações vinculadas a <strong className="text-foreground">{confirmDel.nome}</strong> não serão excluídas, mas perderão a referência ao cartão.
              </p>
              <div className="flex items-center justify-end gap-2 mt-5">
                <button onClick={() => setConfirmDel(null)} className="btn-ghost px-4 py-2 text-sm">
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeletar(confirmDel)}
                  className="btn-danger px-4 py-2 text-sm gap-2 inline-flex items-center"
                >
                  <Trash2 size={14} /> Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE DO CARTÃO INDIVIDUAL
// ─────────────────────────────────────────────────────────────
interface CardCartaoProps {
  cartao:    Wallet;
  fatura:    number;
  ocultar:   boolean;
  delay:     number;
  onEditar:  () => void;
  onExcluir: () => void;
  onAbrir:   () => void;
}

function CardCartao({ cartao, fatura, ocultar, delay, onEditar, onExcluir, onAbrir }: CardCartaoProps) {
  const [meta, setMeta] = useState<CartaoMeta>({});

  useEffect(() => {
    setMeta(loadCartaoMeta(cartao.id));
  }, [cartao.id]);

  const logo = bancoLogo(cartao.nome);
  const limite = cartao.limite || 0;
  const usado = fatura;
  const disponivel = Math.max(limite - usado, 0);
  const pctUsado = limite > 0 ? Math.min((usado / limite) * 100, 100) : 0;

  const hoje = new Date();
  const mesRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  // Flag de pagamento
  const [paga, setPaga] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPaga(localStorage.getItem(`sora-fatura-${cartao.id}-${mesRef}`) === 'paga');
  }, [cartao.id, mesRef]);

  const vencimentoLabel = (() => {
    if (!meta.diaVencimento) return null;
    const m = hoje.getMonth();
    const ano = hoje.getFullYear();
    return `${meta.diaVencimento} de ${MES_ABREV[m].toLowerCase()}.`;
  })();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } }}
      className="card-hover rounded-2xl p-5 animate-fade-in group relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Halo decorativo (canto direito) */}
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-15 pointer-events-none transition-opacity group-hover:opacity-25"
        style={{ background: `radial-gradient(circle, ${logo.bg} 0%, transparent 70%)` }}
      />

      {/* Header: logo + nome + badge */}
      <div className="flex items-start justify-between gap-3 mb-3 relative">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mesmo ícone das contas bancárias — marca conhecida usa CategoriaIcon
              (PNG circular full-bleed). Sem marca → fallback com cor + inicial. */}
          {marcaDe(cartao.nome) ? (
            <CategoriaIcon nome={cartao.nome} size={48} rounded="rounded-xl" />
          ) : (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0"
              style={{ background: logo.bg }}
            >
              {logo.text}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{cartao.nome}</p>
            <p className="text-[11px] text-muted-foreground tabular tracking-widest">
              •••• {meta.ultimos4 || '••••'}
            </p>
          </div>
        </div>

        <span
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 flex-shrink-0 ${
            paga
              ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: paga ? '#16a34a' : '#d97706' }} />
          {paga ? 'Paga' : 'Em aberto'}
        </span>
      </div>

      {/* Fatura atual */}
      <div className="relative">
        <p className="text-xs text-muted-foreground">Fatura atual</p>
        <p className="text-2xl font-bold text-foreground tabular tracking-tight mt-0.5">
          {ocultar ? '••••••' : fmt(fatura)}
        </p>

        {/* Alerta de fechamento não configurado */}
        {!meta.diaFechamento ? (
          <>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 leading-snug">
              Configure a data de fechamento do cartão para poder ver faturas mais recentes
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); onEditar(); }}
              className="relative z-10 mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:underline"
            >
              <Calendar size={11} /> Definir fechamento
            </button>
          </>
        ) : (
          vencimentoLabel && (
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Vence <span className="font-semibold text-foreground">{vencimentoLabel}</span>
            </p>
          )
        )}
      </div>

      {/* Barra de limite */}
      {limite > 0 && (
        <div className="mt-4 pt-4 border-t border-border/60 relative">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <CreditCard size={11} />
              Limite total
            </span>
            <span className="text-[11px] font-semibold text-foreground tabular">
              {ocultar ? '•••' : `R$ ${(limite / 1000).toFixed(1)}k`}
            </span>
          </div>

          <div className="h-2 rounded-full bg-muted overflow-hidden flex">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${pctUsado}%`,
                background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 100%)',
              }}
            />
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${100 - pctUsado}%`,
                background: BRAND,
              }}
            />
          </div>

          <div className="flex items-center justify-between mt-1.5 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Usado</span>
              <span className="font-semibold text-foreground tabular ml-0.5">
                {ocultar ? '•••' : `R$ ${(usado / 1000).toFixed(usado >= 1000 ? 1 : 0)}${usado >= 1000 ? 'k' : ''}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: BRAND }} />
              <span className="text-muted-foreground">Disponível</span>
              <span className="font-semibold text-foreground tabular ml-0.5">
                {ocultar ? '•••' : `R$ ${(disponivel / 1000).toFixed(disponivel >= 1000 ? 1 : 0)}${disponivel >= 1000 ? 'k' : ''}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Ações (aparecem no hover) — z-10 para ficar acima do click do card */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onEditar(); }}
          className="p-1.5 rounded-lg bg-card/80 backdrop-blur-sm border border-border hover:bg-muted transition-colors shadow-sm"
          title="Editar"
        >
          <Pencil size={13} className="text-muted-foreground" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onExcluir(); }}
          className="p-1.5 rounded-lg bg-card/80 backdrop-blur-sm border border-border hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shadow-sm"
          title="Excluir"
        >
          <Trash2 size={13} className="text-muted-foreground hover:text-red-500" />
        </button>
      </div>
    </div>
  );
}

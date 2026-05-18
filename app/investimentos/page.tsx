'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import NovoInvestimentoModal from '@/components/investimentos/NovoInvestimentoModal';
import {
  Plus, RefreshCw, BarChart3, Briefcase, Shield, Calculator, Coins,
  Trash2, ArrowUpRight, ArrowDownRight, Search, Loader2, Crown,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, LineChart, Line,
} from 'recharts';

const BRAND = '#61D17B';

const CORES_TIPO: Record<string, string> = {
  'Ações':           '#3b82f6',
  'FIIs':            '#8b5cf6',
  'ETFs':            '#06b6d4',
  'Cripto':          '#f59e0b',
  'Tesouro Direto':  '#22c55e',
  'CDB':             '#ec4899',
  'Previdência':     '#14b8a6',
  'Reserva':         '#10b981',
  'Imóveis':         '#f97316',
  'Negócio':         '#a855f7',
  'Caixa':           '#64748b',
};
function corTipo(t: string): string { return CORES_TIPO[t] || '#64748b'; }

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${(v || 0).toFixed(2)}%`;

type Tab = 'resumo' | 'carteira' | 'reserva' | 'simulador' | 'aportes';

export default function InvestimentosPage() {
  const { phone, isBlack } = useAuth();

  const [tab, setTab] = useState<Tab>('resumo');
  const [invs,         setInvs]         = useState<any[]>([]);
  const [aportes,      setAportes]      = useState<any[]>([]);
  const [patrimonio,   setPatrimonio]   = useState<any[]>([]);
  const [reserva,      setReserva]      = useState<any>({ valorAtual: 0, gastoMedioMensal: 0, mesesObjetivo: 6, valorObjetivo: 0, percentual: 0, mesesCobertos: 0 });
  const [atualizando,  setAtualizando]  = useState(false);
  const [novoOpen,     setNovoOpen]     = useState(false);
  const [feedback,     setFeedback]     = useState('');

  const carregar = useCallback(async () => {
    if (!phone || !isBlack) return;
    try { setInvs(await api.investimentos.listar(phone) || []); } catch {}
    try { setAportes(await api.investimentos.aportes.listar(phone) || []); } catch {}
    try { setPatrimonio(await api.investimentos.patrimonio(phone) || []); } catch {}
    try { setReserva(await api.investimentos.reserva(phone)); } catch {}
  }, [phone, isBlack]);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleAtualizar() {
    if (!phone || atualizando) return;
    setAtualizando(true);
    setFeedback('');
    try {
      const r = await api.investimentos.atualizarPrecos(phone);
      setFeedback(`✓ ${r.atualizados} de ${r.total} ativos atualizados.`);
      setTimeout(() => setFeedback(''), 4000);
      carregar();
    } catch (e: any) {
      setFeedback(`Erro: ${e.message}`);
    } finally {
      setAtualizando(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este investimento?')) return;
    try { await api.investimentos.deletar(id); carregar(); } catch (e: any) { alert(e.message); }
  }

  // ─── Métricas agregadas ───────────────────────────────────────
  const totais = useMemo(() => {
    const aportado    = invs.reduce((s, i) => s + (i.valor_aportado || 0), 0);
    const atual       = invs.reduce((s, i) => s + (i.valor_atual || 0), 0);
    const dividendos  = invs.reduce((s, i) => s + (i.dividendos_acumulados || 0), 0);
    const lucro       = atual - aportado;
    const rent        = aportado > 0 ? (lucro / aportado) * 100 : 0;

    // Maior ganho/perda
    let maiorG: any = null, maiorP: any = null;
    invs.forEach(i => {
      const r = (i.rentabilidade || 0) * 100;
      if (!maiorG || r > (maiorG.rentabilidade || 0) * 100) maiorG = i;
      if (!maiorP || r < (maiorP.rentabilidade || 0) * 100) maiorP = i;
    });

    // Variação ponderada do dia (peso pelo valor_atual)
    const varDia = atual > 0
      ? invs.reduce((s, i) => s + ((i.variacao_dia || 0) * (i.valor_atual || 0)), 0) / atual
      : 0;

    return { aportado, atual, dividendos, lucro, rent, maiorG, maiorP, varDia };
  }, [invs]);

  const distribuicao = useMemo(() => {
    const map: Record<string, number> = {};
    invs.forEach(i => { map[i.tipo] = (map[i.tipo] || 0) + (i.valor_atual || 0); });
    return Object.entries(map)
      .map(([tipo, valor]) => ({ tipo, valor, color: corTipo(tipo) }))
      .sort((a, b) => b.valor - a.valor);
  }, [invs]);

  // ─── PAYWALL ─────────────────────────────────────────────────
  if (!isBlack) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto pb-20 space-y-6">
          <Header />
          <PaywallBlack />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">

        <Header
          actions={
            <>
              <button
                onClick={handleAtualizar}
                disabled={atualizando}
                className="btn-outline px-3 py-2 text-sm gap-2"
              >
                {atualizando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Atualizar cotações
              </button>
              <button onClick={() => setNovoOpen(true)} className="btn btn-primary px-4 py-2.5 text-sm gap-2 shadow-glow-sm">
                <Plus size={16} /> Novo investimento
              </button>
            </>
          }
        />

        {feedback && (
          <div className="rounded-xl p-3 bg-primary/10 border border-primary/20 text-sm text-foreground animate-fade-in">
            {feedback}
          </div>
        )}

        {/* Tabs */}
        <div className="inline-flex items-center gap-1 bg-muted/40 rounded-2xl p-1.5 animate-fade-in" style={{ animationDelay: '60ms' }}>
          {([
            { v: 'resumo',    l: 'Resumo',     icon: BarChart3 },
            { v: 'carteira',  l: 'Carteira',   icon: Briefcase },
            { v: 'reserva',   l: 'Reserva',    icon: Shield },
            { v: 'simulador', l: 'Simulador',  icon: Calculator },
            { v: 'aportes',   l: 'Aportes',    icon: Coins },
          ] as { v: Tab; l: string; icon: any }[]).map(({ v, l, icon: Icon }) => {
            const ativo = tab === v;
            return (
              <button
                key={v}
                onClick={() => setTab(v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  ativo ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{l}</span>
              </button>
            );
          })}
        </div>

        {/* TAB: RESUMO */}
        {tab === 'resumo' && (
          <TabResumo totais={totais} distribuicao={distribuicao} patrimonio={patrimonio} />
        )}

        {/* TAB: CARTEIRA */}
        {tab === 'carteira' && (
          <TabCarteira invs={invs} onDelete={handleDelete} onAdd={() => setNovoOpen(true)} />
        )}

        {/* TAB: RESERVA */}
        {tab === 'reserva' && (
          <TabReserva
            reserva={reserva}
            invs={invs}
            onChangeMeses={async (n: number) => {
              if (!phone) return;
              try { await api.investimentos.atualizarReserva(phone, { meses_objetivo: n }); carregar(); } catch {}
            }}
          />
        )}

        {/* TAB: SIMULADOR */}
        {tab === 'simulador' && <TabSimulador />}

        {/* TAB: APORTES */}
        {tab === 'aportes' && <TabAportes aportes={aportes} invs={invs} />}
      </div>

      {novoOpen && phone && (
        <NovoInvestimentoModal phone={phone} onClose={() => setNovoOpen(false)} onSuccess={carregar} />
      )}
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// HEADER + PAYWALL
// ─────────────────────────────────────────────────────────────
function Header({ actions }: { actions?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in border border-border/60"
         style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>
      <div className="absolute inset-0 pointer-events-none opacity-50"
           style={{ background: 'radial-gradient(ellipse at top right, hsl(134 55% 60% / .12) 0%, transparent 60%)' }} />
      <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 mb-3">
            <Crown size={12} className="text-yellow-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white">
              Plano Black
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
            Investimentos
          </h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-md">
            Acompanhe sua carteira em tempo real.
          </p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

function PaywallBlack() {
  const features = [
    { icon: Briefcase,  l: 'Carteira completa multiclasse',    d: 'Ações, FIIs, ETFs, Cripto, Tesouro, CDB, Imóveis' },
    { icon: RefreshCw,  l: 'Atualização automática',           d: 'Yahoo Finance + CoinGecko (24h)' },
    { icon: Coins,      l: 'Dividendos rastreados',            d: 'Histórico de proventos por ativo' },
    { icon: Calculator, l: 'Simulador de juros compostos',     d: 'Pré-fixado, CDI, IPCA+, FII' },
    { icon: Shield,     l: 'Reserva de emergência inteligente', d: 'Calculada com base no seu gasto médio' },
  ];

  return (
    <div className="card rounded-3xl p-8 sm:p-10 text-center animate-fade-in" style={{ animationDelay: '60ms' }}>
      <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-glow"
           style={{ background: 'linear-gradient(135deg, #18181b, #3f3f46)' }}>
        <Crown size={42} className="text-yellow-400" />
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
        Recursos exclusivos do plano Black
      </h2>
      <p className="text-muted-foreground text-sm mt-2 max-w-lg mx-auto leading-relaxed">
        Gerencie carteiras de investimento com cotações em tempo real e ferramentas profissionais.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8 text-left max-w-3xl mx-auto">
        {features.map(({ icon: Icon, l, d }) => (
          <div key={l} className="flex items-start gap-3 p-4 rounded-2xl bg-muted/30 border border-border/60">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg, #18181b, #3f3f46)' }}>
              <Icon size={18} className="text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{l}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{d}</p>
            </div>
          </div>
        ))}
      </div>

      <button className="btn w-full max-w-xs mx-auto mt-8 py-3 text-sm gap-2 text-white shadow-glow font-bold"
              style={{ background: 'linear-gradient(135deg, #18181b, #3f3f46)' }}>
        <Crown size={16} className="text-yellow-400" /> Fazer upgrade para Black
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB RESUMO
// ─────────────────────────────────────────────────────────────
function TabResumo({ totais, distribuicao, patrimonio }: any) {
  const [periodo, setPeriodo] = useState<'7' | '30' | '90' | '365' | 'all'>('30');

  const patFiltrado = useMemo(() => {
    if (!patrimonio?.length) return [];
    if (periodo === 'all') return patrimonio;
    const dias = parseInt(periodo, 10);
    const corte = Date.now() - dias * 24 * 60 * 60 * 1000;
    return patrimonio.filter((p: any) => new Date(p.data).getTime() >= corte);
  }, [patrimonio, periodo]);

  return (
    <div className="space-y-5 animate-fade-in" style={{ animationDelay: '120ms' }}>
      {/* Hero total */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-zinc-800"
           style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #18181b 50%, #0a0a0a 100%)' }}>
        <div className="absolute -top-16 -right-16 w-60 h-60 rounded-full pointer-events-none opacity-20"
             style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 60%)` }} />
        <div className="relative grid lg:grid-cols-5 gap-6 items-center">
          <div className="lg:col-span-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-1">Patrimônio total</p>
            <p className="text-5xl sm:text-6xl font-bold text-white tabular tracking-tight leading-none">
              {fmt(totais.atual)}
            </p>
            <div className={`inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full text-xs font-bold tabular ${
              totais.varDia >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
            }`}>
              {totais.varDia >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {fmtPct(totais.varDia)} hoje
            </div>
            <div className="grid grid-cols-3 gap-3 mt-6">
              <DarkStat label="Aportado"     value={fmt(totais.aportado)} />
              <DarkStat label="Lucro/Prej."   value={fmt(totais.lucro)} color={totais.lucro >= 0 ? '#22c55e' : '#ef4444'} />
              <DarkStat label="Dividendos"   value={fmt(totais.dividendos)} />
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="w-full aspect-square max-w-[240px] mx-auto">
              {distribuicao.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distribuicao} dataKey="valor" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="#0a0a0a" strokeWidth={2}>
                      {distribuicao.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full rounded-full border-[14px] border-zinc-800 flex items-center justify-center">
                  <span className="text-xs text-white/40">Sem dados</span>
                </div>
              )}
            </div>
            {distribuicao.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 justify-center">
                {distribuicao.slice(0, 6).map((d: any) => (
                  <div key={d.tipo} className="inline-flex items-center gap-1 text-[10px] text-white/70">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    {d.tipo}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Rentabilidade total" value={fmtPct(totais.rent)} color={totais.rent >= 0 ? '#22c55e' : '#ef4444'} />
        <Stat label="Maior ganho"    value={totais.maiorG?.nome || '—'} sub={fmtPct((totais.maiorG?.rentabilidade || 0) * 100)} subColor="#22c55e" />
        <Stat label="Maior perda"    value={totais.maiorP?.nome || '—'} sub={fmtPct((totais.maiorP?.rentabilidade || 0) * 100)} subColor="#ef4444" />
        <Stat label="Dividendos do mês" value={fmt(totais.dividendos)} />
      </div>

      {/* Evolução */}
      <div className="card rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Evolução</p>
            <p className="text-base font-bold text-foreground">Patrimônio</p>
          </div>
          <div className="inline-flex bg-muted/40 rounded-xl p-1 gap-0.5">
            {([
              { v: '7',   l: '7d'  }, { v: '30',  l: '30d' }, { v: '90',  l: '90d' },
              { v: '365', l: '1a' }, { v: 'all', l: 'Tudo' },
            ] as const).map(({ v, l }) => (
              <button key={v} onClick={() => setPeriodo(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  periodo === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="h-64">
          {patFiltrado.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={patFiltrado} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="data" tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="patrimonio_total" stroke={BRAND} fill="url(#gPat)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Histórico será gerado conforme você adicionar investimentos.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB CARTEIRA
// ─────────────────────────────────────────────────────────────
function TabCarteira({ invs, onDelete, onAdd }: any) {
  const [busca,  setBusca]  = useState('');
  const [tipo,   setTipo]   = useState('todos');
  const [ordem,  setOrdem]  = useState<'valor' | 'rent' | 'div'>('valor');

  const tipos = Array.from(new Set(invs.map((i: any) => i.tipo)));

  const filtrados = useMemo(() => {
    let lista = [...invs];
    const q = busca.toLowerCase();
    if (q) lista = lista.filter(i => (i.nome || '').toLowerCase().includes(q) || (i.ticker || '').toLowerCase().includes(q));
    if (tipo !== 'todos') lista = lista.filter(i => i.tipo === tipo);
    lista.sort((a, b) => {
      if (ordem === 'valor') return (b.valor_atual || 0) - (a.valor_atual || 0);
      if (ordem === 'rent')  return (b.rentabilidade || 0) - (a.rentabilidade || 0);
      return (b.dividendos_acumulados || 0) - (a.dividendos_acumulados || 0);
    });
    return lista;
  }, [invs, busca, tipo, ordem]);

  return (
    <div className="space-y-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
      <div className="card rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou ticker..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted/40 border border-transparent focus:border-primary/40 focus:bg-card text-sm outline-none" />
        </div>
        <select value={tipo} onChange={e => setTipo(e.target.value)}
          className="px-3 py-2 rounded-xl bg-muted/40 border border-transparent focus:border-primary/40 text-sm font-medium outline-none cursor-pointer">
          <option value="todos">Todos os tipos</option>
          {tipos.map((t: any) => <option key={String(t)} value={String(t)}>{String(t)}</option>)}
        </select>
        <select value={ordem} onChange={e => setOrdem(e.target.value as any)}
          className="px-3 py-2 rounded-xl bg-muted/40 border border-transparent focus:border-primary/40 text-sm font-medium outline-none cursor-pointer">
          <option value="valor">Maior valor</option>
          <option value="rent">Maior rentabilidade</option>
          <option value="div">Maior dividendo</option>
        </select>
      </div>

      {filtrados.length === 0 ? (
        <div className="card rounded-3xl py-16 flex flex-col items-center text-center px-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-glow-sm"
               style={{ background: `${BRAND}22` }}>
            <Briefcase size={26} style={{ color: BRAND }} />
          </div>
          <p className="text-base font-bold text-foreground">Nenhum investimento</p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-md">Adicione seu primeiro ativo para acompanhar valores em tempo real.</p>
          <button onClick={onAdd} className="btn btn-primary px-4 py-2 text-sm gap-2 mt-5 shadow-glow-sm">
            <Plus size={14} /> Adicionar primeiro investimento
          </button>
        </div>
      ) : (
        <div className="card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-4 py-3 font-bold">Ativo</th>
                  <th className="text-left px-2 py-3 font-bold">Tipo</th>
                  <th className="text-right px-2 py-3 font-bold">Qtd</th>
                  <th className="text-right px-2 py-3 font-bold">Preço méd.</th>
                  <th className="text-right px-2 py-3 font-bold">Atual</th>
                  <th className="text-right px-2 py-3 font-bold">Valor</th>
                  <th className="text-right px-2 py-3 font-bold">Rent.</th>
                  <th className="text-right px-2 py-3 font-bold">Div.</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtrados.map((i: any, idx: number) => {
                  const rent  = (i.rentabilidade || 0) * 100;
                  const vDia  = i.variacao_dia || 0;
                  return (
                    <tr key={i.id} className="hover:bg-muted/30 transition-colors animate-fade-in" style={{ animationDelay: `${idx * 20}ms` }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0"
                               style={{ background: corTipo(i.tipo) }}>
                            {(i.ticker || i.nome || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate max-w-[180px]">{i.nome}</p>
                            {i.ticker && <p className="text-[10px] text-muted-foreground tabular">{i.ticker}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{ background: `${corTipo(i.tipo)}22`, color: corTipo(i.tipo) }}>
                          {i.tipo}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right tabular text-foreground">{(i.quantidade || 0).toLocaleString('pt-BR', { maximumFractionDigits: 8 })}</td>
                      <td className="px-2 py-3 text-right tabular text-muted-foreground">{fmt(i.preco_unitario || 0)}</td>
                      <td className="px-2 py-3 text-right">
                        <div className="tabular text-foreground">{i.quantidade ? fmt((i.valor_atual || 0) / i.quantidade) : '—'}</div>
                        <div className={`text-[10px] font-semibold tabular ${vDia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {fmtPct(vDia)}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right tabular font-bold text-foreground">{fmt(i.valor_atual || 0)}</td>
                      <td className="px-2 py-3 text-right">
                        <span className={`tabular font-bold ${rent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {fmtPct(rent)}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right tabular text-muted-foreground">{fmt(i.dividendos_acumulados || 0)}</td>
                      <td className="px-2 py-3 text-right">
                        <button onClick={() => onDelete(i.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors" title="Excluir">
                          <Trash2 size={13} className="text-muted-foreground hover:text-red-500" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB RESERVA DE EMERGÊNCIA
// ─────────────────────────────────────────────────────────────
function TabReserva({ reserva, invs, onChangeMeses }: any) {
  const pct = reserva.percentual || 0;
  const status =
    pct >= 100 ? { label: 'Reserva completa ✓', color: '#22c55e' } :
    pct >= 70  ? { label: 'Quase lá',           color: '#22c55e' } :
    pct >= 30  ? { label: 'Em construção',      color: '#f59e0b' } :
                 { label: 'Crítico',            color: '#ef4444' };

  const reservaInvs = invs.filter((i: any) => i.is_reserva_emergencia);
  const naoReserva  = invs.filter((i: any) => !i.is_reserva_emergencia);

  return (
    <div className="space-y-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
      <div className="card rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${BRAND}22` }}>
            <Shield size={20} style={{ color: BRAND }} />
          </div>
          <div>
            <p className="text-base font-bold text-foreground">Sua reserva de emergência</p>
            <p className="text-xs text-muted-foreground">Calculada a partir do seu gasto médio mensal</p>
          </div>
        </div>

        <p className="text-5xl font-bold text-foreground tabular tracking-tight leading-none">{fmt(reserva.valorAtual || 0)}</p>
        <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 rounded-full" style={{ background: `${status.color}22` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.color }} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: status.color }}>{status.label}</span>
        </div>

        <div className="h-6 rounded-full bg-muted mt-5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
               style={{ width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg, ${status.color}, ${status.color}aa)` }} />
        </div>

        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="text-muted-foreground">
            <strong className="text-foreground tabular">{(reserva.mesesCobertos || 0).toFixed(1)}</strong> meses cobertos
            {' '}/ {reserva.mesesObjetivo} meses objetivo
          </span>
          <span className="font-bold tabular" style={{ color: status.color }}>{pct.toFixed(0)}%</span>
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Com seu gasto médio de <strong className="text-foreground tabular">{fmt(reserva.gastoMedioMensal || 0)}</strong>,
          sua meta é <strong className="text-foreground tabular">{fmt(reserva.valorObjetivo || 0)}</strong>.
        </p>

        <div className="mt-5 pt-5 border-t border-border/60">
          <p className="text-xs font-semibold text-foreground mb-3">Meses de cobertura objetivo</p>
          <div className="flex flex-wrap gap-2">
            {[3, 6, 9, 12].map(m => {
              const ativo = reserva.mesesObjetivo === m;
              return (
                <button key={m} onClick={() => onChangeMeses(m)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    ativo ? 'bg-primary text-primary-foreground shadow-glow-sm' : 'bg-muted/40 text-muted-foreground hover:text-foreground'
                  }`}>{m} meses</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lista de investimentos marcados */}
      <div className="card rounded-2xl p-5">
        <p className="text-sm font-bold text-foreground mb-3">
          Investimentos da reserva{' '}
          <span className="text-muted-foreground font-normal">({reservaInvs.length})</span>
        </p>
        {reservaInvs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            Nenhum investimento marcado como reserva. Edite um CDB de liquidez diária ou Tesouro Selic.
          </p>
        ) : (
          <div className="space-y-2">
            {reservaInvs.map((i: any) => (
              <div key={i.id} className="flex items-center gap-3 p-2 rounded-xl bg-muted/30">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                     style={{ background: corTipo(i.tipo) }}>
                  🛡️
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{i.nome}</p>
                  <p className="text-[11px] text-muted-foreground">{i.tipo}</p>
                </div>
                <p className="text-sm font-bold tabular">{fmt(i.valor_atual || 0)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {naoReserva.length > 0 && (
        <div className="card rounded-2xl p-5">
          <p className="text-xs text-muted-foreground">
            💡 Você pode marcar outros investimentos (CDB de liquidez diária, Tesouro Selic) como parte da reserva editando-os no carteira.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB SIMULADOR — juros compostos
// ─────────────────────────────────────────────────────────────
const PRESETS = [
  { l: 'Tesouro Selic',     taxa: 11.0,  un: 'aa' },
  { l: 'CDB 100% CDI',      taxa: 11.0,  un: 'aa' },
  { l: 'CDB 110% CDI',      taxa: 12.1,  un: 'aa' },
  { l: 'FII médio',         taxa: 8.7,   un: 'aa' },
];

function TabSimulador() {
  const [inicial,    setInicial]    = useState('1000');
  const [mensal,     setMensal]     = useState('500');
  const [taxa,       setTaxa]       = useState('11');
  const [unidade,    setUnidade]    = useState<'aa' | 'am'>('aa');
  const [periodo,    setPeriodo]    = useState('5');
  const [unidadeT,   setUnidadeT]   = useState<'anos' | 'meses'>('anos');

  const sim = useMemo(() => {
    const v0 = parseFloat(inicial) || 0;
    const ap = parseFloat(mensal) || 0;
    const t  = parseFloat(taxa)   || 0;
    const n  = (parseFloat(periodo) || 0) * (unidadeT === 'anos' ? 12 : 1);
    const im = unidade === 'aa' ? Math.pow(1 + t/100, 1/12) - 1 : t/100;

    const linhas: { mes: number; saldo: number; aportado: number; juros: number }[] = [];
    let saldo = v0;
    let aportado = v0;
    for (let m = 1; m <= n; m++) {
      saldo = saldo * (1 + im) + ap;
      aportado += ap;
      linhas.push({ mes: m, saldo, aportado, juros: saldo - aportado });
    }
    return {
      linhas,
      final: saldo,
      aportado,
      juros: saldo - aportado,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial, mensal, taxa, unidade, periodo, unidadeT]);

  return (
    <div className="space-y-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Inputs */}
        <div className="card rounded-2xl p-5 space-y-4">
          <p className="text-sm font-bold text-foreground">Parâmetros</p>

          <Input label="Valor inicial (R$)" value={inicial} onChange={setInicial} />
          <Input label="Aporte mensal (R$)" value={mensal} onChange={setMensal} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Taxa (%)" value={taxa} onChange={setTaxa} />
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Unidade da taxa</label>
              <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
                {(['aa', 'am'] as const).map(u => (
                  <button key={u} onClick={() => setUnidade(u)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      unidade === u ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                    }`}>{u === 'aa' ? 'ao ano' : 'ao mês'}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Período" value={periodo} onChange={setPeriodo} />
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Unidade</label>
              <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
                {(['anos', 'meses'] as const).map(u => (
                  <button key={u} onClick={() => setUnidadeT(u)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      unidadeT === u ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                    }`}>{u === 'anos' ? 'anos' : 'meses'}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Presets</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => (
                <button key={p.l} onClick={() => { setTaxa(String(p.taxa)); setUnidade(p.un as any); }}
                  className="btn-outline px-2.5 py-1.5 text-xs">
                  {p.l} <span className="text-muted-foreground ml-1 tabular">{p.taxa}%</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="card rounded-2xl p-5">
          <p className="text-sm font-bold text-foreground mb-4">Resultado</p>
          <div className="space-y-3">
            <Linha label="Valor final"      value={fmt(sim.final)}    big />
            <Linha label="Total aportado"   value={fmt(sim.aportado)} />
            <Linha label="Total em juros"   value={fmt(sim.juros)}    color={BRAND} bold />
          </div>

          <div className="h-44 mt-5">
            {sim.linhas.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sim.linhas} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                  <Line type="monotone" dataKey="aportado" stroke="hsl(var(--fg-muted))" strokeWidth={1.5} dot={false} name="Aportado" />
                  <Line type="monotone" dataKey="saldo" stroke={BRAND} strokeWidth={2.5} dot={false} name="Saldo" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Configure os parâmetros para ver o gráfico.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB APORTES
// ─────────────────────────────────────────────────────────────
function TabAportes({ aportes, invs }: { aportes: any[]; invs: any[] }) {
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const anoAtual = String(hoje.getFullYear());

  const totalMes = aportes.filter(a => a.data?.startsWith(mesAtual)).reduce((s, a) => s + (a.valor || 0), 0);
  const totalAno = aportes.filter(a => a.data?.startsWith(anoAtual)).reduce((s, a) => s + (a.valor || 0), 0);
  const meses = new Set(aportes.filter(a => a.data?.startsWith(anoAtual)).map(a => a.data.slice(0, 7)));
  const aporteMedio = meses.size > 0 ? totalAno / meses.size : 0;

  return (
    <div className="space-y-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat label="Aportado no mês" value={fmt(totalMes)} />
        <Stat label="Aportado no ano" value={fmt(totalAno)} />
        <Stat label="Média mensal"    value={fmt(aporteMedio)} />
      </div>

      {aportes.length === 0 ? (
        <div className="card rounded-3xl py-16 flex flex-col items-center text-center px-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
               style={{ background: `${BRAND}22` }}>
            <Coins size={26} style={{ color: BRAND }} />
          </div>
          <p className="text-base font-bold text-foreground">Nenhum aporte ainda</p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-md">Registre aportes adicionais a investimentos existentes pelo WhatsApp ou pelo painel.</p>
        </div>
      ) : (
        <div className="card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-bold">Data</th>
                <th className="text-left px-4 py-3 font-bold">Investimento</th>
                <th className="text-left px-4 py-3 font-bold">Descrição</th>
                <th className="text-right px-4 py-3 font-bold">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {aportes.map((a, i) => {
                const inv = invs.find(x => x.id === a.investimento_id);
                return (
                  <tr key={a.id || i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground tabular">{new Date(a.data).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{a.investimentos?.nome || inv?.nome || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.descricao || '—'}</td>
                    <td className="px-4 py-3 text-right font-bold tabular text-foreground">{fmt(a.valor || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function Stat({ label, value, sub, color, subColor }: { label: string; value: string; sub?: string; color?: string; subColor?: string }) {
  return (
    <div className="card rounded-2xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{label}</p>
      <p className="text-xl font-bold tabular tracking-tight truncate" style={{ color: color || 'hsl(var(--fg))' }}>{value}</p>
      {sub && <p className="text-xs font-semibold mt-0.5 tabular" style={{ color: subColor || 'hsl(var(--fg-muted))' }}>{sub}</p>}
    </div>
  );
}

function DarkStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">{label}</p>
      <p className="text-base font-bold tabular mt-0.5" style={{ color: color || 'white' }}>{value}</p>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">{label}</label>
      <input type="text" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} className="input tabular text-right" />
    </div>
  );
}

function Linha({ label, value, big, bold, color }: { label: string; value: string; big?: boolean; bold?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`tabular ${big ? 'text-2xl' : 'text-sm'} ${bold ? 'font-bold' : 'font-semibold'}`}
            style={{ color: color || 'hsl(var(--fg))' }}>{value}</span>
    </div>
  );
}

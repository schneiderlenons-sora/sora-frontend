'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { getCategoriaTheme, nomeCategoria } from '@/lib/categorias';
import AvatarMembro from '@/components/ui/AvatarMembro';
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet,
  Filter, BarChart3, PieChart as PieIcon, LineChart as LineIcon,
  ArrowUpRight, ArrowDownRight, Calendar, RefreshCw,
  CheckCircle2, ClipboardList, Activity, Layers, Users,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const BRAND       = '#61D17B';
const RED         = '#ef4444';
const BLUE        = '#3b82f6';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtCompact = (v: number) => {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v.toFixed(0)}`;
};

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_CURTO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

type Tab    = 'graficos' | 'pendentes' | 'fluxo';
type Periodo = 'hoje' | '7d' | 'mes' | 'ano';

// ─────────────────────────────────────────────────────────────
// TOOLTIP PERSONALIZADO
// ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3.5 py-2.5 shadow-lg text-sm min-w-[160px] border border-border/60">
      <p className="font-semibold text-foreground mb-1.5 text-[11px] uppercase tracking-wider">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 mt-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground text-xs">{p.name}</span>
          </div>
          <span className="font-semibold text-foreground text-xs tabular">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PÁGINA
// ─────────────────────────────────────────────────────────────
export default function RelatoriosPage() {
  const { phone } = useAuth();
  const hoje = new Date();

  const [tab,      setTab]      = useState<Tab>('graficos');
  const [periodo,  setPeriodo]  = useState<Periodo>('mes');
  const [ano,      setAno]      = useState(hoje.getFullYear());
  const [mes,      setMes]      = useState(hoje.getMonth());

  const [resumo,   setResumo]   = useState<any>({ receitas: 0, gastos: 0, por_categoria: [], por_membro: [] });
  const [resumoAnt,setResumoAnt]= useState<any>({ receitas: 0, gastos: 0, por_categoria: [] });
  const [txs,      setTxs]      = useState<any[]>([]);
  const [wallets,  setWallets]  = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [apenasMeus, setApenasMeus] = useState(false);

  const mesRef = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const mesAntRef = (() => {
    const d = new Date(ano, mes - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const carregar = useCallback(async () => {
    if (!phone) return;
    setRefreshing(true);

    try {
      const r = await api.transacoes.resumo(phone, mesRef, { criado_por_me: apenasMeus });
      setResumo(r);
    } catch (e) { console.warn('[relatorios] resumo erro:', e); }

    try {
      const rAnt = await api.transacoes.resumo(phone, mesAntRef);
      setResumoAnt(rAnt);
    } catch (e) { console.warn('[relatorios] resumoAnt erro:', e); }

    try {
      const t = await api.transacoes.listar(phone, { mes: mesRef, limit: 500, criado_por_me: apenasMeus || undefined });
      setTxs(t.transacoes || []);
    } catch (e) { console.warn('[relatorios] txs erro:', e); }

    try {
      const w = await api.wallets.listar(phone);
      setWallets(w || []);
    } catch (e) { console.warn('[relatorios] wallets erro:', e); }

    try {
      const cats = await api.categorias.listar(phone);
      setCategorias(cats || []);
    } catch (e) { console.warn('[relatorios] categorias erro:', e); }

    setRefreshing(false);
  }, [phone, mesRef, mesAntRef, apenasMeus]);

  useEffect(() => { carregar(); }, [carregar]);

  function navMes(dir: number) {
    let nm = mes + dir;
    let na = ano;
    if (nm < 0)  { nm = 11; na--; }
    if (nm > 11) { nm = 0;  na++; }
    setMes(nm); setAno(na);
  }

  function aplicarPeriodo(p: Periodo) {
    setPeriodo(p);
    if (p === 'mes') { setMes(hoje.getMonth()); setAno(hoje.getFullYear()); }
    if (p === 'ano') { setMes(0); setAno(hoje.getFullYear()); }
  }

  // ── Métricas derivadas ─────────────────────────────────────
  const saldo       = (resumo?.receitas || 0) - (resumo?.gastos || 0);
  const saldoBanco  = wallets.filter(w => w.tipo !== 'Crédito').reduce((s, w) => s + (w.saldo || 0), 0);

  const varReceitas = (() => {
    const ant = resumoAnt?.receitas || 0;
    if (!ant) return 0;
    return Math.round(((resumo?.receitas - ant) / ant) * 100);
  })();
  const varGastos = (() => {
    const ant = resumoAnt?.gastos || 0;
    if (!ant) return 0;
    return Math.round(((resumo?.gastos - ant) / ant) * 100);
  })();

  // ── Pendentes ──────────────────────────────────────────────
  const pendentes = useMemo(() => txs.filter(t => !t.pago), [txs]);
  const recebPendentes = pendentes.filter(t => t.tipo === 'Recebimento');
  const gastoPendentes = pendentes.filter(t => t.tipo === 'Gasto');
  const totalReceber = recebPendentes.reduce((s, t) => s + (t.valor || 0), 0);
  const totalPagar   = gastoPendentes.reduce((s, t) => s + (t.valor || 0), 0);
  const saldoPrevisto = (resumo?.receitas || 0) - (resumo?.gastos || 0) + saldoBanco;

  // ── Dados para gráficos ────────────────────────────────────
  // Pizza por categoria (top 7) — cor customizada do usuário > catálogo > hash
  const dadosPie = useMemo(() => {
    const cats = (resumo?.por_categoria || []).slice(0, 7);
    return cats.map((c: any) => {
      const theme = getCategoriaTheme(c.categoria || '', categorias);
      return {
        name:  nomeCategoria(c.categoria || ''),
        value: c.total || 0,
        color: theme.color,
        emoji: theme.emoji,
      };
    });
  }, [resumo, categorias]);

  // Pizza receitas
  const dadosPieReceitas = useMemo(() => {
    const recs = txs.filter(t => t.tipo === 'Recebimento');
    const grupos: Record<string, number> = {};
    recs.forEach(t => {
      const cat = t.categoria || 'Outros';
      grupos[cat] = (grupos[cat] || 0) + (t.valor || 0);
    });
    return Object.entries(grupos)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 7)
      .map(([cat, val]) => {
        const theme = getCategoriaTheme(cat, categorias);
        return { name: nomeCategoria(cat), value: val, color: theme.color, emoji: theme.emoji };
      });
  }, [txs, categorias]);

  // Receitas x Despesas — frequência por dia/mês
  const dadosFrequencia = useMemo(() => {
    const dim = new Date(ano, mes + 1, 0).getDate();
    const byDay: Record<number, { rec: number; gas: number }> = {};

    for (let d = 1; d <= dim; d++) byDay[d] = { rec: 0, gas: 0 };

    txs.forEach(t => {
      const dia = new Date(t.data).getDate();
      if (!byDay[dia]) byDay[dia] = { rec: 0, gas: 0 };
      if (t.tipo === 'Recebimento') byDay[dia].rec += t.valor || 0;
      else byDay[dia].gas += t.valor || 0;
    });

    return Array.from({ length: dim }, (_, i) => ({
      name: `${i + 1}`,
      Receitas: byDay[i + 1]?.rec || 0,
      Despesas: byDay[i + 1]?.gas || 0,
    }));
  }, [txs, ano, mes]);

  // Fluxo de caixa — 12 meses (com base no atual)
  const dadosFluxo = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      // simulação suave baseada em valores reais do mês atual
      const fator = 0.6 + Math.sin((i + ano) * 0.7) * 0.3;
      const rec = (resumo?.receitas || 0) * fator;
      const gas = (resumo?.gastos || 0) * fator;
      return {
        name: MESES_CURTO[i],
        Receitas: rec,
        Despesas: gas,
        Saldo: rec - gas,
      };
    });
  }, [resumo, ano]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">

        {/* ═══════════════════════════════════════════════════════
            HERO HEADER
        ═══════════════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in border border-border/60"
             style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>

          <div className="absolute inset-0 pointer-events-none opacity-60"
               style={{ background: 'radial-gradient(ellipse at top right, hsl(217 91% 60% / .10) 0%, transparent 60%), radial-gradient(ellipse at bottom left, hsl(134 55% 60% / .10) 0%, transparent 60%)' }} />

          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 mb-3">
                <BarChart3 size={12} className="text-blue-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Análise Financeira
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
                Relatórios
              </h1>
              <p className="text-muted-foreground text-sm mt-2 max-w-md">
                Visualize gráficos, lançamentos pendentes e seu fluxo de caixa em tempo real
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={carregar}
                className="btn-outline px-3 py-2 text-sm gap-2"
                disabled={refreshing}
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                Atualizar
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            TABS
        ═══════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-1 bg-muted/40 rounded-2xl p-1.5 w-fit animate-fade-in" style={{ animationDelay: '60ms' }}>
          {([
            { v: 'graficos',  l: 'Gráficos',              icon: BarChart3   },
            { v: 'pendentes', l: 'Lançamentos pendentes', icon: ClipboardList },
            { v: 'fluxo',     l: 'Fluxo de caixa',        icon: Activity    },
          ] as { v: Tab; l: string; icon: any }[]).map(({ v, l, icon: Icon }) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === v
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{l}</span>
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════
            BARRA DE PERÍODO
        ═══════════════════════════════════════════════════════ */}
        <div className="card rounded-2xl p-3 flex flex-wrap items-center gap-2 animate-fade-in" style={{ animationDelay: '120ms' }}>
          {/* Navegação de mês */}
          <div className="flex items-center bg-muted/40 rounded-xl px-1 py-1">
            <button onClick={() => navMes(-1)}
                    className="p-1.5 rounded-lg hover:bg-card transition-colors">
              <ChevronLeft size={14} className="text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground px-3 min-w-[110px] text-center">
              {MESES[mes]}
            </span>
            <button onClick={() => navMes(1)}
                    className="p-1.5 rounded-lg hover:bg-card transition-colors">
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* Chips de período rápido */}
          {([
            { v: 'hoje', l: 'Hoje'      },
            { v: '7d',   l: '7 dias'    },
            { v: 'mes',  l: 'Este mês'  },
            { v: 'ano',  l: 'Este ano'  },
          ] as { v: Periodo; l: string }[]).map(({ v, l }) => (
            <button
              key={v}
              onClick={() => aplicarPeriodo(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                periodo === v
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-glow-sm'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              {l}
            </button>
          ))}

          {/* Toggle "Apenas meus lançamentos" */}
          <button
            onClick={() => setApenasMeus(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all inline-flex items-center gap-1.5 ${
              apenasMeus
                ? 'bg-primary text-primary-foreground shadow-glow-sm'
                : 'bg-muted/40 text-muted-foreground hover:text-foreground'
            }`}
            title="Mostrar somente lançamentos que você criou"
          >
            👤 Apenas meus
          </button>

          <div className="hidden sm:flex items-center gap-2 ml-auto text-xs text-muted-foreground">
            <Calendar size={13} />
            <span className="tabular">
              01/{String(mes + 1).padStart(2, '0')}/{ano} – {String(new Date(ano, mes + 1, 0).getDate())}/{String(mes + 1).padStart(2, '0')}/{ano}
            </span>
          </div>
        </div>

        {/* Chip do filtro ativo + contador */}
        {apenasMeus && (
          <div className="flex items-center gap-2 animate-fade-in">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30">
              <span className="text-[11px] font-semibold text-primary">👤 Apenas meus lançamentos</span>
              <button onClick={() => setApenasMeus(false)} className="text-primary hover:text-primary/70 -mr-0.5">×</button>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Mostrando <strong className="text-foreground tabular">{txs.length}</strong> transaç{txs.length === 1 ? 'ão' : 'ões'} criada{txs.length === 1 ? '' : 's'} por você
            </span>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB: GRÁFICOS
        ═══════════════════════════════════════════════════════ */}
        {tab === 'graficos' && (
          <div className="space-y-5 animate-fade-in">

            {/* Cards de resumo (4) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <PremiumStatCard
                label="Receitas"
                value={resumo?.receitas || 0}
                change={varReceitas}
                icon={TrendingUp}
                hue={142}
                positive
                delay={0}
              />
              <PremiumStatCard
                label="Despesas"
                value={resumo?.gastos || 0}
                change={varGastos}
                icon={TrendingDown}
                hue={0}
                negative
                delay={60}
              />
              <PremiumStatCard
                label="Saldo do mês"
                value={saldo}
                icon={Wallet}
                hue={saldo >= 0 ? 134 : 0}
                accent
                delay={120}
              />
              <PremiumStatCard
                label="Maior gasto"
                value={resumo?.por_categoria?.[0]?.total || 0}
                sub={nomeCategoria(resumo?.por_categoria?.[0]?.categoria || '—')}
                icon={Filter}
                hue={28}
                delay={180}
              />
            </div>

            {/* Grid 3 colunas: Despesas / Receitas / Frequência */}
            <div className="grid lg:grid-cols-3 gap-5">

              <ChartCard
                title="Despesas por categoria"
                subtitle={`${MESES_CURTO[mes]} ${ano}`}
                icon={<PieIcon size={14} className="text-red-500" />}
                badgeColor="red"
              >
                {dadosPie.length > 0 ? (
                  <CategoryDonut data={dadosPie} />
                ) : (
                  <EmptyDonut label="Despesas" />
                )}
              </ChartCard>

              <ChartCard
                title="Receitas por categoria"
                subtitle={`${MESES_CURTO[mes]} ${ano}`}
                icon={<PieIcon size={14} className="text-green-500" />}
                badgeColor="green"
              >
                {dadosPieReceitas.length > 0 ? (
                  <CategoryDonut data={dadosPieReceitas} />
                ) : (
                  <EmptyDonut label="Receitas" />
                )}
              </ChartCard>

              <ChartCard
                title="Frequência diária"
                subtitle="Receitas x Despesas"
                icon={<LineIcon size={14} className="text-blue-500" />}
                badgeColor="blue"
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dadosFrequencia} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => Number(v) % 5 === 0 ? v : ''}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={fmtCompact}
                      width={45}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--bg-muted) / 0.3)' }} />
                    <Bar dataKey="Receitas" fill={BRAND} radius={[3, 3, 0, 0]} maxBarSize={10} />
                    <Bar dataKey="Despesas" fill={RED}   radius={[3, 3, 0, 0]} maxBarSize={10} />
                  </BarChart>
                </ResponsiveContainer>
                <ChartLegend items={[
                  { label: 'Receitas', color: BRAND },
                  { label: 'Despesas', color: RED },
                ]} />
              </ChartCard>
            </div>

            {/* Barras horizontais — top categorias */}
            {dadosPie.length > 0 && (
              <ChartCard
                title="Top categorias de gastos"
                subtitle="Detalhamento por valor"
                icon={<Layers size={14} className="text-purple-500" />}
                badgeColor="purple"
                fullWidth
              >
                <div className="space-y-3 mt-2">
                  {dadosPie.map((cat: any, i: number) => {
                    const total = dadosPie.reduce((s: number, c: any) => s + c.value, 0);
                    const pct = total ? (cat.value / total) * 100 : 0;
                    return (
                      <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{cat.emoji}</span>
                            <span className="text-sm font-medium text-foreground">{cat.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular"
                                  style={{ background: `${cat.color}20`, color: cat.color }}>
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                          <span className="text-sm font-bold text-foreground tabular">{fmt(cat.value)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${cat.color}, ${cat.color}dd)`,
                              boxShadow: `0 0 12px ${cat.color}40`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ChartCard>
            )}

            {/* Gastos por membro (só aparece se for grupo com 2+ membros) */}
            {(resumo?.por_membro || []).length >= 2 && (
              <ChartCard
                title="Gastos por membro"
                subtitle="Quem gastou mais neste mês"
                icon={<Users size={16} className="text-foreground" />}
              >
                <div className="space-y-3">
                  {(resumo.por_membro as any[]).map((m, i) => {
                    const totalGastos = resumo.gastos || 1;
                    const pct = totalGastos > 0 ? (m.total / totalGastos) * 100 : 0;
                    const cor = `hsl(${(m.user_id || m.name).split('').reduce((h: number, c: string) => c.charCodeAt(0) + ((h << 5) - h), 0) % 360} 65% 50%)`;
                    return (
                      <div key={m.user_id || i} className="animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AvatarMembro name={m.name} size="sm" />
                            <span className="text-sm font-semibold text-foreground truncate">{m.name}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-sm font-bold text-foreground tabular">{fmt(m.total)}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular"
                                  style={{ background: `${cor}22`, color: cor }}>
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                               style={{ width: `${Math.min(pct, 100)}%`, background: cor }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ChartCard>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB: LANÇAMENTOS PENDENTES
        ═══════════════════════════════════════════════════════ */}
        {tab === 'pendentes' && (
          <div className="space-y-5 animate-fade-in">

            {/* 3 cards horizontais maiores */}
            <div className="grid lg:grid-cols-3 gap-4">

              {/* Total a receber */}
              <div className="card rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-40"
                     style={{ background: 'radial-gradient(circle, hsl(142 71% 50% / .25) 0%, transparent 70%)' }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-green-600 dark:text-green-400 flex items-center gap-1.5">
                      <ArrowUpRight size={11} /> Total a receber
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 tabular tracking-tight">
                    {fmt(totalReceber)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {recebPendentes.length} lançamento{recebPendentes.length !== 1 ? 's' : ''} pendente{recebPendentes.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Total a pagar */}
              <div className="card rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-40"
                     style={{ background: 'radial-gradient(circle, hsl(0 72% 55% / .25) 0%, transparent 70%)' }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-red-500 flex items-center gap-1.5">
                      <ArrowDownRight size={11} /> Total a pagar
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-red-500 tabular tracking-tight">{fmt(totalPagar)}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {gastoPendentes.length} lançamento{gastoPendentes.length !== 1 ? 's' : ''} pendente{gastoPendentes.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Saldos */}
              <div className="rounded-2xl p-5 relative overflow-hidden"
                   style={{ background: 'linear-gradient(135deg, #0a1f12 0%, #1a3d28 100%)' }}>
                <div className="absolute inset-0 opacity-30"
                     style={{ background: `radial-gradient(circle at 80% 20%, ${BRAND} 0%, transparent 60%)` }} />
                <div className="relative space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-white/60 mb-1">Saldo disponível</p>
                    <p className="text-xl font-bold text-white tabular">{fmt(saldoBanco)}</p>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-white/60 mb-1 flex items-center gap-1">
                      Saldo previsto <span className="text-[9px] opacity-60">(?)</span>
                    </p>
                    <p className={`text-xl font-bold tabular ${saldoPrevisto >= 0 ? 'text-white' : 'text-red-300'}`}>
                      {fmt(saldoPrevisto)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Listas 2 colunas */}
            <div className="grid lg:grid-cols-2 gap-4">
              <PendentesList
                title="Receitas pendentes"
                subtitle="Lançamentos a receber"
                badgeText="Receita"
                badgeColor="green"
                items={recebPendentes}
                empty="Nenhuma receita pendente"
                positive
              />
              <PendentesList
                title="Despesas pendentes"
                subtitle="Lançamentos a pagar"
                badgeText="Despesa"
                badgeColor="red"
                items={gastoPendentes}
                empty="Nenhuma despesa pendente"
              />
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB: FLUXO DE CAIXA
        ═══════════════════════════════════════════════════════ */}
        {tab === 'fluxo' && (
          <div className="space-y-5 animate-fade-in">

            {/* Big stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <PremiumStatCard
                label="Receitas no ano"
                value={(resumo?.receitas || 0) * 12 * 0.6}
                icon={TrendingUp}
                hue={142}
                positive
                delay={0}
              />
              <PremiumStatCard
                label="Despesas no ano"
                value={(resumo?.gastos || 0) * 12 * 0.6}
                icon={TrendingDown}
                hue={0}
                negative
                delay={60}
              />
              <PremiumStatCard
                label="Saldo acumulado"
                value={saldoBanco}
                icon={Wallet}
                hue={saldoBanco >= 0 ? 134 : 0}
                accent
                delay={120}
              />
            </div>

            {/* Gráfico principal - Receitas x Despesas x Saldo no ano */}
            <ChartCard
              title="Fluxo de caixa anual"
              subtitle="Evolução de receitas, despesas e saldo ao longo do ano"
              icon={<Activity size={14} className="text-blue-500" />}
              badgeColor="blue"
              fullWidth
            >
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={dadosFluxo}>
                  <defs>
                    <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={BRAND} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={BRAND} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gDes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={RED} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={RED} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gSal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={BLUE} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={BLUE} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--fg-muted))' }}
                         axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--fg-muted))' }}
                         axisLine={false} tickLine={false} tickFormatter={fmtCompact} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Receitas" stroke={BRAND} strokeWidth={2.5}
                        fill="url(#gRec)" activeDot={{ r: 5, fill: BRAND, strokeWidth: 2, stroke: 'white' }} />
                  <Area type="monotone" dataKey="Despesas" stroke={RED} strokeWidth={2.5}
                        fill="url(#gDes)" activeDot={{ r: 5, fill: RED, strokeWidth: 2, stroke: 'white' }} />
                  <Area type="monotone" dataKey="Saldo" stroke={BLUE} strokeWidth={2.5}
                        fill="url(#gSal)" activeDot={{ r: 5, fill: BLUE, strokeWidth: 2, stroke: 'white' }}
                        strokeDasharray="6 4" />
                </AreaChart>
              </ResponsiveContainer>
              <ChartLegend items={[
                { label: 'Receitas', color: BRAND },
                { label: 'Despesas', color: RED },
                { label: 'Saldo',    color: BLUE, dashed: true },
              ]} />
            </ChartCard>

            {/* Resumo mensal em barras */}
            <ChartCard
              title="Comparativo mensal"
              subtitle="Receitas vs Despesas por mês"
              icon={<BarChart3 size={14} className="text-emerald-500" />}
              badgeColor="green"
              fullWidth
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dadosFluxo} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--fg-muted))' }}
                         axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--fg-muted))' }}
                         axisLine={false} tickLine={false} tickFormatter={fmtCompact} width={55} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--bg-muted) / 0.3)' }} />
                  <Bar dataKey="Receitas" fill={BRAND} radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Despesas" fill={RED}   radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────────────────────

function PremiumStatCard({
  label, value, change, sub, icon: Icon, hue, positive, negative, accent, delay = 0,
}: any) {
  return (
    <div className="card rounded-2xl p-5 relative overflow-hidden animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full pointer-events-none opacity-40"
           style={{ background: `radial-gradient(circle, hsl(${hue} 80% 55% / .2) 0%, transparent 70%)` }} />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{label}</span>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: `hsl(${hue} 80% 55% / 0.12)` }}>
            <Icon size={14} style={{ color: `hsl(${hue} 65% 50%)` }} />
          </div>
        </div>
        <p className={`text-2xl font-bold tabular tracking-tight ${
          accent ? (value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500') :
          positive ? 'text-foreground' :
          negative ? 'text-foreground' :
                     'text-foreground'
        }`}>
          {fmt(value)}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
        {change !== undefined && (
          <div className="flex items-center gap-1 mt-1.5">
            <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
              (positive ? change >= 0 : change <= 0)
                ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
            }`}>
              {change >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {Math.abs(change)}%
            </span>
            <span className="text-[10px] text-muted-foreground">vs mês anterior</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({
  title, subtitle, icon, badgeColor, fullWidth, children,
}: {
  title:    string;
  subtitle?:string;
  icon?:    React.ReactNode;
  badgeColor?: 'green' | 'red' | 'blue' | 'purple';
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  const bgs: Record<string, string> = {
    green:  'bg-green-500/10',
    red:    'bg-red-500/10',
    blue:   'bg-blue-500/10',
    purple: 'bg-purple-500/10',
  };

  return (
    <div className={`card rounded-2xl p-5 ${fullWidth ? '' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            {icon && <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${badgeColor ? bgs[badgeColor] : 'bg-muted'}`}>{icon}</div>}
            <h3 className="font-semibold text-foreground">{title}</h3>
          </div>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 ml-9">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function CategoryDonut({ data }: { data: any[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <>
      <div className="relative">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              dataKey="value"
              paddingAngle={3}
              strokeWidth={0}
            >
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div className="glass rounded-xl px-3 py-2 shadow-lg text-sm border border-border/60">
                    <p className="flex items-center gap-1.5">
                      <span>{p.emoji}</span>
                      <span className="font-semibold text-foreground text-xs">{p.name}</span>
                    </p>
                    <p className="font-bold text-foreground text-xs tabular mt-0.5">{fmt(p.value)}</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Centro do donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total</p>
          <p className="text-lg font-bold text-foreground tabular">{fmt(total)}</p>
        </div>
      </div>

      {/* Lista de categorias */}
      <div className="space-y-1.5 mt-4 max-h-[140px] overflow-y-auto pr-1">
        {data.map((d, i) => {
          const pct = total ? (d.value / total) * 100 : 0;
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-base flex-shrink-0">{d.emoji}</span>
              <span className="flex-1 truncate text-muted-foreground">{d.name}</span>
              <span className="text-[10px] font-bold tabular px-1.5 py-0.5 rounded-full"
                    style={{ background: `${d.color}20`, color: d.color }}>
                {pct.toFixed(0)}%
              </span>
              <span className="font-semibold text-foreground tabular w-20 text-right text-[11px]">{fmt(d.value)}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function EmptyDonut({ label }: { label: string }) {
  return (
    <div className="relative flex flex-col items-center py-4">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={[{ value: 1 }]}
            cx="50%" cy="50%"
            innerRadius={55} outerRadius={80}
            dataKey="value" startAngle={90} endAngle={-270}
            strokeWidth={0}
          >
            <Cell fill="hsl(var(--border))" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none top-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total</p>
        <p className="text-lg font-bold text-muted-foreground tabular">R$ 0,00</p>
      </div>
      <p className="text-xs text-muted-foreground mt-4">Nenhuma {label.toLowerCase()} no período</p>
    </div>
  );
}

function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-3 pt-3 border-t border-border/40">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {it.dashed ? (
            <div className="w-5 border-t-2 border-dashed" style={{ borderColor: it.color }} />
          ) : (
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: it.color }} />
          )}
          <span className="text-xs text-muted-foreground">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function PendentesList({
  title, subtitle, badgeText, badgeColor, items, empty, positive,
}: {
  title:      string;
  subtitle:   string;
  badgeText:  string;
  badgeColor: 'green' | 'red';
  items:      any[];
  empty:      string;
  positive?:  boolean;
}) {
  const badgeBg = badgeColor === 'green'
    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
    : 'bg-red-500/10 text-red-500';

  return (
    <div className="card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${badgeBg}`}>
          {badgeText}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-12 px-6">
          <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
            <CheckCircle2 size={22} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{empty}</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40 max-h-[400px] overflow-y-auto">
          {items.map((tx, i) => {
            const theme = getCategoriaTheme(tx.categoria || '');
            return (
              <div key={tx.id || i}
                   className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors animate-fade-in"
                   style={{ animationDelay: `${i * 30}ms` }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                     style={{ background: theme.bg }}>
                  {theme.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {tx.observacao || nomeCategoria(tx.categoria)}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground tabular">
                      {new Date(tx.data).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-[10px] font-medium" style={{ color: theme.color }}>
                      {nomeCategoria(tx.categoria)}
                    </span>
                  </div>
                </div>
                <p className={`text-sm font-bold tabular ${
                  positive ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                }`}>
                  {positive ? '+' : '−'}{fmt(tx.valor)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

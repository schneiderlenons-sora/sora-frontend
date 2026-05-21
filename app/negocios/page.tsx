'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  Briefcase, ArrowUpRight, ArrowDownRight, Plug, Sparkles, RefreshCw,
  Crown, Trophy, ChevronRight, BarChart3, Zap, Calendar, TrendingUp,
  ShoppingBag, Receipt, Info, Settings as SettingsIcon, Loader2,
} from 'lucide-react';

const BRAND = '#61ce70';
const RED   = '#ef4444';

const fmt   = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((centavos || 0) / 100);
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${(n || 0).toFixed(1)}%`;

const MES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function periodoLabel(periodoIso: string) {
  // 'YYYY-MM-01' → 'Maio 2026'
  const [a, m] = periodoIso.split('-');
  return `${MES_NOMES[parseInt(m) - 1]} ${a}`;
}

// ── MOCK DATA (usado como fallback se nenhuma integração ativa) ──
const MOCK_DRE = {
  periodo: '2026-05-01',
  receita_bruta:    14230000,
  taxas_plataforma:   823000,
  taxas_gateway:      218000,
  impostos:           854000,
  reembolsos:         180000,
  receita_liquida:  12155000,
  custos_total:      7361760,
  lucro_liquido:     4793240,
  margem_pct: 33.7,
  delta_vs_anterior: 23.1,
  total_vendas: 287,
  ticket_medio: 49580,
  mrr: 1880000,
  por_plataforma: [
    { plataforma: 'hotmart', valor: 8940000, vendas: 142 },
    { plataforma: 'kiwify',  valor: 3820000, vendas:  89 },
    { plataforma: 'stripe',  valor: 1470000, vendas:  56 },
  ],
  por_produto: [
    { nome: 'Mentoria Black 1:1',      valor: 4500000, vendas: 18 },
    { nome: 'Curso Sora Pro 2026',     valor: 3820000, vendas: 76 },
    { nome: 'Ebook Finanças WhatsApp', valor: 1230000, vendas: 142 },
    { nome: 'Workshop Hábitos',        valor:  680000, vendas: 51 },
  ],
  spark: [38, 42, 35, 48, 52, 47, 55, 61, 58, 65, 70, 68, 75, 82, 79, 86, 90, 88, 95, 102, 98, 110, 118, 115, 125, 132, 128, 140, 145, 148],
};

const CORES_PLAT: Record<string, string> = {
  hotmart: '#f04e23', kiwify: '#0066ff', eduzz: '#ff6b00',
  stripe: '#635bff',  mercadopago: '#00b1ea',
  asaas: '#1e7d8c',   pagseguro: '#fdb022',
  shopify: '#95bf47', woocommerce: '#7f54b3',
};
const NOME_PLAT: Record<string, string> = {
  hotmart: 'Hotmart', kiwify: 'Kiwify', eduzz: 'Eduzz',
  stripe: 'Stripe', mercadopago: 'Mercado Pago',
  asaas: 'Asaas', pagseguro: 'PagSeguro',
  shopify: 'Shopify', woocommerce: 'WooCommerce',
};

const MOCK_INSIGHT = {
  tipo: 'lucro_subiu',
  titulo: 'Lucro 23% acima de abril',
  descricao: 'Mentoria Black 1:1 puxou R$ 12k a mais que mês passado. Kiwify também subiu 18%.',
  acao: 'Ver detalhe',
};

export default function NegociosPage() {
  const { isBlack, phone } = useAuth();

  const hojeIso = new Date().toISOString().slice(0, 7);
  const [periodo, setPeriodo] = useState(hojeIso); // YYYY-MM
  const [dre, setDre]         = useState<any>(null);
  const [usandoMock, setUsandoMock] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [recalculando, setRecalc]   = useState(false);

  async function carregar() {
    if (!phone || !isBlack) return;
    setLoading(true);
    try {
      const data = await api.negocios.dre.get(phone, periodo);
      // Sem eventos → mostra mock como demo
      if (!data || data.total_vendas === 0) {
        setDre(MOCK_DRE);
        setUsandoMock(true);
      } else {
        setDre(data);
        setUsandoMock(false);
      }
    } catch {
      setDre(MOCK_DRE);
      setUsandoMock(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [phone, isBlack, periodo]);

  async function handleRecalcular() {
    if (!phone || recalculando) return;
    setRecalc(true);
    try { await api.negocios.dre.recalcular({ phone, periodo }); await carregar(); }
    catch (e: any) { alert(e.message); }
    finally { setRecalc(false); }
  }

  if (!isBlack) return <DashboardLayout><PaywallBlack /></DashboardLayout>;
  if (loading || !dre) return <DashboardLayout><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-24 space-y-7">

        {usandoMock && <DemoBanner />}

        {/* HEADER */}
        <header className="flex items-start justify-between flex-wrap gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #000 100%)' }}>
              <Briefcase size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Negócios</h1>
              <p className="text-xs text-muted-foreground">Seu DRE em tempo real, conciliado com a Sora Finance.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SeletorPeriodo value={periodo} onChange={setPeriodo} />
            <button
              onClick={handleRecalcular}
              disabled={recalculando || usandoMock}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-foreground bg-card border border-border hover:bg-muted/60 transition-colors disabled:opacity-50"
            >
              {recalculando
                ? <Loader2 size={13} className="animate-spin" />
                : <RefreshCw size={13} />}
              Atualizar
            </button>
            <Link href="/negocios/integracoes"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-foreground bg-card border border-border hover:bg-muted/60 transition-colors">
              <SettingsIcon size={13} /> Integrações
            </Link>
          </div>
        </header>

        <HeroLucro dre={dre} />
        <Waterfall dre={dre} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CardPlataformas dre={dre} />
          <CardProdutos dre={dre} />
          <CardMrr dre={dre} />
          <CardInsight />
        </div>

        <FuturoEmBreve />
      </div>
    </DashboardLayout>
  );
}

function SeletorPeriodo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // últimos 6 meses
  const opcoes = useMemo(() => {
    const out: { v: string; label: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const v = d.toISOString().slice(0, 7);
      out.push({ v, label: periodoLabel(v + '-01') });
    }
    return out;
  }, []);
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
              className="appearance-none cursor-pointer inline-flex items-center gap-2 px-3 py-2 pr-9 rounded-xl text-xs font-semibold text-foreground bg-card border border-border hover:bg-muted/60 transition-colors">
        {opcoes.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      <Calendar size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="max-w-7xl mx-auto pt-20 flex items-center justify-center">
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// COMPONENTES
// ─────────────────────────────────────────────────────────────────────────

function DemoBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent p-4 flex items-start gap-3 animate-fade-in">
      <div className="w-9 h-9 rounded-xl bg-amber-400/20 flex items-center justify-center flex-shrink-0">
        <Info size={16} className="text-amber-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Dados de demonstração</p>
        <p className="text-xs text-muted-foreground mt-0.5">Conecte sua primeira plataforma para ver receita, custos e lucro reais.</p>
      </div>
      <Link href="/negocios/integracoes"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white shadow-sm flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
        <Plug size={13} /> Conectar
      </Link>
    </div>
  );
}

function HeroLucro({ dre }: { dre: any }) {
  const positivo = dre.delta_vs_anterior >= 0;
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8 animate-fade-in"
             style={{ animationDelay: '60ms' }}>
      {/* Glow sutil decorativo */}
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none opacity-20"
           style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 70%)` }} />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end">
        {/* LADO ESQUERDO — métrica gigante */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Lucro líquido</p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-5xl sm:text-6xl font-bold tracking-tight tabular-nums" style={{ color: BRAND }}>
              {fmt(dre.lucro_liquido)}
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold tabular-nums ${
              positivo ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
            }`}>
              {positivo ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {fmtPct(dre.delta_vs_anterior)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">vs mês anterior · Margem {dre.margem_pct.toFixed(1)}%</p>

          {/* Sparkline */}
          <Sparkline data={dre.spark} cor={BRAND} className="mt-4 h-12 w-full max-w-md" />
        </div>

        {/* LADO DIREITO — 3 KPIs em coluna */}
        <div className="grid grid-cols-3 lg:grid-cols-1 gap-3 lg:gap-2 lg:min-w-[200px]">
          <KpiMini label="Receita"     valor={fmt(dre.receita_bruta)} />
          <KpiMini label="Vendas"      valor={`${dre.total_vendas}`} sufixo="no mês" />
          <KpiMini label="Ticket médio" valor={fmt(dre.ticket_medio)} />
        </div>
      </div>
    </section>
  );
}

function KpiMini({ label, valor, sufixo }: { label: string; valor: string; sufixo?: string }) {
  return (
    <div className="rounded-2xl bg-muted/40 border border-border/60 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-base font-bold text-foreground tabular-nums leading-tight mt-0.5">{valor}</p>
      {sufixo && <p className="text-[10px] text-muted-foreground mt-0.5">{sufixo}</p>}
    </div>
  );
}

function Sparkline({ data, cor, className = '' }: { data: number[]; cor: string; className?: string }) {
  const { path, area } = useMemo(() => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const W = 100, H = 30;
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    const path = `M ${pts.join(' L ')}`;
    const area = `${path} L ${W},${H} L 0,${H} Z`;
    return { path, area };
  }, [data]);

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className}>
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={cor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-grad)" />
      <path d={path} fill="none" stroke={cor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Waterfall({ dre }: { dre: any }) {
  // Linhas do DRE — cada uma com seu valor absoluto pra escala visual
  const max = dre.receita_bruta;
  const linhas = [
    { label: 'Receita bruta',          valor: dre.receita_bruta,                    tipo: 'positivo' as const, destacar: true },
    { label: '(-) Taxas plataforma',   valor: -dre.taxas_plataforma,                tipo: 'negativo' as const },
    { label: '(-) Taxas gateway',      valor: -dre.taxas_gateway,                   tipo: 'negativo' as const },
    { label: '(-) Reembolsos',         valor: -dre.reembolsos,                      tipo: 'negativo' as const },
    { label: '(-) Impostos',           valor: -dre.impostos,                        tipo: 'negativo' as const },
    { label: 'Receita líquida',        valor: dre.receita_liquida,                  tipo: 'neutro' as const,   destacar: true },
    { label: '(-) Custos operacionais', valor: -dre.custos_total,                   tipo: 'negativo' as const },
    { label: 'LUCRO LÍQUIDO',          valor: dre.lucro_liquido,                    tipo: 'positivo' as const, destacar: true, total: true },
  ];

  return (
    <section className="rounded-3xl border border-border bg-card p-6 animate-fade-in" style={{ animationDelay: '120ms' }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-foreground tracking-tight">DRE — {periodoLabel(dre.periodo)}</h2>
          <p className="text-xs text-muted-foreground">Demonstração de Resultado do Exercício</p>
        </div>
        <Link href="#" className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors">
          Ver detalhado <ChevronRight size={12} />
        </Link>
      </div>

      <div className="space-y-1">
        {linhas.map(linha => {
          const pct = Math.abs(linha.valor) / max * 100;
          const cor = linha.tipo === 'positivo' ? BRAND : linha.tipo === 'negativo' ? RED : '#94a3b8';
          return (
            <div key={linha.label} className={`relative px-3 py-2.5 rounded-xl transition-colors ${
              linha.total ? 'bg-foreground/[0.04]' : ''
            }`}>
              {/* barra de fundo proporcional */}
              <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-7 rounded-md overflow-hidden pointer-events-none opacity-[0.07]">
                <div className="h-full" style={{ width: `${pct}%`, background: cor }} />
              </div>
              <div className="relative flex items-center justify-between gap-3">
                <span className={`text-sm tabular-nums ${
                  linha.destacar ? 'font-bold text-foreground' : 'text-muted-foreground'
                } ${linha.total ? 'uppercase tracking-wider text-xs' : ''}`}>
                  {linha.label}
                </span>
                <span className={`font-bold tabular-nums tracking-tight ${
                  linha.total ? 'text-xl' : 'text-sm'
                }`} style={{
                  color: linha.tipo === 'positivo' ? BRAND : linha.tipo === 'negativo' ? RED : 'inherit'
                }}>
                  {linha.valor < 0 ? '-' : ''}{fmt(Math.abs(linha.valor))}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CardPlataformas({ dre }: { dre: any }) {
  const lista: { plataforma: string; valor: number; vendas: number }[] = dre.por_plataforma || [];
  const total = lista.reduce((s, p) => s + (p.valor || 0), 0) || 1;
  return (
    <CardSecao titulo="Plataformas" subtitulo="Vendas por canal" icon={BarChart3} href="/negocios/integracoes">
      {lista.length === 0 ? (
        <EmptyMini msg="Nenhuma venda registrada no período." />
      ) : (
        <div className="space-y-3">
          {lista.map(p => {
            const pct = (p.valor / total) * 100;
            const cor = CORES_PLAT[p.plataforma] || '#94a3b8';
            const nome = NOME_PLAT[p.plataforma] || p.plataforma;
            return (
              <div key={p.plataforma}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cor }} />
                    <span className="text-sm font-semibold text-foreground truncate">{nome}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">· {p.vendas} vendas</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-foreground">{fmt(p.valor)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cor }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CardSecao>
  );
}

function CardProdutos({ dre }: { dre: any }) {
  const lista: { nome: string; valor: number; vendas: number }[] = dre.por_produto || [];
  return (
    <CardSecao titulo="Produtos" subtitulo="Top do mês" icon={Trophy} href="#">
      {lista.length === 0 ? (
        <EmptyMini msg="Nenhum produto vendido no período." />
      ) : (
        <div className="space-y-2.5">
          {lista.slice(0, 4).map((p, i) => (
            <div key={p.nome} className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-md bg-muted text-[10px] font-bold text-muted-foreground flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{p.nome}</p>
                <p className="text-[11px] text-muted-foreground">{p.vendas} {p.vendas === 1 ? 'venda' : 'vendas'}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold tabular-nums text-foreground">{fmt(p.valor)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardSecao>
  );
}

function EmptyMini({ msg }: { msg: string }) {
  return (
    <p className="text-xs text-muted-foreground italic py-4 text-center">{msg}</p>
  );
}

function CardMrr({ dre }: { dre: any }) {
  return (
    <CardSecao titulo="MRR · Receita recorrente" subtitulo="Mensal" icon={TrendingUp} href="#">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">{fmt(dre.mrr)}</span>
        <span className="text-xs font-bold text-green-600 tabular-nums">+12.4%</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">ARR projetado: <span className="font-semibold text-foreground tabular-nums">{fmt(dre.mrr * 12)}</span></p>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Ativos</p>
          <p className="text-base font-bold tabular-nums">38</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Novos</p>
          <p className="text-base font-bold tabular-nums text-green-600">+7</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Churn</p>
          <p className="text-base font-bold tabular-nums">2.1%</p>
        </div>
      </div>
    </CardSecao>
  );
}

function CardInsight() {
  return (
    <div className="rounded-2xl border bg-card p-5 animate-fade-in relative overflow-hidden"
         style={{ animationDelay: '240ms', borderColor: `${BRAND}40` }}>
      <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none opacity-30"
           style={{ background: `radial-gradient(circle at top right, ${BRAND} 0%, transparent 70%)` }} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={13} style={{ color: BRAND }} />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND }}>Sora IA</span>
        </div>
        <h3 className="text-base font-bold text-foreground tracking-tight mb-1">{MOCK_INSIGHT.titulo}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">{MOCK_INSIGHT.descricao}</p>
        <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-foreground bg-foreground/5 hover:bg-foreground/10 transition-colors">
          {MOCK_INSIGHT.acao} <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

function CardSecao({
  titulo, subtitulo, icon: Icon, href, children,
}: { titulo: string; subtitulo: string; icon: any; href: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: '180ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-muted-foreground" />
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight leading-none">{titulo}</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">{subtitulo}</p>
          </div>
        </div>
        <Link href={href} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 transition-colors">
          Ver tudo <ChevronRight size={11} />
        </Link>
      </div>
      {children}
    </div>
  );
}

function FuturoEmBreve() {
  const itens = [
    { icon: Receipt,    label: 'DRE detalhado',     desc: 'Drill-down linha-a-linha' },
    { icon: ShoppingBag, label: 'Vendas',           desc: 'Lista crua de eventos' },
    { icon: Zap,        label: 'Insights da IA',    desc: 'Feed de alertas' },
    { icon: Sparkles,   label: 'Wrapped',           desc: 'Resumo do mês compartilhável' },
  ];
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 animate-fade-in" style={{ animationDelay: '300ms' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Em breve nesta aba</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {itens.map(it => (
          <div key={it.label} className="flex items-start gap-2.5">
            <it.icon size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground leading-tight">{it.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaywallBlack() {
  return (
    <div className="max-w-2xl mx-auto pb-20 pt-12 px-4">
      <div className="relative overflow-hidden rounded-3xl bg-black text-white p-10 text-center">
        <div className="absolute inset-0 pointer-events-none opacity-40"
             style={{ background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${BRAND}30 0%, transparent 60%)` }} />
        <div className="relative">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
               style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' }}>
            <Crown size={28} className="text-black" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Negócios é exclusivo do plano Black</h1>
          <p className="text-white/70 text-sm sm:text-base leading-relaxed max-w-md mx-auto mb-6">
            Conecte Hotmart, Stripe e mais. Tenha seu DRE, fluxo de caixa e insights de IA em tempo real.
          </p>
          <Link href="/configuracoes" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-black shadow-lg"
                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' }}>
            <Crown size={15} /> Fazer upgrade
          </Link>
        </div>
      </div>
    </div>
  );
}

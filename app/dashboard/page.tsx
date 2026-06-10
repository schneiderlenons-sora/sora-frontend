'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import NovaTransacaoModal from '@/components/dashboard/NovaTransacaoModal';
import GrowResumo from '@/components/dashboard/GrowResumo';
import AvatarMembro from '@/components/ui/AvatarMembro';
import PermissaoGuard from '@/components/ui/PermissaoGuard';
import { api } from '@/lib/api';
import { getCategoriaTheme, nomeCategoria } from '@/lib/categorias';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import { temMarcaConhecida } from '@/components/ui/IconeMarca';
import {
  TrendingUp, TrendingDown, Plus, ArrowUpRight, ArrowDownRight,
  Wallet, MessageCircle, ChevronRight, Clock, BarChart3,
} from 'lucide-react';
import {
  AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

// ── Constantes ────────────────────────────────────────────────
const BRAND  = 'hsl(var(--primary))';
const BRAND2 = '#3dd68c';

const mesAtual    = new Date().toISOString().slice(0, 7);
const mesAnterior = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
  .toISOString().slice(0, 7);

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtShort = (v: number) =>
  v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : v > 0 ? `R$${v}` : 'R$0';

function pct(atual: number, anterior: number) {
  if (!anterior) return 0;
  return Math.round(((atual - anterior) / anterior) * 100);
}

function parseCategoria(cat: string) {
  const parts = (cat || '').split(' ');
  const hasEmoji = /\p{Emoji}/u.test(parts[0] || '');
  return { emoji: hasEmoji ? parts[0] : '📦', nome: hasEmoji ? parts.slice(1).join(' ') : cat };
}

function computeDailyCumulative(txs: any[], today: number) {
  const byDay: Record<number, number> = {};
  txs.forEach(tx => {
    const d = new Date(tx.data).getDate();
    byDay[d] = (byDay[d] || 0) + (tx.valor || 0);
  });
  let acc = 0;
  return Array.from({ length: Math.max(today, 1) }, (_, i) => {
    acc += byDay[i + 1] || 0;
    return { dia: String(i + 1), atual: acc };
  });
}

// ── Tooltip customizado ────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 shadow-xl text-sm min-w-[150px] border border-border/60"
         style={{ background: 'hsl(var(--bg-card))' }}>
      <p className="font-semibold text-foreground mb-1.5 text-xs">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="text-xs flex items-center justify-between gap-3">
          <span>{p.name}</span>
          <span className="font-bold tabular">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}


// ── Badge de variação ─────────────────────────────────────────
function VarBadge({ val, invert = false, size = 'sm' }: { val: number; invert?: boolean; size?: 'sm' | 'lg' }) {
  const isGood = invert ? val <= 0 : val >= 0;
  const cls = size === 'lg'
    ? 'text-sm px-3 py-1 rounded-full font-semibold inline-flex items-center gap-1'
    : 'text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1';
  return (
    <span className={`${cls} ${isGood
      ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
      : 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
    }`}>
      {isGood ? <ArrowDownRight size={size === 'lg' ? 14 : 11} /> : <ArrowUpRight size={size === 'lg' ? 14 : 11} />}
      {Math.abs(val)}% vs mês ant.
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { phone, perfil } = useAuth();

  const [resumo,    setResumo]    = useState<any>({ receitas: 0, gastos: 0, por_categoria: [] });
  const [resumoAnt, setResumoAnt] = useState<any>({ receitas: 0, gastos: 0, por_categoria: [] });
  const [wallets,   setWallets]   = useState<any[]>([]);
  const [txs,       setTxs]       = useState<any[]>([]);
  const [txsMes,    setTxsMes]    = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const hoje        = new Date();
  const today       = hoje.getDate();
  const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const monthName   = hoje.toLocaleDateString('pt-BR', { month: 'long' });
  const primeiroNome = perfil?.name?.split(' ')[0] || 'amigo';

  const carregar = useCallback(async () => {
    if (!phone) return;
    // Paraleliza tudo — antes eram 6 awaits sequenciais (cada um esperando
    // o anterior) que somavam ~3-6s. Agora roda em paralelo e cada erro é
    // isolado: se a categorias falha as outras 5 ainda preenchem.
    const [r, rAnt, w, tRec, tMes, cats] = await Promise.allSettled([
      api.transacoes.resumo(phone, mesAtual),
      api.transacoes.resumo(phone, mesAnterior),
      api.wallets.listar(phone),
      api.transacoes.listar(phone, { limit: 8 }),
      api.transacoes.listar(phone, { mes: mesAtual, tipo: 'Gasto', limit: 500 }),
      api.categorias.listar(phone),
    ]);
    if (r.status    === 'fulfilled') setResumo(r.value);
    if (rAnt.status === 'fulfilled') setResumoAnt(rAnt.value);
    if (w.status    === 'fulfilled') setWallets(w.value);
    if (tRec.status === 'fulfilled') setTxs(tRec.value.transacoes || []);
    if (tMes.status === 'fulfilled') setTxsMes(tMes.value.transacoes || []);
    if (cats.status === 'fulfilled') setCategorias(cats.value || []);
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Métricas (memoizadas — só recalculam quando os dados mudam) ──
  const saldoTotal  = useMemo(
    () => wallets.filter(w => w.tipo !== 'Crédito').reduce((s, w) => s + (w.saldo||0), 0),
    [wallets]
  );
  const varReceitas = useMemo(() => pct(resumo?.receitas||0, resumoAnt?.receitas||0), [resumo, resumoAnt]);
  const varGastos   = useMemo(() => pct(resumo?.gastos||0,   resumoAnt?.gastos||0),   [resumo, resumoAnt]);
  const economia    = (resumo?.receitas||0) - (resumo?.gastos||0);
  const maiorCat    = resumo?.por_categoria?.[0];
  const temDados    = (resumo?.gastos||0) > 0 || (resumo?.receitas||0) > 0;

  // Ritmo de gastos — curva acumulada este mês vs mês anterior (linear)
  const dadosRitmoBase = computeDailyCumulative(txsMes, today);
  const gastoAntTotal  = resumoAnt?.gastos || 0;
  const dadosRitmo = dadosRitmoBase.map((d, i) => ({
    ...d,
    anterior: gastoAntTotal > 0 ? Math.round((gastoAntTotal / daysInMonth) * (i + 1)) : 0,
  }));

  // Categorias com percentual + cor real (customizada pelo usuário > catálogo > hash)
  const cats = (resumo?.por_categoria||[]) as any[];
  const totalGastos = resumo?.gastos || 0;
  const catsComPct = cats.slice(0, 7).map((c: any) => {
    const theme = getCategoriaTheme(c.categoria || '', categorias);
    return {
      ...c,
      pct: totalGastos > 0 ? Math.round((c.total / totalGastos) * 100) : 0,
      color: theme.color,
      emoji: theme.emoji,
    };
  });


  // Insight personalizado
  const insight = temDados && maiorCat
    ? `Seu maior gasto em ${monthName} foi em ${maiorCat.categoria}${
        totalGastos ? `, ${Math.round((maiorCat.total/totalGastos)*100)}% do total` : ''
      }. ${varGastos > 0
        ? `Você gastou ${varGastos}% a mais que o mês passado.`
        : varGastos < 0
          ? `Ótimo — ${Math.abs(varGastos)}% a menos que o mês anterior!`
          : 'Gastos estáveis em relação ao mês anterior.'}`
    : `Olá, ${primeiroNome}! Registre seus gastos pelo WhatsApp para receber insights personalizados aqui.`;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-28 space-y-5">

        {/* ══════════════════════════════════════════════════════
            HERO ROW — Insight + Ritmo de gastos
        ══════════════════════════════════════════════════════ */}
        <div className="grid lg:grid-cols-5 gap-5">

          {/* ── AI Insight Card ──────────────────────────────── */}
          <div
            className="insight-hero lg:col-span-3 relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in"
          >

            {/* Halos decorativos apenas no light mode (toque verde da Sora) */}
            <div className="dark:hidden absolute -top-16 -left-16 w-64 h-64 rounded-full pointer-events-none opacity-30"
                 style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 70%)` }} />
            <div className="dark:hidden absolute bottom-0 right-0 w-48 h-48 rounded-full pointer-events-none opacity-20"
                 style={{ background: `radial-gradient(circle, ${BRAND2} 0%, transparent 70%)` }} />

            <div className="relative space-y-5">
              {/* Header — apenas data */}
              <div className="flex items-center justify-end">
                <span className="text-muted-foreground text-xs">
                  {hoje.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                </span>
              </div>

              {/* Texto de insight */}
              <div>
                <p className="text-2xl sm:text-3xl font-bold leading-snug mb-2" style={{ color: BRAND }}>
                  {temDados
                    ? `Olá, ${primeiroNome}! Veja como estão suas finanças`
                    : `Bem-vindo, ${primeiroNome}!`}
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
                  {temDados
                    ? insight
                    : 'Registre seus gastos pelo WhatsApp ou pelo Painel para receber insights personalizados aqui.'}
                </p>
              </div>

              {/* Mini stats */}
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                <div className="min-w-0 rounded-2xl p-3 sm:p-3.5 backdrop-blur-sm bg-white/60 dark:bg-white/5 border border-border/40 dark:border-white/10">
                  <p className="text-muted-foreground/70 dark:text-muted-foreground text-[9px] sm:text-[10px] uppercase tracking-wider font-medium mb-1 leading-tight">
                    Gasto em {monthName.slice(0,3)}
                  </p>
                  <p className="text-foreground font-bold text-sm sm:text-base tabular leading-tight truncate">{fmt(resumo?.gastos||0)}</p>
                </div>
                <div className="min-w-0 rounded-2xl p-3 sm:p-3.5 backdrop-blur-sm bg-white/60 dark:bg-white/5 border border-border/40 dark:border-white/10">
                  <p className="text-muted-foreground/70 dark:text-muted-foreground text-[9px] sm:text-[10px] uppercase tracking-wider font-medium mb-1 leading-tight">
                    VS mês anterior
                  </p>
                  <p className={`font-bold text-sm sm:text-base mt-0.5 tabular leading-tight truncate ${
                    !resumoAnt?.gastos
                      ? 'text-muted-foreground'
                      : varGastos > 0
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-green-600 dark:text-green-400'
                  }`}>
                    {resumoAnt?.gastos ? (varGastos > 0 ? '+' : '') + varGastos + '%' : '—'}
                  </p>
                </div>
                <div className="min-w-0 rounded-2xl p-3 sm:p-3.5 backdrop-blur-sm bg-white/60 dark:bg-white/5 border border-border/40 dark:border-white/10">
                  <p className="text-muted-foreground/70 dark:text-muted-foreground text-[9px] sm:text-[10px] uppercase tracking-wider font-medium mb-1 leading-tight">
                    Maior gasto
                  </p>
                  <p className="text-foreground font-bold text-sm mt-0.5 truncate leading-tight">
                    {maiorCat ? parseCategoria(maiorCat.categoria).nome : '—'}
                  </p>
                </div>
              </div>

              {/* CTA WhatsApp */}
              <button className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] w-fit shadow-glow-sm"
                      style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND2})` }}>
                <MessageCircle size={16} className="text-white" />
                Conversar com a Sora
              </button>
            </div>
          </div>

          {/* ── Ritmo de Gastos ──────────────────────────────── */}
          <div className="lg:col-span-2 card rounded-3xl p-6 flex flex-col animate-fade-in" style={{ animationDelay: '60ms' }}>
            <div className="flex items-start justify-between mb-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Ritmo de Gastos
              </p>
              {resumoAnt?.gastos ? <VarBadge val={varGastos} invert /> : null}
            </div>
            <p className="text-3xl sm:text-4xl lg:text-5xl font-bold tabular tracking-tight text-foreground mt-1 truncate leading-tight">
              {fmt(resumo?.gastos||0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              acumulado em {monthName}
            </p>

            <div className="flex-1 min-h-0" style={{ height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dadosRitmo} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRitmoArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={BRAND}  stopOpacity={0.5} />
                      <stop offset="50%"  stopColor={BRAND2} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={BRAND}  stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gRitmoStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor={BRAND}  />
                      <stop offset="100%" stopColor={BRAND2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false}
                         tickFormatter={v => Number(v) % 10 === 1 ? v : ''} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="anterior"
                    name="Mês anterior"
                    stroke="hsl(var(--fg-muted))"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    fill="none"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="atual"
                    name="Este mês"
                    stroke="url(#gRitmoStroke)"
                    strokeWidth={2.5}
                    fill="url(#gRitmoArea)"
                    dot={false}
                    activeDot={{ r: 4, fill: BRAND, stroke: 'white', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/60">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 rounded-full" style={{ background: BRAND }} />
                <span className="text-xs text-muted-foreground">Este mês</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 border-t border-dashed border-muted-foreground/60" />
                <span className="text-xs text-muted-foreground">Mês anterior</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            4 STAT CARDS
        ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Saldo Total',
              value: fmt(saldoTotal),
              sub: `${wallets.filter(w=>w.tipo!=='Crédito').length} conta(s)`,
              icon: Wallet,
              iconColor: BRAND,
              valueColor: BRAND,
            },
            {
              label: 'Receitas',
              value: fmt(resumo?.receitas||0),
              badge: <VarBadge val={varReceitas} />,
              icon: TrendingUp,
              iconColor: BRAND,
            },
            {
              label: 'Gastos',
              value: fmt(resumo?.gastos||0),
              badge: <VarBadge val={varGastos} invert />,
              icon: TrendingDown,
              iconColor: '#ef4444',
              valueColor: '#ef4444',
            },
            {
              label: 'Economia',
              value: fmt(economia),
              sub: 'receitas − gastos',
              icon: BarChart3,
              iconColor: economia >= 0 ? BRAND : '#ef4444',
              valueColor: economia >= 0 ? BRAND : '#ef4444',
            },
          ].map((card, i) => (
            <div key={i}
                 className="card rounded-2xl p-5 relative overflow-hidden animate-fade-in"
                 style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {card.label}
                </p>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                     style={{ background: `color-mix(in srgb, ${card.iconColor} 9%, transparent)` }}>
                  <card.icon size={15} style={{ color: card.iconColor }} />
                </div>
              </div>
              <p className="text-lg sm:text-2xl font-bold tabular tracking-tight truncate leading-tight"
                 style={{ color: card.valueColor || 'hsl(var(--fg))' }}>
                {card.value}
              </p>
              <div className="mt-1.5">
                {card.badge || (
                  <p className="text-xs text-muted-foreground">
                    {card.sub}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════
            SORA GROW — seu dia (hábitos, tarefas, bem-estar, agenda)
        ══════════════════════════════════════════════════════ */}
        <GrowResumo />

        {/* ══════════════════════════════════════════════════════
            CATEGORIAS
        ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 gap-5">

          {/* ── Principais Categorias ───────────────────────── */}
          <div className="card rounded-3xl p-6 animate-fade-in" style={{ animationDelay: '120ms' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
                  Categorias
                </p>
                <p className="text-base font-bold text-foreground">Principais gastos</p>
              </div>
              <a href="/relatorios" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                Ver todas <ChevronRight size={12} />
              </a>
            </div>

            {catsComPct.length > 0 ? (
              <div className="space-y-3.5">
                {catsComPct.map((c: any, i: number) => {
                  const nome = nomeCategoria(c.categoria);
                  return (
                    <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                            style={{ background: `color-mix(in srgb, ${c.color} 13%, transparent)` }}
                          >
                            {c.emoji}
                          </span>
                          <span className="font-medium text-foreground truncate">{nome}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-muted-foreground tabular">{fmt(c.total)}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: `color-mix(in srgb, ${c.color} 13%, transparent)`, color: c.color }}>
                            {c.pct}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                             style={{ width: `${c.pct}%`, background: c.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
                  <BarChart3 size={20} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Sem categorias ainda</p>
                <p className="text-xs text-muted-foreground mt-1">Registre gastos pelo WhatsApp</p>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            TRANSAÇÕES RECENTES
        ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 gap-5">

          {/* ── Transações Recentes ──────────────────────────── */}
          {/* min-w-0: sem isso, o item do grid cresce até o conteúdo (min-w da
              lista) e o card estoura a tela. overflow-hidden mantém o scroll
              horizontal contido dentro do card (igual à aba Transações). */}
          <div className="card rounded-3xl p-6 lg:col-span-2 min-w-0 overflow-hidden animate-fade-in" style={{ animationDelay: '140ms' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
                  Transações
                </p>
                <p className="text-base font-bold text-foreground">Recentes</p>
              </div>
              <a href="/transacoes" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                Ver todas <ChevronRight size={12} />
              </a>
            </div>

            {txs.length > 0 ? (
              // Mobile: a lista inteira rola junto na horizontal (min-width único)
              // pra data/banco não se espremerem. Desktop: cabe sem rolar.
              <div className="overflow-x-auto scrollbar-none -mx-2 px-2">
              <div className="space-y-1.5 min-w-[480px] sm:min-w-0">
                {txs.map((tx, i) => {
                  const isGasto   = tx.tipo === 'Gasto';
                  const { emoji, nome } = parseCategoria(tx.categoria || '');
                  // Ícone: prioriza a marca da descrição (ex.: "Shopee", "Spotify")
                  const iconeNome = tx.observacao && temMarcaConhecida(tx.observacao) ? tx.observacao : nome;
                  return (
                    <div key={tx.id}
                         className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors animate-fade-in group"
                         style={{ animationDelay: `${i * 30}ms` }}>
                      {/* Ícone de categoria — usa logo oficial se for marca conhecida */}
                      <CategoriaIcon
                        nome={iconeNome}
                        icone={emoji}
                        bg={isGasto ? '#ef444418' : `color-mix(in srgb, ${BRAND} 9%, transparent)`}
                        color={isGasto ? '#ef4444' : BRAND}
                        size={36}
                      />

                      {/* Descrição + categoria */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {tx.observacao || nome}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(tx.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </span>
                          {tx.wallet_nome && (
                            <>
                              <span className="text-muted-foreground/40 text-xs">·</span>
                              <span className="text-xs text-muted-foreground truncate max-w-[160px]">{tx.wallet_nome}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Avatar do criador */}
                      {tx.criador?.name && (
                        <AvatarMembro name={tx.criador.name} size="sm" />
                      )}

                      {/* Valor + status */}
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold tabular ${isGasto ? 'text-red-500' : 'text-green-500'}`}>
                          {isGasto ? '-' : '+'}{fmt(tx.valor)}
                        </p>
                        <span className={`text-[10px] font-medium ${
                          tx.pago
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-yellow-600 dark:text-yellow-400'
                        }`}>
                          {tx.pago ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                     style={{ background: `color-mix(in srgb, ${BRAND} 9%, transparent)` }}>
                  <Clock size={22} style={{ color: BRAND }} />
                </div>
                <p className="font-semibold text-foreground">Nenhuma transação ainda</p>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-[220px] leading-relaxed">
                  Envie um gasto pelo WhatsApp para ver aqui.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          FAB — Nova Transação (só com permissão de escrita)
      ══════════════════════════════════════════════════════ */}
      <PermissaoGuard>
        <button
          onClick={() => setModalOpen(true)}
          className="fixed right-4 sm:right-6 flex items-center gap-2 px-5 py-3.5 rounded-2xl z-40 text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95 shadow-glow"
          style={{
            background: `linear-gradient(135deg, ${BRAND}, ${BRAND2})`,
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
          }}
        >
          <Plus size={18} />
          Nova transação
        </button>
      </PermissaoGuard>

      {modalOpen && (
        <NovaTransacaoModal
          phone={phone}
          wallets={wallets}
          onClose={() => setModalOpen(false)}
          onSuccess={carregar}
        />
      )}
    </DashboardLayout>
  );
}

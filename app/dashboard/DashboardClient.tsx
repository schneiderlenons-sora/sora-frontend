'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useApi } from '@/lib/useApi';
import { useVisivel } from '@/lib/useVisivel';
import { useAuth } from '@/contexts/AuthContext';
import KitUpsellBanner from '@/components/kit/KitUpsellBanner';
import NovaTransacaoModal from '@/components/dashboard/NovaTransacaoModal';
import ResumoCards from '@/components/dashboard/ResumoCards';
import GrowResumo from '@/components/dashboard/GrowResumo';
import GrowHabitosCard from '@/components/dashboard/GrowHabitosCard';
import AvatarMembro from '@/components/ui/AvatarMembro';
import PermissaoGuard from '@/components/ui/PermissaoGuard';
import { api } from '@/lib/api';
import { getCategoriaTheme, nomeCategoria } from '@/lib/categorias';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import { temMarcaConhecida } from '@/components/ui/IconeMarca';
import {
  TrendingUp, TrendingDown, Plus, ArrowUpRight, ArrowDownRight,
  Wallet, ChevronRight, Clock, BarChart3,
} from 'lucide-react';
// ⚠️ recharts NÃO entra aqui. Importado estático, ele ia pro bundle inicial
// (~288 KB) e, como o <Link> do Next faz prefetch das rotas da sidebar (que
// também usam gráfico), o dashboard chegava a baixar 3 cópias — 864 KB antes
// de desenhar um pixel. Carregado sob demanda, vira um chunk compartilhado.
const GraficoGastos = dynamic(() => import('@/components/dashboard/GraficoGastos'), {
  ssr: false,
  loading: () => (
    <div className="w-full rounded-xl bg-muted/40 animate-pulse" style={{ height: 220 }}
         role="status" aria-label="Carregando gráfico" />
  ),
});

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

// Gasto NÃO acumulado — cada dia só com o que foi efetivamente gasto nele.
function computeDailyAmount(txs: any[], today: number) {
  const byDay: Record<number, number> = {};
  txs.forEach(tx => {
    const d = new Date(tx.data).getDate();
    byDay[d] = (byDay[d] || 0) + (tx.valor || 0);
  });
  return Array.from({ length: Math.max(today, 1) }, (_, i) => ({
    dia: String(i + 1),
    valor: byDay[i + 1] || 0,
  }));
}

// (o Tooltip do gráfico mora em components/dashboard/GraficoGastos.tsx —
//  ficar aqui obrigaria a página a importar recharts de novo)

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

// Busca consolidada do dashboard: tenta o endpoint único e, se ele falhar
// (backend ainda atualizando, erro, etc.), cai automaticamente nas 6 chamadas
// antigas — mesma forma de dado. Garante que o painel nunca quebra.
async function fetchDashboard(phone: string, mes: string, mesAnt: string) {
  try {
    const d = await api.dashboard.get(phone, mes, mesAnt);
    if (d && d.resumo) return d;
    throw new Error('forma inesperada');
  } catch {
    const [r, rAnt, w, tRec, tMes, cats] = await Promise.allSettled([
      api.transacoes.resumo(phone, mes),
      api.transacoes.resumo(phone, mesAnt),
      api.wallets.listar(phone),
      api.transacoes.listar(phone, { limit: 8, ate: new Date().toISOString() }),
      api.transacoes.listar(phone, { mes, tipo: 'Gasto', limit: 500 }),
      api.categorias.listar(phone),
    ]);
    const v = (x: PromiseSettledResult<any>, def: any) => (x.status === 'fulfilled' ? x.value : def);
    return {
      resumo:     v(r,    { receitas: 0, gastos: 0, por_categoria: [] }),
      resumoAnt:  v(rAnt, { receitas: 0, gastos: 0, por_categoria: [] }),
      wallets:    v(w, []),
      txsRec:     v(tRec, { transacoes: [], total: 0 }),
      txsMes:     v(tMes, { transacoes: [], total: 0 }),
      categorias: v(cats, []),
    };
  }
}

// ─────────────────────────────────────────────────────────────
export default function DashboardClient({ phoneInicial, initialData }: { phoneInicial?: string; initialData?: any } = {}) {
  const { phone: authPhone, perfil, temAcessoGrow } = useAuth();
  // SSR: usa o phone vindo do servidor até a sessão hidratar no cliente, pra a
  // chave do SWR já ser válida no 1º render (e o fallbackData pintar na hora).
  const phone = authPhone || phoneInicial || '';

  const [modalOpen, setModalOpen] = useState(false);
  const [chartMode, setChartMode] = useState<'area'|'bar'>('area');
  // Qual mini-stat do hero está expandido (mobile mostra valor truncado; toque
  // abre o valor completo num painel abaixo). Um por vez.
  const [statExpandido, setStatExpandido] = useState<'gasto'|'vs'|'maior'|null>(null);

  const hoje        = new Date();
  const today       = hoje.getDate();
  const monthName   = hoje.toLocaleDateString('pt-BR', { month: 'long' });
  const monthNameAnt = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long' });
  const primeiroNome = perfil?.name?.split(' ')[0] || 'amigo';
  // Em grupo compartilhado (não-Pessoal), mostra o avatar de quem fez cada lançamento.
  const compartilhado = !/pessoal/i.test((perfil?.grupo_ativo as any)?.nome || '');

  // ── Dados via SWR: 1 chamada consolidada (com fallback automático pras 6
  // antigas). Cache em memória compartilhado → revisitar o dashboard é
  // instantâneo (mostra o último dado e revalida em silêncio, sem flash).
  const { data, mutate: revalidarDados } = useApi(
    phone ? `dash:all:${phone}:${mesAtual}` : null,
    () => fetchDashboard(phone, mesAtual, mesAnterior),
    { fallbackData: initialData },  // SSR: HTML já chega pintado com esse dado
  );

  // A chamada principal já respondeu? É ela que o LCP espera — todo o resto
  // (cards do Grow, recharts) só pode ir pra fila DEPOIS, senão disputa banda
  // e CPU justamente na janela que decide a métrica.
  const pronto = !!data;
  const { ref: graficoRef, visivel: graficoVisivel } = useVisivel<HTMLDivElement>(pronto);

  const resumo:    any   = data?.resumo    ?? { receitas: 0, gastos: 0, por_categoria: [] };
  const resumoAnt: any   = data?.resumoAnt ?? { receitas: 0, gastos: 0, por_categoria: [] };
  const wallets:   any[] = data?.wallets   ?? [];
  const txs:       any[] = data?.txsRec?.transacoes ?? [];
  const txsMes:    any[] = data?.txsMes?.transacoes ?? [];
  const categorias: any[] = data?.categorias ?? [];

  // Revalida o dashboard (ex.: após criar uma transação no modal).
  const revalidar = useCallback(() => { revalidarDados(); }, [revalidarDados]);

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

  // Fluxo de caixa — gasto por dia (não acumulado), pro gráfico de área.
  // Memoizado: percorre até 500 transações; sem isso recalcula a cada toggle.
  const dadosDiarios = useMemo(
    // Exclui pagamento de fatura/transferência (não é consumo) — consistente com o total.
    () => computeDailyAmount(txsMes.filter(t => !t.transferencia && t.categoria !== 'Fatura cartão' && t.categoria !== 'Transferências'), today),
    [txsMes, today]);

  // Categorias com percentual + cor real (customizada pelo usuário > catálogo > hash)
  const totalGastos = resumo?.gastos || 0;
  const catsComPct = useMemo(() => {
    const cats = (resumo?.por_categoria || []) as any[];
    return cats.slice(0, 7).map((c: any) => {
      const theme = getCategoriaTheme(c.categoria || '', categorias);
      return {
        ...c,
        pct: totalGastos > 0 ? Math.round((c.total / totalGastos) * 100) : 0,
        color: theme.color,
        emoji: theme.emoji,
      };
    });
  }, [resumo, categorias, totalGastos]);


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

  // Card "Fluxo de Caixa" — gasto por dia (Área) ou por categoria (Barra).
  // Extraído pra poder ir ao hero (sem Grow) ou à linha do Grow (ao lado de
  // "Próximos eventos"). Sem col-span: quem posiciona é o wrapper.
  // Memoizado: identidade estável evita re-render do <GrowResumo> a cada toggle.
  const fluxoCard = useMemo(() => (
    <div className="card rounded-3xl p-6 flex flex-col h-full animate-fade-in" style={{ animationDelay: '60ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
            Fluxo de Caixa
          </p>
          <p className="text-base font-bold text-foreground">
            {chartMode === 'area' ? `Gastos por dia — ${monthName}` : `Por categoria — ${monthName}`}
          </p>
        </div>
        <div className="flex gap-1 bg-muted/60 rounded-xl p-1">
          {(['area', 'bar'] as const).map(m => (
            <button key={m} onClick={() => setChartMode(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                chartMode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {m === 'area' ? 'Área' : 'Barra'}
            </button>
          ))}
        </div>
      </div>

      {/* Só baixa o recharts (~288 KB) quando o gráfico chega perto da tela —
          no mobile ele nasce abaixo da dobra. O skeleton tem a MESMA altura,
          então não há pulo de layout. */}
      <div ref={graficoRef} className="flex-1 flex items-center" style={{ minHeight: 220 }}>
        {graficoVisivel ? (
          <GraficoGastos
            modo={chartMode}
            barras={catsComPct.map((c: any) => ({
              name:   parseCategoria(c.categoria).nome.slice(0, 10),
              gastos: c.total,
              color:  c.color,
            }))}
            area={dadosDiarios}
          />
        ) : (
          <div className="w-full rounded-xl bg-muted/40 animate-pulse" style={{ height: 220 }}
               role="status" aria-label="Carregando gráfico" />
        )}
      </div>

      <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border/60">
        {chartMode === 'area'
          ? <>Quanto você gastou em cada dia de {monthName}. Toque em <strong className="text-foreground">Barra</strong> pra ver por categoria.</>
          : <>Total gasto por categoria em {monthName}. Toque em <strong className="text-foreground">Área</strong> pra ver o dia a dia.</>}
      </p>
    </div>
  ), [chartMode, dadosDiarios, catsComPct, monthName, graficoVisivel, graficoRef]);

  // O DashboardLayout (sidebar) agora vem do layout do segmento (layout.tsx),
  // pra persistir entre o loading.tsx e a página (sem remontar a sidebar).
  return (
    <>
      <div className="max-w-7xl mx-auto pb-28 space-y-5">

        {/* Upsell do Kit → Completa (só aparece pra quem tem o Kit) */}
        <KitUpsellBanner />

        {/* ══════════════════════════════════════════════════════
            HERO ROW — Insight + Hábitos de hoje (Grow)
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

              {/* Mini stats — no mobile o valor é truncado; toque expande o
                  valor completo num painel abaixo (um por vez). */}
              {(() => {
                const chips = [
                  {
                    key: 'gasto' as const,
                    label: `Gasto em ${monthName.slice(0, 3)}`,
                    valor: fmt(resumo?.gastos || 0),
                    cls: 'text-foreground',
                    full: (
                      <p className="text-foreground font-bold text-2xl tabular tracking-tight">{fmt(resumo?.gastos || 0)}</p>
                    ),
                  },
                  {
                    key: 'vs' as const,
                    label: 'VS mês anterior',
                    valor: resumoAnt?.gastos ? (varGastos > 0 ? '+' : '') + varGastos + '%' : '—',
                    cls: !resumoAnt?.gastos
                      ? 'text-muted-foreground'
                      : varGastos > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400',
                    full: resumoAnt?.gastos ? (
                      <>
                        <p className={`font-bold text-2xl tabular tracking-tight ${varGastos > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {(varGastos > 0 ? '+' : '') + varGastos}% {varGastos > 0 ? 'a mais' : varGastos < 0 ? 'a menos' : 'igual'}
                        </p>
                        <p className="text-muted-foreground text-sm mt-1">
                          De {fmt(resumoAnt.gastos)} ({monthNameAnt}) para {fmt(resumo?.gastos || 0)} ({monthName})
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm">Sem dados de {monthNameAnt} pra comparar ainda.</p>
                    ),
                  },
                  {
                    key: 'maior' as const,
                    label: 'Maior gasto',
                    valor: maiorCat ? parseCategoria(maiorCat.categoria).nome : '—',
                    cls: 'text-foreground',
                    full: maiorCat ? (
                      <>
                        <p className="text-foreground font-bold text-2xl tracking-tight">{parseCategoria(maiorCat.categoria).nome}</p>
                        <p className="text-muted-foreground text-sm mt-1">
                          {fmt(maiorCat.total)}{totalGastos ? ` · ${Math.round((maiorCat.total / totalGastos) * 100)}% do total de ${monthName}` : ''}
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm">Nenhum gasto registrado em {monthName} ainda.</p>
                    ),
                  },
                ];
                const aberto = chips.find((c) => c.key === statExpandido);
                return (
                  <div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                      {chips.map((c) => {
                        const on = statExpandido === c.key;
                        return (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() => setStatExpandido((p) => (p === c.key ? null : c.key))}
                            aria-expanded={on}
                            aria-label={`${c.label}: ${c.valor}. Toque para ${on ? 'recolher' : 'ver completo'}`}
                            className={`min-w-0 text-left rounded-2xl p-3 sm:p-3.5 backdrop-blur-sm border transition-all active:scale-[0.98] ${
                              on
                                ? 'bg-white/90 dark:bg-white/10 border-[#61D17B]/60 ring-1 ring-[#61D17B]/40'
                                : 'bg-white/60 dark:bg-white/5 border-border/40 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/10'
                            }`}
                          >
                            <span className="flex items-center gap-1 mb-1">
                              <span className="text-muted-foreground/70 dark:text-muted-foreground text-[9px] sm:text-[10px] uppercase tracking-wider font-medium leading-tight truncate">
                                {c.label}
                              </span>
                              <ChevronRight size={11} className={`flex-shrink-0 text-muted-foreground/60 transition-transform ${on ? 'rotate-90' : ''}`} />
                            </span>
                            <span className={`block font-bold text-sm sm:text-base tabular leading-tight truncate ${c.cls}`}>
                              {c.valor}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {/* Painel expandido — valor completo, largura total, sem corte */}
                    <div
                      className="grid transition-all duration-300 ease-out"
                      style={{ gridTemplateRows: aberto ? '1fr' : '0fr', opacity: aberto ? 1 : 0 }}
                    >
                      <div className="overflow-hidden">
                        {aberto && (
                          <div className="mt-2 rounded-2xl p-4 backdrop-blur-sm bg-white/70 dark:bg-white/5 border border-border/40 dark:border-white/10 animate-fade-in">
                            <p className="text-muted-foreground/70 dark:text-muted-foreground text-[10px] uppercase tracking-wider font-medium mb-1.5">
                              {aberto.label}
                            </p>
                            {aberto.full}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* CTA — Nova transação (só com permissão de escrita) */}
              <PermissaoGuard>
                <button onClick={() => setModalOpen(true)}
                        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] w-fit shadow-glow-sm"
                        style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND2})` }}>
                  <Plus size={16} className="text-white" />
                  Nova transação
                </button>
              </PermissaoGuard>
            </div>
          </div>

          {/* ── Hábitos de hoje (Grow) no topo — ou Ritmo se sem Grow ── */}
          <div className="lg:col-span-2">
            {temAcessoGrow ? <GrowHabitosCard pronto={pronto} /> : fluxoCard}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            4 STAT CARDS (Saldo · Receitas · Gastos · Cartões)
            — Saldo/Gastos/Cartões expandem num painel abaixo do grid.
        ══════════════════════════════════════════════════════ */}
        <ResumoCards
          wallets={wallets}
          txsMes={txsMes}
          resumo={resumo}
          saldoTotal={saldoTotal}
          varReceitas={varReceitas}
          varGastos={varGastos}
          phone={phone}
        />

        {/* ══════════════════════════════════════════════════════
            SORA GROW — seu dia (hábitos, tarefas, bem-estar, agenda)
        ══════════════════════════════════════════════════════ */}
        <GrowResumo ritmoSlot={fluxoCard} pronto={pronto} />

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
                          {/* Usa logo oficial pra marcas conhecidas (Shein, iFood, Uber…) */}
                          <CategoriaIcon
                            nome={nome}
                            icone={c.emoji}
                            bg={`color-mix(in srgb, ${c.color} 13%, transparent)`}
                            color={c.color}
                            size={24}
                            rounded="rounded-lg"
                          />
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
                  const { emoji: emojiProprio, nome } = parseCategoria(tx.categoria || '');
                  // Emoji da categoria: se o nome já traz um emoji próprio (ex.:
                  // categoria custom "🎸 Música"), usa ele; senão resolve pelo
                  // catálogo via nome (categorias sem emoji — manuais, WhatsApp,
                  // OFX, Open Finance — caíam no 📦 com o parse simples).
                  const temEmojiProprio = /\p{Emoji}/u.test((tx.categoria || '').trim().split(' ')[0] || '');
                  const emoji = temEmojiProprio ? emojiProprio : getCategoriaTheme(tx.categoria || '', categorias).emoji;
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

                      {/* Avatar de quem lançou (só em grupo compartilhado) */}
                      {compartilhado && tx.criador?.name && (
                        <AvatarMembro
                          name={tx.criador.name}
                          src={tx.criador.avatar_url}
                          preset={tx.criador.avatar_preset}
                          cor={tx.criador.avatar_cor}
                          size="sm"
                        />
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

      {/* O "+" de atalhos e o menu agora vivem no BottomNav global (mobile). */}
      {modalOpen && (
        <NovaTransacaoModal
          phone={phone}
          wallets={wallets}
          onClose={() => setModalOpen(false)}
          onSuccess={revalidar}
        />
      )}
    </>
  );
}

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { chave } from '@/lib/chaves-swr';
import { useApi } from '@/lib/useApi';
import EditarLimiteGeralModal from '@/components/limites/EditarLimiteGeralModal';
import LimiteCategoriaModal from '@/components/limites/LimiteCategoriaModal';
import { nomeCategoria } from '@/lib/categorias';
import { gastoComFilhas, indexarGastos, chaveCategoria } from '@/lib/limite-categoria';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import {
  Plus, Sparkles, Pencil, Trash2, Target, Bell, BellOff,
  AlertCircle, Wallet, ChevronRight, CalendarDays, CalendarRange, TrendingUp,
} from 'lucide-react';
import { useValores } from '@/lib/valores-ocultos';
import BotaoOlhoValores from '@/components/ui/BotaoOlhoValores';
import { useDinheiro } from '@/lib/moeda-base';
import useSWR from 'swr';
import dynamic from 'next/dynamic';

// ⚠️ recharts (~288 KB + d3) NUNCA entra no bundle da página. Ele mora em
// componente próprio e vem por dynamic + ssr:false, com skeleton da MESMA
// altura (260px) — skeleton de altura diferente dá salto de layout quando o
// dado chega. Regra do CLAUDE.md, não preferência.
const GraficoAno = dynamic(() => import('@/components/limites/GraficoAno'), {
  ssr: false,
  loading: () => <div className="w-full rounded-xl bg-muted/40 animate-pulse" style={{ height: 260 }} />,
});

const BRAND = 'hsl(var(--primary))';

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
/** '2026-09' → 'Setembro de 2026'. Sem `new Date`: a string já é o mês. */
const rotuloMes = (ym: string) => {
  const [a, m] = String(ym || '').split('-').map(Number);
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return m ? `${nomes[m - 1]} de ${a}` : ym;
};

function corPctLimite(pct: number) {
  if (pct >= 100) return { bg: '#ef4444', label: 'EXCEDIDO' };
  if (pct >= 90)  return { bg: '#ef6c00', label: 'CRÍTICO' };
  if (pct >= 70)  return { bg: '#f59e0b', label: 'ATENÇÃO' };
  return { bg: '#22c55e', label: 'OK' };
}

function normalizaCor(cor: any): { fg: string; bg: string } {
  if (cor == null) return { fg: 'hsl(220 10% 50%)', bg: 'hsl(220 10% 50% / 0.15)' };
  if (typeof cor === 'number') return { fg: `hsl(${cor} 65% 55%)`, bg: `hsl(${cor} 75% 50% / 0.15)` };
  if (typeof cor === 'string') {
    const t = cor.trim();
    if (t.startsWith('#')) return { fg: t, bg: `${t}26` };
    if (t.startsWith('hsl') || t.startsWith('rgb')) return { fg: t, bg: t };
    const n = parseFloat(t);
    if (!isNaN(n)) return { fg: `hsl(${n} 65% 55%)`, bg: `hsl(${n} 75% 50% / 0.15)` };
  }
  return { fg: 'hsl(220 10% 50%)', bg: 'hsl(220 10% 50% / 0.15)' };
}

interface Categoria { id: string; nome: string; icone?: string; cor?: any; parent_id?: string | null }
interface CategoryLimit {
  id?:                 string;
  categoria:           string;
  limite_mensal:       number;
  percentual_alerta:   number;
  ativo?:              boolean;
  mes_referencia?:     string;
}

type Tab = 'geral' | 'categoria';

export default function LimitesClient({ phoneInicial, initialData }: { phoneInicial?: string; initialData?: any } = {}) {
  const fmt = useDinheiro();
  const { phone: authPhone } = useAuth();
  const phone = authPhone || phoneInicial || ''; // SSR: phone do servidor até hidratar
  const hoje = new Date();
  const mesRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  const [tab, setTab] = useState<Tab>('geral');
  // Pedido de cliente (set/2026): "limites mensais e anuais — o de vocês é
  // somente mensal". Gasto sazonal (IPVA, seguro, viagem) estoura um mês e
  // cabe no ano; sem teto anual não há como planejar isso. Migration 171.
  const [periodo, setPeriodo] = useState<'mensal' | 'anual'>('mensal');
  const anoRef = mesRef.slice(0, 4);
  const { ocultos: ocultar } = useValores();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [resumo,     setResumo]     = useState<any>({ gastos: 0, por_categoria: [] });
  const [limites,    setLimites]    = useState<CategoryLimit[]>([]);

  // Limite geral
  const [metaMensal,        setMetaMensal]        = useState(0);
  // Teto do ANO (migration 171). Fica 0 enquanto a migration não rodar — a
  // rota devolve as colunas anuais em consulta tolerante, então a aba nunca
  // quebra por causa disso, só não mostra o teto.
  const [metaAnual,         setMetaAnual]         = useState(0);
  const [geralAtivo,        setGeralAtivo]        = useState(true);
  const [geralAlertaAtivo,  setGeralAlertaAtivo]  = useState(true);
  const [geralAlertaPct,    setGeralAlertaPct]    = useState(80);

  // Modais
  const [editGeralOpen, setEditGeralOpen] = useState(false);
  const [catModal, setCatModal] = useState<{ edicao?: CategoryLimit; categoriaAlvo?: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<CategoryLimit | null>(null);

  // SWR cacheia (revisita instantânea); mantém os states locais pro otimismo
  // dos toggles do limite geral.
  const { data: catsRaw,    mutate: mCats } = useApi(phone ? chave.categorias(phone) : null,             () => api.categorias.listar(phone), { fallbackData: initialData?.cats });
  const { data: resumoRaw,  mutate: mRes }  = useApi(phone ? chave.resumo(phone, mesRef) : null, () => api.transacoes.resumo(phone, mesRef), { fallbackData: initialData?.resumo });
  const { data: limitesRaw, mutate: mLim }  = useApi(phone ? chave.limites(phone, mesRef) : null, () => api.limites.listar(phone, mesRef), { fallbackData: initialData?.limites });

  // ⚠️ `useSWR` DIRETO, não `useApi`. O `useApi` registra no LoadingGate, e a
  // baleia cobriria a página inteira só por alguém tocar em "Anual". Só busca
  // quando o modo anual está aberto — quem nunca usa não paga a requisição.
  const { data: ano, isLoading: anoCarregando, mutate: mAno } = useSWR(
    phone && periodo === 'anual' ? chave.limitesAno(phone, anoRef) : null,
    () => api.limites.ano(phone, anoRef),
  );

  const mesesGrafico = useMemo(
    () => (ano?.meses || []).map((m, i) => ({
      mes: MESES_CURTOS[i] || m.mes,
      realizado: m.realizado || 0,
      previsto: m.previsto || 0,
    })),
    [ano],
  );

  // Média dos meses QUE JÁ TIVERAM gasto — dividir por 12 em março daria uma
  // média três vezes menor que a real e faria o ano parecer folgado.
  const mediaMes = useMemo(() => {
    const comGasto = (ano?.meses || []).filter((m) => (m.realizado || 0) > 0);
    return comGasto.length
      ? comGasto.reduce((s, m) => s + m.realizado, 0) / comGasto.length
      : 0;
  }, [ano]);

  useEffect(() => { if (catsRaw !== undefined) setCategorias(
    ((catsRaw as any) || []).slice()
      .sort((a: Categoria, b: Categoria) => nomeCategoria(a.nome).localeCompare(nomeCategoria(b.nome), 'pt-BR'))
  ); }, [catsRaw]);
  useEffect(() => { if (resumoRaw !== undefined) setResumo((resumoRaw as any) || { gastos: 0, por_categoria: [] }); }, [resumoRaw]);
  useEffect(() => {
    if (limitesRaw === undefined) return;
    const ls: any = limitesRaw;
    setMetaMensal(ls?.meta_mensal || 0);
    setMetaAnual(ls?.meta_anual || 0);
    setGeralAtivo(ls?.meta_mensal_ativo ?? true);
    setGeralAlertaAtivo(ls?.meta_mensal_alerta_ativo ?? true);
    setGeralAlertaPct(ls?.meta_mensal_alerta_pct ?? 80);
    setLimites(Array.isArray(ls?.categorias) ? ls.categorias : []);
  }, [limitesRaw]);

  // ⚠️ `mAno()` entra aqui: sem ele, salvar um teto ANUAL fecharia o modal
  // com a tela mostrando os números velhos, e a pessoa acharia que não salvou.
  const carregar = useCallback(
    () => Promise.all([mCats(), mRes(), mLim(), mAno()]), [mCats, mRes, mLim, mAno]);

  // ── Métricas ───────────────────────────────────────────────
  const gastoTotal = resumo?.gastos || 0;
  const pctUsadoGeral = metaMensal > 0 ? (gastoTotal / metaMensal) * 100 : 0;
  const excedido = metaMensal > 0 && gastoTotal > metaMensal;
  const valorExcedente = excedido ? gastoTotal - metaMensal : 0;
  const valorRestante = !excedido ? metaMensal - gastoTotal : 0;
  const corGeral = corPctLimite(pctUsadoGeral);

  const valorAlertaGeral = metaMensal * (geralAlertaPct / 100);

  // Gasto do mês indexado por categoria (mesma fonte da aba Categorias).
  const gastoPorNome = useMemo(() => indexarGastos(resumo?.por_categoria), [resumo]);

  // ⚠️ SOMA AS FILHAS. A taxonomia tem dois níveis e quase todo gasto cai numa
  // SUBcategoria, então a busca pelo nome exato devolvia zero pro pai: medido
  // nesta tela, R$ 466,77 de R$ 3.797,48 — 88% do mês invisível, com
  // "Empreendimento R$ 0,00" ao lado de R$ 1.768,39 em Facebook Ads.
  // Pior: o backend SEMPRE somou as filhas, então o alerta do WhatsApp
  // disparava por um total que esta tela jurava não existir.
  // A regra vive em lib/limite-categoria.ts e tem eval contra o backend.
  function gastoCategoria(nome: string): number {
    return gastoComFilhas(nome, categorias, gastoPorNome);
  }

  // Lista de gastos por categoria (para a seção "mini barras")
  const gastosPorCategoriaLista = useMemo(() => {
    const cats = categorias.filter(c => !c.parent_id);
    return cats
      .map(c => {
        const g = gastoCategoria(c.nome);
        const temLimite = limites.some(l =>
          chaveCategoria(l.categoria) === chaveCategoria(c.nome)
        );
        return { cat: c, gasto: g, temLimite };
      })
      .sort((a, b) => b.gasto - a.gasto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorias, gastoPorNome, limites]);

  const maiorGasto = gastosPorCategoriaLista[0]?.gasto || 1;

  async function handleDeletar(l: CategoryLimit) {
    if (!l.id) return;
    try {
      await api.limites.deletar(l.id);
      setConfirmDel(null);
      carregar();
    } catch (e: any) {
      alert(e.message || 'Erro ao excluir.');
    }
  }

  async function toggleLimiteCategoria(l: CategoryLimit, ativo: boolean) {
    if (!phone) return;
    try {
      await api.limites.setCategoria({
        phone,
        categoria: l.categoria,
        limite_mensal: l.limite_mensal,
        percentual_alerta: l.percentual_alerta,
        ativo,
        mes_referencia: mesRef,
      });
      carregar();
    } catch (e: any) {
      alert(e.message || 'Erro ao alterar limite.');
    }
  }

  const limitesAtivos = limites.filter(l => l.ativo !== false);

  return (
    <>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">

        {/* ═══════════════════════════════════════════════════════
            HERO HEADER
        ═══════════════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in border border-border/60"
             style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>
          <div className="absolute inset-0 pointer-events-none opacity-50"
               style={{ background: 'radial-gradient(ellipse at top right, hsl(var(--primary) / .12) 0%, transparent 60%)' }} />

          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
                <Sparkles size={12} style={{ color: BRAND }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND }}>
                  Controle de gastos
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
                Limites de gastos
              </h1>
              <p className="text-muted-foreground text-sm mt-2 max-w-md">
                Defina limites e receba alertas no WhatsApp quando se aproximar deles.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BotaoOlhoValores />
              <button
                onClick={() => tab === 'geral' ? setEditGeralOpen(true) : setCatModal({})}
                className="btn btn-primary px-4 py-2.5 text-sm gap-2 shadow-glow-sm"
              >
                <Plus size={16} /> {tab === 'geral'
                  ? (periodo === 'anual' ? 'Editar teto do ano' : 'Editar limite geral')
                  : (periodo === 'anual' ? 'Novo teto anual' : 'Novo limite')}
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            PERÍODO — mês × ano
            ────────────────────────────────────────────────────
            ⚠️ Fica ACIMA das abas de propósito: ele muda o HORIZONTE, e as
            duas abas (geral / por categoria) continuam significando a mesma
            coisa nos dois. Pôr "Anual" como uma terceira aba misturaria duas
            perguntas diferentes ("o quê" e "em quanto tempo") na mesma fila.

            `role="radiogroup"` e não um grupo de botões soltos: são opções
            MUTUAMENTE exclusivas, e é isso que o leitor de tela precisa ouvir.
        ═══════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: '40ms' }}>
          <div role="radiogroup" aria-label="Período do orçamento"
               className="inline-flex items-center gap-1 bg-muted/40 rounded-2xl p-1.5">
            {([
              { v: 'mensal' as const, l: 'Mensal', icon: CalendarDays },
              { v: 'anual'  as const, l: 'Anual',  icon: CalendarRange },
            ]).map(({ v, l, icon: Icon }) => {
              const ativo = periodo === v;
              return (
                <button
                  key={v} role="radio" aria-checked={ativo} onClick={() => setPeriodo(v)}
                  // min-h-[44px] é o alvo de toque mínimo; sem ele o controle
                  // fica com ~36px e vira mira no celular.
                  className={`flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-sm font-semibold transition-all ${
                    ativo ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {/* Ícone + rótulo: o estado ativo não é dito só pela cor. */}
                  <Icon size={14} />
                  <span>{l}</span>
                </button>
              );
            })}
          </div>
          <span className="text-xs text-muted-foreground tabular">
            {periodo === 'anual' ? anoRef : rotuloMes(mesRef)}
          </span>
        </div>

        {/* ═══════════════════════════════════════════════════════
            TABS
        ═══════════════════════════════════════════════════════ */}
        <div className="relative inline-flex items-center gap-1 bg-muted/40 rounded-2xl p-1.5 animate-fade-in"
             style={{ animationDelay: '60ms' }}>
          {([
            { v: 'geral', l: 'Limite geral', icon: Target, count: null as number | null },
            { v: 'categoria', l: 'Por categoria', icon: Wallet, count: limitesAtivos.length },
          ] as { v: Tab; l: string; icon: any; count: number | null }[]).map(({ v, l, icon: Icon, count }) => {
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
                <span>{l}</span>
                {count !== null && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    ativo ? 'bg-primary/15 text-primary' : 'bg-muted-foreground/15 text-muted-foreground'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════
            ORÇAMENTO DO ANO
            ────────────────────────────────────────────────────
            Um bloco só pras duas abas: no modo anual a diferença entre
            "geral" e "por categoria" é só QUAL lista aparece embaixo do
            gráfico — o gráfico do ano vale pros dois, e duplicá-lo faria o
            usuário perder o contexto ao trocar de aba.
        ═══════════════════════════════════════════════════════ */}
        {periodo === 'anual' && (
          <div className="space-y-5 animate-fade-in" style={{ animationDelay: '120ms' }}>

            {/* ── Gráfico: realizado × previsto nos 12 meses ── */}
            <div className="card rounded-3xl p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <TrendingUp size={18} style={{ color: BRAND }} />
                    Orçamento de {anoRef}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Quanto saiu em cada mês, comparado ao teto que você definiu.
                  </p>
                </div>
                {ano && (
                  <div className="flex items-center gap-5">
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Realizado</p>
                      <p className="text-lg font-bold tabular" style={{ color: BRAND }}>{fmt(ano.total.realizado)}</p>
                    </div>
                    {ano.total.previsto > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Previsto</p>
                        <p className="text-lg font-bold tabular text-foreground">{fmt(ano.total.previsto)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ⚠️ Skeleton da MESMA altura do gráfico (260px) — bloco de
                  tamanho diferente vira salto de layout quando o dado chega. */}
              {anoCarregando ? (
                <div className="w-full rounded-xl bg-muted/40 animate-pulse" style={{ height: 260 }} />
              ) : !ano || !ano.meses.some((m) => m.realizado > 0 || m.previsto > 0) ? (
                /* Empty state com SAÍDA, não um eixo vazio (`empty-data-state`). */
                <div className="flex flex-col items-center justify-center text-center gap-2 px-4"
                     style={{ height: 260 }}>
                  <CalendarRange size={28} className="text-muted-foreground/60" />
                  <p className="text-sm font-semibold text-foreground">Nada lançado em {anoRef} ainda</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Assim que houver gastos no ano, eles aparecem aqui mês a mês, comparados ao teto.
                  </p>
                </div>
              ) : (
                <>
                  <GraficoAno meses={mesesGrafico} media={mediaMes} />
                  {/* ⚠️ Resumo em TEXTO do que o gráfico mostra: leitor de tela
                      não lê barra (`screen-reader-summary`). */}
                  <p className="sr-only">
                    Gastos de {anoRef} por mês. Total realizado {fmt(ano.total.realizado)}
                    {ano.total.previsto > 0 ? `, de um teto previsto de ${fmt(ano.total.previsto)}` : ''}.
                    Média mensal {fmt(mediaMes)}.
                  </p>
                </>
              )}
            </div>

            {/* ── Teto GERAL do ano ── */}
            {tab === 'geral' && (
              <div className="card rounded-3xl p-6 sm:p-8">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Target size={16} style={{ color: BRAND }} /> Teto geral do ano
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-lg">
                  Um limite para o ano inteiro, independente do mensal. Serve pra gasto
                  que estoura um mês e ainda cabe no ano — IPVA, seguro, viagem.
                </p>
                <div className="mt-5 flex flex-wrap items-end gap-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Gasto no ano</p>
                    <p className="text-3xl font-bold tabular text-foreground mt-0.5">
                      {fmt(ano?.total.realizado || 0)}
                    </p>
                  </div>
                  {metaAnual > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Teto</p>
                      <p className="text-xl font-bold tabular text-muted-foreground mt-0.5">{fmt(metaAnual)}</p>
                    </div>
                  )}
                </div>

                {metaAnual > 0 ? (
                  <div className="mt-5">
                    <BarraLimite gasto={ano?.total.realizado || 0} teto={metaAnual} />
                  </div>
                ) : (
                  <button
                    onClick={() => setEditGeralOpen(true)}
                    className="mt-5 btn btn-outline px-4 min-h-[44px] text-sm gap-2"
                  >
                    <Plus size={15} /> Definir teto do ano
                  </button>
                )}
              </div>
            )}

            {/* ── Tetos por categoria no ano ── */}
            {tab === 'categoria' && (
              <div className="card rounded-3xl p-5 sm:p-6">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-1">
                  <Wallet size={16} style={{ color: BRAND }} /> Por categoria em {anoRef}
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  &ldquo;Teto do ano&rdquo; é um limite próprio; &ldquo;soma dos meses&rdquo; é o total dos
                  limites mensais que você já definiu ao longo de {anoRef}.
                </p>

                {anoCarregando ? (
                  <div className="space-y-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
                    ))}
                  </div>
                ) : !ano?.categorias.length ? (
                  <div className="text-center py-10 px-4">
                    <Wallet size={28} className="text-muted-foreground/60 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-foreground">Nenhuma categoria com gasto em {anoRef}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Defina um teto anual e acompanhe o consumo ao longo do ano.
                    </p>
                    <button onClick={() => setCatModal({})} className="mt-4 btn btn-outline px-4 min-h-[44px] text-sm gap-2">
                      <Plus size={15} /> Novo teto anual
                    </button>
                  </div>
                ) : (
                  /* `content-visibility` nas linhas: virtualização nativa do
                     browser, sem lib — a lista pode ter dezenas de categorias. */
                  <ul className="divide-y divide-border/50">
                    {ano.categorias.map((c) => {
                      const teto = c.teto_ano || c.teto_meses;
                      const pct  = teto > 0 ? (c.realizado / teto) * 100 : 0;
                      return (
                        <li key={c.categoria}
                            className="py-3 flex items-center gap-3 [content-visibility:auto] [contain-intrinsic-size:auto_56px]">
                          <CategoriaIcon nome={c.categoria} size={30} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {nomeCategoria(c.categoria)}
                            </p>
                            <p className="text-[11px] text-muted-foreground tabular">
                              {teto > 0
                                ? `${fmt(c.realizado)} de ${fmt(teto)}${c.teto_ano ? '' : ' (soma dos meses)'}`
                                : fmt(c.realizado)}
                            </p>
                          </div>
                          {teto > 0 && (
                            <div className="w-24 sm:w-40 flex-shrink-0">
                              <BarraLimite gasto={c.realizado} teto={teto} compacta />
                            </div>
                          )}
                          {!c.teto_ano && (
                            <button
                              onClick={() => setCatModal({ categoriaAlvo: c.categoria })}
                              aria-label={`Definir teto anual para ${nomeCategoria(c.categoria)}`}
                              className="flex-shrink-0 w-11 h-11 rounded-xl inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                            >
                              <Plus size={16} />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}


        {/* ═══════════════════════════════════════════════════════
            TAB GERAL
        ═══════════════════════════════════════════════════════ */}
        {periodo === 'mensal' && tab === 'geral' && (
          <div className="space-y-5 animate-fade-in" style={{ animationDelay: '120ms' }}>

            {/* Card principal do limite geral */}
            <div className={`card rounded-3xl p-6 sm:p-8 transition-opacity ${geralAtivo ? '' : 'opacity-50'}`}>
              <div className="grid lg:grid-cols-5 gap-6">

                {/* Coluna esquerda (60% = 3 cols) */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Switch value={geralAtivo} onChange={async (v) => {
                        setGeralAtivo(v);
                        if (phone && metaMensal > 0) {
                          try { await api.limites.setGeral({ phone, valor: metaMensal, ativo: v }); } catch {}
                        }
                      }} />
                      <span className="text-sm font-semibold text-foreground">
                        Limite geral {geralAtivo ? 'ativado' : 'desativado'}
                      </span>
                    </div>
                    <button
                      onClick={() => setEditGeralOpen(true)}
                      className="btn-ghost px-2.5 py-1.5 text-xs gap-1.5"
                    >
                      <Pencil size={12} /> Editar
                    </button>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                      Limite mensal
                    </p>
                    <p className="text-4xl sm:text-5xl font-bold tabular tracking-tight text-foreground leading-none">
                      {ocultar ? '••••••••' : fmt(metaMensal)}
                    </p>
                  </div>

                  {/* Barra grossa */}
                  <div>
                    <div className="h-6 rounded-full bg-muted overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${excedido ? 'animate-pulse' : ''}`}
                        style={{
                          width: `${Math.min(pctUsadoGeral, 100)}%`,
                          background: corGeral.bg,
                          boxShadow: excedido ? `0 0 16px ${corGeral.bg}` : 'none',
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between mt-2 text-sm">
                      <span className="text-muted-foreground">
                        <span className="font-bold text-foreground tabular">{ocultar ? '•••' : fmt(gastoTotal)}</span>
                        {' '}de{' '}
                        <span className="font-bold text-foreground tabular">{ocultar ? '•••' : fmt(metaMensal)}</span>
                      </span>
                      <span className="font-bold tabular" style={{ color: corGeral.bg }}>
                        {Math.round(pctUsadoGeral)}%
                      </span>
                    </div>

                    {metaMensal > 0 && (
                      excedido ? (
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-950/50 animate-pulse">
                          <AlertCircle size={13} className="text-red-600 dark:text-red-400" />
                          <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
                            Excedido em {fmt(valorExcedente)}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-2">
                          Faltam <strong className="text-foreground tabular">{fmt(valorRestante)}</strong> para atingir o limite.
                        </p>
                      )
                    )}
                  </div>
                </div>

                {/* Coluna direita (40% = 2 cols) — alertas */}
                <div className="lg:col-span-2 rounded-2xl bg-muted/30 p-4 border border-border/60 flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
                        {geralAlertaAtivo ? <Bell size={14} /> : <BellOff size={14} />}
                        Alerta no WhatsApp
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Receba 1 aviso quando ultrapassar o percentual definido.
                      </p>
                    </div>
                    <Switch value={geralAlertaAtivo} onChange={async (v) => {
                      setGeralAlertaAtivo(v);
                      if (phone) {
                        try { await api.limites.setGeral({ phone, valor: metaMensal, alerta_ativo: v }); } catch {}
                      }
                    }} />
                  </div>

                  {geralAlertaAtivo && (
                    <>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">Avisar ao atingir</span>
                        <span className="text-sm font-bold tabular" style={{ color: BRAND }}>{geralAlertaPct}%</span>
                      </div>
                      <input
                        type="range" min={50} max={100} step={5}
                        value={geralAlertaPct}
                        onChange={async e => {
                          const v = parseInt(e.target.value, 10);
                          setGeralAlertaPct(v);
                        }}
                        onMouseUp={async e => {
                          if (phone) {
                            try { await api.limites.setGeral({ phone, valor: metaMensal, alerta_pct: parseInt((e.target as HTMLInputElement).value, 10) }); } catch {}
                          }
                        }}
                        className="w-full accent-primary"
                      />
                      {metaMensal > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                          📱 A Sora te avisa em <strong className="text-foreground tabular">{fmt(valorAlertaGeral)}</strong>.
                        </p>
                      )}
                    </>
                  )}

                  <p className="text-[10px] text-muted-foreground mt-auto pt-3 italic">
                    Você recebe apenas 1 aviso por mês.
                  </p>
                </div>
              </div>
            </div>

            {/* Mini-barras de gastos por categoria */}
            <div className="card rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
                    Gastos do mês
                  </p>
                  <p className="text-base font-bold text-foreground">Por categoria</p>
                </div>
                <button
                  onClick={() => setTab('categoria')}
                  className="text-xs font-semibold inline-flex items-center gap-1"
                  style={{ color: BRAND }}
                >
                  Ver limites <ChevronRight size={12} />
                </button>
              </div>

              {gastosPorCategoriaLista.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Sem categorias cadastradas.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {gastosPorCategoriaLista.map(({ cat, gasto, temLimite }, i) => {
                    const { fg, bg } = normalizaCor(cat.cor);
                    const pct = maiorGasto > 0 ? (gasto / maiorGasto) * 100 : 0;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => { setTab('categoria'); setCatModal({ categoriaAlvo: cat.nome }); }}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/40 transition-colors animate-fade-in text-left"
                        style={{ animationDelay: `${i * 20}ms` }}
                      >
                        <CategoriaIcon
                          nome={cat.nome}
                          icone={cat.icone}
                          bg={bg}
                          color={fg}
                          size={36}
                          rounded="rounded-lg"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground truncate inline-flex items-center gap-1.5">
                              {cat.nome}
                              {temLimite && (
                                <Target size={11} style={{ color: BRAND }} />
                              )}
                            </span>
                            <span className="text-sm font-semibold text-foreground tabular flex-shrink-0">
                              {ocultar ? '•••' : fmt(gasto)}
                            </span>
                          </div>
                          <div className="h-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                                 style={{ width: `${pct}%`, background: fg }} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB CATEGORIA
        ═══════════════════════════════════════════════════════ */}
        {periodo === 'mensal' && tab === 'categoria' && (
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
            {limites.length === 0 ? (
              <div className="card rounded-3xl py-16 flex flex-col items-center text-center px-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-glow-sm"
                     style={{ background: `color-mix(in srgb, ${BRAND} 13%, transparent)` }}>
                  <Target size={26} style={{ color: BRAND }} />
                </div>
                <p className="text-base font-bold text-foreground">Nenhum limite por categoria</p>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">
                  Defina limites específicos para suas categorias e subcategorias para um controle ainda mais preciso.
                </p>
                <button
                  onClick={() => setCatModal({})}
                  className="btn btn-primary px-4 py-2 text-sm gap-2 mt-5 shadow-glow-sm"
                >
                  <Plus size={14} /> Adicionar primeiro limite
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {limites.map((l, i) => (
                  <LimiteCategoriaCard
                    key={l.id || i}
                    limite={l}
                    categoria={categorias.find(c =>
                      nomeCategoria(c.nome).toLowerCase() === nomeCategoria(l.categoria).toLowerCase()
                    )}
                    gasto={gastoCategoria(l.categoria)}
                    ocultar={ocultar}
                    delay={i * 50}
                    onToggle={(v) => toggleLimiteCategoria(l, v)}
                    onEditar={() => setCatModal({ edicao: l })}
                    onExcluir={() => setConfirmDel(l)}
                  />
                ))}

                {/* Card adicionar */}
                <button
                  onClick={() => setCatModal({})}
                  className="rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-muted/20 transition-all p-6 flex flex-col items-center justify-center min-h-[200px] group animate-fade-in"
                  style={{ animationDelay: `${limites.length * 50}ms` }}
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-all group-hover:scale-110"
                       style={{ background: `color-mix(in srgb, ${BRAND} 13%, transparent)` }}>
                    <Plus size={22} style={{ color: BRAND }} />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Adicionar limite</p>
                  <p className="text-[11px] text-muted-foreground mt-1">por categoria ou subcategoria</p>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAIS */}
      {editGeralOpen && phone && (
        <EditarLimiteGeralModal
          phone={phone}
          // ⚠️ O valor INICIAL segue o período aberto: abrir o modal no modo
          // anual mostrando o teto mensal faria a pessoa "confirmar" um número
          // que não é o daquele campo e sobrescrever o teto do ano com ele.
          valorInicial={periodo === 'anual' ? metaAnual : metaMensal}
          ativoInicial={geralAtivo}
          alertaAtivoInicial={geralAlertaAtivo}
          alertaPctInicial={geralAlertaPct}
          periodo={periodo}
          onClose={() => setEditGeralOpen(false)}
          onSuccess={carregar}
        />
      )}

      {catModal && phone && (
        <LimiteCategoriaModal
          phone={phone}
          // No anual a chave é o ANO — o backend corta pra 4 dígitos, mas
          // mandar já certo deixa o payload legível no diagnóstico.
          mesRef={periodo === 'anual' ? anoRef : mesRef}
          categorias={categorias}
          categoriaAlvo={catModal.categoriaAlvo}
          limiteExistente={catModal.edicao}
          periodo={periodo}
          onClose={() => setCatModal(null)}
          onSuccess={carregar}
        />
      )}

      {confirmDel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmDel(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-card rounded-3xl shadow-2xl border border-border animate-fade-in p-6"
               onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center mb-4">
              <AlertCircle size={22} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-base font-bold text-foreground">Excluir limite?</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Tem certeza que deseja remover o limite de <strong className="text-foreground">{confirmDel.categoria}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setConfirmDel(null)} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
              <button onClick={() => handleDeletar(confirmDel)}
                      className="btn-danger px-4 py-2 text-sm gap-2 inline-flex items-center">
                <Trash2 size={14} /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// SWITCH (toggle reusável)
// ─────────────────────────────────────────────────────────────
function Switch({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
        value ? 'bg-primary' : 'bg-muted-foreground/30'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      aria-pressed={value}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${
        value ? 'translate-x-5' : 'translate-x-0.5'
      }`} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// CARD DE LIMITE POR CATEGORIA
// ─────────────────────────────────────────────────────────────
interface CardProps {
  limite:    CategoryLimit;
  categoria: Categoria | undefined;
  gasto:     number;
  ocultar:   boolean;
  delay:     number;
  onToggle:  (v: boolean) => void;
  onEditar:  () => void;
  onExcluir: () => void;
}

function LimiteCategoriaCard({ limite, categoria, gasto, ocultar, delay, onToggle, onEditar, onExcluir }: CardProps) {
  const fmt = useDinheiro();
  const ativo = limite.ativo !== false;
  const { fg, bg } = normalizaCor(categoria?.cor);
  const pct = limite.limite_mensal > 0 ? (gasto / limite.limite_mensal) * 100 : 0;
  const excedido = gasto > limite.limite_mensal;
  const cor = corPctLimite(pct);
  const valorExc = excedido ? gasto - limite.limite_mensal : 0;

  return (
    <div
      className={`card-hover rounded-2xl p-5 animate-fade-in transition-opacity ${ativo ? '' : 'opacity-50'}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <CategoriaIcon
            nome={limite.categoria}
            icone={categoria?.icone}
            bg={bg}
            color={fg}
            size={48}
            rounded="rounded-xl"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{limite.categoria}</p>
            {categoria?.parent_id && (
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Subcategoria</p>
            )}
          </div>
        </div>
        <Switch value={ativo} onChange={onToggle} />
      </div>

      {/* Valor */}
      <p className="text-2xl font-bold text-foreground tabular tracking-tight mb-1">
        {ocultar ? '••••••' : fmt(limite.limite_mensal)}
      </p>
      <p className="text-[11px] text-muted-foreground mb-3">limite mensal</p>

      {/* Barra grossa */}
      <div className="h-4 rounded-full bg-muted overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-700 ${excedido ? 'animate-pulse' : ''}`}
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: cor.bg,
            boxShadow: excedido ? `0 0 12px ${cor.bg}` : 'none',
          }}
        />
      </div>

      <div className="flex items-center justify-between text-xs mb-3">
        <span className="text-muted-foreground">
          <span className="font-bold text-foreground tabular">
            {ocultar ? '•••' : fmt(gasto)}
          </span>
          {' '}gasto
        </span>
        <span className="font-bold tabular" style={{ color: cor.bg }}>{Math.round(pct)}%</span>
      </div>

      {excedido && (
        <div className="rounded-lg p-2 bg-red-100 dark:bg-red-950/50 mb-3 animate-pulse">
          <p className="text-[11px] font-bold text-red-700 dark:text-red-400 inline-flex items-center gap-1.5">
            <AlertCircle size={11} /> Excedido em{' '}
            {fmt(valorExc)}
          </p>
        </div>
      )}

      {/* Alerta + percentual */}
      <div className="flex items-center justify-between pt-3 border-t border-border/60">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {limite.percentual_alerta > 0 ? (
            <>
              <Bell size={11} />
              Alerta em <strong className="text-foreground tabular">{limite.percentual_alerta}%</strong>
            </>
          ) : (
            <>
              <BellOff size={11} />
              Sem alerta
            </>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={onEditar} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Editar">
            <Pencil size={13} className="text-muted-foreground" />
          </button>
          <button onClick={onExcluir} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors" title="Excluir">
            <Trash2 size={13} className="text-muted-foreground hover:text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
}


// Barra de consumo de um teto. ⚠️ Status por ICONE + ROTULO, nunca so pela
// cor: quem nao distingue verde de vermelho tem de conseguir ler o estado
// (regra `color-not-only`). Os numeros sao tabulares pra nao dancar.
function BarraLimite({ gasto, teto, compacta }: { gasto: number; teto: number; compacta?: boolean }) {
  const fmt = useDinheiro();
  const { ocultos } = useValores();
  const pct = teto > 0 ? (gasto / teto) * 100 : 0;
  const { bg, label } = corPctLimite(pct);
  const restante = teto - gasto;
  return (
    <div>
      <div className="h-2 rounded-full bg-muted overflow-hidden"
           role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}
           aria-label={`${Math.round(pct)}% do teto`}>
        {/* Largura em % anima por transform-free width com duracao curta; a
            barra nasce em 0 e cresce, entao o movimento diz "isto e progresso". */}
        <div className="h-full rounded-full transition-[width] duration-500 ease-out"
             style={{ width: `${Math.min(pct, 100)}%`, background: bg }} />
      </div>
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: bg }}>
          {label} · {Math.round(pct)}%
        </span>
        {!compacta && !ocultos && (
          <span className="text-[11px] text-muted-foreground tabular">
            {restante >= 0 ? `${fmt(restante)} disponível` : `${fmt(-restante)} acima`}
          </span>
        )}
      </div>
    </div>
  );
}

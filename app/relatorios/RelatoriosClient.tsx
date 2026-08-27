'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import BaleiaHumor, { humorPorFinancas } from '@/components/relatorios/BaleiaHumor';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { getCategoriaTheme, nomeCategoria, citrico } from '@/lib/categorias';
import AvatarMembro from '@/components/ui/AvatarMembro';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import ValorAuto from '@/components/ui/ValorAuto';
import { temMarcaConhecida } from '@/components/ui/IconeMarca';
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet,
  Filter, BarChart3, PieChart as PieIcon, LineChart as LineIcon,
  ArrowUpRight, ArrowDownRight, Calendar, RefreshCw,
  CheckCircle2, ClipboardList, Activity, Layers, Users,
  Target, AlertTriangle, Check as CheckIcon, Gauge,
} from 'lucide-react';
// recharts sob demanda: os gráficos (e o CategoryDonut, que também usa recharts)
// saem do bundle inicial. Skeleton com altura própria pra não gerar CLS.
const skel = (h: number) => () => <div className="w-full rounded-xl bg-muted/40 animate-pulse" style={{ height: h }} role="status" aria-label="Carregando gráfico" />;
const CategoryDonut       = dynamic(() => import('@/components/relatorios/CategoryDonut'), { ssr: false, loading: skel(200) });
const GraficoFrequencia   = dynamic(() => import('./Graficos').then(m => m.GraficoFrequencia),  { ssr: false, loading: skel(260) });
const GraficoFluxo        = dynamic(() => import('./Graficos').then(m => m.GraficoFluxo),        { ssr: false, loading: skel(340) });
const GraficoComparativo  = dynamic(() => import('./Graficos').then(m => m.GraficoComparativo),  { ssr: false, loading: skel(260) });
const DonutVazio          = dynamic(() => import('./Graficos').then(m => m.DonutVazio),          { ssr: false, loading: skel(180) });

const BRAND       = 'hsl(var(--primary))';
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

// ─────────────────────────────────────────────────────────────
// TOOLTIP PERSONALIZADO
// ─────────────────────────────────────────────────────────────
// CustomTooltip foi pra app/relatorios/Graficos.tsx (junto dos gráficos) — se
// ficasse aqui, o type de <Tooltip content> puxaria recharts de volta pra página.

// ─────────────────────────────────────────────────────────────
// PÁGINA
// ─────────────────────────────────────────────────────────────
export default function RelatoriosClient({ phoneInicial, initialData }: { phoneInicial?: string; initialData?: any } = {}) {
  const { phone: authPhone, perfil } = useAuth();
  const phone = authPhone || phoneInicial || ''; // SSR: phone do servidor até hidratar
  const hoje = new Date();

  const [tab,      setTab]      = useState<Tab>('graficos');
  const [ano,      setAno]      = useState(hoje.getFullYear());
  const [mes,      setMes]      = useState(hoje.getMonth());

  // Gestão compartilhada: filtro por membro do grupo ('todos' | user_id).
  const [membroFiltro, setMembroFiltro] = useState('todos');
  const compartilhado = !/pessoal/i.test(((perfil?.grupo_ativo as any)?.nome) || '');
  const grupoId = (perfil?.grupo_ativo as any)?.id as string | undefined;
  const criadoPorParam = membroFiltro !== 'todos' ? membroFiltro : undefined;

  const mesRef = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const mesAntRef = (() => {
    const d = new Date(ano, mes - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  // Dados via SWR — revisita/troca de mês instantânea (cache em memória).
  const { data: rData, isValidating: refreshing, mutate: mR } =
    useApi(phone ? `rel:resumo:${phone}:${mesRef}:${membroFiltro}` : null, () => api.transacoes.resumo(phone, mesRef, { criado_por: criadoPorParam }), { fallbackData: initialData?.resumo });
  const { data: rAntData, mutate: mRAnt } =
    useApi(phone ? `rel:resumoAnt:${phone}:${mesAntRef}` : null, () => api.transacoes.resumo(phone, mesAntRef), { fallbackData: initialData?.resumoAnt });
  const { data: tData, mutate: mT } =
    useApi(phone ? `rel:txs:${phone}:${mesRef}:${membroFiltro}` : null, () => api.transacoes.listar(phone, { mes: mesRef, limit: 500, criado_por: criadoPorParam }), { fallbackData: initialData?.txs });
  const { data: wData, mutate: mW } =
    useApi(phone ? `rel:wallets:${phone}` : null, () => api.wallets.listar(phone), { fallbackData: initialData?.wallets });
  const { data: cData, mutate: mC } =
    useApi(phone ? `rel:cats:${phone}` : null, () => api.categorias.listar(phone), { fallbackData: initialData?.cats });
  // Membros do grupo (só em gestão compartilhada) — pro seletor de membro.
  const { data: membrosData } =
    useApi(compartilhado && grupoId ? `rel:membros:${grupoId}` : null, () => api.grupos.membros(grupoId!));
  const membros: any[] = Array.isArray(membrosData) ? membrosData : [];

  // Os 12 meses REAIS do ano — alimentam o gráfico de fluxo E a média/projeção.
  // Não busca na aba de pendentes, que não usa nada disso. Como a key do SWR é
  // a mesma nas duas abas, trocar entre elas não refaz a chamada.
  const { data: anualData } = useApi(
    phone && tab !== 'pendentes' ? `rel:anual:${phone}:${ano}:${membroFiltro}` : null,
    () => api.transacoes.anual(phone, ano, { criado_por: criadoPorParam }),
  );

  // Limites por categoria do mês (mesma fonte da aba Categorias).
  const { data: limitesData } = useApi(
    phone ? `rel:limites:${phone}:${mesRef}` : null,
    () => api.limites.listar(phone, mesRef),
  );

  const resumo: any       = (rData as any)    ?? { receitas: 0, gastos: 0, por_categoria: [], por_membro: [] };
  const resumoAnt: any    = (rAntData as any) ?? { receitas: 0, gastos: 0, por_categoria: [] };
  const txs: any[]        = (tData as any)?.transacoes ?? [];
  const wallets: any[]    = (wData as any) ?? [];
  const categorias: any[] = (cData as any) ?? [];
  const carregar = useCallback(() => Promise.all([mR(), mRAnt(), mT(), mW(), mC()]), [mR, mRAnt, mT, mW, mC]);

  function navMes(dir: number) {
    let nm = mes + dir;
    let na = ano;
    if (nm < 0)  { nm = 11; na--; }
    if (nm > 11) { nm = 0;  na++; }
    setMes(nm); setAno(na);
  }


  // ── Métricas derivadas ─────────────────────────────────────
  const saldo       = (resumo?.receitas || 0) - (resumo?.gastos || 0);
  const saldoBanco  = wallets.filter(w => w.tipo !== 'Crédito').reduce((s, w) => s + (w.saldo || 0), 0);

  // Humor da baleia: com receita lançada → taxa de economia; sem receita →
  // quanto do saldo disponível do banco já foi gasto no mês (fica triste se
  // passar do saldo).
  const humorBaleia = humorPorFinancas({
    receitas:   resumo?.receitas || 0,
    gastos:     resumo?.gastos || 0,
    saldoBanco,
  });

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

  // ⚠️ O RESTO VIRA UMA FATIA "OUTRAS" — NÃO PODE SUMIR.
  //
  // BUG QUE ISTO CORRIGE: o donut mostrava só as 7 maiores e o miolo dizia
  // "TOTAL" com a soma DELAS. Medido numa conta real: card de despesas
  // R$ 3.645,84 e donut "TOTAL R$ 3.113,51" — R$ 532,33 em 10 categorias
  // sumiam sem aviso, e as porcentagens saíam infladas (Facebook Ads aparecia
  // com 44% quando era 37,6% do gasto do mês).
  //
  // 7 fatias continua sendo o limite de LEITURA (mais que isso vira confete),
  // mas o que passa disso é agrupado, não descartado. Cinza neutro de
  // propósito: "Outras" não é uma categoria, é um resto — não deve competir
  // por atenção com as reais.
  const TOPO = 7;
  const comOutras = useCallback((lista: { categoria: string; total: number }[]) => {
    const topo = lista.slice(0, TOPO);
    const resto = lista.slice(TOPO);
    const fatias = topo.map((c) => {
      const theme = getCategoriaTheme(c.categoria || '', categorias);
      return {
        name:  nomeCategoria(c.categoria || ''),
        value: c.total || 0,
        color: citrico(theme.color),
        emoji: theme.emoji,
      };
    });
    if (resto.length) {
      fatias.push({
        name:  `Outras (${resto.length})`,
        value: resto.reduce((s, c) => s + (c.total || 0), 0),
        color: '#71717A',
        emoji: '•',
      });
    }
    return fatias;
  }, [categorias]);

  // Pizza por categoria — cor customizada do usuário > catálogo > hash
  const dadosPie = useMemo(
    () => comOutras((resumo?.por_categoria || []) as { categoria: string; total: number }[]),
    [resumo, comOutras],
  );

  // Pizza receitas — usa o agregado do SERVIDOR (mesma fonte/regra do total de
  // receitas), igual ao gráfico de despesas. Antes filtrava os `txs` no cliente,
  // que vêm capados em 500 → com Open Finance as receitas caíam fora do corte e
  // o gráfico zerava mesmo com receita lançada. Fallback pro cálculo antigo
  // enquanto o backend novo (por_categoria_receitas) não redeploya.
  const dadosPieReceitas = useMemo(() => {
    const serverCats = resumo?.por_categoria_receitas as { categoria: string; total: number }[] | undefined;
    const base = serverCats
      ? serverCats.map(c => ({ cat: c.categoria || 'Outros', val: c.total || 0 }))
      : (() => {
          const grupos: Record<string, number> = {};
          txs.filter(t => t.tipo === 'Recebimento').forEach(t => {
            const cat = t.categoria || 'Outros';
            grupos[cat] = (grupos[cat] || 0) + (t.valor || 0);
          });
          return Object.entries(grupos).map(([cat, val]) => ({ cat, val }));
        })();
    // Mesma regra do donut de despesas: o que passa das 7 vira "Outras", nunca
    // some — senão o TOTAL do miolo mente sobre a receita do mês.
    return comOutras(
      base.sort((a, b) => b.val - a.val).map(({ cat, val }) => ({ categoria: cat, total: val })),
    );
  }, [resumo, txs, comOutras]);

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
  // ⚠️ DADO REAL, VINDO DO BANCO — não invente mês.
  //
  // Isto aqui era uma SENOIDE: `0.6 + Math.sin((i + ano) * 0.7) * 0.3` aplicada
  // ao valor do mês atual, com o comentário "simulação suave". Os 12 meses do
  // gráfico não tinham relação nenhuma com o histórico da pessoa, e os cards
  // diziam "Receitas no ano" mostrando `mês × 12 × 0,6`. Medido numa conta
  // real: exibia R$ 29.501,86 de despesa no ano onde o verdadeiro é
  // R$ 7.644,67 — quase 4× pra cima. Numa tela de dinheiro isso não é
  // enfeite de placeholder, é número errado que a pessoa usa pra decidir.
  //
  // Agora vem de `GET /api/transacoes/:phone/anual`, que roda a MESMA regra do
  // resumo mensal (fonte única no backend) — conferido: agosto do anual bate ao
  // centavo com o card do mês.
  const dadosFluxo = useMemo(() => {
    const meses = anualData?.meses;
    return Array.from({ length: 12 }, (_, i) => {
      const m = meses?.[i];
      return {
        name: MESES_CURTO[i],
        Receitas: m?.receitas || 0,
        Despesas: m?.gastos || 0,
        Saldo: m?.saldo || 0,
      };
    });
  }, [anualData]);
  const anualCarregando = tab === 'fluxo' && anualData === undefined;

  /* ══════════════════════════════════════════════════════════════════════
     CATEGORIA × LIMITE
     ══════════════════════════════════════════════════════════════════════ */
  //
  // ⚠️ O GASTO DE UMA CATEGORIA-PAI INCLUI AS FILHAS. Limite em "Encomendas"
  // tem de contar o que foi gasto em "Shein" e "Aliexpress" — foi exatamente a
  // queixa que originou isto ("tenho 215,19 numa subcategoria e o limite do pai
  // não conta"). Mesma soma que a aba Categorias faz na árvore.
  const limitesCats = useMemo(() => {
    const arr = Array.isArray(limitesData)
      ? limitesData
      : ((limitesData as any)?.categorias ?? []);
    return arr as { categoria?: string; limite_mensal?: number; ativo?: boolean }[];
  }, [limitesData]);

  const gastoPorNome = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of (resumo?.por_categoria || []) as any[]) {
      m[nomeCategoria(c.categoria || '').toLowerCase()] = c.total || 0;
    }
    return m;
  }, [resumo]);

  const usoDosLimites = useMemo(() => {
    return limitesCats
      .filter(l => (l.limite_mensal || 0) > 0 && l.ativo !== false)
      .map(l => {
        const nome = nomeCategoria(l.categoria || '');
        const chave = nome.toLowerCase();
        // Gasto próprio + o das filhas desta categoria.
        const pai = categorias.find((c: any) => nomeCategoria(c.nome).toLowerCase() === chave);
        const filhas = pai ? categorias.filter((c: any) => c.parent_id === pai.id) : [];
        const gasto = (gastoPorNome[chave] || 0)
          + filhas.reduce((s: number, f: any) => s + (gastoPorNome[nomeCategoria(f.nome).toLowerCase()] || 0), 0);
        const limite = l.limite_mensal || 0;
        return {
          nome, limite, gasto,
          filhas: filhas.length,
          pct: limite > 0 ? (gasto / limite) * 100 : 0,
          theme: getCategoriaTheme(l.categoria || '', categorias),
        };
      })
      // O que está pior primeiro: é o que exige ação.
      .sort((a, b) => b.pct - a.pct);
  }, [limitesCats, categorias, gastoPorNome]);

  /* ══════════════════════════════════════════════════════════════════════
     MÉDIA MENSAL E PROJEÇÃO DO MÊS
     ══════════════════════════════════════════════════════════════════════ */
  const mediaEProjecao = useMemo(() => {
    const meses = anualData?.meses;
    if (!meses) return null;

    const ehMesAtual = mes === hoje.getMonth() && ano === hoje.getFullYear();
    const gastoDoMes = meses[mes]?.gastos || 0;

    // ⚠️ A MÉDIA SÓ OLHA MÊS PASSADO, FECHADO E COM MOVIMENTO. Três cortes,
    // cada um por um motivo medido numa conta real:
    //
    //  · O MÊS EM CURSO fica fora: incompleto, ele puxaria a média pra baixo e
    //    a comparação "estou acima da média" mentiria a favor do usuário.
    //  · MÊS FUTURO fica fora: parcela lançada com data à frente faz setembro
    //    existir com R$ 79,86 em agosto. Entrando na conta, ele derrubava a
    //    média de R$ 1.155,78 pra R$ 886,80.
    //  · MÊS ZERADO fica fora: quem começou a usar a Sora em julho tem seis
    //    deles, e dividir por 12 dava R$ 322,47 — 3,6× menos que o real, o que
    //    faria qualquer mês normal parecer um descontrole.
    const ultimoFechado = ano < hoje.getFullYear() ? 11 : hoje.getMonth() - 1;
    const base = meses.filter((m, i) => i <= ultimoFechado && i !== mes && m.gastos > 0);
    const media = base.length ? base.reduce((s, m) => s + m.gastos, 0) / base.length : 0;

    // Projeção: só faz sentido pro mês em curso e a partir do 3º dia — no dia 1
    // um almoço viraria "projeção de R$ 3.000 no mês".
    const diaHoje = hoje.getDate();
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const podeProjetar = ehMesAtual && diaHoje >= 3 && gastoDoMes > 0;
    const projecao = podeProjetar ? (gastoDoMes / diaHoje) * diasNoMes : null;

    return {
      media, mesesNaMedia: base.length, gastoDoMes, projecao, ehMesAtual,
      diaHoje, diasNoMes,
      // Comparação contra a média usa a PROJEÇÃO quando existe (mês incompleto
      // contra média de meses fechados seria comparar coisas diferentes).
      refComparacao: projecao ?? gastoDoMes,
      variacao: media > 0 ? (((projecao ?? gastoDoMes) - media) / media) * 100 : null,
    };
  }, [anualData, mes, ano, hoje]);

  return (
    <>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">

        {/* ═══════════════════════════════════════════════════════
            HERO HEADER
        ═══════════════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in border border-border/60"
             style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>

          <div className="absolute inset-0 pointer-events-none opacity-60"
               style={{ background: 'radial-gradient(ellipse at top right, hsl(var(--primary) / .12) 0%, transparent 60%), radial-gradient(ellipse at bottom left, hsl(var(--primary) / .10) 0%, transparent 60%)' }} />

          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
                <BarChart3 size={12} className="text-primary" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
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

            <div className="flex items-center gap-4 self-end sm:self-auto">
              <BaleiaHumor estado={humorBaleia} />
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

          {/* Seletor de ANO — a navegação de mês sozinha exigia 12 cliques
              pra trocar de ano. */}
          <div className="flex items-center bg-muted/40 rounded-xl px-1 py-1">
            <button onClick={() => setAno(a => a - 1)} aria-label="Ano anterior"
                    className="p-1.5 rounded-lg hover:bg-card transition-colors">
              <ChevronLeft size={14} className="text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground px-2 tabular">{ano}</span>
            <button onClick={() => setAno(a => a + 1)} aria-label="Próximo ano"
                    className="p-1.5 rounded-lg hover:bg-card transition-colors">
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* ⚠️ AQUI HAVIA 4 CHIPS MORTOS: "Hoje", "7 dias", "Este mês" e
              "Este ano" acendiam e NÃO filtravam nada — o estado `periodo` só
              era lido no `className` do próprio botão. A tela inteira é
              mensal (resumo e lista vêm por `mesRef`), então "Hoje" e "7 dias"
              não tinham como funcionar sem refazer a busca, e "Este ano" só
              pulava pra janeiro. Controle que finge filtrar é pior que
              controle nenhum: a pessoa lê o número achando que é de hoje.
              No lugar ficou o que de fato funciona — e o botão de voltar só
              aparece quando você NÃO está no mês atual. */}
          {(mes !== hoje.getMonth() || ano !== hoje.getFullYear()) && (
            <button
              onClick={() => { setMes(hoje.getMonth()); setAno(hoje.getFullYear()); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors inline-flex items-center gap-1.5"
            >
              <Calendar size={12} /> Voltar pra hoje
            </button>
          )}

          {/* Filtro por membro — só em gestão compartilhada com 2+ membros */}
          {compartilhado && membros.length > 1 && (
            <select
              value={membroFiltro}
              onChange={e => setMembroFiltro(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/40 text-foreground border border-border focus:outline-none focus:border-primary cursor-pointer"
              title="Filtrar o relatório por um membro do grupo"
            >
              <option value="todos">👥 Todos os membros</option>
              {membros.map(m => {
                const id = m.user_id || m.users?.id;
                return <option key={id} value={id}>{m.users?.name || 'Membro'}</option>;
              })}
            </select>
          )}

          <div className="hidden sm:flex items-center gap-2 ml-auto text-xs text-muted-foreground">
            <Calendar size={13} />
            <span className="tabular">
              01/{String(mes + 1).padStart(2, '0')}/{ano} – {String(new Date(ano, mes + 1, 0).getDate())}/{String(mes + 1).padStart(2, '0')}/{ano}
            </span>
          </div>
        </div>

        {/* Chip do filtro de membro ativo */}
        {membroFiltro !== 'todos' && (
          <div className="flex items-center gap-2 animate-fade-in">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30">
              <span className="text-[11px] font-semibold text-primary">
                👤 {membros.find(m => (m.user_id || m.users?.id) === membroFiltro)?.users?.name || 'Membro'}
              </span>
              <button onClick={() => setMembroFiltro('todos')} className="text-primary hover:text-primary/70 -mr-0.5">×</button>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Só os lançamentos desse membro · <strong className="text-foreground tabular">{txs.length}</strong> no mês
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
                <GraficoFrequencia data={dadosFrequencia} />
                <ChartLegend items={[
                  { label: 'Receitas', color: '#22c55e' },
                  { label: 'Despesas', color: '#fb7185' },
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
                            {temMarcaConhecida(cat.name)
                              ? <CategoriaIcon nome={cat.name} icone={cat.emoji} color={cat.color} size={22} />
                              : <span className="text-base">{cat.emoji}</span>}
                            <span className="text-sm font-medium text-foreground">{cat.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular"
                                  style={{ background: `color-mix(in srgb, ${cat.color} 13%, transparent)`, color: cat.color }}>
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
                              background: `linear-gradient(90deg, ${cat.color}, color-mix(in srgb, ${cat.color} 87%, transparent))`,
                              boxShadow: `0 0 12px color-mix(in srgb, ${cat.color} 25%, transparent)`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ChartCard>
            )}

            {/* Média mensal + projeção do mês */}
            {mediaEProjecao && mediaEProjecao.mesesNaMedia > 0 && (
              <ChartCard
                title="Ritmo do mês"
                subtitle={`Comparado à sua média de ${mediaEProjecao.mesesNaMedia} ${mediaEProjecao.mesesNaMedia === 1 ? 'mês' : 'meses'} em ${ano}`}
                icon={<Activity size={14} className="text-indigo-500" />}
                badgeColor="blue"
                fullWidth
              >
                <RitmoDoMes {...mediaEProjecao} mesLabel={MESES[mes]} />
              </ChartCard>
            )}

            {/* Categoria × limite */}
            {usoDosLimites.length > 0 && (
              <ChartCard
                title="Limites por categoria"
                subtitle={`Quanto já foi usado do limite de ${MESES_CURTO[mes]}`}
                icon={<Target size={14} className="text-amber-500" />}
                badgeColor="purple"
                fullWidth
              >
                <div className="space-y-3.5 mt-2">
                  {usoDosLimites.map((l, i) => <LinhaLimite key={l.nome} {...l} i={i} />)}
                </div>
              </ChartCard>
            )}

            {/* Por membro — gastos, receitas e saldo de cada um (só grupo 2+
                membros e sem filtro por membro ativo) */}
            {membroFiltro === 'todos' && (resumo?.por_membro || []).length >= 2 && (
              <ChartCard
                title="Por membro"
                subtitle="Gastos, receitas e saldo de cada um neste mês"
                icon={<Users size={16} className="text-foreground" />}
              >
                <div className="space-y-4">
                  {(resumo.por_membro as any[]).map((m, i) => {
                    const totalGastos = resumo.gastos || 1;
                    const gasto = m.gastos ?? m.total ?? 0;
                    const receita = m.receitas ?? 0;
                    const saldo = m.saldo ?? (receita - gasto);
                    const pct = totalGastos > 0 ? (gasto / totalGastos) * 100 : 0;
                    const cor = `hsl(${(m.user_id || m.name).split('').reduce((h: number, c: string) => c.charCodeAt(0) + ((h << 5) - h), 0) % 360} 65% 50%)`;
                    return (
                      <div key={m.user_id || i} className="animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                        <div className="flex items-center justify-between mb-1.5 gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AvatarMembro name={m.name} size="sm" />
                            <span className="text-sm font-semibold text-foreground truncate">{m.name}</span>
                          </div>
                          <span className="text-sm font-bold text-red-500 dark:text-red-400 tabular flex-shrink-0">−{fmt(gasto)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                               style={{ width: `${Math.min(pct, 100)}%`, background: cor }} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] tabular">
                          <span className="text-green-600 dark:text-green-400">Receitas +{fmt(receita)}</span>
                          <span className={saldo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                            Saldo {saldo >= 0 ? '+' : '−'}{fmt(Math.abs(saldo))}
                          </span>
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
                  <ValorAuto max="1.875rem" className="font-bold text-green-600 dark:text-green-400 tracking-tight">
                    {fmt(totalReceber)}
                  </ValorAuto>
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
                  <ValorAuto max="1.875rem" className="font-bold text-red-500 tracking-tight">{fmt(totalPagar)}</ValorAuto>
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
                    <ValorAuto max="1.25rem" className="font-bold text-white">{fmt(saldoBanco)}</ValorAuto>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-white/60 mb-1 flex items-center gap-1">
                      Saldo previsto <span className="text-[9px] opacity-60">(?)</span>
                    </p>
                    <ValorAuto max="1.25rem" className={`font-bold ${saldoPrevisto >= 0 ? 'text-white' : 'text-red-300'}`}>
                      {fmt(saldoPrevisto)}
                    </ValorAuto>
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
                compartilhado={compartilhado}
                positive
              />
              <PendentesList
                title="Despesas pendentes"
                subtitle="Lançamentos a pagar"
                badgeText="Despesa"
                badgeColor="red"
                items={gastoPendentes}
                empty="Nenhuma despesa pendente"
                compartilhado={compartilhado}
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
              {/* Rótulo com o ANO explícito: "Receitas no ano" sozinho, com o
                  seletor de mês logo acima, dava pra ler como "no mês". */}
              <PremiumStatCard
                label={`Receitas em ${ano}`}
                value={anualData?.receitas || 0}
                icon={TrendingUp}
                hue={142}
                positive
                delay={0}
              />
              <PremiumStatCard
                label={`Despesas em ${ano}`}
                value={anualData?.gastos || 0}
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
              {/* ⚠️ Skeleton de altura IGUAL à do gráfico. Antes o dado era
                  fabricado e sempre existia; agora ele vem da rede, e um
                  bloco de altura diferente daria salto de layout quando
                  chegasse. */}
              {anualCarregando ? (
                <div className="h-[340px] rounded-xl bg-muted/40 animate-pulse"
                     role="status" aria-label="Carregando o fluxo do ano" />
              ) : (
                <>
                  <GraficoFluxo data={dadosFluxo} />
                  <ChartLegend items={[
                    { label: 'Receitas', color: BRAND },
                    { label: 'Despesas', color: RED },
                    { label: 'Saldo',    color: BLUE, dashed: true },
                  ]} />
                </>
              )}
            </ChartCard>

            {/* Resumo mensal em barras */}
            <ChartCard
              title="Comparativo mensal"
              subtitle="Receitas vs Despesas por mês"
              icon={<BarChart3 size={14} className="text-emerald-500" />}
              badgeColor="green"
              fullWidth
            >
              {anualCarregando
                ? <div className="h-[260px] rounded-xl bg-muted/40 animate-pulse"
                       role="status" aria-label="Carregando o comparativo mensal" />
                : <GraficoComparativo data={dadosFluxo} />}
            </ChartCard>
          </div>
        )}
      </div>
    </>
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
        {/* ValorAuto: no mobile o card tem ~2 colunas e o valor negativo
            ("-R$ 2.529,92") quebrava a linha depois do hífen. Agora fica em
            uma linha só e a fonte encolhe só o quanto for preciso. */}
        <ValorAuto
          max="1.5rem"
          className={`font-bold tracking-tight ${
            accent ? (value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500') :
            positive ? 'text-foreground' :
            negative ? 'text-foreground' :
                       'text-foreground'
          }`}
        >
          {fmt(value)}
        </ValorAuto>
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

/* ═══════════════════════════════════════════════════════════════════════
   RITMO DO MÊS — média × mês atual × projeção
   ═══════════════════════════════════════════════════════════════════════ */
function RitmoDoMes({
  media, mesesNaMedia, gastoDoMes, projecao, ehMesAtual, diaHoje, diasNoMes,
  variacao, mesLabel,
}: any) {
  const acima = (variacao ?? 0) > 0;
  // Faixa morta de ±5%: variação de 2% não é "acima da média", é ruído — e
  // apontar isso como sinal treina a pessoa a ignorar o card.
  const relevante = variacao !== null && Math.abs(variacao) >= 5;
  const cor = !relevante ? 'hsl(var(--muted-foreground))' : acima ? RED : BRAND;

  return (
    <div className="space-y-4 mt-1">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <BlocoNum label={`Média mensal`} valor={media}
                  sub={`${mesesNaMedia} ${mesesNaMedia === 1 ? 'mês fechado' : 'meses fechados'}`} />
        <BlocoNum label={`${mesLabel} até agora`} valor={gastoDoMes}
                  sub={ehMesAtual ? `dia ${diaHoje} de ${diasNoMes}` : 'mês fechado'} />
        {projecao !== null && (
          <BlocoNum label="Projeção do mês" valor={projecao} cor={cor} destaque
                    sub="se o ritmo continuar" />
        )}
      </div>

      {/* A frase é o produto do card: o número sozinho não diz o que fazer. */}
      {relevante && (
        <div className="flex items-start gap-2.5 rounded-xl p-3"
             style={{ background: `color-mix(in srgb, ${cor} 10%, transparent)` }}>
          {acima ? <AlertTriangle size={15} style={{ color: cor }} className="flex-shrink-0 mt-0.5" />
                 : <CheckIcon size={15} style={{ color: cor }} className="flex-shrink-0 mt-0.5" />}
          <p className="text-xs text-foreground leading-relaxed">
            {projecao !== null ? 'No ritmo atual, ' : ''}
            {mesLabel} {projecao !== null ? 'deve fechar' : 'fechou'}{' '}
            <strong style={{ color: cor }}>{Math.abs(variacao).toFixed(0)}% {acima ? 'acima' : 'abaixo'}</strong>{' '}
            da sua média — {fmt(Math.abs((projecao ?? gastoDoMes) - media))}{' '}
            {acima ? 'a mais' : 'a menos'} que os {fmt(media)} de sempre.
          </p>
        </div>
      )}

      {/* ⚠️ A projeção é ESTIMATIVA e diz isso na cara. Foi um número inventado
          apresentado como fato que quebrou esta aba antes; um rótulo honesto é
          o que separa as duas coisas. */}
      {projecao !== null && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Gauge size={11} />
          Projeção = o que já saiu ({fmt(gastoDoMes)}) dividido por {diaHoje} dias, vezes {diasNoMes}.
          Não considera contas que ainda vão vencer.
        </p>
      )}
    </div>
  );
}

function BlocoNum({ label, valor, sub, cor, destaque }: any) {
  return (
    <div className={`rounded-xl p-3 ${destaque ? 'ring-1' : ''} bg-muted/30`}
         style={destaque ? { ['--tw-ring-color' as any]: cor, background: `color-mix(in srgb, ${cor} 7%, transparent)` } : undefined}>
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular mt-0.5" style={cor ? { color: cor } : undefined}>{fmt(valor)}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   LINHA DE LIMITE
   ═══════════════════════════════════════════════════════════════════════ */
function LinhaLimite({ nome, limite, gasto, pct, filhas, theme, i }: any) {
  const estourou = pct > 100;
  const perto    = pct >= 80 && pct <= 100;
  // Status é ÍCONE + TEXTO, nunca a cor sozinha.
  const cor = estourou ? RED : perto ? '#f59e0b' : BRAND;
  const restante = limite - gasto;

  return (
    <div className="animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {temMarcaConhecida(nome)
            ? <CategoriaIcon nome={nome} icone={theme.emoji} color={theme.color} size={22} />
            : <span className="text-base flex-shrink-0">{theme.emoji}</span>}
          <span className="text-sm font-medium text-foreground truncate">{nome}</span>
          {/* Diz que o número inclui as filhas — sem isso o usuário estranha
              um gasto maior do que ele lançou naquela categoria. */}
          {filhas > 0 && (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              +{filhas} sub
            </span>
          )}
        </div>
        <span className="text-xs font-bold tabular whitespace-nowrap flex-shrink-0" style={{ color: cor }}>
          {fmt(gasto)} <span className="text-muted-foreground font-medium">/ {fmt(limite)}</span>
        </span>
      </div>

      <div className="h-2 rounded-full bg-muted/60 overflow-hidden"
           role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}
           aria-label={`${nome}: ${Math.round(pct)}% do limite usado`}>
        <div className="h-full rounded-full transition-all duration-700"
             style={{ width: `${Math.min(pct, 100)}%`, background: cor }} />
      </div>

      <p className="text-[11px] mt-1 flex items-center gap-1.5" style={{ color: estourou || perto ? cor : undefined }}>
        {estourou ? <><AlertTriangle size={10} /> Estourou {fmt(-restante)} ({pct.toFixed(0)}%)</>
          : perto ? <><AlertTriangle size={10} /> Faltam {fmt(restante)} ({pct.toFixed(0)}% usado)</>
          : <span className="text-muted-foreground"><CheckIcon size={10} className="inline mr-1" />Sobram {fmt(restante)} ({pct.toFixed(0)}% usado)</span>}
      </p>
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

function EmptyDonut({ label }: { label: string }) {
  return (
    <div className="relative flex flex-col items-center py-4">
      <DonutVazio />
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
  title, subtitle, badgeText, badgeColor, items, empty, positive, compartilhado,
}: {
  title:      string;
  subtitle:   string;
  badgeText:  string;
  badgeColor: 'green' | 'red';
  items:      any[];
  empty:      string;
  positive?:  boolean;
  compartilhado?: boolean;
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
            const catNome = nomeCategoria(tx.categoria);
            // Ícone: prioriza a marca da descrição (ex.: "Shopee", "Spotify")
            const iconeNome = tx.observacao && temMarcaConhecida(tx.observacao) ? tx.observacao : catNome;
            return (
              <div key={tx.id || i}
                   className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors animate-fade-in"
                   // content-visibility: pula render das linhas fora da tela (lista longa).
                   style={{ animationDelay: `${i * 30}ms`, contentVisibility: 'auto', containIntrinsicSize: 'auto 60px' }}>
                <CategoriaIcon
                  nome={iconeNome}
                  icone={theme.emoji}
                  bg={theme.bg}
                  color={theme.color}
                  size={36}
                />
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
                    {compartilhado && tx.criador && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
                          <AvatarMembro name={tx.criador.name} src={tx.criador.avatar_url} preset={tx.criador.avatar_preset} cor={tx.criador.avatar_cor} size="sm" />
                          <span className="truncate">{(tx.criador.name || '').split(' ')[0]}</span>
                        </span>
                      </>
                    )}
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

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import NovaCategoriaModal from '@/components/categorias/NovaCategoriaModal';
import DefinirLimiteModal from '@/components/categorias/DefinirLimiteModal';
import { nomeCategoria } from '@/lib/categorias';
import IconeMarca, { slugDaMarca } from '@/components/ui/IconeMarca';
import {
  Plus, Sparkles, Search, Eye, EyeOff, ChevronDown, ChevronUp,
  Pencil, Trash2, FolderPlus, Target, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  Calendar, Filter, RefreshCw, ServerOff,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts';

const BRAND = '#61D17B';

const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// Cor da barra baseada em % usado do limite
function corPctLimite(pct: number): string {
  if (pct > 100) return '#ef4444'; // vermelho
  if (pct >= 90) return '#ef6c00'; // laranja
  if (pct >= 70) return '#f59e0b'; // amarelo
  return '#22c55e';                // verde
}

// Normaliza cor que pode vir como string hex (#RRGGBB), string HSL "hsl(...)", número (HSL hue)
// ou string numérica. Retorna { fg, bg } prontos para CSS.
function normalizaCor(cor: any): { fg: string; bg: string } {
  if (cor == null) return { fg: 'hsl(220 10% 50%)', bg: 'hsl(220 10% 50% / 0.15)' };

  // Número HSL hue (0-360) — formato salvo pelo NovaCategoriaModal
  if (typeof cor === 'number') {
    return {
      fg: `hsl(${cor} 65% 55%)`,
      bg: `hsl(${cor} 75% 50% / 0.15)`,
    };
  }

  if (typeof cor === 'string') {
    const trim = cor.trim();
    // Hex (#808080) — formato do backend
    if (trim.startsWith('#')) {
      return { fg: trim, bg: `${trim}26` }; // hex alpha 26 ≈ 15%
    }
    // hsl(...) literal
    if (trim.startsWith('hsl') || trim.startsWith('rgb')) {
      return { fg: trim, bg: trim };
    }
    // String numérica "142"
    const n = parseFloat(trim);
    if (!isNaN(n)) {
      return {
        fg: `hsl(${n} 65% 55%)`,
        bg: `hsl(${n} 75% 50% / 0.15)`,
      };
    }
  }

  return { fg: 'hsl(220 10% 50%)', bg: 'hsl(220 10% 50% / 0.15)' };
}

interface Categoria {
  id:         string;
  nome:       string;
  icone?:     string;
  cor?:       number; // HSL hue
  parent_id?: string | null;
  tipo?:      'despesa' | 'receita';
}

interface Limite {
  id?:                 string;
  categoria?:          string;
  limite_mensal?:      number;
  percentual_alerta?:  number;
}

type Filtro = 'todas' | 'com_limite' | 'sem_limite' | 'com_subs' | 'sem_subs';
type TipoTab = 'despesa' | 'receita';

export default function CategoriasPage() {
  const { phone } = useAuth();
  const hoje = new Date();

  const [mesIdx, setMesIdx] = useState(0); // 0 = atual, -1 = passado, +1 = próximo
  const refDate = useMemo(
    () => new Date(hoje.getFullYear(), hoje.getMonth() + mesIdx, 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mesIdx]
  );
  const mesRef = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;
  const mesLabel = `${MESES_NOMES[refDate.getMonth()]} de ${refDate.getFullYear()}`;

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [resumo,     setResumo]     = useState<any>({ por_categoria: [], gastos: 0 });
  const [limites,    setLimites]    = useState<Limite[]>([]);

  const [loading,    setLoading]    = useState(false);
  const [erroFetch,  setErroFetch]  = useState<string | null>(null);
  const [restaurando, setRestaurando] = useState(false);
  const [ocultar,    setOcultar]    = useState(false);
  const [busca,      setBusca]      = useState('');
  const [filtro,     setFiltro]     = useState<Filtro>('todas');
  const [tipoTab,    setTipoTab]    = useState<TipoTab>('despesa');
  const [mostrarZeradas, setMostrarZeradas] = useState(true);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  // Modais
  const [modalCat,  setModalCat]   = useState<{ edicao?: Categoria; parentId?: string; parentNome?: string } | null>(null);
  const [modalLim,  setModalLim]   = useState<Categoria | null>(null);
  const [confirmDel,setConfirmDel] = useState<Categoria | null>(null);

  const carregar = useCallback(async () => {
    if (!phone) return;
    setLoading(true);
    setErroFetch(null);

    // listar é a chamada crítica — se falhar, mostramos estado de erro
    try {
      const cats = await api.categorias.listar(phone);
      setCategorias(cats || []);
    } catch (e: any) {
      console.error('[categorias] listar falhou:', e);
      setErroFetch(e?.message || 'Erro desconhecido ao buscar categorias.');
      setLoading(false);
      return;
    }

    try {
      const r = await api.transacoes.resumo(phone, mesRef);
      setResumo(r || { por_categoria: [], gastos: 0 });
    } catch (e) { console.warn('[categorias] resumo falhou:', e); }

    try {
      const ls = await api.limites.listar(phone, mesRef);
      const arr = Array.isArray(ls) ? ls : (ls?.limites || []);
      setLimites(arr);
    } catch (e) { console.warn('[categorias] limites falhou:', e); }

    setLoading(false);
  }, [phone, mesRef]);

  async function restaurarPadrao() {
    if (!phone || restaurando) return;
    setRestaurando(true);
    try {
      const r = await api.categorias.restaurarPadrao(phone);
      console.log('[categorias] restaurar-padrao OK:', r);
      await carregar();
    } catch (e: any) {
      console.error('[categorias] restaurar-padrao falhou:', e);
      alert(`Falha ao restaurar categorias padrão: ${e?.message || 'erro desconhecido'}`);
    } finally {
      setRestaurando(false);
    }
  }

  useEffect(() => { carregar(); }, [carregar]);

  // ── Helpers ────────────────────────────────────────────────
  const gastoDeNome = (nomeBruto: string): number => {
    const alvo = nomeCategoria(nomeBruto).toLowerCase();
    const cats = resumo?.por_categoria || [];
    const match = cats.find((c: any) => nomeCategoria(c.categoria).toLowerCase() === alvo);
    return match?.total || 0;
  };

  const limiteDeNome = (nomeBruto: string): Limite | undefined => {
    const alvo = nomeCategoria(nomeBruto).toLowerCase();
    return limites.find(l => nomeCategoria(l.categoria || '').toLowerCase() === alvo);
  };

  // Agrupa categorias em árvore: pais e filhas — só do tipo selecionado (default = despesa)
  const arvore = useMemo(() => {
    const pais = categorias.filter(c => !c.parent_id && (c.tipo || 'despesa') === tipoTab);
    return pais.map(p => {
      const filhos = categorias.filter(c => c.parent_id === p.id);
      const gastoProprio = gastoDeNome(p.nome);
      const gastoFilhos  = filhos.reduce((s, f) => s + gastoDeNome(f.nome), 0);
      const gastoTotal   = gastoProprio + gastoFilhos;
      const limite       = limiteDeNome(p.nome);
      return { pai: p, filhos, gastoTotal, gastoProprio, gastoFilhos, limite };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorias, resumo, limites, tipoTab]);

  const totalDespesa = categorias.filter(c => !c.parent_id && (c.tipo || 'despesa') === 'despesa').length;
  const totalReceita = categorias.filter(c => !c.parent_id && c.tipo === 'receita').length;

  // Aplica busca + filtros
  const arvoreFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return arvore.filter(item => {
      const { pai, filhos, gastoTotal, limite } = item;
      if (q && !pai.nome.toLowerCase().includes(q)
        && !filhos.some(f => f.nome.toLowerCase().includes(q))) return false;
      if (!mostrarZeradas && gastoTotal === 0) return false;

      if (filtro === 'com_limite'  && !limite?.limite_mensal) return false;
      if (filtro === 'sem_limite'  && limite?.limite_mensal) return false;
      if (filtro === 'com_subs'    && filhos.length === 0) return false;
      if (filtro === 'sem_subs'    && filhos.length > 0) return false;

      return true;
    });
  }, [arvore, busca, filtro, mostrarZeradas]);

  const totalMes = arvore.reduce((s, x) => s + x.gastoTotal, 0);

  // Dados do donut chart (top 8)
  const dadosPie = useMemo(() => {
    return arvore
      .filter(x => x.gastoTotal > 0)
      .sort((a, b) => b.gastoTotal - a.gastoTotal)
      .slice(0, 8)
      .map(x => ({
        name: x.pai.nome,
        value: x.gastoTotal,
        color: normalizaCor(x.pai.cor).fg,
      }));
  }, [arvore]);

  function toggleExpand(id: string) {
    setExpandidas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleDeletar(c: Categoria) {
    try {
      await api.categorias.deletar(c.id);
      setConfirmDel(null);
      carregar();
    } catch (e: any) {
      alert(e.message || 'Erro ao excluir.');
    }
  }

  const parentsParaDropdown = categorias.filter(c => !c.parent_id);

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
                  {categorias.length} categoria{categorias.length !== 1 ? 's' : ''}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
                Categorias
              </h1>
              <p className="text-muted-foreground text-sm mt-2 max-w-md">
                Organize seus gastos e defina limites por categoria.
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
                onClick={restaurarPadrao}
                disabled={restaurando}
                className="btn-outline px-3 py-2 text-sm gap-2"
                title="Recria as categorias padrão se nenhuma foi criada automaticamente"
              >
                {restaurando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Restaurar padrão
              </button>

              <button
                onClick={() => setModalCat({})}
                className="btn btn-primary px-4 py-2.5 text-sm gap-2 shadow-glow-sm"
              >
                <Plus size={16} /> Nova categoria
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            TABS Despesa / Receita
        ═══════════════════════════════════════════════════════ */}
        <div className="card rounded-2xl p-1.5 animate-fade-in inline-flex" style={{ animationDelay: '30ms' }}>
          <div className="relative flex bg-muted/40 rounded-xl p-1">
            <div
              className="absolute top-1 bottom-1 rounded-lg transition-all duration-200"
              style={{
                width: 'calc(50% - 4px)',
                left: tipoTab === 'despesa' ? '4px' : 'calc(50%)',
                background: tipoTab === 'despesa' ? 'hsl(0 72% 58%)' : '#61D17B',
              }}
            />
            <button
              onClick={() => setTipoTab('despesa')}
              className={`relative px-5 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 inline-flex items-center gap-1.5 ${tipoTab === 'despesa' ? 'text-white' : 'text-muted-foreground'}`}
            >
              💸 Despesa
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tipoTab === 'despesa' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>
                {totalDespesa}
              </span>
            </button>
            <button
              onClick={() => setTipoTab('receita')}
              className={`relative px-5 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 inline-flex items-center gap-1.5 ${tipoTab === 'receita' ? 'text-white' : 'text-muted-foreground'}`}
            >
              💰 Receita
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tipoTab === 'receita' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>
                {totalReceita}
              </span>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            CARD DE RESUMO — valor + donut + navegação de mês
        ═══════════════════════════════════════════════════════ */}
        <div className="card rounded-3xl p-6 sm:p-8 animate-fade-in" style={{ animationDelay: '60ms' }}>
          <div className="flex flex-col lg:flex-row items-center gap-6">
            {/* Total */}
            <div className="flex-1 text-center lg:text-left">
              <p className="text-3xl sm:text-5xl font-bold text-foreground tabular tracking-tight leading-none">
                {ocultar ? '••••••••' : fmt(totalMes)}
              </p>
              <p className="text-muted-foreground text-sm mt-2">
                gasto em <span className="font-semibold text-foreground">{mesLabel}</span>
              </p>
            </div>

            {/* Donut */}
            <div className="w-44 h-44 flex-shrink-0 relative">
              {dadosPie.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosPie}
                      dataKey="value"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      stroke="hsl(var(--bg-card))"
                      strokeWidth={2}
                    >
                      {dadosPie.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any, _n: any, p: any) => [fmt(Number(v)), p.payload.name]}
                      contentStyle={{
                        background: 'hsl(var(--bg-card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full rounded-full border-[14px] border-muted/40 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground text-center px-4">Sem gastos</span>
                </div>
              )}
            </div>

            {/* Navegação de mês */}
            <div className="flex items-center bg-muted/40 rounded-2xl p-1">
              <button
                onClick={() => setMesIdx(i => i - 1)}
                className="p-2 rounded-xl hover:bg-card transition-colors"
                title="Mês anterior"
              >
                <ChevronLeft size={16} className="text-muted-foreground" />
              </button>
              <div className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-foreground min-w-[160px] justify-center">
                <Calendar size={13} className="text-muted-foreground" />
                {mesLabel}
              </div>
              <button
                onClick={() => setMesIdx(i => i + 1)}
                className="p-2 rounded-xl hover:bg-card transition-colors"
                title="Próximo mês"
              >
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            FILTROS
        ═══════════════════════════════════════════════════════ */}
        <div className="card rounded-2xl p-3 flex flex-wrap items-center gap-2 animate-fade-in" style={{ animationDelay: '120ms' }}>
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar categoria..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted/40 border border-transparent focus:border-primary/40 focus:bg-card text-sm outline-none transition-all"
            />
          </div>

          {/* Filtro dropdown */}
          <div className="relative">
            <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={filtro}
              onChange={e => setFiltro(e.target.value as Filtro)}
              className="appearance-none pl-9 pr-9 py-2 rounded-xl bg-muted/40 border border-transparent focus:border-primary/40 focus:bg-card text-sm font-medium outline-none transition-all cursor-pointer"
            >
              <option value="todas">Todas categorias</option>
              <option value="com_limite">Apenas com limite</option>
              <option value="sem_limite">Sem limite definido</option>
              <option value="com_subs">Com subcategorias</option>
              <option value="sem_subs">Sem subcategorias</option>
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>

          {/* Toggle zeradas */}
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors">
            <input
              type="checkbox"
              checked={mostrarZeradas}
              onChange={e => setMostrarZeradas(e.target.checked)}
              className="w-4 h-4 accent-primary rounded"
            />
            <span className="text-xs font-medium text-foreground">Mostrar zeradas</span>
          </label>
        </div>

        {/* ═══════════════════════════════════════════════════════
            LISTA DE CATEGORIAS (accordion)
        ═══════════════════════════════════════════════════════ */}
        <div className="card rounded-3xl overflow-hidden animate-fade-in" style={{ animationDelay: '180ms' }}>
          {/* Cabeçalho da tabela */}
          <div className="px-5 py-3 border-b border-border bg-muted/20">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Categorias
            </p>
          </div>

          {/* Estado de erro */}
          {erroFetch ? (
            <div className="py-12 flex flex-col items-center text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center mb-4">
                <ServerOff size={22} className="text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Não foi possível carregar as categorias</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed">
                {erroFetch}
              </p>
              <p className="text-[11px] text-muted-foreground mt-3 max-w-md leading-relaxed">
                Verifique se o backend está rodando em <code className="bg-muted px-1.5 py-0.5 rounded">{process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}</code> e se o token API está configurado.
              </p>
              <button
                onClick={carregar}
                className="btn btn-primary px-4 py-2 text-sm gap-2 mt-5"
              >
                <RefreshCw size={14} /> Tentar novamente
              </button>
            </div>
          ) : loading && arvoreFiltrada.length === 0 ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : arvoreFiltrada.length === 0 ? (
            // Diferencia: nenhuma categoria existe x filtros não retornaram nada
            categorias.length === 0 ? (
              <div className="py-12 flex flex-col items-center text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-4 text-2xl">
                  📦
                </div>
                <p className="text-sm font-semibold text-foreground">Nenhuma categoria cadastrada</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed">
                  Você ainda não tem categorias. Restaure as categorias padrão da Sora (Mercado, Transporte, Saúde, etc.) ou crie uma nova do zero.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                  <button
                    onClick={restaurarPadrao}
                    disabled={restaurando}
                    className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm"
                  >
                    {restaurando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Restaurar categorias padrão
                  </button>
                  <button
                    onClick={() => setModalCat({})}
                    className="btn-outline px-4 py-2 text-sm gap-2"
                  >
                    <Plus size={14} /> Nova categoria
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Filter size={22} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">Nenhuma categoria encontrada com os filtros</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Ajuste a busca ou o filtro para ver mais resultados.
                </p>
                <button
                  onClick={() => { setBusca(''); setFiltro('todas'); setMostrarZeradas(true); }}
                  className="btn-outline px-4 py-2 text-sm gap-2 mt-4"
                >
                  Limpar filtros
                </button>
              </div>
            )
          ) : (
            <div className="divide-y divide-border/60">
              {arvoreFiltrada.map((item, i) => (
                <CategoriaRow
                  key={item.pai.id}
                  item={item}
                  totalMes={totalMes}
                  ocultar={ocultar}
                  expandida={expandidas.has(item.pai.id)}
                  toggleExpand={() => toggleExpand(item.pai.id)}
                  onEditar={() => setModalCat({ edicao: item.pai })}
                  onExcluir={() => setConfirmDel(item.pai)}
                  onAddSub={() => setModalCat({ parentId: item.pai.id, parentNome: item.pai.nome })}
                  onDefinirLimite={() => setModalLim(item.pai)}
                  onEditarSub={(c) => setModalCat({ edicao: c })}
                  onExcluirSub={(c) => setConfirmDel(c)}
                  gastoSubFn={gastoDeNome}
                  delay={i * 30}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAIS */}
      {modalCat && phone && (
        <NovaCategoriaModal
          phone={phone}
          edicao={modalCat.edicao}
          parentId={modalCat.parentId}
          parentNome={modalCat.parentNome}
          parents={parentsParaDropdown}
          onClose={() => setModalCat(null)}
          onSuccess={carregar}
        />
      )}

      {modalLim && phone && (
        <DefinirLimiteModal
          phone={phone}
          categoria={modalLim}
          limiteExistente={limiteDeNome(modalLim.nome) || null}
          mesRef={mesRef}
          onClose={() => setModalLim(null)}
          onSuccess={carregar}
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
              <h3 className="text-base font-bold text-foreground">Excluir categoria?</h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Tem certeza que deseja excluir <strong className="text-foreground">{confirmDel.nome}</strong>? Esta ação é permanente.
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
// LINHA DE CATEGORIA (accordion)
// ─────────────────────────────────────────────────────────────
interface CategoriaRowProps {
  item: {
    pai: Categoria;
    filhos: Categoria[];
    gastoTotal: number;
    gastoProprio: number;
    gastoFilhos: number;
    limite?: Limite;
  };
  totalMes: number;
  ocultar: boolean;
  expandida: boolean;
  toggleExpand: () => void;
  onEditar: () => void;
  onExcluir: () => void;
  onAddSub: () => void;
  onDefinirLimite: () => void;
  onEditarSub: (c: Categoria) => void;
  onExcluirSub: (c: Categoria) => void;
  gastoSubFn: (nome: string) => number;
  delay: number;
}

function CategoriaRow({
  item, totalMes, ocultar, expandida, toggleExpand,
  onEditar, onExcluir, onAddSub, onDefinirLimite,
  onEditarSub, onExcluirSub, gastoSubFn, delay,
}: CategoriaRowProps) {
  const { pai, filhos, gastoTotal, limite } = item;
  const { fg: cor, bg: corBg } = normalizaCor(pai.cor);

  // % em relação ao total OU ao limite (preferimos limite se houver)
  const pctTotal = totalMes > 0 ? Math.min((gastoTotal / totalMes) * 100, 100) : 0;
  const pctLimite = limite?.limite_mensal
    ? Math.round((gastoTotal / limite.limite_mensal) * 100)
    : 0;
  const corBarra = limite?.limite_mensal ? corPctLimite(pctLimite) : cor;

  return (
    <div className="animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
      {/* Linha principal */}
      <div className="px-3 sm:px-5 py-3 hover:bg-muted/30 transition-colors group">
        <div className="flex items-center gap-3">
          {/* Chevron */}
          <button
            onClick={toggleExpand}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
            disabled={filhos.length === 0}
            style={{ opacity: filhos.length === 0 ? 0.2 : 1 }}
            title={expandida ? 'Recolher' : 'Expandir'}
          >
            {expandida
              ? <ChevronUp size={14} className="text-muted-foreground" />
              : <ChevronDown size={14} className="text-muted-foreground" />}
          </button>

          {/* Emoji ou logo da marca (Spotify, Netflix, etc.) */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 overflow-hidden"
            style={{ background: corBg, color: cor }}
          >
            {slugDaMarca(pai.nome)
              ? <IconeMarca nome={pai.nome} size={22} fallback={<span>{pai.icone || '📦'}</span>} />
              : <span>{pai.icone || '📦'}</span>}
          </div>

          {/* Nome + subcategorias count */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground truncate">{pai.nome}</p>
              {filhos.length > 0 && (
                <span className="text-[10px] font-bold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                  {filhos.length} sub
                </span>
              )}
            </div>
          </div>

          {/* Valor + barra */}
          <div className="hidden sm:flex flex-col items-end gap-1 min-w-[200px]">
            <p className="text-sm font-bold text-foreground tabular">
              {ocultar ? '•••••' : fmt(gastoTotal)}
            </p>
            <div className="w-32 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${limite?.limite_mensal ? Math.min(pctLimite, 100) : pctTotal}%`,
                  background: corBarra,
                }}
              />
            </div>
          </div>

          {/* Limite */}
          <div className="hidden md:block min-w-[140px] text-right">
            {limite?.limite_mensal ? (
              <button
                onClick={onDefinirLimite}
                className="text-xs font-medium hover:underline tabular"
                style={{ color: corPctLimite(pctLimite) }}
              >
                {ocultar
                  ? '•••'
                  : `${fmt(gastoTotal).replace('R$', '').trim()} / ${fmt(limite.limite_mensal).replace('R$', '').trim()}`}
                <span className="ml-1 font-bold">({pctLimite}%)</span>
              </button>
            ) : (
              <button
                onClick={onDefinirLimite}
                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
              >
                <Target size={11} /> Definir limite
              </button>
            )}
          </div>

          {/* Ações */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={onEditar}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="Editar"
            >
              <Pencil size={13} className="text-muted-foreground" />
            </button>
            <button
              onClick={onAddSub}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="Adicionar subcategoria"
            >
              <FolderPlus size={13} className="text-muted-foreground" />
            </button>
            <button
              onClick={onExcluir}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title="Excluir"
            >
              <Trash2 size={13} className="text-muted-foreground hover:text-red-500" />
            </button>
          </div>
        </div>

        {/* Mobile: valor abaixo */}
        <div className="flex sm:hidden items-center justify-between mt-2 ml-12">
          <p className="text-sm font-bold text-foreground tabular">
            {ocultar ? '•••••' : fmt(gastoTotal)}
          </p>
          {limite?.limite_mensal && (
            <span
              className="text-[11px] font-bold tabular"
              style={{ color: corPctLimite(pctLimite) }}
            >
              {pctLimite}%
            </span>
          )}
        </div>
      </div>

      {/* Subcategorias */}
      {expandida && filhos.length > 0 && (
        <div className="bg-muted/15 border-t border-border/40">
          {filhos.map(filho => {
            const { fg: corF, bg: corFBg } = normalizaCor(filho.cor ?? pai.cor);
            const gastoF = gastoSubFn(filho.nome);
            const pctF = gastoTotal > 0 ? (gastoF / gastoTotal) * 100 : 0;

            return (
              <div
                key={filho.id}
                className="pl-12 sm:pl-16 pr-3 sm:pr-5 py-2.5 hover:bg-muted/30 transition-colors group relative"
              >
                {/* Linha lateral indicando hierarquia */}
                <div className="absolute left-7 sm:left-10 top-0 bottom-0 w-px bg-border/60" />

                <div className="flex items-center gap-3">
                  {/* Emoji ou logo da marca (Netflix, Spotify, etc.) */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 overflow-hidden"
                    style={{ background: corFBg, color: corF }}
                  >
                    {slugDaMarca(filho.nome)
                      ? <IconeMarca nome={filho.nome} size={18} fallback={<span>{filho.icone || '📦'}</span>} />
                      : <span>{filho.icone || '📦'}</span>}
                  </div>

                  <p className="text-sm text-foreground flex-1 truncate">{filho.nome}</p>

                  {/* Valor + barra menor */}
                  <div className="hidden sm:flex flex-col items-end gap-1 min-w-[200px]">
                    <p className="text-sm text-foreground tabular">
                      {ocultar ? '•••••' : fmt(gastoF)}
                    </p>
                    <div className="w-28 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(pctF, 100)}%`, background: corF }}
                      />
                    </div>
                  </div>

                  {/* Espaço reservado para alinhar com limite (vazio nas subs) */}
                  <div className="hidden md:block min-w-[140px]" />

                  {/* Ações */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => onEditarSub(filho)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      title="Editar"
                    >
                      <Pencil size={12} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => onExcluirSub(filho)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={12} className="text-muted-foreground hover:text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Mobile valor */}
                <div className="flex sm:hidden items-center justify-end mt-1 ml-11">
                  <p className="text-xs text-foreground tabular">
                    {ocultar ? '•••••' : fmt(gastoF)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import EditarLimiteGeralModal from '@/components/limites/EditarLimiteGeralModal';
import LimiteCategoriaModal from '@/components/limites/LimiteCategoriaModal';
import { nomeCategoria } from '@/lib/categorias';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import {
  Plus, Sparkles, Eye, EyeOff, Pencil, Trash2, Target, Bell, BellOff,
  AlertCircle, Wallet, ChevronRight,
} from 'lucide-react';

const BRAND = '#61D17B';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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

export default function LimitesPage() {
  const { phone } = useAuth();
  const hoje = new Date();
  const mesRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  const [tab, setTab] = useState<Tab>('geral');
  const [ocultar, setOcultar] = useState(false);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [resumo,     setResumo]     = useState<any>({ gastos: 0, por_categoria: [] });
  const [limites,    setLimites]    = useState<CategoryLimit[]>([]);

  // Limite geral
  const [metaMensal,        setMetaMensal]        = useState(0);
  const [geralAtivo,        setGeralAtivo]        = useState(true);
  const [geralAlertaAtivo,  setGeralAlertaAtivo]  = useState(true);
  const [geralAlertaPct,    setGeralAlertaPct]    = useState(80);

  // Modais
  const [editGeralOpen, setEditGeralOpen] = useState(false);
  const [catModal, setCatModal] = useState<{ edicao?: CategoryLimit; categoriaAlvo?: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<CategoryLimit | null>(null);

  const carregar = useCallback(async () => {
    if (!phone) return;
    try {
      const cats = await api.categorias.listar(phone);
      setCategorias(cats || []);
    } catch (e) { console.warn('[limites] categorias erro:', e); }

    try {
      const r = await api.transacoes.resumo(phone, mesRef);
      setResumo(r || { gastos: 0, por_categoria: [] });
    } catch (e) { console.warn('[limites] resumo erro:', e); }

    try {
      const ls = await api.limites.listar(phone, mesRef);
      setMetaMensal(ls?.meta_mensal || 0);
      setGeralAtivo(ls?.meta_mensal_ativo ?? true);
      setGeralAlertaAtivo(ls?.meta_mensal_alerta_ativo ?? true);
      setGeralAlertaPct(ls?.meta_mensal_alerta_pct ?? 80);
      setLimites(Array.isArray(ls?.categorias) ? ls.categorias : []);
    } catch (e) { console.warn('[limites] listar erro:', e); }
  }, [phone, mesRef]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Métricas ───────────────────────────────────────────────
  const gastoTotal = resumo?.gastos || 0;
  const pctUsadoGeral = metaMensal > 0 ? (gastoTotal / metaMensal) * 100 : 0;
  const excedido = metaMensal > 0 && gastoTotal > metaMensal;
  const valorExcedente = excedido ? gastoTotal - metaMensal : 0;
  const valorRestante = !excedido ? metaMensal - gastoTotal : 0;
  const corGeral = corPctLimite(pctUsadoGeral);

  const valorAlertaGeral = metaMensal * (geralAlertaPct / 100);

  // Mapa de gasto por nome de categoria (normalizado sem emoji)
  const gastoPorNome = useMemo(() => {
    const m = new Map<string, number>();
    (resumo?.por_categoria || []).forEach((c: any) => {
      m.set(nomeCategoria(c.categoria).toLowerCase(), c.total || 0);
    });
    return m;
  }, [resumo]);

  function gastoCategoria(nome: string): number {
    return gastoPorNome.get(nomeCategoria(nome).toLowerCase()) || 0;
  }

  // Lista de gastos por categoria (para a seção "mini barras")
  const gastosPorCategoriaLista = useMemo(() => {
    const cats = categorias.filter(c => !c.parent_id);
    return cats
      .map(c => {
        const g = gastoCategoria(c.nome);
        const temLimite = limites.some(l =>
          nomeCategoria(l.categoria).toLowerCase() === nomeCategoria(c.nome).toLowerCase()
        );
        return { cat: c, gasto: g, temLimite };
      })
      .sort((a, b) => b.gasto - a.gasto);
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
              <button onClick={() => setOcultar(v => !v)} className="btn-ghost px-3 py-2 text-sm gap-2"
                title={ocultar ? 'Mostrar valores' : 'Ocultar valores'}>
                {ocultar ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button
                onClick={() => tab === 'geral' ? setEditGeralOpen(true) : setCatModal({})}
                className="btn btn-primary px-4 py-2.5 text-sm gap-2 shadow-glow-sm"
              >
                <Plus size={16} /> {tab === 'geral' ? 'Editar limite geral' : 'Novo limite'}
              </button>
            </div>
          </div>
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
            TAB GERAL
        ═══════════════════════════════════════════════════════ */}
        {tab === 'geral' && (
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
        {tab === 'categoria' && (
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
            {limites.length === 0 ? (
              <div className="card rounded-3xl py-16 flex flex-col items-center text-center px-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-glow-sm"
                     style={{ background: `${BRAND}22` }}>
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
                       style={{ background: `${BRAND}22` }}>
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
          valorInicial={metaMensal}
          ativoInicial={geralAtivo}
          alertaAtivoInicial={geralAlertaAtivo}
          alertaPctInicial={geralAlertaPct}
          onClose={() => setEditGeralOpen(false)}
          onSuccess={carregar}
        />
      )}

      {catModal && phone && (
        <LimiteCategoriaModal
          phone={phone}
          mesRef={mesRef}
          categorias={categorias}
          categoriaAlvo={catModal.categoriaAlvo}
          limiteExistente={catModal.edicao}
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
    </DashboardLayout>
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
        {ocultar ? '••••••' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(limite.limite_mensal)}
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
            {ocultar ? '•••' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(gasto)}
          </span>
          {' '}gasto
        </span>
        <span className="font-bold tabular" style={{ color: cor.bg }}>{Math.round(pct)}%</span>
      </div>

      {excedido && (
        <div className="rounded-lg p-2 bg-red-100 dark:bg-red-950/50 mb-3 animate-pulse">
          <p className="text-[11px] font-bold text-red-700 dark:text-red-400 inline-flex items-center gap-1.5">
            <AlertCircle size={11} /> Excedido em{' '}
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorExc)}
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

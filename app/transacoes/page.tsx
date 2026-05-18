'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import NovaTransacaoModal from '@/components/dashboard/NovaTransacaoModal';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { getCategoriaTheme, nomeCategoria } from '@/lib/categorias';
import {
  Plus, Search, Filter, Download, Upload, ChevronDown, X,
  TrendingUp, TrendingDown, Wallet, Clock, MoreVertical,
  Edit2, Trash2, Eye, EyeOff, ArrowUpRight, ArrowDownRight,
  CheckCircle2, AlertCircle, FileText, Sparkles, Calendar,
} from 'lucide-react';

const BRAND = '#61D17B';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

type Tipo   = 'todos' | 'Gasto' | 'Recebimento';
type Status = 'todos' | 'pago' | 'pendente';

const mesAtual = new Date().toISOString().slice(0, 7);

// ─────────────────────────────────────────────────────────────
// PÁGINA
// ─────────────────────────────────────────────────────────────
export default function TransacoesPage() {
  const { phone } = useAuth();

  const [txs,      setTxs]      = useState<any[]>([]);
  const [wallets,  setWallets]  = useState<any[]>([]);
  const [resumo,   setResumo]   = useState<any>({ receitas: 0, gastos: 0, por_categoria: [] });
  const [modalOpen,setModalOpen]= useState(false);
  const [ocultar,  setOcultar]  = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Filtros
  const [busca,    setBusca]    = useState('');
  const [tipo,     setTipo]     = useState<Tipo>('todos');
  const [status,   setStatus]   = useState<Status>('todos');
  const [catFiltro,setCatFiltro]= useState('todas');
  const [contaId,  setContaId]  = useState('todas');

  // ── Carregamento sem bloquear UI ───────────────────────────
  const carregar = useCallback(async () => {
    if (!phone) return;
    try {
      const t = await api.transacoes.listar(phone, { mes: mesAtual, limit: 200 });
      setTxs(t.transacoes || []);
    } catch (e) { console.warn('[transacoes] listar erro:', e); }
    try {
      const w = await api.wallets.listar(phone);
      setWallets(w || []);
    } catch (e) { console.warn('[transacoes] wallets erro:', e); }
    try {
      const r = await api.transacoes.resumo(phone, mesAtual);
      setResumo(r);
    } catch (e) { console.warn('[transacoes] resumo erro:', e); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Filtros aplicados ──────────────────────────────────────
  const txsFiltradas = useMemo(() => {
    return txs.filter(t => {
      const q = busca.toLowerCase();
      const matchBusca  = !q || t.observacao?.toLowerCase().includes(q) || t.categoria?.toLowerCase().includes(q);
      const matchTipo   = tipo === 'todos' || t.tipo === tipo;
      const matchCat    = catFiltro === 'todas' || t.categoria === catFiltro;
      const matchConta  = contaId === 'todas' || t.wallet_id === contaId;
      const matchStatus = status === 'todos' ||
                          (status === 'pago' && t.pago) ||
                          (status === 'pendente' && !t.pago);
      return matchBusca && matchTipo && matchCat && matchConta && matchStatus;
    });
  }, [txs, busca, tipo, status, catFiltro, contaId]);

  // ── Métricas calculadas das filtradas ──────────────────────
  const receitasTotal = useMemo(() =>
    txsFiltradas.filter(t => t.tipo === 'Recebimento').reduce((s, t) => s + (t.valor || 0), 0),
    [txsFiltradas]);
  const despesasTotal = useMemo(() =>
    txsFiltradas.filter(t => t.tipo === 'Gasto').reduce((s, t) => s + (t.valor || 0), 0),
    [txsFiltradas]);
  const pendentesTotal = useMemo(() =>
    txsFiltradas.filter(t => !t.pago).reduce((s, t) => s + (t.valor || 0), 0),
    [txsFiltradas]);

  const saldoTotal = useMemo(() =>
    wallets.filter(w => w.tipo !== 'Crédito').reduce((s, w) => s + (w.saldo || 0), 0),
    [wallets]);

  // ── Categorias únicas para filtro ──────────────────────────
  const categorias = useMemo(() =>
    Array.from(new Set(txs.map(t => t.categoria).filter(Boolean))),
    [txs]);

  // ── Ações ──────────────────────────────────────────────────
  async function handleDeletar(id: string) {
    if (!confirm('Excluir esta transação?')) return;
    try {
      await api.transacoes.deletar(id);
      setTxs(prev => prev.filter(t => t.id !== id));
      setRowMenuOpen(null);
    } catch (e: any) {
      alert('Erro ao excluir: ' + (e.message || ''));
    }
  }

  function exportarCSV() {
    const header = 'Data,Tipo,Categoria,Descrição,Valor,Conta,Status\n';
    const rows = txsFiltradas.map(t =>
      `${fmtData(t.data)},${t.tipo},${nomeCategoria(t.categoria)},"${t.observacao || ''}",${t.valor},${t.wallet_nome || ''},${t.pago ? 'Pago' : 'Pendente'}`
    ).join('\n');
    const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transacoes-${mesAtual}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function limparFiltros() {
    setBusca(''); setTipo('todos'); setStatus('todos'); setCatFiltro('todas'); setContaId('todas');
  }

  const temFiltro = busca || tipo !== 'todos' || status !== 'todos' || catFiltro !== 'todas' || contaId !== 'todas';

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">

        {/* ═══════════════════════════════════════════════════════
            HERO HEADER
        ═══════════════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in border border-border/60"
             style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>

          {/* Mesh decorativo */}
          <div className="absolute inset-0 pointer-events-none opacity-50"
               style={{ background: 'radial-gradient(ellipse at top right, hsl(134 55% 60% / .12) 0%, transparent 60%)' }} />

          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
                <Sparkles size={12} style={{ color: BRAND }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND }}>
                  {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
                Transações
              </h1>
              <p className="text-muted-foreground text-sm mt-2 max-w-md">
                Gerencie todas as suas movimentações financeiras em um só lugar
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

              <div className="relative">
                <button
                  onClick={() => setImportMenuOpen(v => !v)}
                  className="btn-outline px-3 py-2 text-sm gap-2"
                >
                  <Upload size={14} /> Importar <ChevronDown size={12} />
                </button>
                {importMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setImportMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-52 card p-1.5 z-20 animate-fade-in">
                      <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted text-sm text-foreground transition-colors">
                        <FileText size={14} className="text-muted-foreground" />
                        <span>Importar OFX</span>
                      </button>
                      <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted text-sm text-foreground transition-colors">
                        <FileText size={14} className="text-muted-foreground" />
                        <span>Importar extrato (CSV)</span>
                      </button>
                      <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted text-sm text-foreground transition-colors">
                        <FileText size={14} className="text-muted-foreground" />
                        <span>Importar PDF</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button onClick={exportarCSV} className="btn-outline px-3 py-2 text-sm gap-2">
                <Download size={14} /> Exportar
              </button>

              <button
                onClick={() => setModalOpen(true)}
                className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm"
              >
                <Plus size={16} /> Nova transação
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            STAT CARDS (4)
        ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Saldo total — escuro/premium */}
          <div className="relative overflow-hidden rounded-2xl p-5 animate-fade-in"
               style={{ background: 'linear-gradient(135deg, #0a1f12 0%, #1a3d28 100%)' }}>
            <div className="absolute inset-0 opacity-30"
                 style={{ background: `radial-gradient(circle at 80% 20%, ${BRAND} 0%, transparent 60%)` }} />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold">Saldo</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${BRAND}30` }}>
                  <Wallet size={13} style={{ color: BRAND }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-white tabular tracking-tight">
                {ocultar ? '••••••' : fmt(saldoTotal)}
              </p>
              <p className="text-white/40 text-xs mt-1.5">
                {wallets.filter(w => w.tipo !== 'Crédito').length} conta{wallets.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Receitas */}
          <StatCard
            label="Receitas"
            value={ocultar ? null : receitasTotal}
            icon={TrendingUp}
            colorHue={142}
            sub={`${txsFiltradas.filter(t => t.tipo === 'Recebimento').length} entradas`}
            delay={60}
            positive
          />

          {/* Despesas */}
          <StatCard
            label="Despesas"
            value={ocultar ? null : despesasTotal}
            icon={TrendingDown}
            colorHue={0}
            sub={`${txsFiltradas.filter(t => t.tipo === 'Gasto').length} saídas`}
            delay={120}
            negative
          />

          {/* Pendentes */}
          <StatCard
            label="Pendentes"
            value={ocultar ? null : pendentesTotal}
            icon={Clock}
            colorHue={38}
            sub={`${txsFiltradas.filter(t => !t.pago).length} aguardando`}
            delay={180}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════
            BARRA DE FILTROS
        ═══════════════════════════════════════════════════════ */}
        <div className="card rounded-2xl p-4 animate-fade-in" style={{ animationDelay: '240ms' }}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">

            {/* Busca */}
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por descrição, categoria..."
                className="input pl-10 py-2.5 w-full"
              />
              {busca && (
                <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted">
                  <X size={13} className="text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Pílulas de tipo */}
            <div className="flex gap-1 bg-muted/60 rounded-xl p-1">
              {([
                { v: 'todos',       l: 'Todas'    },
                { v: 'Recebimento', l: 'Receitas' },
                { v: 'Gasto',       l: 'Despesas' },
              ] as { v: Tipo; l: string }[]).map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setTipo(opt.v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tipo === opt.v
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>

            {/* Status */}
            <select
              value={status}
              onChange={e => setStatus(e.target.value as Status)}
              className="input py-2.5 text-sm w-32"
            >
              <option value="todos">Status</option>
              <option value="pago">Pagos</option>
              <option value="pendente">Pendentes</option>
            </select>

            {/* Categoria */}
            {categorias.length > 0 && (
              <select
                value={catFiltro}
                onChange={e => setCatFiltro(e.target.value)}
                className="input py-2.5 text-sm w-40"
              >
                <option value="todas">Categorias</option>
                {categorias.map(c => (
                  <option key={c} value={c}>{nomeCategoria(c)}</option>
                ))}
              </select>
            )}

            {/* Conta */}
            {wallets.length > 0 && (
              <select
                value={contaId}
                onChange={e => setContaId(e.target.value)}
                className="input py-2.5 text-sm w-36"
              >
                <option value="todas">Contas</option>
                {wallets.map(w => (
                  <option key={w.id} value={w.id}>{w.nome}</option>
                ))}
              </select>
            )}

            {temFiltro && (
              <button
                onClick={limparFiltros}
                className="btn-ghost px-3 py-2 text-xs gap-1.5 text-muted-foreground"
              >
                <X size={13} /> Limpar
              </button>
            )}
          </div>

          {/* Bar de seleção */}
          {selecionados.size > 0 && (
            <div className="mt-3 -mb-1 flex items-center justify-between bg-primary/10 rounded-xl px-4 py-2.5 animate-fade-in">
              <p className="text-xs font-medium text-foreground">
                {selecionados.size} selecionada{selecionados.size > 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setSelecionados(new Set())}
                        className="text-xs text-muted-foreground hover:text-foreground">
                  Limpar
                </button>
                <span className="text-muted-foreground">·</span>
                <button className="text-xs text-red-500 hover:text-red-600 font-medium">
                  Excluir
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            LISTA DE TRANSAÇÕES
        ═══════════════════════════════════════════════════════ */}
        <div className="card rounded-2xl overflow-hidden animate-fade-in" style={{ animationDelay: '300ms' }}>

          {/* Header com contador */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-foreground">Movimentações</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium tabular">
                {txsFiltradas.length}
              </span>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:block">
              Ordenado por data (mais recente)
            </span>
          </div>

          {txsFiltradas.length === 0 ? (
            <EmptyState temFiltro={!!temFiltro} onLimpar={limparFiltros} onCriar={() => setModalOpen(true)} />
          ) : (
            <>
              {/* Cabeçalho de colunas (desktop) */}
              <div className="hidden lg:grid grid-cols-[24px_minmax(0,2fr)_140px_140px_120px_120px_40px] gap-3 items-center px-5 py-2.5 border-b border-border/60 bg-muted/30">
                <div></div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Descrição</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Categoria</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Conta</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Data</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-right">Valor</span>
                <div></div>
              </div>

              {/* Linhas */}
              <div className="divide-y divide-border/40">
                {txsFiltradas.map((tx, i) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    index={i}
                    ocultar={ocultar}
                    selecionado={selecionados.has(tx.id)}
                    onToggleSelect={() => {
                      const novo = new Set(selecionados);
                      if (novo.has(tx.id)) novo.delete(tx.id);
                      else novo.add(tx.id);
                      setSelecionados(novo);
                    }}
                    menuOpen={rowMenuOpen === tx.id}
                    onToggleMenu={() => setRowMenuOpen(rowMenuOpen === tx.id ? null : tx.id)}
                    onCloseMenu={() => setRowMenuOpen(null)}
                    onDeletar={() => handleDeletar(tx.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

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

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, colorHue, sub, delay = 0, positive, negative,
}: {
  label:    string;
  value:    number | null;
  icon:     any;
  colorHue: number;
  sub:      string;
  delay?:   number;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="card rounded-2xl p-5 relative overflow-hidden animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none opacity-40"
           style={{ background: `radial-gradient(circle, hsl(${colorHue} 80% 55% / .2) 0%, transparent 70%)` }} />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{label}</p>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
               style={{ background: `hsl(${colorHue} 80% 55% / 0.12)` }}>
            <Icon size={13} style={{ color: `hsl(${colorHue} 65% 50%)` }} />
          </div>
        </div>

        <p className={`text-2xl font-bold tabular tracking-tight ${
          positive ? 'text-foreground' : negative ? 'text-foreground' : 'text-foreground'
        }`}>
          {value === null ? '••••••' : fmt(value)}
        </p>

        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
          {positive && <ArrowUpRight size={11} className="text-green-500" />}
          {negative && <ArrowDownRight size={11} className="text-red-500" />}
          {sub}
        </p>
      </div>
    </div>
  );
}

function TransactionRow({
  tx, index, ocultar, selecionado, onToggleSelect,
  menuOpen, onToggleMenu, onCloseMenu, onDeletar,
}: any) {
  const isGasto = tx.tipo === 'Gasto';
  const theme   = getCategoriaTheme(tx.categoria || '');
  const nome    = nomeCategoria(tx.categoria);
  const desc    = tx.observacao || nome;

  return (
    <div
      className={`group relative grid grid-cols-[24px_minmax(0,2fr)_120px_40px] lg:grid-cols-[24px_minmax(0,2fr)_140px_140px_120px_120px_40px] gap-3 items-center px-5 py-3.5 transition-colors animate-fade-in ${
        selecionado ? 'bg-primary/5' : 'hover:bg-muted/40'
      }`}
      style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
    >
      {/* Checkbox */}
      <button
        onClick={onToggleSelect}
        className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${
          selecionado
            ? 'border-primary bg-primary'
            : 'border-border hover:border-primary/60'
        }`}
      >
        {selecionado && <CheckCircle2 size={10} className="text-white" />}
      </button>

      {/* Descrição com emoji da categoria */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ring-1"
          style={{ background: theme.bg, boxShadow: `inset 0 0 0 1px ${theme.ring}` }}
        >
          {theme.emoji}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{desc}</p>
          <div className="flex items-center gap-1.5 mt-0.5 lg:hidden">
            <span className="text-xs text-muted-foreground">{fmtData(tx.data)}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs font-medium" style={{ color: theme.color }}>{nome}</span>
          </div>
        </div>
      </div>

      {/* Categoria (desktop) */}
      <div className="hidden lg:flex items-center">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ background: theme.bg, color: theme.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: theme.color }} />
          {nome}
        </span>
      </div>

      {/* Conta (desktop) */}
      <div className="hidden lg:flex items-center min-w-0">
        <span className="text-xs text-muted-foreground truncate">{tx.wallet_nome || '—'}</span>
      </div>

      {/* Data (desktop) */}
      <div className="hidden lg:flex items-center">
        <span className="text-xs text-muted-foreground tabular">{fmtData(tx.data)}</span>
      </div>

      {/* Valor + status */}
      <div className="text-right min-w-0">
        <p className={`text-sm font-bold tabular ${
          isGasto ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'
        }`}>
          {ocultar ? '••••' : `${isGasto ? '−' : '+'}${fmt(tx.valor)}`}
        </p>
        <p className="hidden lg:block mt-0.5">
          {tx.pago ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 dark:text-green-400">
              <CheckCircle2 size={9} /> Pago
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              <Clock size={9} /> Pendente
            </span>
          )}
        </p>
      </div>

      {/* Menu de ações */}
      <div className="relative flex justify-end">
        <button
          onClick={onToggleMenu}
          className="p-1.5 rounded-lg hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreVertical size={14} className="text-muted-foreground" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={onCloseMenu} />
            <div className="absolute right-0 top-full mt-1 w-36 card p-1 z-20 animate-fade-in">
              <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-muted text-xs text-foreground">
                <Edit2 size={12} className="text-muted-foreground" /> Editar
              </button>
              <button
                onClick={onDeletar}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-xs text-red-500"
              >
                <Trash2 size={12} /> Excluir
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ temFiltro, onLimpar, onCriar }: { temFiltro: boolean; onLimpar: () => void; onCriar: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center relative">
      <div className="absolute inset-0 pointer-events-none opacity-30"
           style={{ background: `radial-gradient(ellipse at center, ${BRAND}15 0%, transparent 60%)` }} />

      <div className="relative">
        <div className="mx-auto w-20 h-20 rounded-3xl flex items-center justify-center mb-5 ring-1 ring-primary/20"
             style={{ background: `linear-gradient(135deg, ${BRAND}25, ${BRAND}10)` }}>
          {temFiltro
            ? <Filter size={28} style={{ color: BRAND }} />
            : <Plus   size={28} style={{ color: BRAND }} />}
        </div>

        {temFiltro ? (
          <>
            <p className="text-foreground font-bold text-lg">Nenhuma transação encontrada</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
              Tente ajustar os filtros para encontrar o que procura
            </p>
            <button
              onClick={onLimpar}
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-2xl font-semibold text-sm bg-muted hover:bg-muted/70 text-foreground transition-all"
            >
              <X size={14} /> Limpar filtros
            </button>
          </>
        ) : (
          <>
            <p className="text-foreground font-bold text-lg">Nenhuma transação ainda</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
              Envie uma mensagem para a Sora no WhatsApp ou adicione manualmente
            </p>
            <button
              onClick={onCriar}
              className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-2xl font-semibold text-sm text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${BRAND}, hsl(154 55% 50%))`,
                boxShadow: `0 8px 24px ${BRAND}45, 0 2px 6px ${BRAND}33`,
              }}
            >
              <Plus size={16} strokeWidth={2.5} /> Adicionar transação
            </button>
          </>
        )}
      </div>
    </div>
  );
}

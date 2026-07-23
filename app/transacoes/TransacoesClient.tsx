'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import NovaTransacaoModal from '@/components/dashboard/NovaTransacaoModal';
import ImportarModal from '@/components/transacoes/ImportarModal';
import EditarTransacaoModal from '@/components/transacoes/EditarTransacaoModal';
import GastosFixosSection from '@/components/transacoes/GastosFixosSection';
import AvatarMembro from '@/components/ui/AvatarMembro';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { getCategoriaTheme, nomeCategoria } from '@/lib/categorias';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import { temMarcaConhecida } from '@/components/ui/IconeMarca';
import {
  Plus, Search, Filter, Download, Upload, ChevronDown, X,
  TrendingUp, TrendingDown, Wallet, Clock, MoreVertical,
  Edit2, Trash2, Eye, EyeOff, ArrowUpRight, ArrowDownRight, ArrowLeftRight,
  CheckCircle2, AlertCircle, FileText, Sparkles, Calendar,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

const BRAND = 'hsl(var(--primary))';

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
export default function TransacoesClient({ phoneInicial, initialData }: { phoneInicial?: string; initialData?: any } = {}) {
  const { phone: authPhone, podeUsar, perfil } = useAuth();
  const phone = authPhone || phoneInicial || ''; // SSR: phone do servidor até hidratar
  const podeImportarOFX = podeUsar('import_ofx');
  // Em grupo compartilhado (não-Pessoal), mostra o avatar de quem fez cada lançamento.
  const compartilhado = !/pessoal/i.test((perfil?.grupo_ativo as any)?.nome || '');
  const podeImportarCSV = podeUsar('import_csv');
  const podeImportar = podeImportarOFX || podeImportarCSV;
  const podeExportar = podeUsar('export_dados');

  const [modalOpen,setModalOpen]= useState(false);
  const [ocultar,  setOcultar]  = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importarFormato, setImportarFormato] = useState<'ofx' | 'csv' | null>(null);
  const [importToast, setImportToast] = useState<string>('');
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null);
  const [editTx, setEditTx] = useState<any | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Filtros
  const [busca,    setBusca]    = useState('');
  const [tipo,     setTipo]     = useState<Tipo>('todos');
  const [status,   setStatus]   = useState<Status>('todos');
  const [catFiltro,setCatFiltro]= useState('todas');
  const [contaId,  setContaId]  = useState('todas');
  const [membroFiltro, setMembroFiltro] = useState('todos'); // só em grupo compartilhado
  const [cartaoFiltro, setCartaoFiltro] = useState('todos'); // por cartão virtual (Open Finance)

  // Mês visualizado (0 = atual, -1 = anterior…) — pra ver meses passados,
  // ex.: transações importadas de um extrato OFX de meses anteriores.
  const [mesIndex, setMesIndex] = useState(0);
  const refDate = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + mesIndex, 1);
  }, [mesIndex]);
  const mesRef = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;
  const mesLabel = refDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // ── Dados via SWR: cache em memória → revisitar a tela ou trocar de mês é
  // instantâneo (mostra o último dado e revalida em silêncio). keepPreviousData
  // evita piscar pra vazio ao navegar entre meses.
  const { data: txData, mutate: mTx } = useApi(phone ? `tx:list:${phone}:${mesRef}` : null,    () => api.transacoes.listar(phone, { mes: mesRef, limit: 500 }), { fallbackData: initialData?.tx });
  const { data: wData,  mutate: mW }  = useApi(phone ? `tx:wallets:${phone}` : null,            () => api.wallets.listar(phone), { fallbackData: initialData?.wallets });
  const { data: rData,  mutate: mR }  = useApi(phone ? `tx:resumo:${phone}:${mesRef}` : null,   () => api.transacoes.resumo(phone, mesRef), { fallbackData: initialData?.resumo });

  const txs: any[]     = txData?.transacoes ?? [];
  const wallets: any[] = wData ?? [];
  const resumo: any    = rData ?? { receitas: 0, gastos: 0, por_categoria: [] };

  // Revalida tudo (usado após criar/importar transação).
  const carregar = useCallback(() => { mTx(); mW(); mR(); }, [mTx, mW, mR]);

  // ── Filtros aplicados ──────────────────────────────────────
  const txsFiltradas = useMemo(() => {
    return txs.filter(t => {
      const q = busca.toLowerCase();
      const matchBusca  = !q || t.observacao?.toLowerCase().includes(q) || t.categoria?.toLowerCase().includes(q);
      const matchTipo   = tipo === 'todos' || t.tipo === tipo;
      const matchCat    = catFiltro === 'todas' || t.categoria === catFiltro;
      const matchConta  = contaId === 'todas' || (t.carteira_nome || t.wallet_nome) === contaId;
      const matchStatus = status === 'todos' ||
                          (status === 'pago' && t.pago) ||
                          (status === 'pendente' && !t.pago);
      const matchMembro = membroFiltro === 'todos' || t.criado_por === membroFiltro;
      const matchCartao = cartaoFiltro === 'todos' || t.pluggy_card === cartaoFiltro;
      return matchBusca && matchTipo && matchCat && matchConta && matchStatus && matchMembro && matchCartao;
    });
  }, [txs, busca, tipo, status, catFiltro, contaId, membroFiltro, cartaoFiltro]);

  // ── Métricas calculadas das filtradas ──────────────────────
  const receitasTotal = useMemo(() =>
    txsFiltradas.filter(t => t.tipo === 'Recebimento').reduce((s, t) => s + (t.valor || 0), 0),
    [txsFiltradas]);
  // Exclui transferências/pagamento de fatura do total de despesas (não é
  // consumo — as compras já contam nas categorias reais). Bate com o /resumo.
  const despesasTotal = useMemo(() =>
    txsFiltradas
      .filter(t => t.tipo === 'Gasto' && !t.transferencia && t.categoria !== 'Fatura cartão' && t.categoria !== 'Transferências')
      .reduce((s, t) => s + (t.valor || 0), 0),
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

  // ── Membros que aparecem nas transações (pro filtro "por membro") ──
  const membros = useMemo(() => {
    const map = new Map<string, any>();
    for (const t of txs) {
      if (t.criado_por && t.criador && !map.has(t.criado_por)) map.set(t.criado_por, t.criador);
    }
    return Array.from(map, ([id, c]) => ({ id, ...c }));
  }, [txs]);

  // ── Cartões virtuais que aparecem nas transações (Open Finance) ──
  const cartoes = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txs) if (t.pluggy_card) map.set(t.pluggy_card, (map.get(t.pluggy_card) || 0) + 1);
    return Array.from(map, ([numero, qtd]) => ({ numero, qtd })).sort((a, b) => b.qtd - a.qtd);
  }, [txs]);

  // ── Ações ──────────────────────────────────────────────────
  async function handleDeletar(tx: any) {
    const id = typeof tx === 'string' ? tx : tx?.id;
    const ehParcela = tx && typeof tx !== 'string' && !!tx.parcela_grupo && (tx.parcela_total || 0) > 1;
    let excluirTodas = false;
    if (ehParcela) {
      if (!confirm(`Excluir a parcela ${tx.parcela_num}/${tx.parcela_total}?`)) return;
      excluirTodas = confirm(
        `Excluir TODAS as ${tx.parcela_total} parcelas dessa compra?\n\n` +
        `OK = todas  ·  Cancelar = só esta (${tx.parcela_num}/${tx.parcela_total})`
      );
    } else {
      if (!confirm('Excluir esta transação?')) return;
    }
    setRowMenuOpen(null);
    // Remoção otimista via SWR — some da lista na hora, reverte se a API falhar.
    try {
      await mTx(
        async () => { await api.transacoes.deletar(id, phone, excluirTodas ? { parcelas: 'todas' } : undefined); return undefined; },
        {
          optimisticData: (cur: any) => {
            const remover = excluirTodas
              ? (t: any) => t.parcela_grupo !== tx.parcela_grupo
              : (t: any) => t.id !== id;
            return { ...(cur || { transacoes: [], total: 0 }), transacoes: (cur?.transacoes || []).filter(remover) };
          },
          rollbackOnError: true,
          populateCache: false,
          revalidate: true,
        },
      );
      mR(); // os totais do resumo mudam após excluir
    } catch (e: any) {
      alert('Erro ao excluir: ' + (e.message || ''));
    }
  }

  // Exclui todas as transações selecionadas de uma vez (otimista).
  async function handleExcluirSelecionados() {
    const ids = Array.from(selecionados);
    if (!ids.length) return;
    if (!confirm(`Excluir ${ids.length} transação${ids.length > 1 ? 'ões' : ''} selecionada${ids.length > 1 ? 's' : ''}?`)) return;
    const alvo = new Set(ids);
    try {
      await mTx(
        async () => {
          // Em lotes de 20 (não derruba o rate limit ao excluir centenas).
          for (let i = 0; i < ids.length; i += 20) {
            await Promise.all(ids.slice(i, i + 20).map(id => api.transacoes.deletar(id, phone)));
          }
          return undefined;
        },
        {
          optimisticData: (cur: any) => ({ ...(cur || { transacoes: [], total: 0 }), transacoes: (cur?.transacoes || []).filter((t: any) => !alvo.has(t.id)) }),
          rollbackOnError: true,
          populateCache: false,
          revalidate: true,
        },
      );
      setSelecionados(new Set());
      mR();
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
    setBusca(''); setTipo('todos'); setStatus('todos'); setCatFiltro('todas'); setContaId('todas'); setMembroFiltro('todos'); setCartaoFiltro('todos');
  }

  const temFiltro = busca || tipo !== 'todos' || status !== 'todos' || catFiltro !== 'todas' || contaId !== 'todas' || membroFiltro !== 'todos' || cartaoFiltro !== 'todos';

  return (
    <>
      <div className="max-w-7xl mx-auto pb-20 space-y-6 overflow-x-clip">

        {/* ═══════════════════════════════════════════════════════
            HERO HEADER
        ═══════════════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in border border-border/60"
             style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>

          {/* Mesh decorativo */}
          <div className="absolute inset-0 pointer-events-none opacity-50"
               style={{ background: 'radial-gradient(ellipse at top right, hsl(var(--primary) / .12) 0%, transparent 60%)' }} />

          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-1 mb-3">
                <button
                  onClick={() => setMesIndex(i => i - 1)}
                  aria-label="Mês anterior"
                  className="w-7 h-7 rounded-full flex items-center justify-center bg-primary/10 hover:bg-primary/20 transition-colors"
                  style={{ color: BRAND }}>
                  <ChevronLeft size={15} />
                </button>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 min-w-[120px] text-center" style={{ color: BRAND }}>
                  {mesLabel}
                </span>
                <button
                  onClick={() => setMesIndex(i => Math.min(i + 1, 0))}
                  disabled={mesIndex >= 0}
                  aria-label="Próximo mês"
                  className="w-7 h-7 rounded-full flex items-center justify-center bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ color: BRAND }}>
                  <ChevronRight size={15} />
                </button>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
                Transações
              </h1>
              <p className="text-muted-foreground text-sm mt-2 max-w-md">
                Gerencie todas as suas movimentações financeiras em um só lugar
              </p>
            </div>

            {/* Ações — mobile: CTA primário em full-width, secundários em row compact */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              {/* CTA primário (sempre visível e grande no mobile) */}
              <button
                onClick={() => setModalOpen(true)}
                className="btn btn-primary w-full sm:w-auto px-4 py-3 sm:py-2 text-sm gap-2 shadow-glow-sm order-first"
              >
                <Plus size={16} /> Nova transação
              </button>

              {/* Ações secundárias (row compacto) */}
              <div className="flex items-center gap-2 order-last">
                <button
                  onClick={() => setOcultar(v => !v)}
                  className="btn-ghost p-2.5 sm:px-3 sm:py-2 text-sm"
                  title={ocultar ? 'Mostrar valores' : 'Ocultar valores'}
                  aria-label={ocultar ? 'Mostrar valores' : 'Ocultar valores'}
                >
                  {ocultar ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>

              <div className="relative">
                <button
                  onClick={() => podeImportar ? setImportMenuOpen(v => !v) : alert('Importação de OFX/CSV está disponível no plano Premium.')}
                  className="btn-outline p-2.5 sm:px-3 sm:py-2 text-sm gap-2"
                  title={podeImportar ? 'Importar extrato' : 'Disponível no plano Premium'}
                  aria-label="Importar"
                >
                  <Upload size={14} />
                  <span className="hidden sm:inline">Importar</span>
                  <ChevronDown size={12} className="hidden sm:block" />
                </button>
                {importMenuOpen && podeImportar && (
                  <>
                    {/* Backdrop pra fechar (escurece no mobile, invisível no desktop) */}
                    <div className="fixed inset-0 z-40 bg-black/30 sm:bg-transparent" onClick={() => setImportMenuOpen(false)} />
                    {/* Bottom sheet no mobile (fixed → escapa do overflow-hidden do hero);
                        dropdown normal no desktop. */}
                    <div className="fixed inset-x-3 bottom-3 z-50 card p-1.5 animate-fade-in
                                    sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-52">
                      <button
                        onClick={() => { setImportarFormato('ofx'); setImportMenuOpen(false); }}
                        disabled={!podeImportarOFX}
                        className="w-full flex items-center gap-2.5 px-3 py-3 sm:py-2 rounded-lg hover:bg-muted text-sm text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FileText size={14} className="text-muted-foreground" />
                        <span>Importar OFX</span>
                      </button>
                      <button
                        onClick={() => { setImportarFormato('csv'); setImportMenuOpen(false); }}
                        disabled={!podeImportarCSV}
                        className="w-full flex items-center gap-2.5 px-3 py-3 sm:py-2 rounded-lg hover:bg-muted text-sm text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FileText size={14} className="text-muted-foreground" />
                        <span>Importar extrato (CSV)</span>
                      </button>
                      <button
                        disabled
                        title="Em breve"
                        className="w-full flex items-center gap-2.5 px-3 py-3 sm:py-2 rounded-lg text-sm text-muted-foreground/60 cursor-not-allowed"
                      >
                        <FileText size={14} />
                        <span>Importar PDF</span>
                        <span className="ml-auto text-[9px] uppercase tracking-wider font-bold bg-muted px-1.5 py-0.5 rounded-full">Em breve</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => podeExportar ? exportarCSV() : alert('Exportação de dados está disponível no plano Premium.')}
                className="btn-outline p-2.5 sm:px-3 sm:py-2 text-sm gap-2"
                title={podeExportar ? 'Exportar CSV' : 'Disponível no plano Premium'}
                aria-label="Exportar"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Exportar</span>
              </button>
              </div> {/* fecha row secundário */}
            </div> {/* fecha container de ações */}
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
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${BRAND} 19%, transparent)` }}>
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
            sub={`${txsFiltradas.filter(t => t.tipo === 'Gasto' && !t.transferencia && t.categoria !== 'Fatura cartão').length} saídas`}
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
            GASTOS FIXOS (recorrências)
        ═══════════════════════════════════════════════════════ */}
        <GastosFixosSection phone={phone} wallets={wallets} />

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

            {/* Pílulas de tipo — centralizadas */}
            <div className="flex justify-center gap-1 bg-muted/60 rounded-xl p-1">
              {([
                { v: 'todos',       l: 'Todas'    },
                { v: 'Recebimento', l: 'Receitas' },
                { v: 'Gasto',       l: 'Despesas' },
              ] as { v: Tipo; l: string }[]).map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setTipo(opt.v)}
                  className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    tipo === opt.v
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>

            {/* Filtros secundários — row único, mesmo tamanho */}
            <div className="grid grid-cols-3 gap-2">
              <select
                value={status}
                onChange={e => setStatus(e.target.value as Status)}
                className="input py-2.5 text-sm text-foreground"
              >
                <option value="todos">Status</option>
                <option value="pago">Pagos</option>
                <option value="pendente">Pendentes</option>
              </select>

              <select
                value={catFiltro}
                onChange={e => setCatFiltro(e.target.value)}
                className="input py-2.5 text-sm text-foreground"
              >
                <option value="todas">Categorias</option>
                {categorias.map(c => (
                  <option key={c} value={c}>{nomeCategoria(c)}</option>
                ))}
              </select>

              <select
                value={contaId}
                onChange={e => setContaId(e.target.value)}
                className="input py-2.5 text-sm text-foreground"
              >
                <option value="todas">Contas</option>
                {wallets.map(w => (
                  <option key={w.id} value={w.nome}>{w.nome}</option>
                ))}
              </select>
            </div>

            {/* Filtro por membro — só em grupo compartilhado com mais de um autor */}
            {compartilhado && membros.length > 1 && (
              <select
                value={membroFiltro}
                onChange={e => setMembroFiltro(e.target.value)}
                className="input py-2.5 text-sm text-foreground w-full"
              >
                <option value="todos">👥 Todos os membros</option>
                {membros.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}

            {/* Filtro por cartão virtual — quando o Open Finance traz o final do cartão */}
            {cartoes.length > 1 && (
              <select
                value={cartaoFiltro}
                onChange={e => setCartaoFiltro(e.target.value)}
                className="input py-2.5 text-sm text-foreground w-full"
              >
                <option value="todos">💳 Todos os cartões</option>
                {cartoes.map(c => (
                  <option key={c.numero} value={c.numero}>final {c.numero} · {c.qtd}</option>
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
          {selecionados.size > 0 && (() => {
            const todasSelec = txsFiltradas.length > 0 && txsFiltradas.every(t => selecionados.has(t.id));
            return (
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-primary/10 rounded-xl px-3 py-2.5 animate-fade-in">
              <p className="text-xs font-medium text-foreground">
                {selecionados.size} selecionada{selecionados.size > 1 ? 's' : ''}
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <button
                  onClick={() => todasSelec
                    ? setSelecionados(new Set())
                    : setSelecionados(new Set(txsFiltradas.map(t => t.id)))}
                  className="text-xs font-medium text-primary hover:underline">
                  {todasSelec ? 'Desmarcar todas' : `Selecionar todas (${txsFiltradas.length})`}
                </button>
                <span className="text-muted-foreground">·</span>
                <button onClick={() => setSelecionados(new Set())}
                        className="text-xs text-muted-foreground hover:text-foreground">
                  Limpar
                </button>
                <span className="text-muted-foreground">·</span>
                <button onClick={handleExcluirSelecionados}
                        className="text-xs text-red-500 hover:text-red-600 font-medium">
                  Excluir
                </button>
              </div>
            </div>
            );
          })()}
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
              {/* UM único scroll horizontal: cabeçalho + linhas rolam JUNTOS e
                  alinhados, contidos no card (overflow-hidden) — nada vaza pra
                  página no mobile. (Antes cada linha tinha seu próprio scroll.) */}
              <div className="overflow-x-auto scrollbar-none">
                <div style={{ minWidth: 764 }}>
                  {/* Cabeçalho de colunas */}
                  <div className="grid gap-3 items-center px-4 py-2.5 border-b border-border/60 bg-muted/30"
                       style={{ gridTemplateColumns: '44px minmax(160px,1fr) 64px 130px 110px 100px 110px 40px' }}>
                    <div/>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Descrição</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Parcela</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Categoria</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Conta</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Data</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-right">Valor</span>
                    <div/>
                  </div>

                  {/* Linhas */}
                  <div className="divide-y divide-border/40">
                    {txsFiltradas.map((tx, i) => (
                      <TransactionRow
                        key={tx.id}
                        tx={tx}
                        index={i}
                        ocultar={ocultar}
                        compartilhado={compartilhado}
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
                        onDeletar={() => handleDeletar(tx)}
                        onEditar={() => { setEditTx(tx); setRowMenuOpen(null); }}
                      />
                    ))}
                  </div>
                </div>
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

      {importarFormato && phone && (
        <ImportarModal
          phone={phone}
          wallets={wallets}
          formato={importarFormato}
          onClose={() => setImportarFormato(null)}
          onSuccess={(qtd) => {
            setImportToast(`✓ ${qtd} transação${qtd === 1 ? '' : 'ões'} importada${qtd === 1 ? '' : 's'} com sucesso.`);
            setTimeout(() => setImportToast(''), 5000);
            carregar();
          }}
        />
      )}

      {editTx && phone && (
        <EditarTransacaoModal
          tx={editTx}
          phone={phone}
          wallets={wallets}
          onClose={() => setEditTx(null)}
          onSaved={carregar}
        />
      )}

      {/* Toast simples de feedback */}
      {importToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-2xl bg-green-600 text-white text-sm font-semibold shadow-2xl animate-fade-in"
             style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
          {importToast}
        </div>
      )}
    </>
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
  tx, index, ocultar, compartilhado, selecionado, onToggleSelect,
  menuOpen, onToggleMenu, onCloseMenu, onDeletar, onEditar,
}: any) {
  const isTransfer = tx.transferencia === true || tx.tipo === 'Transferência';
  const isGasto = tx.tipo === 'Gasto';
  const theme   = getCategoriaTheme(tx.categoria || '');
  const nome    = nomeCategoria(tx.categoria);
  const desc    = tx.observacao || nome;
  // Ícone: prioriza a MARCA da descrição (ex.: "Shopee", "[Recorrente] Spotify")
  // e só cai no emoji da categoria quando a descrição não tem marca conhecida.
  const iconeNome = temMarcaConhecida(desc) ? desc : nome;

  return (
    <div
      className={`group relative transition-colors animate-fade-in ${
        selecionado ? 'bg-primary/5' : 'hover:bg-muted/40'
      }`}
      // content-visibility: o browser pula layout/paint das linhas fora da tela
      // (virtualização nativa, sem lib) → lista de 500+ rola a 60fps. O
      // contain-intrinsic-size reserva a altura aproximada (evita pulo no
      // scroll); `auto` faz o browser lembrar a altura real após medir.
      style={{
        animationDelay: `${Math.min(index * 25, 300)}ms`,
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto 60px',
      }}
    >
      {/* Grid idêntico ao cabeçalho. O scroll horizontal + min-width ficam no
          container ÚNICO da tabela (pai) — não em cada linha (senão cada uma
          rola sozinha e desalinha, causando a bagunça no mobile). */}
      <div className="grid px-4 py-3.5 gap-3"
           style={{ gridTemplateColumns: '44px minmax(160px,1fr) 64px 130px 110px 100px 110px 40px' }}>

      {/* Checkbox */}
      <button
        onClick={onToggleSelect}
        className={`w-6 h-6 self-center rounded border-2 transition-all flex items-center justify-center flex-shrink-0 ${
          selecionado ? 'border-primary bg-primary' : 'border-border'
        }`}
      >
        {selecionado && <CheckCircle2 size={10} className="text-white" />}
      </button>

      {/* Emoji ou logo da marca + descrição */}
      <div className="flex items-center gap-3 min-w-0">
        <CategoriaIcon
          nome={iconeNome}
          icone={theme.emoji}
          bg={theme.bg}
          color={theme.color}
          size={40}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{desc}</p>
        </div>
      </div>

      {/* Parcela (compra parcelada) — ex.: 3/4 */}
      <div className="flex items-center">
        {tx.parcela_total ? (
          <span className="text-xs font-semibold tabular-nums whitespace-nowrap px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
            {tx.parcela_num}/{tx.parcela_total}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/40">—</span>
        )}
      </div>

      {/* Categoria */}
      <div className="flex items-center">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
          style={{ background: theme.bg, color: theme.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: theme.color }} />
          {nome}
        </span>
      </div>

      {/* Conta (+ avatar de quem lançou, em grupo compartilhado) */}
      <div className="flex items-center gap-1.5 min-w-0">
        {compartilhado && tx.criador && (
          <AvatarMembro
            name={tx.criador.name}
            src={tx.criador.avatar_url}
            preset={tx.criador.avatar_preset}
            cor={tx.criador.avatar_cor}
            size="sm"
          />
        )}
        <span className="text-xs text-muted-foreground truncate">{tx.wallet_nome || '—'}</span>
        {tx.pluggy_card && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap tabular-nums">
            ••{tx.pluggy_card}
          </span>
        )}
      </div>

      {/* Data */}
      <div className="flex items-center">
        <span className="text-xs text-muted-foreground tabular whitespace-nowrap">{fmtData(tx.data)}</span>
      </div>

      {/* Valor + status */}
      <div className="flex flex-col items-end justify-center">
        {isTransfer ? (
          <>
            <p className="text-sm font-bold tabular whitespace-nowrap text-foreground">
              {ocultar ? '••••' : fmt(tx.valor)}
            </p>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <ArrowLeftRight size={9} /> Transferência
            </span>
          </>
        ) : (
          <>
            <p className={`text-sm font-bold tabular whitespace-nowrap ${
              isGasto ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'
            }`}>
              {ocultar ? '••••' : `${isGasto ? '−' : '+'}${fmt(tx.valor)}`}
            </p>
            {tx.pago ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 dark:text-green-400">
                <CheckCircle2 size={9} /> {isGasto ? 'Pago' : 'Recebido'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                <Clock size={9} /> {isGasto ? 'Pendente' : 'A receber'}
              </span>
            )}
          </>
        )}
      </div>

      {/* Menu de ações — dropdown via portal (não é cortado pelo overflow do scroll) */}
      <div className="flex justify-end flex-shrink-0">
        <MenuAcoes
          menuOpen={menuOpen}
          onToggleMenu={onToggleMenu}
          onCloseMenu={onCloseMenu}
          onDeletar={onDeletar}
          onEditar={onEditar}
        />
      </div>

      </div> {/* fecha grid da linha */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MENU DE AÇÕES — renderizado via portal pra não ser cortado pelo
// overflow-x-auto da linha (que cria clipping em ambos os eixos).
// ─────────────────────────────────────────────────────────────
function MenuAcoes({ menuOpen, onToggleMenu, onCloseMenu, onDeletar, onEditar }: {
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onDeletar: () => void;
  onEditar: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Calcula a posição do menu a partir do botão ao abrir
  useEffect(() => {
    if (!menuOpen || !btnRef.current) { setCoords(null); return; }
    const r = btnRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + 6, right: window.innerWidth - r.right });
  }, [menuOpen]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={onToggleMenu}
        className="p-2.5 rounded-lg hover:bg-muted lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
        aria-label="Mais ações"
      >
        <MoreVertical size={16} className="text-muted-foreground" />
      </button>
      {mounted && menuOpen && coords && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={onCloseMenu} />
          <div
            className="fixed w-40 rounded-2xl bg-card border border-border shadow-2xl p-1.5 z-[61] animate-fade-in"
            style={{ top: coords.top, right: coords.right }}
          >
            <button onClick={onEditar}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted text-sm text-foreground transition-colors">
              <Edit2 size={14} className="text-muted-foreground" /> Editar
            </button>
            <button
              onClick={onDeletar}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-sm text-red-500 transition-colors"
            >
              <Trash2 size={14} /> Excluir
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function EmptyState({ temFiltro, onLimpar, onCriar }: { temFiltro: boolean; onLimpar: () => void; onCriar: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center relative">
      <div className="absolute inset-0 pointer-events-none opacity-30"
           style={{ background: `radial-gradient(ellipse at center, color-mix(in srgb, ${BRAND} 8%, transparent) 0%, transparent 60%)` }} />

      <div className="relative">
        <div className="mx-auto w-20 h-20 rounded-3xl flex items-center justify-center mb-5 ring-1 ring-primary/20"
             style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${BRAND} 15%, transparent), color-mix(in srgb, ${BRAND} 6%, transparent))` }}>
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
                boxShadow: `0 8px 24px color-mix(in srgb, ${BRAND} 27%, transparent), 0 2px 6px color-mix(in srgb, ${BRAND} 20%, transparent)`,
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

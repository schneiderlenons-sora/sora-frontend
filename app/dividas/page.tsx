'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import NovaDividaModal from '@/components/dividas/NovaDividaModal';
import PagarParcelaModal from '@/components/dividas/PagarParcelaModal';
import PermissaoGuard from '@/components/ui/PermissaoGuard';
import IconeMarca, { slugDaMarca } from '@/components/ui/IconeMarca';
import {
  Plus, Sparkles, Receipt, Pencil, Trash2, ArrowDownRight, CheckCircle2,
  AlertCircle, Loader2, TrendingDown, Calendar, Zap, Eye, EyeOff,
  Building2, Home, ShoppingCart, CreditCard, AlertTriangle, Briefcase,
  GraduationCap, FileText, MoreVertical,
} from 'lucide-react';

const BRAND = '#61D17B';

const TIPO_INFO: Record<string, { label: string; cor: string; icon: any }> = {
  emprestimo:       { label: 'Empréstimo',      cor: '#3b82f6', icon: Briefcase    },
  financiamento:    { label: 'Financiamento',   cor: '#8b5cf6', icon: Home         },
  crediario:        { label: 'Crediário',       cor: '#f59e0b', icon: ShoppingCart },
  cartao_rotativo:  { label: 'Cartão rotativo', cor: '#ef4444', icon: CreditCard   },
  cheque_especial:  { label: 'Cheque especial', cor: '#f97316', icon: AlertTriangle},
  consignado:       { label: 'Consignado',      cor: '#06b6d4', icon: Building2    },
  fies:             { label: 'FIES',            cor: '#14b8a6', icon: GraduationCap},
  outro:            { label: 'Outro',           cor: '#64748b', icon: FileText     },
};

const STATUS_INFO: Record<string, { label: string; cor: string }> = {
  ativa:        { label: 'Ativa',         cor: '#3b82f6' },
  em_atraso:    { label: 'Em atraso',     cor: '#ef4444' },
  quitada:      { label: 'Quitada ✓',     cor: '#22c55e' },
  renegociada:  { label: 'Renegociada',   cor: '#8b5cf6' },
  suspensa:     { label: 'Suspensa',      cor: '#64748b' },
};

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function DividasPage() {
  const { phone } = useAuth();
  const [dividas, setDividas] = useState<any[]>([]);
  const [resumo,  setResumo]  = useState<any>({
    total_devido: 0, total_ativas: 0, total_quitadas: 0,
    parcelas_mes_valor: 0, parcelas_mes_count: 0, proxima_parcela: null,
  });
  const [loading,   setLoading]   = useState(false);
  const [ocultar,   setOcultar]   = useState(false);
  const [novaOpen,  setNovaOpen]  = useState(false);
  const [edicao,    setEdicao]    = useState<any | null>(null);
  const [pagarOpen, setPagarOpen] = useState<any | null>(null);
  const [confirmDel,setConfirmDel]= useState<any | null>(null);
  const [toast,     setToast]     = useState<string>('');
  const [filtro,    setFiltro]    = useState<'ativas' | 'quitadas' | 'todas'>('ativas');

  const carregar = useCallback(async () => {
    if (!phone) return;
    setLoading(true);
    try {
      const r = await api.dividas.listar(phone);
      setDividas(r.dividas || []);
      setResumo(r.resumo || {});
    } catch (e) { console.warn('[dividas] listar erro:', e); }
    finally { setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  function flash(txt: string) { setToast(txt); setTimeout(() => setToast(''), 4000); }

  async function handleDelete(d: any) {
    if (!phone) return;
    try {
      await api.dividas.deletar(d.id, phone);
      setConfirmDel(null);
      carregar();
      flash('✓ Dívida removida.');
    } catch (e: any) { alert(e.message); }
  }

  const dividasFiltradas = useMemo(() => {
    if (filtro === 'todas') return dividas;
    if (filtro === 'quitadas') return dividas.filter(d => d.status === 'quitada');
    return dividas.filter(d => d.status === 'ativa' || d.status === 'em_atraso');
  }, [dividas, filtro]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">

        {/* HERO HEADER */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in border border-border/60"
             style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>
          <div className="absolute inset-0 pointer-events-none opacity-50"
               style={{ background: 'radial-gradient(ellipse at top right, hsl(134 55% 60% / .12) 0%, transparent 60%)' }} />
          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
                <Sparkles size={12} style={{ color: BRAND }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND }}>
                  Controle de dívidas
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
                Dívidas
              </h1>
              <p className="text-muted-foreground text-sm mt-2 max-w-md">
                Acompanhe empréstimos, financiamentos e parcelas em um só lugar.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setOcultar(v => !v)} className="btn-ghost px-3 py-2 text-sm gap-2"
                      title={ocultar ? 'Mostrar valores' : 'Ocultar valores'}>
                {ocultar ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <PermissaoGuard>
                <button onClick={() => { setEdicao(null); setNovaOpen(true); }}
                        className="btn btn-primary px-4 py-2.5 text-sm gap-2 shadow-glow-sm">
                  <Plus size={16} /> Nova dívida
                </button>
              </PermissaoGuard>
            </div>
          </div>
        </div>

        {/* STATS — 3 cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: '60ms' }}>
          <CardStat
            label="Total devido"
            value={ocultar ? '•••••' : fmt(resumo.total_devido)}
            sub={`${resumo.total_ativas} ativa${resumo.total_ativas === 1 ? '' : 's'}`}
            icon={TrendingDown}
            cor="#ef4444"
          />
          <CardStat
            label="Parcelas do mês"
            value={ocultar ? '•••••' : fmt(resumo.parcelas_mes_valor)}
            sub={`${resumo.parcelas_mes_count} parcela${resumo.parcelas_mes_count === 1 ? '' : 's'}`}
            icon={Receipt}
            cor="#f59e0b"
          />
          <CardStat
            label="Próximo vencimento"
            value={resumo.proxima_parcela
              ? new Date(resumo.proxima_parcela.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
              : '—'}
            sub={resumo.proxima_parcela
              ? `${resumo.proxima_parcela.titulo} · ${resumo.proxima_parcela.dias === 0 ? 'hoje' : (resumo.proxima_parcela.dias < 0 ? `${Math.abs(resumo.proxima_parcela.dias)}d atrasado` : `em ${resumo.proxima_parcela.dias}d`)}`
              : 'Nenhum agendado'}
            icon={Calendar}
            cor={resumo.proxima_parcela?.dias < 7 ? '#ef4444' : '#3b82f6'}
            alerta={resumo.proxima_parcela?.dias <= 3 && resumo.proxima_parcela?.dias >= 0}
          />
        </div>

        {/* Filtros */}
        <div className="inline-flex items-center gap-1 bg-muted/40 rounded-2xl p-1.5 animate-fade-in" style={{ animationDelay: '90ms' }}>
          {[
            { v: 'ativas',   l: 'Ativas',   count: dividas.filter(d => d.status === 'ativa' || d.status === 'em_atraso').length },
            { v: 'quitadas', l: 'Quitadas', count: dividas.filter(d => d.status === 'quitada').length },
            { v: 'todas',    l: 'Todas',    count: dividas.length },
          ].map(({ v, l, count }) => {
            const ativo = filtro === v;
            return (
              <button key={v} onClick={() => setFiltro(v as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  ativo ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {l}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular ${
                  ativo ? 'bg-primary/15 text-primary' : 'bg-muted-foreground/15 text-muted-foreground'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Lista de dívidas */}
        {loading && dividas.length === 0 ? (
          <div className="card rounded-3xl p-10 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : dividasFiltradas.length === 0 ? (
          <EmptyState filtro={filtro} totalDividas={dividas.length} onCriar={() => { setEdicao(null); setNovaOpen(true); }} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
            {dividasFiltradas.map((d, i) => (
              <DividaCard
                key={d.id}
                divida={d}
                ocultar={ocultar}
                delay={i * 50}
                onPagar={() => setPagarOpen(d)}
                onEditar={() => { setEdicao(d); setNovaOpen(true); }}
                onExcluir={() => setConfirmDel(d)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modais */}
      {novaOpen && phone && (
        <NovaDividaModal
          phone={phone}
          edicao={edicao}
          onClose={() => { setNovaOpen(false); setEdicao(null); }}
          onSuccess={() => { carregar(); flash(edicao ? '✓ Dívida atualizada.' : '✓ Dívida criada.'); }}
        />
      )}

      {pagarOpen && phone && (
        <PagarParcelaModal
          phone={phone}
          divida={pagarOpen}
          onClose={() => setPagarOpen(null)}
          onSuccess={(quitada) => {
            carregar();
            flash(quitada ? '🎉 Dívida quitada! Parabéns!' : '✓ Pagamento registrado.');
          }}
        />
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDel(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-card rounded-3xl shadow-2xl border border-border animate-fade-in p-6"
               onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center mb-4">
              <AlertCircle size={22} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-base font-bold text-foreground">Excluir dívida?</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              <strong className="text-foreground">{confirmDel.titulo}</strong> e todo o histórico de pagamentos serão apagados permanentemente.
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setConfirmDel(null)} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
              <button onClick={() => handleDelete(confirmDel)}
                      className="btn-danger px-4 py-2 text-sm gap-2 inline-flex items-center">
                <Trash2 size={14} /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-2xl bg-green-600 text-white text-sm font-semibold shadow-2xl animate-fade-in"
             style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
          {toast}
        </div>
      )}
    </DashboardLayout>
  );
}

// ════════════════════════════════════════════════════════════════
// CARD STAT
// ════════════════════════════════════════════════════════════════
function CardStat({ label, value, sub, icon: Icon, cor, alerta }: {
  label: string; value: string; sub: string; icon: any; cor: string; alerta?: boolean;
}) {
  return (
    <div className={`card rounded-2xl p-5 relative overflow-hidden ${alerta ? 'animate-pulse' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular tracking-tight mt-1.5" style={{ color: cor }}>{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: `${cor}18` }}>
          <Icon size={18} style={{ color: cor }} />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CARD DE DÍVIDA
// ════════════════════════════════════════════════════════════════
interface DividaCardProps {
  divida:    any;
  ocultar:   boolean;
  delay:     number;
  onPagar:   () => void;
  onEditar:  () => void;
  onExcluir: () => void;
}

function DividaCard({ divida, ocultar, delay, onPagar, onEditar, onExcluir }: DividaCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const tipo = TIPO_INFO[divida.tipo] || TIPO_INFO.outro;
  const status = STATUS_INFO[divida.status] || STATUS_INFO.ativa;
  const TipoIcon = tipo.icon;

  const pagas  = divida.parcelas_pagas || 0;
  const total  = divida.parcelas_total || 0;
  const pct    = total > 0 ? Math.min((pagas / total) * 100, 100) : 0;
  const restantes = Math.max(0, total - pagas);
  const saldoDevedor = restantes * (divida.valor_parcela || 0);

  const concluida = divida.status === 'quitada';

  // Próximo vencimento desta dívida específica
  const hoje = new Date();
  const proxVenc = (() => {
    if (concluida || !divida.dia_vencimento) return null;
    const v = new Date(hoje.getFullYear(), hoje.getMonth(), divida.dia_vencimento);
    if (divida.dia_vencimento < hoje.getDate()) v.setMonth(v.getMonth() + 1);
    const dias = Math.ceil((v.getTime() - hoje.getTime()) / 86400000);
    return { data: v, dias };
  })();

  const credor = divida.credor || divida.titulo;
  const temLogoOficial = slugDaMarca(credor);

  return (
    <div
      className={`card-hover rounded-2xl p-5 animate-fade-in relative overflow-hidden ${concluida ? 'opacity-75' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Linha decorativa superior com a cor do tipo */}
      <div className="absolute top-0 left-0 right-0 h-1 opacity-90"
           style={{ background: `linear-gradient(90deg, ${tipo.cor}, ${tipo.cor}66)` }} />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar — logo da marca ou ícone do tipo */}
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
               style={{ background: `${tipo.cor}18` }}>
            {temLogoOficial ? (
              <IconeMarca
                nome={credor}
                size={28}
                fallback={<TipoIcon size={20} style={{ color: tipo.cor }} />}
              />
            ) : (
              <TipoIcon size={20} style={{ color: tipo.cor }} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground truncate">{divida.titulo}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                    style={{ background: `${tipo.cor}22`, color: tipo.cor }}>
                {tipo.label}
              </span>
              {divida.credor && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{divida.credor}</span>
              )}
            </div>
          </div>
        </div>

        {/* Status badge + menu */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{ background: `${status.cor}22`, color: status.cor }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.cor }} />
            {status.label}
          </span>
          <PermissaoGuard>
            <div className="relative">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <MoreVertical size={14} className="text-muted-foreground" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 card p-1 z-20 animate-fade-in border border-border shadow-xl">
                    <button onClick={() => { setMenuOpen(false); onEditar(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-xs text-foreground transition-colors">
                      <Pencil size={12} /> Editar
                    </button>
                    <button onClick={() => { setMenuOpen(false); onExcluir(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-xs text-red-600 dark:text-red-400 transition-colors">
                      <Trash2 size={12} /> Excluir
                    </button>
                  </div>
                </>
              )}
            </div>
          </PermissaoGuard>
        </div>
      </div>

      {/* Valores */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valor total</p>
          <p className="text-lg font-bold text-foreground tabular tracking-tight mt-0.5">
            {ocultar ? '•••••' : fmt(divida.valor_total)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {concluida ? 'Quitada' : 'Saldo devedor'}
          </p>
          <p className="text-lg font-bold tabular tracking-tight mt-0.5"
             style={{ color: concluida ? '#22c55e' : tipo.cor }}>
            {concluida ? '✓ R$ 0,00' : (ocultar ? '•••••' : fmt(saldoDevedor || divida.valor_total))}
          </p>
        </div>
      </div>

      {/* Progresso */}
      {total > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">
              <strong className="text-foreground tabular">{pagas}</strong> de <strong className="text-foreground tabular">{total}</strong> parcelas
            </span>
            <span className="font-bold tabular" style={{ color: concluida ? '#22c55e' : tipo.cor }}>
              {pct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
                 style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tipo.cor}, ${tipo.cor}aa)` }} />
          </div>
        </div>
      )}

      {/* Próximo vencimento */}
      {proxVenc && !concluida && (
        <div className={`rounded-xl p-2.5 flex items-center gap-2 text-[11px] mb-3 ${
          proxVenc.dias <= 3
            ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60'
            : 'bg-muted/40 border border-border/60'
        }`}>
          <Calendar size={13} className={proxVenc.dias <= 3 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'} />
          <p className={proxVenc.dias <= 3 ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground'}>
            {proxVenc.dias === 0 ? <><strong>Vence hoje:</strong></> :
             proxVenc.dias < 0  ? <><strong>Atrasada</strong> há {Math.abs(proxVenc.dias)} dia{Math.abs(proxVenc.dias) === 1 ? '' : 's'}:</> :
             <>Próxima parcela <strong>em {proxVenc.dias} dia{proxVenc.dias === 1 ? '' : 's'}</strong>:</>}
            {' '}
            <strong className="text-foreground tabular">
              {ocultar ? '•••' : fmt(divida.valor_parcela || 0)}
            </strong>
          </p>
        </div>
      )}

      {/* Taxa de juros + dia (info adicional) */}
      {(divida.taxa_juros || divida.dia_vencimento) && (
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-3 flex-wrap">
          {divida.taxa_juros && (
            <span className="inline-flex items-center gap-1">
              <Zap size={10} />
              <strong className="text-foreground tabular">{divida.taxa_juros.toFixed(2)}%</strong> a.m.
              {divida.indexador && ` (${divida.indexador})`}
            </span>
          )}
          {divida.dia_vencimento && (
            <span className="inline-flex items-center gap-1">
              <Calendar size={10} />
              Vence dia <strong className="text-foreground tabular">{divida.dia_vencimento}</strong>
            </span>
          )}
        </div>
      )}

      {/* Botão Pagar (ou indicador de quitada) */}
      {concluida ? (
        <div className="rounded-xl p-2.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/60 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-green-600 dark:text-green-400" />
          <p className="text-[11px] font-semibold text-green-700 dark:text-green-300">
            Quitada {divida.data_quitacao && `em ${new Date(divida.data_quitacao + 'T12:00:00').toLocaleDateString('pt-BR')}`}
          </p>
        </div>
      ) : (
        <PermissaoGuard>
          <button onClick={onPagar}
                  className="btn btn-primary w-full py-2.5 text-sm gap-2 shadow-glow-sm">
            <ArrowDownRight size={14} />
            Registrar pagamento
          </button>
        </PermissaoGuard>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// EMPTY STATE
// ════════════════════════════════════════════════════════════════
function EmptyState({ filtro, totalDividas, onCriar }: { filtro: string; totalDividas: number; onCriar: () => void }) {
  // Caso especial: TODAS as dívidas estão quitadas
  if (filtro === 'ativas' && totalDividas > 0) {
    return (
      <div className="card rounded-3xl py-16 flex flex-col items-center text-center px-6 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-glow"
             style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
          <CheckCircle2 size={28} className="text-white" />
        </div>
        <p className="text-xl font-bold text-foreground">Você está livre de dívidas! 🎉</p>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">
          Nenhuma dívida ativa. Continue assim! Veja o histórico clicando em "Quitadas".
        </p>
      </div>
    );
  }
  if (filtro === 'quitadas') {
    return (
      <div className="card rounded-3xl py-16 flex flex-col items-center text-center px-6 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <CheckCircle2 size={26} className="text-muted-foreground" />
        </div>
        <p className="text-base font-bold text-foreground">Sem dívidas quitadas ainda</p>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
          Quando você terminar de pagar uma dívida, ela aparece aqui.
        </p>
      </div>
    );
  }
  // Default: nada registrado
  return (
    <div className="card rounded-3xl py-16 flex flex-col items-center text-center px-6 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-glow-sm"
           style={{ background: `${BRAND}22` }}>
        <Receipt size={26} style={{ color: BRAND }} />
      </div>
      <p className="text-base font-bold text-foreground">Sem dívidas registradas</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">
        Adicione empréstimos, financiamentos ou crediários pra ver progresso, parcelas e juros pagos. A Sora te ajuda a manter o controle.
      </p>
      <PermissaoGuard>
        <button onClick={onCriar}
                className="btn btn-primary px-4 py-2 text-sm gap-2 mt-5 shadow-glow-sm">
          <Plus size={14} /> Adicionar primeira dívida
        </button>
      </PermissaoGuard>
    </div>
  );
}

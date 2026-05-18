'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import NovaMetaModal from '@/components/metas/NovaMetaModal';
import PermissaoGuard from '@/components/ui/PermissaoGuard';
import {
  Plus, Sparkles, Pencil, Trash2, ArrowUpRight, ArrowDownLeft,
  AlertCircle, Loader2, Check, X as XIcon, Flag, Calendar, Target as TargetIcon,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

const BRAND = '#61D17B';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtData = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
const fmtMesCurto = (d: Date) =>
  d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

type Status = { label: string; cor: string };
function statusMeta(pct: number, atrasado: boolean, concluida: boolean): Status {
  if (concluida)         return { label: 'Concluída ✓', cor: '#22c55e' };
  if (atrasado)          return { label: 'Atrasada',    cor: '#ef4444' };
  if (pct >= 75)         return { label: 'Quase lá',    cor: '#22c55e' };
  if (pct >= 30)         return { label: 'Em andamento', cor: '#f59e0b' };
  return { label: 'No início', cor: '#3b82f6' };
}

// Gera série de pontos pra gráfico: trajetória passada + projeção futura
function montarSerie(meta: any) {
  const inicio = new Date(meta.created_at);
  const hoje   = new Date();
  const fim    = meta.data_alvo ? new Date(meta.data_alvo + 'T12:00:00') : new Date(hoje.getTime() + 90 * 86400000);

  // Aporte histórico acumulado por mês
  const aportes = (meta.aportes || []) as { valor: number; tipo: 'aporte'|'resgate'; data: string }[];
  const porMes: Record<string, number> = {};
  aportes.forEach(a => {
    const k = a.data.slice(0, 7);
    porMes[k] = (porMes[k] || 0) + (a.tipo === 'aporte' ? a.valor : -a.valor);
  });

  // Pontos mensais entre inicio e fim
  const pontos: { mes: string; mesLabel: string; valor: number; projecao: number | null }[] = [];
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const fimMes = new Date(fim.getFullYear(), fim.getMonth(), 1);
  const hojeMesKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  let acumulado = 0;
  const valorAtual = parseFloat(meta.valor_atual || 0);
  const objetivo   = parseFloat(meta.valor_objetivo);

  while (cursor <= fimMes) {
    const k = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const incremento = porMes[k] || 0;
    acumulado = Math.max(0, acumulado + incremento);

    const ehFuturo = k > hojeMesKey;
    if (ehFuturo) {
      // Projeção linear entre valor_atual e objetivo
      const totalMeses = monthsBetween(new Date(hoje.getFullYear(), hoje.getMonth(), 1), fimMes);
      const idxFuturo  = monthsBetween(new Date(hoje.getFullYear(), hoje.getMonth(), 1), cursor);
      const projecao   = totalMeses > 0
        ? valorAtual + ((objetivo - valorAtual) * (idxFuturo / totalMeses))
        : objetivo;
      pontos.push({ mes: k, mesLabel: fmtMesCurto(new Date(cursor)), valor: NaN, projecao });
    } else {
      pontos.push({ mes: k, mesLabel: fmtMesCurto(new Date(cursor)), valor: acumulado, projecao: null });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Garante que valor atual no ponto "hoje" seja exato
  const idxHoje = pontos.findIndex(p => p.mes === hojeMesKey);
  if (idxHoje >= 0) pontos[idxHoje].valor = valorAtual;

  return pontos;
}

function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export default function MetasPage() {
  const { phone } = useAuth();
  const [metas, setMetas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [novaOpen, setNovaOpen] = useState(false);
  const [edicao,   setEdicao]   = useState<any | null>(null);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);
  const [aporteModal, setAporteModal] = useState<{ meta: any; tipo: 'aporte' | 'resgate' } | null>(null);

  const carregar = useCallback(async () => {
    if (!phone) return;
    setLoading(true);
    try {
      const r = await api.metas.listar(phone);
      setMetas(Array.isArray(r) ? r : []);
    } catch (e) { console.warn('[metas] listar erro:', e); }
    finally { setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleDelete(m: any) {
    if (!phone) return;
    try {
      await api.metas.deletar(m.id, phone);
      setConfirmDel(null);
      carregar();
    } catch (e: any) { alert(e.message); }
  }

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
                  Planejamento
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
                Metas e Objetivos
              </h1>
              <p className="text-muted-foreground text-sm mt-2 max-w-md">
                Acompanhe a evolução, aplique ou resgate quando precisar.
              </p>
            </div>
            <PermissaoGuard>
              <button onClick={() => { setEdicao(null); setNovaOpen(true); }}
                      className="btn btn-primary px-4 py-2.5 text-sm gap-2 shadow-glow-sm">
                <Plus size={16} /> Nova meta
              </button>
            </PermissaoGuard>
          </div>
        </div>

        {/* Estado vazio / lista */}
        {loading && metas.length === 0 ? (
          <div className="card rounded-3xl p-10 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : metas.length === 0 ? (
          <div className="card rounded-3xl py-16 flex flex-col items-center text-center px-6 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-glow-sm"
                 style={{ background: `${BRAND}22` }}>
              <Flag size={26} style={{ color: BRAND }} />
            </div>
            <p className="text-base font-bold text-foreground">Crie sua primeira meta</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">
              Defina objetivos com prazo (viagem, casa, carro, aposentadoria) e acompanhe sua evolução visualmente.
            </p>
            <PermissaoGuard>
              <button onClick={() => setNovaOpen(true)}
                      className="btn btn-primary px-4 py-2 text-sm gap-2 mt-5 shadow-glow-sm">
                <Plus size={14} /> Criar primeira meta
              </button>
            </PermissaoGuard>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {metas.map((m, i) => (
              <CardMeta
                key={m.id}
                meta={m}
                delay={i * 60}
                onEditar={() => { setEdicao(m); setNovaOpen(true); }}
                onExcluir={() => setConfirmDel(m)}
                onAplicar={() => setAporteModal({ meta: m, tipo: 'aporte' })}
                onResgatar={() => setAporteModal({ meta: m, tipo: 'resgate' })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modais */}
      {novaOpen && phone && (
        <NovaMetaModal
          phone={phone}
          edicao={edicao}
          onClose={() => { setNovaOpen(false); setEdicao(null); }}
          onSuccess={carregar}
        />
      )}

      {aporteModal && phone && (
        <AporteResgateModal
          phone={phone}
          meta={aporteModal.meta}
          tipo={aporteModal.tipo}
          onClose={() => setAporteModal(null)}
          onSuccess={carregar}
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
            <h3 className="text-base font-bold text-foreground">Excluir meta?</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              <strong className="text-foreground">{confirmDel.titulo}</strong> será removida permanentemente.
              O histórico de aportes também será apagado.
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
    </DashboardLayout>
  );
}

// ═══════════════════════════════════════════════════════════════
// CARD DE META
// ═══════════════════════════════════════════════════════════════
interface CardProps {
  meta: any;
  delay: number;
  onEditar:  () => void;
  onExcluir: () => void;
  onAplicar: () => void;
  onResgatar: () => void;
}

function CardMeta({ meta, delay, onEditar, onExcluir, onAplicar, onResgatar }: CardProps) {
  const valorAtual = parseFloat(meta.valor_atual || 0);
  const objetivo   = parseFloat(meta.valor_objetivo);
  const restante   = Math.max(0, objetivo - valorAtual);
  const pct        = objetivo > 0 ? Math.min((valorAtual / objetivo) * 100, 100) : 0;
  const concluida  = pct >= 100 || meta.status === 'concluido';

  const hoje = new Date();
  const alvo = meta.data_alvo ? new Date(meta.data_alvo + 'T12:00:00') : null;
  const atrasado = !!alvo && alvo < hoje && !concluida;

  // Meses até o alvo (mínimo 1 pra não dividir por 0)
  const mesesFalta = alvo
    ? Math.max(1, monthsBetween(new Date(hoje.getFullYear(), hoje.getMonth(), 1),
                                new Date(alvo.getFullYear(), alvo.getMonth(), 1)))
    : 12;
  const aporteSugerido = restante / mesesFalta;

  const status = statusMeta(pct, atrasado, concluida);
  const cor = meta.cor || BRAND;
  const corBarra = atrasado ? '#ef4444' : (concluida ? '#22c55e' : cor);

  const serie = useMemo(() => montarSerie(meta), [meta]);

  // Previsão real (quando vai bater a meta no ritmo atual)
  const previsaoLabel = useMemo(() => {
    if (concluida) return 'Conquistada!';
    if (!alvo) return 'Sem prazo';
    return alvo.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
  }, [alvo, concluida]);

  return (
    <div
      className="relative rounded-3xl overflow-hidden border border-border bg-card group transition-all duration-200 hover:shadow-2xl hover:-translate-y-1 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* ─── Banner com foto ─── */}
      <div className="relative h-44 overflow-hidden" style={{ background: `linear-gradient(135deg, ${cor}22, ${cor}05)` }}>
        {meta.imagem_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meta.imagem_url} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-7xl opacity-30">
            {meta.icone || '🎯'}
          </div>
        )}
        {/* Gradient overlay pra texto ficar legível */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Status badge top-left */}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md text-[10px] font-bold uppercase tracking-wider shadow-sm"
             style={{ background: `${status.cor}40`, color: 'white', border: `1px solid ${status.cor}80` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.cor }} />
          {status.label}
        </div>

        {/* Ações top-right */}
        <PermissaoGuard>
          <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEditar}
                    className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-md hover:bg-white/25 flex items-center justify-center transition-colors"
                    title="Editar">
              <Pencil size={13} className="text-white" />
            </button>
            <button onClick={onExcluir}
                    className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-md hover:bg-red-500/40 flex items-center justify-center transition-colors"
                    title="Excluir">
              <Trash2 size={13} className="text-white" />
            </button>
          </div>
        </PermissaoGuard>

        {/* Título + ícone sobrepostos no fim do banner */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl backdrop-blur-md flex-shrink-0 shadow-sm"
               style={{ background: `${cor}40`, border: `1px solid ${cor}` }}>
            {meta.icone || '🎯'}
          </div>
          <h3 className="text-lg font-bold text-white drop-shadow-md truncate flex-1">{meta.titulo}</h3>
        </div>
      </div>

      {/* ─── Corpo: stats + chart + progresso + ações ─── */}
      <div className="p-5 space-y-4">

        {/* Stats: Valor atual + Meta */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valor atual</p>
            <p className="text-2xl font-bold text-foreground tabular tracking-tight leading-none mt-0.5">{fmt(valorAtual)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Meta</p>
            <p className="text-2xl font-bold tabular tracking-tight leading-none mt-0.5" style={{ color: cor }}>{fmt(objetivo)}</p>
          </div>
        </div>

        {/* Mini gráfico de evolução com projeção */}
        {serie.length > 1 && (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 pt-2">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">
                Previsão: <strong className="text-foreground">{previsaoLabel}</strong>
              </span>
              {!concluida && (
                <span className="text-muted-foreground">
                  Aporte/mês: <strong className="tabular" style={{ color: corBarra }}>{fmt(aporteSugerido)}</strong>
                </span>
              )}
            </div>
            <div className="h-20 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serie} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`g-${meta.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={corBarra} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={corBarra} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="mesLabel" tick={{ fontSize: 9, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v: any) => fmt(Number(v))}
                    contentStyle={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11, padding: '4px 8px' }}
                    labelFormatter={(l) => l}
                  />
                  <Area type="monotone" dataKey="valor"    stroke={corBarra}    fill={`url(#g-${meta.id})`} strokeWidth={2.5} dot={false} connectNulls />
                  <Area type="monotone" dataKey="projecao" stroke={corBarra}    fill="transparent" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Barra de progresso */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold tabular" style={{ color: corBarra }}>{pct.toFixed(1)}% concluído</span>
            <span className="text-[11px] text-muted-foreground tabular">{fmt(restante)} restante</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
                 style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${corBarra}, ${corBarra}aa)` }} />
          </div>
        </div>

        {/* Mensagem de status */}
        {!concluida && (
          <div className={`rounded-xl p-2.5 flex items-start gap-2 text-[11px] leading-relaxed ${
            atrasado
              ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300'
              : 'bg-muted/40 border border-border/60 text-muted-foreground'
          }`}>
            {atrasado
              ? <AlertCircle size={13} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              : <TargetIcon  size={13} className="text-muted-foreground flex-shrink-0 mt-0.5" />}
            <p>
              {atrasado ? 'Atrasada — ' : 'Faltam '}
              <strong className="text-foreground tabular">{fmt(restante)}</strong>
              {alvo && (
                <> para a meta até <strong className="text-foreground">{fmtData(meta.data_alvo)}</strong>.</>
              )}
            </p>
          </div>
        )}
        {concluida && (
          <div className="rounded-xl p-2.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/60 flex items-center gap-2">
            <Check size={14} className="text-green-600 dark:text-green-400" />
            <p className="text-[11px] font-semibold text-green-700 dark:text-green-300">
              Meta conquistada! 🎉
            </p>
          </div>
        )}

        {/* Botões Aplicar / Resgatar */}
        <PermissaoGuard>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onAplicar}
                    className="btn btn-primary px-3 py-2.5 text-sm gap-2 shadow-glow-sm">
              <ArrowUpRight size={14} /> Aplicar
            </button>
            <button onClick={onResgatar}
                    disabled={valorAtual <= 0}
                    className="btn-outline px-3 py-2.5 text-sm gap-2">
              <ArrowDownLeft size={14} /> Resgatar
            </button>
          </div>
        </PermissaoGuard>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODAL DE APORTE / RESGATE
// ═══════════════════════════════════════════════════════════════
interface AporteProps {
  phone:  string;
  meta:   any;
  tipo:   'aporte' | 'resgate';
  onClose:   () => void;
  onSuccess: () => void;
}

function AporteResgateModal({ phone, meta, tipo, onClose, onSuccess }: AporteProps) {
  const [valorRaw, setValorRaw] = useState('');
  const [obs,      setObs]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [erro,     setErro]     = useState('');

  const valor = parseFloat(valorRaw || '0') / 100;
  const ehAporte = tipo === 'aporte';
  const cor = meta.cor || BRAND;

  const fmtBR = (raw: string) =>
    !raw ? '0,00'
         : (parseInt(raw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function salvar() {
    setErro('');
    if (!valorRaw || valorRaw === '0') { setErro('Informe o valor.'); return; }
    if (!ehAporte && valor > parseFloat(meta.valor_atual)) {
      setErro(`Você tem apenas ${fmt(parseFloat(meta.valor_atual))} na meta.`);
      return;
    }
    setLoading(true);
    try {
      const body = { phone, valor, observacao: obs.trim() || undefined };
      if (ehAporte) await api.metas.aportar(meta.id,  body);
      else          await api.metas.resgatar(meta.id, body);
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  }

  const novoValor = ehAporte
    ? parseFloat(meta.valor_atual || 0) + valor
    : Math.max(0, parseFloat(meta.valor_atual || 0) - valor);
  const novoPct = parseFloat(meta.valor_objetivo) > 0
    ? Math.min((novoValor / parseFloat(meta.valor_objetivo)) * 100, 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                 style={{ background: `${cor}22`, color: cor }}>
              {ehAporte ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground leading-tight">
                {ehAporte ? 'Aplicar valor' : 'Resgatar valor'}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                em <strong className="text-foreground">{meta.titulo}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0">
            <XIcon size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Valor */}
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">
              {ehAporte ? 'Valor a aplicar' : 'Valor a resgatar'}
            </p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold text-muted-foreground">R$</span>
              <input
                inputMode="numeric"
                value={fmtBR(valorRaw)}
                onChange={e => setValorRaw(e.target.value.replace(/\D/g, ''))}
                className="text-5xl font-bold text-foreground bg-transparent border-none outline-none text-center w-full tabular"
                autoFocus
              />
            </div>
          </div>

          {/* Preview pós-operação */}
          {valor > 0 && (
            <div className="rounded-xl p-3 bg-muted/30 border border-border/60">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Após a operação</span>
                <span className="font-bold tabular" style={{ color: cor }}>{novoPct.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground tabular">{fmt(parseFloat(meta.valor_atual || 0))}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-bold text-foreground tabular">{fmt(novoValor)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                <div className="h-full rounded-full transition-all duration-500"
                     style={{ width: `${novoPct}%`, background: cor }} />
              </div>
            </div>
          )}

          {/* Observação */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Observação <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span>
            </label>
            <input value={obs} onChange={e => setObs(e.target.value)}
                   placeholder={ehAporte ? 'Ex: 13º salário' : 'Ex: gasto emergencial'}
                   className="input" maxLength={80} />
          </div>

          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={loading}
                  className={`px-4 py-2 text-sm gap-2 inline-flex items-center rounded-xl font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-glow-sm ${
                    ehAporte ? '' : 'opacity-95'
                  }`}
                  style={{ background: `linear-gradient(135deg, ${cor}, ${cor}cc)` }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : (ehAporte ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />)}
            {ehAporte ? 'Aplicar' : 'Resgatar'}
          </button>
        </div>
      </div>
    </div>
  );
}

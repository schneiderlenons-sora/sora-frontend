'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import ModalTreino from '@/components/saude/ModalTreino';
import {
  Dumbbell, Sparkles, Loader2, Plus, Trash2, Flame, Clock, Calendar, ChevronRight,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const BRAND = '#7c3aed';
const COR_TREINO = '#f59e0b';

const fmtData = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

function diaSemanaPT(d: Date) {
  return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

function dentroDe(data: string, dias: number) {
  const d = new Date(data + 'T12:00:00');
  const hoje = new Date(); hoje.setHours(23, 59, 59, 999);
  const limite = new Date(hoje); limite.setDate(limite.getDate() - dias);
  return d >= limite && d <= hoje;
}

export default function TreinosPage() {
  const { phone } = useAuth();
  const [catalogo, setCatalogo]   = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [filtroId, setFiltroId]   = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!phone) return;
    try {
      const [cat, regs] = await Promise.all([
        api.saude.treinos.catalogo(phone),
        api.saude.treinos.registros(phone, 365),
      ]);
      setCatalogo(cat || []);
      setRegistros(regs || []);
    } catch (e) { console.warn('[treinos]', e); }
    finally { setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  const hojeStr = new Date().toISOString().slice(0, 10);
  const registrosFiltrados = useMemo(() => filtroId ? registros.filter(r => r.treino_id === filtroId) : registros, [registros, filtroId]);

  // Métricas
  const metricas = useMemo(() => {
    const hoje = registrosFiltrados.filter(r => r.data === hojeStr).length;
    const semana = registrosFiltrados.filter(r => dentroDe(r.data, 7)).length;
    const mes = registrosFiltrados.filter(r => dentroDe(r.data, 30)).length;
    const ano = registrosFiltrados.filter(r => dentroDe(r.data, 365)).length;
    const total = registrosFiltrados.length;
    const minSemana = registrosFiltrados.filter(r => dentroDe(r.data, 7)).reduce((s, r) => s + (r.duracao_min || 0), 0);
    return { hoje, semana, mes, ano, total, minSemana };
  }, [registrosFiltrados, hojeStr]);

  // Streak — dias consecutivos com pelo menos 1 treino
  const streak = useMemo(() => {
    const datas = new Set(registros.map(r => r.data));
    let s = 0;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const d = new Date(hoje); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      if (datas.has(iso)) s++;
      else if (i === 0) continue;
      else break;
    }
    return s;
  }, [registros]);

  // Gráfico últimos 7 dias
  const grafico7d = useMemo(() => {
    const arr: { dia: string; min: number; n: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const regs = registrosFiltrados.filter(r => r.data === iso);
      arr.push({
        dia: diaSemanaPT(d),
        min: regs.reduce((s, r) => s + (r.duracao_min || 0), 0),
        n: regs.length,
      });
    }
    return arr;
  }, [registrosFiltrados]);

  async function deletar(id: string) {
    if (!phone || !confirm('Excluir esse registro de treino?')) return;
    try {
      await api.saude.treinos.deletarReg(id, phone);
      carregar();
    } catch (e: any) { alert(e.message); }
  }

  if (loading) {
    return (
      <div className="card rounded-3xl p-16 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-5">

      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-border/40 backdrop-blur-xl p-6 sm:p-8 animate-fade-in"
           style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card) / 0.7) 0%, hsl(var(--bg-subtle) / 0.5) 100%)' }}>
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: `radial-gradient(ellipse at top right, ${COR_TREINO}24 0%, transparent 55%)` }} />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3" style={{ background: `${COR_TREINO}1A` }}>
              <Sparkles size={11} style={{ color: COR_TREINO }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COR_TREINO }}>Treinos</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">Treinos</h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-md">
              {streak > 0
                ? <>🔥 <strong className="text-foreground">{streak} dia{streak > 1 ? 's' : ''}</strong> consecutivos com treino. Continue!</>
                : <>Registre cada sessão e construa consistência.</>}
            </p>
          </div>
          <button onClick={() => setModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-lg shadow-violet-600/30">
            <Plus size={14} /> Registrar treino
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 animate-fade-in" style={{ animationDelay: '60ms' }}>
        <StatCard label="Hoje"   value={metricas.hoje}   cor={COR_TREINO} />
        <StatCard label="Semana" value={metricas.semana} sub={`${metricas.minSemana} min`} cor={COR_TREINO} />
        <StatCard label="Mês"    value={metricas.mes}    cor={COR_TREINO} />
        <StatCard label="Ano"    value={metricas.ano}    cor={COR_TREINO} />
        <StatCard label="Total"  value={metricas.total}  cor={BRAND} />
      </div>

      {/* GRÁFICO + CATÁLOGO */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 animate-fade-in" style={{ animationDelay: '120ms' }}>

        {/* Gráfico 7d */}
        <div className="lg:col-span-3 rounded-2xl border border-border/40 backdrop-blur-xl p-5"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Minutos por dia</p>
              <p className="text-base font-bold text-foreground">Últimos 7 dias</p>
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico7d} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="treinoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COR_TREINO} stopOpacity={1} />
                    <stop offset="100%" stopColor={COR_TREINO} stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                         formatter={(v: any) => [`${v} min`, 'Treino']} />
                <Bar dataKey="min" fill="url(#treinoGrad)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Catálogo */}
        <div className="lg:col-span-2 rounded-2xl border border-border/40 backdrop-blur-xl p-5"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Catálogo</p>
              <p className="text-base font-bold text-foreground">Modalidades</p>
            </div>
            {filtroId && (
              <button onClick={() => setFiltroId(null)} className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold hover:underline">
                limpar filtro
              </button>
            )}
          </div>

          {catalogo.length === 0 ? (
            <div className="rounded-xl py-6 text-center bg-muted/20 border border-dashed border-border/60">
              <Dumbbell size={18} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground mb-2">Nenhuma modalidade ainda</p>
              <button onClick={() => setModalOpen(true)} className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline">
                + Criar primeira
              </button>
            </div>
          ) : (
            <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
              {catalogo.map(t => {
                const count = registros.filter(r => r.treino_id === t.id).length;
                const ativo = filtroId === t.id;
                return (
                  <button key={t.id} onClick={() => setFiltroId(ativo ? null : t.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-all text-left ${
                      ativo ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 ring-1 ring-violet-500' : 'border-border/40 bg-muted/20 hover:border-violet-300 dark:hover:border-violet-800'
                    }`}>
                    <span className="text-xl">{t.icone}</span>
                    <span className="text-xs font-bold text-foreground flex-1">{t.nome}</span>
                    <span className="text-[10px] text-muted-foreground tabular">{count}×</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* HISTÓRICO */}
      <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
           style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '180ms' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Histórico</p>
            <p className="text-base font-bold text-foreground">
              {filtroId
                ? `${catalogo.find(t => t.id === filtroId)?.nome || 'Modalidade'}`
                : 'Todas as sessões'}
            </p>
          </div>
        </div>

        {registrosFiltrados.length === 0 ? (
          <div className="rounded-2xl py-10 text-center bg-muted/20 border border-dashed border-border/60">
            <Dumbbell size={20} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma sessão registrada ainda.</p>
            <button onClick={() => setModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-3 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">
              <Plus size={11} /> Registrar primeiro treino
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {registrosFiltrados.slice(0, 30).map(r => {
              const treino = catalogo.find(t => t.id === r.treino_id);
              return (
                <div key={r.id} className="group flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/40 hover:border-violet-300 dark:hover:border-violet-800 transition-all">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg" style={{ background: `${COR_TREINO}1A` }}>
                    {treino?.icone || '💪'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-foreground truncate">{treino?.nome || r.treino_nome || 'Treino'}</p>
                      <button onClick={() => deletar(r.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40">
                        <Trash2 size={11} className="text-red-500" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground tabular flex-wrap">
                      <span className="inline-flex items-center gap-1"><Calendar size={10} /> {fmtData(r.data)}</span>
                      {r.duracao_min && <span className="inline-flex items-center gap-1"><Clock size={10} /> {r.duracao_min} min</span>}
                      {r.intensidade && <span className="inline-flex items-center gap-1"><Flame size={10} style={{ color: COR_TREINO }} /> {r.intensidade}/5</span>}
                      {r.calorias_kcal && <span>🔥 {r.calorias_kcal} kcal</span>}
                    </div>
                    {r.observacao && <p className="text-[11px] text-muted-foreground mt-1 truncate italic">"{r.observacao}"</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && phone && (
        <ModalTreino
          phone={phone}
          catalogo={catalogo}
          onClose={() => setModalOpen(false)}
          onSuccess={() => { carregar(); setModalOpen(false); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, sub, cor }: any) {
  return (
    <div className="rounded-2xl border border-border/40 backdrop-blur-xl p-4 relative overflow-hidden"
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="absolute inset-0 pointer-events-none opacity-40"
           style={{ background: `radial-gradient(circle at top right, ${cor}1F 0%, transparent 70%)` }} />
      <div className="relative">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular tracking-tight mt-1.5 text-foreground">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

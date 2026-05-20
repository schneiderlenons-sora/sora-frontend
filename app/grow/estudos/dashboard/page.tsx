'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import ModalSessao from '@/components/estudos/ModalSessao';
import ModalProva from '@/components/estudos/ModalProva';
import {
  GraduationCap, BookOpen, Sparkles, Loader2, Plus, Play, Flame,
  Clock, Trophy, Target, ArrowRight, Calendar, FileText, ChevronRight,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const BRAND = '#7c3aed';

const fmtData = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
const fmtMin = (min: number) => {
  if (!min) return '0min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? m + 'min' : ''}` : `${m}min`;
};

const TIPO_COR: any = {
  faculdade: '#6366f1',
  online:    '#06b6d4',
  concurso:  '#f59e0b',
  idioma:    '#10b981',
  outro:     '#94a3b8',
};

export default function EstudosDashboard() {
  const { phone, perfil } = useAuth();
  const [data, setData] = useState<any>(null);
  const [sessoes, setSessoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalSessao, setModalSessao] = useState(false);
  const [modalProva, setModalProva] = useState(false);

  const carregar = useCallback(async () => {
    if (!phone) return;
    try {
      const [d, s] = await Promise.all([
        api.estudos.dashboard(phone),
        api.estudos.sessoes.listar(phone, { dias: 90 }),
      ]);
      setData(d);
      setSessoes(s || []);
    } catch (e) { console.warn('[estudos]', e); }
    finally { setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  // Heatmap 90 dias
  const heatmap = useMemo(() => {
    const map: Record<string, number> = {};
    sessoes.forEach(s => { map[s.data] = (map[s.data] || 0) + (s.duracao_min || 0); });
    const arr: { data: string; min: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      arr.push({ data: iso, min: map[iso] || 0 });
    }
    return arr;
  }, [sessoes]);

  // Gráfico 7 dias
  const grafico7d = useMemo(() => {
    const arr: { dia: string; min: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const total = sessoes.filter(s => s.data === iso).reduce((s, x) => s + (x.duracao_min || 0), 0);
      arr.push({ dia: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), min: total });
    }
    return arr;
  }, [sessoes]);

  if (loading) {
    return (
      <div className="card rounded-3xl p-16 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-violet-600" />
      </div>
    );
  }

  const streak = data?.streak || 0;
  const minHoje = data?.min_hoje || 0;
  const minSemana = data?.min_semana || 0;
  const cursosAtivos = data?.cursos_ativos || [];
  const provas = data?.provas_proximas || [];
  const disciplinas = data?.disciplinas || [];

  const nome = perfil?.name?.split(' ')[0] || '';

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-5">

      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-border/40 backdrop-blur-xl p-6 sm:p-8 animate-fade-in"
           style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card) / 0.7) 0%, hsl(var(--bg-subtle) / 0.5) 100%)' }}>
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: `radial-gradient(ellipse at top right, ${BRAND}24 0%, transparent 55%), radial-gradient(circle at bottom left, rgba(99,102,241,0.10) 0%, transparent 50%)` }} />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3" style={{ background: `${BRAND}1A` }}>
              <Sparkles size={11} style={{ color: BRAND }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND }}>Estudos</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
              Bom estudo{nome ? `, ${nome}` : ''} 📚
            </h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-md leading-relaxed">
              {streak > 0
                ? <>🔥 <strong className="text-foreground">{streak} dia{streak > 1 ? 's' : ''}</strong> consecutivo{streak > 1 ? 's' : ''} de estudo. {minHoje > 0 ? <>Hoje: <strong className="text-foreground">{fmtMin(minHoje)}</strong>.</> : <em>Comece a sessão de hoje pra manter.</em>}</>
                : <>Inicie sua primeira sessão e comece a construir o streak.</>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setModalProva(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-sm font-bold border border-border/60 bg-card/60 backdrop-blur-xl hover:border-violet-300 dark:hover:border-violet-800 transition-all">
              <FileText size={14} /> Prova
            </button>
            <button onClick={() => setModalSessao(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-lg shadow-violet-600/30">
              <Play size={14} fill="currentColor" /> Iniciar sessão
            </button>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in" style={{ animationDelay: '60ms' }}>
        <StatTile icon={Flame}    label="Streak"        value={streak} unit={streak === 1 ? 'dia' : 'dias'} cor={streak >= 7 ? '#f97316' : BRAND} highlight={streak >= 7} />
        <StatTile icon={Clock}    label="Hoje"          value={fmtMin(minHoje)} cor={BRAND} />
        <StatTile icon={Target}   label="Esta semana"   value={fmtMin(minSemana)} cor="#06b6d4" />
        <StatTile icon={Trophy}   label="Cursos ativos" value={cursosAtivos.length} cor="#f59e0b" />
      </div>

      {/* HEATMAP 90 DIAS */}
      <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
           style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '120ms' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Atividade</p>
            <p className="text-base font-bold text-foreground">Últimos 90 dias</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>menos</span>
            <div className="flex items-center gap-0.5">
              {[0, 1, 2, 3, 4].map(n => (
                <div key={n} className="w-3 h-3 rounded-sm" style={{ background: n === 0 ? 'hsl(var(--muted))' : `rgba(124, 58, 237, ${0.2 + n * 0.2})` }} />
              ))}
            </div>
            <span>mais</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {heatmap.map(({ data: d, min }) => {
            let nivel = 0;
            if (min > 0 && min < 30) nivel = 1;
            else if (min < 60) nivel = 2;
            else if (min < 120) nivel = 3;
            else if (min >= 120) nivel = 4;
            const bg = nivel === 0 ? 'hsl(var(--muted))' : `rgba(124, 58, 237, ${0.2 + nivel * 0.2})`;
            return (
              <div key={d} title={`${fmtData(d)} · ${fmtMin(min)}`}
                   className="w-3.5 h-3.5 rounded-sm transition-transform hover:scale-150 hover:ring-1 hover:ring-violet-500"
                   style={{ background: bg }} />
            );
          })}
        </div>
      </div>

      {/* GRÁFICO 7d + PRÓXIMAS PROVAS */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 animate-fade-in" style={{ animationDelay: '180ms' }}>

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
                  <linearGradient id="estudoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity={1} />
                    <stop offset="100%" stopColor={BRAND} stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                         formatter={(v: any) => [`${v} min`, 'Estudo']} />
                <Bar dataKey="min" fill="url(#estudoGrad)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-border/40 backdrop-blur-xl p-5"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Próximas</p>
              <p className="text-base font-bold text-foreground">Provas & simulados</p>
            </div>
            <button onClick={() => setModalProva(true)} className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline inline-flex items-center gap-0.5">
              <Plus size={11} />
            </button>
          </div>
          {provas.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">Nenhuma agendada.</div>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {provas.slice(0, 6).map((p: any) => {
                const dias = Math.ceil((new Date(p.data).getTime() - Date.now()) / 86400000);
                const urgente = dias <= 3;
                return (
                  <div key={p.id} className={`flex items-center gap-2 p-2 rounded-lg border ${urgente ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60' : 'bg-muted/30 border-border/40'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{p.titulo}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {fmtData(p.data)} · {dias === 0 ? 'HOJE' : dias === 1 ? 'AMANHÃ' : `em ${dias}d`}
                        {p.disciplinas?.nome ? ` · ${p.disciplinas.nome}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CURSOS ATIVOS */}
      {cursosAtivos.length > 0 && (
        <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
             style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '240ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Em andamento</p>
              <p className="text-base font-bold text-foreground">Cursos ativos</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cursosAtivos.slice(0, 6).map((c: any) => {
              const link = c.tipo === 'concurso' ? '/grow/estudos/concursos' : c.tipo === 'faculdade' ? '/grow/estudos/faculdade' : '/grow/estudos/cursos';
              return (
                <Link key={c.id} href={link}
                      className="group rounded-2xl border border-border/40 backdrop-blur-xl p-4 hover:border-violet-300 dark:hover:border-violet-800 hover:scale-[1.01] transition-all"
                      style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl" style={{ background: `${c.cor || BRAND}1A` }}>
                      {c.icone || '🎓'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{c.nome}</p>
                      {c.instituicao && <p className="text-[10px] text-muted-foreground truncate">{c.instituicao}</p>}
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${Math.min(100, c.progresso_pct || 0)}%`, background: c.cor || BRAND }} />
                      </div>
                      <p className="text-[10px] tabular text-muted-foreground mt-1">{Math.round(c.progresso_pct || 0)}% concluído</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {modalSessao && phone && (
        <ModalSessao phone={phone} disciplinas={disciplinas} cursos={cursosAtivos} onClose={() => setModalSessao(false)} onSuccess={() => { carregar(); setModalSessao(false); }} />
      )}
      {modalProva && phone && (
        <ModalProva phone={phone} cursos={data?.cursos || []} disciplinas={disciplinas} onClose={() => setModalProva(false)} onSuccess={() => { carregar(); setModalProva(false); }} />
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, unit, cor, highlight }: any) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl p-4 transition-all hover:scale-[1.015] ${
      highlight ? 'border-amber-300 dark:border-amber-800 ring-1 ring-amber-300/40' : 'border-border/40 hover:border-border/70'
    }`}
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="absolute inset-0 pointer-events-none opacity-50"
           style={{ background: `radial-gradient(circle at top right, ${cor}18 0%, transparent 70%)` }} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular tracking-tight mt-1.5 text-foreground inline-flex items-baseline gap-1">
            {value}{unit && <span className="text-xs font-medium text-muted-foreground">{unit}</span>}
          </p>
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cor}1A` }}>
          <Icon size={16} style={{ color: cor }} />
        </div>
      </div>
    </div>
  );
}

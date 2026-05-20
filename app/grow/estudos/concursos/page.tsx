'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import ModalCurso from '@/components/estudos/ModalCurso';
import ModalDisciplina from '@/components/estudos/ModalDisciplina';
import ModalSessao from '@/components/estudos/ModalSessao';
import ModalProva from '@/components/estudos/ModalProva';
import {
  Trophy, Sparkles, Loader2, Plus, Flame, Clock, Calendar, Target,
  Pencil, ChevronRight, FileText, BookOpen, Play, TrendingUp,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';

const BRAND = '#7c3aed';
const COR_CONCURSO = '#f59e0b';

const fmtData = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
const fmtDataLonga = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
const fmtMin = (min: number) => {
  if (!min) return '0min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? m + 'min' : ''}` : `${m}min`;
};

function diasAte(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return Math.ceil((d.getTime() - hoje.getTime()) / 86400000);
}

export default function ConcursosPage() {
  const { phone } = useAuth();
  const [concursos, setConcursos]     = useState<any[]>([]);
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [sessoes, setSessoes]         = useState<any[]>([]);
  const [provas, setProvas]           = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [concursoSel, setConcursoSel] = useState<string | null>(null);
  const [modalCurso, setModalCurso]   = useState(false);
  const [edCurso, setEdCurso]         = useState<any | null>(null);
  const [modalDisc, setModalDisc]     = useState(false);
  const [modalSessao, setModalSessao] = useState(false);
  const [modalProva, setModalProva]   = useState(false);
  const [periodo, setPeriodo]         = useState<7 | 30 | 90>(30);

  const carregar = useCallback(async () => {
    if (!phone) return;
    try {
      const [c, d, s, p] = await Promise.all([
        api.estudos.cursos.listar(phone, { tipo: 'concurso' }),
        api.estudos.disciplinas.listar(phone),
        api.estudos.sessoes.listar(phone, { dias: 365 }),
        api.estudos.provas.listar(phone),
      ]);
      setConcursos(c || []);
      setDisciplinas(d || []);
      setSessoes(s || []);
      setProvas(p || []);
      if (!concursoSel && c && c.length > 0) {
        const ativo = c.find((x: any) => x.status === 'ativo');
        if (ativo) setConcursoSel(ativo.id);
      }
    } catch (e) { console.warn('[concursos]', e); }
    finally { setLoading(false); }
  }, [phone, concursoSel]);

  useEffect(() => { carregar(); }, [carregar]);

  const concurso = useMemo(() => concursos.find(c => c.id === concursoSel), [concursos, concursoSel]);

  // Sessões filtradas pelo concurso selecionado (ou por disciplinas vinculadas)
  const sessoesConcurso = useMemo(() => {
    if (!concursoSel) return sessoes;
    const discIds = new Set(disciplinas.filter(d => d.curso_id === concursoSel).map(d => d.id));
    return sessoes.filter(s => s.curso_id === concursoSel || (s.disciplina_id && discIds.has(s.disciplina_id)));
  }, [sessoes, concursoSel, disciplinas]);

  // Streak (dias consecutivos com qualquer sessão)
  const streak = useMemo(() => {
    const datas = new Set(sessoesConcurso.map(s => s.data));
    let s = 0;
    const cur = new Date(); cur.setHours(0,0,0,0);
    for (let i = 0; i < 365; i++) {
      const d = new Date(cur); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      if (datas.has(iso)) s++;
      else if (i === 0) continue;
      else break;
    }
    return s;
  }, [sessoesConcurso]);

  // Total acumulado
  const totalMin = useMemo(() => sessoesConcurso.reduce((s, x) => s + (x.duracao_min || 0), 0), [sessoesConcurso]);
  const sessoesTotal = sessoesConcurso.length;
  const dispDist = useMemo(() => {
    const set = new Set(sessoesConcurso.filter(s => s.disciplina_id).map(s => s.disciplina_id));
    return set.size;
  }, [sessoesConcurso]);

  // Heatmap 365 dias
  const heatmap365 = useMemo(() => {
    const map: Record<string, number> = {};
    sessoesConcurso.forEach(s => { map[s.data] = (map[s.data] || 0) + (s.duracao_min || 0); });
    const arr: { data: string; min: number }[] = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      arr.push({ data: iso, min: map[iso] || 0 });
    }
    return arr;
  }, [sessoesConcurso]);

  // Gráfico de período (7/30/90)
  const grafico = useMemo(() => {
    const arr: { dia: string; min: number }[] = [];
    for (let i = periodo - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const total = sessoesConcurso.filter(s => s.data === iso).reduce((s, x) => s + (x.duracao_min || 0), 0);
      arr.push({
        dia: periodo === 7
          ? d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
          : fmtData(iso),
        min: total,
      });
    }
    return arr;
  }, [sessoesConcurso, periodo]);

  // Disciplinas do concurso com horas
  const disciplinasDoConcurso = useMemo(() => {
    if (!concursoSel) return disciplinas;
    return disciplinas.filter(d => d.curso_id === concursoSel);
  }, [disciplinas, concursoSel]);

  const horasPorDisc = useMemo(() => {
    const m: Record<string, number> = {};
    sessoesConcurso.forEach(s => {
      if (s.disciplina_id) m[s.disciplina_id] = (m[s.disciplina_id] || 0) + (s.duracao_min || 0);
    });
    return m;
  }, [sessoesConcurso]);

  // Simulados realizados (provas com tipo='simulado' e realizada=true)
  const simulados = useMemo(() => {
    return provas
      .filter(p => p.tipo === 'simulado' && p.realizada && p.nota_obtida != null)
      .filter(p => !concursoSel || p.curso_id === concursoSel)
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [provas, concursoSel]);

  const simuladosGrafico = useMemo(() => {
    return simulados.map(s => ({
      dia: fmtData(s.data),
      nota: parseFloat(s.nota_obtida),
      max: parseFloat(s.nota_maxima) || 10,
    }));
  }, [simulados]);

  if (loading) {
    return (
      <div className="card rounded-3xl p-16 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-violet-600" />
      </div>
    );
  }

  const diasRestantes = concurso?.data_fim ? diasAte(concurso.data_fim) : null;
  const corContagem = diasRestantes != null && diasRestantes <= 30 ? '#ef4444' : diasRestantes != null && diasRestantes <= 90 ? '#f59e0b' : COR_CONCURSO;

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-5">

      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-border/40 backdrop-blur-xl p-6 sm:p-8 animate-fade-in"
           style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card) / 0.7) 0%, hsl(var(--bg-subtle) / 0.5) 100%)' }}>
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: `radial-gradient(ellipse at top right, ${COR_CONCURSO}24 0%, transparent 55%)` }} />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3" style={{ background: `${COR_CONCURSO}1A` }}>
              <Sparkles size={11} style={{ color: COR_CONCURSO }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COR_CONCURSO }}>Concursos</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
              {concurso ? concurso.nome : 'Concursos'}
            </h1>
            {concurso ? (
              <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
                {diasRestantes != null && diasRestantes >= 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Faltam</p>
                    <p className="text-3xl font-bold tabular tracking-tight" style={{ color: corContagem }}>
                      {diasRestantes} <span className="text-sm font-medium text-muted-foreground">dia{diasRestantes === 1 ? '' : 's'}</span>
                    </p>
                  </div>
                )}
                {concurso.data_fim && <p className="text-[11px] text-muted-foreground">Prova em <strong className="text-foreground">{fmtDataLonga(concurso.data_fim)}</strong></p>}
                {concurso.instituicao && <p className="text-[11px] text-muted-foreground">Banca: <strong className="text-foreground">{concurso.instituicao}</strong></p>}
                {concurso.instrutor && <p className="text-[11px] text-muted-foreground">Cargo: <strong className="text-foreground">{concurso.instrutor}</strong></p>}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm mt-2 max-w-md leading-relaxed">
                Cadastre o concurso que você vai prestar, vincule disciplinas e construa o streak.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {concurso && (
              <button onClick={() => { setEdCurso(concurso); setModalCurso(true); }}
                      className="inline-flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-bold border border-border/60 bg-card/60 backdrop-blur-xl hover:border-violet-300">
                <Pencil size={13} />
              </button>
            )}
            <button onClick={() => { setEdCurso(null); setModalCurso(true); }}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-sm font-bold border border-border/60 bg-card/60 backdrop-blur-xl hover:border-violet-300 dark:hover:border-violet-800 transition-all">
              <Plus size={14} /> Concurso
            </button>
            <button onClick={() => setModalSessao(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-lg shadow-violet-600/30">
              <Play size={14} fill="currentColor" /> Estudar
            </button>
          </div>
        </div>
      </div>

      {/* Tabs de concursos (se mais de 1) */}
      {concursos.length > 1 && (
        <div className="flex flex-wrap gap-2 animate-fade-in" style={{ animationDelay: '60ms' }}>
          {concursos.map(c => (
            <button key={c.id} onClick={() => setConcursoSel(c.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                concursoSel === c.id ? 'text-white shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
              style={concursoSel === c.id ? { background: c.cor || COR_CONCURSO } : {}}>
              {c.icone || '🏆'} {c.nome}
            </button>
          ))}
        </div>
      )}

      {concursos.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-amber-300 dark:border-amber-800 p-10 sm:p-12 bg-amber-50/30 dark:bg-amber-950/10 animate-fade-in text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-amber-100 dark:bg-amber-900/40">
            <Trophy size={28} className="text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-base font-bold text-foreground">Nenhum concurso cadastrado</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
            Cadastre o concurso (BB, INSS, OAB, ENEM...) com banca, cargo e data da prova. A Sora calcula a contagem regressiva e mostra a evolução do seu estudo.
          </p>
          <button onClick={() => { setEdCurso(null); setModalCurso(true); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 mt-5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700">
            <Plus size={13} /> Primeiro concurso
          </button>
        </div>
      ) : (
        <>
          {/* STATS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in" style={{ animationDelay: '120ms' }}>
            <StatBig icon={Flame}      label="Streak"          value={streak}        unit={streak === 1 ? 'dia' : 'dias'} cor={streak >= 7 ? '#f97316' : COR_CONCURSO} destaque={streak >= 7} />
            <StatBig icon={Clock}      label="Horas totais"     value={Math.floor(totalMin / 60)} unit="h" cor={BRAND} />
            <StatBig icon={BookOpen}   label="Sessões"          value={sessoesTotal}  cor="#06b6d4" />
            <StatBig icon={Target}     label="Disciplinas"      value={dispDist}      cor="#ec4899" />
          </div>

          {/* HEATMAP 365 dias */}
          <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
               style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '180ms' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">365 dias de estudo</p>
                <p className="text-base font-bold text-foreground">Sua jornada completa</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>menos</span>
                <div className="flex items-center gap-0.5">
                  {[0, 1, 2, 3, 4].map(n => (
                    <div key={n} className="w-3 h-3 rounded-sm" style={{ background: n === 0 ? 'hsl(var(--muted))' : `rgba(245, 158, 11, ${0.2 + n * 0.2})` }} />
                  ))}
                </div>
                <span>mais</span>
              </div>
            </div>
            <div className="overflow-x-auto pb-2">
              <div className="flex flex-wrap gap-1" style={{ minWidth: 700 }}>
                {heatmap365.map(({ data: d, min }) => {
                  let nivel = 0;
                  if (min > 0 && min < 30) nivel = 1;
                  else if (min < 60) nivel = 2;
                  else if (min < 120) nivel = 3;
                  else if (min >= 120) nivel = 4;
                  const bg = nivel === 0 ? 'hsl(var(--muted))' : `rgba(245, 158, 11, ${0.2 + nivel * 0.2})`;
                  return (
                    <div key={d} title={`${fmtData(d)} · ${fmtMin(min)}`}
                         className="w-3 h-3 rounded-sm transition-transform hover:scale-150 hover:ring-1 hover:ring-amber-500"
                         style={{ background: bg }} />
                  );
                })}
              </div>
            </div>
          </div>

          {/* GRÁFICO DE TEMPO */}
          <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
               style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '240ms' }}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tempo de estudo</p>
                <p className="text-base font-bold text-foreground">Últimos {periodo} dias</p>
              </div>
              <div className="inline-flex items-center gap-1 bg-muted/40 rounded-xl p-1">
                {[7, 30, 90].map(p => (
                  <button key={p} onClick={() => setPeriodo(p as any)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      periodo === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    {p}d
                  </button>
                ))}
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafico} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="concursoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COR_CONCURSO} stopOpacity={1} />
                      <stop offset="100%" stopColor={COR_CONCURSO} stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} interval={periodo === 90 ? 9 : periodo === 30 ? 3 : 0} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={36} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                           formatter={(v: any) => [`${v} min`, 'Estudo']} />
                  <Bar dataKey="min" fill="url(#concursoGrad)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DISCIPLINAS + SIMULADOS */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 animate-fade-in" style={{ animationDelay: '300ms' }}>

            <div className="lg:col-span-3 rounded-2xl border border-border/40 backdrop-blur-xl p-5"
                 style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Disciplinas</p>
                  <p className="text-base font-bold text-foreground">{disciplinasDoConcurso.length} cadastrada{disciplinasDoConcurso.length === 1 ? '' : 's'}</p>
                </div>
                {concurso && (
                  <button onClick={() => setModalDisc(true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 text-[11px] font-bold hover:bg-violet-200 dark:hover:bg-violet-900/60">
                    <Plus size={11} /> Adicionar
                  </button>
                )}
              </div>
              {disciplinasDoConcurso.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">Nenhuma disciplina ainda.</div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {disciplinasDoConcurso
                    .map(d => ({ ...d, min: horasPorDisc[d.id] || 0 }))
                    .sort((a, b) => b.min - a.min)
                    .map(d => {
                      const maxMin = Math.max(...Object.values(horasPorDisc), 1);
                      const pct = (d.min / maxMin) * 100;
                      return (
                        <div key={d.id} className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-base">{d.icone || '📚'}</span>
                            <p className="text-xs font-bold text-foreground flex-1 truncate">{d.nome}</p>
                            <p className="text-[11px] font-bold tabular" style={{ color: d.cor || BRAND }}>{fmtMin(d.min)}</p>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: d.cor || BRAND }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 rounded-2xl border border-border/40 backdrop-blur-xl p-5"
                 style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Simulados</p>
                  <p className="text-base font-bold text-foreground">{simulados.length} realizado{simulados.length === 1 ? '' : 's'}</p>
                </div>
                <button onClick={() => setModalProva(true)}
                        className="text-[10px] font-bold text-violet-600 dark:text-violet-400 inline-flex items-center gap-0.5">
                  <Plus size={11} />
                </button>
              </div>
              {simuladosGrafico.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">Cadastre simulados pra ver evolução.</div>
              ) : (
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={simuladosGrafico} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} width={28} domain={[0, 'dataMax']} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 11 }} />
                      <Line type="monotone" dataKey="nota" stroke="#ec4899" strokeWidth={2.5} dot={{ fill: '#ec4899', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {simulados.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/40 space-y-1 max-h-32 overflow-y-auto">
                  {simulados.slice(-5).reverse().map(s => (
                    <div key={s.id} className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground truncate">{s.titulo}</span>
                      <span className="font-bold tabular text-foreground">{s.nota_obtida}/{s.nota_maxima}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {modalCurso && phone && (
        <ModalCurso phone={phone} curso={edCurso} tipoInicial="concurso" onClose={() => { setModalCurso(false); setEdCurso(null); }} onSuccess={() => { carregar(); setModalCurso(false); setEdCurso(null); }} />
      )}
      {modalDisc && phone && (
        <ModalDisciplina phone={phone} cursos={concursos} cursoIdInicial={concursoSel || undefined} onClose={() => setModalDisc(false)} onSuccess={() => { carregar(); setModalDisc(false); }} />
      )}
      {modalSessao && phone && (
        <ModalSessao phone={phone} disciplinas={disciplinasDoConcurso} cursos={concursos} onClose={() => setModalSessao(false)} onSuccess={() => { carregar(); setModalSessao(false); }} />
      )}
      {modalProva && phone && (
        <ModalProva phone={phone} cursos={concursos} disciplinas={disciplinasDoConcurso} cursoIdInicial={concursoSel || undefined} onClose={() => setModalProva(false)} onSuccess={() => { carregar(); setModalProva(false); }} />
      )}
    </div>
  );
}

function StatBig({ icon: Icon, label, value, unit, cor, destaque }: any) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl p-4 transition-all hover:scale-[1.015] ${
      destaque ? 'border-amber-300 dark:border-amber-800 ring-1 ring-amber-300/40' : 'border-border/40'
    }`}
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="absolute inset-0 pointer-events-none opacity-50"
           style={{ background: `radial-gradient(circle at top right, ${cor}1F 0%, transparent 70%)` }} />
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

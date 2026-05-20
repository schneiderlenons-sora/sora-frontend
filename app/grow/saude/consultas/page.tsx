'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import ModalConsulta from '@/components/saude/ModalConsulta';
import ModalExame from '@/components/saude/ModalExame';
import {
  CalendarHeart, Sparkles, Loader2, Plus, MapPin, Clock, Calendar,
  TestTube, Pencil, ChevronRight, History, TrendingDown, TrendingUp, Minus,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceArea } from 'recharts';

const COR_CONS = '#ec4899';

const fmtData = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
const fmtDataLonga = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

function diasAte(iso: string) {
  const alvo = new Date(iso + 'T12:00:00');
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return Math.ceil((alvo.getTime() - hoje.getTime()) / 86400000);
}

const STATUS_COR: Record<string, string> = {
  agendada:  '#3b82f6',
  realizada: '#22c55e',
  cancelada: '#94a3b8',
  remarcada: '#f59e0b',
};

const STATUS_LABEL: Record<string, string> = {
  agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada', remarcada: 'Remarcada',
};

export default function ConsultasPage() {
  const { phone } = useAuth();
  const [consultas, setConsultas] = useState<any[]>([]);
  const [exames, setExames]       = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalCons, setModalCons] = useState(false);
  const [modalExa, setModalExa]   = useState(false);
  const [edConsulta, setEd]       = useState<any | null>(null);
  const [exameSel, setExameSel]   = useState<string>('');

  const carregar = useCallback(async () => {
    if (!phone) return;
    try {
      const [c, e] = await Promise.all([
        api.saude.consultas.listar(phone),
        api.saude.exames.listar(phone),
      ]);
      setConsultas(c || []);
      setExames(e || []);
      if (!exameSel && (e || []).length) setExameSel(e[0].nome);
    } catch (err) { console.warn('[consultas]', err); }
    finally { setLoading(false); }
  }, [phone, exameSel]);

  useEffect(() => { carregar(); }, [carregar]);

  const proximas = useMemo(() =>
    consultas.filter(c => c.status === 'agendada' && diasAte(c.data) >= 0)
      .sort((a, b) => a.data.localeCompare(b.data)),
  [consultas]);

  const historico = useMemo(() =>
    consultas.filter(c => c.status !== 'agendada' || diasAte(c.data) < 0)
      .sort((a, b) => b.data.localeCompare(a.data)),
  [consultas]);

  const examesAgrupados = useMemo(() => {
    const map: Record<string, any[]> = {};
    exames.forEach(e => { (map[e.nome] = map[e.nome] || []).push(e); });
    return map;
  }, [exames]);

  const examesSelGrafico = useMemo(() => {
    if (!exameSel || !examesAgrupados[exameSel]) return [];
    return [...examesAgrupados[exameSel]]
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(e => ({ dia: fmtData(e.data), valor: parseFloat(e.valor) }));
  }, [examesAgrupados, exameSel]);

  const exameRef = useMemo(() => {
    if (!exameSel || !examesAgrupados[exameSel]?.length) return { min: null, max: null, unidade: '' };
    const ult = examesAgrupados[exameSel][0];
    return { min: ult.referencia_min, max: ult.referencia_max, unidade: ult.unidade };
  }, [examesAgrupados, exameSel]);

  // Próximos retornos pendentes
  const proximosRetornos = useMemo(() =>
    consultas.filter(c => c.retorno_data && diasAte(c.retorno_data) >= 0)
      .map(c => ({ ...c, diasParaRetorno: diasAte(c.retorno_data) }))
      .sort((a, b) => a.diasParaRetorno - b.diasParaRetorno),
  [consultas]);

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
             style={{ background: `radial-gradient(ellipse at top right, ${COR_CONS}24 0%, transparent 55%)` }} />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3" style={{ background: `${COR_CONS}1A` }}>
              <Sparkles size={11} style={{ color: COR_CONS }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COR_CONS }}>Consultas & Exames</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">Consultas</h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-md leading-relaxed">
              {proximas.length > 0
                ? <>Você tem <strong className="text-foreground">{proximas.length} consulta{proximas.length > 1 ? 's' : ''}</strong> agendada{proximas.length > 1 ? 's' : ''}. A próxima é em <strong className="text-foreground">{diasAte(proximas[0].data)} dia{diasAte(proximas[0].data) === 1 ? '' : 's'}</strong>.</>
                : <>Agende consultas, registre exames e acompanhe sua evolução.</>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setModalExa(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-sm font-bold border border-border/60 bg-card/60 backdrop-blur-xl hover:border-pink-300 dark:hover:border-pink-800 transition-all">
              <TestTube size={14} /> Exame
            </button>
            <button onClick={() => { setEd(null); setModalCons(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-lg shadow-violet-600/30">
              <Plus size={14} /> Agendar consulta
            </button>
          </div>
        </div>
      </div>

      {/* PRÓXIMAS CONSULTAS */}
      <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
           style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '60ms' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Próximas consultas</p>
            <p className="text-base font-bold text-foreground">{proximas.length} agendada{proximas.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        {proximas.length === 0 ? (
          <div className="rounded-2xl py-10 text-center bg-muted/20 border border-dashed border-border/60">
            <CalendarHeart size={20} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma consulta agendada.</p>
            <button onClick={() => { setEd(null); setModalCons(true); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-3 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">
              <Plus size={11} /> Agendar primeira
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {proximas.slice(0, 8).map(c => {
              const dias = diasAte(c.data);
              const urgente = dias <= 1;
              return (
                <button key={c.id} onClick={() => { setEd(c); setModalCons(true); }}
                        className={`group text-left rounded-2xl border backdrop-blur-xl p-4 transition-all hover:scale-[1.01] hover:border-violet-300 dark:hover:border-violet-800 ${
                          urgente ? 'border-pink-300 dark:border-pink-900/60 ring-1 ring-pink-300/40' : 'border-border/40'
                        }`}
                        style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-pink-100 dark:bg-pink-950/40">
                      <CalendarHeart size={18} className="text-pink-600 dark:text-pink-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-foreground truncate">{c.especialidade || 'Consulta'}</p>
                        <span className="text-[10px] font-bold tabular px-2 py-0.5 rounded-full"
                              style={{ background: urgente ? '#fce7f3' : '#f3f4f6', color: urgente ? '#be185d' : '#374151' }}>
                          {dias === 0 ? 'HOJE' : dias === 1 ? 'AMANHÃ' : `em ${dias}d`}
                        </span>
                      </div>
                      {c.profissional && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.profissional}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground tabular">
                        <span className="inline-flex items-center gap-1"><Calendar size={10} /> {fmtData(c.data)}</span>
                        {c.hora && <span className="inline-flex items-center gap-1"><Clock size={10} /> {c.hora.slice(0,5)}</span>}
                      </div>
                      {c.local && <p className="text-[10px] text-muted-foreground mt-1 truncate"><MapPin size={9} className="inline mr-0.5" /> {c.local}</p>}
                    </div>
                    <Pencil size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* RETORNOS PENDENTES */}
      {proximosRetornos.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 backdrop-blur-xl p-5 animate-fade-in bg-amber-50/40 dark:bg-amber-950/20"
             style={{ animationDelay: '120ms' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
            ⏰ Retornos pendentes
          </p>
          <div className="space-y-2">
            {proximosRetornos.slice(0, 3).map(r => (
              <div key={r.id} className="flex items-center gap-3 text-sm">
                <ChevronRight size={12} className="text-amber-600 dark:text-amber-400" />
                <span className="flex-1"><strong className="text-foreground">{r.especialidade || 'Retorno'}</strong> — em {r.diasParaRetorno} dia{r.diasParaRetorno === 1 ? '' : 's'} ({fmtData(r.retorno_data)})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXAMES — GRÁFICO + LISTA */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 animate-fade-in" style={{ animationDelay: '180ms' }}>

        <div className="lg:col-span-3 rounded-2xl border border-border/40 backdrop-blur-xl p-5"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Evolução de exame</p>
              <p className="text-base font-bold text-foreground">{exameSel || '—'}</p>
            </div>
          </div>
          {examesSelGrafico.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center">
              <TestTube size={20} className="text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">Sem exames registrados ainda.</p>
              <button onClick={() => setModalExa(true)} className="inline-flex items-center gap-1 px-2.5 py-1 mt-2 rounded-lg bg-violet-600 text-white text-[11px] font-bold hover:bg-violet-700">
                <Plus size={10} /> Registrar exame
              </button>
            </div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={examesSelGrafico} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={36} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                           formatter={(v: any) => [`${v} ${exameRef.unidade || ''}`.trim(), exameSel]} />
                  {exameRef.min != null && exameRef.max != null && (
                    <ReferenceArea y1={exameRef.min} y2={exameRef.max} fill="#22c55e" fillOpacity={0.08} stroke="#22c55e" strokeOpacity={0.3} />
                  )}
                  <Line type="monotone" dataKey="valor" stroke={COR_CONS} strokeWidth={2.5} dot={{ fill: COR_CONS, r: 5 }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-border/40 backdrop-blur-xl p-5"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Exames registrados</p>
          {Object.keys(examesAgrupados).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum exame ainda.</p>
          ) : (
            <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {Object.entries(examesAgrupados).map(([nome, lista]) => {
                const ult = lista[0];
                const fora = (ult.referencia_min != null && parseFloat(ult.valor) < ult.referencia_min) ||
                             (ult.referencia_max != null && parseFloat(ult.valor) > ult.referencia_max);
                return (
                  <button key={nome} onClick={() => setExameSel(nome)}
                          className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all ${
                            exameSel === nome ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40' : 'border-border/40 bg-muted/20 hover:border-violet-300 dark:hover:border-violet-800'
                          }`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{nome}</p>
                      <p className="text-[10px] text-muted-foreground tabular">{lista.length} registro{lista.length === 1 ? '' : 's'}</p>
                    </div>
                    <p className="text-[11px] font-bold tabular text-right" style={{ color: fora ? '#ef4444' : '#22c55e' }}>
                      {ult.valor} {ult.unidade}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* HISTÓRICO DE CONSULTAS */}
      {historico.length > 0 && (
        <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
             style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '240ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <History size={14} className="text-muted-foreground" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Histórico</p>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {historico.slice(0, 15).map(c => (
              <button key={c.id} onClick={() => { setEd(c); setModalCons(true); }}
                      className="w-full text-left group flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40 hover:border-violet-300 dark:hover:border-violet-800 transition-all">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${STATUS_COR[c.status] || '#94a3b8'}1A` }}>
                  <CalendarHeart size={14} style={{ color: STATUS_COR[c.status] || '#94a3b8' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{c.especialidade || c.profissional || 'Consulta'}</p>
                  <p className="text-[11px] text-muted-foreground tabular">{fmtDataLonga(c.data)}{c.hora ? ` · ${c.hora.slice(0,5)}` : ''}</p>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: `${STATUS_COR[c.status] || '#94a3b8'}1A`, color: STATUS_COR[c.status] || '#94a3b8' }}>
                  {STATUS_LABEL[c.status] || c.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {modalCons && phone && (
        <ModalConsulta phone={phone} consulta={edConsulta} onClose={() => { setModalCons(false); setEd(null); }} onSuccess={() => { carregar(); setModalCons(false); setEd(null); }} />
      )}
      {modalExa && phone && (
        <ModalExame phone={phone} onClose={() => setModalExa(false)} onSuccess={() => { carregar(); setModalExa(false); }} />
      )}
    </div>
  );
}

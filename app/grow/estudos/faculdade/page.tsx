'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import ModalCurso from '@/components/estudos/ModalCurso';
import ModalDisciplina from '@/components/estudos/ModalDisciplina';
import ModalProva from '@/components/estudos/ModalProva';
import ModalSessao from '@/components/estudos/ModalSessao';
import {
  GraduationCap, Sparkles, Loader2, Plus, Pencil, FileText, Calendar,
  BookOpen, Clock, ChevronRight, Trophy, Play,
} from 'lucide-react';

const BRAND = '#7c3aed';
const COR_FAC = '#6366f1';

const fmtData = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

function diasAte(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return Math.ceil((d.getTime() - hoje.getTime()) / 86400000);
}

export default function FaculdadePage() {
  const { phone } = useAuth();
  const [faculdades, setFaculdades]   = useState<any[]>([]);
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [provas, setProvas]           = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [cursoSel, setCursoSel]       = useState<string | null>(null);
  const [modalCurso, setModalCurso]   = useState(false);
  const [edCurso, setEdCurso]         = useState<any | null>(null);
  const [modalDisc, setModalDisc]     = useState(false);
  const [edDisc, setEdDisc]           = useState<any | null>(null);
  const [modalProva, setModalProva]   = useState(false);
  const [edProva, setEdProva]         = useState<any | null>(null);
  const [modalSessao, setModalSessao] = useState(false);

  const carregar = useCallback(async () => {
    if (!phone) return;
    try {
      const [f, d, p] = await Promise.all([
        api.estudos.cursos.listar(phone, { tipo: 'faculdade' }),
        api.estudos.disciplinas.listar(phone),
        api.estudos.provas.listar(phone),
      ]);
      setFaculdades(f || []);
      setDisciplinas(d || []);
      setProvas(p || []);
      if (!cursoSel && f && f.length > 0) setCursoSel(f[0].id);
    } catch (e) { console.warn('[faculdade]', e); }
    finally { setLoading(false); }
  }, [phone, cursoSel]);

  useEffect(() => { carregar(); }, [carregar]);

  const curso = useMemo(() => faculdades.find(c => c.id === cursoSel), [faculdades, cursoSel]);
  const discsDoCurso = useMemo(() => disciplinas.filter(d => d.curso_id === cursoSel), [disciplinas, cursoSel]);
  const provasDoCurso = useMemo(() => {
    return provas.filter(p => p.curso_id === cursoSel || (p.disciplina_id && discsDoCurso.some(d => d.id === p.disciplina_id)));
  }, [provas, cursoSel, discsDoCurso]);

  const proximasProvas = useMemo(() =>
    provasDoCurso.filter(p => !p.realizada && diasAte(p.data) >= 0).sort((a, b) => a.data.localeCompare(b.data)),
  [provasDoCurso]);

  const provasRealizadas = useMemo(() => provasDoCurso.filter(p => p.realizada), [provasDoCurso]);

  // Médias por disciplina
  const mediaPorDisc = useMemo(() => {
    const m: Record<string, { soma: number; pesos: number; provas: number }> = {};
    provasRealizadas.forEach(p => {
      if (!p.disciplina_id || p.nota_obtida == null) return;
      const peso = parseFloat(p.peso) || 1;
      const nota = parseFloat(p.nota_obtida);
      if (!m[p.disciplina_id]) m[p.disciplina_id] = { soma: 0, pesos: 0, provas: 0 };
      m[p.disciplina_id].soma += nota * peso;
      m[p.disciplina_id].pesos += peso;
      m[p.disciplina_id].provas += 1;
    });
    const out: Record<string, { media: number; provas: number }> = {};
    Object.entries(m).forEach(([id, v]) => {
      out[id] = { media: v.pesos ? v.soma / v.pesos : 0, provas: v.provas };
    });
    return out;
  }, [provasRealizadas]);

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
             style={{ background: `radial-gradient(ellipse at top right, ${COR_FAC}24 0%, transparent 55%)` }} />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3" style={{ background: `${COR_FAC}1A` }}>
              <Sparkles size={11} style={{ color: COR_FAC }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COR_FAC }}>Faculdade</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
              {curso ? curso.nome : 'Faculdade'}
            </h1>
            {curso ? (
              <p className="text-muted-foreground text-sm mt-2 max-w-md">
                {curso.instituicao && <>📚 {curso.instituicao}</>}
                {curso.instituicao && discsDoCurso.length > 0 && ' · '}
                {discsDoCurso.length > 0 && <>{discsDoCurso.length} disciplina{discsDoCurso.length === 1 ? '' : 's'}</>}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm mt-2 max-w-md leading-relaxed">
                Cadastre sua graduação, mestrado ou curso técnico. Vincule disciplinas, provas e acompanhe sua média.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {curso && (
              <button onClick={() => { setEdCurso(curso); setModalCurso(true); }}
                      className="inline-flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-bold border border-border/60 bg-card/60 backdrop-blur-xl hover:border-violet-300">
                <Pencil size={13} />
              </button>
            )}
            <button onClick={() => { setEdCurso(null); setModalCurso(true); }}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-sm font-bold border border-border/60 bg-card/60 backdrop-blur-xl hover:border-violet-300 dark:hover:border-violet-800 transition-all">
              <Plus size={14} /> Curso
            </button>
            <button onClick={() => setModalSessao(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-lg shadow-violet-600/30">
              <Play size={14} fill="currentColor" /> Estudar
            </button>
          </div>
        </div>
      </div>

      {/* Tabs (se mais de 1) */}
      {faculdades.length > 1 && (
        <div className="flex flex-wrap gap-2 animate-fade-in" style={{ animationDelay: '60ms' }}>
          {faculdades.map(c => (
            <button key={c.id} onClick={() => setCursoSel(c.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                cursoSel === c.id ? 'text-white shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
              style={cursoSel === c.id ? { background: c.cor || COR_FAC } : {}}>
              {c.icone || '🎓'} {c.nome}
            </button>
          ))}
        </div>
      )}

      {faculdades.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 p-10 sm:p-12 bg-indigo-50/30 dark:bg-indigo-950/10 animate-fade-in text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-indigo-100 dark:bg-indigo-900/40">
            <GraduationCap size={28} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-base font-bold text-foreground">Nenhuma faculdade cadastrada</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
            Adicione sua graduação, mestrado, doutorado ou curso técnico pra organizar disciplinas, provas e acompanhar médias.
          </p>
          <button onClick={() => { setEdCurso(null); setModalCurso(true); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 mt-5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700">
            <Plus size={13} /> Cadastrar faculdade
          </button>
        </div>
      ) : (
        <>
          {/* PRÓXIMAS PROVAS */}
          {proximasProvas.length > 0 && (
            <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
                 style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '120ms' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Próximas avaliações</p>
                  <p className="text-base font-bold text-foreground">{proximasProvas.length} agendada{proximasProvas.length === 1 ? '' : 's'}</p>
                </div>
                <button onClick={() => { setEdProva(null); setModalProva(true); }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 text-[11px] font-bold hover:bg-violet-200 dark:hover:bg-violet-900/60">
                  <Plus size={11} /> Nova
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {proximasProvas.slice(0, 9).map(p => {
                  const dias = diasAte(p.data);
                  const urgente = dias <= 3;
                  return (
                    <button key={p.id} onClick={() => { setEdProva(p); setModalProva(true); }}
                            className={`text-left rounded-xl p-3 border transition-all hover:scale-[1.01] ${
                              urgente ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 ring-1 ring-amber-300/30' : 'bg-muted/30 border-border/40 hover:border-violet-300'
                            }`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-foreground truncate flex-1">{p.titulo}</p>
                        <span className={`text-[9px] font-bold tabular px-1.5 py-0.5 rounded ${urgente ? 'bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200' : 'bg-muted text-muted-foreground'}`}>
                          {dias === 0 ? 'HOJE' : dias === 1 ? 'AMANHÃ' : `${dias}d`}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground tabular mt-0.5">{fmtData(p.data)}{p.hora ? ` · ${p.hora.slice(0,5)}` : ''}</p>
                      {p.disciplinas?.nome && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{p.disciplinas.icone || '📚'} {p.disciplinas.nome}</p>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* DISCIPLINAS COM MÉDIA */}
          <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
               style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '180ms' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Disciplinas</p>
                <p className="text-base font-bold text-foreground">{discsDoCurso.length} cadastrada{discsDoCurso.length === 1 ? '' : 's'}</p>
              </div>
              {curso && (
                <button onClick={() => { setEdDisc(null); setModalDisc(true); }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 text-[11px] font-bold hover:bg-violet-200">
                  <Plus size={11} /> Adicionar
                </button>
              )}
            </div>

            {discsDoCurso.length === 0 ? (
              <div className="rounded-xl py-8 text-center bg-muted/20 border border-dashed border-border/60">
                <BookOpen size={18} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhuma disciplina ainda.</p>
                <button onClick={() => { setEdDisc(null); setModalDisc(true); }}
                        className="text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline mt-2 inline-flex items-center gap-1">
                  <Plus size={10} /> Primeira disciplina
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {discsDoCurso.map(d => {
                  const stats = mediaPorDisc[d.id];
                  const corMedia = stats && stats.media >= 7 ? '#22c55e' : stats && stats.media >= 5 ? '#f59e0b' : stats ? '#ef4444' : '#94a3b8';
                  return (
                    <button key={d.id} onClick={() => { setEdDisc(d); setModalDisc(true); }}
                            className="text-left rounded-2xl border border-border/40 p-4 hover:border-violet-300 dark:hover:border-violet-800 transition-all"
                            style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-lg" style={{ background: `${d.cor || BRAND}1A` }}>
                          {d.icone || '📚'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{d.nome}</p>
                          {stats ? (
                            <p className="text-[11px] mt-0.5">
                              <span className="font-bold tabular" style={{ color: corMedia }}>Média {stats.media.toFixed(1)}</span>
                              <span className="text-muted-foreground"> · {stats.provas} prova{stats.provas === 1 ? '' : 's'}</span>
                            </p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground mt-0.5">sem notas ainda</p>
                          )}
                          {d.meta_minutos_semana && (
                            <p className="text-[10px] text-muted-foreground mt-0.5"><Target size={9} className="inline mr-0.5" /> meta {d.meta_minutos_semana}min/sem</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* PROVAS REALIZADAS (histórico) */}
          {provasRealizadas.length > 0 && (
            <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
                 style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '240ms' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Histórico</p>
                  <p className="text-base font-bold text-foreground">Notas obtidas</p>
                </div>
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {provasRealizadas.sort((a, b) => b.data.localeCompare(a.data)).slice(0, 15).map(p => {
                  const max = parseFloat(p.nota_maxima) || 10;
                  const pct = (parseFloat(p.nota_obtida) / max) * 100;
                  const cor = pct >= 70 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
                  return (
                    <button key={p.id} onClick={() => { setEdProva(p); setModalProva(true); }}
                            className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 border border-border/40 hover:border-violet-300 dark:hover:border-violet-800 transition-all">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${cor}1A` }}>
                        <FileText size={13} style={{ color: cor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{p.titulo}</p>
                        <p className="text-[10px] text-muted-foreground tabular">{fmtData(p.data)}{p.disciplinas?.nome ? ` · ${p.disciplinas.nome}` : ''}</p>
                      </div>
                      <p className="text-sm font-bold tabular" style={{ color: cor }}>{p.nota_obtida}<span className="text-[10px] text-muted-foreground">/{max}</span></p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {modalCurso && phone && (
        <ModalCurso phone={phone} curso={edCurso} tipoInicial="faculdade" onClose={() => { setModalCurso(false); setEdCurso(null); }} onSuccess={() => { carregar(); setModalCurso(false); setEdCurso(null); }} />
      )}
      {modalDisc && phone && (
        <ModalDisciplina phone={phone} disciplina={edDisc} cursos={faculdades} cursoIdInicial={cursoSel || undefined} onClose={() => { setModalDisc(false); setEdDisc(null); }} onSuccess={() => { carregar(); setModalDisc(false); setEdDisc(null); }} />
      )}
      {modalProva && phone && (
        <ModalProva phone={phone} prova={edProva} cursos={faculdades} disciplinas={discsDoCurso} cursoIdInicial={cursoSel || undefined} onClose={() => { setModalProva(false); setEdProva(null); }} onSuccess={() => { carregar(); setModalProva(false); setEdProva(null); }} />
      )}
      {modalSessao && phone && (
        <ModalSessao phone={phone} disciplinas={discsDoCurso} cursos={faculdades} onClose={() => setModalSessao(false)} onSuccess={() => { carregar(); setModalSessao(false); }} />
      )}
    </div>
  );
}

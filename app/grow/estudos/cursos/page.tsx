'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import ModalCurso from '@/components/estudos/ModalCurso';
import ModalSessao from '@/components/estudos/ModalSessao';
import {
  BookOpen, Sparkles, Loader2, Plus, ExternalLink, Clock, Play,
  Pencil, Check, Pause,
} from 'lucide-react';

const BRAND = '#7c3aed';
const COR_CURSOS = '#06b6d4';

const fmtData = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

const TIPO_ICONE: any = { online: '💻', idioma: '🗣️', outro: '📚' };

const FILTROS = [
  { v: 'todos',      l: 'Todos' },
  { v: 'ativo',      l: 'Em andamento' },
  { v: 'concluido',  l: 'Concluído' },
  { v: 'pausado',    l: 'Pausado' },
];

export default function CursosPage() {
  const { phone } = useAuth();
  const [cursos, setCursos]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro]   = useState('todos');
  const [modalCurso, setModalCurso] = useState(false);
  const [edCurso, setEdCurso] = useState<any | null>(null);
  const [modalSessao, setModalSessao] = useState(false);
  const [cursoSessao, setCursoSessao] = useState<any | null>(null);

  const carregar = useCallback(async () => {
    if (!phone) return;
    try {
      // Cursos online + idioma + outro (não faculdade nem concurso)
      const [online, idioma, outro] = await Promise.all([
        api.estudos.cursos.listar(phone, { tipo: 'online' }),
        api.estudos.cursos.listar(phone, { tipo: 'idioma' }),
        api.estudos.cursos.listar(phone, { tipo: 'outro' }),
      ]);
      setCursos([...(online || []), ...(idioma || []), ...(outro || [])]);
    } catch (e) { console.warn('[cursos]', e); }
    finally { setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return cursos;
    return cursos.filter(c => c.status === filtro);
  }, [cursos, filtro]);

  const stats = useMemo(() => ({
    total:      cursos.length,
    ativos:     cursos.filter(c => c.status === 'ativo').length,
    concluidos: cursos.filter(c => c.status === 'concluido').length,
    pausados:   cursos.filter(c => c.status === 'pausado').length,
  }), [cursos]);

  async function alternarStatus(c: any) {
    const novoStatus = c.status === 'ativo' ? 'pausado' : c.status === 'pausado' ? 'ativo' : c.status === 'concluido' ? 'ativo' : 'ativo';
    try {
      await api.estudos.cursos.editar(c.id, { status: novoStatus });
      carregar();
    } catch (e: any) { alert(e.message); }
  }

  async function marcarConcluido(c: any) {
    try {
      await api.estudos.cursos.editar(c.id, { status: 'concluido', progresso_pct: 100 });
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
             style={{ background: `radial-gradient(ellipse at top right, ${COR_CURSOS}24 0%, transparent 55%)` }} />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3" style={{ background: `${COR_CURSOS}1A` }}>
              <Sparkles size={11} style={{ color: COR_CURSOS }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COR_CURSOS }}>Cursos & Idiomas</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">Cursos online</h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-md leading-relaxed">
              {cursos.length > 0
                ? <>{stats.ativos} em andamento · {stats.concluidos} concluído{stats.concluidos === 1 ? '' : 's'} · {stats.pausados} pausado{stats.pausados === 1 ? '' : 's'}</>
                : <>Udemy, Coursera, YouTube, Alura, Duolingo, Rosetta Stone — organize todos em um lugar.</>}
            </p>
          </div>
          <button onClick={() => { setEdCurso(null); setModalCurso(true); }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-lg shadow-violet-600/30">
            <Plus size={14} /> Novo curso
          </button>
        </div>
      </div>

      {cursos.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-cyan-300 dark:border-cyan-800 p-10 sm:p-12 bg-cyan-50/30 dark:bg-cyan-950/10 animate-fade-in text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-cyan-100 dark:bg-cyan-900/40">
            <BookOpen size={28} className="text-cyan-600 dark:text-cyan-400" />
          </div>
          <p className="text-base font-bold text-foreground">Nenhum curso cadastrado</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
            Cadastre cursos online, idiomas e outras formações. Acompanhe progresso, tempo dedicado e mantenha tudo organizado.
          </p>
          <button onClick={() => { setEdCurso(null); setModalCurso(true); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 mt-5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700">
            <Plus size={13} /> Cadastrar curso
          </button>
        </div>
      ) : (
        <>
          {/* FILTRO */}
          <div className="inline-flex items-center gap-1 bg-muted/40 rounded-2xl p-1.5 animate-fade-in" style={{ animationDelay: '60ms' }}>
            {FILTROS.map(f => {
              const ativo = filtro === f.v;
              const count = f.v === 'todos' ? cursos.length : cursos.filter(c => c.status === f.v).length;
              return (
                <button key={f.v} onClick={() => setFiltro(f.v)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    ativo ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {f.l}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular ${ativo ? 'bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400' : 'bg-muted-foreground/15 text-muted-foreground'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* GRID DE CURSOS */}
          {filtrados.length === 0 ? (
            <div className="card rounded-3xl py-12 text-center text-sm text-muted-foreground animate-fade-in">
              Nenhum curso nesse filtro.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: '120ms' }}>
              {filtrados.map(c => {
                const concluido = c.status === 'concluido';
                const pausado   = c.status === 'pausado';
                return (
                  <div key={c.id}
                       className={`group rounded-2xl border backdrop-blur-xl p-5 transition-all relative overflow-hidden ${
                         concluido ? 'border-emerald-200 dark:border-emerald-900/60 opacity-80' :
                         pausado   ? 'border-border/40 opacity-60' :
                         'border-border/40 hover:border-violet-300 dark:hover:border-violet-800 hover:scale-[1.01]'
                       }`}
                       style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
                    {/* Linha decorativa */}
                    <div className="absolute top-0 left-0 right-0 h-1" style={{ background: c.cor || COR_CURSOS, opacity: pausado ? 0.4 : 1 }} />

                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl" style={{ background: `${c.cor || COR_CURSOS}1A` }}>
                        {c.icone || TIPO_ICONE[c.tipo] || '📚'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-foreground truncate flex-1">{c.nome}</p>
                          <button onClick={() => { setEdCurso(c); setModalCurso(true); }} className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                            <Pencil size={11} className="text-muted-foreground" />
                          </button>
                        </div>
                        {c.instituicao && <p className="text-[11px] text-muted-foreground truncate">{c.instituicao}</p>}
                        {c.instrutor && <p className="text-[10px] text-muted-foreground truncate">{c.instrutor}</p>}
                      </div>
                    </div>

                    {!concluido && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">Progresso</span>
                          <span className="text-[11px] font-bold tabular" style={{ color: c.cor || COR_CURSOS }}>{Math.round(c.progresso_pct || 0)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full transition-all duration-700" style={{ width: `${Math.min(100, c.progresso_pct || 0)}%`, background: c.cor || COR_CURSOS }} />
                        </div>
                      </div>
                    )}

                    {(c.carga_horaria_h || c.data_fim) && (
                      <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground tabular flex-wrap">
                        {c.carga_horaria_h && <span><Clock size={9} className="inline mr-0.5" /> {c.carga_horaria_h}h</span>}
                        {c.data_fim && <span>até {fmtData(c.data_fim)}</span>}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 mt-4">
                      {concluido ? (
                        <div className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                          <Check size={11} /> Concluído
                        </div>
                      ) : (
                        <>
                          <button onClick={() => { setCursoSessao(c); setModalSessao(true); }}
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold">
                            <Play size={11} fill="currentColor" /> Estudar
                          </button>
                          <button onClick={() => alternarStatus(c)} className="px-2 py-2 rounded-lg bg-muted hover:bg-muted/70 text-muted-foreground" title={pausado ? 'Retomar' : 'Pausar'}>
                            {pausado ? <Play size={11} fill="currentColor" /> : <Pause size={11} fill="currentColor" />}
                          </button>
                          {!pausado && (
                            <button onClick={() => marcarConcluido(c)} className="px-2 py-2 rounded-lg bg-muted hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-muted-foreground hover:text-emerald-600 transition-colors" title="Marcar concluído">
                              <Check size={11} />
                            </button>
                          )}
                          {c.url && (
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="px-2 py-2 rounded-lg bg-muted hover:bg-muted/70 text-muted-foreground" title="Abrir link">
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {modalCurso && phone && (
        <ModalCurso phone={phone} curso={edCurso} tipoInicial="online" onClose={() => { setModalCurso(false); setEdCurso(null); }} onSuccess={() => { carregar(); setModalCurso(false); setEdCurso(null); }} />
      )}
      {modalSessao && phone && cursoSessao && (
        <ModalSessao phone={phone} disciplinas={[]} cursos={[cursoSessao]} onClose={() => { setModalSessao(false); setCursoSessao(null); }} onSuccess={() => { carregar(); setModalSessao(false); setCursoSessao(null); }} />
      )}
    </div>
  );
}

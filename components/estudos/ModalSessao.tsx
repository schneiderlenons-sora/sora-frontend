'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { X, Loader2, Check, AlertCircle, BookOpen, Play, Pause, Square, Clock } from 'lucide-react';

const TIPOS = [
  { v: 'estudo',      l: 'Estudo' },
  { v: 'revisao',     l: 'Revisão' },
  { v: 'exercicios',  l: 'Exercícios' },
  { v: 'leitura',     l: 'Leitura' },
  { v: 'video',       l: 'Vídeo' },
  { v: 'aula',        l: 'Aula' },
  { v: 'simulado',    l: 'Simulado' },
  { v: 'projeto',     l: 'Projeto' },
];

interface Props {
  phone:        string;
  disciplinas:  any[];
  cursos:       any[];
  onClose:      () => void;
  onSuccess:    () => void;
}

export default function ModalSessao({ phone, disciplinas, cursos, onClose, onSuccess }: Props) {
  const [aba, setAba] = useState<'pomodoro' | 'manual'>('pomodoro');

  // Pomodoro
  const [duracaoSeg, setDuracaoSeg] = useState(25 * 60);
  const [restante, setRestante]     = useState(25 * 60);
  const [rodando, setRodando]       = useState(false);
  const interval = useRef<any>(null);

  useEffect(() => {
    if (!rodando) return;
    interval.current = setInterval(() => setRestante(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(interval.current);
  }, [rodando]);

  useEffect(() => {
    if (restante === 0 && rodando) {
      setRodando(false);
      // Auto-preenche o manual com o pomodoro completado
      setDuracaoManual(String(Math.round(duracaoSeg / 60)));
      setAba('manual');
    }
  }, [restante, rodando, duracaoSeg]);

  function definirPreset(min: number) {
    setDuracaoSeg(min * 60);
    setRestante(min * 60);
    setRodando(false);
  }

  // Manual
  const [duracaoManual, setDuracaoManual] = useState('60');
  const [disciplinaId, setDisciplinaId]   = useState<string>('');
  const [cursoId, setCursoId]             = useState<string>('');
  const [tipo, setTipo]                   = useState('estudo');
  const [tema, setTema]                   = useState('');
  const [observacao, setObservacao]       = useState('');
  const [produtividade, setProdutividade] = useState(0);
  const [data, setData]                   = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading]             = useState(false);
  const [erro, setErro]                   = useState('');

  async function salvar() {
    setErro('');
    const dur = parseInt(duracaoManual);
    if (!dur || dur <= 0) { setErro('Duração inválida.'); return; }
    setLoading(true);
    try {
      await api.estudos.sessoes.criar({
        phone, duracao_min: dur, data, tipo,
        disciplina_id: disciplinaId || null,
        curso_id: cursoId || null,
        tema: tema.trim() || null,
        observacao: observacao.trim() || null,
        produtividade: produtividade || null,
      });
      onSuccess();
    } catch (e: any) { setErro(e.message); }
    finally { setLoading(false); }
  }

  const minRest = Math.floor(restante / 60);
  const segRest = restante % 60;
  const progresso = ((duracaoSeg - restante) / duracaoSeg) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in max-h-[92vh] flex flex-col"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-100 dark:bg-violet-950/40">
              <BookOpen size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">Sessão de estudo</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="flex border-b border-border">
          {[
            { v: 'pomodoro', l: 'Timer' },
            { v: 'manual',   l: 'Registrar manual' },
          ].map(t => (
            <button key={t.v} onClick={() => setAba(t.v as any)}
              className={`flex-1 px-4 py-2.5 text-xs font-bold transition-all relative ${
                aba === t.v ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {t.l}
              {aba === t.v && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 dark:bg-violet-400" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {aba === 'pomodoro' ? (
            <>
              <div className="text-center py-3">
                <div className="relative inline-flex items-center justify-center mb-4">
                  <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
                    <circle cx="90" cy="90" r="78" stroke="hsl(var(--muted))" strokeWidth="8" fill="none" />
                    <circle cx="90" cy="90" r="78" stroke="#7c3aed" strokeWidth="8" fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${(progresso/100) * 490} 490`}
                      className="transition-all duration-1000" />
                  </svg>
                  <div className="absolute text-center">
                    <p className="text-5xl font-bold text-foreground tabular tracking-tight leading-none">
                      {String(minRest).padStart(2, '0')}<span className="text-2xl text-muted-foreground">:</span>{String(segRest).padStart(2, '0')}
                    </p>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1">
                      {rodando ? 'estudando' : restante === 0 ? 'completo!' : 'pronto'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-center gap-2 mb-4">
                  {[15, 25, 45, 60, 90].map(min => (
                    <button key={min} onClick={() => definirPreset(min)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        duracaoSeg === min * 60 ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300' : 'border-border bg-muted/30 hover:border-violet-300'
                      }`}>
                      {min}m
                    </button>
                  ))}
                </div>

                <div className="flex justify-center gap-3">
                  <button onClick={() => setRodando(!rodando)}
                          disabled={restante === 0}
                          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                            rodando ? 'bg-amber-500 hover:bg-amber-600' : 'bg-violet-600 hover:bg-violet-700'
                          } text-white disabled:opacity-50`}>
                    {rodando ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                  </button>
                  <button onClick={() => { setRodando(false); setRestante(duracaoSeg); }}
                          className="w-14 h-14 rounded-full flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground">
                    <Square size={18} />
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-center text-muted-foreground">
                Ao terminar, o tempo é levado pra aba <strong>Registrar manual</strong> pra você confirmar.
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Duração (min)</label>
                  <input type="text" inputMode="numeric" value={duracaoManual} onChange={e => setDuracaoManual(e.target.value.replace(/[^\d]/g, ''))} className="input text-center tabular font-bold text-base" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Data</label>
                  <input type="date" value={data} onChange={e => setData(e.target.value)} max={new Date().toISOString().slice(0,10)} className="input" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Disciplina</label>
                <select value={disciplinaId} onChange={e => setDisciplinaId(e.target.value)} className="input">
                  <option value="">— Sem disciplina específica —</option>
                  {disciplinas.map(d => <option key={d.id} value={d.id}>{d.icone || '📚'} {d.nome}</option>)}
                </select>
              </div>

              {cursos.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Curso</label>
                  <select value={cursoId} onChange={e => setCursoId(e.target.value)} className="input">
                    <option value="">— Sem curso vinculado —</option>
                    {cursos.map(c => <option key={c.id} value={c.id}>{c.icone || '🎓'} {c.nome}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Tipo</label>
                <div className="grid grid-cols-4 gap-1">
                  {TIPOS.map(t => (
                    <button key={t.v} type="button" onClick={() => setTipo(t.v)}
                      className={`px-1.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                        tipo === t.v ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300' : 'border-border bg-muted/20 hover:border-violet-300'
                      }`}>
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Tema</label>
                <input value={tema} onChange={e => setTema(e.target.value)} placeholder="O que você estudou?" className="input" maxLength={100} />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Produtividade {produtividade ? `${produtividade}/5` : ''}</label>
                <div className="flex gap-1.5">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setProdutividade(produtividade === n ? 0 : n)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                        produtividade >= n ? 'border-violet-500 bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300' : 'border-border bg-muted/20 hover:border-violet-300'
                      }`}>
                      ⭐
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Observação</label>
                <input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Anotações..." className="input" maxLength={150} />
              </div>

              {erro && (
                <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
                  <AlertCircle size={15} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700 dark:text-red-400">{erro}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          {aba === 'manual' && (
            <button onClick={salvar} disabled={loading || !duracaoManual}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Registrar sessão
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
